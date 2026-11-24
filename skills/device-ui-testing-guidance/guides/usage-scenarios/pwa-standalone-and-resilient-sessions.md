---
id: pwa-standalone-and-resilient-sessions
category: usage-scenarios
title: PWA Standalone Mode, Companion Views, and Offline Resilience
description: Verify installable PWA display-mode: standalone chrome adjustments, second-screen read-only flows, offline/reconnect banners, and safe navigation recovery.
keywords: [pwa, standalone, display-mode, offline, reconnect, companion, wake-lock, fullscreen, manifest]
appliesTo: [html, css, js, mobile, playwright]
---

# PWA Standalone Mode, Companion Views, and Offline Resilience

## Invariants (DO / DON'T)

- **DO** hide redundant browser-only controls (such as Fullscreen buttons) under `@media (display-mode: standalone)` and account for standalone top status-bar / bottom home-indicator safe areas.
- **DO** test offline and slow-network UI states (`context.setOffline(true)`): status badges must clearly reflect `offline` / `reconnecting` without throwing uncaught rejections, freezing layout, or stacking duplicate error toasts.
- **DO** verify read-only / second-screen companion modes never invoke privileged hardware APIs (`getUserMedia`) or expose destructive host controls (`End for everyone`) — destructive buttons must degrade to a safe local `Leave` action.
- **DO** confirm auth redirects and deep links preserve query parameters (`returnTo` / search params) across reload and mobile viewport sizes.
- **DON'T** assume `navigator.fullscreenEnabled` works on iOS Safari; keep fullscreen buttons progressive and gracefully hidden when unsupported.

## Common Failure Modes

- Installed iOS PWA displays a broken Fullscreen icon button in the header that does nothing when tapped.
- Going offline during a live session spawns a full-width warning banner that pushes the top toolbar out of alignment on `360x640`.
- Second-screen companion view reuses the host layout unchanged, accidentally triggering mic permission prompts on the secondary phone.

## Playwright Verification Recipe

```js
// Verify offline transition does not crash or cause layout overflow
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await ctx.setOffline(true);
await page.waitForTimeout(500);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
expect(errors).toEqual([]);
expect(overflow).toBeLessThanOrEqual(1);
await ctx.setOffline(false);
```

## Related guides

- `dynamic-viewport-and-safe-area`
- `above-the-fold-height-budget`
- `headless-playwright-runner-contract`
