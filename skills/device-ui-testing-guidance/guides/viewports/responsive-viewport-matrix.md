---
id: responsive-viewport-matrix
category: viewports
title: 9-Viewport Responsive Test Matrix
description: Verify frontend layouts across 9 real-world device viewports from compact 360x640 phones and 667x375 short landscape through half-split laptops, tablets, and 1440x900 desktops.
keywords: [viewport, matrix, breakpoints, mobile, tablet, landscape, portrait, desktop, split-screen, rwd]
appliesTo: [playwright, css, rwd]
---

# 9-Viewport Responsive Test Matrix

## Invariants (DO / DON'T)

- **DO** test every UI/UX change against the full 9-viewport matrix rather than only `390x844` and `1280x800`:
  1. `360x640` — Compact phone portrait (`isMobile: true, hasTouch: true`)
  2. `390x844` — Mainstream phone portrait (`isMobile: true, hasTouch: true`)
  3. `667x375` — Short phone landscape (`isMobile: true, hasTouch: true`)
  4. `844x390` — Mainstream phone landscape (`isMobile: true, hasTouch: true`)
  5. `640x800` — Laptop half-split (`isMobile: false, hasTouch: false`)
  6. `768x1024` — Tablet portrait (`isMobile: true, hasTouch: true`)
  7. `1024x768` — Tablet landscape (`isMobile: true, hasTouch: true`)
  8. `1280x800` — Standard laptop (`isMobile: false, hasTouch: false`)
  9. `1440x900` — Desktop widescreen (`isMobile: false, hasTouch: false`)
- **DO** add an optional ultrawide check (`1920x1080`) for data-dense dashboards or multi-column tables to verify `max-width` readability.
- **DON'T** reuse a single browser context across mobile and desktop viewports by only calling `page.setViewportSize()`; `@media (pointer: coarse)` and `hover: none` require a fresh context with `isMobile` and `hasTouch`.

## Common Failure Modes

- Passing `390x844` while clipping selects or collapsing buttons at `360x640` (30px narrower).
- Passing portrait mobile while cutting off modal headers or primary content at `667x375` short landscape.
- Breaking at `640x800` half-split or `768x1024` tablet portrait where neither mobile single-column nor desktop multi-column rules match cleanly.

## Playwright Verification Recipe

```js
const MATRIX = [
  { key: "phone-compact-portrait", width: 360, height: 640, isMobile: true, hasTouch: true },
  { key: "phone-portrait", width: 390, height: 844, isMobile: true, hasTouch: true },
  { key: "phone-short-landscape", width: 667, height: 375, isMobile: true, hasTouch: true },
  { key: "phone-landscape", width: 844, height: 390, isMobile: true, hasTouch: true },
  { key: "laptop-half-split", width: 640, height: 800, isMobile: false, hasTouch: false },
  { key: "tablet-portrait", width: 768, height: 1024, isMobile: true, hasTouch: true },
  { key: "tablet-landscape", width: 1024, height: 768, isMobile: true, hasTouch: true },
  { key: "laptop", width: 1280, height: 800, isMobile: false, hasTouch: false },
  { key: "desktop", width: 1440, height: 900, isMobile: false, hasTouch: false },
];

for (const vp of MATRIX) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.isMobile,
    hasTouch: vp.hasTouch,
  });
  // run assertions & close ctx per viewport
  await ctx.close();
}
```

## Related guides

- `short-landscape-and-keyboard-guard`
- `split-screen-and-tablet-breakpoints`
- `headless-playwright-runner-contract`
- `geometry-assertions-and-severity-rubric`
