## Auditor's Position

My lens: will this pass a rigorous review, is each change verifiable, does it
honor the project's hard conventions (no-build/importmap, `userData.shared`
dispose-safety, `castShadow` discipline, determinism, InstancedMesh flags,
CHANGELOG/ROADMAP), and is the scope-check complete across every parallel site.

### Priority Sequence

The plan's stated order is sound on the measurement-first principle, but for an
*auditor* the ordering that minimizes review risk and gives the cleanest
verification gates is:

1. **B0 (measurement) — ship first, alone.** It is the verification substrate
   for everything after it. Until `draws`/`tris` read real values, no Tier-2
   item can be honestly gated and no render-touching task (F1/F2/E1) can be
   checked against the per-tier budget panel. Low blast radius, no determinism
   surface, no disposal surface. Land it and confirm the HUD before anything
   else.
2. **D3 (crowd allocation pooling).** Self-contained, no rendering/lifecycle
   surface, mechanically verifiable (behavior-unchanged + no console errors).
   BUT it carries a non-obvious correctness trap — see Deficiencies. Cheap to
   ship, cheap to get subtly wrong; do it early and review it hard.
3. **F2 (amortized shadow map).** Runtime-only, one owner (`world.js:349` sun),
   the design correctly identifies the empty-map trap. Gate on a full day/night
   visual check at `?perf=mid` and `?perf=high`.
4. **F1 (dynamic bloom gate).** Convention-sensitive: it introduces a *third*
   writer to `bloomPass.enabled` (boot `main.js:147`, AQ `adaptiveQuality.js:171`).
   The single-resolved-predicate refactor MUST land in the same change or this is
   a latent write-fight. Ship only after the AQ flag-setter refactor.
5. **A1 + A4 (prewarm + sliced reveal).** Highest-value but boot-order- and
   threeShim-sensitive. Land A4 (the correctness guarantee) before/with A1 (the
   best-effort optimization). This is the riskiest non-determinism item.
6. **C1 (time-slice generation).** The single highest-risk item (determinism +
   lifecycle/disposal). Gate it behind the byte-identical registry-dump proof
   (task 6.5) — that gate is non-negotiable. See C1-a/C1-b below.
7. **E1 (arrival curtain).** Cosmetic/UX, depends on A4's reveal pump existing.
   Last of the "ship" items.
8. **Tier-2 — strictly B0-gated.** Park to ROADMAP anything the numbers don't
   justify. Do not ship the geometry merge speculatively.

### Quality Deficiencies Found

- **D3 closure has a two-channel semantic that a naive hoist will break** —
  `src/crowd.js:605`, `:779`, `:788` — **Severity: High.** The per-NPC literal
  `{ count: activePassengers, add: () => activePassengers++ }` is NOT a simple
  scratch object. `count` captures the frame-start snapshot **by value** (it
  never reflects in-loop `.add()` increments — `count` stays constant for the
  whole frame), while `add()` mutates the outer `activePassengers` (`crowd.js:589`).
  The boarding gate at `:779` reads `.count < MAX_PASSENGERS` against the *stale
  snapshot*, and `.add()` at `:788` increments the *live* counter. A hoist to one
  reusable object that does `scratch.count = activePassengers` once and then has
  `add` do `scratch.count++` would change the gate's behavior (it would start
  seeing live increments mid-frame, throttling boarding differently). The plan
  (task 2.1, design "hoist the closure") does not call out this dual semantic.
  The fix must preserve it: e.g. a module-scope scratch with a frozen-per-frame
  `count` field set once and an `add` that increments a *separate* live counter,
  not `count`. Task 2.3's check ("passenger pickup still works") is too coarse to
  catch a throttle-rate change — needs an explicit assertion that `.count`
  remains the frame-start snapshot.
- **No `castShadow = false` is asserted for A1's prewarm meshes** — design A1,
  task 5.2 — **Severity: Low.** The offscreen warm scene builds "one mesh per
  heavy material variant." For the warmed program to match the real draw it must
  carry the same shadow/fog/tier defines (design says so), which means the warm
  meshes may need `castShadow`/`receiveShadow` set to match. That's a *correctness*
  requirement for the warm, not a budget violation (offscreen, disposed after
  compile), but the tasks don't state the warm scene is torn down. Add: dispose
  the warm scene's geometry/materials after `compileAsync` resolves — and since
  those are built "through the real factories," some may be **module-scope
  `userData.shared` pooled materials** (`SHACK_MATS` etc.). Disposing the warm
  scene must run the same `userData.shared` skip or A1 will dispose a shared
  material and storm recompiles — the exact footgun #6. This is unaddressed.
