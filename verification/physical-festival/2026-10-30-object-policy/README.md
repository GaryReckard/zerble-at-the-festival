# Empty objects do not cost smiles

October 30, 2026. Gary answered Q2 (Empty-object scoring): **“No smile penalty for empty objects.”** This supersedes the temporary numeric-baseline policy for empty props.

## Behavior

The shared [contact resolver](../../../src/collisionContacts.js) now returns zero damage and a separate object-bump event for empty objects. Direct people, Lurleen and puppet carriers retain their existing treatment. Explicit occupied seat slots and occupied porta-potties retain the previous consequence until the planned occupied-person handoff exists. Seat occupancy is read at contact time from physical descriptors or stage chair metadata, rather than cached.

The [live physics service](../../../src/physics/liveWorld.js) only admits empty chairs at present and now emits zero-damage object bumps. [Main's feedback branch](../../../src/main.js) retains collision sound, analytics and the existing bonk counter, without smile deduction, combo reset, punitive toast or hit flash. Neither physical resistance nor the cooldown/ghost separation is removed.

This does not establish that an occupant was struck when occupied furniture is touched. Actual support loss, bracing, person impact and consequence attribution remain part of the unfinished occupied-chair work. The current distinction uses the available explicit occupancy metadata; it is not a general occupant detector for arbitrary buildings.

## Evidence

- [People and object tests](people-tests.log) retain unchanged person consequences, exercise zero damage for empty fixed-object kinds, and test occupied-to-empty transitions for physical seat descriptors, stage seat metadata and porta-potties. The actual main feedback branch executes with scoring/HUD operations made fatal, proving an empty bump uses only collision sound, analytics and the existing bonk counter.
- [Live Rapier tests](live-tests.log) assert zero damage for camp and stage chair impacts and distinguish ordinary sound eligibility from cooldown-suppressed impacts. Existing movement, ghost, support and lifecycle assertions still run.
- [Command results](commands.txt) record full regression/build results.
- The production browser test uses the ready **Just Cruisin’** button and a staged coast into a chair. [Browser diagnostics](game-impact.json) record five active chairs and one impact, with an empty [console](console.json); zero-deduction and no-punitive-feedback assertions come from the executable tests, not from observing a score already at zero.

The test tab closed and temporary port-8766 preview exited with code 130. The previous user preview exited with code 130 before replacement. The requested port-8767 preview now serves `/tmp/zerble-object-policy.w5hRCE` and returned HTTP 200; it remains running.

## Remaining work

The scoring question is answered. Physical-phone measurements, motion acceptance and the broader occupied-chair, cooler, cup, sign, aftermath and reset work remain open. Engine-loading failure tests were interrupted by this requested policy change and remain next foundation work.
