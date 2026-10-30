# Live occupied-chair checkpoint

October 30, 2026. Opt-in `physics=1` integration on `codex/physical-festival-integration`.

## Implemented behavior

Eligible camp and stage sitters now transfer together with their furniture into
physical ownership. Both loveseat occupants reserve their resources before either
old activity is revoked. A sitter contributes mass while supported, releases its
seat once when falling, retains the existing Crowd render instances, and returns
to ordinary movement after a clear stand-up route is found. Direct person hits
retain the existing person consequences; empty furniture still costs no smiles.

Implementation: [occupiedSeats](../../../src/physics/occupiedSeats.js),
[liveWorld](../../../src/physics/liveWorld.js),
[batch ownership](../../../src/people/activityClaims.js).

Recovery uses sampled production terrain and resident engine collision shapes.
Planning shares the world preparation deadline. Nearby people contribute clearance
contacts, so an existing overlap can be escaped without deepening it; the final
standing position must be clear. Other people cannot cancel a physical reaction
through the ordinary panic cascade. A new impact can interrupt recovery.

## Automated verification

`npm run check` and `npm run build` passed. Subsequent targeted tests cover the
final encounter-priority change and the explicit crowd-overlap regression.

- `node bin/test-physics-live-occupants`: real Rapier, registry, CampActivity and
  production Crowd methods, with GPU writes supplied by the population fixture.
  Both camp and stage loveseat cases transfer two sitters, unload and regenerate
  the source, hit/recover each sitter independently, retain the second sitter's
  load until its own departure, then release all claims, loads and exclusions.
  The stage case adds an overlapping bystander during recovery and verifies escape.
- `node bin/test-activity-claims`: batch preparation rollback, synchronous-only
  preparation, cross-person teardown, disposal, release exceptions and reentrancy.
- `node bin/test-person-reactions`: direct physical-impact dispatch and protection
  from nearby panic, alongside existing eligibility and stale-handle coverage.
- `node bin/test-camp-support-transfer`: two-sitter all-or-nothing preparation and
  independent seat release through production camp reservation ownership.
- Existing stand-recovery, chair ownership, contact suppression and live-world
  tests remain in the full check command.

## Real-game browser evidence

Real Chrome, Low tier, seed 1977, initial location `x=-936.66&z=-458.20`, mute on.
Started through the ready Just Cruisin' mode button, selected Stage occupied
encounter, then used Coast forward and a sustained Shift+W input. This exercised
naturally populated stage furniture, rather than forcing a person into the scene.

An initial trial exposed recovery starvation caused by treating nearby people as
unwalkable ground. The contact-based fix above completed a fresh live encounter.
The saved [rendered diagnostics](recovered.json) show person 55 at `complete`,
`seatBlend=0`, its claim released, zero supported loads and zero contact exclusions.
Two prop impacts were recorded; the console had no warnings or errors.

[Noon](low-noon.png) and [Midnight](low-midnight.png) capture the completed live
scene and debug counters. These are aftermath/boot checks, not frame-by-frame fall
captures. The earlier [isolated recovery report](../2026-10-30-stand-recovery/README.md)
contains the focused render comparison (29 draws, 2,006 triangles). This integration
adds no person meshes or materials. Whole-world counters vary with streaming and
are not a matched performance comparison or phone acceptance.

The final staging helper prioritizes its selected prop during admission, avoiding
an unrelated nearby chair taking the last available slot. Browser evidence above
predates only that helper change; its engine/integration regression passed afterward.
Test tabs and the temporary verification server are closed after verification.

## Playtest

Use `?physics=1&mute=1&perf=low&seed=1977&x=-936.66&z=-458.20`.
Choose Just Cruisin', allow the nearby population to settle, then select Stage
occupied encounter. Wait for Target: active, click Coast forward, and use W or
Shift+W for a firmer hit. A light contact need not eject the sitter. If the loaded
area has no eligible sitter, the panel reports that instead of creating one.
Stage cooler encounter remains available for the closed cooler.

## Remaining limits

This is an opt-in prototype with eight active furniture items and at most two
sitters per item. Standing/walking people still use their original hit reaction.
Supported sitters on admitted furniture can fall; empty admitted seats do not yet
accept new occupants. Recovery is a bounded sampled route, not a continuous swept
collision guarantee. No clear route means the person waits under physical ownership.
Static proxies remain conservative cylinders, and support exhaustion stops the
prototype until preparation catches up. Full incident attribution, secondary hits,
coherent arrangement reset, cooler lids/drinks/signs, whole-game performance
comparison and real iPhone/iPad acceptance remain unfinished.
