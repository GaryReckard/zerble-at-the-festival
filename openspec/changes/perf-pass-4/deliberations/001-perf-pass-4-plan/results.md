# Deliberation Summary

## Context

-   **Task**: Stress-test the `perf-pass-4` implementation plan before coding —
    a no-build, main-thread attack on (A) 137–343ms shader-compile stalls on hub
    entry, (B) 30–60ms synchronous `_generate` chunk hitches, and a measurement
    gap (C) `renderer.info` reads `draws=1` under the EffectComposer chain. Plan
    items: B0 (true draw/tri capture), C1-a/C1-b (chunk-gen slicing), A1+A4
    (shader prewarm + sliced reveal), F1 (dynamic bloom gate), F2 (amortized
    shadow map), D3 (crowd-allocation pooling), E1 (arrival bloom curtain),
    Tier-2 (perceptual-lod menu).
-   **Personas Consulted**: Architect, Adversary, Auditor, Pragmatist, Profiler
    + Mediator. Mode: **debate** (both rounds complete; no persona failed).
-   **Date**: 2026-06-19

## Synthesized Plan

The plan ships as **slices**, ordered by blast radius and by what the agent can
self-verify without a real GPU. **Codespaces has no WebGL — live perf, visual,
iOS, and boost-driving verification is Gary's job on his real-GPU machine.** The
agent can prove *correctness* (boot-clean, determinism diff, no console errors,
HUD reads plausible numbers); it cannot prove *the number moved* or *the shadow
tracks under motion*. Sequencing front-loads the self-verifiable wins and batches
the Gary round-trips.

### Change Group 1 — Slice 1: Measure + the one safe GC win
**Scope**: B0 + D3 only. Both boot the game clean and are fully agent-self-
verifiable for correctness without a real GPU. **F2 is explicitly NOT in this
slice** (it was in the Pragmatist's Round-1 cut; all five re-cut it out — see
Conflicts Resolved). B0 lights up the HUD so Gary's first capture produces the
numbers that gate everything downstream.
**Estimated Effort**: Small (~1 day).
**Tasks** (refines tasks.md §1–2):
1.  **B0** — `InfoCapturePass` at composer **index 1** (immediately after
    `RenderPass`, before bloom/trip/fxaa/output overwrite the counter). It must
    issue **no draw of its own** (pure read + read-buffer passthrough — a +1 here
    corrupts the very number it reports) and set `needsSwap` correctly (Auditor)
    or the post chain samples the wrong target. Snapshot
    `info.render.calls/triangles` into module-scoped `lastSceneInfo`. Relies on
    `info.autoReset = true` (default) — assert/comment that ownership; if anything
    flips it to `false`, the index-1 read becomes a cumulative over-count again
    (Adversary, Profiler).
2.  **B0 readers** — point **both** `debug.js` consumers (HUD ~1029, perf sample
    ~1609) at `lastSceneInfo`. Run `rg 'info.render' src/` first to confirm there
    is no **third** consumer (Auditor) — a partial migration leaves the HUD lying
    while the log is honest. Add the per-frame `progDelta` (`info.programs.length`
    diff) so shader-stall frames self-label.
3.  **D3** — hoist the per-NPC `activePassengersRef` closure (`crowd.js:605`),
    **preserving the two-channel semantic** (binding mitigation below). Sweep the
    immediate crowd loop for sibling `new Vector3/Color`/array-literal churn.
4.  **Verify (agent)**: boot game, HUD `draws` reads tens-to-hundreds not `1`;
    `progDelta` present; crowd pickup unchanged; clean `preview_console_logs`;
    the D3 `.count` re-snapshot assertion (below). **Per-slice CHANGELOG entry in
    this commit.**

### Change Group 2 — Slice 2: Kill the shader wall + (scope-capped) F2
**Scope**: F1 flag-setter refactor (4.1 only), then A4 → A1, then F2 (scope-
capped), then F1 gating (4.2) gated on B0 numbers. This is the boot-order- and
threeShim-sensitive slice.
**Estimated Effort**: Medium–Large.
**Tasks** (refines tasks.md §4–5, §3):
1.  **F1 refactor first (task 4.1)** — make AdaptiveQuality a **flag-setter**
    (`bloomAllowed`) instead of writing `bloomPass.enabled` directly. Land this
    and verify bloom parity at all tiers (pure-correctness, agent-self-verifiable,
    no GPU number needed) **before** any new gating behavior. Refactor first,
    feature second — sequence is load-bearing (Architect, Auditor, Profiler).
