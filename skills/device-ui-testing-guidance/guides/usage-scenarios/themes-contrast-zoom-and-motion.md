---
id: themes-contrast-zoom-and-motion
category: usage-scenarios
title: Themes, Forced Colors, 200% Text Zoom, and Reduced Motion
description: Test light and dark color schemes, high-contrast forced-colors mode, 200% browser/OS text scaling, and prefers-reduced-motion to verify readability and layout stability.
keywords: [dark-mode, light-mode, theme, contrast, forced-colors, zoom, 200-percent, text-scale, reduced-motion, accessibility]
appliesTo: [css, accessibility, playwright]
---

# Themes, Forced Colors, 200% Text Zoom, and Reduced Motion

## Invariants (DO / DON'T)

- **DO** run key viewports (`360x640`, `667x375`, `1280x800`) under both `colorScheme: "light"` and `colorScheme: "dark"` (plus any product-specific theme query/class) to catch hardcoded `#fff` / `#000` leaks, invisible SVG strokes, or undefined CSS custom properties (`var(--missing)`).
- **DO** test **200% text reflow** (WCAG 1.4.4 & 1.4.10): doubling root `font-size` (`32px`) or rendering at `320px` CSS width must NOT introduce horizontal scrolling or overlapping text. Keep `clamp()` max font sizes `<= 2.5x` the min so browser zoom scales smoothly.
- **DO** verify `forced-colors: active` (Windows High Contrast) keeps focus rings, borders, selected tab indicators, and SVG icons (`currentColor`) distinguishable.
- **DO** honor `@media (prefers-reduced-motion: reduce)` by disabling or shortening non-essential parallax, bounce, and slide animations while keeping state transitions clear.
- **DON'T** test only your personal OS theme — dark-mode-only verification regularly ships unreadable white-on-white inputs or low-contrast badges in light mode.

## Common Failure Modes

- A destructive button references an undefined token `var(--danger)` instead of `var(--bad)`, silently rendering transparent text on a transparent background.
- Fixed pixel heights (`height: 40px; overflow: hidden;`) chop text in half when a user increases OS font size to 150-200%.
- Inline SVG logo or icon hardcodes `fill="#111"` instead of `currentColor`, vanishing on dark surfaces.

## Playwright Verification Recipe

```js
// 1. Dark / Light + Reduced Motion + Forced Colors emulation
for (const cfg of [
  { name: "light", colorScheme: "light", reducedMotion: "no-preference", forcedColors: "none" },
  { name: "dark", colorScheme: "dark", reducedMotion: "reduce", forcedColors: "none" },
  { name: "high-contrast", colorScheme: "dark", reducedMotion: "reduce", forcedColors: "active" },
]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, ...cfg });
  const page = await ctx.newPage();
  await page.goto(url);
  // Assert zero horizontal overflow & capture visual proof
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await ctx.close();
}

// 2. 200% text-scale stress test
await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
```

## Related guides

- `zero-overflow-and-clipping-scan`
- `visual-screenshot-triage-workflow`
- `static-css-html-antipattern-rules`
