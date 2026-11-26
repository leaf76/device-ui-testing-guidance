#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const DEFAULT_TARGET_DIR = path.join(
  os.homedir(),
  ".gemini",
  "config",
  "plugins",
  "device-ui-testing-guidance"
);

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

export function installLocal(targetDir = DEFAULT_TARGET_DIR) {
  const resolvedTarget = path.resolve(targetDir);
  fs.mkdirSync(resolvedTarget, { recursive: true });

  // Preserve Syncthing markers (.stfolder, .stignore, etc.) in the plugin directory.
  for (const entry of fs.readdirSync(resolvedTarget)) {
    if (entry.startsWith(".st")) continue;
    fs.rmSync(path.join(resolvedTarget, entry), { recursive: true, force: true });
  }

  for (const item of RUNTIME_ITEMS) {
    const src = path.join(REPO_ROOT, item);
    if (!fs.existsSync(src)) {
      throw new Error(`Missing required runtime artifact: ${src}`);
    }
    copyRecursive(src, path.join(resolvedTarget, item));
  }

  return resolvedTarget;
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  const cliTarget =
    process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : DEFAULT_TARGET_DIR;
  const installedTo = installLocal(cliTarget);
  console.log(`Installed device-ui-testing-guidance plugin to: ${installedTo}`);
}
