# Festival map verification

Date: 2026-10-29. Scope: initial functional implementation, desktop in-app browser and phone-sized 2D layout fixtures. This report does not establish real-phone performance or completed device acceptance.

## What works

The [active change](../../openspec/changes/festival-map/README.md) implements a bottom-right minimap, smooth translucent expansion with continued driving, centered zoom without pan, sparse persisted exploration, actual discovered landmarks, nearby live actors/pickups, selection and directional boundary pins, and an explicit objective fog exception. M toggles expansion; J retains MIDI music including its separate touch action. Settings persist compact visibility and offer an explicit exploration reset.

## Automated checks

- `npm run check` passed after integration and input/layout changes. This includes the new `node bin/test-festival-map`, the existing touch-steering regressions, toolchain builds, and the full project suite. Subsequent renderer caching changes passed the map regressions, production build, and production browser path.
- `npm run build` passed with the new harness entry and hashed module worker. Existing large-chunk warnings remain; no missing module/export errors occurred.
- `openspec validate festival-map --strict` passed.
- Map tests cover negative cell boundaries, segment reveal and teleport discontinuities, pin bearing and monotonic size clamps, visible tile set bounds, deterministic geographic marker identity, same-world restoration and isolation, concurrent discovery unions, stale reads and reset adoption, storage failure with bounded residency, worker identity and failure without main-thread fallback, and immediate removal of collected/out-of-range live markers.
- Actual worker generation at 256/512/1024m was exercised in isolated Node module state. A separate 54-region check over six seeds and three-by-three positions found at most 312 road features at maximum tile size, below the 512-feature response gate. This is sampled evidence, not a mathematical bound for every seed; the runtime gate remains enforced.

## Browser evidence

All browser URLs used `mute=1`; saved volume settings were not changed. Agent-created tabs were closed and owned servers were stopped after verification. No standalone/headless WebGL system was launched.

1. **Real game:** Low, Medium and High each passed title card, ready Just Cruisin' click, world boot, compact map, expanded map, and console inspection with no errors. A discovered stage was selected; driving with the expanded map changed its displayed distance and revealed additional destinations. Gameplay/time/juice continued advancing.
2. **Preferences:** Medium verified hiding the compact map, opening the expanded map with M while hidden, Escape closing it, and restoring compact visibility afterward.
3. **Storage:** The workshop's Check storage passed using real IndexedDB transactions for concurrent bitwise union, isolated world keys, reset epochs, and rejection of stale writes. Test databases are separate from player discovery and are deleted afterward.
4. **Driving input:** Check input passed using the real Touch/Input modules with synthetic touch events. It held stick throttle through expansion, zoom and close, checked release, verified touch music maps to J rather than M, and confirmed Space on a map button does not honk. These tests ran in both the normal and phone-sized landscape fixture. They do not replace physical multi-finger iOS testing.
5. **Geography/mission:** The workshop drove along a growing explored corridor, zoomed the live expanded map, and displayed a selected unexplored passenger destination without revealing its surrounding landscape. Worker status reached ready with no pending work in fixed views.
6. **Production subpath:** The final build was served with `npm run preview -- --base /festival-map-proof/`. The built harness, hashed worker, geographic drawing, live expanded driving, and real IndexedDB checks worked at `/festival-map-proof/festival-map-preview.html?mute=1`, with no console errors. This checks relative deployment URLs rather than development-only module paths.

## Captures

- [Bottom-right compact map, Medium](bottom-right-medium.png).
- [Expanded Noon view, Low](noon-expanded.png).
- [Expanded Midnight view, Low](midnight-expanded.png).
- [390×844 portrait touch layout](touch-portrait.png) and [844×390 landscape touch layout](touch-landscape.png). The portrait capture is scrolled to show the lower controls. Both reserve the bottom-right map corner without overlapping driving controls. These are desktop iframe viewports, not phone captures.

## Measured snapshot and limits

[The final production-harness snapshot](production-harness-snapshot.json) records expanded driving at roughly 990m in the 2D fixture: rolling map-owned main-thread p95 about 0.4ms, maximum about 1.4ms, last raster update about 0.9ms, last worker tile about 1.7ms/56.7KB, 16 geographic tiles and raster entries, 36 resident discovery blocks, no pending worker jobs or dirty storage blocks, and 1,179,648 total canvas backing pixels. These are diagnostic samples from this desktop browser, not a controlled benchmark or a total-game frame-time distribution. Main-thread map timings do not include the separate capped registry observation in main.js or the browser's GPU compositing work.

The earlier real Low game debug panel showed approximately 592–593 draws and 423k triangles at the visited position, already above the historical HUD guides; this change adds no scene meshes, lights or render pass, but those counts do not establish performance headroom or an unchanged before/after baseline. Do not claim a phone improvement from these counters.

