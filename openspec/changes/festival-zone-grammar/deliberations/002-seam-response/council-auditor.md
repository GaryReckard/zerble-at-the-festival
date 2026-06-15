# Council — The Auditor (mechanical correctness, 4B.3 seam RESPONSE)

> Round 1, isolated. Lens: mechanical assertion sweeps — golden hygiene, importmap
> completeness, pooling/dispose-safety, castShadow, CHANGELOG/ROADMAP discipline,
> band-aid-removal completeness (dead-code / broken-ref check), SALT key hygiene,
> linter-rule scope. Every claim cited to file:line / command output.

## TL;DR

4B.3 is the riskiest commit in the change, but the *foundation it sits on is clean*:
4B.1/4B.2 are pure, exported-but-unused, and golden-frozen by construction. My sweep
found **no blocking mechanical defect in what is committed**, but five issues that
4B.3's design and commit MUST get right or they will fail review / regress the
already-fixed playtest pins:

1. **The golden gate hinges entirely on WHERE the response is emitted.** The POI
   golden hashes `festivalPlan(h)` per heart (`selftest.js:178`). If the response is
   emitted *inside* `_computePlan`, the golden moves (correct, gated). If it's emitted
   in a side-function called at build time (the `classifySeamsNear` shape), the golden
   does NOT move — and you reintroduce the exact load-order asymmetry the band-aids had.
   This is a design fork the plan does not yet resolve.
2. **`soft_buffer`/`yield` for stage↔camp is currently UNREACHABLE** — `camp_village`
   is not in `festivalPlan`, it's on a separate grid (`campVillagesNear`,
   `festival.js:731`), and `nearestZoneToward` only iterates `SEAM_ZONE_KINDS`
   (`festival.js:309`), which excludes camps. So removing `stageDeckClips` (drum↔stage
   loud↔loud) is replaceable, but the *camp* buffer the design promises has no
   substrate yet. This is a regression hole, not just an under-spec.
3. **Band-aid removal is mechanically small and clean** — exactly two call sites in
   `chunks.js` + one import token — but removing `stageDeckClips` also strips a SECOND
   guard at `chunks.js:1203` (the `closestBuilding` drum dodge) if you delete the whole
   `else if` branch. Don't.
4. **SALT keys are clean** — no collision; `hubPriority`/`seam` are sequential fresh
   constants (`constants.js:84-85`).
5. **Do NOT add the 6 ChatGPT lint rules in this commit** — the parallel-session note
   holds; 4B.3 is graded BY the linter, not allowed to move the ruler mid-burndown.

