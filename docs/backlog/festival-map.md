# Festival map plan

Date: 2026-10-29. Status: initial implementation delivered in the [festival-map change](../../openspec/changes/festival-map/README.md), with [acceptance evidence and remaining device checks](../../verification/festival-map/README.md). The following preserves the original design. Gary's decisions below are authoritative. Proposed defaults remain distinguishable from approved behavior. An Astra Light review accompanies this plan in `festival-map-review.md`.

## TL/DR

A persistent minimap expands smoothly into a translucent full-screen map. Both views follow the cart, permit continued driving, and reveal geography only through exploration. The expanded map supports zoom but no panning. A selected destination appears at its actual location or as a directional pin on the minimap boundary. The same useful information is available on every performance tier.

## Confirmed decisions

- Reveal terrain and landmarks only as the player explores. Persist discovery across sessions for the same world seed.
- Allow mission destination pins in unexplored territory without revealing the surrounding geography.
- Show Lurleen and the Nutwagon only while nearby, even after meeting them. Do not retain last-known-position markers.
- Keep gameplay, driving, characters, and timers running while the expanded map is open.
- Keep mobile driving controls visible and usable over the expanded map.
- Center both views on the player. Allow expanded-view zoom, but no panning.
- Select a map destination to place a pin. When outside the minimap, clamp the pin to its boundary in the destination's direction. Make the pin smaller at long distances and larger nearby, with minimum and maximum sizes.
- Start with a simple functional appearance; hone the visual treatment after functionality works.

## Experience and proposed defaults

The compact view is visible by default. Clicking or tapping it expands the same map into a translucent full-screen panel; a close button or Escape returns to compact. Proposed: M toggles compact/expanded, and a saved setting hides the compact map without disabling the expanded view. M currently toggles MIDI, so relocating that binding is an explicit implementation task rather than silently breaking music controls.

Proposed: north stays up, the cart arrow rotates, and a north indicator remains visible. The expanded view follows the cart during zoom and while inspecting a marker. Map clicks select visible icons, not arbitrary geographic waypoints until that feature is decided. Show a selected destination's name and straight-line distance in the expanded view. Do not imply a road route or travel-time estimate.

Animate panel bounds and geographic scale as coordinated but independent operations. Show cached geography immediately and fill missing regions within a bounded work budget. Do not delay controls for generation. Honor reduced-motion preferences and support reversing an opening animation without losing state. Zooming out never reveals unexplored terrain.

The panel must leave enough world visibility to drive. Measure compositing cost rather than assuming transparency is free. Start without backdrop blur or expensive decorative effects. The collapsed map should avoid driving controls, juice/status UI, and safe-area insets on phones.

## Content and visibility

| Content | Map representation and policy |
| --- | --- |
| Roads, lakes, woodland | Cached 2D geographic background, clipped to discovered territory; woodland patches rather than individual trees. |
| Stages and bubble juice stands | Persistent discovered landmarks, with detail and labels dependent on zoom. |
| Other festival destinations | Food, camps, beaches, drums, and similar landmarks can use the same marker contract; prioritize readable icons rather than every prop. |
| Lurleen and Nutwagon | Live nearby-only markers; remove immediately when absent or outside detection range. |
| Jugs and collectible star | Proposed: nearby, live, available pickups only; collection/despawn removes their marker immediately. The implementation uses this nearby-only default following authorization to proceed. |
| Mission destination | Explicit visibility exception permits a pin over unexplored geography; no terrain disclosure. |
| Selected destination | One emphasized pin in compact view, clamped to boundary if outside view. Proposed: untrack toggle and clear indication when unavailable. |

Distance scaling must be monotonic and clamped with a readable minimum hit target independent of visual size. Avoid abrupt changes near thresholds, and preserve directional meaning when crossing the map boundary. Edge pins are direct bearings, not promises of a drivable route around water.

## Data ownership and mission integration

Use a render-independent map model with separate sources for geographic plans, discovered landmarks, live entities, and selected/mission destinations. Suggested marker fields: stable ID, kind, world x/z, label, source, visibility policy, availability, and optional objective ID. These are a proposed interface, not an existing API.

The renderer must never create world objects, load 3D chunks, change RNG streams, or mutate shared generator results. Region queries provide geography; POI plans are candidates rather than proof that a live amenity was actually built. Reconcile landmark selection with placement/filtering so the map does not promise nonexistent destinations. Persist compact landmark metadata when needed to preserve actual discovered places across chunk unloading.

