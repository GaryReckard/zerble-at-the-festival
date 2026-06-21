# Deliberation Summary

## Context
-   **Task**: festival-zone-grammar Group 4B.3 — the cross-hub seam **RESPONSE**
    (merge / trim / yield / soft_buffer), the architecture for where it lives,
    and the build order. This is the change's single riskiest commit: it moves
    the POI determinism golden a second time and removes two shipped builder-side
    band-aids (`neighbourCourtHere`, `stageDeckClips`).
-   **Personas Consulted**: Architect, Auditor, Pragmatist, Profiler, Adversary
    (R1 all complete) + Adversary R2 cross-examination (the debate's
    cross-examination of record) + Mediator.
-   **Mode**: debate (Tier 3). Round 2 was budget-truncated — only the
    Adversary's R2 survived. It explicitly cross-examined ALL four other
    personas with citations and adjudicated the central architecture fork, so it
    is treated as the cross-examination of record. The other four R1 positions
    are weighed on their own terms (the Architect's stale-memo/clean-freeze
    point and the Profiler's measured numbers are NOT overridden by the
    Adversary's framing).
-   **Date**: 2026-06-15

---

## The two decisions Gary asked for, up front

### Decision 1 — THE ARCHITECTURE FORK

**Resolution: emit-in-plan (Auditor), implemented as a post-base-plan
annotation pass, with the Architect's single-owner `chunkKey` discipline adopted
for the ADDITIVE buffer records.** The POI golden **moves** (once, deliberately,
gated). The "golden frozen + separate seam snapshot" framing is rejected as a
headline, while the Architect's *mechanism insight* and *stale-memo cleanliness*
are preserved as hard invariants.

**Why.** The Adversary R2 (`council-adversary-r2.md:316-340`) establishes that
the fork is **cosmetic on the safety axis** — both homes stand on
`classifySeamsNear`'s canonical-pair substrate (`festival.js:283-289, 357-368`),
both are order-independent for the *same* reason (the canonical pair, not the
home), both are non-recursive *iff* the seam step runs after base-plan compute,
both incur the *same* ~2.8 s cold fan-out. The discriminator is therefore
"which is easier to keep non-recursive and fully-hashed." On that axis:

-   **Emit-in-plan keeps the suppression decision inside the one hash that
    already covers the plan** — the smaller surface to reason about and the
    harder one to accidentally leave un-hashed (`council-adversary-r2.md:334-337`;
    Auditor `council-auditor.md:48-50`). A separate seam snapshot is a second
    hash that can be forgotten; if suppression lived outside the POI golden,
    *nothing* would hash "did the right descriptor get dropped" except that new
    snapshot — so it would not really be optional, it would BE the golden for the
    seam layer (`council-adversary-r2.md:326-333`).
-   **The "golden frozen" claim collides with a design lock.** `design.md:144-146`
    explicitly rejected "keep it builder-side to freeze the golden" because it
    cannot be made order-independent — the exact band-aid bug. A consume-time
    filter is salvageable only if it consults nothing but pre-computed canonical
    seam descriptors (`council-adversary-r2.md:46-60`), at which point it is
    informationally identical to emit-in-plan and the golden has effectively
    moved anyway.
-   **The Architect's stale-memo win is real and is preserved as an invariant,
    not as an architecture.** Their point — a seam-blind `_computePlan` cache key
    `(cx,cz)` under `(seed,epoch)` can never go stale w.r.t. a seam
    (`council-architect.md:73-79`; conceded `council-adversary-r2.md:31-44`) — is
    honored by making the seam decision a **pure function of integers the plan
    can compute without reading a neighbour's plan**, and by structuring emit as
    a SEPARATE post-base-plan pass (so `_computePlan` itself stays seam-blind and
    its cache stays valid). We get the Architect's cleanliness inside the
    Auditor's single-hash placement.

### Decision 2 — THE 7 NON-NEGOTIABLES (Adversary R2 `:407-422`)

These hold **regardless of home** and are folded into the Change Groups below as
done-criteria. Stated once here as the master list:

| # | Non-negotiable | Where enforced |
|---|---|---|
| N1 | Seam step runs **AFTER** base-plan compute; `_computePlan` NEVER calls a neighbour's `festivalPlan` (kills recursion — answers Q6/Q2 recursion). | CG1 done-criterion |
| N2 | Single source of truth for who/what-trims: both consume sides filter against the seam's `keeperZone`/`yielderZone` by stable `clusterSeed`/`IDX`, NEVER a per-chunk `nearestZoneToward` re-scan. | CG2 done-criterion |
| N3 | Trim **length + booth count are integer** before the existence compare; ALL seam quantize goes through `rng.js quantize` (never `\| 0`/`Math.floor`/`Math.trunc`). | CG2 done-criterion |
| N4 | **Dark-emit order-independence** assertion (hub-A-plan === hub-B-plan, bit-for-bit, shifted window) + bit-identical-under-mitigation assertion BEFORE the golden moves. | CG1 done-criterion |
| N5 | **Superset-diff vs the band-aids** on the 2 cited pins (planner ⊇ band-aid) BEFORE removal; band-aid removal co-committed with the response. | CG3 done-criterion |
| N6 | The suppression decision is **hashed + node==browser-verified** somewhere — the POI golden moving is the simplest guarantee (this is Decision 1). | CG4 done-criterion |
| N7 | Any stall mitigation must produce **bit-identical** seam descriptors to the no-mitigation baseline (seam-lite plan PARKED unless proven). | CG2 done-criterion |

---

## Synthesized Plan

Five Change Groups. CG0 is Pragmatist's Slice 0 (the iteration-surface gap).
CG1–CG4 implement the seam response inside **one golden move** (Pragmatist's
single-move constraint, `council-pragmatist.md:88, 241-245`). Slice order within
the move is **yield → merge → trim → (buffer geometry later)**.

---

### Change Group 0: Iteration surface — map-sandbox seam overlay (Slice 0)
**Scope**: Extend the **map-sandbox** 2D overlay to render `classifySeamsNear`
output (colour by `seam.type`) over the multi-hub layout. `hub-sandbox.html` is
**single-hub** (`buildHubPreview`, `chunks.js:1278`) and structurally cannot
show a two-hub seam resolving (`council-pragmatist.md:142-154, 252-257`). Without
this, every 4B.3 iteration falls back to slow `?worldgen=1` game boots — the
anti-pattern the harness doctrine forbids.
**Why first**: This is the "build the harness before the feature" task. The
map-sandbox already draws oriented extents (`tasks.md:144`) and renders multiple
hubs in 2D — the cheapest correct multi-hub scope.
**Tasks**:
1. Extend the map-sandbox overlay to draw each seam from `classifySeamsNear`,
   coloured by type, with keeper/yielder annotated and the chosen response
   visible.
2. (Iteration aid, not yet a gate) once CG1's dark-emit exists, render the
   resolved response (merged court / trimmed row / yielded zone / buffer zone)
   on the same overlay.
**Done-criteria**:
-   Open the overlay on the 3 baseline seeds; confirm the seams to be resolved
    are visible and match the hand-checked pins — seed 1139472710's two
    `merged_court` clashes (`tasks.md:243`).
-   The map-overlay (NOT the single-hub hub-viewer) is named as the load-bearing
    seam iteration surface in the refined 4B.3 done-line (`tasks.md:253` is
    half-right; the hub-viewer can only show post-resolution single-hub
    cleanliness).
**Dependencies**: none. Ships nothing player-visible; no golden impact; no
importmap change (overlay is in the existing `map-sandbox.html`).
**Map-sandbox importmap caveat**: if the overlay needs a NEW worldgen module it
goes in the `wg` array of `map-sandbox.html` AND the other three pages
(`bin/check-importmaps` is the guard). 4B.3 itself adds no new `src/` module
(all in `festival.js`, Auditor `council-auditor.md:38-40, 225`).

---

### Change Group 1: Dark-emit reconciliation pass + order-independence proof
**Scope**: Build the seam response as a **post-base-plan annotation pass** that
reads two already-memoized neighbour plans and computes the suppression /
annotation per seam — but **dark** (compute + assert; do NOT write into `out[]`
yet). This is the keystone the Pragmatist names (`council-pragmatist.md:88-91`)
and the single best determinism-safety idea in the round (Adversary R2
`:109-117`). It de-risks the architecture before a single descriptor changes.
**Architecture (Decision 1, made concrete)**:
-   `_computePlan` stays **seam-blind**; it produces a base plan that is a pure
    function of (heart, seed) and never calls a neighbour's `festivalPlan` (N1).
-   A separate idempotent pass keyed on the canonical pair (`festival.js:283-285`)
    reads `festivalPlan(seam.keeper)` / `festivalPlan(seam.yielder)` (the proven
    4B.2 `classifySeamsNear` read shape, `festival.js:357-359`) and produces the
    response. **This is acyclic precisely because it runs after both base plans
    are memoized** (Adversary R2 `:227-247`). The fatal shape — weaving the seam
    question into `_computePlan`'s logic so A's compute calls B's — is forbidden
    by N1 and called out as a tripwire because the Auditor's own wording is "one
    word away" from it (`council-adversary-r2.md:238-247`; the senior keep-out
    dead end was exactly this, ~8 s/plan + stack overflow,
    `session-log.md:421-429`, Architect `council-architect.md:46-52`).
