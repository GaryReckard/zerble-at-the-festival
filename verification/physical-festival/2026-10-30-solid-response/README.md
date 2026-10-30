# Fixed-object response separation

October 30, 2026. Follow-up to [simulated prop feedback](../2026-10-30-prop-feedback/README.md).

## Behavior

The shared [collision resolver](../../../src/collisionContacts.js) now selects the person-hit kickback only for ordinary people, children, wooks, brass performers, hoopers, one-wheel riders, Lurleen and puppet carriers. Other solid candidates use [Zerble's obstacle response](../../../src/zerble.js).

The obstacle response resolves the measured overlap with a 1 mm separation margin and removes incoming motion from the heading-constrained arcade speed. A square contact stops the cart; a glancing contact preserves some motion. Neither forward nor reverse driving is forcibly reversed. This is not a lateral sliding solver: the cart still travels along its steering heading. Simulated props retain their separate mass-sensitive response.

The existing 0.7-second collision cooldown and smile penalties remain unchanged while Q2 (Empty-object scoring) is unanswered. This means scenery still shares the legacy immunity gate; separating consequence cooldown from continuous solid collision is further work. Occupied seats do not yet brace, fall or transfer their occupants, and furniture contact is not itself proof of a person impact.

## Evidence

[Collision tests](../../../bin/test-people-collisions) retain the historical matrix for person responses, consequences, callbacks and ordering. For changed scenery cases they assert bounded speed, no forced reversal, no person-response call and resolved overlap. Additional direct cases cover camp/stage chairs, loveseats, cooler, tree, tent, stage, sign, porta-potty and nut wagon in forward and reverse, plus a glancing tree contact. These are collider-policy tests; including a kind does not claim that its future dynamic model or sign placement is implemented.

- [Targeted output](targeted.log) records the tested contact policy.
- Full regression and build results are recorded in [command results](commands.txt).
- The production preview booted through the ready **Just Cruisin’** button on Low with physics disabled near the seeded stage. [Game UI](game-start.txt) shows the running HUD; [console](console.json) is empty. This verifies startup with the legacy obstacle path present, not a recorded browser collision. Exact contact behavior is established by executing the real resolver and obstacle method in tests.
- The agent-created Chrome tab closed and its isolated port-8766 preview exited with code 130. The user-facing port-8767 preview now serves `/tmp/zerble-obstacles.OHzJVH`, confirmed with HTTP 200, and remains running by request.

## Next acceptance

Gary's scoring decision and physical-phone results remain pending. Continue the broader physical-festival plan, including occupied-support reactions, cooler, cups, signs and distance reset. Do not mark the full contact task complete from this response change alone.
