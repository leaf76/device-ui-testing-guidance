---
id: ime-and-keyboard-focus-safety
category: input-ergonomics
title: CJK IME Enter Safety and Keyboard Focus Management
description: Prevent premature Enter/Escape submission during CJK IME composition, preserve scroll position on programmatic focus, and verify visible keyboard focus rings.
keywords: [ime, composing, compositionend, cjk, enter, escape, focus, preventScroll, focus-visible, keyboard]
appliesTo: [js, html, accessibility, playwright]
---

# CJK IME Enter Safety and Keyboard Focus Management

## Invariants (DO / DON'T)

- **DO** guard `Enter` and `Escape` handlers on search inputs, chat boxes, and inline rename fields with `event.isComposing || event.keyCode === 229` PLUS a short (`~50ms`) post-`compositionend` timestamp window (Safari fires `keydown(Enter)` right after `compositionend`).
- **DO** call `element.focus({ preventScroll: true })` when programmatically focusing controls inside freshly opened `<dialog>`s or drawers so browsers do not yank `scrollTop` down and clip the modal header on short viewports.
- **DO** preserve clear `:focus-visible` outlines on every interactive element; never write `outline: none` without a high-contrast replacement ring.
- **DO** verify focus restores cleanly to the trigger button when closing a modal, drawer, or popover via `Escape` or Close.
- **DON'T** bind single-character global shortcuts (like `/`, `j`, `k`) without ignoring events originating from `input`, `textarea`, `select`, or `[contenteditable="true"]`.

## Common Failure Modes

- Pressing `Enter` to confirm Chinese/Japanese Zhuyin/Pinyin/Kana candidate selection immediately submits an incomplete search or chat message on macOS Safari or Windows IME.
- Opening a tall `<dialog>` on `667x375` focuses a button near the bottom, causing the browser to scroll the dialog past its title and close button.
- Typing `/` inside a search input hijacks focus or prevents typing URLs.

## Playwright Verification Recipe

```js
// Verify IME composition Enter does not prematurely submit
await page.locator('input[type="search"]').focus();
const submitted = await page.evaluate(() => {
  let count = 0;
  const form = document.querySelector("form");
  form?.addEventListener("submit", (e) => { e.preventDefault(); count++; });
  const input = document.querySelector('input[type="search"]');
  input.dispatchEvent(new CompositionEvent("compositionstart"));
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true }));
  input.dispatchEvent(new CompositionEvent("compositionend"));
  return count;
});
expect(submitted).toBe(0);
```

## Related guides

- `dialogs-and-drawers-on-tight-screens`
- `bilingual-cjk-latin-expansion`
- `scroll-containment-and-anti-bounce`
