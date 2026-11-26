import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { resolveViewports, DEFAULT_FOLD_TRANSITIONS, getViewportByKey } from "./viewports.mjs";

const DEFAULT_SCROLL_ALLOWLIST = [
  "[data-scroll-strip]",
  ".table-wrapper",
  ".blog-table-wrap",
  "pre",
];

/**
 * Dynamically load `playwright` or `playwright-core` without requiring it as a
 * hard runtime dependency of this package.
 */
export function resolvePlaywright({ playwrightFrom = "" } = {}) {
  const candidates = [];
  const pushFromPath = (p) => {
    if (!p) return;
    const abs = path.resolve(p);
    if (fs.existsSync(abs)) {
      const stat = fs.statSync(abs);
      if (stat.isFile()) {
        candidates.push({ type: "requireFrom", file: abs });
        if (abs.endsWith(".js") || abs.endsWith(".cjs") || abs.endsWith(".mjs")) {
          candidates.push({ type: "direct", file: abs });
        }
      } else if (stat.isDirectory()) {
        candidates.push({ type: "requireFrom", file: path.join(abs, "package.json") });
        candidates.push({ type: "direct", file: abs });
      }
    }
  };

  pushFromPath(playwrightFrom);
  pushFromPath(process.env.PLAYWRIGHT_PATH);
  candidates.push({ type: "requireFrom", file: path.join(process.cwd(), "package.json") });
  candidates.push({ type: "requireFrom", file: import.meta.url });

  const errors = [];
  for (const cand of candidates) {
    try {
      if (cand.type === "direct") {
        const req = createRequire(import.meta.url);
        const mod = req(cand.file);
        const pw = mod?.chromium ? mod : mod?.default;
        if (pw?.chromium) return pw;
      } else {
        const req = createRequire(cand.file);
        for (const pkg of ["playwright", "playwright-core"]) {
          try {
            const mod = req(pkg);
            const pw = mod?.chromium ? mod : mod?.default;
            if (pw?.chromium) return pw;
          } catch (e) {
            errors.push(`${cand.file} -> ${pkg}: ${e.code || e.message}`);
          }
        }
      }
    } catch (e) {
      errors.push(`${cand.file}: ${e.code || e.message}`);
    }
  }

  throw new Error(
    [
      "Could not locate `playwright` or `playwright-core`.",
      "Install Playwright in your project (`npm i -D playwright`) or pass `--playwright-from <path>` / set `PLAYWRIGHT_PATH`.",
      `Attempts: ${errors.slice(0, 4).join(" | ")}`,
    ].join("\n")
  );
}

/**
 * Always launches strictly headless without stealing OS focus.
 */
async function launchHeadlessBrowser(chromium, preferredChannel = "auto") {
  const attempts =
    preferredChannel && preferredChannel !== "auto"
      ? preferredChannel === "chromium"
        ? [{ headless: true }]
        : [{ headless: true, channel: preferredChannel }]
      : [
          { headless: true, channel: "chrome" },
          { headless: true, channel: "msedge" },
          { headless: true },
        ];

  const errs = [];
  for (const opts of attempts) {
    try {
      const browser = await chromium.launch(opts);
      return { browser, launchedChannel: opts.channel || "chromium" };
    } catch (e) {
      errs.push(`${opts.channel || "chromium"}: ${e.message.split("\n")[0]}`);
    }
  }
  throw new Error(`Failed to launch headless Chromium browser.\n${errs.join("\n")}`);
}

/**
 * Best-effort Chromium CDP emulation for foldable device posture & hinge display features.
 * Falls back silently if the browser engine or channel does not support these experimental commands.
 */
async function applyFoldableEmulation(ctx, page, { width, height, deviceScaleFactor = 1, isMobile = true, posture = null, displayFeature = null }, existingCdp = null) {
  let cdp = existingCdp;
  if (!posture && !displayFeature && !cdp) {
    return { cdp: null, postureApplied: false, displayFeatureApplied: false };
  }
  let postureApplied = false;
  let displayFeatureApplied = false;
  try {
    if (!cdp) {
      cdp = await ctx.newCDPSession(page);
    }
    if (posture) {
      await cdp.send("Emulation.setDevicePostureOverride", {
        posture: { type: posture },
      });
      postureApplied = true;
    } else if (existingCdp) {
      await cdp.send("Emulation.clearDevicePostureOverride").catch(() => {});
    }

    if (displayFeature) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor,
        mobile: Boolean(isMobile),
        displayFeature: {
          orientation: displayFeature.orientation,
          offset: displayFeature.offset,
          maskLength: displayFeature.maskLength,
        },
      });
      displayFeatureApplied = true;
    } else if (existingCdp) {
      await cdp.send("Emulation.clearDeviceMetricsOverride").catch(() => {});
      await page.setViewportSize({ width, height });
    }
  } catch {
    // Non-Chromium or older browser builds ignore experimental foldable CDP commands
  }
  return { cdp, postureApplied, displayFeatureApplied };
}