2.  **A4 (task 5.1) — the correctness floor, lands first and stands alone.**
    Track seen material UUIDs; queue meshes with unseen materials `visible=false`;
    reveal **≤1 program-link/frame**. A4 must catch everything even if A1 covers
    nothing. Verify independently on `?perf=low` (Lambert path is a different
    program set).
3.  **A1 (task 5.2) — best-effort prewarm, layered on A4.** Three binding rules:
    (a) **`compileAsync` kicked AFTER `Sound.init()`**, fire-and-forget, never
    `await`ed in the gesture and never hoisting work ahead of `Sound.init()` —
    iOS goes silent otherwise and the agent **cannot** catch it (no iOS Safari on
    the verification surface). (b) Warm meshes built through the **real threeShim-
    backed factories** so program keys match the real draw (a raw
    `MeshStandardMaterial` warms a program the world never draws; on low it warms
    the wrong path). No `THREE.X = Y`. (c) **A1 must never dispose** — prefer
    `renderer.compileAsync(scene, camera)`, referencing the pooled
    `userData.shared` materials and dropping only throwaway wrapper meshes (which
    own no GPU resources). A naive `traverse(dispose)` on the warm scene disposes
    a shared material and storms recompiles (Auditor, Profiler).
4.  **F2 (task 3) — scope-capped, single-owner, B0-gated, or cut.** See the F2
    resolution below. Ships **only** with the movement-gated `needsUpdate`
    co-located in `world.js`, the single-owner shadow-cadence contract over
    AdaptiveQuality, `autoUpdate=false` flipped only after the first good map, and
    a written scope cap (mid/high, near-stationary only). Acceptance is a Gary
    boost-run, not a stationary screenshot.
5.  **F1 gating (task 4.2)** — add `bloomPass.enabled = PERF.bloom &&
    aq.bloomAllowed && brightInFrame()` as the **only** writer, with hysteresis.
    Confirm `brightInFrame()` reuses the already-cheap attractor query (don't
    reintroduce a per-frame full scan — the broadphase grind was just fixed).
    **Gate the decision to ship 4.2 behind B0 proving bloom's per-frame cost is
    material** (Pragmatist, Profiler) — but land 4.1 regardless.
6.  **Shared per-frame governor** — A4's reveal pump, C1-b's deferred-scatter
    queue, and E1's elevated pump rate are the **same budgeted resource** (GL
    program-links + ms). They must compose under **one** governor or a dense hub
    defers 40 props *and* tries to link them in the same frames — relocating the
    stall, not removing it (Profiler). Crowd-spawn ordered **last** (below).
7.  **Per-slice CHANGELOG.** Gary capture (Round-trip 2): boost across ≥2 hubs —
    ≤1 program/frame at hub entry, the 137–343ms wall gone, F2 shadow tracks under
    the cart, no AQ-shadow-transition flicker. **E1 go/no-go is decided here.**

### Change Group 3 — Slice 3: Flatten the chunk hitch (C1-b, hard-gated)
**Scope**: C1-b (phased deferral) **alone**, isolated so a determinism regression
cannot taint the safe wins already shipped. **C1-b over C1-a is unanimous across
all five personas.**
**Estimated Effort**: Medium (the code is already phased at function granularity,
`chunks.js:477-501` — "the difference between a week and a day").
**Tasks** (refines tasks.md §6):
1.  **Switch budget** from `BUDGET_PER_FRAME` chunks to a tier-aware
    `CHUNK_BUDGET_MS` wall; keep `firstLoad` eager.
2.  **Phase boundary = collider-registering work is synchronous; deferred work is
    collider-free** (binding correction below). Audit every `buildWorldgenKind`
    case (`chunks.js:1304-1322`) — stages, vendor rows, camp villages register
    colliders and must pin to the synchronous phase. Defer only non-collidable
    decor + crowd.
3.  **Carry the live `ctx.rng` instance** into the deferred closure (resume the
    stream; never re-create it) so the same calls run in the same order, later.
    rng is per-chunk-isolated (no cross-chunk contamination), so the risk is
    purely intra-chunk ordering + registry-read timing.
4.  **Crowd spawn ordered LAST** in the deferred batch (or the batch is atomic per
    chunk) — `spawnAmbientCrowd` injects into the **live** `this.crowd` system,
    not just the chunk group (`chunks.js:456/492`).
