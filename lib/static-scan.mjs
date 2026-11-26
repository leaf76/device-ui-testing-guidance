import fs from "node:fs";
import path from "node:path";

const DEFAULT_IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".astro",
  ".wrangler",
  ".audit-out",
  "coverage",
]);

const CSS_EXTS = new Set([".css", ".scss", ".less"]);
const MARKUP_EXTS = new Set([".html", ".htm", ".jsx", ".tsx", ".vue", ".svelte", ".astro"]);
const CODE_EXTS = new Set([".js", ".mjs", ".cjs", ".ts", ".jsx", ".tsx", ".vue", ".svelte", ".astro"]);

export const STATIC_RULES = {
  "overflow-x-body-mask": {
    severity: "error",
    guideId: "zero-overflow-and-clipping-scan",
    keepWhen: "html or body applies overflow-x: hidden or clip to mask horizontal scrollbars.",
    dropWhen: "Rule only targets an inner decorative canvas/hero wrapper, not html or body.",
  },
  "raw-100vh": {
    severity: "warn",
    guideId: "dynamic-viewport-and-safe-area",
    keepWhen: "100vh is used for full-height shells/modals without a paired 100dvh or 100svh override.",
    dropWhen: "100vh is immediately paired with 100dvh/100svh in the same declaration block.",
  },
  "unbounded-landscape-mq": {
    severity: "warn",
    guideId: "short-landscape-and-keyboard-guard",
    keepWhen: "@media (orientation: landscape) adapts mobile layouts without both max-height and min-width guards.",
    dropWhen: "Rule is print-only, desktop-only, or already guards against portrait virtual keyboards with min-width + max-height.",
  },
  "ios-sub16px-input": {
    severity: "error",
    guideId: "ios-input-zoom-and-form-ergonomics",
    keepWhen: "Visible input/select/textarea sets font-size < 16px on mobile or globally.",
    dropWhen: "Strictly scoped inside @media (min-width: 768px+) or (pointer: fine), or applies only to checkbox/radio.",
  },
  "viewport-zoom-disabled": {
    severity: "error",
    guideId: "dynamic-viewport-and-safe-area",
    keepWhen: "<meta name='viewport'> sets user-scalable=no/0 or maximum-scale=1.",
    dropWhen: "Never drop for standard web applications; disabling pinch-zoom breaks WCAG 1.4.4.",
  },
  "missing-viewport-fit-cover": {
    severity: "warn",
    guideId: "dynamic-viewport-and-safe-area",
    keepWhen: "CSS uses env(safe-area-inset-*) while the page's <meta name='viewport'> omits viewport-fit=cover.",
    dropWhen: "Component library with no HTML shell or third-party embedded iframe.",
  },
  "unclamped-vw-font": {
    severity: "warn",
    guideId: "themes-contrast-zoom-and-motion",
    keepWhen: "font-size uses vw/vi directly without clamp(), breaking zoom scaling and extreme viewports.",
    dropWhen: "Purely decorative aria-hidden watermark text.",
  },
  "flex-grid-missing-hidden-guard": {
    severity: "warn",
    guideId: "forms-checkbox-and-hidden-specificity",
    keepWhen: "Codebase toggles the HTML hidden attribute while styling elements with display: flex/grid and has no [hidden] { display: none } rule.",
    dropWhen: "Stylesheet defines global [hidden] { display: none !important; } in another bundled base file.",
  },
  "fixed-pixel-width-risk": {
    severity: "warn",
    guideId: "responsive-tables-and-long-tokens",
    keepWhen: "Unscoped width or min-width >= 350px outside desktop/tablet @media can overflow 344px foldable cover screens and 360px compact phones.",
    dropWhen: "Element is bounded by max-width: 100%, min(...), or lives inside an intentional scroll container.",
  },
  "hover-only-critical-reveal": {
    severity: "warn",
    guideId: "touch-targets-and-coarse-pointer",
    keepWhen: ":hover reveals hidden controls (opacity: 1 / visibility: visible / display) without @media (hover: hover) or :focus-within.",
    dropWhen: "Hover rule only changes color/background/elevation on an already-visible control.",
  },
  "legacy-screen-spanning-mq": {
    severity: "warn",
    guideId: "foldable-transitions-and-hinge-posture",
    keepWhen: "CSS uses legacy Origin Trial @media (screen-spanning: ...) or env(fold-*) instead of standardized horizontal/vertical-viewport-segments and env(viewport-segment-*).",
    dropWhen: "Rule pairs screen-spanning with standardized viewport-segments in the same stylesheet as an explicit legacy polyfill.",
  },
  "viewport-segment-no-fallback": {
    severity: "warn",
    guideId: "foldable-transitions-and-hinge-posture",
    keepWhen: "env(viewport-segment-*) is used without a fallback value outside @media (horizontal-viewport-segments) or (vertical-viewport-segments), resolving to invalid/initial on non-foldable browsers.",
    dropWhen: "env(viewport-segment-*, <fallback>) includes a fallback or lives inside an explicit viewport-segments media query.",
  },
};

