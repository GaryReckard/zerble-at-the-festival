# Council — The Adversary, Round 2 (cross-examination)

> Appended to council-adversary.md. Lens: determinism / tripwire safety of the
> architecture fork. The orchestrator's question: which architecture is SAFER
> against the failure modes I raised in R1 (recursion dead-end, trim asymmetry,
> stale memo, load-order in the streaming proximity build, the `quantize(.5)`
> cross-engine flip). Every claim cited; concessions called out plainly.

## The fork, stated precisely

- **Auditor** (`council-auditor.md:48-50, 239-248`): emit the response INSIDE
  `_computePlan`'s descriptor output. The POI golden MOVES (correct, gated).
  Recursion is "real but BOUNDED" — use the 4B.2 read-memoized-neighbour shape,
  not plan-within-plan recursion.
- **Architect** (`council-architect.md:30, 73-79, 86-90`): a separate pure
  `seamResponsesNear(bounds)` pass + a consume-time FILTER over
  `festivalPlan(h)` in `placeWorldgenProps`. `_computePlan` is UNCHANGED, so the
  per-heart POI golden stays FROZEN; only a NEW seam-layer snapshot is recorded.

These are not as far apart as they read — both agree the response must NOT
recurse inside `_computePlan` (`council-auditor.md:247-248`,
`council-architect.md:148-152`). My R1 Key Concern (`council-adversary.md:182-188`)
is satisfied by EITHER. The live disagreement is narrow and entirely about the
golden: does the descriptor change live in the hashed plan (Auditor) or outside
it (Architect)?

---

## Round 2 — Reactions

-   **Re: Architect — "If the response is a consume-time filter + additive
    cross-heart records, `_computePlan` itself is unchanged, so the per-heart POI
    golden need not move at all — only a new seam-layer snapshot is recorded"
    (`council-architect.md:73-79`)**: This is the cleanest answer to my R1
    stale-memo vulnerability (`council-adversary.md:141-145`), and I concede it
    is strictly safer THERE. If `_computePlan(A)` never reads B, the `_planCache`
    key `(cx,cz)` under the `(seed,epoch)` gate (`festival.js:493-496, 511-521`)
    can never go stale w.r.t. a seam — there is no seam dimension to invalidate
    because the plan has no seam content. The Auditor's emit-in-plan does NOT
    have this property for free: a plan computed and cached BEFORE its
    neighbour's seam-response is known would be cached stale unless the seam
    decision is a pure function the plan can compute from integers alone (it can
    — see below — but it's an extra invariant to hold, not a free one). **On the
    stale-memo axis, Architect wins.**

    BUT — the Architect overclaims that the golden stays frozen, and this
    collides with a design lock. `design.md:144-146` explicitly **rejected** the
    "keep it builder-side to freeze the golden" alternative: *"Alternative (keep
    it builder-side to freeze the golden) rejected — it cannot be made
    order-independent (chunks build in player-proximity order), which is the
    exact bug the band-aids already exhibit."* The Auditor cites the same lock
    (`council-auditor.md:48-50`). So the Architect must answer the question
    in (a) below: is a consume-time filter in `placeWorldgenProps`
    (`chunks.js:1185`) a *builder-side* decision (the rejected class) or a
    *planner-derived* one that merely executes at consume time? My adjudication
    is that it is the latter ONLY if the filter consults nothing but the
    pre-computed seam descriptors — see (a). The Architect's own draft already
    requires this ("keyed on stable `clusterSeed`/`IDX`",
    `council-architect.md:170, 214`), so the position is internally salvageable,
    but the "golden frozen" headline is too strong as written.

