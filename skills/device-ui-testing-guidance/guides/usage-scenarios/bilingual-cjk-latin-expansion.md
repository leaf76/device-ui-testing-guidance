---
id: bilingual-cjk-latin-expansion
category: usage-scenarios
title: Bilingual CJK vs Latin Text Expansion and Locale Audits
description: Verify tight viewports in every supported locale (e.g. EN and ZH) to catch English button clipping, CJK line-height shifts, select truncation, and emoji/icon drift.
keywords: [i18n, bilingual, cjk, chinese, english, locale, expansion, truncation, wrapping, font]
appliesTo: [css, i18n, playwright]
---

# Bilingual CJK vs Latin Text Expansion and Locale Audits

## Invariants (DO / DON'T)

- **DO** run tight-viewport checks (`360x640`, `667x375`, `768x1024`) in **both** compact CJK (`zh-TW` / `zh-CN` / `ja`) and verbose Latin (`en-US`) locales whenever the app is bilingual.
- **DO** budget `30-50%` extra horizontal width for English labels relative to 2-character Chinese buttons (`詳解` -> `Details`, `擬答` -> `Reply`, `自動偵測` -> `Auto-detect`, `講者 2` -> `Speaker 2`).
- **DO** verify font fallback and webfont loading for CJK glyphs (`line-height`, baseline alignment beside inline SVG icons, and monospace code blocks where CJK may render as tofu if a Latin-only font is forced).
- **DO** render monochrome inline SVGs (`aria-hidden="true"`) instead of raw Unicode color emojis (`U+26A1`, `U+2600`, `U+26A0`, etc.) in UI chrome so icon sizing and alignment stay identical across Windows, macOS, iOS, and Android.
- **DON'T** hardcode fixed pixel widths (`width: 68px`) on localized buttons, tabs, badges, or `<select>` triggers.

## Common Failure Modes

- A `667x375` left-pane header fits `講者 2 ▾` + `[擬答][修正][刪除]` cleanly in Traditional Chinese, but switches to `Speaker 2 ▾` + `[Reply][Edit][Del]` in English and clips `Speaker 2 ▾` mid-word.
- A `<select>` showing `自動偵測` fits inside `88px` in Chinese, then cuts off `"Auto-det..."` in English on `360x640`.
- Emoji glyphs render 2-4px taller on iOS than Windows, pushing single-row toolbars out of vertical alignment.

## Playwright Verification Recipe

```js
// Run tight viewport audit across locales and assert zero clipped controls
for (const locale of ["zh-TW", "en-US"]) {
  const ctx = await browser.newContext({
    viewport: { width: 667, height: 375 },
    locale,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto(`${url}?lang=${locale.startsWith("zh") ? "zh" : "en"}`);
  const clippedControls = await page.evaluate(() =>
    [...document.querySelectorAll("button, select, [role='tab']")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && el.scrollWidth > el.clientWidth + 2;
      })
      .map((el) => ({ text: el.textContent?.trim(), sw: el.scrollWidth, cw: el.clientWidth }))
  );
  expect(clippedControls, `Clipped controls in ${locale}`).toEqual([]);
  await ctx.close();
}
```

## Related guides

- `toolbar-crowding-and-overlap-audit`
- `ime-and-keyboard-focus-safety`
- `adversarial-data-and-empty-dense-states`
- `visual-screenshot-triage-workflow`
