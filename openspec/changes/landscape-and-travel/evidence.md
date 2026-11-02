# Implementation evidence

## Baseline, November 1, 2026

Before landscape runtime edits, `npm run check` passed and `npm run build` passed. Build retains its existing large-chunk warning for experimental Rapier. Logs during this session: `/private/tmp/zerble-landscape-baseline-check.log` and `/private/tmp/zerble-landscape-baseline-build.log`; these temporary paths are not durable artifacts.

Source boundary inventory: terrain is `src/worldgen/terrain.js`; exact support triangles and current zero pads remain unchanged. The cart binds sampleTerrain in `src/main.js:433`; reusable bounded render/controller harness is `src/terrainSandbox.js`. `src/collisionContacts.js:25-29` checks X/Z only; `:48-53` applies post-drive corrections. Registry collider publication owns vertical metadata migration. Experimental physics owns its own fixed plane (`src/physics/runtime.js:20-35`), not the production landscape. Oriented cluster reservations are `src/worldgen/tuning.js:290`; camp support fitting is `src/campRegistry.js:44`.

Do not overwrite concurrent physical-festival/boot-recovery edits, package lock/dependency updates, or existing documentation additions. No branch change or commit is required to add isolated proof modules.

## First-proof defaults and decision gate

Proposed default: bounded authored fixture and local one-meter geometry; explicit terrain/deck surface IDs; only declared approach gates permit transitions. Entry requires matching current elevation within a named local tolerance. A deck query outside its support is explicitly blocked, not silently converted to riverbed support. Query order must not mutate actor state; the runtime adapter commits a selected support once per accepted movement step. Solid eligibility uses validated vertical intervals independent of surface IDs.

First fixture bounds/geometry ceilings and selected-layer ray/rate-test semantics are fixed in the council closure section of design.md. Transition tolerance starts at 0.08m and must be tested at both sides of the threshold. Deck straddling uses a 2m endpoint margin only in declared approach corridors, with a 0.02m height-agreement gate; invalid/closed/missing support is blocked and requires explicit reset if no accepted owner remains. These are local engineering defaults, not device feel acceptance. Mesh and sampled triangle heights must agree within 2cm. No global route, density, mobile FPS or device feel result is claimed.

## Verification not yet performed

The baseline alone establishes no landscape acceptance. Implementation subsequently completed the contracts and authored fixture described below; route surveys and physical-device acceptance remain pending.

## Implemented checkpoint

Durable results and captures are in [verification/landscape/README.md](../../../verification/landscape/README.md). Both focused tests pass, including actual real-cart calls at 30/60/120Hz, return-direction crossing and rejected wheel footprints. Full check/build pass; Chrome Low and Mid contact checks pass 128 rays and 512 support poses, with an empty console error/warning query. Actual Low game ready-plank start/world/HUD smoke passes.

Default generation, live vertical collision metadata and populated districts remain unchanged. `terrainDriving` has an optional binding hook used by the fixture only. The geometry inventory matches declared ceilings; phone results and general route/relocation safety remain unmeasured. The owned Chrome test tab is confirmed closed, while explicit removal of the failed in-app tab remains unconfirmed and Task 3.4 (browser cleanup) stays open.

The temporary Vite execution session was stopped via Ctrl+C and confirmed exited (130). All 32 local execution/evidence links pass, OpenSpec strict validation and README freshness pass, and git diff --check is clean.


## Authoritative travel and populated owner checkpoint

The [current verification report](../../../verification/landscape/README.md) supersedes the initial-proof limits above. Fixture version 4 is 240m wide with a 2m X / 1m Z lattice, preserving the vertex/triangle ceiling. Whole-footprint movement, swept routes and turns, legal corrections/relocations, real collider publication and passenger ground transfer pass focused checks. The authored owner builds real camps, open upper commons/firepit, dense woods and the separate animated drum clearing, with actual Crowd visitors, activity grounding, boarding eligibility and upper-shelf drop-off. Four complete build/dispose cycles plus obstruction/partial-build rollback and support pins pass. The current seed has eleven lower and seven upper pitches; the latest photographs deliberately supersede the temporary rigid/dense-upper layout.

`npm run check` exited 0 after the optional camp-slot and boarding hooks preserved legacy harness/default behavior, including the 240-frame boarding oracle; `npm run build` passes. The updated fixture and district tests pass after the bridge depth-bias fix. Numeric inspection found coplanar 0m terrain/deck at both approaches; render bias preserves exact contact geometry. A built-preview replay has reached the clearing and is returning through the woods, with no console warnings/errors at inspection. Final round-trip, tier, real-game and cleanup evidence is still in progress. Cold allocation remains above a streaming-step budget and is recorded rather than claimed solved.

Future generation must vary district structure, rather than stamp the authored course. Roadmap-only car-camping vehicles and a mountaintop passenger quest are recorded separately, with first aid and the hillside Barn still deferred.

## Current procedural and water checkpoint

The [current verification report](../../../verification/landscape/README.md#complete-finite-stream-and-crossing-proof) supersedes earlier in-progress acceptance wording in this historical log. Groups 1–7 are complete as engineering/development proofs: structurally varied native-grid districts, finite real-world route admission in an owned worker, map generation opt-in and complete finite stream/bridge/prop support. Generation 1 remains the main-game default, and production manager/all-consumer migration remains Group 8 work.

The full project check and build pass. The final generated populated Low and Mid course pass 96 selected-layer rays / 448 poses with zero misses. The actual worker-backed map returns ready plans, and a real ready-plank Low game runs through dusk with 32 smiles / 2% juice and no console warnings/errors. All owned verification tabs and production-preview servers are closed/stopped. The development server remains task-owned only while implementation continues. The [current survey](../../../verification/landscape/procedural-survey.json) and [stream/prop results](../../../verification/landscape/stream-results.json) preserve exact scope and performance limits; no phone, streaming-budget or production rollout acceptance is inferred.


## Desktop implementation acceptance checkpoint

The current state is 31/34 tasks complete. The final desktop check and production build exit successfully, strict change validation passes, and focused default-people/physics/debug-teleport regressions remain green. Ready-plank boots, Low/Mid/High Noon/Midnight views, all camera modes and two real-game distant streaming/revisit cycles have empty warning/error queries. Every recorded disposable tab is confirmed absent, and the requested workshop preview remains available.

The [integrated verification report](../../../verification/landscape/README.md#integrated-performance-and-desktop-acceptance) is the current result, with raw tier/baseline/streaming/allocation/worker-payload data and explicit limits. It records the verified distant-owner rebuild bug and its complete-bounds correction, off-thread native road/water attributes, four exact resource-teardown cycles and a 19-candidate payload survey. Construction outliers, adaptive quality and cold multi-kilometre jump spikes are measured limits, not a phone/per-frame-budget pass.

Physical iPhone/iPad evidence, unprompted player recognition/route choice and final tuning/rollout remain unchecked. Generation 1 remains the default. Live chair physics activation remains the separate physical-festival change's responsibility; this change supplies its native geometry/version/ownership adapter.
