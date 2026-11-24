---
id: ios-input-zoom-and-form-ergonomics
category: input-ergonomics
title: iOS Input Auto-Zoom Prevention and Mobile Form Ergonomics
description: Enforce computed font-size >= 16px on every mobile input, select, and textarea (including class-scoped overrides) alongside proper inputmode and keyboard-safe form layouts.
keywords: [ios, safari, auto-zoom, font-size, 16px, input, select, textarea, inputmode, enterkeyhint, form]
appliesTo: [css, html, mobile, playwright]
---

# iOS Input Auto-Zoom Prevention and Mobile Form Ergonomics

## Invariants (DO / DON'T)

- **DO** ensure every visible `<input>` (text/email/search/tel/url/password/number/date), `<select>`, and `<textarea>` on touch viewports computes to `font-size >= 16px` (Safari zooms the entire viewport whenever a focused form control computes to `< 16px`).
- **DO** explicitly include class-scoped selectors (e.g., `.role-select`, `.partner-select`, `.search-input`) in mobile `@media` `font-size: 16px` rules — bare `input, select { font-size: 16px; }` loses specificity to `.compact-select { font-size: 13px; }`!
- **DO** set semantic `type`, `inputmode` (`numeric`, `decimal`, `email`, `search`), `autocomplete`, and `enterkeyhint` (`search`, `send`, `done`) so mobile keyboards show the right layout.
- **DO** strip whitespace on paste for OTP/TOTP/code inputs (`pattern="[0-9 ]{6,12}" maxlength="12"`) when users copy formatted `"123 456"` codes from password managers.
- **DON'T** "fix" iOS input zoom by setting `maximum-scale=1` or `user-scalable=no` in `<meta name="viewport">`.

## Common Failure Modes

- Global mobile rule sets `select { font-size: 16px; }`, but a component class `.suggest-role-sel { font-size: 12px; }` wins specificity and still triggers Safari zoom on iPhone.
- Form submit bar pinned via `position: sticky` overlaps inputs or disappears off-viewport when the virtual keyboard shrinks height.
- OTP input with `maxlength="6"` silently truncates pasted `"123 456"` to `"123 45"`.

## Playwright Verification Recipe

```js
// Run on mobile/touch contexts (360x640, 390x844, 667x375, 844x390)
const sub16Inputs = await page.evaluate(() => {
  const selector = "input:not([type='hidden']):not([type='checkbox']):not([type='radio']):not([type='range']):not([type='submit']):not([type='button']), select, textarea";
  return [...document.querySelectorAll(selector)]
    .filter((el) => {
      if (el.closest("dialog:not([open]), [hidden]")) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    })
    .map((el) => ({
      tag: el.tagName,
      cls: el.className,
      fontSize: parseFloat(getComputedStyle(el).fontSize),
    }))
    .filter((item) => item.fontSize < 15.9);
});
expect(sub16Inputs).toEqual([]);
```

## Related guides

- `touch-targets-and-coarse-pointer`
- `forms-checkbox-and-hidden-specificity`
- `ime-and-keyboard-focus-safety`
- `static-css-html-antipattern-rules`
