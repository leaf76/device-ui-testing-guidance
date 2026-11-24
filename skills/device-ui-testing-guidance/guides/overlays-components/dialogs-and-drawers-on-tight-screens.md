---
id: dialogs-and-drawers-on-tight-screens
category: overlays-components
title: Dialogs and Drawers on Tight and Short-Landscape Screens
description: Prevent top-edge dialog clipping, focus scroll jumps, and backdrop dismissal failures across 360x640 phones and 667x375 short landscape screens.
keywords: [dialog, modal, drawer, top-layer, backdrop, short-landscape, 667x375, closedby, scrollTop, qr]
appliesTo: [html, css, js, mobile, playwright]
---

# Dialogs and Drawers on Tight and Short-Landscape Screens

## Invariants (DO / DON'T)

- **DO** use native `<dialog>` opened with `showModal()` for modal dialogs and mobile drawers (automatic top-layer, inert background, `Escape` dismissal, focus restoration).
- **DO** bound dialog dimensions to the dynamic viewport: `max-width: calc(100dvw - 24px); max-height: calc(100dvh - 24px); overflow: auto; overscroll-behavior: contain;`.
- **DO** add a short-landscape compact override (`@media (max-height: 500px) and (min-width: 520px)`) for vertically stacked modals (like QR/pair/confirmation cards) so media and copy sit side-by-side instead of clipping top/bottom on `667x375`.
- **DO** reset `dialog.scrollTop = 0` immediately after `showModal()` and focus the initial safe action with `{ preventScroll: true }`.
- **DO** combine `closedby="any"` with a lightweight backdrop click coordinate fallback for Safari versions without `closedby` support.
- **DON'T** default focus onto destructive confirmation buttons (`Delete`, `End session`) — default focus to `Cancel` or close.

## Common Failure Modes

- A vertically stacked QR dialog fits fine at `390x844`, but on `667x375` its title and close button clip above `y = 0` because flex centering (`align-items: center`) overflows symmetrically upward and downward.
- Focusing a footer button on open scrolls the dialog body down 120px, hiding the top instructions.
- `dialog.scrollWidth > dialog.clientWidth` inside an open modal on `360x640` because an inner input or long URL lacks `min-width: 0`.

## Playwright Verification Recipe

```js
// Open modal on both 360x640 and 667x375 and assert full viewport containment + zero inner overflow
await page.locator('[data-testid="open-dialog"]').click();
const dlg = await page.evaluate(() => {
  const el = document.querySelector("dialog[open]");
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    top: Math.round(r.top),
    left: Math.round(r.left),
    right: Math.round(r.right),
    bottom: Math.round(r.bottom),
    vw: window.innerWidth,
    vh: window.innerHeight,
    scrollTop: el.scrollTop,
    innerOverflowX: Math.round(el.scrollWidth - el.clientWidth),
  };
});
expect(dlg).not.toBeNull();
expect(dlg.top).toBeGreaterThanOrEqual(-1);
expect(dlg.left).toBeGreaterThanOrEqual(-1);
expect(dlg.right).toBeLessThanOrEqual(dlg.vw + 1.5);
expect(dlg.bottom).toBeLessThanOrEqual(dlg.vh + 1.5);
expect(dlg.innerOverflowX).toBeLessThanOrEqual(1);
await page.keyboard.press("Escape");
```

## Related guides

- `short-landscape-and-keyboard-guard`
- `ime-and-keyboard-focus-safety`
- `popovers-dropdowns-and-select-bounds`
- `scroll-containment-and-anti-bounce`
