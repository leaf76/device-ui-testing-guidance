---
id: split-screen-and-tablet-breakpoints
category: viewports
title: Split-Screen and Tablet Breakpoint Dead-Zones
description: Eliminate layout collapses at 640x800 laptop half-split, 768x1024 tablet portrait, and 1024x768 tablet landscape where mobile and desktop rules clash.
keywords: [tablet, split-screen, 640x800, 768x1024, 1024x768, breakpoint, container-queries, sidebar]
appliesTo: [css, playwright, rwd]
---

# Split-Screen and Tablet Breakpoint Dead-Zones

## Invariants (DO / DON'T)

- **DO** explicitly test `640x800` (desktop pointer, narrow width), `768x1024` (touch tablet portrait), and `1024x768` (touch tablet landscape).
- **DO** prefer CSS `@container` queries and fluid grids (`repeat(auto-fit, minmax(min(260px, 100%), 1fr))`) for cards, toolbars, and split panes instead of assuming `>= 768px` always has wide space for every sub-panel.
- **DO** verify right-column quickbars and chip strips inside two-column `768x1024` layouts: each pane is only `~340-400px` wide even though the viewport is `768px`.
- **DON'T** couple touch-vs-mouse ergonomics solely to viewport width (`max-width: 768px`); a `1024x768` iPad has `pointer: coarse`, while a `640x800` split-screen browser window on desktop has `pointer: fine`.

## Common Failure Modes

- A `768x1024` tablet triggers desktop 2-column mode, squeezing a 4-chip horizontal bar inside the right pane until the 4th chip clips against the right viewport border.
- A fixed `280px` sidebar at `1024x768` leaves only `744px` for a wide data table with 6 columns and action buttons, forcing column collisions.
- Half-split desktop window (`640x800`) hides mobile drawer controls above `600px` while desktop top nav links wrap into 3 chaotic lines.

## Playwright Verification Recipe

```js
// Inspect narrow-pane sub-components at 640x800 and 768x1024
for (const [width, height, touch] of [[640, 800, false], [768, 1024, true], [1024, 768, true]]) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: touch, hasTouch: touch });
  const page = await ctx.newPage();
  await page.goto(url);
  const clipped = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("button, a, select, [role='tab']")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > window.innerWidth + 1.5 || r.left < -1.5) out.push(el.textContent?.trim() || el.tagName);
    }
    return out;
  });
  expect(clipped).toEqual([]);
  await ctx.close();
}
```

## Related guides

- `responsive-viewport-matrix`
- `toolbar-crowding-and-overlap-audit`
- `responsive-tables-and-long-tokens`
- `touch-targets-and-coarse-pointer`