/**
 * In-page geometry, ergonomics, overlay, hinge, and fold-budget probe.
 */
async function evaluatePageMetrics(page, options) {
  return page.evaluate((opts) => {
    const { isMobile, expectedWidth, expectedHeight, primarySelector, scrollAllowSelector, displayFeature } = opts;
    const rawVw = window.innerWidth;
    const rawVh = window.innerHeight;
    // When isMobile: true, Chromium shrinks-to-fit overflowing pages by inflating window.innerWidth
    // beyond the requested viewport width. Always measure against the intended viewport dimensions.
    const vw = expectedWidth ? Math.min(rawVw, expectedWidth) : rawVw;
    const vh = expectedHeight ? Math.min(rawVh, expectedHeight) : rawVh;
    const viewportInflatedBy = expectedWidth ? Math.round(rawVw - expectedWidth) : 0;
    const docEl = document.documentElement;
    const body = document.body;

    const describeEl = (el) => {
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : "";
      const cls =
        typeof el.className === "string" && el.className.trim()
          ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
          : "";
      const text = (el.getAttribute("aria-label") || el.textContent || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 36);
      return { selector: `${tag}${id}${cls}`, text };
    };

    const isEffectivelyHidden = (el) => {
      if (!el || el.nodeType !== 1) return true;
      if (el.closest("dialog:not([open]), [hidden], [aria-hidden='true'], [inert]")) return true;
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden" || parseFloat(s.opacity) === 0) {
        return true;
      }
      if (s.clip === "rect(0px, 0px, 0px, 0px)" || s.clipPath === "inset(50%)") return true;
      return false;
    };

    // If a modal dialog is open, treat it as the active foreground scope for overlap checks
    const openDialogs = [...document.querySelectorAll("dialog[open]")].filter(
      (d) => getComputedStyle(d).display !== "none"
    );
    const activeModalScope = openDialogs.length > 0 ? openDialogs[openDialogs.length - 1] : null;

    // 1. Document horizontal overflow & root masking (include mobile shrink-to-fit inflation)
    const rootOverflow = Math.max(Math.round(docEl.scrollWidth - vw), viewportInflatedBy);
    const htmlOx = getComputedStyle(docEl).overflowX;
    const bodyOx = body ? getComputedStyle(body).overflowX : "visible";
    const rootMaskedOverflow = [htmlOx, bodyOx].some((v) => v === "hidden" || v === "clip");

    // 2. [hidden] attribute leaks (flex/grid specificity overriding UA [hidden])
    const hiddenAttrLeaks = [];
    for (const el of document.querySelectorAll("[hidden]")) {
      if (el.closest("template")) continue;
      if (getComputedStyle(el).display !== "none") {
        hiddenAttrLeaks.push(describeEl(el));
      }
    }

    // 3. Visible element right/left viewport edge clipping
    const edgeClipped = [];
    const seenClipKeys = new Set();
    for (const el of document.querySelectorAll("body *")) {
      const tag = el.tagName;
      if (
        tag === "SCRIPT" ||
        tag === "STYLE" ||
        tag === "LINK" ||
        tag === "META" ||
        tag === "NOSCRIPT" ||
        tag === "TEMPLATE" ||
        tag === "OPTION" ||
        tag === "OPTGROUP"
      ) {
        continue;
      }
      if (el.closest("svg") && tag.toLowerCase() !== "svg") continue;
      if (isEffectivelyHidden(el)) continue;

      const allowAncestor = scrollAllowSelector ? el.closest(scrollAllowSelector) : null;
      if (allowAncestor && allowAncestor !== el) continue;

      const r = el.getBoundingClientRect();
      if (r.width < 1.5 || r.height < 1.5) continue;
      if (r.bottom < -2 || r.top > Math.max(vh * 5, docEl.scrollHeight + 100)) continue;

      if (r.right > vw + 1.5 || r.left < -1.5) {
        const info = describeEl(el);
        const key = `${info.selector}|${Math.round(r.left)}|${Math.round(r.right)}`;
        if (!seenClipKeys.has(key)) {
          seenClipKeys.add(key);
          edgeClipped.push({
            ...info,
            left: Math.round(r.left),
            right: Math.round(r.right),
            vw,
          });
        }
      }
    }

    // 4. Interactive controls: overlap, text clipping, touch targets, iOS sub-16px inputs
    const interactiveSel =
      "button, a[href], select, input:not([type='hidden']), textarea, [role='button'], [role='tab'], summary";
    const interactiveRoot = activeModalScope || document;
    const interactiveEls = [...interactiveRoot.querySelectorAll(interactiveSel)].filter((el) => {
      if (isEffectivelyHidden(el)) return false;
      const r = el.getBoundingClientRect();
      return r.width > 1.5 && r.height > 1.5;
    });

    const interactiveOverlaps = [];
    const overlapPairs = new Set();
    for (let i = 0; i < interactiveEls.length; i++) {
      for (let j = i + 1; j < interactiveEls.length; j++) {
        const aEl = interactiveEls[i];
        const bEl = interactiveEls[j];
        if (aEl.contains(bEl) || bEl.contains(aEl)) continue;
        // Skip checkbox/radio inside same label pair
        if (aEl.closest("label") && aEl.closest("label") === bEl.closest("label")) continue;
        const a = aEl.getBoundingClientRect();
        const b = bEl.getBoundingClientRect();
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > 4 && oy > 4) {
          const da = describeEl(aEl);
          const db = describeEl(bEl);
          const key = `${da.selector}|${db.selector}`;
          if (!overlapPairs.has(key)) {
            overlapPairs.add(key);
            interactiveOverlaps.push({
              a: da,
              b: db,
              overlapX: Math.round(ox),
              overlapY: Math.round(oy),
            });
          }
        }
      }
    }

    const clippedControls = [];
    const smallTouchTargets = [];
    const iosSub16Inputs = [];

    for (const el of interactiveEls) {
      const style = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const tag = el.tagName;

      // Clipped control label check (buttons, selects, tabs)
      if (tag === "BUTTON" || tag === "SELECT" || el.getAttribute("role") === "tab") {
        if (style.overflowX !== "visible" && el.scrollWidth > el.clientWidth + 2) {
          clippedControls.push({
            ...describeEl(el),
            scrollWidth: Math.round(el.scrollWidth),
            clientWidth: Math.round(el.clientWidth),
          });
        }
      }

      if (isMobile) {
        // iOS Safari auto-zoom check
        const inputType = (el.getAttribute("type") || "text").toLowerCase();
        const isTextFormControl =
          tag === "SELECT" ||
          tag === "TEXTAREA" ||
          (tag === "INPUT" &&
            !["checkbox", "radio", "range", "color", "file", "submit", "button", "reset", "image"].includes(
              inputType
            ));
        if (isTextFormControl) {
          const fsPx = parseFloat(style.fontSize);
          if (!Number.isNaN(fsPx) && fsPx < 15.9) {
            iosSub16Inputs.push({
              ...describeEl(el),
              fontSize: Number(fsPx.toFixed(1)),
            });
          }
        }

        // Touch target check (exempt inline prose links and checkboxes inside >=44px labels)
        const isInlineProseLink =
          tag === "A" &&
          style.display === "inline" &&
          Boolean(el.closest("p, li, dd, blockquote, small, footer"));

        if (!isInlineProseLink) {
          let hitRect = r;
          if (tag === "INPUT" && (inputType === "checkbox" || inputType === "radio")) {
            const label =
              el.closest("label") ||
              (el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null);
            if (label) {
              hitRect = label.getBoundingClientRect();
            }
          }
          const minDim = Math.min(hitRect.width, hitRect.height);
          if (minDim < 44) {
            smallTouchTargets.push({
              ...describeEl(el),
              width: Math.round(hitRect.width),
              height: Math.round(hitRect.height),
              severity: minDim < 32 ? "fail" : "warn",
            });
          }
        }
      }
    }

    // 5. Open overlays (<dialog[open]> & [popover]:popover-open)
    const openOverlays = [];
    const overlayEls = new Set([...openDialogs]);
    try {
      for (const pop of document.querySelectorAll(":popover-open")) {
        overlayEls.add(pop);
      }
    } catch {
      // Older engines without :popover-open pseudo-class
    }

    for (const el of overlayEls) {
      const ovStyle = getComputedStyle(el);
      if (ovStyle.display === "none") continue;
      const r = el.getBoundingClientRect();
      const innerOverflowX = Math.round(el.scrollWidth - el.clientWidth);
      const innerOverflowY = Math.round(el.scrollHeight - el.clientHeight);
      const unscrollableClipY =
        innerOverflowY > 2 && !["auto", "scroll"].includes(ovStyle.overflowY);
      const outOfBounds =
        r.top < -1 || r.left < -1 || r.right > vw + 1.5 || r.bottom > vh + 1.5;
      if (outOfBounds || innerOverflowX > 1 || unscrollableClipY) {
        openOverlays.push({
          ...describeEl(el),
          top: Math.round(r.top),
          left: Math.round(r.left),
          right: Math.round(r.right),
          bottom: Math.round(r.bottom),
          vw,
          vh,
          innerOverflowX,
          ...(unscrollableClipY ? { unscrollableClipY: innerOverflowY } : {}),
        });
      }
    }

    // 6. Unintended table overflow (excluding explicit [data-scroll-strip])
    const tableOverflows = [];
    for (const el of document.querySelectorAll("table, .table-wrapper")) {
      if (isEffectivelyHidden(el)) continue;
      if (el.matches("[data-scroll-strip]") || el.closest("[data-scroll-strip]")) continue;
      const delta = Math.round(el.scrollWidth - el.clientWidth);
      if (delta > 1) {
        tableOverflows.push({ ...describeEl(el), delta });
      }
    }

    // 7. Above-the-fold primary content height budget
    let foldBudget = null;
    const primaryEl = primarySelector
      ? document.querySelector(primarySelector)
      : document.querySelector("main, [role='main'], article");
    if (primaryEl && !isEffectivelyHidden(primaryEl)) {
      const pr = primaryEl.getBoundingClientRect();
      const visTop = Math.max(0, pr.top);
      const visBottom = Math.min(vh, pr.bottom);
      const visibleHeight = Math.max(0, Math.round(visBottom - visTop));
      const topOffsetRatio = Number((visTop / Math.max(1, vh)).toFixed(2));
      const minRequired = vh <= 420 ? 180 : 240;
      foldBudget = {
        selector: describeEl(primaryEl).selector,
        vh,
        topOffsetRatio,
        visibleHeight,
        squeezed: topOffsetRatio > 0.45 || visibleHeight < Math.min(minRequired, Math.round(pr.height)),
      };
    }

    // 8. Foldable hinge / display feature obstruction check (when displayFeature is active)
    const hingeObstructions = [];
    if (displayFeature && typeof displayFeature.offset === "number") {
      const hingeStart = displayFeature.offset;
      const hingeEnd = displayFeature.offset + (displayFeature.maskLength || 0);
      const isVertical = displayFeature.orientation === "vertical";
      const seenHingeKeys = new Set();
      const checkHingeCandidate = (el, kind) => {
        if (isEffectivelyHidden(el)) return;
        const r = el.getBoundingClientRect();
        if (r.width < 1.5 || r.height < 1.5) return;
        // Skip intentional full-width / full-height container shells
        if (isVertical && r.width >= vw * 0.9) return;
        if (!isVertical && r.height >= vh * 0.9) return;
        const crosses = isVertical
          ? r.left < hingeEnd && r.right > hingeStart
          : r.top < hingeEnd && r.bottom > hingeStart;
        if (crosses) {
          const info = describeEl(el);
          const key = `${kind}|${info.selector}`;
          if (!seenHingeKeys.has(key)) {
            seenHingeKeys.add(key);
            hingeObstructions.push({
              ...info,
              kind,
              left: Math.round(r.left),
              top: Math.round(r.top),
              right: Math.round(r.right),
              bottom: Math.round(r.bottom),
            });
          }
        }
      };
      for (const el of interactiveEls) checkHingeCandidate(el, "control");
      for (const el of overlayEls) checkHingeCandidate(el, "overlay");
    }

    return {
      vw,
      vh,
      rawVw,
      rawVh,
      viewportInflatedBy,
      scrollHeight: Math.round(docEl.scrollHeight),
      rootOverflow,
      rootMaskedOverflow,
      hiddenAttrLeaks,
      edgeClipped: edgeClipped.slice(0, 20),
      edgeClippedTotal: edgeClipped.length,
      interactiveOverlaps: interactiveOverlaps.slice(0, 15),
      clippedControls: clippedControls.slice(0, 15),
      iosSub16Inputs: iosSub16Inputs.slice(0, 15),
      smallTouchTargets: smallTouchTargets.slice(0, 20),
      openOverlays,
      tableOverflows: tableOverflows.slice(0, 10),
      foldBudget,
      hingeOrientation: displayFeature?.orientation || null,
      hingeObstructions: hingeObstructions.slice(0, 15),
    };
  }, options);
}

