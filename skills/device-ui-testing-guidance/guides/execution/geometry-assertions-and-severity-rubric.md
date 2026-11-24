---
id: geometry-assertions-and-severity-rubric
category: execution
title: Geometry Assertions and PASS / WARN / FAIL Severity Rubric
description: Define objective numerical thresholds for overflow, edge clipping, sibling overlaps, clipped text, touch targets, iOS zoom, overlays, and fold height budgets.
keywords: [assertions, thresholds, severity, fail, warn, pass, rubric, metrics, geometry, audit]
appliesTo: [playwright, execution, testing]
---

# Geometry Assertions and PASS / WARN / FAIL Severity Rubric

## Invariants (DO / DON'T)

- **DO** classify every automated audit finding into explicit `FAIL` (must fix before shipping) vs `WARN` (review & fix or justify):

| Check | `FAIL` Threshold | `WARN` Threshold | Notes / Exemptions |
|---|---|---|---|
| Console / Page errors | `>= 1` uncaught `pageerror` or console `error` | Failed `>= 400` subresource | Ignore explicitly allowlisted third-party challenge scripts if needed |
| Document horizontal overflow | `scrollWidth - expectedWidth > 1` or mobile shrink-to-fit inflates `innerWidth > expectedWidth + 1` | Root `html`/`body` sets `overflow-x: hidden\|clip` | Root masking hides clipping bugs; mobile shrink-to-fit fakes `scrollWidth === innerWidth` |
| Visible element edge clipping | `rect.right > min(innerWidth, expectedWidth) + 1.5` or `rect.left < -1.5` | — | Skip closed `<dialog>`, `[hidden]`, `[aria-hidden="true"]`, descendants of `[data-scroll-strip]`/`pre`/`.table-wrapper` |
| Interactive sibling overlap | Two visible unrelated interactive controls overlap `> 4px` on both X and Y | — | Skip ancestor/descendant pairs |
| iOS input auto-zoom (touch) | Visible `input`/`select`/`textarea` computed `fontSize < 15.9px` | — | Runs on `isMobile: true` viewports |
| Touch target size (touch) | Interactive control `< 32px` on width or height | `< 44px` on width or height | Exempt inline `<a>` links inside `<p>`/`<li>` prose |
| Clipped control label | — | Visible `button`/`select`/`[role="tab"]` with `scrollWidth > clientWidth + 2` | Escalate to `FAIL` when core CTA/nav text is cut off |
| Open `<dialog>` / `[popover]` bounds | Any edge outside `[-1, vw+1.5]` / `[-1, vh+1.5]` or inner `scrollWidth > clientWidth + 1` | — | Check in both portrait & `667x375` short landscape |
| Above-the-fold primary budget | — | Primary surface starts below `45%` of `innerHeight` or has `< 180px` visible on short screens | Pass `--primary-selector` for dense apps |
| `[hidden]` attribute leak | Any `[hidden]` node with `display !== "none"` | — | Catches `display: flex\|grid` overriding `[hidden]` |

- **DO** mark intentional horizontal carousels, chip strips, and scrollable code/table wrappers with `data-scroll-strip` so audits separate intentional horizontal scrolling from accidental overflow.
- **DON'T** weaken thresholds globally to silence one broken component — fix the CSS or explicitly scope the exemption.

## Common Failure Modes

- Treating `WARN` items as invisible noise allows 36px touch targets and clipped English `<select>` labels to accumulate across releases.
- Forgetting to exempt inline prose `<a>` links creates dozens of false-positive touch-target warnings in articles and footers.

## Playwright Verification Recipe

```sh
# Run the bundled CLI auditor with structured JSON + Markdown reports
node bin/device-ui-testing-guidance.mjs audit http://127.0.0.1:4173 \
  --preset full \
  --themes light,dark \
  --primary-selector "main" \
  --out ./.audit-out \
  --json
```

## Related guides

- `zero-overflow-and-clipping-scan`
- `toolbar-crowding-and-overlap-audit`
- `touch-targets-and-coarse-pointer`
- `visual-screenshot-triage-workflow`
