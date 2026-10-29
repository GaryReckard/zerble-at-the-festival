## Context

The reviewed [standalone plan](../../../docs/backlog/festival-map.md) and [Astra review](../../../docs/backlog/festival-map-review.md) capture the full player decisions and failure cases. Current Vite imports discover modules. Existing registry membership offers per-kind collections, while geographic queries are synchronous pure worldgen data.

## Goals / Non-Goals

Goals: persistent discovery, live compact/expanded navigation, useful destinations, bounded work, real-game integration and harness verification. Non-goals: missions themselves, GPS routes, arbitrary waypoints, altered world generation, new Three.js geometry/materials.

## Decisions

- Separate pure discovery/projection models, asynchronous IndexedDB persistence, static geographic worker, live entity adapter, and Canvas/DOM view.
- Use a module worker for cold geographic queries so a synchronous generator call cannot block driving. Transfer bounded regional road/lake and woodland samples, never 3D objects. Bound query extents, result/cache size, and in-flight work; cancel stale requests by generation IDs. Render from a bounded geographic tile cache.
- Persist sparse 16m discovery cells in 32-cell blocks keyed by canonical seed/layout/schema. Load only local blocks with bounded residency, merge bitwise in transactions, fence reset epochs, and flush incrementally. Persist actual discovered landmark records with stable kind/world-position IDs, independent of transient registry IDs. Coordinate identities include namespace and precise positions to distinguish repeated objects.
- Reveal along driving segments at a consistent 80m radius; teleport discontinuities reveal only the endpoint. Unknown terrain is opaque/blank and suppresses landmarks. Forest shading is an approximation using generator density, not a tree inventory.
- Poll only relevant registry kinds at a capped cadence; retain built discovered static landmarks across unload. Read Lurleen/Nutwagon and collectible star through explicit live adapters. Nearby range is initially 120m across tiers. Pickup visibility is current/live only, and lost moving-target tracking is cleared.
- North-up Canvas map with a rotating cart arrow. Smooth expandable CSS bounds and centered zoom. Bound zoom range and pixels. Use separate static/background and live overlays, no blur. Preserve held keyboard/touch controls and use map-owned gestures only. M opens the map, J toggles music; retain touch music as its own action. Settings hide compact map without stopping discovery.
- Use a visibility exception only for explicit objective markers. Track one marker; boundary pin size is monotonic/clamped and remains accessible. No pan, no pause, no timer changes.
- Suspension, hidden UI, and final disposal are distinct. Visibility/BFCache resume must retain functionality and stale async callbacks cannot mutate reset state.

## Risks / Trade-offs

Cold query stalls -> worker isolation and bounded requests, including cold-cache tests. Large exploration -> sparse durable storage plus bounded resident caches; viewport-only loading. Storage races -> IDB transactional union and epoch fencing. Touch conflicts -> input action separation and touch ownership tests. Planned/build divergence -> discovered static markers come from actual registry entries. Transparent fullscreen compositing -> capped backing resolution and actual browser measurements. Nearby markers -> only real current positions, never last-known tracking. No RNG or shared resource changes; preserve synchronous title audio initialization.

## Migration Plan

No seeded world changes. Add a versioned map database and independent saved visibility preference. Music moves from M to J including help text; touch music behavior is preserved. Failed persistence leaves an explicit session-only status and usable map.

## Open Questions

No blocking product questions. Harness-tune radii, scale/opacity and measured budgets. Starting limits: compact 210 CSS px (smaller phones), geographic radius up to 1200m, 64 tiles resident, one worker request at a time, 1024px maximum canvas side, refresh live markers at 5Hz. These are acceptance candidates to validate rather than device-performance claims.

## Council integration gates

Follow [the synthesis](deliberations/001-initial/results.md). Worker handshake includes numeric seed, configuration, world mode and version token; legacy v1 disables unsupported geography. Failure never falls back to main-thread generation. Visible working set fits cache; bounded requests and responses plus separate raster diagnostics. Storage-unavailable fallback retains at most 96 recent blocks and explicitly reports limited session history. Seed persistence does not change fresh-world policy. Game ticks own discovery; visibility suspends rendering only. Worker caches are periodically released by recycling the optional worker after a bounded job count.

## Bottom-right placement

Gary confirmed the compact minimap belongs in the bottom-right corner. Reserve this area on touch layouts by reflowing the right-side buttons into two rows above it, preserving the stick and touch-identifier ownership. Verify portrait and landscape spacing before accepting handset behavior.

The compact map is circular, with a square backing and radial boundary-pin projection; the expanded view retains rectangular viewport bounds.

Animation uses the live CSS viewport for logical drawing while retaining a full-size canvas backing until the morph settles; backing dimensions do not churn each animation frame. Boundary-pin clamping blends between rectangle and circle. Compact has no permanent border/shadow, while keyboard focus remains circular. Expanded geographic opacity is 0.4508 versus compact's 0.92, reflecting two successive 30% reductions; marker and text opacity stays unchanged. Full-screen dimming is a separate fixed, noninteractive sibling that fades without resizing. The moving geographic canvases have no dark fill, and the compact background disc appears only after the move settles.

Gary's final interaction decisions remove all map chrome: no heading, destination menu, visible zoom/close controls, idle caption, scale or north indicator. Pins toggle tracking directly; wheel/pinch zoom and Escape/empty-space tap close. Named distance appears only for selection or keyboard pin focus. Visually hidden native pin buttons retain keyboard and screen-reader access, highlighting the corresponding drawn pin. Tap recognition excludes pinches and dragged/cancelled gestures.
