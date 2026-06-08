# Council — The Anthropologist (Experience Advocate)

**Deliberation:** 003 — Festival layout grammar (the hub redesign)
**Persona:** Anthropologist — player + maintainer experience lens
**Date:** 2026-06-07
**Verdict:** **Proceed with mitigations**

---

## Summary

The grammar is the right diagnosis and the right fix *for the feel problem
Gary actually reported*. He drove the festival and the words in the backlog are
not "too sparse" or "too dense" — they're "stage facing water with chairs IN
the water," "a vendor row punched through a stage," "the arch dumped mid-row."
That is an **arrangement** complaint, and a single front axis `F` that every
piece obeys is exactly the structural answer. Through my lens it earns a Proceed.

But the grammar redesigns *spatial relationships the existing harness cannot
draw*, and it changes the single most important player moment in the game — the
first ten seconds, the drive-in — in a way **neither sandbox can show**. The
002 council already made the 2D POI overlay a binding harness-first gate (R21);
that overlay shipped, but it draws the OLD vocabulary (dots, footprint rings,
yaw ticks). It does not draw the front axis, the dancefloor clearing, the
sectoring, or the spawn arch — the four things this grammar is *about*. So the
harness-first doctrine fires again, one level deeper: **extend the overlay to
render the grammar's new primitives before writing the grammar against the
running game.** That is my Key Concern and my first order of operations.