**Tasks**:
1. Implement the reconciliation pass over `classifySeamsNear`, computing per-seam
   `{ suppress, trimTo, type }` from the canonical pair + the two memoized plans.
   Keeper via `getHubPriority` on the canonical pair (`festival.js:257-259,
   283-289`). Suppression resolves from the seam's `keeperZone`/`yielderZone`
   (`festival.js:367-368`) identified by stable `clusterSeed`/`IDX`
   (`festival.js:528-536`) — computed ONCE by the pass, never re-derived per
   chunk (N2).
2. Wire the **dark-emit assertion**: for every seam, compute the response from
   hub A's side AND hub B's side across a shifted window; assert bit-identical
   agreement (the probe 4B.1 already runs for keeper+hash, `tasks.md:230`).
**Done-criteria**:
-   **N1**: grep/structural proof that `_computePlan` calls no neighbour
    `festivalPlan`; the response is a separate pass running after base-plan
    memoization.
-   **N4**: dark-emit order-independence assertion passes across shifted windows
    on all baseline seeds (catches the trim-asymmetry vulnerability pre-commit,
    Adversary R2 `:109-117`).
-   Both goldens still FROZEN at this step (`49ec28fc`/`eddf8e50`) — nothing is
    written into `out[]` yet, so by construction no descriptor changed.
