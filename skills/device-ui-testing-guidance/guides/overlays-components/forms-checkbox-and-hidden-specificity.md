---
id: forms-checkbox-and-hidden-specificity
category: overlays-components
title: Checkbox Row Geometry and [hidden] Specificity Guards
description: Prevent stacked/stretched checkboxes caused by generic form label rules and stop flex/grid display rules from overriding the HTML hidden attribute.
keywords: [checkbox, radio, label, specificity, hidden, display-flex, display-grid, form, toggle]
appliesTo: [css, html, playwright]
---

# Checkbox Row Geometry and [hidden] Specificity Guards

## Invariants (DO / DON'T)

- **DO** pair every hideable `display: flex` or `display: grid` component (banners, consent rows, action bars, conditional forms) with an explicit `[hidden] { display: none !important; }` (or scoped `.my-bar[hidden] { display: none; }`) rule, because author `display: flex` overrides the UA stylesheet's `[hidden] { display: none; }`.
- **DO** scope horizontal checkbox/radio label rows with equal or higher specificity than generic `.stack-form label` / `.stack-form input` rules: keep `display: flex; align-items: center; gap: 10px; min-block-size: 44px;`, and keep the checkbox input itself `width: 18-22px; height: 18-22px; min-block-size: 0; flex: 0 0 auto;`.
- **DO** verify horizontal checkbox geometry directly in Playwright (`inputRect.right <= textRect.left + 2`, checkbox `<= 24x24px`, wrapping `<label>` height `>= 44px`).
- **DON'T** apply `width: 100%; min-block-size: 44px;` to bare `input` selectors without excluding `:not([type="checkbox"]):not([type="radio"])`.

## Common Failure Modes

- A generic `.stack-form label { display: grid; }` + `.stack-form input { width: 100%; min-block-size: 44px; }` stretches a consent checkbox to 360px wide and stacks the label text underneath it.
- Toggling `banner.hidden = true` after claiming a bonus or turning off Auto Top-Up leaves the banner visible on screen because `.billing-bonus-bar { display: flex; }` beats the browser's `[hidden]` default.
- Button base rules (`button[type="button"]`) accidentally override custom ghost/icon buttons due to higher attribute specificity.

## Playwright Verification Recipe

```js
// 1. Verify no [hidden] element renders visibly
const leakedHidden = await page.evaluate(() => {
  return [...document.querySelectorAll("[hidden]")]
    .filter((el) => getComputedStyle(el).display !== "none")
    .map((el) => ({ tag: el.tagName, id: el.id, cls: el.className }));
});
expect(leakedHidden).toEqual([]);

// 2. Verify horizontal checkbox rows render side-by-side with ergonomic tap height
const cbCheck = await page.evaluate(() => {
  return [...document.querySelectorAll("label:has(> input[type='checkbox'])")].map((label) => {
    const input = label.querySelector("input[type='checkbox']");
    const span = label.querySelector("span");
    if (!input || !span) return null;
    const lr = label.getBoundingClientRect();
    const ir = input.getBoundingClientRect();
    const sr = span.getBoundingClientRect();
    return {
      labelHeight: Math.round(lr.height),
      boxW: Math.round(ir.width),
      boxH: Math.round(ir.height),
      sideBySide: ir.right <= sr.left + 2,
    };
  }).filter(Boolean);
});
```

## Related guides

- `touch-targets-and-coarse-pointer`
- `ios-input-zoom-and-form-ergonomics`
- `static-css-html-antipattern-rules`
