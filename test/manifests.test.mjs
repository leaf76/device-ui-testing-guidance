import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PACKAGE_ROOT, parseFrontmatter } from "../lib/guides.mjs";

const MANIFEST_FILES = [
  "package.json",
  "plugin.json",
  ".claude-plugin/plugin.json",
  ".claude-plugin/marketplace.json",
  ".codex-plugin/plugin.json",
  ".cursor-plugin/plugin.json",
  ".agents/plugins/marketplace.json",
  "gemini-extension.json",
];

test("all multi-agent JSON manifests exist and parse cleanly", () => {
  for (const rel of MANIFEST_FILES) {
    const full = path.join(PACKAGE_ROOT, rel);
    assert.ok(fs.existsSync(full), `Missing manifest: ${rel}`);
    const parsed = JSON.parse(fs.readFileSync(full, "utf8"));
    assert.equal(typeof parsed, "object");
  }
});

test("plugin.json and package.json stay aligned and point to valid assets/bin/skill", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf8"));
  const plugin = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "plugin.json"), "utf8"));

  assert.equal(pkg.name, "device-ui-testing-guidance");
  assert.equal(plugin.name, "device-ui-testing-guidance");
  assert.equal(pkg.version, plugin.version);
  assert.equal(pkg.dependencies, undefined, "package.json must have zero runtime dependencies");

  assert.ok(fs.existsSync(path.join(PACKAGE_ROOT, plugin.logo)), "Missing plugin logo");
  assert.ok(
    fs.existsSync(path.join(PACKAGE_ROOT, pkg.bin["device-ui-testing-guidance"])),
    "Missing CLI bin entry"
  );
  assert.equal(plugin.suggestedPrompts.length, 3);

  const skillPath = path.join(PACKAGE_ROOT, "skills", "device-ui-testing-guidance", "SKILL.md");
  assert.ok(fs.existsSync(skillPath), "Missing SKILL.md");
  const { data } = parseFrontmatter(fs.readFileSync(skillPath, "utf8"));
  assert.equal(data.name, "device-ui-testing-guidance");
});
