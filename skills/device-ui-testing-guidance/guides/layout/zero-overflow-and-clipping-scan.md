---
id: zero-overflow-and-clipping-scan
category: layout
title: Zero Horizontal Overflow and Anti-Masking Clipping Scan
description: Catch real horizontal overflow and silently clipped off-screen elements by combining document scrollWidth with visible bounding-box edge scans instead of masking overflow on body.
keywords: [overflow, scrollwidth, clipping, bounding-box, horizontal-scroll, overflow-x, hidden, band-aid]
appliesTo: [css, playwright, layout]
---

# Zero Horizontal Overflow and Anti-Masking Clipping Scan

## Invariants (DO / DON'T)

- **DO** enforce `document.documentElement.scrollWidth <= expectedViewportWidth + 1` AND `window.innerWidth <= expectedViewportWidth + 1` across every viewport. Under Playwright `isMobile: true`, overflowing content causes Chromium mobile shrink-to-fit to silently inflate `window.innerWidth` beyond the requested device width (e.g., `360px` inflates to `460px`), making `scrollWidth - window.innerWidth` falsely report `0`!
- **DO** ALWAYS pair the overflow check with a visible-element bounding-box scan asserting `rect.right <= Math.min(window.innerWidth, expectedViewportWidth) + 1.5` and `rect.left >= -1.5` (excluding closed `<dialog>`, `aria-hidden="true"` decorative backgrounds, and explicitly declared intentional horizontal scroll strips like `.table-wrapper`, `pre`, `[data-scroll-strip]`).
- **DO** add `min-width: 0` on flex and grid children (`flex: 1; min-width: 0;` or `minmax(0, 1fr)`) so long URLs, code spans, and strings wrap or truncate inside their track instead of pushing parent width past `100%`.
- **DON'T** ever put `overflow-x: hidden` or `overflow-x: clip` on `html` or `body` to "pass" an overflow test — it silently chops off interactive buttons and text off the right edge AND breaks `position: sticky` descendants.

## Common Failure Modes

- `scrollWidth === innerWidth` passes green while a button on the right side of a card is sliced in half at `rect.right = 418px` on a `390px` viewport because `body { overflow-x: hidden }` hid the scrollbar.
- Flex item missing `min-width: 0` expands to the intrinsic width of a 60-character email or slug.
- Negative margins (`margin-inline: -16px`) on full-bleed bands exceed container width without matching padding.

## Playwright Verification Recipe

```js
const report = await page.evaluate(() => {
  const vw = window.innerWidth;
  const rootOverflow = document.documentElement.scrollWidth - vw;
  const bodyOx = getComputedStyle(document.body).overflowX;
  const htmlOx = getComputedStyle(document.documentElement).overflowX;
  const allow = ".table-wrapper, pre, code, [data-scroll-strip]";
  const clipped = [];

  for (const el of document.querySelectorAll("body *")) {
    if (el.closest("dialog:not([open]), [hidden], [aria-hidden='true']")) continue;
    if (el.closest(allow) && el.closest(allow) !== el) continue;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (r.right > vw + 1.5 || r.left < -1.5) {
      clipped.push({ tag: el.tagName, cls: el.className, left: Math.round(r.left), right: Math.round(r.right), vw });
    }
  }
  return { rootOverflow, maskedRoot: [bodyOx, htmlOx].some((v) => v === "hidden" || v === "clip"), clipped };
});
expect(report.rootOverflow).toBeLessThanOrEqual(1);
expect(report.clipped).toEqual([]);
```

## Related guides

- `responsive-tables-and-long-tokens`
- `toolbar-crowding-and-overlap-audit`
- `geometry-assertions-and-severity-rubric`
- `static-css-html-antipattern-rules`