- **C1 lifecycle: deferred-queue cancel path must use the existing
  `disposeChunkByKey` discipline** — design C1, Risks "Lifecycle" — **Severity:
  Medium.** `_unload` (`chunks.js:367`) already routes through a by-key disposal
  helper that skips `userData.shared`. The plan says "cancel on unload; `_unload`
  already drops everything tagged with the key." Correct for *built* entries —
  but a chunk whose structure is in the scene while its **scatter is still
  queued** has two states to unwind: the queued closure (drop it) AND any
  partially-added meshes (must go through the same shared-skip disposal). Task 6.4
  says "no orphaned nodes" but doesn't name the disposal path. Make it explicit:
  cancelled deferred work disposes through the same by-key helper, never a raw
  `traverse(dispose)`.
- **B0 InfoCapture pass `swapBuffers` contract** — design B0, task 1.1 —
  **Severity: Low.** A custom `Pass` inserted at composer index 1 that "passes
  the buffer through without drawing" must set `needsSwap = false` (or correctly
  forward read→write) or it silently corrupts the post-processing chain
  (bloom/trip would sample the wrong target). Mechanically verifiable: if the
  scene renders correctly with bloom on after B0, it's wired right. Call it out
  in 1.1 so the reviewer checks `needsSwap`.

### Mechanical Assertions

| Check                          | Status        | Notes |
| ------------------------------ | ------------- | ----- |
| Importmap in BOTH html files   | PASS (N/A)    | Plan adds NO new `src/` modules (proposal Impact, design Non-Goals). Task 9.3 runs `bin/check-importmaps` as a guard if that changes. Correct — the four-file importmap rule (`no-build.md`) is honored by being a no-op. If any Tier-2 item spins out a module, this flips to a required action. |
| Sandbox entry complete         | PASS (N/A)    | No new `src/models/` file → no dropdown/`loadEntity`/hit-kind/music-style obligation. Verification is in the running game (B0 HUD, day/night cycle), which is correct for these emergent/pipeline changes — sandbox can't exercise chunk-gen, shadow cadence, or bloom gating anyway. |
| userData.shared tagging        | PASS w/ gaps  | C1 half-built chunks: design routes cancel through `_unload`/by-key disposal (skips shared) — correct in principle, but the *partial-add* path must be named (Deficiency above). A1 warm-scene teardown must honor the shared-skip (Deficiency above). Tier-2 merge "reuses the vendor-booth `userData.shared` disposal pattern" (task 8.2) — correct precedent. |
| castShadow discipline          | PASS          | No item adds shadow casters. F2 changes *cadence*, not casters. Tier-2 atmosphere fakes explicitly "add zero shadow-casting lights" (perceptual-lod spec). Plan respects the 56-caster audit (`performance.md`). A1 warm meshes match shadow defines for warm-correctness only (offscreen, disposed). |
| InstancedMesh needsUpdate      | PASS          | D3 touches only the `ctx` allocation; the seven `instanceMatrix.needsUpdate = true` flips (`crowd.js:609-615`) are below the hoist and untouched. Tier-2 crowd LOD must keep these flips on any frame it writes matrices — flag for 8.3. |
| Determinism (fresh salt)       | PASS w/ gate  | C1 is explicitly output-preserving (same `rng()` draw order, only timing changes). Task 6.5 proves it via byte-identical `__dbg.dumpRegistry`. This gate is the load-bearing control — do not merge C1 without it green. D3's `Math.random()` at `crowd.js:781` is crowd-AI (non-seeded, not worldgen determinism) and is not touched. No item re-salts or reorders an existing seeded `rng()`. |
| CHANGELOG/ROADMAP in commit    | PASS          | Task 9.1 (CHANGELOG Performance section, numbers + why, same commit) and 9.2 (ROADMAP: add the parked build-step/worker/compression cluster, trim shipped bullets) are both present and correctly scoped per `changelog-and-roadmap.md`. One refinement: 9.1 should be split so each *shipped* item lands its CHANGELOG bullet in *its own* commit, not batched at the end — the rule is "the diff and the entry travel together," and this plan is multi-commit. |

