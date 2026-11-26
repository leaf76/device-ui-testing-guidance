---
id: foldable-transitions-and-hinge-posture
category: viewports
title: Foldable Live Fold/Unfold Transitions and Hinge Posture Testing
description: Verify live same-session cover-to-unfolded resize continuity, open overlay re-clamping, standardized viewport-segments CSS, and half-folded hinge obstruction avoidance.
keywords: [foldable, transition, resize, hinge, posture, segments, viewport-segments, cdp, dual-screen]
appliesTo: [playwright, css, js]
---

# Foldable Live Fold/Unfold Transitions and Hinge Posture Testing

## Invariants (DO / DON'T)

- **DO** test live in-session transitions (`344x882` -> `712x776` -> `344x882` and `776x712` -> `344x882`) via `page.setViewportSize()` without reloading the page; real foldable users open and close their device mid-task.
- **DO** re-evaluate JS-computed widths, popovers, drawers, and open `<dialog>` bounds on `resize` / `ResizeObserver` events rather than caching `window.innerWidth` once at mount.
- **DO** use the standardized CSS Viewport Segments & Device Posture APIs (`@media (horizontal-viewport-segments: 2)`, `@media (vertical-viewport-segments: 2)`, `env(viewport-segment-width 0 0, <fallback>)`) with safe single-screen fallbacks instead of legacy `@media (screen-spanning: ...)` or `env(fold-*)`.
- **DO** keep interactive controls, primary buttons, and open modals out of the center hinge band (`~376-400px`) in half-folded `fold-half-book` and `fold-half-tabletop` postures by placing panes inside segment bounds or centering within a single segment.
- **DON'T** emit bare `env(viewport-segment-width 0 0)` outside `@media (horizontal-viewport-segments: 2)` without a comma fallback; non-foldable browsers evaluate it as `invalid at computed-value time`.

## Common Failure Modes

- A chart, virtualized list, or sidebar measures `window.innerWidth` at load on `776x712` unfolded screen, then overflows `432px` off-screen when the user folds shut to `344x882`.
- An open `<dialog>` or dropdown stays pinned to old unfolded coordinates after folding to cover mode.
- Half-folded book mode places a centered modal or primary CTA directly across the physical hinge gap (`376px..400px`).

## Playwright Verification Recipe

```sh
# Run foldable matrix + live fold/unfold transitions + half-folded hinge posture checks
node bin/device-ui-testing-guidance.mjs audit http://127.0.0.1:4173 \
  --preset foldable-hinge \
  --fold-transitions \
  --out ./.audit-out
```

```js
// Custom same-session open-modal + unfold -> refold check via --actions JSON:
[
  { "name": "open-modal", "type": "click", "selector": "#open-clean-dialog", "audit": true },
  { "name": "unfold-inner", "type": "resize", "width": 712, "height": 776, "audit": true },
  { "name": "refold-cover", "type": "resize", "width": 344, "height": 882, "audit": true }
]
```

## Related guides

- `foldable-cover-and-unfolded-screens`
- `responsive-viewport-matrix`
- `geometry-assertions-and-severity-rubric`
- `static-css-html-antipattern-rules`