**Dependencies**: CG0 (visual validation of which seams resolve).

---

### Change Group 2: The response slices + cost mitigation (yield → merge → trim)
**Scope**: Flip the dark-emit live — emit the suppression/trim into the plan in
slice order, plus the bounded cost mitigation, plus the integer hygiene the trim
introduces. `soft_buffer` ships here ONLY as a **bare quiet-zone separation**
(no new geometry); buffer geometry is CG5.
**Slice order** (Pragmatist `council-pragmatist.md:95-132`, confidence×value÷effort):
1.  **yield** (drum vs stage). Smallest diff that exercises the entire emission
    path end-to-end; reframes the validated `stageDeckClips` behavior as a
    plan-side omit of the yielder's `drum_circle` descriptor. Both drum + stage
    are in `SEAM_ZONE_KINDS` so it is fully expressible today
    (`council-auditor.md:65-73`).
2.  **merge** (food+food). Yielder drops its `food_court` descriptor; keeper's
    court serves both. The order-independent replacement for `neighbourCourtHere`
    — and because the keeper is integer-priority chosen, it FIXES the band-aid's
    "whichever chunk built first wins" non-determinism (`chunks.js:1171`).
3.  **trim** (vendor-row along road axis). Shorten the lower-priority row; skip
    only if the trimmed length can't seat 3 booths. The one genuinely new layout
    algorithm: the row descriptor today is center+yaw (`festival.js:598`); trim
    needs a `length`/`booths` field the builder honors (`buildVendorRowAt`,
    `chunks.js:1268`) — so trim is not purely planner, but it adds no geometry,
    no pool, no new kind (Pragmatist `council-pragmatist.md:117-124`).
4.  **soft_buffer = bare separation only** (loud↔loud, drum↔stage, in
    `SEAM_ZONE_KINDS`). The quiet zone yields/offsets; NO trees/hammock/path
    here. Stage↔camp buffer is scoped OUT (see Scope decisions below).
**Cost mitigation (Profiler's owned risk, `council-profiler.md:93-164`; Adversary
R2 (d) `:342-383`)**: the ~2.8 s cold fan-out (60 cold `festivalPlan` × ~47 ms)
exists in BOTH architectures — it lives in the shared `classifySeamsNear`
substrate, not in either home (`council-adversary-r2.md:86-104`). It is **pure
perf, not determinism** (memoization is a cache, not a behavior change), with one
determinism caveat (N7). Minimal mitigation set:
-   **Frame-spread first-touch warming** within the existing 1-chunk/frame budget
    (`council-profiler.md:134-140`) — same plans, later. Determinism-safe.
-   **Proven-superset integer pre-filter** before the `festivalPlan` calls:
    tighten `SEAM_PAIR_REACH` (420 m vs ~190 m actual reach, `festival.js:265`)
    and/or gate the calls behind a cheap integer heart-center pre-filter
    (`council-profiler.md:148-158`). The pre-filter MUST be a conservative
    superset of the real integer gate (never prune a pair the gate would keep),
    or it becomes an existence-flip via perf optimization (Adversary R2 `:362-367`).
-   **PARK seam-lite plan** (`council-profiler.md:141-147`). It is a trap unless
    the lite-plan's front-zone pick is provably bit-identical to the full plan's
    `nearestZoneToward` for every heart — otherwise two chunks disagree on the
    front (the N2 asymmetry, reintroduced via a perf shortcut). Adversary R2:
    "I would not take it in the golden-move commit" (`:374-378`).