Mission targets retain identity and coordinates independently of loaded scene objects. A future mission can pin a fixed destination or explicitly reveal a moving target, but normal character markers remain nearby-only. Define mission-specific overrides explicitly rather than bypassing visibility accidentally. Removing a live target must not leave a false current-location pin.

Existing passenger-quest ideas use a separate compass strip. Reconcile that proposal with the minimap before implementing quests; avoid duplicate direction widgets. Future multiple quests may appear on the expanded map, while one selected objective receives compact-view emphasis. Quest assignment and routing are outside this map implementation.

## Discovery and persistence

Use sparse blocks of discovery bits keyed by integer world-cell coordinates, with correct floor division for negative positions. Illustrative dimensions: 16-meter cells and 32-by-32-cell blocks; each block has 128 bytes of raw discovery bits before keys, encoding, and database overhead. These dimensions and the reveal radius need tuning, not approval as fixed constants.

Reveal a world-space circle around the driven trajectory, including segments between samples so fast driving cannot leave holes. Apply a softly drawn boundary without treating its visual fade as disclosure of undiscovered landmarks. Reveal distance must be identical across quality tiers. Teleports/debug jumps must not reveal the entire connecting segment; define discontinuity handling.

Persist under canonical world seed plus discovery/schema version and a world-layout compatibility version. World resets, changed seeds, and incompatible layout revisions must not merge unrelated exploration. Use batched incremental IndexedDB writes or an equivalent nonblocking store, with immediate in-memory updates, bounded pending work, and explicit failure handling. Do not serialize all history each frame or rely on shutdown flushing alone. Offer an explicit discovery reset, separate from ordinary map visibility settings.

Sparse storage grows with exploration rather than the infinite world's area. The persistent record can grow; the active memory and raster caches must have hard bounds. Never silently evict persistent explored territory to meet a rendering-cache budget. Define quota/failure behavior and allow gameplay to continue with session-only discovery if persistence fails, with an unobtrusive status notice.

## Rendering and performance

Prefer Canvas 2D geographic tiles with a separate marker layer and accessible DOM controls. Cache slightly beyond the current viewport and invalidate by seed/layout version, tile coordinates, zoom bucket, discovery changes, and relevant settings. Keep geographic tiles and mutable fog separate where that avoids repainting all scenery after each reveal.

Do not scan all exploration history or all registry entries each frame. Query bounded spatial regions and maintain targeted live marker subscriptions/adapters. Cache generated geographic data with a bounded eviction policy. Measure and constrain underlying worldgen memoization as well as map-owned caches, since map queries can reach beyond loaded gameplay chunks.

Player motion and selected-pin placement should follow rendered frames. Other moving markers can use lower update rates with interpolation. Rebuild static backgrounds only when necessary, spreading generation over frames. Expanded zoom-out needs simplification and bounded query area, not simply requesting every fine-detail tile in a larger rectangle. Rapid zoom must cancel or supersede stale work.

Low/Medium/High share discovery, ranges, destinations, and maximum navigable coverage. Initially vary backing resolution, decorative detail, label density, and noncritical marker refresh rates only when measurements justify it. Cap device-pixel ratio and total canvas pixel count independently of CSS size. Hidden mode suspends map rendering and map-only queries while exploration tracking continues. Closing, resizing, restarting, and page teardown release resources and listeners.

No performance promise is established yet. Record baseline versus compact, expanded, reveal/cache rebuild, and rapid zoom on representative hardware. Report p50/p95/p99 frame times, map update cost, long tasks, memory/cache counts, and persistence latency where measurable. Agree measured budgets before implementation acceptance; unchanged draw calls alone do not prove low overhead.

## Delivery sequence and acceptance

1. Build a lightweight map test surface first, using the real map model with fixtures for discovery, negative coordinates, known/live/missing markers, mission exceptions, and player movement. Keep it usable without a running 3D scene.
2. Implement discovery storage and visibility policies, with meaningful tests for seed/version isolation, round-trip saves, negative boundaries, fast traversal, discontinuities, failures, and restart restoration.
3. Add bounded geographic queries and cached rendering. Test region consistency, no RNG mutation, undiscovered clipping, cache limits, and generation cancellation.
4. Integrate compact view, nearby actors/pickups, selection, and boundary pins. Test collection/despawn, chunk unload, missing destinations, distance scaling, and objective visibility exceptions.
5. Add expanded transition, centered zoom, continued driving, keyboard/touch controls, reduced motion, settings persistence, and the MIDI binding migration. Verify focus behavior without trapping driving keys or triggering controls through the map.
6. Run check/build and full-game title/start/console verification, plus Noon/Midnight and Low/Medium/High checks. Measure compact/expanded/cache rebuild and repeated open/close, phone resize/orientation, touch driving, storage failures, and bounded memory during extended traversal. Follow browser process cleanup rules; never use the prohibited layout-snapshot capture path.
7. Update player controls, CHANGELOG, and ROADMAP with shipped behavior and measured limits. This design-only document does not imply acceptance or implementation.

