---
name: device-ui-testing-guidance
description: |
  Device adaptation, multi-viewport responsiveness, and real-world frontend UI/UX testing guidance, static CSS/HTML pitfall scanner, and headless Playwright auditor.
  Trigger whenever verifying, auditing, or fixing responsive layouts, mobile/tablet/foldable (cover + unfolded)/landscape/split-screen adaptation, dialogs/drawers/popovers/tables, touch targets, iOS input zoom, bilingual/long-string overflow, dark/light themes, 200% zoom, or Playwright UI checks.
  DO NOT trigger for backend-only API/SQL/worker logic, pure unit tests without DOM/CSS, infra/CI scripts, or copy-only docs edits.
---

# Device UI Testing Guidance

Systematic guidance and runnable verification tooling for proving that web interfaces adapt cleanly across real devices, viewports, input modes, and adversarial usage scenarios before shipping.

## CLI Resolution

Run directly via `npx` (published on npm as `device-ui-testing-guidance`), or invoke the bundled offline CLI at `../../bin/device-ui-testing-guidance.mjs` relative to this `SKILL.md`:

```sh
# Zero-install via npm (Windows: use npx.cmd):
npx -y device-ui-testing-guidance@latest <subcommand> [args]

# Offline local plugin install (Windows/macOS/Linux):
node "<plugin-root>/bin/device-ui-testing-guidance.mjs" <subcommand> [args]
```

> On Windows PowerShell, quote paths containing spaces and avoid `&&`; chain commands with `; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }`.

## Primary Workflow

### Step 1. Search Testing Guides

Query with **2-5 English words** targeting a single device, layout, input, overlay, or testing scenario (omit framework names like React/Vue/Tailwind):

```sh
node "<plugin-root>/bin/device-ui-testing-guidance.mjs" search "short landscape dialog clipping"
```

- **Match found**: Go directly to Step 2 (`retrieve`).
- **Weak/empty results**: Rephrase once with concrete UI/device nouns (`viewport`, `overflow`, `touch`, `ios`, `landscape`, `table`, `dialog`, `ime`, `bilingual`, `zoom`) or run `list` for broad audits.

### Step 2. Retrieve Applicable Guides

Fetch specific guides plus any execution guide (`headless-playwright-runner-contract`, `geometry-assertions-and-severity-rubric`) needed for the task. Comma-separate multiple IDs:

```sh
node "<plugin-root>/bin/device-ui-testing-guidance.mjs" retrieve "responsive-viewport-matrix,zero-overflow-and-clipping-scan"
```

If combined output exceeds `9.5 KB`, the CLI writes it to a temporary file and prints the path — read that file directly with your file-reading tool.

### Step 3. Run Static Scan & Headless Multi-Viewport Audit

1. **Static CSS/HTML Pitfall Scan** (fast, zero-browser pre-check):
   ```sh
   node "<plugin-root>/bin/device-ui-testing-guidance.mjs" static-scan <src-dir> --json
   ```
   Verify every finding against its `keepWhen` / `dropWhen` rubric before changing code; ignore verified false positives.

2. **Live Headless Playwright Audit** (9-viewport matrix by default; use `--preset foldable`, `--preset foldable-hinge`, or `--preset all` + `--fold-transitions` to include foldable cover/unfolded screens and live fold↔unfold checks; never `--headed`, never steals OS focus):
   ```sh
   node "<plugin-root>/bin/device-ui-testing-guidance.mjs" audit <url> \
     --preset full \
     --themes light,dark \
     --out <scratch-or-audit-dir> \
     --json
   ```
   - Use `--preset all --fold-transitions` when auditing foldable cover (`344x882`, `882x344`, `360x374`), unfolded (`712x776`, `776x712`), and live open↔close transitions alongside the 9 standard viewports (or `--preset foldable-hinge` for half-folded hinge posture checks).
   - Pass `--playwright-from <path-to-project-or-package.json>` (or set `PLAYWRIGHT_PATH`) if the target repository does not install `playwright` locally.
   - Pass `--actions <actions.json>` to exercise interactive modals, drawers, tabs, dropdowns, live `resize` steps, and `Escape` dismissal across viewports.
   - Pass `--primary-selector "<css>"` to enforce above-the-fold primary content height budgets on tight screens (`360x640`, `667x375`).
   - Seed **realistic dense / adversarial fixtures** (55+ char slugs/emails/UUIDs, 90+ char URLs, populated lists, EN + ZH/target locales) before judging pass/fail.

### Step 4. Visually Inspect Screenshots & Disclose Results

DOM geometry checks catch objective regressions, but **cannot replace visual inspection** for cramping, awkward line wraps, contrast drops, or double chevrons:

1. Open screenshots from `--out` for **tightest viewports** (`360x640`, `667x375`) and **every flagged viewport** using your file/image reading tool.
2. Fix root causes cleanly — **never** mask horizontal overflow with `body { overflow-x: hidden | clip }`.
3. Re-run `audit` until `0 FAIL` (and resolve or explicitly justify any remaining `WARN`).
4. Report the verified viewport matrix, themes/locales tested, `FAIL`/`WARN`/JS-error counts, and which guides shaped the fixes.

## Non-Negotiable Testing Invariants

- **Never trust `documentElement.scrollWidth` alone**: Always combine it with visible element `getBoundingClientRect().right <= Math.min(window.innerWidth, expectedWidth) + 1.5` clipping scans (excluding closed `<dialog>` and intentional scroll containers).
- **Guard against mobile shrink-to-fit inflation**: Under Playwright `isMobile: true`, overflowing content can inflate `window.innerWidth` beyond the requested device width; always assert against `Math.min(window.innerWidth, expectedWidth)` in addition to `documentElement.scrollWidth`.
- **Always emulate touch on mobile/tablet viewports**: Use `isMobile: true, hasTouch: true` so `@media (pointer: coarse)` rules actually activate.
- **Protect portrait virtual keyboards**: Never write bare `@media (orientation: landscape)` for phone multi-column layouts without pairing `max-height: 500px` and `min-width: 560px`.
- **Keep mobile inputs zoom-safe**: Every interactive `<input>`, `<select>`, and `<textarea>` on mobile MUST compute to `font-size >= 16px` (check higher-specificity class overrides too).
- **Verify foldable cover + unfolded continuity**: Never treat `360x640` or `768x1024` as sufficient for foldables; narrow cover screens (`344x882`, `360x374`) and near-square unfolded inner screens (`712x776`, `776x712`) must remain touch-safe and survive live same-session resize without stale JS widths.
- **Headless & zero focus stealing**: Always launch `headless: true` (`channel: "chrome"`, fallback `"msedge"` or bundled Chromium). Never steal desktop focus.
