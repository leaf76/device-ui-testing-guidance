---
id: popovers-dropdowns-and-select-bounds
category: overlays-components
title: Popovers, Dropdown Menus, and Customizable Select Bounds
description: Verify open menus, account switchers, tooltips, and base-select controls never escape viewport edges, duplicate chevrons, or crowd selected labels.
keywords: [popover, dropdown, menu, select, base-select, anchor-positioning, chevron, switcher, bounds]
appliesTo: [html, css, playwright]
---

# Popovers, Dropdown Menus, and Customizable Select Bounds

## Invariants (DO / DON'T)

- **DO** test every popover, account switcher, overflow menu (`...`), and dropdown in its **open** state on both `360x640` and `1280x800`, asserting `rect.left >= 0`, `rect.right <= window.innerWidth`, and `rect.bottom <= window.innerHeight`.
- **DO** cap popover width with `max-width: calc(100dvw - 24px)` and flip/align to the viewport edge (`inset-inline-end: 0` or CSS Anchor Positioning `position-try-fallbacks: flip-inline, flip-block`).
- **DO** verify customizable `<select>` (`appearance: base-select`) controls keep `background-image: none` (preventing double chevrons alongside `::picker-icon`), preserve their `<button><selectedcontent>` trigger after dynamic option population, and maintain `>= 16px` clearance between `<selectedcontent>` right edge and `<select>` right edge.
- **DON'T** anchor a fixed `280px` left-aligned dropdown to a button near the right edge of a `360px` phone — it will overflow `200px` off-screen.

## Common Failure Modes

- An account switcher menu opens cleanly on `1280x800` but extends past `x = 360px` on compact Android phones.
- Dynamic `select.replaceChildren(...)` wipes out the `<button><selectedcontent></selectedcontent></button>` node required by `appearance: base-select`.
- Custom SVG background arrow stays active when `appearance: base-select` also draws `::picker-icon`, rendering twin chevrons.

## Playwright Verification Recipe

```js
// Open menu and assert strict viewport containment
await page.locator("#account-switcher-trigger").click();
const menuRect = await page.locator("#account-switcher-menu").evaluate((el) => {
  const r = el.getBoundingClientRect();
  return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, vw: window.innerWidth, vh: window.innerHeight };
});
expect(menuRect.left).toBeGreaterThanOrEqual(0);
expect(menuRect.right).toBeLessThanOrEqual(menuRect.vw + 1.5);
expect(menuRect.bottom).toBeLessThanOrEqual(menuRect.vh + 1.5);
```

## Related guides

- `dialogs-and-drawers-on-tight-screens`
- `zero-overflow-and-clipping-scan`
- `visual-screenshot-triage-workflow`