function classifyMetrics(metrics, { consoleErrors = [], pageErrors = [], httpErrors = [] }, phaseLabel = "initial") {
  const checks = [];
  const push = (id, severity, message, details = undefined) => {
    checks.push({ id, phase: phaseLabel, severity, message, ...(details !== undefined ? { details } : {}) });
  };

  if (consoleErrors.length > 0 || pageErrors.length > 0) {
    push(
      "runtime-errors",
      "fail",
      `${consoleErrors.length} console error(s) and ${pageErrors.length} uncaught page error(s).`,
      { consoleErrors, pageErrors }
    );
  }
  if (httpErrors.length > 0) {
    push("http-errors", "warn", `${httpErrors.length} HTTP >= 400 response(s).`, httpErrors.slice(0, 10));
  }
  if (metrics.rootOverflow > 1) {
    push(
      "document-overflow",
      "fail",
      `Document horizontal overflow of ${metrics.rootOverflow}px (scrollWidth > innerWidth).`,
      { rootOverflow: metrics.rootOverflow, vw: metrics.vw }
    );
  }
  if (metrics.rootMaskedOverflow) {
    push(
      "root-overflow-masked",
      "warn",
      "html or body sets overflow-x: hidden/clip, which can mask clipping bugs and break position: sticky."
    );
  }
  if (metrics.hiddenAttrLeaks.length > 0) {
    push(
      "hidden-attr-leak",
      "fail",
      `${metrics.hiddenAttrLeaks.length} element(s) with [hidden] rendered visibly (display !== none).`,
      metrics.hiddenAttrLeaks
    );
  }
  if (metrics.edgeClippedTotal > 0) {
    push(
      "viewport-edge-clipping",
      "fail",
      `${metrics.edgeClippedTotal} visible element(s) extend beyond [0, ${metrics.vw}px] viewport edges.`,
      metrics.edgeClipped
    );
  }
  if (metrics.interactiveOverlaps.length > 0) {
    push(
      "interactive-overlap",
      "fail",
      `${metrics.interactiveOverlaps.length} overlapping interactive control pair(s) detected.`,
      metrics.interactiveOverlaps
    );
  }
  if (metrics.iosSub16Inputs.length > 0) {
    push(
      "ios-sub16-input",
      "fail",
      `${metrics.iosSub16Inputs.length} mobile form input/select/textarea computes font-size < 16px (iOS auto-zoom risk).`,
      metrics.iosSub16Inputs
    );
  }
  if (metrics.openOverlays.length > 0) {
    push(
      "overlay-out-of-bounds",
      "fail",
      `${metrics.openOverlays.length} open <dialog>/popover exceeds viewport bounds or overflows horizontally.`,
      metrics.openOverlays
    );
  }

  const failTouch = metrics.smallTouchTargets.filter((t) => t.severity === "fail");
  const warnTouch = metrics.smallTouchTargets.filter((t) => t.severity === "warn");
  if (failTouch.length > 0) {
    push(
      "touch-target-too-small",
      "fail",
      `${failTouch.length} touch control(s) measure < 32px on mobile/tablet.`,
      failTouch
    );
  }
  if (warnTouch.length > 0) {
    push(
      "touch-target-under-44",
      "warn",
      `${warnTouch.length} touch control(s) measure between 32px and 43px (< 44px recommended).`,
      warnTouch
    );
  }
  if (metrics.clippedControls.length > 0) {
    push(
      "clipped-control-label",
      "warn",
      `${metrics.clippedControls.length} interactive control(s) clip internal text (scrollWidth > clientWidth).`,
      metrics.clippedControls
    );
  }
  if (metrics.tableOverflows.length > 0) {
    push(
      "table-overflow",
      "warn",
      `${metrics.tableOverflows.length} table/wrapper element(s) overflow horizontally without data-scroll-strip.`,
      metrics.tableOverflows
    );
  }
  if (metrics.foldBudget && metrics.foldBudget.squeezed) {
    push(
      "above-the-fold-squeezed",
      "warn",
      `Primary content (${metrics.foldBudget.selector}) starts at ${Math.round(metrics.foldBudget.topOffsetRatio * 100)}% of viewport height with ${metrics.foldBudget.visibleHeight}px visible.`,
      metrics.foldBudget
    );
  }
  if (metrics.hingeObstructions && metrics.hingeObstructions.length > 0) {
    push(
      "fold-hinge-obstruction",
      "warn",
      `${metrics.hingeObstructions.length} interactive control/overlay element(s) span the ${metrics.hingeOrientation || "fold"} hinge region.`,
      metrics.hingeObstructions
    );
  }

  return checks;
}