Enforced limits include 96 resident discovery blocks, 64 geographic results, 64 raster entries, at most 36 desired tiles, one active worker request, 144 woodland samples per tile, 1024m maximum tile size, bounded feature/point/payload counts, capped backing dimensions, and worker recycling after 256 completed jobs. Each raster entry retains a base and masked 192px Canvas, approximately 18MiB of raw RGBA backing at a full 64-entry cache, excluding browser overhead and worker data. Storage failure explicitly reports limited recent session history rather than pretending bounded RAM preserves unlimited exploration.

## Remaining acceptance

- Representative real-phone Safari/Chrome performance and physical multi-finger input, including safe-area/orientation changes and sustained expanded driving.
- Controlled same-position/tier hidden/compact/expanded total frame-time comparisons and underlying worker/GC behavior over prolonged traversal past cache eviction and worker recycling.
- Explicit browser back/forward-cache restoration confirmation and prolonged visibility suspension/resume. Lifecycle hooks exist, but these paths were not established by this pass.

These remain on ROADMAP and the active change checklist; the implementation is playable and the change is intentionally not archived.

## Circular minimap follow-up

The compact map now uses equal width/height and a circular clip on desktop and touch layouts; full-screen expansion retains rectangular bounds. Boundary-pin tests cover cardinal and diagonal bearings, exact radial inset, unclamped nearby positions, and the expanded rectangle's separate behavior. The full `npm run check`, production build, and whitespace checks pass. The real Low game passed the ready start click, circular Noon/Midnight views, full-screen expansion and clean console inspection. See [Noon](circular-noon.png) and [Midnight](circular-midnight.png).

## Player arrow correction

The cart advances along `(-sin(heading), -cos(heading))` on the map's X/Z axes (`src/zerble.js`), while the Canvas arrow points along local negative Y. Removing the renderer's extra half-turn aligns those vectors. The regression runs the actual `drawMarkers` method against the cart's actual forward formula at six cardinal/diagonal headings in compact and expanded modes; it failed at heading zero before the fix and passes afterward. Workshop motion now follows the same negative-Z convention. The real Low game passed ready-button startup, forward driving, Noon compact and Midnight expanded captures, and clean console inspection. Captures: [Noon](heading-noon.png), [Midnight expanded](heading-midnight-expanded.png).

## Transition, border and translucency follow-up

The map now draws against its live animated panel bounds instead of switching to compact logical dimensions while CSS is still shrinking a large panel. It retains the expanded backing throughout the morph, reallocates only at endpoints, and interpolates directional-pin boundary shape. The permanent border/shadow are removed, and keyboard focus inherits the circle, avoiding the clipped rectangular gold focus marks. Expanded geographic opacity is 0.644 versus compact's 0.92 (30% lower); icons and labels remain unchanged.

The production workshop's **Check transitions** passed across 73 live animation frames, including canvas/viewport agreement, backing retention, rapid reversal, zero border/shadow, circular focus, and the opacity ratio. **Check input** still passed held driving through open/zoom/close. Node regressions exercise the actual layout methods, no per-frame backing allocation, reversals, reduced motion and continuous pin projection. Full `npm run check` and the production build pass. Browser timing samples are diagnostic only and do not replace the pending phone acceptance.

Real Low game verification also passed ready-button startup, open/collapse, Noon/Midnight captures and clean console inspection. Captures: [lighter Noon expanded map](translucent-noon-expanded.png), [borderless compact map](borderless-noon-compact.png), and [Midnight compact map](borderless-midnight-compact.png). Test tabs and the owned Vite server were closed afterward.

## Independent backdrop and minimal controls

The current expanded map uses 0.4508 geography opacity after Gary's second 30% reduction. Dimming belongs to a fixed noninteractive sibling at full-screen bounds; geographic canvases contain no full-panel dark fill. The compact disc appears only after settling, so a dark oval never shrinks across the world. The workshop transition check passed 66 live frames, full-screen backdrop bounds, fade-out, rapid reversal, backing retention and opacity checks with no console errors.

Gary removed the heading, destination menu, zoom/close buttons, idle caption, scale and north indicator. Pins toggle tracking directly, wheel/pinch zoom, and Escape or an empty-space tap closes. Hidden native pin buttons preserve keyboard and screen-reader access with a drawn focus highlight. A named distance appears only for selection/focus. Pointer taps exclude multi-finger pinch and dragged/cancelled gestures. Regression coverage also guards Ctrl slow driving while modified map/music shortcuts are ignored.

Final acceptance for the minimal interface: full `npm run check`, production build, strict OpenSpec validation and whitespace checks pass. The final workshop passed 72 animation frames and held-input checks. In the real Low game, a visible stage pin was clicked to display “Stage · 45 m,” clicked again to remove selection, and empty map space was clicked to close. The wheel remained available without buttons; Noon and Midnight views contained none of the removed visual controls or idle text, and the console stayed clean. [Final minimal Noon view](final-minimal-noon.png) and [Midnight view](final-minimal-midnight.png).
