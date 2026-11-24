---
id: touch-targets-and-coarse-pointer
category: input-ergonomics
title: Touch Targets, Coarse Pointer, and Hover-Free Operability
description: Guarantee >= 44px touch hit areas under real coarse-pointer emulation and eliminate controls trapped behind desktop-only :hover states.
keywords: [touch, pointer, coarse, tap-target, 44px, hover, mobile, accessibility, wcag, hit-area]
appliesTo: [css, mobile, playwright]
---

# Touch Targets, Coarse Pointer, and Hover-Free Operability

## Invariants (DO / DON'T)

- **DO** launch mobile and tablet Playwright contexts with `isMobile: true, hasTouch: true` so Chromium accurately matches `@media (pointer: coarse)` and `@media (hover: none)`.
- **DO** enforce `min-width: 44px; min-height: 44px;` (or at least `44px` hit box via padding/pseudo-element) on primary interactive buttons, icon triggers, checkboxes wrapped in `<label>`, and navigation controls on coarse-pointer devices (WCAG 2.5.8 minimum is 24px; ergonomic target is 44px).
- **DO** keep at least `8px` gap between adjacent destructive and primary touch actions (e.g., `Save` vs `Delete`, `Confirm` vs `Cancel`).
- **DO** gate hover-only affordances inside `@media (hover: hover) and (pointer: fine)` and ensure every action revealed on hover (edit/delete row buttons, copy buttons) is either permanently visible on touch or accessible via an explicit overflow menu.
- **DON'T** confuse visual icon size with hit area: a `16px` SVG icon inside a `44x44px` button is clean and ergonomic; a `24x24px` clickable icon button with zero padding is a mis-tap hazard.

## Common Failure Modes

- Row action buttons (`Copy`, `Delete`) use `opacity: 0; pointer-events: none` until `:hover`, making them unreachable on iOS/Android phones and tablets.
- Playwright runs `page.setViewportSize({ width: 390, height: 844 })` without `hasTouch: true`, so `@media (pointer: coarse)` CSS overrides are never executed or tested.
- Close (`×`) buttons in compact cards or dialogs measure `22x22px` on phones.

## Playwright Verification Recipe

```js
// Inside a context created with { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
const smallTargets = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll("button, a[href], input, select, [role='button'], [role='tab']")) {
    if (el.closest("dialog:not([open]), [hidden]")) continue;
    // Exempt inline prose links inside paragraphs/list prose
    if (el.tagName === "A" && el.closest("p, li") && getComputedStyle(el).display === "inline") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.width < 44 || r.height < 44) {
      out.push({ tag: el.tagName, text: el.textContent?.trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) });
    }
  }
  return out;
});
```

## Related guides

- `responsive-viewport-matrix`
- `forms-checkbox-and-hidden-specificity`
- `ios-input-zoom-and-form-ergonomics`
- `static-css-html-antipattern-rules`
