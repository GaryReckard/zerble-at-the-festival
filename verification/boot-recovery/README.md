# Startup download recovery, October 30, 2026

Gary reported HTTP 503 for `assets/main-C9aCBEJe.js`, an uncaught dynamic import rejection and a loading screen that recovered after a hard refresh. A subsequent HEAD request for that exact public asset returned HTTP 200 with `Cache-Control: max-age=600`. The original cause cannot be reconstructed from that later response; a transient hosting/CDN failure is consistent with the report. Stale HTML referencing replaced chunks is another load-failure case documented by [Vite](https://vite.dev/guide/build.html#load-error-handling).

## Change

The [boot entry](../../src/boot.js) now catches failed imports. The inline [title loader](../../index.html) also handles Vite preload failures and module-entry resource errors, so it works even when boot.js cannot download. Before the ready state, a download failure attempts one fresh document navigation using a timestamp query parameter. That marker bounds automatic attempts without requiring session storage; a second failure exposes a retry button. Manual retry replaces the timestamp, preserves the project path, options and fragment, and leaves the bound in place until startup succeeds. Ready removes the temporary marker and hides retry. Ordinary initialization exceptions show retry without automatic navigation. A slow boot exposes retry after 20 seconds but can still finish normally. Errors after ready never reload an active game.

This does not change GitHub Pages cache headers, guarantee recovery during an ongoing outage, or prove the reported failure was caused by caching. Deployment is tracked by the GitHub Pages workflow for the merge to `main`.

## Verification

- `node bin/test-boot-recovery` executes the actual inline loader in a VM with controlled browser boundaries. Covers duplicate events, transient/persistent failures, Safari-style import error text, entry-script failure, ignored image failures, ordinary initialization exceptions, slow-to-ready transitions, URL/state preservation and post-ready errors.
- `npm run check` passed ([output](check.log)); `npm run build` passed ([output](build.log)). Existing large-chunk and module-type warnings remain.
- The isolated release branch passed clean-install checks and build. `npm run test:toolchain:http` passed development and production-subpath checks ([output](http.log)) from `/tmp`; the managed checkout under `.codex` is intentionally denied by the existing Vite file-access rule. That rule remains unchanged.
- Built game served under `/zerble-at-the-festival/` using the [local fault server](server.cjs), which returned actual HTTP 503 for the hashed main module. In real Chrome, a single failure automatically recovered to enabled mode buttons. Clicking Just Cruisin' produced the world HUD and map, with no errors captured on the recovered page.
- Persistent 503 reached a stable error message and working manual retry button after one automatic attempt. [Screenshot](persistent-503.png). The native browser inspection timed out twice during navigation; subsequent observations verified the actual page state rather than assuming success.
- This is title/boot behavior; gameplay lighting and material changes are absent. Low-tier real-game startup was exercised. Physical iOS audio acceptance is not claimed; the start callback and its synchronous audio unlock are unchanged.

## Reproduce the failure path

From the repository root, build, then run `node verification/boot-recovery/server.cjs`. This loopback-only server uses port 8766 and serves `dist/`. Open `http://127.0.0.1:8766/zerble-at-the-festival/?mute=1&perf=low&fault=once` for one failure or change `fault=always` for a persistent outage. The fault setting is test-server behavior, not shipped game behavior. Use one test tab at a time because the server's counter is shared. Close the tab and stop the server with Ctrl+C after testing.

Release branch: `codex/startup-recovery`, isolated from unfinished physics and photographer work. Commit and deploy this fix, then smoke-test the deployed title and ready-mode click.
