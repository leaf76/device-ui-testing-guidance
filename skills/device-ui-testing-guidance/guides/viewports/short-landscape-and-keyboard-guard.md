---
id: short-landscape-and-keyboard-guard
category: viewports
title: Short Phone Landscape and Virtual Keyboard Media Query Guard
description: Adapt tightly constrained landscape heights (375-390px) without letting portrait on-screen keyboards falsely trigger landscape two-column rules.
keywords: [landscape, short-height, keyboard, orientation, media-query, 667x375, 844x390, two-pane]
appliesTo: [css, mobile, playwright]
---

# Short Phone Landscape and Virtual Keyboard Media Query Guard

## Invariants (DO / DON'T)

- **DO** scope phone-landscape layout overrides strictly with width AND height bounds:
  `@media (orientation: landscape) and (max-height: 500px) and (min-width: 560px) and (max-width: 1023px)`
- **DO** compress vertical chrome in short landscape: move bottom nav to a slim left icon rail (`48-56px`), collapse secondary quickbars behind a single toggle, and switch tall stacked modals (e.g., QR dialogs) to a compact side-by-side layout.
- **DO** guard auto-expanding drawers in JS with `window.innerHeight > 500` so short landscape screens preserve reading height.
- **DON'T** write bare `@media (orientation: landscape)` for phone layouts: on a `390x844` portrait phone, opening the virtual keyboard shrinks the visual viewport to roughly `390x360`, which flips `orientation: landscape` to `true` and shatters the layout into cramped two-column panes.
- **DON'T** lock PWA `manifest.webmanifest` to `"orientation": "portrait"` when users genuinely rotate phones for reading, tables, or companion views.

## Common Failure Modes

- Opening an input on portrait Android triggers `@media (orientation: landscape)` because keyboard-reduced viewport becomes wider than tall.
- Header + banner + filter bar consumes > 200px on a `375px`-tall screen, leaving less than 150px for actual content.
- Multi-button inline row in a left pane wraps into two lines on `667x375`, pushing speaker/time metadata off-edge.

## Playwright Verification Recipe

```js
// Test both 667x375 (short landscape) and 390x360 (simulated portrait + virtual keyboard)
for (const [w, h, expectTwoCol] of [[667, 375, true], [390, 360, false]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(url);
  const cols = await page.locator(".workspace-grid").evaluate((el) =>
    getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length
  );
  if (expectTwoCol) expect(cols).toBeGreaterThanOrEqual(2);
  else expect(cols).toBe(1);
  await ctx.close();
}
```

## Related guides

- `responsive-viewport-matrix`
- `dialogs-and-drawers-on-tight-screens`
- `above-the-fold-height-budget`
- `static-css-html-antipattern-rules`
