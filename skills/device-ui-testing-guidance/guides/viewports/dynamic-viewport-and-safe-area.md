---
id: dynamic-viewport-and-safe-area
category: viewports
title: Dynamic Viewport Units and Safe Area Insets
description: Use dvh/svh viewport units and env(safe-area-inset-*) padding so mobile browser address bars, notches, Dynamic Islands, and home indicators never obscure controls.
keywords: [dvh, svh, vh, safe-area, notch, dynamic-island, viewport-fit, cover, sticky, ios]
appliesTo: [css, html, mobile]
---

# Dynamic Viewport Units and Safe Area Insets

## Invariants (DO / DON'T)

- **DO** pair `100vh` fallbacks with `100dvh` (for interactive full-screen shells) or `100svh` (for stable above-the-fold hero sections):
  `min-height: 100vh; min-height: 100dvh;`
- **DO** include `viewport-fit=cover` in `<meta name="viewport">` whenever relying on `env(safe-area-inset-*)`, and pad fixed/sticky headers, bottom action bars, and landscape left/right edges with `max(<base>, env(safe-area-inset-<edge>))`.
- **DO** remember landscape phone safe areas: iOS notches and Dynamic Islands sit on `safe-area-inset-left` or `safe-area-inset-right` when rotated!
- **DON'T** rely on raw `height: 100vh` for fixed bottom bars or full-screen drawers — on mobile Safari/Chrome, `100vh` uses the large viewport height, pushing bottom CTA buttons behind the browser toolbar.
- **DON'T** add `user-scalable=no` or `maximum-scale=1` to `<meta name="viewport">`; it breaks pinch-to-zoom accessibility (WCAG 1.4.4).

## Common Failure Modes

- Primary submit button pinned to `bottom: 0` sits directly under the iOS home indicator bar.
- Left navigation rail in phone landscape (`844x390`) collides with the iPhone Dynamic Island cutout because only `inset-top`/`inset-bottom` were padded.
- Full-bleed landing sections inherit `#app` safe-area padding unexpectedly, leaving asymmetric side gutters.

## Playwright Verification Recipe

```js
// Verify viewport meta does not disable zoom and declares viewport-fit=cover when safe-area CSS is used
const metaContent = await page.locator('meta[name="viewport"]').getAttribute("content");
expect(metaContent).not.toMatch(/user-scalable\s*=\s*(no|0)/i);
expect(metaContent).not.toMatch(/maximum-scale\s*=\s*1(\.0+)?(\s*,|$)/i);

// Verify bottom sticky/fixed controls sit cleanly inside window.innerHeight
const bottomClip = await page.evaluate(() => {
  const fixed = [...document.querySelectorAll("*")].filter((el) => {
    const pos = getComputedStyle(el).position;
    return (pos === "fixed" || pos === "sticky") && el.getBoundingClientRect().height > 0;
  });
  return fixed
    .map((el) => ({ tag: el.tagName, bottom: el.getBoundingClientRect().bottom }))
    .filter((r) => r.bottom > window.innerHeight + 1.5);
});
expect(bottomClip).toEqual([]);
```

## Related guides

- `short-landscape-and-keyboard-guard`
- `pwa-standalone-and-resilient-sessions`
- `static-css-html-antipattern-rules`
