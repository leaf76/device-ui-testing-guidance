---
id: scroll-containment-and-anti-bounce
category: input-ergonomics
title: Scroll Containment, Anti-Bounce, and Streaming Non-Fighting Scroll
description: Prevent scroll chaining in modals and split panes, stop live updates or timers from yanking mobile users back to top, and keep scrollable code regions keyboard-accessible.
keywords: [scroll, overscroll-behavior, touch-action, bounce, streaming, sticky, pull-to-refresh, keyboard-scroll]
appliesTo: [css, js, mobile, playwright]
---

# Scroll Containment, Anti-Bounce, and Streaming Non-Fighting Scroll

## Invariants (DO / DON'T)

- **DO** apply `overscroll-behavior: contain` on modal dialogs, drawers, sidebars, and independent split-pane scrollers so scrolling to the end does not chain to the body or trigger accidental mobile pull-to-refresh.
- **DO** apply `touch-action: pan-y` on vertical feed/stream panes that live inside horizontal swipe shells so vertical reading stays crisp.
- **DO** separate "scroll to latest newly arrived item" from periodic UI/timer refreshes: never call `scrollTop = 0` or `scrollIntoView()` on 1-second timer ticks or incremental token updates while the user is reading scrolled content.
- **DO** add `tabindex="0"` and `role="region"` (with `aria-label`) to horizontally or vertically scrollable `<pre>` / code / diagram containers so keyboard-only users can scroll them with Arrow keys.
- **DON'T** nest two vertical scroll containers inside one compact mobile drawer (e.g., scrollable summary inside scrollable container) — unify into a single bounded scroll region (`max-height: 36-40dvh`).

## Common Failure Modes

- A live transcript or chat feed snaps back to the top every 1 second because a layout sync helper runs inside the session clock tick.
- Scrolling inside an open `<dialog>` on iOS drags the background page behind the backdrop.
- Code or ASCII diagram overflows inside a detail drawer with no `tabindex="0"`, locking keyboard users out of reading the right half.

## Playwright Verification Recipe

```js
// Verify a scroller retains user scroll position across live updates
const scroller = page.locator(".feed-scroll");
await scroller.evaluate((el) => { el.scrollTop = 180; });
await page.waitForTimeout(1500); // allow timer/polling tick
const afterTop = await scroller.evaluate((el) => el.scrollTop);
expect(afterTop).toBeGreaterThanOrEqual(160);

// Verify scrollable pre/code blocks are keyboard focusable
const unfocusableScrollables = await page.evaluate(() => {
  return [...document.querySelectorAll("pre, .code-scroll")]
    .filter((el) => el.scrollWidth > el.clientWidth + 2 && el.tabIndex < 0)
    .map((el) => el.className || el.tagName);
});
expect(unfocusableScrollables).toEqual([]);
```

## Related guides

- `dialogs-and-drawers-on-tight-screens`
- `above-the-fold-height-budget`
- `ime-and-keyboard-focus-safety`
