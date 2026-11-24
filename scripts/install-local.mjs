#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const TARGET_DIR =
  process.argv[2] && !process.argv[2].startsWith("--")
    ? path.resolve(process.argv[2])
    : path.join(os.homedir(), ".gemini", "config", "plugins", "device-ui-testing-guidance");

const RUNTIME_ITEMS = [
  "plugin.json",
  "package.json",
  "README.md",
  "LICENSE",
  "assets",
  "bin",
  "lib",
  "skills",
];

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function main() {
  if (fs.existsSync(TARGET_DIR)) {
    fs.rmSync(TARGET_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TARGET_DIR, { recursive: true });

  for (const item of RUNTIME_ITEMS) {
    const src = path.join(REPO_ROOT, item);
    if (!fs.existsSync(src)) {
      throw new Error(`Missing required runtime artifact: ${src}`);
    }
    copyRecursive(src, path.join(TARGET_DIR, item));
  }

  console.log(`Installed device-ui-testing-guidance plugin to: ${TARGET_DIR}`);
}

main();
