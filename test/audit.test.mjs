import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { runAudit, resolvePlaywright } from "../lib/audit.mjs";

const BROKEN_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Broken RWD Fixture</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, sans-serif; overflow-x: hidden; }
    .leaked-hidden { display: flex; padding: 12px; background: #fee2e2; }
    .overflow-box { width: 460px; padding: 12px; background: #dbeafe; }
    .overlap-wrap { position: relative; height: 50px; }
    .overlap-wrap button { position: absolute; top: 4px; width: 100px; height: 44px; }
    .btn-a { left: 8px; }
    .btn-b { left: 40px; }
    .tiny-btn { width: 22px; height: 22px; padding: 0; font-size: 10px; }
    .small-input { font-size: 13px; padding: 6px; }
    dialog.tall-modal { width: 320px; max-height: none; height: 480px; margin: auto; padding: 16px; }
  </style>
</head>
<body>
  <div class="leaked-hidden" hidden>This hidden banner leaked because flex overrides [hidden]</div>
  <main>
    <div class="overflow-box">Unbounded 460px container overflowing 360px phone even when body hides overflow-x</div>
    <div class="overlap-wrap">
      <button class="btn-a" type="button">Primary</button>
      <button class="btn-b" type="button">Overlap</button>
    </div>
    <button class="tiny-btn" type="button" id="open-broken-dialog">x</button>
    <input class="small-input" type="text" value="Triggers iOS zoom" aria-label="Search">
  </main>
  <dialog class="tall-modal" id="broken-dialog">
    <h2>Tall modal</h2>
    <p>Overflows 375px short landscape vertically.</p>
  </dialog>
  <script>
    document.getElementById("open-broken-dialog").addEventListener("click", () => {
      document.getElementById("broken-dialog").showModal();
    });
  </script>
</body>
</html>`;

const CLEAN_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Clean Responsive Fixture</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #f8fafc;
      --surface: #ffffff;
      --fg: #0f172a;
      --muted: #475569;
      --border: #cbd5e1;
      --accent: #0284c7;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0f172a;
        --surface: #1e293b;
        --fg: #f8fafc;
        --muted: #cbd5e1;
        --border: #334155;
        --accent: #38bdf8;
      }
    }
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    body {
      margin: 0;
      min-height: 100vh;
      min-height: 100dvh;
      font-family: system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--fg);
      padding-inline: env(safe-area-inset-left) env(safe-area-inset-right);
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 16px;
      border-bottom: 1px solid var(--border);
      background: var(--surface);
    }
    header h1 { margin: 0; font-size: clamp(1rem, 0.9rem + 0.8vw, 1.35rem); }
    main {
      max-width: 1120px;
      margin: 0 auto;
      padding: 12px 16px 24px;
      display: grid;
      gap: 12px;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }
    button, input[type="search"], select {
      min-height: 44px;
      min-width: 44px;
      padding: 8px 14px;
      font-size: 16px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--fg);
    }
    button.primary {
      background: var(--accent);
      color: #0b1120;
      border-color: transparent;
      font-weight: 600;
    }
    .card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr));
      gap: 12px;
    }
    .card {
      min-width: 0;
      padding: 14px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--surface);
    }
    .token {
      margin: 6px 0 0;
      font-family: ui-monospace, monospace;
      font-size: 0.875rem;
      overflow-wrap: anywhere;
      color: var(--muted);
    }
    .consent-row {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 44px;
      cursor: pointer;
    }
    .consent-row input[type="checkbox"] {
      width: 20px;
      height: 20px;
      min-height: 0;
      min-width: 0;
      flex: 0 0 auto;
    }
    .strip {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 4px;
    }
    .strip span {
      flex: 0 0 auto;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid var(--border);
      font-size: 0.875rem;
    }
    .claimed-banner {
      display: flex;
      padding: 10px 14px;
      background: #14532d;
      color: #fff;
    }
    dialog.clean-modal {
      max-width: calc(100dvw - 24px);
      max-height: calc(100dvh - 24px);
      width: min(440px, calc(100dvw - 24px));
      overflow: auto;
      overscroll-behavior: contain;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      background: var(--surface);
      color: var(--fg);
    }
    .modal-layout {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .qr-box {
      width: 140px;
      height: 140px;
      border-radius: 8px;
      background: #e2e8f0;
      color: #0f172a;
      display: grid;
      place-items: center;
      font-weight: 700;
      flex: 0 0 auto;
    }
    @media (max-height: 500px) and (min-width: 520px) {
      header { padding: 6px 12px; }
      main { padding: 8px 12px; }
      .modal-layout { flex-direction: row; align-items: center; }
      .qr-box { width: 112px; height: 112px; }
    }
  </style>
</head>
<body>
  <div class="claimed-banner" hidden>Hidden banner stays display:none</div>
  <header>
    <h1>Device Ready Console</h1>
    <button class="primary" type="button" id="open-clean-dialog">Pair Screen</button>
  </header>
  <main>
    <div class="toolbar">
      <input type="search" aria-label="Filter items" placeholder="Filter records">
      <select aria-label="Locale"><option>Auto-detect</option><option>English</option></select>
    </div>
    <div class="strip" data-scroll-strip>
      <span>All</span><span>Active</span><span>Mobile</span><span>Landscape</span><span>Tablet</span><span>Desktop</span>
    </div>
    <section class="card-grid">
      <article class="card">
        <strong>Adversarial Slug</strong>
        <p class="token">cross-machine-agent-memory-tailscale-honcho-antigravity-v2-20261124</p>
      </article>
      <article class="card">
        <strong>Long Destination URL</strong>
        <p class="token">https://docs.example.com/zh/blog/modern-responsive-device-testing-guide?utm_source=threads&amp;utm_medium=social</p>
      </article>
    </section>
    <label class="consent-row">
      <input type="checkbox" checked>
      <span>Enable automatic multi-viewport checks with ergonomic 44px tap row</span>
    </label>
  </main>
  <dialog class="clean-modal" id="clean-dialog">
    <div class="modal-layout">
      <div class="qr-box">QR</div>
      <div>
        <h2 style="margin:0 0 6px;font-size:1.1rem">Second Screen</h2>
        <p style="margin:0 0 10px;color:var(--muted)">Fits cleanly on 360x640 and 667x375 short landscape.</p>
        <button type="button" id="close-clean-dialog">Close</button>
      </div>
    </div>
  </dialog>
  <script>
    const dlg = document.getElementById("clean-dialog");
    const closeBtn = document.getElementById("close-clean-dialog");
    document.getElementById("open-clean-dialog").addEventListener("click", () => {
      dlg.showModal();
      dlg.scrollTop = 0;
      closeBtn.focus({ preventScroll: true });
    });
    closeBtn.addEventListener("click", () => dlg.close());
  </script>
</body>
</html>`;

function findLocalPlaywrightHint() {
  return process.env.PLAYWRIGHT_PATH || "";
}

function hasPlaywrightRuntime() {
  try {
    resolvePlaywright({ playwrightFrom: findLocalPlaywrightHint() });
    return true;
  } catch {
    return false;
  }
}

function startFixtureServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url === "/broken") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(BROKEN_HTML);
      } else {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(CLEAN_HTML);
      }
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

