## The Adversary's Position

I ran the plan against the engine reality at file:line. The instancing *idea* is
sound and the disposal path is (surprisingly) already correct. What breaks is the
**descriptor refactor** the plan hangs everything on: it sits directly on top of
two load-bearing tripwires (determinism + sandbox return-shape) and the proposed
gate test (`bin/test-registry-grid`) is **structurally incapable** of catching the
exact regression it's being cited to guard against.

### Priority Sequence

1. **Freeze the rng call-order as an explicit, asserted invariant BEFORE touching
   any builder.** Add a real foliage-determinism gate (see Vuln 1) — without it,
   no slice ships.
2. **Decouple the descriptor refactor from the visual refactor.** Make builders
   emit descriptors *and keep returning a Group* (or keep the build* functions
   intact and add new `describe*` functions), so the sandbox's direct
   `buildTallPine()/buildOak()/buildBirch()/buildTree()` calls never break.
3. Only then swap the per-tree mesh for per-chunk InstancedMeshes, with unit geos
   `userData.shared` and a verified instance-buffer free on unload.

### Vulnerabilities Found

[Round-1 content above stands unchanged. Round-2 cross-examination follows.]

---

## Round 2 — Reactions

The crux of this round is **T1**: the Architect and Pragmatist both nominate
`bin/layout-snapshot` (a registry-entry before/after diff) as *the* determinism
gate, and both treat the new `bin/test-forest-determinism` golden-hash I asked
for in R1 as redundant. I read `bin/layout-snapshot` and the underlying
`__dbg.dumpRegistry()` source line-by-line this round. **The hole is real and
total. layout-snapshot passes green on a foliage regeneration. My R1 gate is not
redundant — it is the only thing that closes the hole.** I prove it below from
what the tool actually hashes, then concede the several places the other personas
are right.

### T1 resolved: does `layout-snapshot` pass green while the forest visually regenerates? — YES. Proven.

**The descriptor adds `scale` and `colorHex` (briefing plan step 1). Neither is in
the registry, and neither is in what layout-snapshot hashes. Here is the exact
projection chain, end to end:**

1. **`__dbg.dumpRegistry()` (main.js:1505-1515) emits exactly nine fields per
   entry:** `kind, x, z, footprint, colliderR, damage, attractorR, attractorW,
   chunkKey`. That is the *entire* payload the snapshot tool can ever see. **There
   is no `scale`, no `colorHex` — and, critically, no `crown` and no `perches`
   either**, even though the registry *entry* carries `crown`/`perches`
   (chunks.js:1071-1072, forests.js:929-930). The dump silently drops them.

2. **`normalizeEntries` (layout-snapshot:70-89) re-projects to the same nine
   fields** (`kind, x, z, footprint, colliderR, damage, attractorR, attractorW,
   chunkKey`) — it cannot recover a field `dumpRegistry` never emitted.

3. **The diff key `keyOf` (layout-snapshot:281) is**
   `kind|x|z|footprint|colliderR|damage|attractorR|attractorW|chunkKey`. That is
   what `--diff` (layout-snapshot:273-306) compares set-membership on. **A tree
   whose scale changed from 1.0 to 1.4 and whose foliage went from
   `FOREST_GREENS[2]` to `FOREST_GREENS[5]`, but whose trunk x/z is unchanged,
   produces a byte-identical key. `--diff` prints `EMPTY — layouts identical` and
   exits 0.**

