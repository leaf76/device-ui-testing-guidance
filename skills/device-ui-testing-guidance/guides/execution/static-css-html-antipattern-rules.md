---
id: static-css-html-antipattern-rules
category: execution
title: Static CSS and HTML Anti-Pattern Rules and False-Positive Rubric
description: Reference for the 12 deterministic rules checked by static-scan, including keepWhen and dropWhen criteria to separate real device bugs from intentional fallbacks.
keywords: [static-scan, lint, css, html, antipattern, false-positive, keepWhen, dropWhen, rules]
appliesTo: [css, html, execution]
---

# Static CSS and HTML Anti-Pattern Rules and False-Positive Rubric

## Invariants (DO / DON'T)

- **DO** run `static-scan <path> --json` before or alongside Playwright audits to catch high-confidence responsive anti-patterns in milliseconds.
- **DO** evaluate every finding against its `keepWhen` / `dropWhen` rubric before editing code — never blindly delete valid fallback declarations just to force zero warnings.
- **DON'T** treat `static-scan` as a replacement for live multi-viewport Playwright audits; static scans catch structural CSS/HTML hazards, while Playwright proves rendered geometry.

## Rule Catalog (12 Rules)

| Rule ID | Severity | Linked Guide | Keep When (`keepWhen`) | Drop When (`dropWhen`) |
|---|---|---|---|---|
| `overflow-x-body-mask` | `error` | `zero-overflow-and-clipping-scan` | `html` or `body` applies `overflow-x: hidden\|clip` to suppress horizontal scrollbars | Scoped solely to an inner decorative hero/canvas wrapper (not `html`/`body`) |
| `raw-100vh` | `warn` | `dynamic-viewport-and-safe-area` | `100vh` is used for full-height shells/drawers without a paired `100dvh`/`100svh` override | `100vh` immediately precedes a `100dvh`/`100svh` progressive enhancement line |
| `unbounded-landscape-mq` | `warn` | `short-landscape-and-keyboard-guard` | `@media (orientation: landscape)` switches mobile layout without `max-height` and `min-width` guards | Only used for desktop/print rules or already paired with `min-width` + `max-height` |
| `ios-sub16px-input` | `error` | `ios-input-zoom-and-form-ergonomics` | `input`/`select`/`textarea` sets `font-size < 16px` globally or on mobile viewports | Strictly inside a desktop-only `@media (min-width: 768px+)` or `(pointer: fine)` block |
| `viewport-zoom-disabled` | `error` | `dynamic-viewport-and-safe-area` | `<meta name="viewport">` contains `user-scalable=no/0` or `maximum-scale=1` | Never acceptable for general web UI |
| `missing-viewport-fit-cover` | `warn` | `dynamic-viewport-and-safe-area` | Project uses `env(safe-area-inset-*)` in CSS while `<meta name="viewport">` omits `viewport-fit=cover` | Pure library component package without an HTML shell |
| `unclamped-vw-font` | `warn` | `themes-contrast-zoom-and-motion` | `font-size` uses bare `vw`/`vi` without `clamp()` | Decorative oversized watermark `aria-hidden="true"` text |
| `flex-grid-missing-hidden-guard` | `warn` | `forms-checkbox-and-hidden-specificity` | Codebase toggles `hidden` attribute on elements styled with `display: flex\|grid` without a `[hidden] { display: none }` reset | Stylesheet already defines global `[hidden] { display: none !important; }` |
| `fixed-pixel-width-risk` | `warn` | `responsive-tables-and-long-tokens` | Unscoped `width` or `min-width >= 350px` outside `@media (min-width: ...)` can overflow `344px` foldable cover screens and `360px` phones | Inside `@media (min-width: ...)` or capped by `max-width: 100%` |
| `hover-only-critical-reveal` | `warn` | `touch-targets-and-coarse-pointer` | `:hover` toggles visibility/opacity/display of interactive controls without `@media (hover: hover)` or `:focus-within` | Purely visual hover highlight (color/background/shadow) that keeps control visible |
| `legacy-screen-spanning-mq` | `warn` | `foldable-transitions-and-hinge-posture` | CSS uses obsolete `@media (screen-spanning: ...)` or `env(fold-*)` | Paired alongside standardized `viewport-segments` in the same query as an intentional fallback |
| `viewport-segment-no-fallback` | `warn` | `foldable-transitions-and-hinge-posture` | `env(viewport-segment-*)` lacks a comma fallback and sits outside `@media (horizontal/vertical-viewport-segments)` | Includes `env(..., <fallback>)` or lives inside a `viewport-segments` media block |

## Playwright Verification Recipe

```sh
node bin/device-ui-testing-guidance.mjs static-scan ./src --json
```

## Related guides

- `zero-overflow-and-clipping-scan`
- `dynamic-viewport-and-safe-area`
- `short-landscape-and-keyboard-guard`
- `ios-input-zoom-and-form-ergonomics`
- `forms-checkbox-and-hidden-specificity`
- `touch-targets-and-coarse-pointer`
- `foldable-transitions-and-hinge-posture`