## Remaining decisions

- Initial implementation uses nearby-only jugs/star at a 120m range, matching character detection; tune after playtesting.
- Initial implementation selects existing markers only. Arbitrary personal waypoints are outside the authorized initial scope.
- Tune map size/placement, reveal radius, nearby character range, zoom limits, opacity, pin distance curve, and performance budgets in the harness. These are implementation tuning items, not reasons to reopen confirmed product decisions.

## Verified starting points

- [Roadmap map entry](../../ROADMAP.md#world-generation-procedural-map): shared-generator landmark map direction.
- [Return-home research](festival-research.md): stable hub identity and recognizable landmarks.
- [Regional geography query](../../src/worldgen/index.js): `queryRegion`, roads/lakes/hearts.
- [Festival POI query](../../src/worldgen/festival.js): `poisInBounds`, `festivalPlan`.
- [Registry](../../src/registry.js): live positions and spatial membership; inspect adapter suitability before reuse.
- [Main loop](../../src/main.js): live characters, MIDI M binding, input and gameplay update integration.
- [Settings](../../src/settings.js) and [adaptive quality](../../src/adaptiveQuality.js): existing preferences and quality policy.
- [Star lifecycle](../../src/starPower.js) and [chunk pickups](../../src/chunks.js): actual item availability.
- [Passenger quest design](../../.claude/passenger-quests-design.md): historical, unimplemented design to reconcile.
- [Browser safety](../browser-verification.md) and [project instructions](../../AGENTS.md): verification and cleanup requirements. Older council/README prose can describe obsolete tooling; current project instructions govern Vite and checks.

## Astra Light review and incorporated requirements

The [Astra review](festival-map-review.md) supports harness-first implementation and identifies the following requirements. Its source citations refer to the initial plan above; this section adds requirements without changing confirmed product decisions. No runtime or device performance pass is implied.

1. **Bound the smallest synchronous generation unit.** Measure the worst cold query before selecting tile dimensions, cap each query's geographic extent, and exercise festival-plan cache rollover. A frame scheduler cannot interrupt a synchronous generator call. If the smallest useful unit exceeds the agreed budget, split computation or move pure generation to a worker before enabling expanded zoom. Include underlying generator cost/cache behavior in acceptance.
2. **Assign gestures and actions explicitly.** Preserve active driving touches when expanding or closing. Only map-owned touches participate in map zoom; a stick finger plus a map finger must not become a pinch. Separate music and map actions, including the touch music latch rather than changing the keyboard binding alone. Test held throttle while opening/zooming/selecting/closing, touch cancellation, orientation changes, focus, and Space activation without accidental honking. Do not clear all input as if this were a pausing modal.
3. **Use persistent geographic identities.** Runtime registry IDs are temporary associations. Define stable landmark IDs from world/layout version, owning hub or cluster identity, deterministic descriptor identity, child kind, and a discriminator for repeated children. Verify identity across unload/reload, changed registration order, duplicate kinds, and any persisted selection. Do not assume `clusterSeed` alone is globally unique.
4. **Fence persistence races.** Use discovery-session generation tokens to reject stale asynchronous completions after reset or world replacement. Merge delayed stored discovery with new in-memory bits instead of overwriting them. Use atomic union updates for concurrent tabs exploring the same block, and a reset epoch that prevents older queued writes from resurrecting cleared territory. Test delayed reads/writes, reset during flush, and concurrent-tab updates.
5. **Separate lifecycle states.** Compact, expanded, hidden, suspended, and disposed have different ownership. Closing expansion restores compact rendering; hidden mode continues discovery tracking; suspension stops work and supports resumption; final disposal releases listeners/resources and invalidates asynchronous work. Verify browser back/forward-cache restoration and repeated visibility transitions.
6. **Exercise mission visibility boundaries.** Test an unexplored-area objective revealing only its pin, a selected nearby character leaving range without retaining a false current location, and multiple objectives preserving identity while the compact emphasis changes. Decide whether losing a selected moving target clears tracking or displays a location-unavailable state, without exposing its remote position.

## Bottom-right placement

Gary confirmed the compact minimap belongs in the bottom-right corner. Reserve this area on touch layouts by reflowing the right-side buttons into two rows above it, preserving the stick and touch-identifier ownership. Verify portrait and landscape spacing before accepting handset behavior.
