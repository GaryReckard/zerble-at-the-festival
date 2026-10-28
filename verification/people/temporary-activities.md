# Temporary activity verification, October 27, 2026

The implementation builds on commit `25d1061` and uses the current working tree.
`node bin/test-hula-session`, `node bin/test-hula-activity`, `node bin/test-frisbee-session`,
`node bin/test-frisbee-activity`, and the Healing Arts ownership and motion tests
exercise production Crowd methods and activity controllers with recording resource
boundaries. They cover revoked writes, forward/reverse honks, reverse-away travel,
star power, blocked exits, safety gates, invalid people and resources, timeout,
competing claims, pair acquisition rollback, all three disc states and teardown.
The full `npm run check` exits 0 in `/private/tmp/zerble-temporary-activities-final-check-7.log`; the five-page `bin/check-importmaps` and strict OpenSpec validation pass.

The native [hula fixture](hula-cycle.html) constructs real Three.js and Crowd objects
and passes the complete identity, appearance, collider, interruption, fresh claim,
resume and departure cycle. The [paired fixture](frisbee-cycle.html) passes a real
disc launch, simultaneous claim revocation, landing, pair resumption and identity
continuity. The [dance fixture](dance-cycle.html) also passes native sampled motion, interruption and original-body reacquisition. All three native fixtures had no captured console warnings or errors. In the native fixture
at a fixed camera and pixel ratio, the hula body alone drew 8 calls / 1,292 triangles;
adding one hoop drew 9 / 1,580. Two Crowd people drew 10 / 2,510, and adding a disc
drew 12 / 2,726. These are isolated render deltas, not whole-game budgets or FPS.
The hula fixture was visually inspected at noon and midnight.

The controlled live-game [hula](hula-live-game.html), [paired frisbee](frisbee-live-game.html) and [Healing Arts dance](dance-live-game.html) fixtures use the real game loop,
Crowd, registry and cart. After a verified cart heading, it passed the hula cycle,
including a charging cart and later ordinary departure. The pair also passed flight, interruption and safe pair resumption, and a dancer passed interruption and safe reacquisition in a loaded Healing Arts tent. These scripted fixtures use
`__dbg.start()` and a controlled cart speed, so it does not establish the iOS audio
gesture path or a natural playthrough. The embedded-browser consoles reported a `MutationObserver.observe` error with no source URL; the same error reproduces in the [static iframe probe](browser-iframe-probe.html), which contains no application JavaScript. The cycles passed; direct muted Low game boot through a ready mode click and a honk had
no captured console errors. An initial fixture run placed the person at the cart
before the forward vector initialized; the fixture now waits for a valid heading.

The live Low debug panel showed 1,321 draws and 350,370 triangles at one seed and
camera; these figures are not comparable with a matched baseline. Extended streaming,
matched whole-game Low/Mid performance, physical iPhone/Safari audio and mobile GPU
behavior remain unmeasured. The checkpoint used the existing disc model and ballistic motion with ordinary
Crowd arms. The [October 28 animation follow-up](activity-animations.md) restores
articulated throws/catches and coordinated hoop motion on those same bodies. Independent nightness and synchronous audio startup were not moved.
