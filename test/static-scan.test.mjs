import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runStaticScan, STATIC_RULES } from "../lib/static-scan.mjs";

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test("static-scan detects all 12 anti-pattern rules on a deliberately flawed fixture", () => {
  const dir = makeTempDir("dutg-bad-");
  try {
    fs.writeFileSync(
      path.join(dir, "index.html"),
      `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
</head>
<body>
  <div class="banner" hidden>Welcome</div>
</body>
</html>`,
      "utf8"
    );

    fs.writeFileSync(
      path.join(dir, "app.css"),
      `
body {
  overflow-x: hidden;
  padding-top: env(safe-area-inset-top);
}
.shell {
  display: flex;
  min-height: 100vh;
}
.wide-card {
  width: 356px;
}
.hero-title {
  font-size: 6vw;
}
.search input {
  font-size: 13px;
}
.row:hover .row-actions {
  opacity: 1;
}
.split-pane {
  width: env(viewport-segment-width 0 0);
}
@media (orientation: landscape) {
  .grid { grid-template-columns: 1fr 1fr; }
}
@media (screen-spanning: single-fold-vertical) {
  .legacy-pane { left: env(fold-left); }
}
`,
      "utf8"
    );

    const res = runStaticScan(dir);
    const hitRuleIds = new Set(res.findings.map((f) => f.ruleId));

    for (const ruleId of Object.keys(STATIC_RULES)) {
      assert.ok(
        hitRuleIds.has(ruleId),
        `Expected static-scan to detect rule "${ruleId}", detected: ${[...hitRuleIds].join(", ")}`
      );
    }

    for (const f of res.findings) {
      assert.ok(f.guideId, `Finding ${f.ruleId} missing guideId`);
      assert.ok(f.keepWhen && f.dropWhen, `Finding ${f.ruleId} missing rubric`);
      assert.ok(f.line >= 1, `Finding ${f.ruleId} missing positive line number`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("static-scan produces 0 findings on clean responsive code with proper guards", () => {
  const dir = makeTempDir("dutg-clean-");
  try {
    fs.writeFileSync(
      path.join(dir, "index.html"),
      `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
</head>
<body>
  <div class="banner" hidden>Done</div>
</body>
</html>`,
      "utf8"
    );

    fs.writeFileSync(
      path.join(dir, "app.css"),
      `
[hidden] {
  display: none !important;
}
.shell {
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  padding-inline: env(safe-area-inset-left) env(safe-area-inset-right);
}
.wide-card {
  width: 520px;
  max-width: 100%;
}
.bounded-shell {
  width: 100%;
  max-width: 760px;
}
.hero-title {
  font-size: clamp(1.5rem, 1rem + 3vw, 2.75rem);
}
input, select, textarea {
  font-size: 16px;
}
@media (min-width: 768px) {
  input { font-size: 14px; }
  .desktop-col { width: 480px; }
}
@media (hover: hover) and (pointer: fine) {
  .row:hover .row-actions { opacity: 1; }
}
.row:hover .row-actions,
.row:focus-within .row-actions {
  opacity: 1;
}
@media (orientation: landscape) and (max-height: 500px) and (min-width: 560px) {
  .grid { grid-template-columns: 1fr 1fr; }
}
.safe-seg {
  width: env(viewport-segment-width 0 0, 50%);
}
@media (horizontal-viewport-segments: 2) {
  .seg-pane { width: env(viewport-segment-width 0 0); }
}
`,
      "utf8"
    );

    const res = runStaticScan(dir);
    assert.deepEqual(res.findings, [], `Expected 0 findings on clean fixture, got: ${JSON.stringify(res.findings, null, 2)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