function stripCssCommentsPreserveLines(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, " "));
}

function lineNumberAt(text, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) line++;
  }
  return line;
}

function extractInlineStyleBlocks(content) {
  const blocks = [];
  const re = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = re.exec(content)) !== null) {
    const startOffset = m.index + m[0].indexOf(">") + 1;
    const baseLine = lineNumberAt(content, startOffset) - 1;
    blocks.push({ css: m[1], baseLine });
  }
  return blocks;
}

function isDesktopMediaContext(mediaStack) {
  return mediaStack.some((prelude) => {
    const p = prelude.toLowerCase();
    if (/pointer\s*:\s*fine/.test(p) || /hover\s*:\s*hover/.test(p)) return true;
    const minW = /min-width\s*:\s*(\d+(?:\.\d+)?)px/.exec(p);
    if (minW && Number(minW[1]) >= 768) return true;
    const rangeW = /width\s*>=\s*(\d+(?:\.\d+)?)px/.exec(p);
    if (rangeW && Number(rangeW[1]) >= 768) return true;
    return false;
  });
}

function isWideEnoughMediaContext(mediaStack, minPx = 480) {
  return mediaStack.some((prelude) => {
    const p = prelude.toLowerCase();
    const minW = /min-width\s*:\s*(\d+(?:\.\d+)?)px/.exec(p);
    if (minW && Number(minW[1]) >= minPx) return true;
    const rangeW = /width\s*>=\s*(\d+(?:\.\d+)?)px/.exec(p);
    if (rangeW && Number(rangeW[1]) >= minPx) return true;
    return false;
  });
}

/**
 * Lightweight brace-tracking CSS rule extractor that preserves line numbers and @media stacks.
 */
function parseCssRules(rawCss, baseLine = 0) {
  const css = stripCssCommentsPreserveLines(rawCss);
  const rules = [];
  const mediaRules = [];
  const stack = []; // { type: 'media' | 'at' | 'rule', prelude, startOffset, bodyStart }

  let tokenStart = 0;
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    const prev = i > 0 ? css[i - 1] : "";

    if (ch === "'" && !inDouble && prev !== "\\") {
      inSingle = !inSingle;
      continue;
    }
    if (ch === '"' && !inSingle && prev !== "\\") {
      inDouble = !inDouble;
      continue;
    }
    if (inSingle || inDouble) continue;

    if (ch === "{") {
      let firstNonWs = tokenStart;
      while (firstNonWs < i && /\s/.test(css[firstNonWs])) firstNonWs++;
      const prelude = css.slice(firstNonWs, i).trim();
      const line = baseLine + lineNumberAt(css, firstNonWs);
      if (/^@media\b/i.test(prelude)) {
        stack.push({ type: "media", prelude, line, startOffset: firstNonWs, bodyStart: i + 1 });
        mediaRules.push({ prelude, line });
      } else if (prelude.startsWith("@")) {
        stack.push({ type: "at", prelude, line, startOffset: firstNonWs, bodyStart: i + 1 });
      } else {
        const activeMedia = stack.filter((s) => s.type === "media").map((s) => s.prelude);
        stack.push({
          type: "rule",
          prelude,
          line,
          startOffset: firstNonWs,
          bodyStart: i + 1,
          media: activeMedia,
        });
      }
      tokenStart = i + 1;
    } else if (ch === "}") {
      const top = stack.pop();
      if (top && top.type === "rule") {
        const body = css.slice(top.bodyStart, i);
        rules.push({
          selector: top.prelude,
          body,
          line: top.line,
          bodyBaseLine: baseLine + lineNumberAt(css, top.bodyStart) - 1,
          media: top.media,
        });
      }
      tokenStart = i + 1;
    } else if (ch === ";" && stack.every((s) => s.type !== "rule")) {
      tokenStart = i + 1;
    }
  }

  return { rules, mediaRules, cleanCss: css };
}

function makeFinding(ruleId, file, line, message, snippet) {
  const meta = STATIC_RULES[ruleId];
  return {
    ruleId,
    severity: meta.severity,
    guideId: meta.guideId,
    file,
    line,
    message,
    snippet: snippet.trim().slice(0, 140),
    keepWhen: meta.keepWhen,
    dropWhen: meta.dropWhen,
  };
}