No new `src/` module is needed for 4B.3 (it's all inside `festival.js`), so the
4-importmap footgun does not fire here — but the GATE still must run `bin/check-importmaps`
(it currently passes: "30 src + 12 worldgen + 27 models across 4 pages").

## Quality Deficiencies Found

- **Golden-gate ambiguity (the home-of-response question, q6).** The POI golden is
  `fnv1a` over `festivalPlan(h)` for every heart in a fixed box
  (`selftest.js:176-178`). The response is only golden-gated if it appears in the
  descriptor list `festivalPlan` returns. 4B.2's `classifySeamsNear` deliberately
  "emits NOTHING into any plan" (`festival.js:353`) and is **called by nobody** (grep:
  zero callers outside festival.js). 4B.3 must commit to emitting INTO `_computePlan`'s
  output — otherwise the seam response is invisible to the golden and to `bin/lint`'s
  plan mode, and re-introduces load-order dependence. — **Severity: Critical** (it
  decides whether the second golden move is even real).

- **stage↔camp buffer has no substrate (regression hole).** Design D7/D20 promise a
  soft green buffer for loud↔quiet (stage↔camp). But `SEAM_CATEGORY` maps
  `camp_village: 'quiet'` (`festival.js:305`) while camps are NOT in `festivalPlan`
  (`festival.js:731` `campVillagesNear` is a separate coarse grid) and
  `nearestZoneToward` only scans `SEAM_ZONE_KINDS = {stages, drum, vendor_row,
  food_court}` (`festival.js:309,327-336`). So `classifySeamsNear` can today only ever
  return `merged_court` / `shared_street` / `yield` / loud-vs-loud-`soft_buffer` — never
  a stage↔camp buffer. The 4B.2 header admits this ("camp↔loud buffers ... are a 4B.3
  extension", `festival.js:299-300`). 4B.3 must EITHER build the camp-seam path or
  explicitly scope camp buffers out — but it cannot claim parity with the removed
  band-aids while leaving this open, because... — **Severity: High**.

- **...the removed `stageDeckClips` band-aid is drum↔STAGE, which the planner CAN
  replace, but the regression proof must isolate the right pin.** `stageDeckClips`
  (`festival.js:233`, called `chunks.js:1201`) omits a DRUM whose ring reaches a
  neighbour's stage deck — that is loud↔loud `yield`, fully expressible in
  `classifySeamsNear` (both drum + stage are in `SEAM_ZONE_KINDS`). Good. But the
  CHANGELOG entry for it (`CHANGELOG.md:10`) cites a SPECIFIC proof: "heart (1,0)'s plan
  still emits a drum at (237,213) with `clipsStage:true`, and the builder omits it
  in-game." 4B.3's regression gate MUST reproduce that exact seed/coord and show the
  planner now yields the drum, or the removal is unproven. — **Severity: High** (q5).

- **`neighbourCourtHere` removal proof must reproduce its cited pin.** The band-aid's
  CHANGELOG proof (`CHANGELOG.md:9`) is seed 1139472710: "two overlapping courts (8
  trucks across rings at (511,24)+(498,59)) → one court (5 trucks)." 4B.2's task note
  already validated those pins classify `merged_court` (`tasks.md:241-242`). 4B.3 must
  carry that to the registry: after removing `neighbourCourtHere` (`chunks.js:1173-1183`,
  called `chunks.js:1194`), the in-game build at that seed must still show ONE court, now
  via the planner-emitted merge, not the builder omit. — **Severity: High** (q5).

- **`gapInt` uses `Math.round(Math.sqrt(distSq))` — a float op — but it is
  DIAGNOSTIC-ONLY and safe.** `festival.js:371`. Confirmed no consumer reads `gapInt`
  outside festival.js (grep clean). The existence gate is pure integer
  (`distSq > thr*thr`, `festival.js:364`). **BUT**: if 4B.3 ever lets a descriptor field
  derived from `Math.sqrt`/`Math.round` flow INTO the hashed plan, it crosses the
  node==browser line (the file's own header warns the POI fork is "a V8-VERSION cosmetic
  class", `selftest.js:155-157`). Any seam field that lands in the plan must be a
  pure-integer or pure-string quantity. — **Severity: Medium** (latent, gate it).

- **`quantize` rounds at .5 via `Math.round` (`rng.js:106-108`).** D8/q1 flag the .5
  boundary as the cross-engine flip risk. `seamExtentInt` (`festival.js:316-322`) feeds
  `quantize(clusterExtent(...))` into the integer gate. `Math.round(x.5)` is spec-defined
  (round-half-up) and engine-stable, so this is fine TODAY — but the moment a seam
  *position* or *trim length* is computed as `quantize(float)` and that float sits
  exactly on .5 for some seed, two engines agree only because both use `Math.round`.
  That's acceptable (it's the established `hearts.js` pattern, D21) — the audit assertion
  is just: **every seam quantize must go through `rng.js quantize`, never an ad-hoc
  `| 0` or `Math.floor`/`Math.trunc`** (which diverge on negatives). — **Severity:
  Medium** (a convention to enforce in review, not a current bug).

## Band-aid removal — completeness sweep (no dead code / broken refs)

Mechanical grep of every reference to the two band-aids:

- **`neighbourCourtHere`** — defined `chunks.js:1173`; one call site `chunks.js:1194`
  (inside the `d.kind === 'food_court'` branch of `placeWorldgenProps`,
  `chunks.js:1185-1208`). NOT exported, NOT imported anywhere. Removal = delete the
  function + the `if (d.kind === 'food_court') { if (neighbourCourtHere(...)) continue; }`
  branch. Clean, self-contained.
- **`stageDeckClips`** — defined+exported `festival.js:233`; imported `chunks.js:26`;
  one call site `chunks.js:1201` (inside the `d.kind === 'drum_circle'` branch). Removal
  = delete the function, remove the token from the `chunks.js:26` import, delete the
  `stageDeckClips(...)` guard. **WATCH-OUT:** the drum branch (`chunks.js:1195-1203`)
  ALSO contains a `closestBuilding` dodge at `chunks.js:1203` that is a DIFFERENT guard
  (load-order neighbour-cluster dodge, not the stage-clip test). If 4B.3 nukes the whole
  `else if (d.kind === 'drum_circle')` branch it silently drops that second guard too —
  keep it (or fold its intent into the planner). The `drumR` local (`chunks.js:1200`) is
  used by both; don't orphan it.
- **`_STAGE_DECK_MAX`** (`festival.js:221-224`) exists ONLY to feed `stageDeckClips`.
  Grep confirms no other reader. If `stageDeckClips` goes, `_STAGE_DECK_MAX` becomes dead
  code — BUT `seamExtentInt` (`festival.js:319-320`) reproduces the same MAX-scale logic
  for stages independently, so you can't just repoint. **Decision for 4B.3: delete
  `_STAGE_DECK_MAX` with `stageDeckClips`, OR refactor both to share one helper.** Don't
  leave a dead module-scope const. — flag this in the removal commit.
- The `ROADMAP.md:133` and `CHANGELOG.md:10` prose references to `stageDeckClips` are
  HISTORY (changelog is append-only; the ROADMAP bullet describes the shipped band-aid).
  CHANGELOG stays. The ROADMAP bullet, if it describes queued/parked work the seam
  grammar now subsumes, gets trimmed in the 4B.3/4B.5 commit per the same-commit rule.

**Verdict:** band-aid removal is mechanically a ~15-line delete across 2 files + 1
import token, with TWO traps (the co-located `closestBuilding` guard; the orphaned
`_STAGE_DECK_MAX`). No broken references result if those two are handled.

## Golden-move hygiene (q3) — the ritual

- The frozen state is real: 4B.1/4B.2 are exported but have **zero callers** outside
  `festival.js` (grep across `src/` returned nothing for `getHubPriority` /
  `seamPairsNear` / `classifySeamsNear`). Nothing in the plan path reads them, so the
  POI golden `49ec28fc` + queryPoint `eddf8e50` are frozen *by construction*
  (`tasks.md:230-231`, `selftest.js:146-147`).
- **The move ritual is already documented in-code** (`selftest.js:148-174`): the POI
  golden has moved twice in Group 4 (`4825fd0b → a0edfaea → 49ec28fc`), each logged
  old→new in the header. 4B.3/4B.5 must extend that block with the THIRD move and the
  date, mirroring the existing entries. This is the auditable trail — don't skip it.
- **node==browser verify:** the file header is explicit that the POI fork is an accepted
  V8-version cosmetic class (`selftest.js:155-160`), while queryPoint `eddf8e50` is the
  one true cross-engine gate that must agree (`selftest.js:146,160`). So the 4B.5 gate is:
  (a) re-record POI golden in node, log old→new; (b) confirm queryPoint STAYS `eddf8e50`
  (D5 — seam response emits only POI-layer descriptors + cosmetic path records, no
  road/water input change); (c) browser self-test agrees with node on queryPoint, and POI
  matches the recent-V8 class. The plan states this (`tasks.md:259-262`) — it is correct.
- **Rollback path (q3):** the design's migration plan is the rollback — "If a snapshot
  diff is non-empty on an *extraction* commit, that commit does not land"
  (`design.md:196-199`). For the DELIBERATE move that is inverted: a non-empty POI diff
  is EXPECTED; the rollback trigger is instead **queryPoint moving off `eddf8e50`**
  (would mean the response touched road/water existence — a D5 violation) OR the browser
  POI not matching the node-recorded value in the recent-V8 class. Either ⇒ revert the
  commit; goldens stay `49ec28fc`/`eddf8e50`. This inverted-gate distinction is NOT
  spelled out in tasks.md and SHOULD be added to 4B.5's done-criteria.

## SALT key hygiene (q "no collision")

`SALT` (`constants.js:71-86`) is a flat sequential map `0x4D41_01 .. 0x4D41_0E`.
4B added `hubPriority: 0x4D41_0D` and `seam: 0x4D41_0E` (`constants.js:84-85`) — both
fresh, sequential, no collision with the lake/forest/road/poi salts. `rng.js:99`
comments confirm the SALT set is "chosen to NOT collide." `getHubPriority` uses
`cellHash(cx,cz,SALT.hubPriority)` (`festival.js:258`); `seamPairsNear` uses
`edgeHash(...,SALT.seam)` (`festival.js:290`). **PASS — no collision.** 4B.3 needs no
new SALT key unless it introduces fresh per-seam randomness (e.g. buffer prop variation);
if it does, allocate `0x4D41_0F` and update the `rng.js:99` comment.

## Linter scope (the parallel-session note)

The "6 high-ROI lints" are from ChatGPT R3 (`DRAFTING-BRIEF.md:152`). The change's
explicit non-goal is "Touching the linter's rules (this change is graded *by* them)"
(`design.md:44`). The ONLY sanctioned linter edits in scope are the documented
false-positive fixes already noted (`booth-on-road` ribbon refinement — already landed,
`CHANGELOG.md` "Changed" block; the `overlap`/`drum-in-trees` shape upgrade — Group 3).
**4B.3 must NOT add the 6 new rules** — doing so moves the ruler mid-burndown and breaks
the before/after baseline accounting (the session log already flags the baseline
undercount, `session-log.md:236,247-256`). Confirmed: the parallel-session note holds.

## Perf / dispose-safety (q4)

The response per the design is "cosmetic path records (trees/hammock/shade/potty/path)"
emitted by the planner (`design.md:183-185`), built via the normal `buildWorldgenKind`
chunk path. So 4B.3 itself emits DATA, not geometry — the geometry comes from existing
builders. The audit assertions for 4B.6 (the GATE task already lists them,
`tasks.md:263-265`):
- Any NEW mesh a buffer introduces (a connector-path ribbon, shade prop) must default
  `castShadow = false` and, if module-pooled, carry `userData.shared = true` — the
  perf-pooling rule (`.claude/rules/perf-pooling.md`). If 4B.3 reuses existing pooled
  builders (hammock/tent/potty/tree) the tags already exist; verify it does not allocate
  per-seam.
- Seam COUNT per chunk neighbourhood bounds the cost: `SEAM_PAIR_REACH = 420`
  (`festival.js:265`) over `HEART_CELL` 200 m ⇒ a 2×420 box holds ~17–18 hearts ⇒ O(n²)
  pair enumeration is ~150 pairs worst case per call, pruned hard by the integer
  distance gate. That is plan-time + memoized (`festival.js:511-521`), not per-frame —
  steady-state cost is zero. The allocation-time concern is whether the response
  *inflates* `festivalPlan`'s output enough to slow the box self-test (already flagged
  heavy, `session-log.md:233`). Net geometry should DROP (merge = one court not two; yield
  = drum omitted) per task 7.1's note (`tasks.md:316`).

