# Separate prop feedback from person-hit kickback

October 30, 2026.

Gary identified that Zerble should react differently to objects and people. The opt-in physical-chair path explicitly called `applyHit`, which reverses the cart to 2.5 m/s, displaces it by 0.6 metres and grants 0.7 seconds of immunity. This slice removes that call for simulated props.

## Implemented behavior

[Prop feedback](../../../src/physics/propFeedback.js) reduces the magnitude of cart speed using the contacted body's actual Rapier mass and the incoming approach speed. A provisional 250 kg effective cart mass controls the arcade response. A glancing encounter removes less speed, heavier objects resist more, and feedback never reverses direction, moves the cart or changes immunity. This is an arcade approximation, not two-way momentum conservation or an accepted final tuning. The normal simulation still moves the chair.

[Main](../../../src/main.js) retains priority for an already-selected damaging legacy contact. The [adapter](../../../src/physics/rapierAdapter.js) now includes body mass in its copied state and [live physics](../../../src/physics/liveWorld.js) includes mass and approach speed in the selected impact.

## Verification

- [Targeted tests](targeted.log) exercise real Rapier camp and stage chair impacts, asserting finite positive mass and eligible approach speed. They execute the actual main-loop feedback branch for forward/reverse travel, several masses, glancing contact, unchanged position/immunity and a simultaneous damaging person contact.
- [Full checks](check.log) and [production build](build.log) passed.
- The isolated production preview started through the ready **Just Cruisin’** button. The existing encounter and coast buttons produced one impact with four active chairs; [diagnostics](game-impact.json) and [console](console.json) were saved. The console was empty. Browser evidence proves integration and a completed impact, while the numerical response assertions come from the executable tests.
- The agent's Chrome tab was closed and temporary port-8766 server exited with code 130. The user-facing port-8767 preview now serves this separately built, verified version from `/tmp/zerble-prop-feedback.y0PTje`; a localhost request returned HTTP 200. The old preview exited with code 130.

## Remaining decisions and coverage

The question about removing smile penalties for empty objects is pending; this slice does not change scoring, hit flashes or collision toasts. Fixed obstacles, unadmitted chairs and occupied furniture retain their legacy path. They require distinct resistance and consequence handling, and occupied reactions still require the planned person-support integration. Phone measurements and Gary's motion acceptance remain pending. Cups and coolers are not enrolled by this change.