Grounded in: the backlog (Gary's playtest words, A1–A8/G1/D1–D3), the spec
§3/§4/§6, the current overlay draw loop (`map-sandbox.html:267-312`), the
current spawn code (`main.js:218-244`), and the entity-sandbox model list
(`sandbox.html:180-181`).

---

## Order of Operations (my prioritized sequence)

My ordering optimizes for **two experiences in lock-step**: the player's
arrival/drive-in feel, and the next agent's ability to verify a hub layout in
seconds without driving. The grammar's whole value is *spatial relationship*,
and a spatial change you can't see is a change you can't tune.

**1. Extend the map-sandbox overlay to draw the GRAMMAR'S primitives — FIRST,
before any `_computePlan` rewrite.** (Harness-first; the 003-level analogue of
002's binding R21.) Today `map-sandbox.html:267-312` draws each POI as a dot /
ring / yaw-tick. That vocabulary was sufficient for "where do clusters land";
it is **insufficient for "does this hub read as a designed festival."** The
overlay must additionally render, per hub:

   - **The front axis `F`** as a drawn ray from the hub center (the keystone of
     the whole grammar — §3). If `F` is wrong, *everything* is wrong, and right
     now it would be wrong silently.
   - **The road outward-bearings + the angular gaps**, with the *chosen* widest
     dry gap highlighted, so a human can eyeball "yes, `F` bisects the widest
     dry gap, and the water penalty pushed it off the lake" (§3 steps 1–2)
     without reverse-engineering it from a stage square's rotation.
   - **The dancefloor clearing rect** (oriented, ~3 stage-lengths deep ×
     stage-width+margin — §4), drawn as the actual rectangle, because its DEPTH
     and WIDTH are feel-tunables Gary will want to dial. A "~3 stage-lengths"
     number is a guess until it's drawn against a stage footprint.
   - **The sector tint** (front = dancefloor, drag = rows/court, back = camps +
     drum) so the "stage off to the side as you arrive" intent (§6) is legible
     in 2D, and so the overlap-guard pushes (§5) are visible when they fire.
   - **The spawn arch + the spawn point + the drive-in vector**, on the spawn
     hub only — see step 4; this is the moment that must be verifiable in 2D
     before it's verifiable in 3D.

   Add nothing to the importmap (festival.js is already in the `wg` array at
   `map-sandbox.html:26-28`). This is ~an afternoon of canvas drawing against
   data `festival.js` already exposes, and it converts "drive the game and squint"
   into "open the map sandbox and read it." Per the doctrine, **this comes before
   the feature, not after.**

**2. Build + unit-check the front axis `F` (`§3` scoring), pure, in
`festival.js`.** This is the keystone and it is headlessly checkable — feed it a
hub with hand-placed roads + a lake, assert the chosen bearing bisects the
widest dry gap. Verify it in the step-1 overlay across a dozen seeds (a hub with
1 road, 2 roads at various angles, 3+ roads, 0 roads, a hub hard against a lake).
**Do this before re-anchoring a single entity** — every §4 rule reads `F`.

**3. Re-anchor stage → dancefloor → chairs/blankets → drag → rows → court →
bubble → drum → porta to `F` + the §4 rules + the §5 overlap guard.** Verify
each addition in the overlay as it lands (the spatial diff is the whole point).
The dancefloor clearing rect must be **exposed as data** here so step 5 can
consume it.

**4. The spawn arch + the drive-in — verify the NEW arrival in 2D FIRST, then
3D.** This is the moment that decides whether the redesign "worked" for the
player, and it is a **behavior change to existing code**, not just new content.
The current `main.js:218-244` spawns Zerble on the arch→stage axis facing the
stage *head-on* (`zerble.heading = atan2 toward stage`). The spec §6 *changes*
this: arch straddles the approach road, Zerble spawns just outside it on the
road facing inward, and the stage reads **off to the side** because `F` points
at a gap, not down the road. That is a deliberately different arrival than what
ships today. It must be:
   - drawn in the overlay (arch position, spawn point, heading vector, where the
     stage sits relative to the drive-in line) so the "off to the side, not
     head-on" geometry is confirmed *before* booting;
   - then booted in the real game with `__dbg` and screenshotted at the arrival
     point, noon AND midnight.

**5. Dancefloor tree-clearing → `scatterWorldgenTrees` honors the oriented
rect (A4).** Park-able to right after the spine if step 1's overlay already
shows the rect, because the *clearing* is verifiable in 2D and the *trees-gone*
result is verifiable in 3D quickly once the rect is data.

**6. THEN the rest of the backlog** (B tent-stage/drum-circle variety, C tiki/
hammock/picnic-table, D camps, G blankets) and the density re-settle. These are
texture on a hub that already reads right; they should not gate "does a hub read
as designed."

**Park to fast-follows (feel-acceptable, not silent cuts):** picnic-table
seating behavior (C2 crowd state), hammock-between-trees post-pass (C1),
lone-field-trees (F1), tent-count-tied-to-crowd (D2) — all are *additive
texture*, none of them change whether a hub reads as a coherent festival on
arrival. Track them on ROADMAP so the between-hub "it's all one festival"
continuity (the backlog's framing) isn't quietly lost.

---

## Experience Concerns

### Player

- **The arrival is the whole game's first impression, and the spec CHANGES it.**
  Gary's worst playtest words are about the hub a player *drives into*. The new
  §6 arrival (arch on the road, stage off to the side) is a real bet: it trades
  the dramatic head-on stage reveal that `main.js:228` produces today for a
  "main gate at the end of the street, festival opens up around you" reveal.
  Gary chose this deliberately (§8 fork 2), and it is the more *festival-like*
  arrival — you don't walk into a real festival staring down the main stage,
  you come through a gate and the grounds unfold. **But "stage off to the side"
  has a failure mode: it can read as "where's the stage?"** If `F` points at a
  gap that happens to be 90° off the road, the stage could be nearly
  perpendicular to the drive-in and barely in frame at arrival. The feel
  question — *does the festival announce itself, or does the player drive in and
  see open field?* — is answerable ONLY by seeing the arrival geometry. That's
  why step 4 verifies it in 2D before 3D. The risk is not the idea; it's
  shipping the idea unverified.

- **"~3 stage-lengths" dancefloor depth is a feel-tunable, not a spec
  constant.** Too shallow and the chairs/blankets crowd the stage (the "carpet"
  feel Gary disliked — G1); too deep and the dancefloor reads as empty field
  between the player and the band, killing the "festival is alive" density the
  backlog wants. This number wants to be *dialed in the overlay against a drawn
  stage footprint*, not picked once in code. Draw it (step 1) so it's tunable.

- **The "one infinite festival" continuity depends on the GAPS not feeling
  dead.** Gary's framing (backlog top, design.md is silent on it): hubs are
  gathering areas *within* one festival; the space between is still the
  festival, just chiller. The grammar puts camps + drum circle in the BACK
  (`−F`) of each hub and tucks small camps behind vendor tents (D1/D3) — good,
  that bleeds festival out of the hub. But the grammar says nothing about the
  *inter-hub* stretch. If hubs are tight, sectored islands surrounded by bare
  field, the drive *between* them will feel like dead air between discrete
  events — the exact thing the framing warns against. This isn't a blocker for
  the grammar (it's a density-re-settle concern, backlog step 8), but the
  grammar's "woods stay at the back/sides, we only clear the front" rule (§3,
  A4) is what keeps a hub from looking like a clear-cut island. **Keep that rule
  load-bearing**; it's the continuity glue, not just atmosphere.

- **Mobile / readability-in-motion:** at driving speed on a phone, a player will
  perceive the *gestalt* — stage front + cleared dancefloor + crowd + the gate —
  long before they parse any individual prop. That's an argument FOR the grammar
  (a coherent silhouette reads at distance; confetti placement doesn't) and an
  argument that the overlap-guard (§5) matters more than fine prop tuning: two
  clusters overlapping reads as broken at any distance; a porta-bank 3m too far
  from a court does not. Prioritize the guard's correctness over prop polish.

- **Easter-egg hygiene:** the grammar is all worldgen — no README/title-card
  copy touched, no exposure of the `t` menu / Wook trip / `?perf=` flags. Clean.
  The one watch-item: the entrance arch banner (A2) — if its copy ever changes,
  keep it "FESTIVAL" and don't editorialize. Pure geometry fix; no tone risk.

### Next agent / dev

- **THE harness gap (my Key Concern):** the 002 council made the 2D POI overlay
  a binding gate *for the old vocabulary* (R21), and it shipped — but it draws
  POIs as **independent markers** (`map-sandbox.html:280-310`: stage square +
  yaw tick, court ring, vendor line, drum dot, camp dashed circle). The whole
  thesis of THIS deliberation is that the pieces are NOT independent — they obey
  a shared `F`. **The overlay cannot draw `F`, the angular gaps, the dancefloor
  rect, the sectors, or the spawn arch.** So the single most important thing this
  grammar produces — *the relationship between the front axis and everything
  else* — is invisible in the one harness that's supposed to show spatial layout.
  The next agent tuning the dancefloor depth or the water-penalty weight (§3)
  would be back in the slow drive-and-hunt loop the doctrine condemns. **Extend
  the overlay first** (order-of-ops step 1). This is the 003-level recurrence of
  the exact gap 002 caught one layer up.

- **One-URL verifiability for a HUB, not a prop.** Today `map-sandbox.html`
  deep-links by `seed`/`center`/`zoom` (the writeURL path). A reviewer wants to
  re-open *a specific hub that reads right* and *a specific hub that reads wrong*
  across iterations. The overlay already centers by URL — make sure the extended
  draw is on by default (the `festival` layer is already `checked`,
  `map-sandbox.html:88,117`) so `?center=<hubX>,<hubZ>` lands you on a drawn,
  sectored hub. That's the "one URL = exactly this change" property the doctrine
  demands, applied to a hub instead of an entity.

- **The 3D side has a real, named gap for THIS change: the drive-in arrival is
  un-sandboxable.** `sandbox.html` draws ONE entity (`sandbox.html:180-181`
  model list; cases like `stage_main` at `:1115`). There is no composite that
  shows a stage + its dancefloor + the arch + the spawn vector together — and by
  the project's own 002 reasoning (Tension D resolution), a 3D `festival_heart`
  composite was **declined** because it would re-implement the build half and
  risk the `buildCampChair` sandbox-passes-game-fails class. I agree with that
  call: do NOT build a 3D hub composite. **But that means the arrival can ONLY be
  verified by booting the real game** (`__dbg.start()` → the spawn relocation in
  `main.js:218` runs → camLock at the arrival point → screenshot). The 2D overlay
  shows the *geometry* (step 4); the real game shows the *feel*. There is no
  shortcut, and the spec's build-order step 5 ("boot + verify one hub reads
  right, noon + midnight, low + default tier") is the right and only way to close
  it. Make that boot-the-arrival check explicit and non-skippable.

- **Self-documenting the keystone:** `F` is a new concept a future reader will
  hit cold. The "widest dry gap bisector" rule (§3) is non-obvious and exactly
  the kind of *why* that earns a comment under the project's "comment the
  constraint, not the code" bar (CLAUDE.md Conventions). One comment block at the
  `computeFrontAxis` function explaining *why* a gap-bisector (so the dancefloor
  never faces down a road or at a lake — A3 by construction) will save the next
  agent the reverse-engineering. The existing `festival.js` header (lines 17-41)
  is the model for that bar.

- **Debuggability when the arrival breaks:** if `F` resolves wrong or the arch/
  stage spacing collapses, the symptom is "Zerble spawns facing nothing" or
  "spawns in/at a structure." `main.js:235` already has a lakeAt walk-forward
  clearance; the new failure mode (stage off-side → arch→stage vector no longer
  the spawn-out vector) needs the same defensive care. `__dbg.teleport` +
  `camLock` reach it; make sure the spawn block logs the resolved hub/arch/stage
  so `preview_console_logs` surfaces a bad resolve instead of a silent
  face-the-void.

### Cognitive Load

- **For the player: net REDUCTION.** A hub with a clear front (stage +
  dancefloor) and a clear "around the side" (market + food) is *easier to read*
  than the current confetti. The grammar lowers the player's parse cost. Good.

- **For the agent: one genuinely new concept — the front axis `F`.** Everything
  else is a re-anchor of existing rules (the 002 council already established the
  build half is ~70% re-calls). `F` is the one new mental model, and it's a
  clean one (a hub has a front and a back). The cost is acceptable *provided it
  is drawn* — an undrawn `F` is a high-cognitive-load invisible variable; a drawn
  `F` is a low-cognitive-load arrow on a map. Step 1 is what keeps this cheap.

- **The overlap guard (§5) is a second small new concept** (push-outward-or-drop),
  but it reuses the familiar footprint-radius the descriptors already carry
  (`KIND_FOOTPRINT`, `festival.js:63-66`). Low marginal load, high safety value.

---

## Experiences Not Addressed

- **As a player, I'd expect the festival to "announce itself" as I drive in
  through the gate**, but the spec's "stage off to the side" arrival (§6) doesn't
  guarantee the stage is even *in frame* at the spawn point — if `F` bisects a
  gap ~90° off the approach road, the player could come through the arch and see
  open dancefloor/field with the stage at the periphery. The spec says this is
  "a main gate at the end of the street, not a head-on stage shot" — but it
  doesn't bound *how far off* the stage can read. **Gap:** no constraint that the
  stage is within some arrival-cone of the drive-in vector. Mitigation: draw the
  arrival (step 1/4) and, if it reads as "empty field on arrival" across seeds,
  add a soft preference for an `F` whose gap is *not* near-perpendicular to the
  primary road — or accept it and let the market/gate carry the "you've arrived"
  signal. **Decide this by looking, not by spec.**

- **As a player, I'd expect the GAPS between hubs to still feel like the
  festival** (the backlog's explicit "one infinite festival" framing), but the
  grammar is entirely hub-local — it says nothing about the inter-hub stretch.
  **Gap:** the continuity that Gary's framing makes load-bearing is deferred to
  the density re-settle (backlog step 8) and isn't a grammar concern at all.
  That's *acceptable sequencing* (you can't tune the gaps until a hub reads
  right), but it should be **tracked, not silently assumed** — the risk is that
  "a hub reads great" ships while "the drive between hubs feels dead" remains,
  and that's still a disappointed-playtest outcome. Carry it as a ROADMAP item so
  it isn't lost behind the grammar win.

- **As the next agent, I'd be unable to tune the dancefloor depth or the §3
  water-penalty weight cheaply** because the overlay draws neither the front axis
  nor the dancefloor rect — I'd be reduced to booting the game and eyeballing.
  **Gap:** the harness shows POI dots, not the grammar's geometry. Closed by
  order-of-ops step 1 (the binding mitigation below).

- **As the next agent, I'd be unable to verify the new ARRIVAL in any sandbox at
  all** — `sandbox.html` is one-entity, and a 3D hub composite is (correctly)
  declined. **Gap:** the arrival is real-game-only by construction. Not a
  harness *failure* (it's the right call), but it must be an explicit,
  non-skippable boot-check in the task list — the §6 arrival is a behavior change
  to `main.js:218-244`, and behavior changes to the boot path are where
  sandbox-pass/game-fail bites (CLAUDE.md "ALWAYS boot the main game").

---

## Verdict

**Proceed with mitigations.**

The grammar is the correct fix for the feel problem Gary reported, the front
axis is a clean and player-legible mental model, and the arrival redesign is a
defensible (Gary-chosen) festival-authentic bet. My domain's binding conditions:

1. **(Binding, harness-first) Extend the map-sandbox overlay to draw the
   grammar's primitives — front axis `F`, the road gaps with the chosen widest
   dry gap, the dancefloor clearing rect, the sector tint, and the spawn
   arch/spawn-point/drive-in vector — BEFORE rewriting `_computePlan`.** This is
   the 003-level recurrence of 002's R21 gate, one layer deeper: the old overlay
   draws the old (independent-marker) vocabulary; the grammar's value is the
   *relationship*, which the overlay cannot currently show. Cheap (data already
   exposed, importmap already wired); non-negotiable per the doctrine.

2. **(Binding) Verify the §6 arrival in 2D first, then boot the real game and
   screenshot the arrival at noon + midnight** — it's a behavior change to
   `main.js:218-244`, not just new content, and "stage off to the side" has a
   real "where's the stage / empty-field arrival" failure mode that is only
   answerable by looking.

3. **(Non-binding, track-don't-cut) Carry the inter-hub continuity ("one
   infinite festival" gaps must not feel dead) on ROADMAP** so the density
   re-settle owns it explicitly, and **draw the dancefloor depth so it's a dialed
   feel-tunable, not a fixed `~3 stage-lengths` guess.**

A drawn front axis turns the one new concept from an invisible variable into a
readable arrow; an undrawn one ships the redesign blind. Draw it first.