5.  **Lifecycle**: key deferred work by `chunkKey`; on `_unload`, **clear the
    by-key queue entry** (prevents double-generate on re-entry) and dispose any
    partial-add through the existing **`disposeChunkByKey`** by-key helper (which
    skips `userData.shared`), never a raw `traverse(dispose)`. The deferred queue
    is "one more by-key side-list" `_unload` already sweeps.
6.  **Determinism gate (task 6.5) — hard merge-blocker, agent-closable before
    Gary.** Byte-identical `__dbg.dumpRegistry` diff old-path vs new-path,
    **across a multi-chunk concurrent-deferral neighborhood**, not one isolated
    chunk (registry reads are global even though rng is per-chunk). Not byte-
    identical → does not merge.
7.  **Per-slice CHANGELOG.** Gary capture (Round-trip 3, cheapest — hard gate
    already green locally): `cgWorst`/`fMax` hitches flatten, no collider appears
    before its chunk is coherent.

### Change Group 4 — Deferred / Park (evidence-gated)
**Scope**: E1, F1's ship-decision, all of Tier-2. Do not build speculatively.
**Tasks**:
1.  **E1** — park until A1/A4 land and Gary confirms a **residual stall survives**
    worth masking. It's a cosmetic mask, not a fix; its requirements (which
    residual, how big) are defined by A1/A4's measured outcome. Its bloom swell
    must route through F1's predicate so it doesn't blow the bloom budget. Doubly
    Gary-gated (also a taste call on charm/tone).
2.  **Tier-2 default = PARK.** Of the menu, only two are candidates, **gated
    behind B0's numbers**: **static-decor geometry merge** (likely the real *draw*
    win — vendor-booth precedent showed −36% meshes; MUST reuse the vendor-booth
    `userData.shared` disposal pattern or it storms recompiles — High severity)
    and **fog-as-far-cull** (cheap; verify it doesn't fight `chunkUnloadRadius`
    and doesn't clip the skybox/distant hub silhouettes visible through thin fog
    — `camera.far` is 1500, fog far 520). **Crowd LOD** moves a CPU number, not a
    HUD draw number, against an **unproven** cost (broadphase is already ~0.3ms) —
    gate hardest; likely its own future change. **Atmosphere fakes** (light
    shafts, lake glints) *add* draws — they are mood, not perf; only adaptive
    sparkle sheds count. Do not book the fakes as perf wins.
3.  **Docs (tasks.md §9)**: ROADMAP gets the full parked cluster (build-step /
    worker / compression) plus trimmed shipped bullets; `bin/check-importmaps`
    run if any module slipped in; `bin/readme-sync perf-pass-4`.

## Final Recommendation

