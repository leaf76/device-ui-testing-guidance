# device-ui-testing-guidance — Repository Invariants

- **Zero runtime dependencies**: `bin/` and `lib/` MUST run with Node.js >= 20 standard library only. Never add mandatory npm dependencies to `package.json`. `playwright` / `playwright-core` is loaded dynamically only by the `audit` subcommand.
- **Guide contract (`skills/device-ui-testing-guidance/guides/<category>/<id>.md`)**:
  - Every guide MUST have YAML frontmatter with `id`, `category`, `title`, `description`, `keywords`, and `appliesTo`.
  - Every guide `id` MUST match its filename stem and be globally unique across all categories.
  - Every cross-referenced guide ID (backticked under `## Related guides`) MUST exist and is verified by `npm test`.
  - Keep guides concise, actionable, and token-efficient (invariants, root causes, Playwright assertions — no filler prose).
- **Static scanner discipline (`lib/static-scan.mjs`)**: Every rule MUST include a linked `guideId`, `keepWhen`, and `dropWhen` false-positive rubric, plus positive and negative test coverage in `test/static-scan.test.mjs`.
- **Headless non-focus-stealing auditor (`lib/audit.mjs`)**: Always run `headless: true` (never `--headed`), prefer system Chrome (`channel: "chrome"`) with fallback to `"msedge"` and bundled Chromium, set `isMobile: true, hasTouch: true` on mobile/tablet viewports, and never rely solely on `documentElement.scrollWidth` (always run bounding-box right/left clipping scans).
- **Local plugin sync**: Keep this repository as SSOT; run `npm run install:local` to mirror runtime files (`plugin.json`, `package.json`, `assets/`, `bin/`, `lib/`, `skills/`, `README.md`, `LICENSE`) into `~/.gemini/config/plugins/device-ui-testing-guidance/` without `.git/` or `test/`.
- **Verification command**: Run `npm test` after any code, guide, or manifest edit.
