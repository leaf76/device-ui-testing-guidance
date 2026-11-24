---
id: adversarial-data-and-empty-dense-states
category: usage-scenarios
title: Adversarial Data Fixtures and Empty / Dense / Completed States
description: Stress-test UI components with 55+ character slugs, UUIDs, emails, 90+ character URLs, IPv6, empty states, 20+ item dense lists, loading skeletons, and completed-state compaction.
keywords: [adversarial, fixtures, long-strings, empty-state, dense, skeleton, error-state, completed, stress-test]
appliesTo: [playwright, ux, testing]
---

# Adversarial Data Fixtures and Empty / Dense / Completed States

## Invariants (DO / DON'T)

- **DO** seed local UI verification fixtures with realistic worst-case strings before running viewport audits:
  - 55+ character slugs (`cross-machine-agent-memory-tailscale-honcho-antigravity`)
  - 55+ character email addresses (`engineering.alerts.notifications+production@sub.example.com`)
  - 36-character UUIDs and full IPv6 addresses (`2001:0db8:85a3:0000:0000:8a2e:0370:7334`)
  - 90+ character URLs with UTM query parameters
  - Multi-paragraph descriptions alongside 1-word items in the same grid
- **DO** verify all five lifecycle states on tight viewports (`360x640`, `667x375`, `1280x800`):
  1. **Empty** (0 records, clear reset/CTA action)
  2. **Loading** (skeleton placeholders preserving layout height to prevent CLS)
  3. **Populated / Dense** (20+ rows, pagination/expanders, expanded drawers)
  4. **Completed** (checklists/one-time banners hidden or compacted to a single row)
  5. **Error / Degraded** (long error copy, retry button, no unstyled raw stack traces)
- **DON'T** approve a layout verified only against empty state or 3-character placeholder names.

## Common Failure Modes

- Cards align cleanly with `"Alice"` and `"Bob"`, then blow out right edges on production emails or OAuth account IDs.
- Empty state centers a tall illustration with fixed `min-height: 500px`, causing awkward scrolling on `667x375`.
- Completed onboarding card stays rendered in full 4-row expanded form forever, pushing actual settings below the fold.

## Playwright Verification Recipe

```js
// Intercept /api/** with adversarial stress fixtures during local Playwright audits
await page.route("**/api/items*", (route) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      items: Array.from({ length: 20 }, (_, i) => ({
        id: `550e8400-e29b-41d4-a716-4466554400${String(i).padStart(2, "0")}`,
        slug: `cross-machine-agent-memory-tailscale-honcho-antigravity-item-${i}`,
        email: `engineering.alerts.notifications+shard${i}@platform.example.com`,
        url: `https://example.com/zh/blog/cross-machine-agent-memory-guide?utm_source=threads&utm_medium=social&ref=${i}`,
      })),
    }),
  })
);
```

## Related guides

- `responsive-tables-and-long-tokens`
- `zero-overflow-and-clipping-scan`
- `above-the-fold-height-budget`
- `bilingual-cjk-latin-expansion`