So the answer to the briefing's framing is unambiguous: **if an rng reorder
changes a tree's scale or foliage color but leaves its position identical,
`layout-snapshot` passes green while the forest visually regenerates for every
mid-game player.** The registry diff is visual-blind by construction — it was
*built* to be (its header, layout-snapshot:34-35, scopes it to "stages, trucks,
booths, pottys, camps, trees, arches, lakes, roads" as *layout*, i.e. positions).
It is the correct tool for "did a building move," and the wrong tool for "did a
tree's species/size/shade change in place."

- **Re: Architect — "Gate-test determinism via the existing `bin/layout-snapshot`
  registry diff" (council-architect.md:29-30, :222) and "If a single tree
  position, perch, or crown moved, the rng order shifted" (:117-118)**: The first
  half is right *for position*; the second half is **factually wrong on
  perch/crown** and that's the dangerous part. The Architect's own claim is that a
  moved `perch` or `crown` surfaces in the diff. **It does not.** `crown` and
  `perches` are on the registry entry but `dumpRegistry` (main.js:1505-1515) never
  serializes them, so `normalizeEntries` never sees them and `keyOf`
  (layout-snapshot:281) never compares them. A reorder that changes which
  species/size a tree gets *does* change `crown.r` and the perch-ring radius (R1
  Vuln 4) — birds land differently — and `layout-snapshot --diff` still prints
  EMPTY. The Architect is relying on a field the gate provably discards. This
  *strengthens* my R1 position rather than refuting it.

- **Re: Pragmatist — "`bin/layout-snapshot` captures `forest_tree`/`tree`
  registry entries (bin/layout-snapshot:35, keyed `kind|x|z|footprint|...` at
  :281). A before/after self-diff is the determinism proof" (council-pragmatist.md
  :28-31, :147-154, Key Concern :253-258)**: Half-right, and the half that's wrong
  is load-bearing. The self-diff **is** a sound proof that *no tree moved* — that's
  real and worth running. But the Pragmatist generalizes it to "the determinism
  proof" full stop, and the `...` in `kind|x|z|footprint|...` is doing enormous
  silent work: those trailing fields are `colliderR|damage|attractorR|attractorW|
  chunkKey` (layout-snapshot:281) — every one a *placement/collision* attribute,
  **none** of them `scale` or `colorHex`. For trees specifically, `colliderR`
  (1.3) and `footprint` (2.0) are **hard-coded constants** at the registration
  site (chunks.js:1068-1069, forests.js:923-924) — they do not vary with the rng
  build at all. So for a `forest_tree` entry the *only* rng-sensitive field in the
  diff key is `x|z` (the placement loop), and the *entire visual descriptor* —
  scale, color, species, crown radius, perch ring — is outside the key. The
  Pragmatist's "byte-identical positions == rng order preserved" (:153) is
  **false as stated**: positions can be byte-identical while the per-tree build
  stream silently reordered (greenIdx before trunkH, scale hoisted above
  greenIdx — exactly the R1 Vuln-1 reorderings). layout-snapshot cannot see it.

