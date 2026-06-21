## The Architect's Position

### Priority Sequence

1. **Keep `festivalPlan(heart)` per-heart-pure and memoized. Do NOT make the
   memoized plan seam-aware.** A plan that reads neighbours' plans is the exact
   recursion/cache-warming dead end the senior-keep-out experiment already hit
   (session-log "Playtest round 2": ~8 s/plan, would hang chunk gen). The
   memoization gate (`planGate`, `festival.js:493`) and the per-heart ownership
   contract (`placement.js:1-19`) are load-bearing and must survive intact.
2. **Make the SEAM RESPONSE a pure cross-heart reconciliation function over the
   already-classified seams — `seamResponsesNear(bounds)` — built on the
   `classifySeamsNear` substrate that already exists** (`festival.js:355`). This
   mirrors the three established cross-heart read functions
   (`dancefloorRectsNear`, `drumClearingsNear`, `stageDeckClips`) the chunk
   builder already consumes load-order-independently.
3. **Split the response into two mechanically distinct halves by lifecycle owner:
   (a) SUPPRESSION** (trim/merge/yield = "this descriptor doesn't build, or
   builds shorter") applied as a *filter* over `festivalPlan(h)` at consume time
   in `placeChunkProps`/`placeWorldgenProps`; **(b) ADDITIVE buffer/path records**
   (soft_buffer trees/hammocks/potty/connector) emitted as their own
   chunk-keyed descriptors owned by a single deterministic side of the seam.
4. **Only THEN remove `neighbourCourtHere` + `stageDeckClips`** — and only once
   the new function reproduces their effect on the recorded playtest pins (the
   seed-1139472710 court pair, the drum-vs-stage case). The removal is the last
   step, gated by a registry-snapshot diff on those exact seeds.

### Where the seam logic belongs (briefing Q6 — the core question)

**Verdict on Q6: a separate post-plan reconciliation pass — NOT a seam-aware
memoized plan.** The repo's own architecture already answers this, three times.

`festivalPlan(heart)` has a contract that the rest of the worldgen layer depends
on:

- It is **memoized, gated on `(seed, epoch)`** (`festival.js:18`, `:511-521`,
  gate at `:493-496`).
- It takes **ONLY the heart, never a chunk window** — this is what closes the
  window-invariance class (`festival.js:20-22`; `placement.js:11-15`).
- It is the **unit of ownership**: cluster-center ownership means the owning
  chunk builds and `chunkKey`s the *whole* plan, spilling into neighbours
  (`placement.js:2-5`, `:43`).

Making it seam-aware breaks all three:

- **Recursion / cache-warming.** `_computePlan(A)` would call
  `festivalPlan(B)`, whose `_computePlan(B)` would call `festivalPlan(A)` —
  mutual recursion through a half-populated cache. To avoid it you'd need a
  non-recursive `basePlan`, which is exactly what the senior-keep-out experiment
  built and then **reverted** for being ~8 s/plan and "wrong at this density"
  (session-log, Work Log 2026-06-14 "Playtest round 2": ~162 hearts/~81 seniors
  × ~80 ms base-plan, nearestRoad-dominated, "would HANG chunk gen").
- **Window-invariance regression.** If A's plan content depended on B's plan,
  then whether B was in the enumerated set could change A — re-introducing the
  exact "appear/vanish based on which chunk asks" class `placement.js:11-15` was
  written to kill.
- **Order dependence inside the plan.** Briefing Q2's worry is real *only if the
  decision lives in the plan*. Resolve it where the substrate already is
  order-free.

The clean home is the pattern the codebase already uses for every cross-hub
decision: a **pure "near a region" function that reads memoized per-heart plans
and derives an order-independent answer without mutating any plan.**
`classifySeamsNear` (`festival.js:355-375`) is *already exactly this* — it calls
`festivalPlan(seam.keeper)` / `festivalPlan(seam.yielder)` (`:358-359`) but
"emits NOTHING into any plan, so both goldens stay frozen" (`:353-354`). 4B.3 is
the natural continuation: `seamResponsesNear(bounds)` consumes
`classifySeamsNear` and returns a list of `{ suppress: [...descriptorIds],
trimTo: {...}, add: [...descriptors] }` keyed by seam. It is pure, takes a
region window (used only to *select*, like `placement.js`), reads memoized
plans, and writes nothing back.

This keeps the golden move minimal: the **POI golden hashes `festivalPlan`
output** (session-log D-spike, `festival.js:288` provenance). If the response is
a consume-time filter + additive cross-heart records, `_computePlan` itself is
**unchanged**, so the per-heart POI golden need not move at all — only a *new*
seam-layer snapshot is recorded. That is a strictly safer second move than
re-touching `_computePlan`. (See "The second golden move" below — this reframes
Q3.)

### Module boundaries — where the new records live, and the chunkKey lifecycle

The response splits cleanly by lifecycle owner. This is the part most likely to
go wrong, so be explicit:

**(a) SUPPRESSION (merge / trim / yield) = a filter, not a new record.**
`merged_court` and `yield` are *omissions* of the lower-priority side's
descriptor; `trim` is a shortened vendor row. These must NOT be emitted as new
chunkKey'd entries — they are the *absence* (or reduction) of an existing one.
Apply them at consume time:

- The clean seam: `placeChunkProps` already filters `festivalPlan(h)` per chunk
  (`placement.js:43`). Add a sibling step that fetches `seamResponsesNear(bounds)`
  once per chunk (like `danceRects`/`drumClears` at `chunks.js:1026/1036`) and
  drops/shortens descriptors whose `(heart, clusterSeed/idx)` the response marks
  as yielded.
- **Determinism of suppression is integer-clean** because the *keeper* is chosen
  by `getHubPriority` (uint32, `festival.js:257-259`) with `(cx,cz)` lexicographic
  tie-break (`:287-289`) — no float gates existence (D8/D21 honoured). Both hubs
  derive the identical keeper from the shared canonical pair (`:283-285`), so
  whether chunk A or chunk B streams first, the *same* side yields. This is the
  precise property the band-aids lack: `neighbourCourtHere` (`chunks.js:1173-1183`)
  is "load-order-dependent BY DESIGN" (`chunks.js:1171`) and reads the live
  `registry.byKind.get('truck')` — it cannot agree across load orders.

**(b) ADDITIVE buffer/path records (soft_buffer) = chunkKey'd, single-owner.**
The connector path, buffer trees, hammocks, shade seating, and the buffer's
potty bank ARE new geometry. They must enter the registry like every other
festival prop — `chunkKey: ctx.key` so `_unload → registry.removeChunk(key)`
(`chunks.js:547`, `registry.js:59-64`) drops them when their chunk leaves. The
hazard: **a seam straddles a chunk boundary, and the two hubs' chunks unload
independently.** Two structural rules keep this sound:

1. **One owner per seam record.** The seam already names a canonical `keeper`
   and a deterministic `seamHash` (`festival.js:290`). Anchor every additive
   buffer record to the **keeper's plan-space position**, so it is owned by
   exactly ONE chunk (whichever chunk contains that anchor point) — cluster-center
   ownership extended to the seam (`placement.js:2-5`). Never let both sides emit
   half the buffer; that double-builds across the seam (the exact thing the
   half-open `inChunk` test at `placement.js:29-31` prevents for plans).
2. **chunkKey the buffer; do NOT copy the lake exemption.** Lakes omit
   `chunkKey` (CLAUDE.md tripwire #5) so their colliders survive when a host
   chunk drops — they are 320 m macrocell entities with their own load/unload by
   distance. A seam buffer is festival furniture at hub scale; it has no
   independent lifecycle and MUST unload with its owning chunk. Tagging it
   chunkKey-less would leak it forever on every pan (the inverse of the lake
   case). The arch is the right precedent here, not the lake: D15 explicitly
   moved the arch FROM non-chunkKey `'spawn_arch'` persistence TO normal
   chunkKey streaming when it became per-hub festival furniture
   (`festival.js` arch descriptor; D15 in session-log). Seam records follow the
   arch.

**Connector PATH records stay cosmetic, not arterials (D5/A2).** A buffer's
connector path must be a path record emitted by the planner, NOT a new road in
`roads.js` — otherwise it perturbs the road-existence `queryPoint` golden
(frozen `eddf8e50`, design Risk "Spur roads", session-log D5). Path records
carry no collider (deliberation 001 D11). Drivability = reservation, not a
queryable road.

**The pure/impure boundary stays clean.** `festival.js`/`placement.js` import no
`three`, no `models/*` (`placement.js:8-9`). `seamResponsesNear` must keep that —
it returns plain descriptor data; `chunks.js` maps `kind → buildX → registry.add`
exactly as for every other descriptor (`chunks.js:1143`). Do not let any merge/SAT
geometry leak `THREE.*` into the worldgen layer.

### Structural Risks Identified

- **Seam-aware `_computePlan` (recursion):** mutual `festivalPlan(A)↔(B)`
  through a half-warm cache → either stack overflow or the reverted 8 s/plan
  basePlan. Impact: hangs chunk gen, breaks the memoization gate contract
  (`festival.js:493`). **Mitigation: response is a separate pure pass, never
  inside `_computePlan`.**
- **Window-invariance regression:** any plan whose *content* depends on a
  neighbour re-opens the appear/vanish class `placement.js:11-15` closed.
  **Mitigation: the per-heart plan stays a function of the heart alone; the seam
  pass only SELECTS/SUPPRESSES at consume time.**
- **Double-build across the seam:** if both sides emit buffer/path records, a
  seam crossing a chunk boundary builds twice (and unloads inconsistently).
  **Mitigation: single-owner anchoring to the canonical keeper; one chunk owns
  the seam, mirroring half-open `inChunk` (`placement.js:29-31`).**
- **chunkKey mistake on buffer records:** copying the lake `chunkKey`-omission
  (CLAUDE.md #5) to "make the buffer survive" would leak buffer geometry on
  every pan. **Mitigation: buffers ARE chunkKey'd festival furniture (arch
  precedent, D15); only the host-chunk-spanning *lake* omits chunkKey.**
- **Suppression touches `_computePlan` and re-moves the per-heart golden
  needlessly:** if trim/merge is implemented by editing `_computePlan` to know
  about neighbours, the POI golden moves *and* you reintroduce the cross-hub
  read. **Mitigation: suppression is a consume-time filter keyed on stable
  `clusterSeed`/`IDX` (`festival.js:528-536`) so a yielded sibling never re-rolls
  another (R19); `_computePlan` is untouched and the per-heart golden need not
  move — only a new seam-layer snapshot is recorded.**
- **Band-aid removal regresses fixed pins:** dropping
  `neighbourCourtHere`/`stageDeckClips` (`chunks.js:1173`,`:233`) before the
  planner equivalent covers them re-opens the seed-1139472710 court clip and the
  drum-vs-stage clip. **Mitigation: remove them LAST, in the same commit that
  lands `seamResponsesNear`, gated by a registry-snapshot diff on those exact
  seeds showing the response produces the same (or better) clearance.**
- **`trim` introduces a NEW per-descriptor shape mutation (shortened row) the
  golden/linter must see:** a trimmed vendor row is a different oriented extent.
  Whatever carries the trim length must be quantized integer (D8) and serialized
  into the descriptor/seam snapshot so the linter's overlap rule and the build
  half read the same trimmed shape (the `clusterShapes` sync contract,
  `festival.js:565`; MODEL_DIMS drift guard, `chunks.js:1218-1228`).

### Drift from the contract to watch

- `classifySeamsNear` is the right substrate but its v1 "classifies festival-POI
  zone seams; camp↔loud buffers are a 4B.3 extension" (`festival.js:298-300`).
  The soft_buffer case (D7/D20) needs camp data, and **camps live on a separate
  coarse grid (`campVillagesNear`), NOT `festivalPlan`** (`festival.js:299`,
  `placement.js:46`). So the buffer classifier must read *two* sources. Keep that
  read pure and region-windowed; do not fold camps into the heart plan to make
  the join easier — that would change the camp ownership model.
- `seamExtentInt` is read "per-call (no cross-epoch memo) so live sliders track"
  (`festival.js:315`). The response function must preserve that — any new tuning
  constant (buffer width, trim-floor "3 booths") goes in `FESTIVAL_TUNING`
  (tuning.js) and is read live, not frozen into the snapshot, so the hub-sandbox
  slider keeps working.

### Verdict

-   **Verdict**: Proceed with mitigations.
-   **Key Concern**: The home of the seam response. It must be a **separate pure
    `seamResponsesNear(bounds)` reconciliation pass** layered on the existing
    `classifySeamsNear` substrate — NOT logic inside the memoized per-heart
    `festivalPlan`. Putting it in the plan re-creates the reverted 8 s/recursion
    dead end and breaks window-invariance; the codebase's own
    `dancefloorRectsNear`/`drumClearingsNear`/`stageDeckClips` pattern is the
    proven, order-independent template.
-   **Recommendation**: Build `seamResponsesNear` as a pure cross-heart pass.
    Split the response by lifecycle owner: **suppression** (merge/trim/yield) as
    a consume-time filter over `festivalPlan` keyed on stable `clusterSeed`/`IDX`
    (so `_computePlan` and the per-heart POI golden stay frozen — only a new seam
    snapshot is recorded); **additive** soft_buffer trees/hammocks/potty +
    cosmetic connector path as single-owner, **chunkKey'd** descriptors anchored
    to the canonical keeper (arch precedent, NOT the lake chunkKey-omission).
    Keep the worldgen layer free of `three`/`models`. Remove
    `neighbourCourtHere`/`stageDeckClips` LAST, in the landing commit, gated by a
    registry-snapshot diff on the recorded playtest seeds.
