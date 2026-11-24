# Device UI Testing Guidance

**Structured multi-device frontend testing guidance, static CSS/HTML pitfall scanner, and headless 9-viewport Playwright auditor for AI coding agents.**

While platform authoring skills focus on *how to write* modern HTML/CSS/JS, **Device UI Testing Guidance** focuses on *how to prove* a web UI actually survives real devices, tight screen geometries, touch ergonomics, adversarial data, bilingual copy, themes, and interactive overlays.

## What's Included

- **Progressive-disclosure Agent Skill** (`skills/device-ui-testing-guidance/SKILL.md`): Thin entrypoint with strict trigger rules so agents pull only the relevant testing guides on demand.
- **24 Curated Testing Guides** across 6 disciplines:
  - `viewports` — 9-viewport matrix, short landscape vs. portrait keyboard traps, `dvh`/safe-area insets, split-screen & tablet dead zones.
  - `layout` — Anti-band-aid overflow & bounding-box clipping, toolbar crowding/overlap, above-the-fold height budgets, responsive tables & long tokens.
  - `input-ergonomics` — `pointer: coarse` touch targets (`>= 44px`), iOS `16px` anti-zoom inputs, scroll containment & anti-bounce, CJK IME & focus safety.
  - `overlays-components` — `<dialog>` & drawers on short landscape (`667x375`), popovers/dropdowns/select bounds, horizontal checkbox & `[hidden]` specificity, scannable cards/disclosures.
  - `usage-scenarios` — Adversarial long strings & empty/dense/completed states, bilingual CJK/Latin expansion, light/dark/forced-colors/200% zoom/reduced-motion, PWA standalone & resilient sessions.
  - `execution` — Headless non-focus-stealing Playwright contract, geometry assertion thresholds & severity rubric, visual screenshot triage, static rule verification rubrics.
- **Zero-Dependency Node CLI** (`bin/device-ui-testing-guidance.mjs`):
  - `search "<query>"` — Weighted keyword & synonym lookup across all guides.
  - `retrieve "<id1>,<id2>"` — Retrieve full guides (auto-spills large bundles to a temp file to avoid truncation).
  - `list` — Compact catalog grouped by category.
  - `static-scan <path>` — 10 deterministic CSS/HTML anti-pattern checks with `keepWhen`/`dropWhen` rubrics.
  - `audit <url>` — Headless Playwright multi-viewport geometry, ergonomics, overlay, and screenshot auditor.
- **Multi-Agent Packaging**: Includes manifests for Antigravity (`plugin.json`), Claude Code (`.claude-plugin/`), Codex (`.codex-plugin/`), Cursor (`.cursor-plugin/`), Gemini CLI (`gemini-extension.json`), and `.agents/plugins/marketplace.json`.

## Quickstart

Requires **Node.js >= 20**. Zero runtime dependencies are required for `search`, `retrieve`, `list`, and `static-scan`. The `audit` subcommand dynamically loads `playwright` (or `playwright-core`) from your project or `--playwright-from`.

```sh
# Run directly from GitHub via npx (or clone and run locally)
npx -y github:leaf76/device-ui-testing-guidance search "short landscape dialog clipping"

# Search relevant device testing guides (local checkout)
node bin/device-ui-testing-guidance.mjs search "short landscape dialog clipping"

# Retrieve one or more guides
node bin/device-ui-testing-guidance.mjs retrieve "dialogs-and-drawers-on-tight-screens,short-landscape-and-keyboard-guard"

# List all guides
node bin/device-ui-testing-guidance.mjs list

# Static-scan CSS/HTML/TSX for responsive pitfalls
node bin/device-ui-testing-guidance.mjs static-scan ./src --json

# Run full 9-viewport headless Playwright audit (light + dark)
node bin/device-ui-testing-guidance.mjs audit http://127.0.0.1:4173 \
  --preset full \
  --themes light,dark \
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