test(
  "headless Playwright audit catches broken RWD/dialog/touch/iOS defects and passes clean 9-viewport matrix",
  { skip: !hasPlaywrightRuntime() ? "No local Playwright runtime installed" : false },
  async () => {
    const { server, baseUrl } = await startFixtureServer();
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "dutg-audit-"));
    const playwrightFrom = findLocalPlaywrightHint();

    try {
      // 1. Broken page should flag every planted defect
      const brokenReport = await runAudit(`${baseUrl}/broken`, {
        viewports: "phone-compact-portrait,phone-short-landscape",
        themes: ["light"],
        playwrightFrom,
        screenshots: "none",
        waitMs: 50,
        actions: [{ name: "open-broken-dialog", type: "click", selector: "#open-broken-dialog", audit: true }],
      });

      const brokenIds = new Set(brokenReport.runs.flatMap((r) => r.checks.map((c) => c.id)));
      for (const expected of [
        "root-overflow-masked",
        "hidden-attr-leak",
        "viewport-edge-clipping",
        "interactive-overlap",
        "ios-sub16-input",
        "touch-target-too-small",
        "overlay-out-of-bounds",
      ]) {
        assert.ok(
          brokenIds.has(expected),
          `Expected broken fixture to trigger "${expected}", got: ${[...brokenIds].join(", ")}`
        );
      }
      assert.ok(brokenReport.summary.fail >= 6);

      // 2. Clean page should achieve 0 FAIL and 0 WARN across all 9 viewports x light & dark (18 runs)
      const cleanReport = await runAudit(`${baseUrl}/clean`, {
        preset: "full",
        themes: ["light", "dark"],
        primarySelector: "main",
        outDir,
        screenshots: "flagged",
        playwrightFrom,
        waitMs: 50,
        actions: [
          { name: "open-modal", type: "click", selector: "#open-clean-dialog", audit: true, screenshot: true },
          { name: "close-modal", type: "press", key: "Escape", audit: true },
        ],
      });

      assert.equal(cleanReport.summary.totalRuns, 18, "Expected 9 viewports x 2 themes = 18 runs");
      assert.equal(
        cleanReport.summary.fail,
        0,
        `Expected 0 FAIL on clean fixture: ${JSON.stringify(
          cleanReport.runs.filter((r) => r.failCount > 0),
          null,
          2
        )}`
      );
      assert.equal(
        cleanReport.summary.warn,
        0,
        `Expected 0 WARN on clean fixture: ${JSON.stringify(
          cleanReport.runs.filter((r) => r.warnCount > 0),
          null,
          2
        )}`
      );
      assert.ok(fs.existsSync(path.join(outDir, "report.json")));
      assert.ok(fs.existsSync(path.join(outDir, "report.md")));
      const shots = fs.readdirSync(path.join(outDir, "screenshots"));
      assert.ok(shots.some((f) => f.includes("phone-compact-portrait-light.png")));
      assert.ok(shots.some((f) => f.includes("phone-short-landscape-dark-open-modal.png")));
    } finally {
      server.close();
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  }
);