## CHANGELOG / ROADMAP (same-commit rule)

4B.3 (or 4B.5, whichever lands the player-visible behavior) IS player-visible — it is the
seam-grammar landing that changes the flag-off v2 world. Per `.claude/rules/changelog-and-roadmap.md`
and `tasks.md:261,329`:
- **CHANGELOG entry required in the SAME commit** — grouped `Changed` (worldgen v2,
  flag-off), citing the band-aid promotion, the POI golden old→new, queryPoint frozen,
  and the seam types. The existing Group-4 entries (`CHANGELOG.md:9-14`) are the voice
  bar to clear.
- **ROADMAP trim:** the "Playtest follow-ups" cross-hub bullet + the `stageDeckClips`
  reference (`ROADMAP.md:133`) describe the band-aid era — trim to what remains
  (curve-aware vendor row, water-clear lake-hearts) in the same commit.
- The behaviour-preserving 4B.1/4B.2 commits correctly took the internal exemption
  (no player-visible effect — exported-unused); 4B.3 cannot.

## Mechanical Assertions

| Check                          | Status    | Notes |
| ------------------------------ | --------- | ----- |
| Importmap in all 4 html files  | PASS      | `bin/check-importmaps`: "30 src + 12 worldgen + 27 models across 4 pages". 4B.3 adds NO new `src/` module (all in festival.js), so no importmap change needed — but run the guard at the gate. |
| New-model sandbox entry        | N/A       | 4B.3 emits descriptors via existing builders/`buildWorldgenKind`; no new `src/models/` file. Hub-viewer (`hub-sandbox.html`) is the layout surface and renders new cluster kinds by construction. |
| userData.shared tagging        | DEFERRED  | No new pooled geometry in 4B.3 if it reuses existing builders. ASSERT at 4B.6 for any buffer-prop mesh (`tasks.md:265`). |
| castShadow discipline          | DEFERRED  | Path/buffer meshes must default `castShadow=false` (`tasks.md:265`, `.claude/rules/perf-pooling.md`). Gate at 4B.6. |
| InstancedMesh needsUpdate      | N/A       | 4B.3 is planner-side data; no instanced writes introduced. |
| Determinism (integer gate)     | PASS*     | Existence gate is integer `distSq>thr*thr` (`festival.js:364`); `gapInt` Math.sqrt is diagnostic-only (no consumer). *CONDITIONAL: any seam field flowing into the hashed plan must be integer/string, not `quantize(float)`-on-.5 latent. |
| SALT fresh / no collision      | PASS      | `hubPriority 0x4D41_0D` / `seam 0x4D41_0E` sequential fresh (`constants.js:84-85`); `rng.js:99` "chosen to NOT collide." |
| Band-aid removal complete      | PASS-w/-traps | 2 call sites + 1 import token; TRAPS: keep the co-located `closestBuilding` drum guard (`chunks.js:1203`); delete orphaned `_STAGE_DECK_MAX` (`festival.js:221`). |
| Linter rules untouched         | PASS      | Non-goal `design.md:44`; do NOT add the 6 ChatGPT rules (parallel-session note holds). |
| Golden ritual documented       | PASS      | In-code log block `selftest.js:148-174` to be extended with the 3rd move; add the inverted-gate (queryPoint-stays-frozen) rollback to 4B.5 done-criteria. |
| CHANGELOG/ROADMAP same-commit  | REQUIRED  | 4B.3/4B.5 is player-visible (flag-off v2); CHANGELOG `Changed` + ROADMAP trim of the band-aid bullet, same commit (`.claude/rules/changelog-and-roadmap.md`). |