### Scope Completeness

The proposal's Scope Check (lines 94-110) is unusually thorough and I largely
concur — it correctly enumerates the parallel sites for shadow cadence (single
owner), bloom-enable (three writers, the real risk), per-frame allocation, and
the two `debug.js` info consumers. Gaps I'd add:

- **B0 has more than two readers of `renderer.info.render` to audit.** The
  proposal names HUD ~1029 and perf sample ~1609. Confirm there is no third
  consumer (e.g. an adaptive-quality heuristic or a `__dbg` dump) that reads
  `renderer.info.render.calls` and would now disagree with the HUD. A quick
  `rg 'info.render' src/` before 1.2 closes this.
- **F1's "bright in frame" reuses the registry attractor query** — verify that
  query is already O(cheap) per frame (the broadphase grind was just fixed). A
  new per-frame full attractor scan would regress the steady-state CPU win that
  this very change set is built on top of.
- **CHANGELOG batching** (above) is a scope-of-commit completeness gap, not a
  code one.

### Position: C1-a (full coroutine) vs C1-b (phased deferral)

**I support C1-b (phased deferral), strongly, on auditability grounds.**

- **Determinism is provable, not just claimed.** C1-b runs *the same calls in
  the same order, later*. The byte-identical registry-dump gate (task 6.5) is a
  clean, mechanical pass/fail. C1-a converts every inline `registry.add` into a
  resumable `yield` boundary — the determinism surface becomes "did the
  generator resume preserve every closure-captured rng cursor and loop index
  across frames," which is far harder to prove byte-identical and far easier to
  regress in a later edit. Lower blast radius = a reviewer can actually verify it.
- **Lifecycle is cleaner.** C1-b's "structure synchronous, scatter deferred"
  gives a chunk that is *collision-coherent immediately* — the registry footprint
  exists before the player can reach it (frame-budget spec: "registers no
  collidable footprint until complete" is satisfied at the structure boundary,
  and scatter is non-collidable ambient). C1-a can leave a chunk in an
  arbitrary mid-yield state where some colliders are registered and some aren't —
  a partially-collidable chunk is a gameplay correctness hazard.
- **Cancel is simpler.** One queued closure keyed by `chunkKey` is trivially
  droppable; a suspended generator mid-iteration needs explicit teardown of
  whatever it half-allocated.

The cost — C1-b smooths less than a full coroutine — is acceptable because the
*structure* build is the cheap part; the *scatter* (trees/props/campsites/crowd)
is the 30-60ms tail, and that's exactly what C1-b defers. The plan's own
recommendation is C1-b; I confirm it.

### Verdict

-   **Verdict**: **Proceed with mitigations**
-   **Key Concern**: The D3 crowd-pooling hoist (`crowd.js:605`) silently breaks
    a two-channel snapshot/live-counter semantic if done naively — `count` is a
    frame-start snapshot, `add()` mutates a separate live counter, and a single
    reusable scratch must preserve that split or the boarding throttle changes
    behavior. The plan treats it as a trivial hoist.
-   **Recommendation**: The architecture and conventions are honored and the
    determinism gate (6.5) + single-bloom-predicate refactor (4.1) are the right
    controls. Proceed, with these mitigations folded into tasks: (1) D3 preserve
    the snapshot-vs-live split, with an assertion in 2.3 that `.count` stays the
    frame-start value; (2) A1 warm-scene teardown must honor `userData.shared`
    skip; (3) C1 partial-add cancel must dispose through the existing by-key
    helper, not a raw traverse; (4) B0 InfoCapture pass sets `needsSwap` correctly
    and 1.2 audits for a third `info.render` reader; (5) CHANGELOG bullets land
    per-commit, not batched. C1 is the only item that can corrupt existing saves —
    keep it last and gate it hard.

---

## Round 2 — Reactions

I read all four other Round-1 positions and verified the two load-bearing code
claims (F2 sun-follow at `world.js:138-140`; the D3 closure semantics at
`crowd.js:589/779/788`) directly against the source before reacting.

