# Real secondary encounters and reusable untouched capacity

October 30, 2026, Low tier, opt-in `physics=1`.

## Behavior

[LiveWorld](../../../src/physics/liveWorld.js) now restores an untouched sleeping
prop's original instance before admitting the next neighborhood when it is at
least 32 metres from Zerble, offscreen, has no current occupants or active contact,
and remains within 2 cm and about one degree of its authored pose. Recorded cart
hits and live incident history prevent this restoration. Meaningfully displaced
aftermath keeps its ownership; this is not the full coherent arrangement-reset
policy. Expired preparation deadlines perform no releases. Restored originals
remain registered and can be admitted again on return.

The opt-in panel adds **Toss prop toward pedestrian**, which chooses among the
eight admitted props and four prepared ordinary people. It applies a real impulse
to an empty prop within five metres, aiming at the pedestrian's predicted position
after 0.4 seconds. The pedestrian is not relocated, frozen or claimed at launch.
The selected endpoint must fit the prop's resident support window. Existing
solver contacts may intercept the throw, and the person may walk out of its path.
Diagnostic attribution uses `physics-fixture`, not Zerble. No score policy changes.

## Tests and browser evidence

- `node bin/test-physics-cooler` fills all eight slots with actual coolers, proves
  visible/deadline protection, restores offscreen untouched originals, admits the
  ninth cooler and readmits the original neighborhood on return. Existing real
  impacts at 30/60/120 Hz also prove displaced coolers are not restored at 60 m.
- `node bin/test-physics-live-people` launches an actual stage chair through the
  production live-world method, terrain preparation, engine, sweep, incident
  ledger and Crowd claims. The chair produces one secondary hit and one recovery,
  with zero direct cart impacts and no target movement/claim at launch.
- `node bin/test-physics-prop-people` adds a heavy-prop two-victim case. Both
  generation-qualified targets are recorded once and opposing momentum balances;
  the lighter-prop case spares the later target after momentum is consumed.
- `node bin/test-physics-incidents` covers renewed incidents, per-target duplicates,
  recycled generations, source/instigator retention, expiry and hop/capacity bounds.
- `npm run check` and `npm run build` passed. The added cooler and multi-victim
  assertions were also rerun directly after the full check started.

Real Chrome booted through the ready **Just Cruisin'** control, muted, seed 1977.
At `x=-1025&z=-482`, **Stage cooler encounter** previously stalled with eight
active chairs; it now reached four active props and **Target: active**.
The [cooler snapshot](cooler-ready.json) preserves the readout and runtime state.

At `x=-1035&z=-478`, the toss selected a nearby stage chair and an existing
ordinary pedestrian. A rendered observation showed a fall, and the
[result](secondary-result.json) records `propHits: 1`, `started: 1`, `completed: 1`,
and zero direct cart impacts. A subsequent Midnight toss produced a [second fall and recovery](midnight-result.json). Console inspection found no warnings or errors.

The [Noon](low-noon.png) and [Midnight](low-midnight.png) screenshots are aftermath
captures, not isolated close-ups of the impact. Both were inspected. They preserve
the existing model appearance and show the runtime counters, but do not establish
animation/art acceptance. Whole-world counters are roughly 1,000 draws and
530,000 triangles in this populated scene; these are not a matched performance
comparison or a phone result. No new model geometry or materials were introduced.

## Acceptance and next work

Task 4.3 (bounded incident provenance) now has source, lifetime/hop, renewed-hit,
single/multiple-victim, duplicate and expired-history evidence. Indirect scoring
and social responses belong to task 6.3 (score and social policy gate), which
remains open. Moving-person trajectory sweeps, supported-person secondary delivery,
graduated reactions, full reset semantics, phone performance and the remaining
cooler/drink/sign/aftermath groups remain unfinished.

The diagnostic can legitimately report no prepared pair as people move away.
Start near the stage chairs at the coordinates above, wait for preparation and
use the toss while people are nearby. It does not manufacture a victim to make
the test pass.