## What I'd change (concrete)

1. **Resolve the home-of-response fork in the design before building** (q6): the response
   MUST be emitted inside `_computePlan`'s descriptor output for the golden gate to be
   real AND for order-independence. The recursion worry (q6) is real but BOUNDED — the
   safe shape is the 4B.2 pattern already proven: a seam pass that reads neighbours'
   *memoized* `festivalPlan` (`festival.js:358-359`) and APPLIES the trim/merge to the
   keeper/yielder descriptors. The "senior keep-out" dead end (8s/stack overflow,
   `session-log.md:421-429`) failed because it recursed plans WITHIN plan compute; the
   4B.2 read-the-neighbour-plan-then-decide shape does not recurse (each `festivalPlan`
   is computed once, memoized, then read). Keep that shape; do not make `_computePlan`
   call `_computePlan` of a neighbour that in turn seams back.

2. **Close or scope the camp buffer hole** — either add `camp_village` to the seam
   substrate (read `campVillagesNear` alongside `festivalPlan` in `nearestZoneToward`) or
   explicitly record in tasks.md/design that 4B.3 ships drum↔stage `yield` + food merge +
   commerce trim, and stage↔CAMP buffers are a follow-up. Do not let the CHANGELOG claim
   "removed the band-aids, replaced by the grammar" while the camp case has no path.

3. **Add the two removal traps to the 4B.3 task done-criteria**: keep the
   `closestBuilding` drum guard; delete `_STAGE_DECK_MAX` (or share it).

4. **Add the inverted golden gate to 4B.5**: success = POI diff non-empty (expected) +
   queryPoint STILL `eddf8e50` + browser POI matches node in the recent-V8 class; rollback
   if queryPoint moves.

5. **Reproduce both band-aid CHANGELOG pins** in the regression gate (seed 1139472710
   court pair; the drum-clips-stage seed) to prove the planner replacement is behaviorally
   equal-or-better, per q5.

## Open verification I could not complete here

- I did not run the full `runSelfTest` end-to-end (the box sweep is ~7 min in node,
  `session-log.md:233`); I verified the freeze STRUCTURALLY (zero callers ⇒ no plan-path
  read ⇒ goldens cannot have moved). The 4B.5 gate must run it for real.
- Perf budget numbers (draws/tris on the densest seamed hub) are headless-unreadable
  (`tasks.md:316`) — deferred to Gary's interactive 7.3 playtest; assert at 4B.6.
