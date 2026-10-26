# Vendor market activity, October 25, 2026

## Behavior and repeatable checks

The [production crowd controller](../../../src/crowd.js) reserves one customer
frontage per loaded vendor, walks there around solid colliders, browses for
5–12 seconds, chats for 3–6 seconds, then purchases with a 65% chance and a
2.5-second handoff. Buyers carry a paper bag for 55 seconds, while all visitors
leave toward the aisle and receive a 30–55 second shopping cooldown. These are
ambient transactions; they do not change the player's smiles or inventory.
Conversation is conveyed through facing and gestures, without synthesized speech.

The [tent builder/updater](../../../src/models/tent.js) puts every keeper behind
its sales counter facing the opening, adds small workspace shifts and greeting
arm movements, and retains bedtime and evening lighting. The former placement
rolls are consumed unchanged so later world-generation rolls retain their sequence.
The sleeping spot is behind the sales counter.

`node bin/test-vendor-shopping` executes the production visit and keeper logic
against controlled registry/collision fixtures. It covers exclusive claims,
buyers and non-buyers, the full visit sequence, departure direction, rotated
frontage, blocked spots and solid avoidance, closing/unload/interruption release,
greeting/reset/reopening, and identical RNG consumption across 150 keeper
placements. It also evaluates the actual production row-facing expression for
both sides of three road rotations. `node bin/test-evening-vendors` passed.
The full `npm run check` passed ([log](check.log)); the final rear-bed adjustment
and added keeper/row-facing assertions were then checked with both focused tests.

## Browser evidence

The in-app browser ran the real crowd preview at
`sandbox.html?entity=vendor_activity&perf=low&mute=1`, repeated with `perf=mid`.
The fixture has two opposing booths and eight ordinary NPCs, and its status line
reports the live production states. It completed purchases at both tiers; the
Mid capture shows four purchases, four bags, one browser and one conversation.
Midnight clears active visits and puts the keepers to bed; Morning reopens them.

- [Noon, Low](noon-low.png)
- [Noon, Mid, including completed purchases](noon-mid.png)
- [Midnight, Low](midnight-low.png)
- [Midnight, Mid](midnight-mid.png)
- [Live game market states](live-market-status.png)

The real game loaded its title card and started with a ready Just Cruisin' plank
click at seed `1234`, Low. `/tp -83 113` reached the planned vendor row, and
`/npc status` subsequently reported `market_walking` and `market_chatting` alongside
table, hammock and camp routines. The live game produced no console warnings or
errors. The final fresh Low preview also had no warnings or errors.
An initial preview-only call used the wrong spawn method; that was corrected to
the production `Crowd.spawn` API before the successful captures.

## Rendering cost and limits

In the same eight-person preview, the measured no-bag baseline was 41 draws and
12,888 triangles, while a visible bag batch was 42 draws and 13,496 triangles.
The 608-triangle difference includes all eight indexed bag slots, including
zero-scale unused slots. The batch is hidden when no NPC carries a bag, and bags
cast no shadows. Existing keeper meshes supply the gestures, without extra
geometry. Midnight also adds the existing bed meshes, so it is not a bag baseline.

These are scene-counter and desktop correctness checks, not phone performance
measurements or iOS audio-unlock verification. The browser was muted throughout.
The preview and live-game tabs were closed and the task-owned server stopped
when verification finished; no standalone headless browser was launched.