function parseFontSizePx(rawValue) {
  const px = /^(\d+(?:\.\d+)?)px$/i.exec(rawValue.trim());
  if (px) return Number(px[1]);
  const rem = /^(\d+(?:\.\d+)?)rem$/i.exec(rawValue.trim());
  if (rem) return Number(rem[1]) * 16;
  return null;
}

function scanCssContent(css, file, baseLine, findings, projectFlags) {
  const { rules, mediaRules, cleanCss } = parseCssRules(css, baseLine);

  if (/env\(\s*safe-area-inset-/i.test(cleanCss)) {
    projectFlags.usesSafeArea = true;
  }
  if (/\[hidden\][\s\S]{0,80}\{[^}]*display\s*:\s*none/i.test(cleanCss)) {
    projectFlags.hasHiddenReset = true;
  }

  // Rule: unbounded-landscape-mq & legacy-screen-spanning-mq
  for (const mq of mediaRules) {
    const p = mq.prelude.toLowerCase();
    if (
      /orientation\s*:\s*landscape/.test(p) &&
      !/\bprint\b/.test(p) &&
      !(/max-height\s*:/.test(p) && /min-width\s*:/.test(p))
    ) {
      findings.push(
        makeFinding(
          "unbounded-landscape-mq",
          file,
          mq.line,
          "@media (orientation: landscape) lacks both max-height and min-width guards and can misfire when portrait virtual keyboards open.",
          mq.prelude
        )
      );
    }
    if (/screen-spanning\s*:/i.test(p) && !/viewport-segments/i.test(p)) {
      findings.push(
        makeFinding(
          "legacy-screen-spanning-mq",
          file,
          mq.line,
          "Legacy @media (screen-spanning: ...) was replaced by standardized (horizontal-viewport-segments) / (vertical-viewport-segments).",
          mq.prelude
        )
      );
    }
  }

  for (const rule of rules) {
    const selectors = rule.selector
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const body = rule.body;

    if (/\bdisplay\s*:\s*(inline-)?(flex|grid)\b/i.test(body)) {
      if (!projectFlags.firstFlexGrid) {
        projectFlags.firstFlexGrid = { file, line: rule.line, snippet: `${rule.selector} { display: flex/grid }` };
      }
    }

    // Rule: overflow-x-body-mask
    const targetsHtmlOrBody = selectors.some((s) =>
      /(?:^|[\s>+~])(html|body)(?:$|[\s.:#\[>+~])/.test(s.toLowerCase()) &&
      !/[.#_-](html|body)/.test(s.toLowerCase())
    );
    if (targetsHtmlOrBody) {
      const m = /\boverflow-x\s*:\s*(hidden|clip)\b/i.exec(body);
      if (m) {
        const line = rule.bodyBaseLine + lineNumberAt(body, m.index);
        findings.push(
          makeFinding(
            "overflow-x-body-mask",
            file,
            line,
            `Root selector "${rule.selector}" sets overflow-x: ${m[1]}, which hides clipping bugs instead of fixing layout overflow.`,
            `${rule.selector} { ${m[0]} }`
          )
        );
      }
    }

    // Rule: raw-100vh
    const vhMatch = /\b((?:min-|max-)?height)\s*:\s*100vh\b/i.exec(body);
    if (vhMatch && !/\b100[ds]vh\b/i.test(body) && !/\b100lvh\b/i.test(body)) {
      const line = rule.bodyBaseLine + lineNumberAt(body, vhMatch.index);
      findings.push(
        makeFinding(
          "raw-100vh",
          file,
          line,
          `${vhMatch[0]} has no 100dvh/100svh companion and can clip behind mobile browser toolbars.`,
          `${rule.selector} { ${vhMatch[0]} }`
        )
      );
    }

    // Rule: ios-sub16px-input
    if (!isDesktopMediaContext(rule.media)) {
      const targetsTextInput = selectors.some((s) => {
        const lower = s.toLowerCase();
        if (!/(?:^|[\s>+~])(input|select|textarea)(?:$|[\s.:#\[>+~])/.test(lower)) return false;
        if (/type\s*=\s*["']?(checkbox|radio|range|hidden|submit|button)["']?/.test(lower)) return false;
        return true;
      });
      if (targetsTextInput) {
        const fsMatch = /\bfont-size\s*:\s*([^;}\n]+)/i.exec(body);
        if (fsMatch) {
          const px = parseFontSizePx(fsMatch[1]);
          if (px !== null && px < 16) {
            const line = rule.bodyBaseLine + lineNumberAt(body, fsMatch.index);
            findings.push(
              makeFinding(
                "ios-sub16px-input",
                file,
                line,
                `Form control "${rule.selector}" sets font-size ${fsMatch[1].trim()} (< 16px), triggering iOS Safari viewport auto-zoom.`,
                `${rule.selector} { ${fsMatch[0]} }`
              )
            );
          }
        }
      }
    }

    // Rule: unclamped-vw-font
    const vwFont = /\bfont-size\s*:\s*([^;}\n]*\b\d+(?:\.\d+)?v[wi]\b[^;}\n]*)/i.exec(body);
    if (vwFont && !/\bclamp\s*\(/i.test(vwFont[1])) {
      const line = rule.bodyBaseLine + lineNumberAt(body, vwFont.index);
      findings.push(
        makeFinding(
          "unclamped-vw-font",
          file,
          line,
          `font-size uses viewport units (${vwFont[1].trim()}) without clamp(), hurting 200% zoom and extreme screens.`,
          `${rule.selector} { ${vwFont[0]} }`
        )
      );
    }

    // Rule: fixed-pixel-width-risk
    if (!isWideEnoughMediaContext(rule.media, 480)) {
      const fixedW = /(?<![-\w])(min-width|width)\s*:\s*(\d+(?:\.\d+)?)px(?=\s*(?:;|!important|$))/i.exec(
        body
      );
      if (
        fixedW &&
        Number(fixedW[2]) >= 350 &&
        !/(?<![-\w])max-width\s*:\s*100%/i.test(body) &&
        !/\bmin\s*\(/i.test(body)
      ) {
        const line = rule.bodyBaseLine + lineNumberAt(body, fixedW.index);
        findings.push(
          makeFinding(
            "fixed-pixel-width-risk",
            file,
            line,
            `Unscoped ${fixedW[0]} (>= 350px) without max-width: 100% or desktop @media guard risks overflowing 344px foldable cover screens and 360px phones.`,
            `${rule.selector} { ${fixedW[0]} }`
          )
        );
      }
    }

    // Rule: legacy-screen-spanning-mq (env(fold-*))
    const legacyFoldEnv = /\benv\(\s*fold-(?:left|top|width|height)\b[^)]*\)/i.exec(body);
    if (legacyFoldEnv) {
      const line = rule.bodyBaseLine + lineNumberAt(body, legacyFoldEnv.index);
      findings.push(
        makeFinding(
          "legacy-screen-spanning-mq",
          file,
          line,
          `Legacy ${legacyFoldEnv[0]} is obsolete; migrate to env(viewport-segment-*, <fallback>) with viewport-segments media queries.`,
          `${rule.selector} { ${legacyFoldEnv[0]} }`
        )
      );
    }

    // Rule: viewport-segment-no-fallback
    const hasViewportSegmentMedia = rule.media.some((m) =>
      /(?:horizontal|vertical)-viewport-segments\s*:/i.test(m)
    );
    if (!hasViewportSegmentMedia) {
      const segEnv = /\benv\(\s*viewport-segment-(?:width|height|top|right|bottom|left)\s+\d+\s+\d+\s*\)/i.exec(
        body
      );
      if (segEnv) {
        const line = rule.bodyBaseLine + lineNumberAt(body, segEnv.index);
        findings.push(
          makeFinding(
            "viewport-segment-no-fallback",
            file,
            line,
            `${segEnv[0]} has no fallback value and is outside a viewport-segments media query, failing on standard single-screen browsers.`,
            `${rule.selector} { ${segEnv[0]} }`
          )
        );
      }
    }

    // Rule: hover-only-critical-reveal
    const hasHoverOnlySelector =
      selectors.some((s) => /:hover\b/i.test(s)) &&
      !selectors.some((s) => /:focus(?:-within|-visible)?\b/i.test(s));
    const hasHoverMediaGuard = rule.media.some((m) =>
      /hover\s*:\s*hover|pointer\s*:\s*fine/i.test(m)
    );
    if (hasHoverOnlySelector && !hasHoverMediaGuard) {
      const reveal = /\b(opacity\s*:\s*1(?:\.0+)?\b|visibility\s*:\s*visible\b|display\s*:\s*(?:flex|block|inline-flex|grid)\b)/i.exec(
        body
      );
      if (reveal) {
        const line = rule.bodyBaseLine + lineNumberAt(body, reveal.index);
        findings.push(
          makeFinding(
            "hover-only-critical-reveal",
            file,
            line,
            `:hover reveals UI (${reveal[0]}) without @media (hover: hover) or :focus-within, trapping controls on touch devices.`,
            `${rule.selector} { ${reveal[0]} }`
          )
        );
      }
    }
  }
}

function scanMarkupContent(content, file, findings, projectFlags) {
  const metaRe = /<meta\b[^>]*name\s*=\s*["']viewport["'][^>]*>/gi;
  let m;
  while ((m = metaRe.exec(content)) !== null) {
    const tag = m[0];
    const line = lineNumberAt(content, m.index);
    if (/user-scalable\s*=\s*(no|0)/i.test(tag) || /maximum-scale\s*=\s*1(\.0+)?(?=[,\s"';]|$)/i.test(tag)) {
      findings.push(
        makeFinding(
          "viewport-zoom-disabled",
          file,
          line,
          "Viewport meta disables pinch-to-zoom (user-scalable=no or maximum-scale=1), violating WCAG 1.4.4.",
          tag
        )
      );
    }
    if (!/viewport-fit\s*=\s*cover/i.test(tag)) {
      projectFlags.viewportMetasMissingCover.push({ file, line, snippet: tag });
    }
  }

  if (/\bhidden(?:\s*=\s*["'{]|[\s>])/i.test(content)) {
    projectFlags.usesHiddenAttr = true;
  }
}

function walkFiles(targetPath, ignoreSet, out = []) {
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    out.push(targetPath);
    return out;
  }
  const entries = fs.readdirSync(targetPath, { withFileTypes: true });
  for (const entry of entries) {
    if (ignoreSet.has(entry.name)) continue;
    const full = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, ignoreSet, out);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (CSS_EXTS.has(ext) || MARKUP_EXTS.has(ext) || CODE_EXTS.has(ext)) {
        out.push(full);
      }
    }
  }
  return out;
}

export function runStaticScan(targetPath, { ignore = [] } = {}) {
  const resolved = path.resolve(targetPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Target path does not exist: ${resolved}`);
  }

  const ignoreSet = new Set([...DEFAULT_IGNORE_DIRS, ...ignore]);
  const files = walkFiles(resolved, ignoreSet);
  const findings = [];
  const projectFlags = {
    usesSafeArea: false,
    viewportMetasMissingCover: [],
    usesHiddenAttr: false,
    hasHiddenReset: false,
    firstFlexGrid: null,
  };

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const rel = path.relative(resolved, file) || path.basename(file);
    const content = fs.readFileSync(file, "utf8");

    if (CSS_EXTS.has(ext)) {
      scanCssContent(content, rel, 0, findings, projectFlags);
    }
    if (MARKUP_EXTS.has(ext)) {
      scanMarkupContent(content, rel, findings, projectFlags);
      for (const blk of extractInlineStyleBlocks(content)) {
        scanCssContent(blk.css, rel, blk.baseLine, findings, projectFlags);
      }
    }
    if (CODE_EXTS.has(ext)) {
      if (/\.hidden\s*=|setAttribute\(\s*["']hidden["']/.test(content)) {
        projectFlags.usesHiddenAttr = true;
      }
    }
  }

  if (projectFlags.usesSafeArea && projectFlags.viewportMetasMissingCover.length > 0) {
    for (const meta of projectFlags.viewportMetasMissingCover) {
      findings.push(
        makeFinding(
          "missing-viewport-fit-cover",
          meta.file,
          meta.line,
          "CSS references env(safe-area-inset-*) while <meta name='viewport'> omits viewport-fit=cover.",
          meta.snippet
        )
      );
    }
  }

  if (projectFlags.usesHiddenAttr && projectFlags.firstFlexGrid && !projectFlags.hasHiddenReset) {
    findings.push(
      makeFinding(
        "flex-grid-missing-hidden-guard",
        projectFlags.firstFlexGrid.file,
        projectFlags.firstFlexGrid.line,
        "Codebase toggles HTML [hidden] while using display: flex/grid without a [hidden] { display: none } guard.",
        projectFlags.firstFlexGrid.snippet
      )
    );
  }

  findings.sort(
    (a, b) =>
      (a.severity === "error" ? 0 : 1) - (b.severity === "error" ? 0 : 1) ||
      a.file.localeCompare(b.file) ||
      a.line - b.line
  );

  const summary = {
    scannedFiles: files.length,
    totalFindings: findings.length,
    errors: findings.filter((f) => f.severity === "error").length,
    warnings: findings.filter((f) => f.severity === "warn").length,
  };

  return { target: resolved, summary, findings };
}
