#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { loadGuides, getGuideById, PACKAGE_ROOT } from "../lib/guides.mjs";
import { searchGuides } from "../lib/search.mjs";
import { runStaticScan } from "../lib/static-scan.mjs";
import { runAudit } from "../lib/audit.mjs";
import { PRESET_KEYS } from "../lib/viewports.mjs";

const SPILL_THRESHOLD_BYTES = 9500;

function readVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf8"));
    return pkg.version || "1.0.0";
  } catch {
    return "1.0.0";
  }
}

function parseFlags(args) {
  const positionals = [];
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq !== -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      } else {
        const key = arg.slice(2);
        const next = args[i + 1];
        if (next !== undefined && !next.startsWith("--")) {
          flags[key] = next;
          i++;
        } else {
          flags[key] = true;
        }
      }
    } else {
      positionals.push(arg);
    }
  }
  return { positionals, flags };
}

function printHelp() {
  console.log(`device-ui-testing-guidance v${readVersion()}

Usage:
  device-ui-testing-guidance search "<query>" [--category <cat>] [--limit <n>] [--json]
  device-ui-testing-guidance retrieve "<id1,id2>" [--raw]
  device-ui-testing-guidance list [--category <cat>] [--json]
  device-ui-testing-guidance static-scan <path> [--ignore <dir1,dir2>] [--json]
  device-ui-testing-guidance audit <url> [options]

Audit Options:
  --preset <name>             Viewport preset: ${Object.keys(PRESET_KEYS).join(", ")} (default: full)
  --viewports <spec>          Custom comma list, e.g. "360x640,667x375:touch,1280x800:desktop"
  --themes <list>             Comma list of color schemes: light,dark (default: light)
  --locale <bcp47>            Browser locale (default: en-US)
  --reduced-motion <mode>     no-preference | reduce (default: no-preference)
  --out <dir>                 Output directory for report.json, report.md, and screenshots/
  --screenshots <mode>        flagged | all | none (default: flagged)
  --full-page                 Capture fullPage screenshots instead of viewport-clipped
  --channel <name>            auto | chrome | msedge | chromium (default: auto)
  --playwright-from <path>    Path to project/package.json containing playwright
  --wait-for <css>            Wait for selector to become visible before evaluating
  --wait-ms <ms>              Extra settle delay after load (default: 150)
  --primary-selector <css>    Primary content selector for fold-height budget check
  --scroll-allowlist <css>    Extra comma-separated intentional scroll container selectors
  --actions <json-file>       JSON file of interactive actions to run per viewport
  --json                      Print JSON output to stdout`);
}

async function cmdSearch(positionals, flags) {
  const query = positionals.join(" ").trim();
  if (!query) {
    console.error('Usage: device-ui-testing-guidance search "<query>"');
    process.exit(2);
  }
  const limit = flags.limit ? Number(flags.limit) : 8;
  const results = searchGuides(query, { category: flags.category || "", limit });
  if (flags.json) {
    console.log(JSON.stringify(results.map(({ score: _s, ...rest }) => rest), null, 2));
    return;
  }
  if (results.length === 0) {
    console.log("[]");
    return;
  }
  console.log(
    JSON.stringify(
      results.map(({ id, category, title, description }) => ({ id, category, title, description })),
      null,
      2
    )
  );
}

async function cmdRetrieve(positionals, flags) {
  const rawArg = positionals.join(",").trim();
  if (!rawArg) {
    console.error('Usage: device-ui-testing-guidance retrieve "<id1,id2>"');
    process.exit(2);
  }
  const guides = loadGuides();
  const ids = rawArg
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const found = [];
  const missing = [];

  for (const id of ids) {
    const g = getGuideById(id, guides);
    if (g) found.push(g);
    else missing.push(id);
  }

  if (missing.length > 0) {
    console.error(`Guide(s) not found: ${missing.join(", ")}`);
    if (found.length === 0) process.exit(1);
  }

  const combined = found
    .map((g) => `<!-- guide: ${g.category}/${g.id} -->\n${g.body.trim()}\n`)
    .join("\n---\n\n");

  if (!flags.raw && Buffer.byteLength(combined, "utf8") > SPILL_THRESHOLD_BYTES) {
    const hash = crypto.createHash("sha256").update(ids.join(",")).digest("hex").slice(0, 8);
    const outPath = path.join(os.tmpdir(), `device-ui-testing-guidance-${hash}.md`);
    fs.writeFileSync(outPath, combined, "utf8");
    console.log(
      JSON.stringify(
        {
          spilledToFile: outPath,
          bytes: Buffer.byteLength(combined, "utf8"),
          guides: found.map((g) => `${g.category}/${g.id}`),
          note: "Combined output exceeded 9.5 KB; read the file above with your file-reading tool.",
        },
        null,
        2
      )
    );
    return;
  }

  process.stdout.write(combined);
}

