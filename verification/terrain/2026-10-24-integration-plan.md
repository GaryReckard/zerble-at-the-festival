# Terrain integration sequence

October 24, 2026. This is a bounded sequencing plan, not an apply-ready specification for the entire rollout.

## Starting point and decision

The playable proof is checkpointed at `7b992a1` on `codex/terrain-driving-proof`, branched from `main` at `b1983ae`. Gary reports smooth desktop and good mobile play. See [proof and limitations](2026-10-24-driving-proof.md) and the [original proposal](2026-10-24-proposal.md).

Preserve the festival's existing horizontal layout, then derive a shared elevation surface from it. Base relief plus canonical venue pads, road profiles and lake levels should produce the final surface. The map, ground mesh, cart and world placement must consume that same surface. Do not derive terrain from whatever objects happen to be loaded, and do not feed the final graded surface back into the layout that defines its grading constraints.

The relevant existing contracts are the render-independent generator and quantized point query (`src/worldgen/index.js:1–80`), pair-owned roads (`src/worldgen/roads.js:1–25`), moving-center ground subtraction (`src/world.js:202–206` and `532–537`), and currently flat satellite camp placement (`src/campClearing.js:33`). Those are integration boundaries, not permission to change every consumer at once.

## Delivery order

1. **Make the map reliably usable.** Fix the proven LAN allowlist rejection, then isolate the local first-draw timeout with the festival layer disabled versus enabled at identical bounds. Add bounded detail rendering with a visible zoom-in prompt, an appropriately local default view, and cancellation/yielding if work remains substantial. Acceptance: cold open, pan, zoom out and seed change stay responsive; detailed plans are never generated for thousands of off-scale hubs. Keep the existing macro view available.
2. **Build the shared surface and map preview.** Introduce independently seeded relief and canonical grading descriptors from existing layout footprints. Add elevation colors, contours, slope inspection, road grades, pads and lake levels to the map. Keep layout RNG output unchanged and add separate terrain determinism fixtures. Continuous contact sampling must not inherit the point query's meter quantization. Acceptance: identical coordinates give identical heights across query order, seed reload and region boundaries; the driving course can consume the same surface contract. Before tuning grades, match the game's baseline acceleration and boost so motor differences do not confound terrain testing.
3. **Raise one real festival hub.** Use the hub sandbox and real builders to prove a level venue pad, graded road approaches, adjacent lake and complete camp clearings. Include satellite pitches, walking NPC feet, cart passengers/nozzles and camera clearance. Acceptance: no buried/floating contents, roads meet pad edges, the lake remains level, and repeated load/dispose cycles preserve ownership. Pad influence must cover complete planned footprints, not only cluster centers.
4. **Integrate behind an opt-in game flag.** Replace moving-center height subtraction with a fixed world-space surface and make mesh/contact triangulation agree. Complete the consumer inventory in the original proposal, including shoreline/canoe behavior, vertical collision assumptions, streaming, far-field proxies and every camera mode. Acceptance: same seed/load order gives the same terrain, no chunk or near/far seams, game boot works with the flag off and on, and Low/Mid/High plus iPhone gesture/audio tests pass. Measure allocation spikes separately from steady-state frame cost.
5. **Enable rolling terrain after acceptance.** Use Gary's playtest and measured device results to choose grades and density. Add rare dramatic mountain/switchback regions only after ordinary festival terrain passes the same contracts.

## Immediate implementation brief

Take only the map responsiveness slice next. Primary files are `map-sandbox.html`, its focused verification fixture, CHANGELOG and ROADMAP; the LAN access patch is included in this planning checkpoint. Reproduce the default draw cost before selecting a detail budget, preserve worldgen output, and add a regression that would fail if the expensive per-hub planner is called above that budget. Verify a real browser cold open and zoom interaction, run `npm run check`, smoke-test game boot, and close owned test tabs. Stop at a usable map, rather than beginning procedural elevation in the same change.

The local browser navigation timed out after 19 seconds with no captured JavaScript warnings/errors. Source inspection identifies a likely cause, not a confirmed profile: default zoom is 0.06 px/m (`map-sandbox.html:123`), festival plans are generated for every visible heart (`:322–326`), and heart cells are 200m wide (`src/worldgen/constants.js:17–19`). A hypothetical 1440×900 viewport covers 24×15km and roughly 9,400 candidate cells. The cold neighboring-plan cost is documented in `src/worldgen/festival.js:277–286`. Existing overlay caps do not bound the festival-plan pass. Do the controlled runtime comparison before declaring that diagnosis proven.

## Model and planning budget

Use GPT-6.1 Sol at medium reasoning as the implementation owner, with a short brief containing exact scope, acceptance checks and stop condition. Use Luna for bounded source lookup or independent small regression work; use Astra for the shared-surface dependency design and integration acceptance review. This is a workflow recommendation, not a quantified savings claim; it follows [OpenAI's model-selection guidance](https://developers.openai.com/api/docs/guides/model-selection).

Keep one active implementation slice and one owner. Avoid repeated whole-repository investigations and full-history handoffs. Create the required focused OpenSpec artifacts and resolve the project's risk-review gate before the shared terrain/world-lifecycle change; this sequencing document does not claim that gate has passed. Expand later tasks only when the preceding playable slice supplies evidence.
