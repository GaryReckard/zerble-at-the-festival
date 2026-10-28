# No-build development and importmaps

The game ships directly from source using ES modules and importmaps. Serve it
over HTTP with the [no-cache server](../../DEBUGGING.md#quick-start); opening
`index.html` through `file://` does not reliably load browser modules.

## Toolchain policy

The no-build development loop remains the default. Gary permits a build step
only behind a measured performance proposal and an explicit decision, as
recorded in the [performance backlog](../../docs/backlog/performance.md).
Do not introduce a bundler as incidental cleanup or assume workers require one:
the October pure-worldgen worker probe used native modules. Any proposed change
must preserve a deployable static GitHub Pages game and identify the measured
benefit, migration cost and verification plan.

## Importmap maintenance

When you add a new source file under `src/` (or `src/models/`), you must add its
module path to the cache-busted importmap lists in **all five HTML files**:

- `index.html` — `mods` (src + worldgen) + `models`
- `sandbox.html` — `mods` + `models`
- `hub-sandbox.html` — `mods` + `models` (the 3D hub viewer)
- `terrain-sandbox.html` — `mods` + `models` (the playable elevation proof)
- `map-sandbox.html` — `wg` (includes the worldgen and shared module paths)

```js
const mods = ['main','world','zerble', /* ... */, 'worldgen/lint'];
const models = ['canoe','hammock','tent', /* ... */, 'wook'];
```

Without that, the dev cache-buster won't decorate the URL with `?v=<timestamp>`
on local dev — meaning your edits won't reload (Chrome's heuristic cache holds
ES module bodies past `Cache-Control: no-store` in some cases). Production is
unaffected by the missing entry (it loads modules unsuffixed) but local dev
will silently bite you.

**Run `bin/check-importmaps`** after touching `src/` or any importmap. It
recursively discovers JavaScript modules under `src/`, normalizes model-relative
entries, and checks the `mods`/`models`/`wg` declarations on all five pages for
missing or stale paths. The 2D map declares the same source URLs without importing
them, so its executed modules remain worldgen-only. `node bin/test-importmaps`
exercises missing and stale mappings, nested additions, namespaces, and missing
pages/arrays; it also runs through `npm run check`.

## Three.js comes from a CDN

`three` and `three/addons/` are pinned to unpkg `0.160.0` in the importmap.
Don't `npm install three`. Don't vendor it locally. If you need to bump,
update the URLs in the importmap and re-test on at least one mobile browser.