### On the Adversary's F2 BLOCK and the Pragmatist's "Slice 1 = B0+D3+F2"

**I concede the Adversary is right, and this moves me.** The Adversary's
vulnerability "[F2 — player-anchored shadow frustum, not a slow-crawling sun]"
is correct, and I checked it: `world.js:138-140` runs `sun.position.x +=
playerPos.x` / `sun.position.z += playerPos.z` / `sun.target.position.set(player…)`
**every frame**, with the comment at `world.js:130-134` explicitly stating the
frustum is pinned to the cart "so shadows continue to render no matter how far
Zerble drives." The frustum half-width is 60m mid / 100m high (`world.js:363`,
`shadowD`). At boost (~28 m/s) the cart clears that in ~2–3.5s. So
`autoUpdate = false` does NOT merely *stale* the map — the receiving materials
keep sampling it through the light's **moved** view-projection matrix, so the
cached depth map is registered to an old player location and shadows
**smear/offset off their casters under motion**. The Profiler independently
flagged the same thing (their risk table, "F2 stale map smears as sun crawls /
NPCs move under it," Medium) and reached the same mitigation: tie `needsUpdate`
to camera/sun movement, not a bare frame counter.

This is a real gap in my Round-1 position. I rated F2 a clean "PASS" on
castShadow discipline and listed it as #3 in my sequence "gate on a full
day/night visual check at `?perf=mid`/`?perf=high`" — but a **stationary**
day/night screenshot is exactly the check that cannot catch a motion-only smear
(the Adversary names this: "invisible while parked… only shows under motion").
My proposed verification gate was insufficient for the actual failure mode.

**Consequence for Slice 1.** The Pragmatist's "Slice 1 = B0+D3+F2" should be
**re-cut to B0+D3 only.** F2 as designed is not mechanically verifiable on the
available surface (Codespaces has no WebGL; the agent can only screenshot, and
the bug is motion-only on a real GPU). Per the Auditor's "verifiable or it
doesn't ship" lens, an item whose only failure mode is invisible to every
verification gate the agent owns cannot ride in the same "cheap, self-verifiable,
ship-now" slice as B0 and D3. F2 must move to its own gate, behind either
(a) a movement-threshold `needsUpdate` force, or (b) amortize-only-while-roughly-
stationary — AND an explicit AQ-coordination contract (Architect's F2 risk +
Adversary's second F2 vuln: AQ's `_setShadowsOn` one-shot `needsUpdate` at
`adaptiveQuality.js:233` now races F2's periodic `needsUpdate`, the same
multi-writer trap the plan only mitigated for bloom). The acceptance test is
the Adversary's "boot the game and drive a boost run across ≥2 hubs while
watching shadows," not a screenshot — I adopt that as the F2 gate.

So: **revised Slice 1 = B0 + D3.** F2 becomes its own slice, gated on the
frustum-follow fix + AQ single-owner contract + a Gary-side motion capture. This
keeps Slice 1 genuinely agent-self-verifiable, which was the whole point of
front-loading it. I do not go as far as the Adversary's hard "Block" on F2
itself — the fix is bounded and known (force `needsUpdate` on movement) — but I
fully agree it must NOT ride Slice 1, and I downgrade my Round-1 "ship at #3
behind a stationary visual check" to "ship behind a motion test in its own
slice."

### On the Pragmatist's per-commit CHANGELOG split vs. one coherent story

**This confirms and sharpens my own Round-1 deficiency (Mechanical Assertions,
CHANGELOG/ROADMAP row) — no conflict; it's the correct read of the rule given
multi-slice reality.** The `changelog-and-roadmap.md` rule is explicit: "Don't
batch changelog updates across multiple commits; the diff and the entry should
travel together… One commit, one coherent story." The "one coherent story" in
that rule is scoped to **one commit**, not to the whole multi-slice change. This
plan is, by everyone's read (Pragmatist's three slices, Architect's blast-radius
sequence, my own 8-step order), at minimum three independently-shippable commits
— Slice 1 (B0+D3) ships *days to weeks* before Slice 3 (C1-b) clears its
determinism gate. Batching all CHANGELOG bullets into a single tail commit would
mean the B0+D3 diff lands with **no** CHANGELOG entry travelling with it, which
is the exact rule violation.

