---
id: cards-lists-and-detail-disclosure
category: overlays-components
title: Scannable Mobile Lists, Progressive Disclosure, and Detail Drawers
description: Keep list rows uncluttered, fold infrequent mutation forms into native disclosures, and order detail panels BLUF-first for fast mobile scanning.
keywords: [cards, lists, disclosure, details, bluf, pagination, kpi, mobile-list, drawer, compaction]
appliesTo: [html, css, ux, playwright]
---

# Scannable Mobile Lists, Progressive Disclosure, and Detail Drawers

## Invariants (DO / DON'T)

- **DO** keep list rows scannable with one clean primary click target opening a responsive sheet/detail view, consolidating secondary row actions into a single overflow popover menu.
- **DO** group mobile KPI summaries into compact 2-column grids and fold filter controls into a collapsible panel (`<details>` or explicit toggle) on phones.
- **DO** fold infrequent mutation forms (rename, regenerate recovery codes, destructive actions) inside native `<details>` disclosures so initial mobile page height stays compact (`<= ~2200-2800px` with realistic populated lists).
- **DO** order detail drawers **BLUF-first** (Bottom Line Up Front: key points -> primary actionable artifact like code/diagram/CTA -> secondary prose inside `<details>`).
- **DON'T** split overlapping information into two separate mutually-exclusive buttons/drawers (e.g., `Details` + `Diagram`) that confuse mobile users and duplicate headers.

## Common Failure Modes

- Every list row renders 4 inline buttons on `360x640`, pushing titles into 1-word vertical columns.
- In-page jump links (`#security-recovery`) scroll to a collapsed `<details>` section without opening it first, leaving users staring at a closed summary header.
- Populated 20-row history or ledger list renders unpaginated and uncollapsed, ballooning mobile `scrollHeight` past `6000px`.

## Playwright Verification Recipe

```js
// Verify mobile initial height stays disciplined and jump links auto-open target disclosures
const height = await page.evaluate(() => document.documentElement.scrollHeight);
expect(height).toBeLessThanOrEqual(2800);

// Click a jump link targeting a <details> card and verify it opens
await page.locator('a[href="#security-recovery"]').click();
const isOpen = await page.locator("#security-recovery").evaluate((el) =>
  el.tagName === "DETAILS" ? el.open : Boolean(el.closest("details")?.open ?? true)
);
expect(isOpen).toBe(true);
```

## Related guides

- `above-the-fold-height-budget`
- `responsive-tables-and-long-tokens`
- `adversarial-data-and-empty-dense-states`
