# Council Adversary — worldgen-layout-harness (round 001-initial)

## Verdict

The harness idea is right and D-A (instrument before surgery) is the correct
reflex — but as specced, the D-A gate cannot prove what D-C promises, and D-C
itself is not implementable at the stated scope. The cluster rng stream in every
builder interleaves three kinds of draws the plan doesn't account for:
model-internal cosmetic draws (`buildTent(ctx.rng)` etc. — the models draw
*inside* three.js-dependent code), crowd personality draws (`crowd.spawn({rng:
ctx.rng})` — gated on a perf-tier-sized pool with a **zero-draw early return**),
and registry-guard rejections *inside* draw loops (`closestBuilding` mid-loop in
the camp village). None of these are visible to a `dumpRegistry` position diff,
two of them make "pure layout function + rng-free mesh half" impossible without
surgery in ~8 model files plus crowd.js that the proposal's file list omits, and
one makes the built world already tier- and load-order-dependent today. The plan
should not proceed to apply until D-C is re-scoped (model param extraction named
as in-scope, crowd draws given an explicit disposition, `env` widened beyond
`waterAt`) and the D-A gate is hardened with a draw-count canary + pinned tier +
a self-diff control run. Everything else (linter, surfaces, markers, gallery) is
sound additive dev surface.

## Findings

### 1. D-C is unimplementable as scoped: positional and model-internal draws are interleaved on one stream — Severity: Critical

