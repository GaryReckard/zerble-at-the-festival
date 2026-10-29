# Development and deployment

[Documentation index](README.md) · [Debugging](../DEBUGGING.md)

## Daily agent workflow

For an ordinary local play session, run `./start` (or `npm start`) and visit
`http://127.0.0.1:8747`. The launcher installs dependencies if Vite is missing,
starts Vite in the repository root, and stops with `Ctrl+C`. It uses a fixed
port and reports an error if that port is already occupied; it never kills
another server. Do not serve the source tree with `python3 -m http.server`,
because source package imports require Vite's resolver.

Use Node.js 24 (the CI version) and Python 3 for the existing verification tools.
From the repository root:

```sh
npm ci
npm run dev
# In another terminal:
npm run check
npm run build
npm run test:toolchain:http
# After stopping dev, inspect the production output:
npm run preview
```

Both servers default to `http://127.0.0.1:8765`; use `-- --port 8876` to choose
another port. Reuse an existing suitable server and close anything you start.
Agent browser URLs always include `mute=1`. JavaScript edits reload the page;
CSS uses Vite's update support. No live scene/audio state replacement is assumed.

`npm run check` includes a real in-memory production build, missing-export
failure checks, automatic new-module discovery, 2D map dependency isolation,
bundled Three.js material-tier checks and capture access-boundary checks.
`npm run build` writes deployable output and source maps to ignored `dist/`.
Neither command substitutes for the title-card click and real-game smoke test.

## Entry pages and module resolution

The build includes `index.html`, `sandbox.html`, `hub-sandbox.html`,
`terrain-sandbox.html`, `map-sandbox.html` and `passport-preview.html`.
Add new source files through normal imports, without registering them elsewhere.
Only new HTML entry pages require an entry in `vite.config.mjs`.

Three.js remains exactly 0.160.0. The exact `three` alias routes through
`src/threeShim.js`; `three-actual` points at the installed library and
`three/addons/` at its matching addons. The entity sandbox keeps its original
Standard materials even on Low, while the game, hub and terrain use the Low
Lambert fallback. The map remains a pure 2D dependency graph.

`src/boot.js` retains the local `bootDelay` probe through a dynamic game import.
The title loader remains independent, and audio initialization still occurs
synchronously in the existing trusted start gesture. The build targets ES2022
because the existing game already uses top-level await.

The output uses relative URLs so it works at both the GitHub Pages project
subpath and the local root. Runtime music, title images and social preview assets
retain their stable paths; the web manifest stays beside its icons. Optional
MIDI playback still lazy-loads its existing Tone.js/MIDI CDN dependencies.

## Captures and guided playtests

Both Vite servers accept same-origin loopback `POST /__capture/<name>` requests
and write `.claude/captures/<name>.json`, with a 32 MiB limit and restricted
capture names. Remote writes and cross-origin browser writes are rejected.
The capture directory and private configuration directories are not served.

`bin/playtest-perf` keeps its existing flags, QR codes and LAN-token workflow.
Its Python server runs `npm run build` before serving `dist/`, so phone and
guided desktop captures exercise production output. Source edits require
restarting that guided server to rebuild. Historical comparison exports without
Vite continue to serve their original source. Use Vite for ordinary iteration.

## GitHub Pages

`.github/workflows/pages.yml` runs `npm ci`, `npm run check` and `npm run build`, plus HTTP integration checks,
on pull requests and pushes to `main`. Successful `main` builds upload only
`dist/` and deploy through the official Pages actions. Pull requests have read
permissions and do not deploy. The workflow can also be run manually; deployment
is restricted to `main`.

The repository's **Settings → Pages → Build and deployment → Source** must be
**GitHub Actions**, rather than publishing the source branch directly. This
setting was applied and verified on October 29, 2026. The
workflow uses the normal `GITHUB_TOKEN`, with `pages: write` and `id-token: write`
limited to the deployment job. Do not commit generated output or publish the
repository root. Deployment begins when the workflow is pushed to `main`.

## Migration evidence and limits

The source tree contained 156 modules with five manual HTML inventories
at migration time. Those inventories and their dedicated checker are removed;
module discovery now follows imports. See the [verification report](../verification/toolchain/2026-10-29-vite.md)
for actual checks, browser results and any remaining deployment limitations.
No device loading-time or gameplay-FPS improvement is claimed from bundling.
