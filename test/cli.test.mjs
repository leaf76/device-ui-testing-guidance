import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { PACKAGE_ROOT } from "../lib/guides.mjs";

const CLI = path.join(PACKAGE_ROOT, "bin", "device-ui-testing-guidance.mjs");

function runCli(args) {
  return execFileSync(process.execPath, [CLI, ...args], {
    encoding: "utf8",
    cwd: PACKAGE_ROOT,
  });
}

test("CLI --version and list --json work cleanly", () => {
  const version = runCli(["--version"]).trim();
  assert.match(version, /^\d+\.\d+\.\d+$/);

  const list = JSON.parse(runCli(["list", "--json"]));
  assert.equal(list.length, 24);
});

test("CLI search ranks expected guides including domain synonyms", () => {
  const cases = [
    ["short landscape modal clipping", "dialogs-and-drawers-on-tight-screens"],
    ["safari input zoom 16px", "ios-input-zoom-and-form-ergonomics"],
    ["rwd viewport matrix", "responsive-viewport-matrix"],
    ["bilingual cjk english truncation", "bilingual-cjk-latin-expansion"],
    ["body overflow-x hidden band-aid", "zero-overflow-and-clipping-scan"],
  ];

  for (const [query, expectedId] of cases) {
    const results = JSON.parse(runCli(["search", query, "--json"]));
    assert.ok(results.length > 0, `Empty results for "${query}"`);
    const topIds = results.slice(0, 3).map((r) => r.id);
    assert.ok(
      topIds.includes(expectedId),
      `Expected "${expectedId}" in top 3 for "${query}", got: ${topIds.join(", ")}`
    );
  }
});

test("CLI retrieve returns single guide directly and spills large bundles to a temp file", () => {
  const single = runCli(["retrieve", "responsive-viewport-matrix"]);
  assert.match(single, /9-Viewport Responsive Test Matrix/);

  const multiOut = runCli([
    "retrieve",
    "responsive-viewport-matrix,zero-overflow-and-clipping-scan,dialogs-and-drawers-on-tight-screens,geometry-assertions-and-severity-rubric",
  ]);
  const spill = JSON.parse(multiOut);
  assert.ok(spill.spilledToFile, "Expected large bundle to spill to a temp file");
  assert.ok(fs.existsSync(spill.spilledToFile), "Spilled temp file should exist");
  const content = fs.readFileSync(spill.spilledToFile, "utf8");
  assert.match(content, /9-Viewport Responsive Test Matrix/);
  assert.match(content, /Geometry Assertions/);
  fs.unlinkSync(spill.spilledToFile);
});

test("CLI retrieve exits non-zero on unknown guide ID", () => {
  assert.throws(
    () => runCli(["retrieve", "non-existent-guide-xyz"]),
    (err) => err.status === 1
  );
});
