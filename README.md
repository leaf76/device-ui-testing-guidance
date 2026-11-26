# Device UI Testing Guidance

**Structured multi-device frontend testing guidance, static CSS/HTML pitfall scanner, and headless 9-viewport Playwright auditor for AI coding agents.**

While platform authoring skills focus on *how to write* modern HTML/CSS/JS, **Device UI Testing Guidance** focuses on *how to prove* a web UI actually survives real devices, tight screen geometries, touch ergonomics, adversarial data, bilingual copy, themes, and interactive overlays.

## What's Included

- **Progressive-disclosure Agent Skill** (`skills/device-ui-testing-guidance/SKILL.md`): Thin entrypoint with strict trigger rules so agents pull only the relevant testing guides on demand.
- **26 Curated Testing Guides** across 6 disciplines:
  - `viewports` — 9-viewport matrix, foldable cover & unfolded screens + live transitions/hinge posture, short landscape vs. portrait keyboard traps, `dvh`/safe-area insets, split-screen & tablet dead zones.
  - `layout` — Anti-band-aid overflow & bounding-box clipping, toolbar crowding/overlap, above-the-fold height budgets, responsive tables & long tokens.
  - `input-ergonomics` — `pointer: coarse` touch targets (`>= 44px`), iOS `16px` anti-zoom inputs, scroll containment & anti-bounce, CJK IME & focus safety.
  - `overlays-components` — `<dialog>` & drawers on short landscape (`667x375`), popovers/dropdowns/select bounds, horizontal checkbox & `[hidden]` specificity, scannable cards/disclosures.
  - `usage-scenarios` — Adversarial long strings & empty/dense/completed states, bilingual CJK/Latin expansion, light/dark/forced-colors/200% zoom/reduced-motion, PWA standalone & resilient sessions.
  - `execution` — Headless non-focus-stealing Playwright contract, geometry assertion thresholds & severity rubric, visual screenshot triage, static rule verification rubrics.
- **Zero-Dependency Node CLI** (`bin/device-ui-testing-guidance.mjs`):
  - `search "<query>"` — Weighted keyword & synonym lookup across all guides.
  - `retrieve "<id1>,<id2>"` — Retrieve full guides (auto-spills large bundles to a temp file to avoid truncation).
  - `list` — Compact catalog grouped by category.
  - `static-scan <path>` — 12 deterministic CSS/HTML anti-pattern checks with `keepWhen`/`dropWhen` rubrics.
  - `audit <url>` — Headless Playwright multi-viewport geometry, ergonomics, foldable transition, hinge posture, overlay, and screenshot auditor.
- **Multi-Agent Packaging**: Includes manifests for Antigravity (`plugin.json`), Claude Code (`.claude-plugin/`), Codex (`.codex-plugin/`), Cursor (`.cursor-plugin/`), Gemini CLI (`gemini-extension.json`), and `.agents/plugins/marketplace.json`.

## Quickstart

Requires **Node.js >= 20**. Zero runtime dependencies are required for `search`, `retrieve`, `list`, and `static-scan`. The `audit` subcommand dynamically loads `playwright` (or `playwright-core`) from your project or `--playwright-from`.

```sh
# Run directly via npx (zero install required)
npx -y device-ui-testing-guidance@latest search "short landscape dialog clipping"

# Retrieve one or more guides
npx -y device-ui-testing-guidance@latest retrieve "dialogs-and-drawers-on-tight-screens,short-landscape-and-keyboard-guard"

# List all 26 guides
npx -y device-ui-testing-guidance@latest list

# Static-scan CSS/HTML/TSX for responsive pitfalls
npx -y device-ui-testing-guidance@latest static-scan ./src --json

# Run full 9-viewport headless Playwright audit (light + dark)
npx -y device-ui-testing-guidance@latest audit http://127.0.0.1:4173 \
  --preset full \
  --themes light,dark \
  --out ./.audit-out

# Run foldable cover + unfolded + live fold/unfold transition checks
npx -y device-ui-testing-guidance@latest audit http://127.0.0.1:4173 \
  --preset foldable \
  --themes light,dark \
  --out ./.audit-out

# Run all 14 viewports (9 standard + 5 foldable) with live fold transitions
npx -y device-ui-testing-guidance@latest audit http://127.0.0.1:4173 \
  --preset all \
  --fold-transitions \
  --out ./.audit-out
```

## Default 9-Viewport Responsive Matrix

| Key | Label | Size (CSS px) | Device Flags | Primary Risk Caught |
|---|---|---|---|---|
| `phone-compact-portrait` | Compact Phone Portrait | `360x640` | `isMobile`, `hasTouch` | Cramped headers, select clipping, fold crowding |
| `phone-portrait` | Mainstream Phone Portrait | `390x844` | `isMobile`, `hasTouch` | Touch target size, iOS `<16px` zoom, card wrapping |
| `phone-short-landscape` | Short Phone Landscape | `667x375` | `isMobile`, `hasTouch` | Dialog top-clipping, cramped vertical reading area |
| `phone-landscape` | Mainstream Phone Landscape | `844x390` | `isMobile`, `hasTouch` | Two-column balance, safe-area side insets |
| `laptop-half-split` | Laptop Half-Split | `640x800` | Desktop pointer | Awkward breakpoint dead-zone, toolbar wrapping |
| `tablet-portrait` | Tablet Portrait | `768x1024` | `isMobile`, `hasTouch` | Mid-width grid collisions, quickbar edge clipping |
| `tablet-landscape` | Tablet Landscape | `1024x768` | `isMobile`, `hasTouch` | Sidebar + main pane squeeze, table columns |
| `laptop` | Laptop | `1280x800` | Desktop pointer | Above-the-fold density, action row alignment |
| `desktop` | Desktop | `1440x900` | Desktop pointer | Max-width measure, wide table symmetry |

## Foldable Device Viewport Matrix (`--preset foldable`, `--preset foldable-hinge`, `--preset all`)

| Key | Label | Size (CSS px) | State / Flags | Primary Risk Caught |
|---|---|---|---|---|
| `fold-cover-portrait` | Foldable Cover Screen Portrait | `344x882` | Closed cover, touch | 16px narrower than `360px`; button/select clipping, `350px+` fixed widths |
| `fold-cover-landscape` | Foldable Cover Screen Landscape | `882x344` | Closed cover, touch | Ultra-short `344px` height; dialog/header vertical crowding |
| `flip-cover` | Clamshell Flip Cover Screen | `360x374` | Closed cover, touch | Compact near-square FlexWindow; fold budget & overlay overflow |
| `fold-unfolded-portrait` | Foldable Unfolded Inner Portrait | `712x776` | Unfolded flat, touch | Near-1:1 screen just under `768px` breakpoint |
| `fold-unfolded-landscape` | Foldable Unfolded Inner Landscape | `776x712` | Unfolded flat, touch | Just over `768px` while still `pointer: coarse` touch |
| `fold-half-book` | Half-Folded Book Posture | `776x712` | Vertical hinge (`376..400px`) | Controls/modals spanning center hinge (`--preset foldable-hinge`) |
| `fold-half-tabletop` | Half-Folded Tabletop Posture | `712x776` | Horizontal hinge (`376..400px`) | Controls/modals spanning horizontal crease (`--preset foldable-hinge`) |

## Local Plugin Install (Antigravity)

```sh
npm run install:local
```

This mirrors the runtime plugin bundle into `~/.gemini/config/plugins/device-ui-testing-guidance/` (excluding `.git/` and `test/`).

## Tests

```sh
npm test
```

## License

MIT
