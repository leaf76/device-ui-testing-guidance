---
id: headless-playwright-runner-contract
category: execution
title: Headless Non-Focus-Stealing Playwright Runner Contract
description: Standardize local Playwright execution on Windows/macOS/Linux without stealing OS focus, handling local 127.0.0.1 servers, cookies, and sibling Playwright resolution cleanly.
keywords: [playwright, headless, chrome, msedge, focus, localhost, cookie, 127.0.0.1, runner, windows]
appliesTo: [playwright, testing, execution]
---

# Headless Non-Focus-Stealing Playwright Runner Contract

## Invariants (DO / DON'T)

- **DO** ALWAYS launch Playwright with `headless: true` — never pass `--headed`, never call OS window activation, and never hijack the user's daily browser tab.
- **DO** prefer installed system browsers (`channel: "chrome"`, fallback `channel: "msedge"`, final fallback bundled Chromium) so audits work fast without multi-hundred-MB downloads.
- **DO** serve local static builds or in-process servers over `127.0.0.1` on an ephemeral port (`server.listen(0, "127.0.0.1")`) to avoid port conflicts and IPv6 `localhost` delays on Windows.
- **DO** inject authenticated test cookies via `await context.addCookies([...])` (with a non-`__Host-` local test cookie name over `http://127.0.0.1`) rather than `extraHTTPHeaders: { cookie }`, which Chromium omits on same-origin `fetch(..., { credentials: "same-origin" })`.
- **DO** collect both `page.on("console", msg => msg.type() === "error")` and `page.on("pageerror")` across every viewport and fail on any uncaught JS error.
- **DON'T** commit temporary audit harnesses or scratch screenshots into the product repository — write scratch outputs to `.audit-out/` (gitignored) or an external scratch directory.

## Common Failure Modes

- Using `__Host-sid` cookies against `http://127.0.0.1` silently fails because `__Host-` requires `Secure` + HTTPS.
- Setting `extraHTTPHeaders: { cookie }` renders SSR pages logged-in, then every client-side `fetch("/api/...")` returns `401`.
- Launching headed Playwright interrupts the developer's active window and breaks CI/SSH environments.

## Playwright Verification Recipe

```js
async function launchHeadless(chromium) {
  for (const opts of [
    { headless: true, channel: "chrome" },
    { headless: true, channel: "msedge" },
    { headless: true },
  ]) {
    try {
      return await chromium.launch(opts);
    } catch {}
  }
  throw new Error("No headless Chromium/Chrome/Edge runtime found.");
}
```

## Related guides

- `responsive-viewport-matrix`
- `geometry-assertions-and-severity-rubric`
- `visual-screenshot-triage-workflow`