**Integer hygiene the trim introduces (N3)**: trim is a projection onto a road
axis, and `walkOriented` (`festival.js:417-431`) uses `Math.hypot` + `Math.atan2`
— NOT bit-identical across V8 forks (`council-adversary-r2.md:283-286`;
`council-auditor.md:83-101`). So: trim LENGTH and the "≥ 3 booths" threshold must
both be integer-meters / integer-booths before the compare (mirroring
`seamExtentInt`, `festival.js:316-322`); every seam quantize goes through
`rng.js quantize` (`rng.js:106-108`), never ad-hoc. `gapInt`'s `Math.sqrt` is
diagnostic-only and must stay out of the hashed plan (`council-auditor.md:83-90`).
**Done-criteria**:
-   **N2**: both consume sides filter against the seam's `keeperZone`/`yielderZone`
    by stable `clusterSeed`/`IDX`; neither chunk re-runs `nearestZoneToward` on
    its own plan to decide what to drop.
-   **N3**: trim length + booth count integer before compare; all quantize via
    `rng.js quantize`; `node==browser` verify exercises a seed whose trim length
    sits within ULPs of a `.5` boundary before `quantize` (a clean run on the two
    pinned seeds does NOT prove the existence-flip class absent, Adversary R2
    `:276-292`).
-   **N7**: assert (in the dark-emit pass) that the seam descriptors are
    bit-identical with the cost mitigation ON vs OFF; superset property of the
    pre-filter asserted.
-   Per-chunk synchronous seam-resolve cost bounded to what the 1-chunk/frame
    budget absorbs (single-digit ms steady; first-touch spread across frames),
    Profiler's hard requirement (`council-profiler.md:160-164`).
**Dependencies**: CG1 (the dark-emit pass and its order-independence proof must
pass before flipping live).

---

### Change Group 3: Band-aid removal + superset regression proof (co-committed)
**Scope**: Remove `neighbourCourtHere` + `stageDeckClips`, gated by a
superset-diff proving the planner response covers (⊇) what the band-aids did, on
the exact cited pins. Removal is the **last** step and lands in the **same
commit** as the response (so rollback is one revert) — Architect
`council-architect.md:23-26, 172-177`, Auditor `council-auditor.md:103-134`.
**Tasks**:
1. **Superset-diff gate (N5)**: across the 10 baseline seeds, dump the band-aid
   output (omitted-court set + yielded-drum set) and the planner-response output;
   require planner ⊇ band-aid. The linter grades *clearance*, not "did we drop
   the same things" — so linter-passing is NOT this gate, and the re-recorded
   golden is NOT this gate (it re-records whatever the new world is, right or
   wrong). This superset-diff is the correctness net (Adversary R2 `:263-274`).
2. Reproduce the two CHANGELOG pins exactly: seed 1139472710's court pair
   ("8 trucks → one court of 5", `CHANGELOG.md:9`) now via planner merge; and the
   drum-clips-stage pin ("heart (1,0)'s drum at (237,213) with `clipsStage:true`",
   `CHANGELOG.md:10`) now via planner yield (`council-auditor.md:70-81`).
