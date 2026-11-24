---
id: toolbar-crowding-and-overlap-audit
category: layout
title: Toolbar Crowding, Action Row Wrapping, and Sibling Overlap Audit
description: Detect overlapping buttons, clipped labels, and unintended multi-line wrapping inside headers, toolbars, tabs, and card action rows across tight viewports.
keywords: [toolbar, crowding, overlap, wrap, header, action-bar, truncation, buttons, chips]
appliesTo: [css, playwright, layout]
---

# Toolbar Crowding, Action Row Wrapping, and Sibling Overlap Audit

## Invariants (DO / DON'T)

- **DO** cap top session/page headers to at most 3-4 primary interactive controls; consolidate secondary actions into a single overflow popover menu (`...`).
- **DO** check pairwise bounding-box intersections among visible interactive siblings (`button`, `a`, `select`, `input`, `[role="tab"]`) and fail if any pair overlaps by `> 4px` on both axes.
- **DO** check `el.scrollWidth > el.clientWidth + 2` on clipped interactive controls (`overflow: hidden`) so labels like `Speaker 2 ▾` or `Auto-detect` never silently lose characters on `360x640` or `667x375`.
- **DO** check single-row toolbars (`flex-wrap: nowrap` vs unintended wrapping) by verifying child vertical centers stay aligned or wrap cleanly with deliberate `gap`.
- **DON'T** pack icons + long text labels + badges into narrow `< 300px` split-pane toolbars; hide decorative button icons or shorten micro-copy at tight breakpoints while preserving `aria-label`.

## Common Failure Modes

- Adding a 5th action button to a desktop table row or header causes buttons to collide or wrap raggedly on `1024x768` and `1280x800`.
- A `<select>` paired with adjacent icon buttons shrinks until its selected text truncates to 2 letters on `360x640`.
- Sticky save bar overlaps the bottom of a form card when `padding-bottom` fails to account for bar height.

## Playwright Verification Recipe

```js
const overlaps = await page.evaluate(() => {
  const nodes = [...document.querySelectorAll("button, a[href], select, input:not([type='hidden']), [role='tab']")]
    .filter((el) => {
      if (el.closest("dialog:not([open]), [hidden]")) return false;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return s.display !== "none" && s.visibility !== "hidden" && r.width > 2 && r.height > 2;
    });
  const hits = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (nodes[i].contains(nodes[j]) || nodes[j].contains(nodes[i])) continue;
      const a = nodes[i].getBoundingClientRect();
      const b = nodes[j].getBoundingClientRect();
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 4 && oy > 4) hits.push({ a: nodes[i].textContent?.trim(), b: nodes[j].textContent?.trim(), ox, oy });
    }
  }
  return hits;
});
expect(overlaps).toEqual([]);
```

## Related guides

- `zero-overflow-and-clipping-scan`
- `above-the-fold-height-budget`
- `bilingual-cjk-latin-expansion`
- `geometry-assertions-and-severity-rubric`