So the Pragmatist *improves* the landing, it doesn't conflict with it: each
slice's commit carries its own CHANGELOG bullet (and its own ROADMAP trim, if
any), under today's date, appended to the existing day's section per the rule's
date-handling guidance. The "coherent story" is preserved **per commit**; the
CHANGELOG's same-day grouping naturally re-assembles the slices into one dated
block for the human reader. Task 9.1 as written ("CHANGELOG Performance section…
same commit") batched at the end is the one thing I'd rewrite: **split 9.1 so
each slice's CHANGELOG bullet is part of that slice's commit, not a final
sweep.** I flagged this in Round 1 as a refinement; the Pragmatist's framing
makes it a required correction, and I adopt it.

### Confirming/refining my two dispose-safety gaps

**A1 prewarm teardown honoring `userData.shared` — CONFIRMED, and reinforced by
the Architect.** My Round-1 deficiency stands: A1's design builds warm meshes
"through the real factories," and those factories hand back module-scope
`userData.shared` pooled materials (`SHACK_MATS`, the campsite `matFor` cache,
the puppet/foodTruck caches per `perf-pooling.md`). Disposing the warm scene
after `compileAsync` resolves MUST run the same `userData.shared` skip or A1
disposes a shared material and storms recompiles — footgun #6. The Architect's
A1 risk independently lands on the *same* "build warm meshes through the real
factories" requirement (their threeShim/boot-order risk), which is what *creates*
my disposal exposure: the more faithfully A1 sources from real factories (to get
the right program key), the more certain it is to capture shared pooled
resources, so the teardown-must-skip-shared rule is not optional. No one
contradicted this; it's strengthened. The Adversary's "[A1 — threeShim
program-key mismatch]" and the Profiler's matching risk-table row both confirm
the factory-sourcing requirement that drives the disposal gap. **Refinement:**
the safest implementation is for A1's warm scene to dispose **nothing** —
build warm meshes whose geometry/material references are the pooled shared
ones (already permanent, never disposed) and only drop the throwaway `Mesh`/
`Scene` wrappers (which own no GPU resources). That sidesteps the shared-skip
walk entirely. If A1 instead mints fresh non-pooled materials to force a compile,
those are non-shared and safe to dispose — but then verify their program key
matches the real draw (the Adversary/Profiler concern). Either path works; the
unsafe middle is "dispose the warm scene with a raw `traverse(dispose)`."

**C1 cancel path using the by-key disposal helper — CONFIRMED, and the
Architect + Adversary both extend it past where I drew the line.** My Round-1
deficiency (cancelled deferred work must dispose through the existing by-key
helper, never a raw `traverse(dispose)`) holds. The Architect names the same
helper (`disposeChunkByKey`, `chunks.js:367-373`) and adds the structural home
for it: the deferred queue should be **one more by-key side-list** that `_unload`
sweeps — which is exactly the right place to hang the cancel, and I adopt it as
the concrete shape of my mitigation. The Adversary sharpens the *ordering*
constraint I under-specified: `spawnAmbientCrowd` injects into the **live**
crowd system, not just the chunk group, so "crowd spawn must be the LAST deferred
stage (or the deferred batch atomic per chunk)" and the queue entry must be
cleared in `_unload` to prevent **double-generate on re-entry**. That re-entry
double-generate is a real gap my Round-1 note missed — a chunk that unloaded with
an uncancelled queue entry, then re-enters the ring, could run both the stale
closure and a fresh `_generate`. I concede that and fold it in: **the cancel
mitigation is (1) dispose any partial-add through `disposeChunkByKey`, (2) clear
the by-key queue entry in `_unload`, (3) order crowd spawn last so a mid-batch
cancel never orphans live NPCs.** The Architect's separate point that the
determinism gate must test **concurrent multi-chunk deferral** (not single-chunk
isolation, because `spawnAmbientCrowd` reads global `registry.byChunk` state) is
a strengthening of my task-6.5 gate that I accept — though I note the Adversary's
counter that each chunk owns its own per-chunk-seeded `ctx.rng` stream, so
cross-chunk rng *contamination* is not the risk; the risk is registry-query
*timing*, which the multi-chunk gate correctly targets. Both can be true: rng is
per-chunk-isolated, registry reads are global, so the gate needs the multi-chunk
scenario for the *registry-read* coupling even though the rng is safe.