**Proceed with mitigations** — unanimous. Ship Slice 1 (B0 + D3) now as the
force-multiplier that unblocks measurement; it's fully agent-self-verifiable.
Land Slice 2's F1-refactor → A4 → A1 with the iOS/threeShim/never-dispose rules
bound into the tasks, and F2 only as the scope-capped, movement-gated,
single-owner item (or cut it if B0 shows the mid/high depth pass isn't material).
Ship Slice 3 (C1-b) alone behind the multi-chunk byte-identical determinism gate.
Park E1, F1's ship-decision, and all of Tier-2 behind B0 + a Gary capture.

---

## Convergence Points

-   **Proceed with mitigations** — all five personas, both rounds. No Blocks
    survive Round 2 (Adversary's F2 BLOCK softened to scope-capped Proceed).
-   **B0 ships first, alone, full stop.** Zero blast radius; it's the verification
    substrate — until `draws`/`tris` read real values, no F1/F2/E1 budget check
    and no Tier-2 gate is honest.
-   **C1-b over C1-a — unanimous.** The perf delta between them is small; the
    differentiator is blast radius. C1-a turns every inline `registry.add` into a
    resumable yield point (determinism-hostile, hard to prove byte-identical, can
    leave a partially-collidable chunk). `_generateWorldgen` is already phased at
    function granularity, so C1-b's seams already exist.
-   **The determinism registry-dump diff (task 6.5) is a hard merge-blocker**, not
    a post-hoc check — four personas name it explicitly; C1 is the only item that
    can silently corrupt every mid-game player's world.
-   **F2 must NOT ride Slice 1** and must NOT ship on a bare frame-counter cadence
    — re-cut by all five after the Adversary's `world.js:139-141` finding.
-   **D3 is not a trivial hoist** — it carries a two-channel snapshot/live-counter
    semantic (Auditor, Adversary, Pragmatist, Profiler all land on it).
-   **F1's single resolved predicate** (`PERF.bloom && aq.bloomAllowed &&
    brightInFrame()` as the only writer) and **refactor-before-feature** ordering.
-   **No new modules → no importmap churn** (confirmed; guard with
    `bin/check-importmaps` only if a Tier-2 helper spins out).
-   **Per-slice CHANGELOG** — each slice's bullet travels with its own commit.
-   **Live verification is Gary's job** (Codespaces has no WebGL); batch the
    round-trips.

## Conflicts Resolved

| Conflict | Position A | Position B | Resolution | Rationale |
| -------- | ---------- | ---------- | ---------- | --------- |
| **F2 safety** | Adversary R1: **BLOCK** — `world.js:139-141` re-anchors the shadow frustum to the cart every frame, so `autoUpdate=false` doesn't stale the map, it **smears/drifts** shadows off their casters under motion (60–100m frustum crossed in ~2–3.5s at boost). | Pragmatist/Auditor R1: F2 is a cheap safe win, ship in Slice 1 behind a stationary day/night screenshot. | **Demote + scope-cap, don't cut.** F2 ships ONLY with: (1) `needsUpdate` movement-gated, co-located with the sun-follow in `world.js`, mirroring the `GROUND_RESAMPLE_THRESHOLD` pattern; (2) `autoUpdate=false` flipped only after the first good map; (3) single-owner shadow-cadence contract over AdaptiveQuality; (4) written scope cap: **mid/high, near-stationary only — zero on low, ~zero during boost**; (5) B0-gated, **cut entirely if B0 shows the depth pass isn't a measurable mid/high line item**. Acceptance = Gary boost-run, never a stationary screenshot. | The Adversary's mechanism was verified independently by Architect, Auditor, Profiler against `world.js`. A bare frame counter is wrong by construction; the movement-gate makes `world.js` the single owner of both the camera move and the refresh. Bug is motion-only and invisible to every gate the agent owns → cannot ride Slice 1. |
| **Slice 1 contents** | Pragmatist R1: Slice 1 = B0 + D3 + F2. | Auditor/Pragmatist R2: F2 is not Slice-1 material — its only failure mode is invisible to the agent's surface. | **Slice 1 = B0 + D3 only.** F2 moves to Slice 2 behind its movement fix. | An item whose sole failure mode needs a real GPU can't share the "cheap, self-verifiable, ship-now" slice. |
| **F2 vs AdaptiveQuality** | Design: F2 "is NOT the empty-map disable path," AQ interaction orthogonal. | Profiler R2: `autoUpdate=false` **is** the "stop re-rendering" state AQ was *engineered to never enter* (`adaptiveQuality.js:197-233`); AQ's restore path sets a one-shot `needsUpdate` (`:233`) that now races F2's periodic one. | **F2 owns shadow cadence as single writer** and re-implements AQ's empty-map flush through its own `needsUpdate`; AQ's shadow toggle requests a one-shot refresh *through* F2. | Not orthogonal — same triple-writer trap the plan only fixed for bloom, now also present for shadows. |
| **D3 hoist** | Plan/Profiler: trivial hoist of one literal, "zero behavior change." | Auditor/Adversary: `count` is a per-NPC **by-value snapshot** read at the boarding gate (`crowd.js:779`); `add` mutates a **separate** live accumulator (`:788`). A naive `scratch.count++` collapses the channels and changes the boarding throttle. | **Preserve the split**: pooled scratch sets `.count = activePassengers` **per NPC** (re-snapshot, so a later NPC sees prior same-frame boardings — Auditor's R2 correction), `add` increments the live accumulator via a shared counter object, never `count`. Task 2.3 asserts a later NPC's `.count` reflects prior same-frame boardings. | Wrong → over-boards or stalls boarding; silent in a screenshot, needs a behavioral assertion. |
| **F2 vs F1 priority** | Architect R1: F2 before F1 (F2 lower coupling, runtime-only). | Profiler: F2 buys **nothing on low** (shadows off); F1 helps all three tiers (bloom on everywhere). | **F1 before F2.** F2 is neither low-coupling (co-owns shadow-camera state with the per-frame sun-follow) nor low-tier-relevant. | Value-per-tier: F1 helps the squeeze tier that matters most; F2 doesn't. |
| **CHANGELOG batching** | tasks.md 9.1: one CHANGELOG sweep at the end. | Pragmatist/Auditor: multi-slice change → batching means Slice 1 lands with no entry traveling with it (rule violation). | **Split 9.1 — each slice's bullet lands in that slice's commit**, same-day grouping re-assembles them. | "The diff and the entry travel together" is scoped to one commit; same-day grouping preserves the coherent story for the reader. |
| **C1 spec wording** | Architect R1: frame-budget spec "registers no collidable footprint until complete" **contradicts** C1-b ("structure synchronous, scatter deferred"). | Auditor/Adversary: satisfiable — scatter is non-collidable ambient. | **Salvageable, not a contradiction** — reword to "**collider-registering work is synchronous; deferred work is collider-free**." But the `buildWorldgenKind` audit (pin every collider-registering case to the synchronous phase) **remains a precondition**, not optional. | Two personas independently treating the structure boundary as the collision boundary confirms the resolution shape; the audit obligation stands because dispatch interleaves collidable cases. |

## Risk Register

| Risk | Severity | Mitigation | Owner (flagged by) |
| ---- | -------- | ---------- | ------------------ |
| C1 reorders/re-creates `ctx.rng` → every existing chunk regenerates differently mid-game for any player who drove across the change | **CRITICAL** (mitigated to Low by the gate) | Carry the live `ctx.rng` instance; **hard merge-block on the byte-identical registry-dump diff across a multi-chunk concurrent-deferral neighborhood** (task 6.5). | Adversary, Auditor, Architect, Pragmatist, Profiler |
| A1 `compileAsync` inserts an async hop before `Sound.init()` → every iOS player ships silent, invisible to the agent's verification surface | **CRITICAL** | `Sound.init()` stays the first synchronous call in the title-tap; `compileAsync` kicked AFTER it, fire-and-forget, never `await`ed in the gesture. Gary verifies on iOS. | Adversary, Architect, Pragmatist |
| A1 warm-scene teardown disposes a `userData.shared` pooled material → ~200ms periodic recompile storms (a perf regression masquerading as a fix) | **CRITICAL** | **A1 must NEVER dispose**: use `compileAsync(scene,camera)` referencing the pooled shared materials, drop only wrapper meshes. No raw `traverse(dispose)`. | Auditor, Profiler |
| F2 shadow smear/drift under motion (player-anchored frustum + `autoUpdate=false`) | High | Movement-gated `needsUpdate` in `world.js`; scope-capped to mid/high near-stationary; cut if B0 says immaterial; Gary boost-run acceptance. | Adversary, Profiler, Architect, Auditor |
| C1 half-built chunk: cancel orphans live NPCs / double-generates on re-entry | High | Crowd spawn ordered last (or atomic batch); clear by-key queue entry in `_unload`; dispose partial-adds through `disposeChunkByKey`. | Adversary, Auditor, Architect |
| F1 + AQ + E1 multi-writer to `bloomPass.enabled` → bloom flicker / AQ load-shed overridden | High | Single resolved predicate as the **only** writer; AQ becomes a flag-setter; refactor 4.1 before gating 4.2. | Profiler, Architect, Adversary, Auditor |
| Tier-2 geometry merge disposes a `userData.shared` resource → recompile storm | High | Reuse the vendor-booth `userData.shared` disposal pattern; never invent a second one; B0-gate the whole item. | Profiler, Architect, Auditor |
| D3 naive hoist collapses the snapshot/live two-channel semantic → boarding-throttle regression (silent) | Medium | Re-snapshot `.count` per NPC; `add` mutates a separate live counter; behavioral assertion in 2.3. | Auditor, Adversary, Pragmatist, Profiler |
| A1 warms wrong program (not threeShim-built / Lambert mismatch on low) → stall still fires, title-time wasted | Medium | Build warm meshes through real threeShim factories; A4 is the independent safety net, verified on `?perf=low`. | Adversary, Profiler, Architect |
| B0 capture pass at wrong composer index / `needsSwap` wrong → HUD still over-counts or post chain corrupted | Medium | Index 1 (after RenderPass, before bloom); no draw of its own; `needsSwap` correct; assert `autoReset` stays default; `rg 'info.render' src/` for a third reader. | Adversary, Auditor, Profiler |
| Shared per-frame governor missing → dense hub defers props AND links them same frames, relocating the stall | Medium | One governor owns C1-b scatter queue + A4 reveal pump + E1 elevated rate; crowd-spawn last. | Profiler |
| **Process: sandbox-pass ≠ game-pass for C1/F2** — both fail only under motion on a real GPU; no sandbox exercises the streaming budget loop or the sun-follow | Medium | Acceptance = Gary boots the game and drives a boost run across ≥2 hubs. Codespaces has no WebGL — **all live perf/visual/iOS/motion verification is Gary's**. Batch into 3 round-trips. | Adversary, Pragmatist, Auditor |
| Fog-as-far-cull clips skybox / distant hub silhouettes visible through thin fog (`camera.far` 1500 vs fog far 520) | Low–Medium | Park behind B0; if reached, dedicated hub-viewer verification, not a "small knob." | Architect, Profiler |
| Tier-2 crowd LOD optimizes an unproven cost (broadphase already ~0.3ms; moves a CPU number, not a HUD draw) | Medium | Gate hardest; likely its own future change; do not book as a perf win. | Profiler, Pragmatist, Architect |

## Verdicts Summary

| Persona | Key Concern | Verdict (latest) |
| ------- | ----------- | ---------------- |
| Architect | C1 spec contradiction (salvageable) + F2 two-writer shadow-camera fault; refactor-before-feature for F1/F2 | Proceed with mitigations (F1 before F2; F2 needs movement-gated single-owner refresh or degrades to Block) |
| Adversary | F2 built on a false premise (player-anchored frustum smears shadows under motion) | Proceed with mitigations (F2 softened from BLOCK to scope-capped Proceed; cut if not scope-capped) |
| Auditor | D3 two-channel hoist breaks the boarding throttle silently; F2 not Slice-1 material | Proceed with mitigations (Slice 1 re-cut to B0+D3; per-slice CHANGELOG required) |
| Pragmatist | Scope — three changes in one; speculative tail (E1/F1/Tier-2); C1-a is a trap | Proceed with mitigations (3 slices; Slice 1 = B0+D3; C1-b; gate F1/E1/Tier-2 on Gary capture) |
| Profiler | Bloom-pass writer collision (F1+AQ+E1) needs one enforced predicate; F2 win is narrow/tier-confined | Proceed with mitigations (F2 demoted to stationary-only + B0-gated/cut; A1 via compileAsync never dispose; one shared governor) |

## Next Step

Implement **Slice 1 (B0 + D3)** with the D3 two-channel mitigation and the B0
`needsSwap`/index-1/third-reader checks folded into tasks §1–2. Land its CHANGELOG
bullet in the same commit. Then hand Gary the **Round-trip 1** capture script
(`?perf=low/mid/high`, backtick HUD: draws/tris/programs + `progDelta`) — one
trip resolves four gates (B0 reads real numbers, whether bloom cost justifies F1's
4.2, which Tier-2 items name a real cost, and the steady-state attribution). Fold
the binding mitigations below into tasks.md before any Slice 2/3 code.

### Binding corrections to fold into tasks.md / design.md
1.  **Spec reword** (frame-budget): "registers no collidable footprint until
    complete" → "**collider-registering work is synchronous; deferred work is
    collider-free**." Add the `buildWorldgenKind` collider audit as a precondition
    to task 6.3.
2.  **D3 (task 2.1/2.3)**: re-snapshot `.count` per NPC; `add` mutates the live
    accumulator via a shared counter object; assert a later NPC sees prior
    same-frame boardings.
3.  **A1 (task 5.2)**: `compileAsync` after `Sound.init()`, never `await`ed in the
    gesture; warm through real threeShim factories; **never dispose** (reference
    pooled shared materials, drop only wrappers).
4.  **F2 (task 3.1)**: movement-gated `needsUpdate` co-located with the sun-follow
    in `world.js`; `autoUpdate=false` only after first good map; single-owner over
    AQ; written scope cap (mid/high near-stationary); B0-gate with a cut option.
5.  **C1 (task 6.5)**: determinism gate spans a **multi-chunk concurrent-deferral**
    neighborhood, not one isolated chunk. Crowd spawn last; clear by-key queue in
    `_unload`; dispose partial-adds via `disposeChunkByKey`.
6.  **Governor**: one per-frame budget owns C1-b scatter + A4 reveal pump + E1
    elevated rate.
7.  **CHANGELOG (task 9.1)**: split — each slice's bullet in that slice's commit.