-   **Re: Auditor — "the safe shape is the 4B.2 pattern already proven: a seam
    pass that reads neighbours' memoized `festivalPlan` ... and APPLIES the
    trim/merge to the keeper/yielder descriptors ... Keep that shape; do not make
    `_computePlan` call `_computePlan` of a neighbour that in turn seams back"
    (`council-auditor.md:243-248`)**: Agree this is non-recursive and safe AS A
    READ. This directly answers orchestrator question (b): the Auditor's
    emit-in-plan does NOT re-open my R1 recursion dead-end
    (`council-adversary.md:34-53`) **provided** the emission is structured as
    `classifySeamsNear` already is — `_computePlan(A)` produces a base plan with
    NO seam content, and a separate seam-application step (running after both base
    plans are memoized) mutates/annotates the keeper/yielder descriptors. The
    cycle I feared only forms if `_computePlan(A)` itself, mid-compute, asks "do
    I trim?" and that question calls `festivalPlan(B)` whose `_computePlan(B)`
    asks the same of A. As long as the seam step is OUTSIDE base-plan compute,
    there is no cycle. **Concession: my R1 framing ("4B.3 must emit the response
    into the plan, and that re-opens the cycle") was too absolute — emit-in-plan
    can be made acyclic.** The honest statement is: emit-in-plan is acyclic IF
    the emission is a post-base-plan annotation pass, and FATAL if it is woven
    into `_computePlan`. The Auditor names the safe shape; the danger is that
    "emit inside `_computePlan`'s output" (`council-auditor.md:49`) is one
    sentence away from "emit inside `_computePlan`'s logic," and a future
    implementer will not feel the difference. That ambiguity is itself a
    tripwire.

-   **Re: Profiler — "~47 ms per cold `festivalPlan` ... A single chunk crossing
    into virgin territory would warm ~60 neighbour plans = ~2.8 s of synchronous
    work on the chunk-gen path" (`council-profiler.md:120-124`)**: This is the
    load-bearing cross-examination point and it dissolves part of the fork.
    **The 2.8 s stall exists in BOTH architectures**, because BOTH call
    `festivalPlan(seam.keeper)` and `festivalPlan(seam.yielder)` over the
    `seamPairsNear` fan-out — that is `classifySeamsNear` (`festival.js:357-359`),
    which both the Auditor's emit-pass and the Architect's `seamResponsesNear`
    sit on top of. Neither architecture changes the cold-warm cost; the cost is
    in the substrate they share. So the cold-plan stall is NOT a discriminator
    between the two homes — it's a precondition both must fix. See (d) for whether
    it's a determinism concern. **Concession to Profiler: I under-weighted this in
    R1.** I cited the 8 s/stack-overflow dead end (`session-log.md:421-429`,
    `council-adversary.md:44-48`) as the recursion risk, but Profiler's probe
    shows the *fan-out cost is real and present even in the non-recursive read
    shape both personas endorse* (`council-profiler.md:103-118`). The
    architecture decision does not save you here; a `SEAM_PAIR_REACH` tighten +
    integer pre-filter before the `festivalPlan` calls (`council-profiler.md:152-158`)
    does.

-   **Re: Pragmatist — "Develop them behind a dark-emit (compute the response,
    assert order-independence, but don't write it into `out[]`) so each can be
    validated against `classifySeamsNear` BEFORE the single commit that flips them
    all live" (`council-pragmatist.md:90-91, 242-243`)**: Strongly agree, and this
    is the single best determinism-safety idea in the round. A dark-emit pass that
    computes the response for hub A AND hub B and ASSERTS they agree —
    bit-for-bit, across a shifted window (the order-independence probe the project
    already runs, `tasks.md:230` "337 shared pairs agree on keeper+hash across
    shifted windows") — is the positive order-independence test I demanded in R1
    (`council-adversary.md:19-21`). It catches my trim-asymmetry vulnerability
    (`council-adversary.md:55-71`) BEFORE the golden moves, with no rollback cost.
    This belongs in the build plan regardless of which home wins.

-   **Re: Architect — "additive ... soft_buffer trees/hammocks/potty + cosmetic
    connector path as single-owner, chunkKey'd descriptors anchored to the
    canonical keeper (arch precedent, NOT the lake chunkKey-omission)"
    (`council-architect.md:106-131, 214-217`)**: Agree, and it sharpens my R1
    lifecycle note (`council-adversary.md:163-177`). The Architect's single-owner
    anchoring to the canonical keeper (`festival.js:290` `seamHash`,
    `:283-285` canonical pair) is the right fix for the double-build-across-seam
    hazard, and the arch-vs-lake chunkKey distinction (`council-architect.md:122-131`,
    D15) is correct: a seam buffer is hub-scale furniture, it MUST unload with its
    owning chunk, it must NOT copy the lake `chunkKey`-omission (CLAUDE.md
    tripwire #5). One sharpening: "anchored to the keeper's plan-space position"
    must itself be an INTEGER anchor (quantized), or the chunk-ownership test
    (`placement.js:29-31` half-open `inChunk`) can flip which chunk owns the
    buffer across engines for a seam whose anchor sits on a chunk boundary — a
    second instance of the existence-flip class, just for ownership instead of
    presence.

-   **Re: Auditor — "stage↔camp buffer has no substrate ... `nearestZoneToward`
    only scans `SEAM_ZONE_KINDS = {stages, drum, vendor_row, food_court}`
    (`festival.js:309, 327-336`) ... never a stage↔camp buffer ... This is a
    regression hole, not just an under-spec" (`council-auditor.md:54-63`)**:
    Conceding this is a real gap I missed in R1, and flagging its determinism
    edge: camps live on `campVillagesNear` (`festival.js:731`), a SEPARATE coarse
    grid with its OWN existence gate. If 4B.3 reaches into camp data to form a
    stage↔camp buffer, the buffer's existence now depends on TWO independent
    deterministic systems agreeing — the heart plan AND the village grid. That
    join is a new cross-system existence surface, and it must be integer on BOTH
    sides or a buffer can exist on Chrome (village grid says "camp here") and
    vanish on node. The Architect names the same two-source read
    (`council-architect.md:188-193`). My adjudication: scope stage↔camp buffers
    OUT of the golden-move commit (Pragmatist's Slice-2 deferral,
    `council-pragmatist.md:166-174`), precisely because the two-system existence
    join is a fresh determinism risk that should not ride the same commit that
    moves the golden. Ship drum↔stage `yield` (both in `SEAM_ZONE_KINDS`,
    fully expressible today, `council-auditor.md:65-73`) + food merge + commerce
    trim now.

---

## Adjudication (the orchestrator's four questions)

### (a) Does the Architect's consume-time FILTER actually eliminate the load-order bug?

**Yes — but ONLY under a condition the Architect states and must be made a hard
done-criterion, not an aspiration.** The condition: BOTH chunks resolve the
suppression from the SAME pre-computed seam descriptor, never each from its own
re-scan of its own plan.

Walk the failure I raised in R1 (`council-adversary.md:55-71`) against the
filter. Hub A's chunk and hub B's chunk build independently, in proximity order.
Each calls `seamResponsesNear(bounds)` once (`council-architect.md:90-94`). The
question is whether they compute the IDENTICAL "who yields, and which descriptor
is suppressed."

- **Who yields** is safe. Both sides derive the keeper from `getHubPriority`
  (uint32, `festival.js:257-259`) on the CANONICAL pair (`festival.js:283-285`,
  lexicographic `(cx,cz)` tie-break). This is order-independent BY CONSTRUCTION —
  it does not matter which chunk asks; the keeper is a pure function of the two
  cells + seed. 4B.1 already proves it ("337 shared pairs agree on keeper+hash
  across shifted windows", `tasks.md:230`). Architect is right
  (`council-architect.md:97-104`).

- **Which descriptor is suppressed** is the latent bug, and "both sides resolve
  from `getHubPriority` + the 4B.2 keeperZone/yielderZone descriptors" is
  **sufficient — but only because `classifySeamsNear` computes `keeperZone`/
  `yielderZone` ONCE from the canonical pair, not because each chunk re-derives
  them.** This is the load-bearing detail. Look at the substrate
  (`festival.js:357-359`):

  ```
  const eK = nearestZoneToward(festivalPlan(seam.keeper), seam.yielder);
  const eY = nearestZoneToward(festivalPlan(seam.yielder), seam.keeper);
  ```

  `eK`/`eY` are stored on the seam as `keeperZone`/`yielderZone`
  (`festival.js:367-368`). Crucially, `nearestZoneToward` (`festival.js:327-336`)
  iterates with strict `if (sq < bestSq)` — first-in-iteration-order wins exact
  ties (`festival.js:333`). The iteration order is the `out[]` order of
  `_computePlan`. **This is safe IFF both chunks call `classifySeamsNear` /
  `seamResponsesNear` and read the SAME `keeperZone`/`yielderZone` it produced
  from the canonical pair.** If, instead, hub B's filter re-scans "which of MY
  zones is nearest hub A" by calling `nearestZoneToward(festivalPlan(B), A)`
  itself, and hub A's filter computes "which of B's zones conflicts with me" by
  some OTHER path, they can pick different zones on an exact `sq` tie, and the
  suppression lands on the wrong descriptor or twice. The seam descriptor's
  `yielderZone` is the single source of truth; both consume sides must filter
  against THAT, identified by a stable key (`clusterSeed` / `IDX`,
  `festival.js:528-536`, which the Architect names at `council-architect.md:170`).

  So: **"both sides resolve from getHubPriority + the keeperZone/yielderZone
  descriptors" IS sufficient to guarantee agreement without communication** —
  but the guarantee comes from `seamPairsNear`'s canonical pair ordering
  (`festival.js:283-285`) making `classifySeamsNear`'s output a pure function of
  the two cells, NOT from the filter being "consume-time." A consume-time filter
  that re-scans per chunk would re-introduce the asymmetry. The filter eliminates
  the load-order bug **only if it is a dumb executor of a pre-computed,
  canonical-pair-derived suppression list**, identified by stable
  `clusterSeed`/`IDX`. This must be written as a done-criterion: *"both chunks
  filter against the same `seamResponsesNear` `yielderZone.clusterSeed`; neither
  chunk re-runs `nearestZoneToward` on its own plan to decide what to drop."*

  **Verdict on (a): the filter eliminates the load-order bug, and it is
  order-independent for the SAME structural reason the Auditor's emit-in-plan
  is — both stand on `classifySeamsNear`'s canonical-pair purity. The home of
  the response (in-plan vs consume-filter) is NOT what makes it order-safe;
  the shared canonical substrate is. This collapses the fork's stakes
  considerably.**

### (b) Does the Auditor's emit-in-plan re-open recursion, or can it be a pure non-recursive function of (seed, two cells)?

**It can be made pure non-recursive, and the Auditor names the safe shape —
but the phrasing is one word away from the fatal shape, so the build plan must
nail the distinction.** As established in my reaction above: a cycle forms ONLY
if the seam decision is woven into `_computePlan` such that computing A's base
plan calls B's, which calls A's. It does NOT form if the seam application is a
SEPARATE pass that runs after both base plans are memoized (the
`classifySeamsNear` shape, `festival.js:357-359`, which is already non-recursive
because it reads two already-or-cheaply-memoized plans and writes nothing back).

The danger is the Auditor's own wording: "emitted *inside* `_computePlan`"
(`council-auditor.md:49`) vs "a seam pass that reads neighbours' memoized
`festivalPlan` ... and APPLIES the trim/merge to the keeper/yielder descriptors"
(`council-auditor.md:243-244`). The first is fatal; the second is safe. They are
not the same thing, and the Auditor uses both. **Build-plan requirement: the seam
response is a post-base-plan annotation step — `_computePlan` produces a
seam-blind base plan; a separate idempotent pass keyed on the canonical pair
annotates/suppresses descriptors. `_computePlan` MUST NOT call `festivalPlan` of
a neighbour.** With that, emit-in-plan IS a pure non-recursive function of (seed,
two cells), and my R1 recursion vulnerability does not fire.

Is (seed, two cells) genuinely sufficient input? Yes for the DECISION (keeper via
`getHubPriority(cx,cz,seed)`, conflict via integer `distSq > thr*thr`,
`festival.js:362-364`). The two cells + seed determine the pair, the keeper, the
fronts (`keeperZone`/`yielderZone` are pure functions of the two memoized plans,
which are themselves pure functions of their hearts + seed), and the type. No
third input. The Profiler's 2.8 s is a COST of computing those two plans, not a
correctness or recursion problem (see (d)).

### (c) The EXACT determinism mitigations that MUST be in the build plan

These hold **regardless of which home wins**, because both stand on the same
substrate and both emit/suppress the same descriptors:

1. **Superset-diff BEFORE band-aid removal.** Before deleting
   `neighbourCourtHere` (`chunks.js:1173-1183`) and `stageDeckClips`
   (`festival.js:233`, called `chunks.js:1201`), dump the band-aid output
   (omitted-court set + yielded-drum set) across the 10 baseline seeds, dump the
   planner-response output, and require planner ⊇ band-aid. Reproduce the two
   cited CHANGELOG pins exactly: seed 1139472710's court pair
   ("8 trucks → one court of 5", `CHANGELOG.md:9`, `council-auditor.md:75-81`)
   and the drum-clips-stage pin ("heart (1,0)'s drum at (237,213) with
   `clipsStage:true`", `CHANGELOG.md:10`, `council-auditor.md:70-73`). The linter
   grades clearance, NOT "did we drop the same things" — so the linter passing is
   NOT this gate (`council-adversary.md:123-127`). This is the correctness net;
   the re-recorded golden is NOT (it re-records whatever the new world is, right
   or wrong — `council-adversary.md:147-161`).

2. **`node==browser` verify hitting a `.5`-boundary trim seed.** A clean
   self-test on the two pinned seeds does NOT prove the existence-flip class is
   absent (`council-adversary.md:104-107`). The verify must exercise a seed where
   a TRIM length sits within ULPs of an integer `.5` boundary before `quantize`
   (`rng.js:106-108`). `Math.round` is engine-stable on `.5`
   (`council-auditor.md:92-101` confirms — round-half-up is spec-defined); the
   exposure is whether the float REACHING `quantize` is bit-identical, and any
   new trim coordinate from `Math.atan2`/`Math.hypot`/`sqrt` is NOT bit-identical
   across V8 forks (`council-adversary.md:96-101`; `walkOriented`
   `festival.js:417-431` uses both `Math.hypot` and `Math.atan2`; the trim is a
   projection onto a road axis, exactly that). The Auditor's correct rule:
   **every seam quantize goes through `rng.js quantize`, never ad-hoc
   `| 0`/`Math.floor`/`Math.trunc`** (`council-auditor.md:98-101`). Add: the trim
   LENGTH and the "≥ 3 booths" threshold must BOTH be integer-meters/integer-
   booths before the compare (`council-adversary.md:84-88`), mirroring
   `seamExtentInt` (`festival.js:316-322`). The Profiler/Architect agree the trim
   length is a quantized integer field in the descriptor (`council-architect.md:178-183`).

3. **Single source of truth for who-trims / what-trims.** Per (a): both consume
   sides resolve suppression from the seam's `keeperZone`/`yielderZone`
   (`festival.js:367-368`) identified by stable `clusterSeed`/`IDX`
   (`festival.js:528-536`), NEVER each from its own `nearestZoneToward` re-scan
   (`festival.js:327-336`, strict-`<` tie on iteration order, `:333`). Who-keeps
   = `getHubPriority` on the canonical pair (`festival.js:283-289`). One seam,
   one descriptor, one suppression — written once by the seam pass, read by both
   chunks.

4. **Dark-emit order-independence assertion (Pragmatist, `council-pragmatist.md:90-91`)
   BEFORE the golden moves.** Compute the response for both hubs of every seam
   across a shifted window and assert bit-identical agreement, as 4B.1 already
   does for keeper+hash (`tasks.md:230`). This catches trim-asymmetry pre-commit.

5. **The golden move is a `node==browser` check, NOT a correctness check.**
   Inverted gate (Auditor, `council-auditor.md:154-161`): POI diff non-empty is
   EXPECTED; rollback trigger is queryPoint moving OFF `eddf8e50` (would mean the
   response touched road/water existence, a D5 violation) OR browser POI not
   matching node in the recent-V8 class. Band-aid removal + response co-committed
   so rollback is one revert (`council-adversary.md:159-161`,
   `council-architect.md:172-177`).

**On the golden specifically — adjudicating Auditor-MOVES vs Architect-FROZEN:**
I side with the **Auditor that the golden MOVES**, against the Architect's
"frozen + new snapshot" framing — but the Architect's *mechanism* (consume-time
filter) is fine; it's the *claim* that's wrong. design.md:144-146 rejected the
builder-side-to-freeze-the-golden alternative because it cannot be
order-independent. A consume-time filter in `placeWorldgenProps`
(`chunks.js:1185`) that reads only the canonical seam descriptors is
order-independent (per (a)), so it is NOT the rejected class — BUT it changes
what the world builds, and the project's determinism story for v2 wants that
change captured in a hashed gate. If suppression lives outside the POI golden,
then NOTHING hashes "did the right descriptor get dropped" except the new seam
snapshot. So the Architect's "new seam-layer snapshot" is not optional comfort —
it IS the golden for the seam layer, and it must be a first-class recorded gate,
re-verified node==browser, with the same inverted-gate rollback. Whether you call
that "the POI golden moved" or "a new snapshot recorded," the irreversible gated
step is identical and the safety properties are identical. **The fork is
cosmetic on the safety axis as long as the suppression decision is hashed
somewhere and node==browser-verified.** Pick whichever keeps the hash CLOSEST to
the decision: emit-in-plan (Auditor) puts the suppression in the same hash that
already covers the plan, which is the smaller surface to reason about and the
harder one to accidentally leave un-hashed. **On the determinism-coverage axis, I
lean Auditor — one hash that covers both plan and seam beats two hashes where the
seam one can be forgotten.** On the stale-memo axis, Architect was cleaner (see
reaction). Net: the decision should be driven by which is easier to keep
non-recursive and fully-hashed, not by a golden-freeze that isn't really achievable.

### (d) Profiler's 2.8 s stall — determinism concern or pure perf?

**Pure perf, with ONE determinism caveat that must be a hard rule.** The 2.8 s
(`council-profiler.md:114-118`) is synchronous cold-plan fan-out cost —
`60 cold festivalPlan × ~47 ms` — on the chunk-gen path. It is the
allocation-cost class (`.claude/rules/performance.md` "frame stalls when
something spawns"), not a divergence: computing the plans is deterministic, just
slow. A full warm vs a fully-cold region produce the IDENTICAL plans (memoization
is a cache, `festival.js:511-521`, not a behavior change). So the stall itself
changes no output.

The determinism caveat — and it is a real tripwire: **whatever mitigation is
chosen for the stall must not be a TIMEOUT or a PARTIAL warm that changes
output.** Two of the Profiler's mitigations are determinism-safe; one would be a
trap if implemented naively:

- **Safe:** spread first-touch warming across frames within the 1-chunk/frame
  budget (`council-profiler.md:134-140`) — same plans, later. Tighten
  `SEAM_PAIR_REACH` / add an integer pre-filter before the `festivalPlan` calls
  (`council-profiler.md:152-158`) — this only AVOIDS computing plans for pairs
  the integer gate would reject anyway (`festival.js:362-364`), so output is
  identical IF the pre-filter is a conservative SUPERSET of the real gate (never
  prunes a pair the gate would keep). That superset property must be asserted, or
  a too-tight pre-filter silently drops a seam → a row exists with the band-aids
  and vanishes after — an existence flip via perf optimization. **Pre-filter must
  be proven to never under-select vs the integer existence gate.**

- **Trap:** a "seam-lite plan that computes only the front zones"
  (`council-profiler.md:141-147`). If the lite-plan's front-zone pick can EVER
  differ from the full plan's `nearestZoneToward` result, then `keeperZone`/
  `yielderZone` computed from the lite-plan diverge from what a chunk that
  happened to have the FULL plan warm would compute — and now two chunks
  disagree on the front (the exact (a) asymmetry, reintroduced via a perf
  shortcut). A seam-lite plan is determinism-safe ONLY if it provably yields the
  bit-identical `nearestZoneToward` zone as the full plan for every heart. That
  is a strong invariant; I would not take it in the golden-move commit. Prefer
  frame-spreading + the proven-superset integer pre-filter, and park seam-lite.

So: **2.8 s is perf, not determinism — but its FIX is one place a perf change can
silently become an existence-flip determinism bug.** The build plan must require
that any stall mitigation produces bit-identical seam descriptors to the
no-mitigation baseline (assert it in the dark-emit pass, mitigation (c)(4)).

---

## Revised Verdict

-   **New Verdict**: Proceed with mitigations — unchanged from R1, but my Key
    Concern is downgraded and re-pointed. After reading the actual positions, the
    in-plan-vs-consume-filter fork is **NOT the fatal axis I framed it as in R1**.
    Both architectures stand on `classifySeamsNear`'s canonical-pair substrate
    (`festival.js:283-289, 357-368`); both are order-independent for the SAME
    reason; both are non-recursive IF the seam step runs after base-plan compute;
    both incur the SAME 2.8 s cold fan-out (`council-profiler.md:114-118`); both
    must hash the suppression decision and node==browser-verify it. What moved me:
    the Architect's stale-memo cleanliness (`council-architect.md:73-79`) is real
    and concedeable, but their "golden frozen" claim collides with the design
    lock at design.md:144-146; the Auditor's emit-in-plan keeps the decision and
    its hash in one place, which is the smaller determinism surface
    (`council-auditor.md:48-50, 247-248`); and the Profiler's probe
    (`council-profiler.md:103-124`) proves the cost lives in the shared substrate,
    not in either home — so the home choice should be driven by "which is easier
    to keep non-recursive and fully-hashed," which favors the Auditor's
    single-hash placement, with the Architect's single-owner chunkKey discipline
    (`council-architect.md:106-131`) adopted for the ADDITIVE buffer records.
-   **The non-negotiables** (hold regardless of home): (1) seam step runs AFTER
    base-plan compute; `_computePlan` never calls a neighbour's `festivalPlan`
    (kills recursion — answers (b)); (2) both consume sides filter against the
    seam's `keeperZone`/`yielderZone` by stable `clusterSeed`/`IDX`, never a
    per-chunk re-scan (answers (a)); (3) trim length + booth count are integer
    before the existence compare, all quantize via `rng.js quantize`
    (`rng.js:106-108`); (4) dark-emit order-independence + bit-identical-under-
    mitigation assertions BEFORE the golden moves; (5) superset-diff vs the
    band-aids on the two cited pins BEFORE removal, co-committed; (6) the
    suppression decision is hashed and node==browser-verified somewhere — the POI
    golden moving is the simplest way to guarantee that; (7) any stall mitigation
    must produce bit-identical seam descriptors (seam-lite plan parked unless that
    is proven). Scope stage↔camp buffers OUT of the golden-move commit
    (`council-auditor.md:54-63`, `council-pragmatist.md:166-174`) — the
    two-system camp/heart existence join is a fresh determinism surface that
    should not ride the commit that moves the golden.
