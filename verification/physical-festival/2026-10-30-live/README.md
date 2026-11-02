# Live empty-chair checkpoint

October 30, 2026, on `codex/physical-festival-integration`. This is an opt-in production integration checkpoint, not acceptance of the complete physical festival.

## What now runs

The real game can adopt nearby unoccupied campsite chairs with `physics=1`. Terrain and static neighbors prepare against the existing world deadline before admission. Adopted chairs leave the legacy collision resolver, receive contact through the real cart proxy, publish solved poses to independent instances and the registry, and feed the existing damage/feedback path. Origin regeneration suppresses duplicate furniture; chunk and lake ownership tests exercise repeated regeneration and disposal.

Implementation: [live service](../../../src/physics/liveWorld.js), [static residency](../../../src/physics/staticResidency.js), [chair ownership](../../../src/physics/chairOwnership.js), and [main integration](../../../src/main.js).

## Reproduce the encounter

1. Build with `npm run build`, then run `npm run preview -- --host 127.0.0.1 --port 8765`.
2. Open `http://127.0.0.1:8765/?physics=1&mute=1&perf=low&seed=1977&x=-936.6597870600564&z=-458.1964625148441&tod=0.25` and click the ready **Just Cruisin’** button.
3. Press **Stage chair encounter**, wait for active chairs, and stage again if the selected target remains unadmitted. An NPC can claim an empty chair before admission; occupied chairs intentionally retain legacy behavior in this checkpoint.
4. Once the panel says **Target: active** and **Coast forward** is enabled, press it. It sets the actual controller speed; subsequent motion and contacts run through the normal game loop.
5. Inspect the impact count, chair motion and smile feedback. Expand **Physics diagnostics** to inspect ownership, engine and support counters. Repeat with `perf=mid` and `tod=0.75` for the alternate tier/lighting checks.
6. Close the test tab and stop the preview server with Ctrl+C.

The staging helper rejects water and obstructed approaches with a bounded search. It is a verification aid, not a player-facing feature. The readout's second chair count currently includes active chairs despite its “preparing” label.

## Evidence

- [Full check output](check.log) and [production build output](build.log) passed before the browser capture. The build warns about the separately loaded Rapier chunk size; mobile startup cost is not accepted.
- [Live regression](../../../bin/test-physics-live-world) exercises real Rapier adoption, cart impacts at 30/60/120 Hz, ghost passage, exhausted preparation deadlines, canonical clearance, source unload and disposal. Added staging checks cover blocked approaches, water, enclosure and bounded search.
- [Ownership regression](../../../bin/test-physics-chair-ownership) covers repeated chunk/lake origin replacement and restored-source lifetime. [Static residency regression](../../../bin/test-physics-static-residency) covers shared support, capacity/deadline limits and removal of all fixed versions during dynamic handoff, including failed removal and retry.
- [Impact screenshot](impact-low.png) recorded the real-game impact and the HUD changing from 24 to 23 smiles. The later [diagnostic report](impact-low.json) has one impact, five active chairs, 21 bodies, 46 colliders, no support block, no rejected admissions and no event overflow. [Captured console messages](console-low.json) are empty.
- Visual captures: [Low Noon](noon-low.png), [Low Midnight](midnight-low.png), [Mid Noon](noon-mid.png), [Mid Midnight](midnight-mid.png). These fresh runs used the real ready button and show four active chairs. The chase camera partly obscures nearby furniture, so these are presentation checks rather than motion approval.
- All owned Chrome test tabs were absent from the final tab inventory. The owned preview session was stopped with Ctrl+C and returned exit 130. No standalone WebGL browser was launched.

## Limits and next gate

This checkpoint admits only empty chairs. Occupied-chair reactions, direct NPC impact behavior, articulated coolers, transferable cups, useful damageable signs and social aftermath remain unfinished. Static neighbor shapes are conservative cylinders; chair interpolation, final frontier policy and coherent distance-reset acceptance remain incomplete. The current service can pause simulation at an unprepared support boundary and uses provisional retirement distances. Those are prototype safeguards, not accepted final behavior.

Desktop captures do not establish phone frame time, memory, iOS audio unlock or player feel. Before expanding content, run the phone procedure below and continue strengthening the shared ownership/support contracts.

## iPhone/iPad handoff

Use a same-network preview of this branch, not the public game on main. Start the built preview with `npm run preview -- --host 0.0.0.0 --port 8765`, substitute the Mac's Wi-Fi address for `127.0.0.1` in the encounter URL above, and open it in Safari. Stop that server after testing.

Record the device model, OS version and quality tier. Start through the ready mode button, stage an active chair, coast into it, and report whether it visibly moves, whether the impact counter changes once, and whether the game stalls or becomes noticeably less responsive. Background Safari and return, then repeat once. Capture the diagnostics if it blocks or duplicates a chair. Compare with the same URL without `physics=1` before calling any slowdown physics-related. Keep the first test muted; an explicit separate unmuted ready-button test is required to establish iOS audio behavior.

No device results have been supplied yet, and no numerical phone performance claim is made.
