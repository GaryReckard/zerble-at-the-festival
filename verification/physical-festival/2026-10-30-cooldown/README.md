# Collision cooldown preserves solid contact

October 30, 2026. This closes the immunity/solidity gap recorded in the [fixed-object response checkpoint](../2026-10-30-solid-response/README.md), without deciding the pending empty-object scoring policy.

## Behavior

[Main](../../../src/main.js) now collects and resolves legacy collisions whenever star power is inactive, including during the existing hit cooldown. The [resolver](../../../src/collisionContacts.js) skips people during that cooldown but still resolves solid objects. Suppressed contacts return no damaging event and invoke no contact callback. [Zerble's obstacle response](../../../src/zerble.js) does not refresh the cooldown when consequences are suppressed.

[Live physics](../../../src/physics/liveWorld.js) independently applies its episode-limited physical response while marking the event non-damaging when penalty eligibility is false. Thus cooldown and god-mode penalty protection no longer suppress movable-prop resistance. Star power still disables those contacts. A contact first handled during immunity consumes its response for that episode rather than charging a delayed penalty when immunity expires.

## Evidence

- [People/solid tests](people-tests.log) execute the actual main-loop collision block and resolver: forward/reverse solid contacts during immunity resolve overlap and stop incoming motion, skip person callbacks, suppress repeated damage, and preserve the remaining cooldown. The actual main-loop star-power gate makes no collision query while ghosting.
- [Live-engine tests](live-tests.log) add an immune cart encounter to the real Rapier chair fixtures, proving a physical impact with mass/approach feedback and no damaging event. The existing ghost encounter verifies passage without chair movement. Existing main-loop response tests cover slowdown without person kickback or immunity changes.
- [Command results](commands.txt) record the full regression and production build outcomes.
- [Browser diagnostics](game-impact.json) record five active chairs and one impact; [console inspection](console.json) is empty. It is a startup/integration check, not a browser reproduction of the short immunity interval; that interval is covered by the executable main-loop and real-engine tests.

The agent-created Chrome tab closed, and the isolated port-8766 preview exited with code 130. The earlier user preview also exited with code 130 before replacement. The requested port-8767 playtest now serves `/tmp/zerble-cooldown.ASVpmA`, returned HTTP 200, and remains running.

## Limits and next work

This preserves the existing first-selected-contact resolver and numeric penalties; it does not implement a multi-obstacle sliding solver or new social policy. Empty-object scoring still awaits Gary's answer. Phone timing, motion acceptance, occupied support/recovery, cooler, cups, signs and coherent distance reset remain unfinished in the broader plan.