async function runActionStep(page, step, runtimeState) {
  const timeout = step.timeoutMs || 5000;
  switch (step.type) {
    case "click":
      await page.locator(step.selector).first().click({ timeout });
      break;
    case "fill":
      await page.locator(step.selector).first().fill(String(step.value ?? ""), { timeout });
      break;
    case "select":
      await page.locator(step.selector).first().selectOption(step.value, { timeout });
      break;
    case "press":
      await page.keyboard.press(step.key || "Escape");
      break;
    case "waitFor":
      await page.locator(step.selector).first().waitFor({ state: step.state || "visible", timeout });
      break;
    case "waitMs":
      await page.waitForTimeout(Number(step.ms || 250));
      break;
    case "scroll":
      await page.evaluate(({ selector, top }) => {
        const el = selector ? document.querySelector(selector) : document.scrollingElement;
        if (el) el.scrollTop = Number(top || 0);
      }, step);
      break;
    case "resize": {
      const width = Number(step.width);
      const height = Number(step.height);
      if (!Number.isFinite(width) || !Number.isFinite(height) || width < 200 || height < 200) {
        throw new Error(`Invalid resize dimensions in step "${step.name || ""}": ${step.width}x${step.height}`);
      }
      await page.setViewportSize({ width, height });
      runtimeState.expectedWidth = width;
      runtimeState.expectedHeight = height;
      runtimeState.displayFeature = step.displayFeature || null;
      if (step.posture || step.displayFeature || runtimeState.cdp) {
        const emu = await applyFoldableEmulation(
          runtimeState.ctx,
          page,
          {
            width,
            height,
            deviceScaleFactor: runtimeState.deviceScaleFactor,
            isMobile: runtimeState.isMobile,
            posture: step.posture || null,
            displayFeature: step.displayFeature || null,
          },
          runtimeState.cdp
        );
        runtimeState.cdp = emu.cdp;
      }
      if (!step.waitAfterMs) {
        await page.waitForTimeout(150);
      }
      break;
    }
    case "audit":
      break;
    default:
      throw new Error(`Unsupported action type "${step.type}" in step "${step.name || ""}"`);
  }
  if (step.waitAfterMs) {
    await page.waitForTimeout(Number(step.waitAfterMs));
  }
}