**Assumption:** each builder splits into a layout fn owning ALL draws and a mesh
half making zero rng calls (design.md D-C; layout-dry-run spec "mesh consumer is
rng-free").

**Evidence:** the draws alternate position → model → position on the same
cluster rng:
- `buildVendorRowAt` (chunks.js:1237–1268): count draw → `buildTent(ctx.rng)`
  (model-internal draws) per booth → camper roll (1263) → two jitter draws →
  `buildCampTent(ctx.rng)` (1266) → yaw jitter — per booth, per side.
- `buildFoodCourtAt` (chunks.js:1289–1384): ring-angle draws interleaved with
  `buildSugarShack(ctx.rng)` (1304), `buildFoodTruck(ctx.rng)` (1323),
  `buildPicnicTable(ctx.rng)` (1357).
- `buildStage` (chunks.js:2258–2429): scale draw (2264) → `buildStageModel({rng:
  ctx.rng})` (2267) → crowd draws (2333–2351) → clump draws interleaved with
  `buildCampChair(ctx.rng)` per chair (2373–2385) → blankets →
  `buildTorchField(..., ctx.rng)` (2409).

**Break scenario:** you cannot move the model draws to the mesh half (later
chairs' *positions* are drawn after earlier chairs' *model* draws — order
breaks), you cannot call the models from `layouts.js` (three.js import kills
headless node, the linter, and the spec's own scenario), and re-seeding per
record forks the cosmetic stream — every tent color and truck variant in every
existing world changes, invisibly to `dumpRegistry` AND both goldens.

**Hardening:** the only order-preserving factoring is param extraction inside
the models themselves (`pickTentParams(rng)` pure / `buildTentMesh(params)`),
i.e. the refactor extends into `tent.js`, `campTent.js`, `foodTruck.js`,
`sugarShack.js`, `stage.js`, `campChair.js`, `picnicTable.js`, the torch field,
porta potty, bubble vendor, and the drum-circle figures. Name that scope
explicitly in tasks group 3 (one model per commit, same gate) — or downgrade
D-C to "records carry a forked per-record seed" and accept+instrument the
cosmetic break (see finding 4's canary). Task 3.6's grep for `ctx.rng` in mesh
halves will NOT catch any of this — the draws hide behind `rng` parameters and
opts objects.

### 2. `crowd.spawn` draws from the cluster rng with a tier-sized pool and a zero-draw early return — Severity: Critical

**Assumption:** the cluster rng stream is a deterministic function of
`clusterSeed` (chunks.js:1153–1160, R19), so a layout fn can replay it.

**Evidence:** `buildStage` spawns the guaranteed audience from the cluster
stream (chunks.js:2333–2351, `ctx.crowd.spawn({... rng: ctx.rng})`);
`crowd.spawn` returns **before any draw** when the pool is exhausted
(crowd.js:338–340 `if (this.free.length === 0) return null`), otherwise draws
7+ values with a conditional extra (crowd.js:343–374). The pool size is
`PERF.crowdMax` = 180/320/500 by tier (perf.js:59,79,94). Chair-clump and
blanket draws — registry-visible positions — come *after* the crowd block
(chunks.js:2368+).

**Break scenario:** (a) at `?perf=low` the pool can exhaust during initial hub
generation → chair positions at the same seed differ from `?perf=high` —
*today*; (b) the D-A snapshots are tier-dependent and tasks.md never pins a
tier for capture; (c) a layout fn cannot reproduce "pool was full → 0 draws"
from pure inputs, so any unconditional-draw extraction diverges precisely in
the runs the 3-seed gate is least likely to sample; (d) the hub viewer's
synthetic ctx without `crowd` skips the block entirely → hub-sandbox shows
*different chair layouts* than the game at the same seed/hub — the viewer lying
about the exact thing it exists to show.

**Hardening:** pin `?perf=` (and document it) in the D-A protocol; give the
crowd draws an explicit disposition in D-C — the clean one is moving personality
draws into layout records and changing `crowd.spawn` to accept pre-rolled
params (another cross-file surgery to name in scope), which *also* fixes the
pool-full nondeterminism; the hub viewer then replays records instead of
needing a live crowd.

### 3. `env.waterAt` is not enough — `registry.closestBuilding` is consumed inside draw loops and decides existence — Severity: High

**Assumption:** injecting the water predicate makes layout fns pure (design.md
D-C "Water predicate is injected, not imported").

**Evidence:**
- `buildCampVillageAt` (chunks.js:1401–1411): `registry.closestBuilding` at
  1405 sits *inside* the rejection loop — a rejection consumes 2 draws and
  skips the size draw, so the draw *sequence* depends on live registry state
  (cross-chunk: a neighbor chunk's truck registered earlier).
- `buildPottyBankAt` (chunks.js:1226–1228) → `pottyRowClear`
  (chunks.js:1876–1884): registry check at 1881 decides whether the bank exists
  at all.
- `placeWorldgenProps` (chunks.js:1145–1148): the cluster-center guard skips
  whole clusters based on registry state.

**Break scenario:** in-game, the extraction must pass a live-registry-backed
guard or it is not byte-identical; headless, the linter has no registry, so its
dry-run villages/banks differ from the built world exactly at contested spots —
where the layout bugs live — and `potty-attached` audits banks the game never
built (false baseline numbers in `verification/baseline.md`).

**Hardening:** widen the injection to `env = { waterAt, closestBuilding }`
(game passes registry-backed closures; linter passes a records-backed
approximation or `() => null`), and stamp every dry-run record set with which
guards were stubbed so baseline counts are labeled "modulo registry guards."
The registry-audit mode (task 4.6) is the truth-teller here — lean on it.

### 4. The D-A gate is blind to every registry-invisible draw — Severity: High

**Assumption:** empty `dumpRegistry` diff + both goldens ⇒ rng order preserved
(design.md D-A; briefing's own question).

**Evidence:** rng consumers that register nothing: `buildTorchField` at courts
(chunks.js:1372–1384) and stages (2404–2413); drum-circle figures
(forests.js:580 `populateDrumCircle(rng, ...)` — only firepit/bench colliders
register, forests.js:588–601); tree-strung hammocks (chunks.js:1058–1072,
explicitly "no collider/registry entry"). Plus the dump's field list (task 1.1:
kind, x, z, footprint, colliderR, chunkKey) drops collider `damage`, attractor
radius/weight, and every cosmetic.

**Break scenario:** an extraction that drops or reorders the torch-field draws
(they're last in `buildFoodCourtAt`'s stream) or mangles drum figures produces
an empty diff, green goldens, and a visibly different world.

**Hardening:** (a) add a **draw-count canary**: wrap the cluster rng in a
counting closure and emit per-cluster draw counts in the dump — any added/
dropped/conditional-draw change fires even when positions coincide; (b) widen
dump fields to include attractor + damage; (c) keep one hub's Noon/Midnight
screenshot pair per seed as the cosmetic catch (the harness's own
`hub-sandbox` is the right tool once it exists — chicken/egg says screenshot
via `gotoHub` until then).

### 5. Three seeds near spawn may never exercise the conditional branches — Severity: High

**Assumption:** 3 seeds × a fixed chunk set exercises the conditionality D-C
must reproduce (tasks 1.2, 2.3, 3.x gates).

**Evidence:** the branches are all environmental: water-rejection `continue`s
(chunks.js:1245, 1265, 1303, 1322, 1341, 1355, 1404), shack overlap rejection
(1303), potty row clear-fail (1227, 1881–1882), pool-full crowd (finding 2).
If no sampled hub is lakeside and no guard fires at those seeds, a refactor
that deletes a water conditional outright still produces an empty diff.

**Break scenario:** gate passes; every shoreline hub in every player's world
re-rolls after deploy.

**Hardening:** choose the snapshot windows deliberately — at least one
shoreline hub and one dense multi-hub window (find them via map-sandbox, which
already exists); and/or sweep `gotoHub(0..9)` per seed so the snapshot covers
~10 hubs instead of the spawn ring. The finding-4 draw-count canary covers the
residue.

### 6. `Math.random()` already lives inside `buildStage` — don't "fix" it mid-refactor — Severity: Medium

**Assumption:** builders are rng-pure today, so extraction is
draw-for-draw transcription.

**Evidence:** chunks.js:2342–2343 (audience fan jitter `Math.random()`),
chunks.js:2473 (band phase). Harmless today only because nothing registered
consumes them.

**Break scenario:** a well-meaning extractor converts them to `rng()` draws
("layout fns own ALL draws") — injecting two draws per audience NPC into the
cluster stream and shifting every chair/blanket/torch draw after them; or
carries them into layout records, making dry-run output non-reproducible
between runs.

**Hardening:** an explicit note in task 3.4: `Math.random` call sites are
*intentionally outside* the deterministic stream — transcribe them as
`Math.random`, never as `rng()`. List them in the extraction inventory (2.1).

### 7. `buildHubPreview`'s synthetic ctx: six module-level side arrays, a singleton registry, and an empty-registry water predicate — Severity: Medium

**Assumption:** "throwaway registry scope ... stubs only what's absent"
(design.md D-E) is sufficient.

**Evidence:** builders push into module-level arrays swept only by the chunk
unloader's key walk (chunks.js:372–393): `stageMusic` (with live
`Sound.attachStageMusic` handles — these are created even pre-init as deferred
handles, sound.js:645–653), `stageLightLenses`, `stageBeamRefs`,
`forestAnimatables`, plus `forestDrumCircles`/`forestDrumMusic` in forests.js
(574–601). The registry is a singleton Map (registry.js:12) — "scope" can only
mean a key-sweep. And `isPointInLake` iterates `registry.entries`
(lakes.js:864–883): on a fresh hub-sandbox page **no lakes are registered**, so
pre-split builders never reject on water — a shoreline hub renders differently
in the viewer than in the game.

**Break scenario:** slider-drag rebuild accumulates stale handles and lens refs
every drag (memory growth + stale-material access if the ToD updater runs);
shoreline hubs lie until group 3 lands.

**Hardening:** `buildHubPreview` must reuse (export) the existing
chunk-unload sweep keyed on its synthetic key — not reinvent it; sequence
group 6 after group 3 *or* have the preview register the hub's worldgen lakes
into the page registry first; spec the synthetic ctx fields explicitly ({cx,
cz, key, cxWorld, czWorld, rng, group, crowd:…}) including the finding-2 crowd
decision, since `ctx.region` is also assumed by anything reusing the
`_generateWorldgen` path (chunks.js:508–516).

### 8. Snapshot reproducibility is assumed, never proven — Severity: Medium

**Assumption:** boot → `__dbg.start()` → `dumpRegistry()` is stable across two
identical runs (design.md D-A).

**Evidence:** generation is spread over frames; lakes update before chunks each
frame (world.js:80–81) — ordering is safe, but only if LakeManager's load
radius covers the chunk ring + lake maxR (verify, don't assume); the spawn-jug
spiral consults the live registry (chunks.js:535–551); tree counts are
tier-scaled (`PERF.forestTreeDensityMul`, chunks.js:1001, 1047); crowd pool per
finding 2.

**Break scenario:** the very first refactor diff shows phantom churn (or worse,
real churn masked as phantom), and the gate loses credibility on day one.

**Hardening:** task 1.2 gains a control step: capture the same seed/tier
**twice pre-refactor** and require an empty self-diff before any refactor diff
is trusted. Pin tier and a settle condition (e.g. "loaded-chunk count stable
for 60 frames") in the documented protocol.

### 9. `stageScaleOf` mirrors buildStage's FIRST draw — the mirror already has a stale citation — Severity: Low

**Assumption:** plan-side and build-side stage scale stay in sync by comment
discipline.

**Evidence:** festival.js:101–108 derives scale from
`mulberry32(clusterSeed(heart, 0))()` "matching buildStage's FIRST rng draw
exactly ... (chunks.js:2094 — keep in sync)" — buildStage now lives at
chunks.js:2258 and the draw at 2264. The comment's line ref has already
drifted once.

**Break scenario:** festival.js is golden-frozen (POI golden covers it), so
`layoutStage` must keep scale as draw #0 *forever*; an innocent "roll the
banner color first" reorder desyncs every dancefloor rect from its stage.

**Hardening:** encode it, don't comment it — a selftest assertion comparing
`stageScaleOf(heart)` against `layoutStage(...)`'s emitted scale record across
a seed sweep (the linter run is a natural home).

### 10. `hub-sandbox.html` importmap must route `'three'` through `threeShim.js` — Severity: Low

**Assumption:** "carries its own list" (proposal Impact) covers it.

**Evidence:** chunks.js materials rely on the shim's tier-aware
`MeshStandardMaterial` (threeShim.js header; CLAUDE.md tripwire #2);
`sandbox.html` maps `'three'` → the shim for this reason.

**Break scenario:** mapping raw unpkg three works on Chrome high-tier and
silently diverges material behavior from the game — the exact
sandbox-pass/game-fail class this change exists to close, plus it re-opens the
"patch THREE after import" temptation in the new page.

**Hardening:** task 6.2 names the shim mapping explicitly; the no-build.md
third-file note should say "copy sandbox.html's `'three'` mapping, not the CDN
URL."

## What the plan gets right

- **D-A's instrument-first ordering** and "no accept-the-drift option" is the
  correct posture; the gate just needs the canary, the tier pin, and the
  control run to actually mean what it claims.
- **Cluster-local rng (R19)** already contains the blast radius: chunk-level
  consumers (`scatterWorldgenTrees` runs its own stream, chunks.js:1000;
  spawn jugs use no rng, chunks.js:528) are genuinely insulated from the
  builder refactor.
- **Music is hash-keyed, not stream-keyed** (chunks.js:2437–2453,
  forests.js:583 — `worldHash`/`hash2` seeds) — one whole class of "draws
  consumed by systems that don't register" is already safe by construction.
- **Hub viewer through the real `buildWorldgenKind`** (D-E) is the right call
  versus a parallel path — findings 2/7 are ctx-fidelity work, not a reason to
  fork.
- **`showFootprints` disposal story** (plain materials, never shared, never
  registered, explicit dispose) violates neither the `userData.shared`
  convention nor the frozen-namespace rule. No tripwire #2/#6 exposure found
  anywhere in the plan.
- **Browser-mode linter against `dumpRegistry`** (task 4.6) is the strongest
  single idea in the change — it audits built truth and neutralizes most of
  finding 3's dry-run divergence, *if* the baseline is recorded from registry
  mode rather than dry-run mode wherever the two disagree.
