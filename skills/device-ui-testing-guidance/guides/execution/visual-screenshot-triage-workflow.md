---
id: visual-screenshot-triage-workflow
category: execution
title: Visual Screenshot Capture and Human/Agent Triage Workflow
description: Combine automated DOM checks with mandatory screenshot inspection on tight and flagged viewports to catch visual flaws that geometry metrics miss.
keywords: [screenshot, visual-inspection, triage, fullPage, read_file, cramping, contrast, chevron, symmetry]
appliesTo: [playwright, execution, ux]
---

# Visual Screenshot Capture and Human/Agent Triage Workflow

## Invariants (DO / DON'T)

- **DO** ALWAYS visually inspect screenshots (using an image-capable reading tool) for at minimum:
  1. Compact phone portrait (`360x640`)
  2. Short phone landscape (`667x375`)
  3. Standard desktop (`1280x800` or `1440x900`)
  4. **Every** viewport/theme/state that emitted a `FAIL` or `WARN` (both before and after the fix!)
- **DO** check for the 6 visual defects DOM bounding-box assertions routinely miss:
  - Awkward 1-word vertical label wrapping on buttons or headers
  - Double chevrons (`background-image` + native `::picker-icon`) on selects
  - Cramped breathing room / zero visual hierarchy / duplicate adjacent pills
  - Poor text or icon contrast in light vs dark theme
  - Misaligned SVG icon baselines next to CJK vs Latin text
  - Asymmetric card grids or orphaned single items on tablet/desktop
- **DO** use viewport screenshots (`fullPage: false`) for above-the-fold and short-landscape checks, and `fullPage: true` for long form/settings/card pages where bottom sticky bars or footer spacing matter.
- **DON'T** declare a UI fix "verified" purely from `0 FAIL` JSON output without inspecting at least the tightest modified screenshots.

## Common Failure Modes

- All DOM assertions return `0 FAIL`, yet the screenshot reveals a `<button>` wrapped onto 3 narrow lines (`Re- / gen- / erate`) or low-contrast dark gray text on a black card.
- Taking only `fullPage: true` hides the fact that the sticky footer covered the primary content inside the `375px`-tall viewport window.

## Playwright Verification Recipe

```js
// Viewport-clipped above-the-fold proof + full-page scroll proof
await page.screenshot({ path: `${outDir}/${vp.key}-${theme}-fold.png`, fullPage: false });
await page.screenshot({ path: `${outDir}/${vp.key}-${theme}-full.png`, fullPage: true });
```

## Related guides

- `headless-playwright-runner-contract`
- `geometry-assertions-and-severity-rubric`
- `themes-contrast-zoom-and-motion`
- `bilingual-cjk-latin-expansion`