async function cmdList(flags) {
  let guides = loadGuides();
  if (flags.category) {
    guides = guides.filter((g) => g.category.toLowerCase() === String(flags.category).toLowerCase());
  }
  const payload = guides.map((g) => ({
    id: g.id,
    category: g.category,
    title: g.title,
    description: g.description,
  }));
  if (flags.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const byCat = new Map();
  for (const item of payload) {
    if (!byCat.has(item.category)) byCat.set(item.category, []);
    byCat.get(item.category).push(item);
  }
  for (const [cat, items] of byCat.entries()) {
    console.log(`\n[${cat}] (${items.length})`);
    for (const item of items) {
      console.log(`  - ${item.id}: ${item.description}`);
    }
  }
}

async function cmdStaticScan(positionals, flags) {
  const target = positionals[0] || ".";
  const ignore = flags.ignore
    ? String(flags.ignore)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const result = runStaticScan(target, { ignore });
  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(
      `Static scan: ${result.summary.scannedFiles} file(s) scanned — ${result.summary.errors} error(s), ${result.summary.warnings} warning(s)`
    );
    for (const f of result.findings) {
      console.log(
        `[${f.severity.toUpperCase()}] ${f.file}:${f.line} (${f.ruleId} -> guide: ${f.guideId})\n  ${f.message}`
      );
    }
  }
  if (result.summary.errors > 0 && flags["fail-on-error"]) {
    process.exit(1);
  }
}

async function cmdAudit(positionals, flags) {
  const url = positionals[0];
  if (!url) {
    console.error("Usage: device-ui-testing-guidance audit <url> [options]");
    process.exit(2);
  }

  let actions = [];
  if (flags.actions) {
    const raw = fs.readFileSync(path.resolve(String(flags.actions)), "utf8");
    actions = JSON.parse(raw);
    if (!Array.isArray(actions)) {
      throw new Error("--actions file must contain a JSON array of action steps.");
    }
  }

  const report = await runAudit(url, {
    preset: flags.preset ? String(flags.preset) : "full",
    viewports: flags.viewports ? String(flags.viewports) : "",
    themes: flags.themes ? String(flags.themes) : "light",
    locale: flags.locale ? String(flags.locale) : "en-US",
    reducedMotion: flags["reduced-motion"] ? String(flags["reduced-motion"]) : "no-preference",
    outDir: flags.out ? String(flags.out) : "",
    screenshots: flags.screenshots ? String(flags.screenshots) : "flagged",
    fullPageScreenshots: Boolean(flags["full-page"]),
    channel: flags.channel ? String(flags.channel) : "auto",
    playwrightFrom: flags["playwright-from"] ? String(flags["playwright-from"]) : "",
    waitFor: flags["wait-for"] ? String(flags["wait-for"]) : "",
    waitMs: flags["wait-ms"] !== undefined ? Number(flags["wait-ms"]) : 150,
    primarySelector: flags["primary-selector"] ? String(flags["primary-selector"]) : "",
    scrollAllowlist: flags["scroll-allowlist"]
      ? String(flags["scroll-allowlist"])
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    actions,
  });

  if (flags.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(
      `Audit complete (${report.browserChannel}): ${report.summary.fail} FAIL | ${report.summary.warn} WARN | ${report.summary.passedRuns}/${report.summary.totalRuns} clean runs`
    );
    for (const r of report.runs) {
      const status = r.failCount > 0 ? "FAIL" : r.warnCount > 0 ? "WARN" : "PASS";
      console.log(
        `  [${status}] ${r.viewport.key} (${r.viewport.width}x${r.viewport.height}, ${r.theme}) — fail=${r.failCount} warn=${r.warnCount} overflow=${r.initialMetrics.rootOverflow}px`
      );
      for (const c of r.checks) {
        console.log(`      - [${c.severity.toUpperCase()}] ${c.id} (${c.phase}): ${c.message}`);
      }
    }
    if (flags.out) {
      console.log(`Artifacts written to: ${path.resolve(String(flags.out))}`);
    }
  }

  if (report.summary.fail > 0) {
    process.exit(1);
  }
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === "-h" || argv[0] === "--help" || argv[0] === "help") {
    printHelp();
    return;
  }
  if (argv[0] === "-v" || argv[0] === "--version") {
    console.log(readVersion());
    return;
  }

  const [subcommand, ...rest] = argv;
  const { positionals, flags } = parseFlags(rest);

  switch (subcommand) {
    case "search":
      await cmdSearch(positionals, flags);
      break;
    case "retrieve":
      await cmdRetrieve(positionals, flags);
      break;
    case "list":
      await cmdList(flags);
      break;
    case "static-scan":
      await cmdStaticScan(positionals, flags);
      break;
    case "audit":
      await cmdAudit(positionals, flags);
      break;
    default:
      console.error(`Unknown subcommand "${subcommand}". Run --help for usage.`);
      process.exit(2);
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
