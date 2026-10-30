# Chair ownership integration checkpoint, October 30

This checkpoint verifies the canonical registry, campsite descriptors, independent render pool and shared streaming deadline. It does not establish playable chair physics in the live game.

## Evidence

- `npm run check` passed, including the new physical registry, campsite descriptor and active render adoption regressions. [Complete output](check.log).
- `npm run build` passed. [Build output](build.log).
- Real Chrome loaded the production preview at `/?mute=1&perf=low&seed=1977`; clicking the ready **Just Cruisin’** button booted the world and map. The tab's captured warning/error log was empty. [Game capture](game-low.png). This checks registration and unchanged default gameplay, not the unconnected adoption owner.
- `bin/test-campsite-layout` covers 1,800 layouts, construction counts and actual campsite registration; its transform stub now supplies real Three.js matrices for the new descriptor path.
- `bin/test-registry-physical` exercises 600 publication steps against linear spatial-query oracles, copied generation metadata, owner transfer, stale tokens, capacity rejection and real campsite-placement exemptions.
- `bin/test-physics-render-adoption` uses all four production chair styles, transformed parents, failed allocation rollback, source-batch teardown, stale slots and 30 cycles returning allocated capacity to zero. Upload bytes are requested CPU buffer ranges, not measured GPU transfer cost.
- `bin/test-chunk-deadline` verifies that optional physical preparation receives the same absolute deadline as chunk generation, consumes the horizon remainder and is skipped after exhaustion.

The owned browser tabs were closed and both preview sessions exited after Ctrl+C. No standalone headless WebGL browser was launched.

## Empty-chair handoff

`src/physics/chairOwnership.js` connects the real registry, solver, render pool and admission ledger through an explicit transaction. It accepts only empty chairs with confirmed support, keeps the original visible until allocation succeeds, publishes a conservative footprint from the solved pose, and requires an explicit restore or retire decision. [Real-engine regression output](chair-ownership.log) covers all four styles, scaled hulls, failed admission stages, source unload, stale tokens and repeated cleanup. Failed resource removal remains visible in cleanup diagnostics and capacity accounting until retried. This owner does not yet run in the main game.

## Remaining integration

Live adoption and fixed-step publication, synchronous origin-regeneration suppression, terrain/static readiness at the movement frontier, occupied support, contact attribution and phone acceptance remain pending. No broad implementation task is marked complete by these component checks.