function formatMarkdownReport(report) {
  const lines = [
    "# Device UI Testing Audit Report",
    "",
    `- **URL**: ${report.url}`,
    `- **Preset / Viewports**: ${report.summary.viewportsRun} run(s)${report.summary.transitionsRun ? ` + ${report.summary.transitionsRun} fold transition(s)` : ""} across themes [${report.themes.join(", ")}]`,
    `- **Browser**: headless (${report.browserChannel})`,
    `- **Totals**: **${report.summary.fail} FAIL** | **${report.summary.warn} WARN** | **${report.summary.passedRuns}/${report.summary.totalRuns} clean runs**`,
    "",
    "| Viewport | Size | Theme | Status | FAIL | WARN | Overflow | ScrollH | Screenshot |",
    "|---|---|---|---:|---:|---:|---:|---:|---|",
  ];

  for (const run of report.runs) {
    const status = run.failCount > 0 ? "FAIL" : run.warnCount > 0 ? "WARN" : "PASS";
    const shot = run.screenshots.length > 0 ? run.screenshots.map((s) => path.basename(s)).join(", ") : "-";
    const sizeLabel = run.viewport.transitionSequence || `${run.viewport.width}x${run.viewport.height}`;
    lines.push(
      `| ${run.viewport.key} | ${sizeLabel} | ${run.theme} | ${status} | ${run.failCount} | ${run.warnCount} | ${run.initialMetrics.rootOverflow}px | ${run.initialMetrics.scrollHeight}px | ${shot} |`
    );
  }

  const flaggedRuns = report.runs.filter((r) => r.checks.length > 0);
  if (flaggedRuns.length > 0) {
    lines.push("", "## Findings", "");
    for (const run of flaggedRuns) {
      lines.push(`### ${run.viewport.key} (${run.viewport.width}x${run.viewport.height}, ${run.theme})`);
      for (const c of run.checks) {
        lines.push(`- **[${c.severity.toUpperCase()}]** \`${c.id}\` (${c.phase}): ${c.message}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n") + "\n";
}

export async function runAudit(url, options = {}) {
  const {
    preset = "full",
    viewports: customViewports = "",
    foldTransitions = false,
    themes = ["light"],
    locale = "en-US",
    reducedMotion = "no-preference",
    outDir = "",
    screenshots = "flagged",
    fullPageScreenshots = false,
    channel = "auto",
    playwrightFrom = "",
    waitFor = "",
    waitMs = 150,
    primarySelector = "",
    scrollAllowlist = [],
    actions = [],
    timeoutMs = 20000,
  } = options;

  const viewportList = resolveViewports({ preset, custom: customViewports });
  const themeList = Array.isArray(themes)
    ? themes
    : String(themes)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

  const allowSelector = [...DEFAULT_SCROLL_ALLOWLIST, ...scrollAllowlist].join(", ");
  const playwright = resolvePlaywright({ playwrightFrom });
  const { browser, launchedChannel } = await launchHeadlessBrowser(playwright.chromium, channel);

  const resolvedOut = outDir ? path.resolve(outDir) : "";
  const shotDir = resolvedOut ? path.join(resolvedOut, "screenshots") : "";
  if (resolvedOut && screenshots !== "none") {
    fs.mkdirSync(shotDir, { recursive: true });
  } else if (resolvedOut) {
    fs.mkdirSync(resolvedOut, { recursive: true });
  }

  // Pick tightest portrait, tightest landscape, and first unfolded viewport so flagged mode gives visual triage proof
  const tightPortraitKey =
    viewportList.find((v) => v.width <= 390 && v.height > v.width)?.key || null;
  const tightLandscapeKey =
    viewportList.find((v) => v.height <= 420 && v.width > v.height)?.key || null;
  const firstUnfoldedKey =
    viewportList.find((v) => v.foldState === "unfolded")?.key || null;

  const runs = [];
  let transitionsRun = 0;
  try {
    for (const theme of themeList) {
      for (const vp of viewportList) {
        const ctx = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          isMobile: vp.isMobile,
          hasTouch: vp.hasTouch,
          deviceScaleFactor: vp.deviceScaleFactor || 1,
          colorScheme: theme === "dark" ? "dark" : "light",
          locale,
          reducedMotion,
        });
        const page = await ctx.newPage();

        const consoleErrors = [];
        const pageErrors = [];
        const httpErrors = [];

        page.on("console", (msg) => {
          if (msg.type() === "error") consoleErrors.push(msg.text());
        });
        page.on("pageerror", (err) => {
          pageErrors.push(err.message || String(err));
        });
        page.on("response", (res) => {
          if (res.status() >= 400) {
            httpErrors.push({ status: res.status(), url: res.url() });
          }
        });

        let cdp = null;
        if (vp.posture || vp.displayFeature) {
          const emu = await applyFoldableEmulation(ctx, page, vp);
          cdp = emu.cdp;
        }

        try {
          await page.goto(url, { waitUntil: "networkidle", timeout: timeoutMs });
        } catch {
          await page.goto(url, { waitUntil: "load", timeout: timeoutMs });
        }

        if (waitFor) {
          await page.locator(waitFor).first().waitFor({ state: "visible", timeout: timeoutMs });
        }
        if (waitMs > 0) {
          await page.waitForTimeout(waitMs);
        }

        const runtimeState = {
          ctx,
          cdp,
          isMobile: vp.isMobile,
          deviceScaleFactor: vp.deviceScaleFactor || 1,
          expectedWidth: vp.width,
          expectedHeight: vp.height,
          displayFeature: vp.displayFeature || null,
        };

        const initialMetrics = await evaluatePageMetrics(page, {
          isMobile: runtimeState.isMobile,
          expectedWidth: runtimeState.expectedWidth,
          expectedHeight: runtimeState.expectedHeight,
          primarySelector,
          scrollAllowSelector: allowSelector,
          displayFeature: runtimeState.displayFeature,
        });
        const checks = classifyMetrics(
          initialMetrics,
          { consoleErrors, pageErrors, httpErrors },
          "initial"
        );
        const runScreenshots = [];

        const shouldCaptureBase =
          resolvedOut &&
          screenshots !== "none" &&
          (screenshots === "all" ||
            checks.length > 0 ||
            vp.key === tightPortraitKey ||
            vp.key === tightLandscapeKey ||
            vp.key === firstUnfoldedKey);

        if (shouldCaptureBase) {
          const shotPath = path.join(shotDir, `${vp.key}-${theme}.png`);
          await page.screenshot({ path: shotPath, fullPage: fullPageScreenshots });
          runScreenshots.push(shotPath);
        }

        // Optional interactive actions
        for (let idx = 0; idx < actions.length; idx++) {
          const step = actions[idx];
          if (
            Array.isArray(step.onlyViewports) &&
            step.onlyViewports.length > 0 &&
            !step.onlyViewports.includes(vp.key)
          ) {
            continue;
          }
          const stepLabel = step.name || `step-${idx + 1}-${step.type}`;
          const prevConsoleCount = consoleErrors.length;
          const prevPageCount = pageErrors.length;
          try {
            await runActionStep(page, step, runtimeState);
            if (
              step.audit !== false &&
              (step.audit === true ||
                step.type === "click" ||
                step.type === "press" ||
                step.type === "resize")
            ) {
              const stepMetrics = await evaluatePageMetrics(page, {
                isMobile: runtimeState.isMobile,
                expectedWidth: runtimeState.expectedWidth,
                expectedHeight: runtimeState.expectedHeight,
                primarySelector,
                scrollAllowSelector: allowSelector,
                displayFeature: runtimeState.displayFeature,
              });
              const newConsole = consoleErrors.slice(prevConsoleCount);
              const newPage = pageErrors.slice(prevPageCount);
              const stepChecks = classifyMetrics(
                stepMetrics,
                { consoleErrors: newConsole, pageErrors: newPage, httpErrors: [] },
                stepLabel
              );
              checks.push(...stepChecks);
              if (
                resolvedOut &&
                screenshots !== "none" &&
                (step.screenshot === true ||
                  screenshots === "all" ||
                  stepChecks.some((c) => c.severity === "fail"))
              ) {
                const shotPath = path.join(shotDir, `${vp.key}-${theme}-${stepLabel}.png`);
                await page.screenshot({ path: shotPath, fullPage: Boolean(step.fullPage) });
                runScreenshots.push(shotPath);
              }
            }
          } catch (err) {
            checks.push({
              id: "action-step-error",
              phase: stepLabel,
              severity: "fail",
              message: `Action "${stepLabel}" failed: ${err.message.split("\n")[0]}`,
            });
          }
        }

        const failCount = checks.filter((c) => c.severity === "fail").length;
        const warnCount = checks.filter((c) => c.severity === "warn").length;

        runs.push({
          viewport: vp,
          theme,
          failCount,
          warnCount,
          initialMetrics,
          checks,
          screenshots: runScreenshots,
        });

        await ctx.close();
      }

      if (foldTransitions) {
        for (const spec of DEFAULT_FOLD_TRANSITIONS) {
          const startVp = getViewportByKey(spec.startViewportKey);
          if (!startVp) continue;
          transitionsRun++;

          const ctx = await browser.newContext({
            viewport: { width: startVp.width, height: startVp.height },
            isMobile: true,
            hasTouch: true,
            deviceScaleFactor: startVp.deviceScaleFactor || 2.625,
            colorScheme: theme === "dark" ? "dark" : "light",
            locale,
            reducedMotion,
          });
          const page = await ctx.newPage();

          const consoleErrors = [];
          const pageErrors = [];
          const httpErrors = [];

          page.on("console", (msg) => {
            if (msg.type() === "error") consoleErrors.push(msg.text());
          });
          page.on("pageerror", (err) => {
            pageErrors.push(err.message || String(err));
          });
          page.on("response", (res) => {
            if (res.status() >= 400) {
              httpErrors.push({ status: res.status(), url: res.url() });
            }
          });

          try {
            await page.goto(url, { waitUntil: "networkidle", timeout: timeoutMs });
          } catch {
            await page.goto(url, { waitUntil: "load", timeout: timeoutMs });
          }

          if (waitFor) {
            await page.locator(waitFor).first().waitFor({ state: "visible", timeout: timeoutMs });
          }
          if (waitMs > 0) {
            await page.waitForTimeout(waitMs);
          }

          const initialMetrics = await evaluatePageMetrics(page, {
            isMobile: true,
            expectedWidth: startVp.width,
            expectedHeight: startVp.height,
            primarySelector,
            scrollAllowSelector: allowSelector,
          });
          const checks = classifyMetrics(
            initialMetrics,
            { consoleErrors, pageErrors, httpErrors },
            "initial"
          );
          const transitionMetrics = [];
          const runScreenshots = [];

          for (const step of spec.steps) {
            const prevConsoleCount = consoleErrors.length;
            const prevPageCount = pageErrors.length;
            await page.setViewportSize({ width: step.width, height: step.height });
            await page.waitForTimeout(Math.max(waitMs, 150));

            const stepMetrics = await evaluatePageMetrics(page, {
              isMobile: true,
              expectedWidth: step.width,
              expectedHeight: step.height,
              primarySelector,
              scrollAllowSelector: allowSelector,
            });
            transitionMetrics.push({ label: step.label, ...stepMetrics });

            const phaseLabel = `transition:${step.label}`;
            const stepChecks = classifyMetrics(
              stepMetrics,
              {
                consoleErrors: consoleErrors.slice(prevConsoleCount),
                pageErrors: pageErrors.slice(prevPageCount),
                httpErrors: [],
              },
              phaseLabel
            );
            checks.push(...stepChecks);

            if (
              resolvedOut &&
              screenshots !== "none" &&
              (screenshots === "all" || stepChecks.some((c) => c.severity === "fail"))
            ) {
              const shotPath = path.join(shotDir, `fold-transition-${spec.name}-${theme}-${step.label}.png`);
              await page.screenshot({ path: shotPath, fullPage: fullPageScreenshots });
              runScreenshots.push(shotPath);
            }
          }

          const failCount = checks.filter((c) => c.severity === "fail").length;
          const warnCount = checks.filter((c) => c.severity === "warn").length;
          const transitionSequence = [
            `${startVp.width}x${startVp.height}`,
            ...spec.steps.map((s) => `${s.width}x${s.height}`),
          ].join(" -> ");

          runs.push({
            viewport: {
              ...startVp,
              key: `fold-transition-${spec.name}`,
              label: `Fold Transition (${spec.name})`,
              foldState: "transition",
              transitionSequence,
            },
            theme,
            failCount,
            warnCount,
            initialMetrics,
            transitionMetrics,
            checks,
            screenshots: runScreenshots,
          });

          await ctx.close();
        }
      }
    }
  } finally {
    await browser.close();
  }

  const totalFail = runs.reduce((acc, r) => acc + r.failCount, 0);
  const totalWarn = runs.reduce((acc, r) => acc + r.warnCount, 0);
  const passedRuns = runs.filter((r) => r.failCount === 0 && r.warnCount === 0).length;

  const report = {
    url,
    timestamp: new Date().toISOString(),
    browserChannel: launchedChannel,
    themes: themeList,
    summary: {
      viewportsRun: viewportList.length,
      transitionsRun,
      totalRuns: runs.length,
      passedRuns,
      fail: totalFail,
      warn: totalWarn,
    },
    runs,
  };

  if (resolvedOut) {
    fs.writeFileSync(path.join(resolvedOut, "report.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
    fs.writeFileSync(path.join(resolvedOut, "report.md"), formatMarkdownReport(report), "utf8");
  }

  return report;
}