3. **Removal traps (Auditor `council-auditor.md:114-126`)**:
   -   Keep the co-located `closestBuilding` drum dodge at `chunks.js:1203` — it
       is a DIFFERENT guard; don't nuke the whole `else if (d.kind ===
       'drum_circle')` branch. Don't orphan the `drumR` local (`chunks.js:1200`).
   -   Delete the now-orphaned `_STAGE_DECK_MAX` (`festival.js:221-224`) WITH
       `stageDeckClips`, OR refactor both to share one helper — don't leave a
       dead module-scope const.
   -   `neighbourCourtHere`: delete the function + its `food_court` branch
       (`chunks.js:1173-1183, 1194`); it is not exported/imported elsewhere.
**Done-criteria**:
-   **N5**: planner ⊇ band-aid on all 10 seeds; both cited pins reproduced
    (one court at 1139472710; drum yielded at the drum-vs-stage seed).
-   No dead code / broken refs: `_STAGE_DECK_MAX` handled, `closestBuilding` guard
    kept, import token removed from `chunks.js:26`.
-   `bin/check-importmaps` still passes; `bin/lint` overlap stays 0.
**Dependencies**: CG2 (the planner response must be live and proven before the
band-aids can be safely removed).

---

### Change Group 4: The second golden move + gates + CHANGELOG/ROADMAP
**Scope**: Re-record the POI golden (third move in Group 4), node==browser
verify, document the move ritual, and run the full boot gate at all tiers. This
is 4B.5 + 4B.6 in tasks.md. Player-visible → CHANGELOG required same commit.
**Tasks**:
1. **Re-record + log** the POI golden; extend the in-code move-log block
   (`selftest.js:148-174`) with the third move + date, mirroring the two prior
   entries `4825fd0b → a0edfaea → 49ec28fc` (`council-auditor.md:143-146`).
2. **Inverted gate (N6, Auditor `council-auditor.md:154-161, 259-261`)**: a
   non-empty POI diff is EXPECTED (that IS the move). Rollback triggers are: the
   queryPoint golden moving OFF `eddf8e50` (would mean the response touched
   road/water existence — a D5 violation), OR browser POI not matching node in
   the accepted recent-V8 cosmetic class. Add this inverted-gate distinction to
   the 4B.5 done-criteria (it is not currently spelled out in tasks.md).
3. **Boot gate (4B.6)**: boot the real game at `?worldgen=1` on `?perf=low`,
   `?perf=mid`, `?perf=high`; console clean (the camp-chair
   sandbox-pass/game-fail signature, CLAUDE.md); backtick budget within tier on
   the densest seamed hub — watch the one chunk hosting a soft_buffer midpoint at
   `?perf=low` (Profiler `council-profiler.md:236-238, 264-266`).
4. **CHANGELOG (same commit)**: `Changed` group — worldgen v2 flag-off seam
   grammar, band-aid promotion, POI golden old→new, queryPoint frozen, the seam
   types. **ROADMAP trim**: the band-aid-era bullets (`ROADMAP.md:133`
   `stageDeckClips`, the cross-hub playtest follow-up) to what remains
   (`council-auditor.md:206-219`).
**Done-criteria**:
-   **N6**: golden re-recorded + both engines agree; queryPoint STAYS `eddf8e50`;
    POI matches across engines in the recent-V8 class.
-   All 3 tiers boot console-clean; HUD budget within tier (×3 tier screenshots).
-   CHANGELOG entry + ROADMAP trim in the same commit; golden move-log extended.
**Dependencies**: CG2 + CG3 (response live and band-aids removed, co-committed —
the golden re-records the final v2 world once).

---

### Change Group 5: soft_buffer GEOMETRY — fast-follow (NO golden impact)
**Scope**: The deferred buffer dressing — trees/hammock/shade/potty + cosmetic
connector path in the buffer zone, AND the stage↔camp buffer substrate. Ships
**after** CG4, in a separate non-golden commit. This is the only response that
touches the mesh layer, pools, and perf budgets — kept off the riskiest commit
(Pragmatist `council-pragmatist.md:166-174, 247-250`).
**Scope decisions baked in here**:
-   **Stage↔camp buffer is OUT of the golden-move commit** and lives here.
    Reason: camps are on `campVillagesNear` (`festival.js:731`), a SEPARATE coarse
    grid with its own existence gate, and `nearestZoneToward` only scans
    `SEAM_ZONE_KINDS` (no camps) (`council-auditor.md:54-63`). A stage↔camp buffer
    makes existence depend on TWO independent deterministic systems agreeing — a
    fresh cross-system existence surface that must be integer on BOTH sides or a
    buffer exists on Chrome and vanishes on node (Adversary R2 `:136-154`). That
    new determinism risk must NOT ride the commit that moves the golden.
-   **Connector PATH stays a cosmetic path record, never a `roads.js` arterial**
    (would perturb the frozen queryPoint golden); no collider (Architect
    `council-architect.md:133-138`).
**Tasks**:
1. **Buffer geometry** composing existing pooled builders — `buildHammock`
   (`hammock.js:6`), campsite chairs/EzUp (`campsite.js:152,441`), tree scatter,
   `buildPottyBankAt` (`chunks.js:1270`). Zero new model files
   (`council-pragmatist.md:156-163`).
2. **Additive records are single-owner, chunkKey'd** (Architect
   `council-architect.md:106-131`, adopted by Adversary R2 `:119-134`): anchor
   every buffer record to the canonical keeper's plan-space position so exactly
   ONE chunk owns it (mirroring half-open `inChunk`, `placement.js:29-31`); the
   anchor must itself be an INTEGER (quantized) anchor or chunk-ownership can flip
   across engines on a boundary seam (a second existence-flip class, for
   ownership instead of presence, Adversary R2 `:129-134`). chunkKey the buffer —
   it is hub-scale festival furniture (arch precedent / D15), it MUST unload with
   its owning chunk; do NOT copy the lake `chunkKey`-omission (CLAUDE.md #5).
3. **Stage↔camp substrate**: read `campVillagesNear` alongside `festivalPlan` to
   form the buffer, keeping BOTH sides integer (Auditor `council-auditor.md:251-254`).
4. **Perf hygiene (Profiler `council-profiler.md:168-211, 256-266`)**: route
   buffer trees through an `InstancedMesh` or a `userData.shared`-tagged bucketed
   leaf-radius pool — NOT the per-leaf-allocating `buildTree` (`tree.js:105-112`
   allocates a fresh `IcosahedronGeometry` + `MeshStandardMaterial` per leaf, not
   pooled). `castShadow = false` on the connector path quad, shade seating, potty
   bank. Any new pooled buffer geo/mat tagged `userData.shared = true`. Prefer
   emissive over a new `PointLight` for any buffer ambiance.
**Done-criteria**:
-   Golden UNCHANGED by this commit (buffer fill is POI-layer cosmetic; if the
    golden moves, a buffer record leaked into the hashed plan incorrectly,
    Pragmatist `council-pragmatist.md:231-233`).
-   hub-viewer + map-overlay at noon/midnight; backtick budget within tier on the
    densest seamed hub at `?perf=low` and `?perf=mid`.
-   Stage↔camp buffer existence proven integer-deterministic node==browser across
    the camp/heart join (the new cross-system surface).
-   New `buildWorldgenKind` case (if any) reachable in `buildHubPreview` so the
    hub-viewer renders it by construction.
**Dependencies**: CG4 (the buffer-zone reservation from CG2 must be live in the
plan; the golden must have already moved and settled).

---

## Final Recommendation
**Proceed with mitigations.** Build CG0 (the map-sandbox seam overlay) first,
then land yield → merge → trim → bare-buffer as **one golden-move commit**
(CG1–CG4), developed behind a dark-emit order-independence proof, with the
band-aids removed in that same commit behind a superset-diff. Defer all
soft_buffer GEOMETRY and the stage↔camp substrate to a non-golden fast-follow
(CG5). The architecture fork is settled as emit-in-plan-via-post-base-plan-pass
(one hash covers plan+seam) — but the decision that actually carries the risk is
the seven non-negotiables, not the home.

---

## Convergence Points
-   **The seam step must NOT recurse inside `_computePlan`.** All five agree
    (Architect `:46-52, 148-152`; Auditor `:242-248`; Profiler `:134-140`;
    Pragmatist via the dark-emit; Adversary R2 `:68-84, 227-247`). The senior
    keep-out 8 s/stack-overflow dead end is the shared cautionary tale.
-   **Order-independence comes from the canonical pair, not the home.** Both homes
    stand on `classifySeamsNear`'s canonical-pair purity (`festival.js:283-289`).
    The keeper is a pure integer function of (two cells, seed); 4B.1 already
    proved it (337 shared pairs agree, `tasks.md:230`).
-   **One golden move, batched.** Staging slices = N golden re-records, which the
    one-move constraint forbids (Pragmatist `:78-91`; Adversary R2 `:316-340`).
-   **merge/trim/yield NET-REDUCE draws; soft_buffer is the only add** (~+24 draws
    on the one host chunk) — Profiler quantified (`:215-243`); the world-wide net
    is strongly negative.
-   **Dark-emit before the live flip** is the cheapest pre-commit catch for
    trim-asymmetry (Pragmatist proposed, Adversary R2 endorsed as "the single
    best determinism-safety idea in the round").
-   **Band-aid removal is mechanically small** (~15 lines, 2 files, 1 import
    token) with two traps (`closestBuilding` guard, orphaned `_STAGE_DECK_MAX`).

## Conflicts Resolved
| Conflict | Persona A Position | Persona B Position | Resolution | Rationale |
| -------- | ------------------ | ------------------ | ---------- | --------- |
| Home of the response (THE fork) | Auditor: emit INSIDE `_computePlan` output; golden MOVES (`:48-50`) | Architect: separate `seamResponsesNear` pass + consume-time filter; golden FROZEN + new snapshot (`:73-79`) | **Emit-in-plan via a post-base-plan annotation pass; golden moves.** Architect's single-hash-is-cleaner mechanism rejected as a freeze claim, preserved as invariants (stale-memo cleanliness via seam-blind `_computePlan`; single-owner chunkKey for additive records). | Fork is cosmetic on safety (Adversary R2 `:316-340`); discriminator is "keep it non-recursive + fully hashed," which favors one hash over two; "golden frozen" collides with the `design.md:144-146` lock. |
| "golden stays frozen" | Architect (`:73-79, 213-214`) | Auditor / Adversary R2 (`:46-60, 316-333`) | **Golden MOVES.** | A consume-time filter that reads only canonical descriptors is informationally identical to emit-in-plan; the design lock rejected freeze-via-builder-side as un-order-independent; if suppression lives outside the POI golden it must BE a new hashed gate anyway. |
| Recursion risk severity | Adversary R1 (fatal, re-opens the cycle) | Auditor (`:242-248`) / Profiler (`:134-140`): bounded read of memoized plans | **Acyclic IFF seam step runs after base-plan compute** (N1). Adversary R2 conceded the R1 absolutism (`:76-84`). | The cycle forms only if the seam question is woven into `_computePlan`'s logic; a separate post-memo pass is non-recursive by construction. |
| 2.8 s cold stall — discriminates the fork? | Profiler: the cliff that feeds the geometry (`:93-124`) | Adversary R2: exists in BOTH homes, lives in the shared substrate (`:86-104`) | **Not a discriminator — a precondition both must fix.** Minimal set: frame-spread warming + proven-superset integer pre-filter; PARK seam-lite. | The cost is `classifySeamsNear`'s fan-out, on which both homes sit. Pure perf with one determinism caveat (N7). |
| seam-lite plan | Profiler: 5–10× cheaper lite plan (`:141-147`) | Adversary R2: trap unless bit-identical front-zone (`:374-378`) | **PARKED** unless provably bit-identical `nearestZoneToward` for every heart. | A divergent lite front-zone reintroduces the N2 asymmetry via a perf shortcut. |
| stage↔camp soft_buffer scope | Design D7/D20 promises it; Auditor flags no substrate (`:54-63`) | Pragmatist: defer geometry (`:166-174`); Adversary R2: scope OUT of golden commit (`:136-154`) | **OUT of the golden-move commit; lands in CG5.** | Camps on a separate grid = a fresh two-system existence surface that must not ride the commit moving the golden. |
| What proves removal is safe | Auditor/Adversary: superset-diff on the 2 pins (N5) | (linter / re-recorded golden as proxy) | **Superset-diff is the gate; linter-pass and re-recorded golden are NOT.** | The linter grades clearance, not "dropped the same set"; the golden re-records whatever the new world is, right or wrong. |
| Which sandbox surface | Existing 4B.3 line: hub-viewer + map-overlay (`tasks.md:253`) | Pragmatist: hub-viewer is single-hub; seams need the map-overlay (`:142-154`) | **map-sandbox overlay is the load-bearing seam surface (CG0, Slice 0).** | A seam is a two-hub phenomenon; `buildHubPreview` is single-hub. |

## Risk Register
| Risk | Severity | Mitigation | Owner |
| ---- | -------- | ---------- | ----- |
| Seam logic woven into `_computePlan` → recursion / 8 s hang / stack overflow | Critical | N1: separate post-base-plan pass; `_computePlan` never calls a neighbour's plan; structural grep proof | Architect / Adversary |
| Two chunks disagree on who/what-trims (load-order asymmetry — the band-aid bug) | Critical | N2: single source of truth — filter against the seam's `keeperZone`/`yielderZone` by stable `clusterSeed`/`IDX`; dark-emit order-independence proof (N4) | Adversary / Pragmatist |
| ~2.8 s cold `festivalPlan` fan-out stall on first touch of a fresh region | High | Frame-spread warming + proven-superset integer pre-filter + tighter `SEAM_PAIR_REACH`; PARK seam-lite (N7) | Profiler |
| Existence-flip via float: trim length / booth threshold not integerized; `Math.hypot`/`atan2` in trim projection | High | N3: integer length+booths before compare; all quantize via `rng.js quantize`; node==browser verify on a `.5`-boundary trim seed | Auditor / Adversary |
| Removing band-aids regresses the two fixed playtest pins | High | N5: superset-diff (planner ⊇ band-aid) on all 10 seeds + reproduce both cited pins; co-commit removal with response | Auditor / Architect |
| stage↔camp buffer = new two-system (heart+village) existence join on the golden commit | High | Scope OUT of golden commit → CG5; integer on both grid sides; verify node==browser across the join | Auditor / Adversary |
| Band-aid removal traps: orphaned `_STAGE_DECK_MAX`; nuking the co-located `closestBuilding` drum guard | Medium | Delete/merge `_STAGE_DECK_MAX`; keep the `chunks.js:1203` guard; don't orphan `drumR` | Auditor |
| Buffer geometry: per-leaf `buildTree` allocation, mis-disposed shared mat, reflexive castShadow | Medium | CG5: InstancedMesh / `userData.shared` bucketed pool; `castShadow=false` on path/seating/potty; tag new pooled resources | Profiler |
| Double-build across a seam straddling a chunk boundary | Medium | Single-owner integer-quantized anchor to the canonical keeper (one chunk owns it); chunkKey the buffer (arch precedent, NOT lake omission) | Architect / Adversary |
| Golden move masks a real bug (re-records a wrong world) | Medium | Inverted gate (N6): queryPoint stays `eddf8e50`; superset-diff (N5) is the correctness net, not the golden | Auditor |
| Adding the 6 ChatGPT lint rules mid-burndown | Low | Out of scope (`design.md:44`); do NOT add — moves the ruler mid-burndown | Auditor |

## Verdicts Summary
| Persona | Key Concern | Verdict |
| ------- | ----------- | ------- |
| Architect | The home of the response — must be a separate pure pass, not seam-aware memoized plan; preserve window-invariance + single-owner chunkKey | Proceed with mitigations |
| Auditor | The golden gate hinges on WHERE the response is emitted; emit in-plan or it's invisible to the golden and re-introduces load-order asymmetry; close/scope the camp-buffer hole | Proceed with mitigations |
| Pragmatist | The two-hub seam iteration surface doesn't exist (hub-sandbox is single-hub); build the map-overlay first; one golden move, split buffer geometry out | Proceed (with a hard re-scope of 4B.3) |
| Profiler | Cold `festivalPlan` fan-out = ~2.8 s synchronous chunk-gen stall on first touch; geometry is cheap, the planner recursion is the cliff | Proceed with mitigations |
| Adversary (R2) | The in-plan-vs-consume-filter fork is NOT the fatal axis — both stand on the same substrate; lean Auditor (one hash covers plan+seam) with Architect's single-owner chunkKey for additive records; the 7 non-negotiables carry the risk | Proceed with mitigations |

---

## Dissents preserved

-   **Architect — golden-frozen preference (`council-architect.md:73-79,
    200-219`).** The Architect's headline that `_computePlan` stays unchanged and
    "the per-heart POI golden need not move at all — only a new seam-layer
    snapshot is recorded" was **not adopted as stated**. The synthesis moves the
    golden (Decision 1). Recorded as a genuine dissent: the Architect's mechanism
    (a consume-time filter reading only canonical descriptors) is order-safe and
    is the kind of clean separation we want — the disagreement is narrow and on
    the *claim*, not the mechanism. If during build the emit-in-plan placement
    proves harder to keep non-recursive than a consume-time filter, the
    Architect's filter is the sanctioned fallback **provided** the suppression is
    still hashed into a first-class re-verified gate (N6) — at which point the two
    are equivalent on safety.
-   **Architect — stale-memo cleanliness point (`council-architect.md:73-79`;
    conceded by Adversary R2 `:31-44`).** This is **preserved as an invariant,
    not rejected.** A seam-blind `_computePlan` whose `(cx,cz)`/`(seed,epoch)`
    cache can never go stale w.r.t. a seam is the reason the chosen architecture
    runs the seam pass AFTER base-plan compute (N1) and keeps the seam decision a
    pure function of integers. The Architect won this axis; the synthesis banks
    the win inside the Auditor's single-hash placement.
-   **Profiler — seam-lite front-zone-only plan (`council-profiler.md:141-147`):
    DEFERRED, not rejected.** A 5–10× cheaper lite plan is an attractive stall
    mitigation, but it is PARKED until someone proves its front-zone pick is
    bit-identical to the full plan's `nearestZoneToward` for every heart (N7). If
    that proof lands later, it can be adopted as a non-golden perf follow-up.
-   **soft_buffer GEOMETRY + stage↔camp substrate: DEFERRED to CG5, not
    rejected.** The conflict-resolution separation ships in the golden move; the
    dressing and the camp-grid join are a fast-follow. They are real, on the
    roadmap, and scoped out of the riskiest commit deliberately — not dropped.
-   **The 6 ChatGPT lint rules: REJECTED for this change** (not deferred within
    4B.3) — out of scope per `design.md:44`; adding them moves the ruler
    mid-burndown. They can be considered as a separate later change.

---

## Feeds into tasks.md Group 4B (refinement guidance)
-   **New 4B.0 (from CG0)**: map-sandbox seam overlay as the Slice-0 iteration
    surface; refine the 4B.3 done-line so the map-overlay (not the single-hub
    hub-viewer) is the load-bearing seam-verification surface.
-   **Refine 4B.3 (from CG1+CG2+CG3)**: split into (a) dark-emit reconciliation
    pass + order-independence proof; (b) live slices yield→merge→trim→bare-buffer
    + cost mitigation + integer hygiene; (c) band-aid removal behind the
    superset-diff, with the two removal traps as explicit sub-criteria. Fold N1–N5
    and N7 in as done-criteria.
-   **Refine 4B.5 (from CG4)**: add the inverted-gate rollback (queryPoint stays
    `eddf8e50`; POI diff expected; rollback if queryPoint moves) and the
    move-log-block extension as explicit done-criteria (N6).
-   **Refine 4B.6 (from CG4)**: keep the 3-tier boot gate; explicitly watch the
    soft_buffer-midpoint host chunk on the HUD at `?perf=low`.
-   **New fast-follow (from CG5)**: soft_buffer geometry + stage↔camp substrate
    as a separate non-golden item — single-owner integer-quantized chunkKey'd
    records, pooled/instanced trees, `castShadow=false` buffer props.
