---
id: above-the-fold-height-budget
category: layout
title: Above-the-Fold Primary Content Height Budget
description: Prevent stacked headers, banners, duplicate status pills, and persistent drawers from squeezing primary content off-screen on 360x640 and 667x375 viewports.
keywords: [above-the-fold, height-budget, chrome, header, crowding, compaction, collapsed, banner, mobile]
appliesTo: [css, ux, playwright]
---

# Above-the-Fold Primary Content Height Budget

## Invariants (DO / DON'T)

- **DO** reserve at least `55%` of the viewport height (and `>= 220px` on `667x375` short landscape / `>= 340px` on `360x640` compact portrait) for the primary reading or task surface.
- **DO** merge overlapping secondary bars (e.g., meeting summary + coding status board) into a single default-collapsed header row (`~36-44px`) that expands into one bounded drawer (`max-height: 36-40dvh`).
- **DO** compact or hide completed-state checklists, claimed bonus banners, and redundant status pills once their task is done so real controls enter the first screen.
- **DO** collapse quick-assist / filter chip strips behind a compact toggle button on `<= 480px` phones and short landscape screens, adding a right-edge fade cue if horizontally scrollable.
- **DON'T** stack 3+ persistent horizontal strips (navbar + announcement banner + filter bar + status strip) above the primary viewport on phones.

## Common Failure Modes

- Four `✓ Done` onboarding checklist rows occupy `340px` at the top of `/account#security`, pushing all actual settings below the fold on `390x844`.
- An uncollapsed toolbar + summary bar + quickbar eats `210px` of a `375px`-tall phone landscape viewport, leaving a narrow `165px` slit to read live output.
- Identical status pills repeated in header, KPI strip, and overview card waste vertical space on mobile.

## Playwright Verification Recipe

```js
// Assert primary content begins cleanly above the fold and retains readable viewport budget
const budget = await page.evaluate((selector) => {
  const primary = document.querySelector(selector || "main, [role='main'], article");
  if (!primary) return null;
  const r = primary.getBoundingClientRect();
  const visibleTop = Math.max(0, r.top);
  const visibleBottom = Math.min(window.innerHeight, r.bottom);
  const visibleHeight = Math.max(0, visibleBottom - visibleTop);
  return {
    vh: window.innerHeight,
    topOffsetRatio: Number((visibleTop / window.innerHeight).toFixed(2)),
    visibleRatio: Number((visibleHeight / window.innerHeight).toFixed(2)),
    visibleHeight: Math.round(visibleHeight),
  };
}, primarySelector);
expect(budget.topOffsetRatio).toBeLessThanOrEqual(0.45);
```

## Related guides

- `short-landscape-and-keyboard-guard`
- `toolbar-crowding-and-overlap-audit`
- `cards-lists-and-detail-disclosure`
- `adversarial-data-and-empty-dense-states`
