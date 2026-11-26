---
id: foldable-cover-and-unfolded-screens
category: viewports
title: Foldable Cover (Closed) and Unfolded Inner Screen Testing
description: Test foldable phones in both folded cover states (344x882, 882x344, 360x374 flip) and unfolded square-tablet inner states (712x776, 776x712) where 768px breakpoints split awkwardly.
keywords: [foldable, cover, unfolded, 344x882, 882x344, 712x776, 776x712, 360x374, flip, zfold]
appliesTo: [playwright, css, rwd]
---

# Foldable Cover (Closed) and Unfolded Inner Screen Testing

## Invariants (DO / DON'T)

- **DO** test both folded cover screens (`344x882` portrait, `882x344` landscape, `360x374` clamshell flip cover) AND fully unfolded inner screens (`712x776` portrait, `776x712` landscape) with `isMobile: true, hasTouch: true`:
  - `fold-cover-portrait` (`344x882`): 16px narrower than compact `360x640` phones; catches `350px-399px` fixed widths, clipped selects, and cramped action bars.
  - `fold-cover-landscape` (`882x344`): 31px shorter than `667x375` short landscape; catches vertical modal/header overflow and squeezed primary fold budgets.
  - `flip-cover` (`360x374`): ultra-short square clamshell cover; verifies primary controls and dialogs remain usable without desktop sidebars or overflowing headers.
  - `fold-unfolded-portrait` (`712x776`) & `fold-unfolded-landscape` (`776x712`): near-1:1 square touch tablets straddling the `768px` breakpoint (`712px` just below, `776px` just above).
- **DO** use fluid grids (`repeat(auto-fit, minmax(min(260px, 100%), 1fr))`), CSS `@container` queries, and `max-width: 100%` guards instead of hardcoding `768px` as a cliff between single-column mobile and desktop multi-column layouts.
- **DO** keep `@media (pointer: coarse)` touch targets (`>= 44px`) and `16px` mobile form inputs active on unfolded `776x712` viewports — unfolded foldables remain touch-first devices.
- **DON'T** assume passing `360x640` guarantees safety on narrow foldable outer screens (`344px`), or assume passing `768x1024` guarantees safety on near-square inner screens (`712x776` / `776x712`).

## Common Failure Modes

- A `356px`-wide card or modal that passes `360x640` overflows `344x882` cover screens horizontally.
- Turning the foldable inner screen from `712x776` (portrait) to `776x712` (landscape) crosses a `@media (min-width: 768px)` rule that suddenly enables hover-only desktop menus or tiny `13px` inputs.
- Fixed header + promo banner + toolbar leaves `< 180px` visible primary content on `360x374` flip cover or `882x344` cover landscape.

## Playwright Verification Recipe

```sh
# Audit all 5 folded cover & unfolded inner viewports (plus live transitions)
node bin/device-ui-testing-guidance.mjs audit http://127.0.0.1:4173 \
  --preset foldable \
  --themes light,dark \
  --primary-selector "main" \
  --out ./.audit-out
```

## Related guides

- `responsive-viewport-matrix`
- `foldable-transitions-and-hinge-posture`
- `split-screen-and-tablet-breakpoints`
- `short-landscape-and-keyboard-guard`
