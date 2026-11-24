---
id: responsive-tables-and-long-tokens
category: layout
title: Responsive Data Tables and Unbreakable Long Tokens
description: Keep tables, admin lists, and detail panels overflow-free when seeded with 55+ character slugs, emails, UUIDs, IPv6 addresses, and 90+ character URLs.
keywords: [table, table-fixed, long-string, uuid, url, slug, ipv6, wrapping, card-fallback, min-width]
appliesTo: [css, html, playwright]
---

# Responsive Data Tables and Unbreakable Long Tokens

## Invariants (DO / DON'T)

- **DO** use `table-layout: fixed; width: 100%;` with explicit percentage column widths on desktop tables containing long URLs/slugs plus multi-button action columns.
- **DO** wrap multi-line `<td>` cell contents inside a single inner wrapper (`<div class="cell-stack">`) when transforming table rows into `< 740px` mobile stacked cards so CSS Grid/Flex cell layouts do not split sibling nodes across tracks.
- **DO** apply `min-width: 0` + `overflow-wrap: anywhere` (or intentional `text-overflow: ellipsis` with full-value tooltip/detail drawer) on code tokens, emails, UUIDs, IPv6 addresses, and URLs.
- **DO** assert `wrapper.scrollWidth - wrapper.clientWidth === 0` on responsive tables that claim to adapt without horizontal scrollbars; if a table intentionally scrolls horizontally, mark it with `data-scroll-strip` and provide a visible edge fade or scroll hint.
- **DON'T** test responsive tables using short mock strings (`"test"`, `"a@b.com"`, `"123"`) — realistic 55-90 char unbreakable tokens expose layout blowouts immediately.

## Common Failure Modes

- A 58-character blog slug or 90-character destination URL expands column 1 to `600px`, crushing the 5-button Actions column off the right edge.
- `<td data-label="URL">` with two sibling `<span>` elements splits weirdly under mobile `display: flex; justify-content: space-between` unless wrapped in one container.
- A `.table-wrapper` hides a `140px` horizontal overflow scrollbar on desktop because `table-layout: auto` ignores `max-width`.

## Playwright Verification Recipe

```js
// Assert zero unintended horizontal overflow on responsive table wrappers
const tableOverflow = await page.evaluate(() => {
  return [...document.querySelectorAll(".table-wrapper, table")]
    .filter((el) => !el.matches("[data-scroll-strip]") && !el.closest("[data-scroll-strip]"))
    .map((el) => ({
      tag: el.tagName,
      cls: el.className,
      delta: Math.round(el.scrollWidth - el.clientWidth),
    }))
    .filter((item) => item.delta > 1);
});
expect(tableOverflow).toEqual([]);
```

## Related guides

- `zero-overflow-and-clipping-scan`
- `adversarial-data-and-empty-dense-states`
- `split-screen-and-tablet-breakpoints`
- `cards-lists-and-detail-disclosure`