### D3 — one refinement to my own Round-1 claim

The Adversary and Pragmatist both landed on the same D3 semantic I raised
(closure carries behavior, not just a value). Re-reading `crowd.js:779/788`
against my Round-1 text: I want to **correct one detail** in my own analysis so
the mitigation is precise. `count` is snapshotted once per NPC-call from the
outer `activePassengers` (`crowd.js:605`), and `add()` increments the *outer*
`activePassengers` — NOT `count`. So within a single frame, because every NPC's
`ctx` is built in the same loop pass at `:605` reading the *current* value of
`activePassengers`, a sibling NPC boarding *earlier in the same frame's loop*
**does** raise the snapshot seen by a later NPC (the literal is re-constructed
per NPC at `:605`, after the prior NPC's `add()` already ran). My Round-1 text
said `count` "stays constant for the whole frame" — that is wrong; it's
re-snapshotted per NPC and *does* see prior same-frame boardings. The
load-bearing requirement for the pooled hoist is therefore: **a single reusable
scratch must set `count` to the live `activePassengers` value at the top of each
`_updateNpc` call (re-snapshot per NPC), and `add` must continue to increment
the live `activePassengers` accumulator** — i.e. `scratch.count = activePassengers`
per NPC + `add` does `activePassengers++` (mutating the outer, via a shared
counter object since a module-scope `add` can't close over a loop-local). The bug
to avoid is a hoist that snapshots `count` once per *frame* (freezing it) — that
would *loosen* the MAX_PASSENGERS gate and over-board. This is a sharper, correct
version of the mitigation; the Pragmatist's "pass `count` by a shared counter
object" (design.md:98-99) is the right primitive, and my 2.3 assertion should be
"after N sibling boardings in one frame, a later NPC's `.count` reflects them" —
not "stays the frame-start value" as I wrote in Round 1.

### Verdict

- **Verdict (revised): Proceed with mitigations — with Slice 1 re-cut to
  B0 + D3 (F2 pulled out).** Moved from Round 1 by the Adversary's verified
  F2 player-anchored-frustum finding and the Profiler's matching motion-smear
  flag.
- **What moved me:**
  1. **F2 is not Slice-1 material.** Verified `world.js:138-140` — the frustum
     follows the player every frame, so `autoUpdate=false` smears shadows under
     motion, and that failure is invisible to every gate the agent owns. F2
     leaves Slice 1, gets its own slice behind a movement-`needsUpdate` fix + an
     AQ single-owner shadow-cadence contract + a Gary-side boost-run motion
     capture. **Revised Slice 1 = B0 + D3 only** (both genuinely self-verifiable
     for correctness without a real GPU).
  2. **Per-slice CHANGELOG is required, not optional.** The Pragmatist's split
     is the correct reading of `changelog-and-roadmap.md` ("the entry travels
     with the diff") under this change's multi-commit reality — it improves the
     landing rather than fracturing the story, since same-day grouping
     re-assembles the bullets for the reader. Rewrite task 9.1 to land each
     slice's bullet in that slice's commit.
- **Mitigations carried forward (unchanged, two now sharpened):** (1) D3 — pooled
  scratch must **re-snapshot `count` per NPC** (corrected from my Round-1
  "frozen per frame") and keep `add` mutating the live accumulator via a shared
  counter object; 2.3 asserts a later NPC sees prior same-frame boardings.
  (2) A1 — warm-scene teardown must honor `userData.shared` (safest: dispose
  nothing GPU-owning; reference the pooled shared materials and drop only the
  wrapper meshes). (3) C1 — cancel disposes partial-adds through
  `disposeChunkByKey`, clears the by-key queue entry in `_unload` (prevents
  re-entry double-generate), and orders crowd spawn last in the deferred batch.
  (4) B0 — capture pass sets `needsSwap` correctly and `rg 'info.render' src/`
  audits for a third consumer. (5) C1 determinism gate (6.5) tests **concurrent
  multi-chunk deferral**, not single-chunk isolation (registry reads are global
  even though per-chunk rng is isolated). C1 stays last and hard-gated — still
  the only item that can corrupt existing saves.