- **Is the drawCounts canary the Pragmatist's escape hatch? No — I checked, and
  it doesn't cover trees.** The Pragmatist might reach for the `drawCounts` canary
  (layout-snapshot:294-298; "positions matched but a draw was added/dropped/
  reordered") as the thing that catches an rng-count change. It would be a fair
  move *if it covered trees.* **It does not.** `worldgenDrawCounts` is populated
  in exactly one place — `buildWorldgenKind` (chunks.js:1304-1325), whose switch
  is `main_stage / side_stage / tent_stage / arch / food_court / vendor_row /
  bubble_vendor / porta_bank / drum_circle / camp_village`. **There is no `tree`
  case.** The v2 forest path is `scatterWorldgenTrees(ctx)` called at
  chunks.js:485 — a *separate* function that never routes through the counting
  `cctx` wrapper (chunks.js:1311) and uses its own `ctx.rng`. So the canary tallies
  draws for stages and booths, and **zero** draws for forest trees. Even the
  count-change class of break (R1 Vuln 1's variable-length bump/crown loops) is
  invisible to the canary for trees. The canary does not save the gate here.

  **Net on T1: my R1 `bin/test-forest-determinism` is MANDATORY, not optional,
  and crown.r does NOT incidentally cover scale.** crown.r is computed from the
  rng build (trunkH/mainR), so it *would* be a useful proxy — but it is discarded
  by `dumpRegistry` before any gate sees it (main.js:1505-1515), so it covers
  nothing as the pipeline stands. The minimal gate that closes the hole is stated
  below.

### The minimal gate that closes the hole

There are two honest options; either closes T1, and they're roughly equal effort.

- **Option A (my R1 proposal, preferred — pure node, agent-runnable):** a new
  `bin/test-forest-determinism` that `register('./node-three-shim.mjs')` (the exact
  pattern test-registry-grid uses at line 28-29), imports the **real** `tree.js`,
  runs `buildForestTree(mulberry32(FIXED))` N times, and golden-hashes the **full
  descriptor stream** — `type, trunkH, trunkR, greenIdx (→ colorHex), every
  bump/crown/tier draw, mainR/baseR (→ scale), rotation`. Capture the golden from
  `main` *before* the refactor; the refactor passes iff the hash is unchanged. This
  is the only gate that asserts the R1 Vuln-1 invariant ("identical rng order AND
  count, including variable-length loops"). It needs no browser, so it's an
  **agent-static gate** — strictly better than a Gary round-trip for a load-bearing
  invariant, and it can run on every slice in CI-style cadence.

- **Option B (extend the existing gate — more plumbing, keeps one tool):** add
  `crown` (at least `crown.r`) and a foliage signature (`colorHex` and `scale`) to
  the `dumpRegistry` projection (main.js:1505) AND to `normalizeEntries` +
  `keyOf` (layout-snapshot:73-89, :281). Then the self-diff *would* catch a foliage
  reorder. But this widens "built-truth layout" to include render-only descriptor
  fields — a real scope change to a tool whose header explicitly scopes itself to
  *layout* — and it's still a Gary browser round-trip, not an agent-static gate.

**Recommendation: Option A.** It's the smaller blast radius (a new isolated test
file, no change to the dump contract), it runs without WebGL so the agent can gate
it directly, and it tests the builders at the source of the invariant rather than
three projections downstream. layout-snapshot stays exactly as-is and keeps doing
its real job — proving no tree *moved* — which I fully endorse running *in
addition*. The two gates are complementary, not redundant: layout-snapshot guards
placement (the scatter-loop rng), test-forest-determinism guards the per-tree
build stream (scale/color/species/crown). T1's hole is precisely the gap between
them.

### Concessions — where the other personas are right

- **Re: Architect / Pragmatist / Auditor / Profiler — disposal is already correct
  at chunks.js:563.** I independently verified this in R1 Vuln 2 and reconfirm it:
  `disposeChunkByKey` (chunks.js:553-565) reaches `if (obj.isInstancedMesh)
  obj.dispose()` at line 563 inside the `isMesh` guard (InstancedMesh `isMesh ===
  true`), the header at chunks.js:552 states the contract, and the shared unit
  geos are skipped at 556. **Briefing risk #2 is closed by existing
  infrastructure** — full agreement with all four personas. The only knife-edge
  (R1 Vuln 2) is that the per-chunk InstancedMesh must be a child of `ctx.group`
  and must **not** be tagged `userData.shared` — the Auditor (checklist item 2,
  council-auditor.md:168-169) and Profiler (:82) both call this out correctly.

- **Re: Architect — "there are FOUR call sites, not two" (council-architect.md
  :130-152).** This is the best structural catch in R1 across all personas and I
  had it only partially. The `ctx.rng`-coupled `scatterTrees` (chunks.js:1696) is
  a genuinely higher-blast-radius determinism hazard than the isolated-rng forest
  paths — instancing it wrong desyncs *every other prop in the chunk*, not just
  trees. Deferring it (Architect slice plan) is correct, and it sharpens my R1
  Vuln 1: the golden-hash gate must cover the `ctx.rng` path separately if/when
  slice 2 touches it, because a desync there won't even surface as a tree move.

- **Re: Profiler — the LIVE path is v2 `scatterWorldgenTrees` (chunks.js:1036),
  not legacy v1 `scatterForestTrees` (council-profiler.md:8).** Correct and it
  matters for my gate: I verified `DEFAULT_WORLDGEN_V2 = true` is the shipped
  default, and the v2 registration (chunks.js:1060-1074) carries the identical
  `perches`/`crown` payload as v1 (forests.js:929-930). So `test-forest-
  determinism` must golden-hash the path that actually ships. My R1 traced both
  forest paths but framed v1 first; the Profiler is right that v2 is where the
  production draw win (and the production determinism risk) lives.

- **Re: Auditor — the castShadow bucket split is ~5 instanced meshes/chunk, not 3
  (council-auditor.md:114-130), and the cast/no-cast boundary must BE the bucket
  boundary.** I under-weighted this in R1. It's not just a perf-budget point — an
  all-or-nothing instanced `castShadow` that "just casts the whole crown bucket"
  silently walks the 56-caster audit back up (tripwire #9) by casting oak bumps,
  upper pine tiers, and every birch puff that the audit deliberately stripped
  (tree.js:185, :217 vs :222-232, :271). The Auditor and Profiler (:69-72)
  converge here and they're right; this belongs on the ship checklist.

### Revised Verdict

- **New Verdict**: **Proceed with mitigations** — *unchanged* from R1, but my key
  concern is now **proven, not asserted.** Reading `layout-snapshot` and
  `dumpRegistry` at the source this round did not soften my R1 position — it
  hardened it. The two personas who nominated layout-snapshot as *the* determinism
  gate (Architect :29, Pragmatist :253) are relying on a tool that, for trees,
  hashes only `kind|x|z` (footprint/colliderR/damage are hard-coded constants at
  the registration site, and crown/perches/scale/colorHex are never serialized by
  `dumpRegistry`). A foliage-only rng reorder — the *exact* class the descriptor
  refactor risks (R1 Vuln 1) — produces `EMPTY — layouts identical`. The minimal
  hole-closing gate is my R1 `bin/test-forest-determinism` (Option A): a node
  golden-hash of the real `tree.js` descriptor stream, captured from `main` first,
  run agent-static on every slice. **It is mandatory, it is not redundant with
  layout-snapshot, and crown.r does not incidentally cover scale because
  `dumpRegistry` discards crown before any gate can read it.** Run layout-snapshot
  *too* — it proves no tree moved, which test-forest-determinism does not. Both,
  not either. Everything else (disposal, four-site scoping, v2-path, castShadow
  buckets) I concede to the personas who caught them.
