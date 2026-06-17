# Deliberation Summary — worldgen-layout-harness (001-initial)

## Context

-   **Task**: Apply-readiness review of the full `worldgen-layout-harness` artifact
    set (proposal, design D-A..D-H, 5 capability specs, tasks groups 1–8) — the
    harness change that gates `festival-zone-grammar`.
-   **Personas Consulted**: Adversary, Architect, Pragmatist, Anthropologist
    + Mediator. (Profiler/Maverick not convened this round.)
-   **Mode**: **Synthesis** (no Round 2; personas wrote in isolation — tensions
    surfaced below are the Mediator's reading of their actual positions).
-   **Date**: 2026-06-10.
-   **Verdicts in**: 4/4 Proceed with mitigations. But the Adversary's Critical
    findings 1–3 invalidate the central decision (D-C) *as scoped*, which forces
    a structural choice, made below.

---

## Verdict

**Proceed with modifications — and take the pivot.** The dry-run extraction
(design D-C / tasks group 3 / `specs/layout-dry-run`) is **cut from this change
and deferred to `festival-zone-grammar`**; in its place, **built-truth capture
(`dumpRegistry` from a real pinned-tier boot) becomes the linter's primary
source**, with `festivalPlan` + the hoisted `FESTIVAL_TUNING` providing the
headless plan-level rules and analytic true extents. The Adversary demonstrated
that D-C's "layout fns own ALL draws, mesh halves rng-free" contract is
unimplementable at the stated scope: cosmetic draws live *inside* ~8 model
builders (`buildTent(ctx.rng)` mid-loop, chunks.js:1237–1268, 1289–1384,
2258–2429), `crowd.spawn` draws from the cluster stream with a tier-sized pool
and a zero-draw early return (crowd.js:338–374, perf.js:59/79/94 — built layouts
are *already* tier-dependent), and `registry.closestBuilding` sits inside draw
loops (chunks.js:1405, 1881, 1145–1148) so a headless dry-run can never exactly
reproduce built truth anyway. Doing that surgery here — under a golden-frozen
regime whose goldens are blind to most of the affected draws (Adversary finding
4) — is the maximum-risk version of the work. Doing it inside the grammar
change — where those builders are being rewritten anyway, the POI golden is
already moving, and this harness exists to gate it — is the minimum-risk
version. The Adversary's own assessment points the way: the registry-audit
mode "is the strongest single idea in the change." Everything else (instrument,
hoist, linter, surfaces, hub viewer, markers) proceeds, hardened per the
findings below.

---

## The synthesis

**Where the council converged.** All four endorse the instrument-first posture
(D-A), the one-change-not-two structure, building the hub viewer through the
real `buildWorldgenKind` path (D-E — unanimous, for the sandbox-pass/game-fail
reason), the gallery-as-mode and markers-as-coordinates shapes, and
baseline-not-gate (D-D). Three personas independently found the same two bugs:
the importmap surface is **four** html files, not three (map-sandbox.html
already carries its own `wg` array and groups 4–5 make it a consumer —
Architect F2, Pragmatist F5), and the snapshot gate as specced is a manual
browser ritual repeated ~50 times that will get skimped under fatigue
(Anthropologist F1, Pragmatist F6 — "a tedious gate is a skipped gate" is a
*determinism* control, not ergonomics).

**Where they collided.** The real conflict is triangular. The **Adversary**
proved D-C unimplementable as scoped and offered two ways out: name the full
model-surgery scope (param extraction in tent/campTent/foodTruck/sugarShack/
stage/campChair/picnicTable/torch-field/potty/bubble-vendor/drum-figures plus a
`crowd.spawn` pre-rolled-params rework) as in-scope here, or downgrade D-C and
accept an instrumented cosmetic break. The **Architect** proposed a narrower
patch — widen `env` to `{waterAt, blockedAt}` and accept that headless
camp-villages are approximate by construction, with registry-audit as the
authoritative checker. The **Pragmatist** wanted the shortest
grammar-unblock chain and flagged that group 3 is the L-sized bulk of the
change, with the entire ~50-capture gate tax hanging off it.

**The resolution and the why.** Both Adversary options and the Architect patch
share an admission: *even after the surgery, the headless dry-run is an
approximation of built truth* — registry guards, crowd pool, and
`isPointInLake`-vs-`lakeAt` all guarantee divergence exactly at the contested
spots where layout bugs live. So the original design pays the repo's
highest-risk refactor (a determinism tripwire, #4) to produce a *secondary*
data source, while the *primary* source (the built registry) is already
specced as task 4.6 and is exact by definition. Inverting that is the pivot:
this change ships built-truth capture + the linter + the surfaces + the hoist;
the extraction (with the Adversary's full named scope and the Architect's
`{waterAt, blockedAt}` env) moves into `festival-zone-grammar` as explicit
early tasks, where world drift is already expected and managed and where this
harness — built first, per doctrine — is sitting there to gate it. The
Pragmatist's chain collapses from ~16 gated commits to ~6 (only the hoist
remains golden-frozen), which also shrinks the freeze window his finding 6
worried about. What the grammar change loses by not having `layouts.js` on day
one: per-record dry-run data for its zone planner. What it keeps: true extents,
computable analytically from the hoisted `FESTIVAL_TUNING` constants (ring
radius + truck envelope etc.) — which is what a *planner* needs; per-record
data arrives mid-grammar when the extraction lands under the moving golden.

**The non-conflicting findings fold in whole**: the Pragmatist's cross-change
sequencing (H.2 before any capture; `DEFAULT_WORLDGEN_V2` flip re-sequenced —
both flagged to Gary), the Anthropologist's violation→3D pipeline + `?at=x,z`
+ discoverability fixes, the Architect's hub-viewer shared unload walk +
dependency-direction rule + worldgen README update, and the Adversary's gate
hardening (draw-count canary, lakeside window, self-diff control, tier pin,
Math.random transcribe-as-is, stale comment fix).

---

## Change Groups

### CG1 — The pivot: built truth is the substrate; `layouts.js` defers to festival-zone-grammar

**Scope**: re-point the change's data spine from dry-run records to captured
registry truth.

1. **design.md**: replace D-C with **D-C′ "Built-truth capture; extraction
   deferred."** Record the three blockers verbatim (model-internal draws across
   ~8 model files; `crowd.spawn` tier-pool draws with zero-draw early return —
   built layouts are tier-dependent today; `registry.closestBuilding` inside
   draw loops). Hand forward, as named design guidance for the grammar change:
   (a) param extraction *inside* models (`pickTentParams(rng)` pure /
   `buildTentMesh(params)`), file list enumerated; (b) `crowd.spawn` accepts
   pre-rolled params (also fixes the pool-full nondeterminism); (c) `env =
   { waterAt, blockedAt }` per the Architect, with headless camp-villages
   labeled approximate and registry-audit authoritative; (d) the
   `Math.random()` sites at chunks.js:2342–2343 and 2473 are *intentionally
   outside* the deterministic stream — transcribe as `Math.random`, never
   convert to `rng()`.
2. **tasks.md**: delete group 3 (3.1–3.6); add a one-line "Deferred to
   festival-zone-grammar (see design D-C′)" note so the renumber is auditable.
3. **specs/layout-dry-run/spec.md**: remove from this change (the capability
   moves to the grammar change's delta specs).
4. **proposal.md**: "What Changes" — replace the "Dry-runnable builder layouts"
   bullet with "Built-truth capture" (dumpRegistry + one-command snapshot
   tooling as the linter/overlay data source); update "Capabilities" (drop
   `layout-dry-run`) and the Dependency paragraph ("grammar consumes the tuning
   module, the linter, and the capture tooling; performs the dry-run extraction
   itself, gated by this harness").
5. **festival.js comment fix** (allowed now, comment-only): the `stageScaleOf`
   mirror at festival.js:101–108 cites `chunks.js:2094`; buildStage now lives
   at 2258 with the draw at 2264. Fix the citation; the *encoded* selftest
   assertion (stageScaleOf vs layoutStage's emitted scale) defers to the
   grammar change where `layoutStage` exists.

### CG2 — Harden the capture instrument (D-A is now load-bearing for two changes)

**Scope**: tasks 1.1/1.2 + design D-A + DEBUGGING.md.

1. **`bin/layout-snapshot <seed> [out.json]`** (precedent: `bin/readme-sync`):
   one command wrapping boot → `__dbg.start()` → settle ("loaded-chunk count
   stable for 60 frames") → `dumpRegistry()` → normalize (sort kind+x+z, round
   1e-4) → write `verification/snapshots/<seed>.json`; plus a `--diff a b`
   mode and a `--seeds` loop for multi-seed capture. Full copy-paste
   preview-MCP/agent-browser recipe in DEBUGGING.md in the same commit.
2. **Pin the capture protocol**: `?perf=<tier per Gary — recommend high>`,
   `?worldgen=1&seed=S`, boot with no driving (registry state is
   path-dependent), documented in design D-A.
3. **Twice-capture self-diff control**: capture the same seed/tier twice
   pre-refactor; an empty self-diff is required before any refactor diff is
   trusted (Adversary F8).
4. **Draw-count canary**: wrap each cluster's rng in a counting closure; emit
   per-cluster draw counts in the dump — catches added/dropped/conditional
   draws that produce identical positions (Adversary F4). This is the
   instrument the grammar change's extraction will live on.
5. **Widen dump fields**: add attractor radius/weight and collider `damage` to
   the `{kind, x, z, footprint, colliderR, chunkKey}` shape (task 1.1).
6. **Choose snapshot windows deliberately**: the spawn ring + at least one
   shoreline hub + one dense multi-hub window (locate via map-sandbox), and/or
   a `gotoHub(0..9)` sweep per seed, so water-rejection and guard branches are
   actually exercised (Adversary F5). Keep one hub's Noon/Midnight screenshot
   pair per seed as the cosmetic catch.

### CG3 — Cross-change sequencing (the gate must stand on settled ground)

**Scope**: tasks.md preamble + v2-worldgen HANDOFF note + questions-for-human.

1. **H.2 (v2 change) lands as commit zero** — it deliberately moves the
   queryPoint golden; re-record, re-verify node==browser, *then* capture the
   pre-refactor snapshots (task 1.2). Never mid-stream (Pragmatist F1).
2. **`DEFAULT_WORLDGEN_V2` flip re-sequenced to after `festival-zone-grammar`**
   — the HANDOFF's "Group I landing next" predates the playtest verdict;
   flipping now ships the jumble to the live deploy. Write the corrected order
   (H.2 → harness → grammar → H.3/F.5 + I landing) into the v2 HANDOFF so a
   fresh session doesn't execute the stale order. **Gary sign-off required**
   (see For Gary).
3. **Freeze-window agreement**: the only golden-frozen refactor left is the
   group-2 hoist (~1–2 commits). Agree with Gary to freeze `constants.js` /
   worldgen tuning for that window; note it in the tasks group-2 preamble.

### CG4 — FESTIVAL_TUNING hoist, hardened and slider-ready

**Scope**: tasks 2.1/2.2 + design D-B.

1. Author `tuning.js` **mutable-CONFIG + setter shape from day one** (the
   group-6 sliders bind it like map-sandbox `setConfig`; don't retrofit —
   Pragmatist effort table).
2. Inventory note in 2.1: near-duplicate constants used by planner AND builder
   under different names are marked **"same number, two owners, do NOT merge
   yet"** — unifying is a behavior change and a snapshot-diff failure.
3. **Dev-only drift assertions**: in chunks.js (which legally imports both),
   compare each *derived* tuning value against the live model export
   (`14 * FOOD_TRUCK_SCALE`, shack diagonal, `POTTY_SPACING`); `console.warn`
   on mismatch, localhost-gated (Architect F5). Fold into task 2.2.
4. **Analytic extent helpers**: tuning.js (or a sibling pure helper) exports
   per-kind conservative envelope computations (ring radius + member size →
   outer extent) — this is the grammar zone-planner's true-extent source under
   the pivot, and the overlay/linter plan-mode consumes it too.
5. Importmap entries in **all four** consuming html files where applicable
   (index, sandbox, map-sandbox; hub-sandbox when it lands).

### CG5 — Linter re-pointed: registry-audit primary, plan-mode headless

**Scope**: design D-D + specs/layout-linter + tasks group 4 + task 8.1.

1. **Two context modes, explicitly partitioned** in the rule table:
   - **Plan mode (headless node, multi-seed in seconds)**: rules computable
     from `festivalPlan` + tuning analytic extents + road/water queries —
     `stage-spacing`, `spawn-arrival`, hub-level `water-clear`, approximate
     `overlap`/`truck-off-road` on analytic envelopes (labeled approximate).
   - **Registry mode (primary, exact)**: the same rules plus
     `dancefloor-clear`, `booth-on-road`, `potty-attached` at sub-component
     granularity, run against `dumpRegistry` payloads. Spec text: where the
     two modes disagree, registry mode is authoritative.
2. **Baseline (8.1) records from registry mode** at the pinned tier, captured
   via `bin/layout-snapshot --seeds` across ≥10 seeds (scripted boots), with
   plan-mode counts recorded alongside so the headless-vs-built gap is itself
   a tracked number the grammar change watches (Architect F6).
3. **4.7 pinned to seed `0xf7ef2a3c`** (playtest round 2's known
   trucks-clipping-vendor-rows seed) — kills the forward reference to group 5
   (Pragmatist F3).
4. **Every violation emits the full eyes pipeline**: map-sandbox 2D deep-link
   AND hub-sandbox 3D link (`?at=x,z`, CG7) AND a paste-ready
   `__dbg.teleport(x, z)` snippet; `gotoHub` prints that hub's violations
   (design open question resolved: yes) (Anthropologist F2).
5. **`bin/lint`** wraps the node incantation (Anthropologist F7).
6. **Baseline format is Gary-legible**: rule | severity | total | worst seed |
   2D link | 3D link, plus 2–3 hub-sandbox screenshots of the worst offenders
   embedded; the grammar change's proposal must pin the archived path or copy
   the baseline forward (Anthropologist F8).

### CG6 — Map-sandbox surfaces re-pointed

**Scope**: tasks group 5 + design D-H + specs/layout-surfaces.

1. **True-extent overlay (5.1) consumes two sources**: (a) **captured snapshot
   JSON** (`verification/snapshots/<seed>.json`, fetch or file-drop) — exact
   built truth for captured seeds; (b) **analytic tuning envelopes** — live for
   any seed, labeled approximate. Per-record hover (5.2) works on both.
2. Gallery (5.3) unchanged; gallery lint counts (5.4) use **plan mode** (no
   boots required) and render progressively — paint the tile first, fill the
   count as it computes (Anthropologist F10).
3. map-sandbox.html's `wg` importmap array gains `worldgen/tuning` +
   `worldgen/lint` (and any extent-helper module) — named explicitly in tasks
   5.1/5.4.

### CG7 — Hub viewer integrity

**Scope**: design D-E/D-F + tasks group 6 + specs/layout-surfaces.

1. **Teardown = the shared by-key unload walk.** Extract chunks.js's existing
   `_disposeChunk` walk (registry.removeChunk + `forestAnimatables`/
   `forestDrumCircles`/`forestDrumMusic` by-key splices + contextLights
   deregistration + `userData.shared`-respecting scene dispose) into a small
   exported helper both `_disposeChunk` and `buildHubPreview` teardown call —
   the two can't drift, and slider-drag rebuilds can't leak entries that feed
   back into `closestBuilding` and silently change hub N+1's layout
   (Architect F3, Adversary F7).
2. **Spec the synthetic ctx explicitly** ({cx, cz, key, cxWorld, czWorld, rng,
   group, region, crowd}). **Crowd disposition**: a real Crowd instance or a
   draw-faithful stub (never "omit" — omitting skips draws and the viewer
   shows different chair layouts than the game); **verify by diffing
   hub-sandbox positions against a game `dumpRegistry` at the same
   seed/hub/tier** — that diff is the viewer's own acceptance test.
3. **Register the hub's worldgen lakes into the page registry before
   building** (or sequence/label shoreline hubs as approximate) — a fresh page
   has no lakes, so `isPointInLake` never rejects (Adversary F7).
4. **`hub-sandbox.html`'s importmap maps `'three'` → `src/threeShim.js`**
   (copy sandbox.html's mapping, not the CDN URL) — tripwire #2 (Adversary
   F10). Verify no builder calls `Sound` synchronously at build (the page
   never runs `Sound.init()`).
5. **`?at=x,z`** → nearest heart + `replaceState` to canonical URL; viewer
   displays heart world coords + rank; `gotoHub(n)` prints the equivalent
   hub-sandbox URL (Anthropologist F3).
6. Slider rebuild on **drag-end or rAF-throttle**, decided at build, noted in
   task 6.3 (Anthropologist F9).
7. Keep `buildHubPreview` in chunks.js; the dispatch-module extraction is the
   grammar change's early task. **State the dependency-direction rule** in
   design and in tuning.js/lint.js headers: `chunks.js → worldgen/` only;
   worldgen modules never import `src/chunks.js`, `src/registry.js`,
   `src/lakes.js`, or `src/models/*` (Architect F4).

### CG8 — Markers, discoverability, docs, importmap consistency

**Scope**: tasks groups 7–8 + design D-G + specs/layout-debug-tools + rules docs.

1. **Restore the `note?` field** (dropped between proposal and tasks): optional,
   editable per-marker in the overlay MARKERS section after the run, before
   copy-JSON (Anthropologist F5). Marker mobile story per Gary's call (see For
   Gary) — written into the spec scenario either way; don't ship a flagship
   scenario that silently excludes the phone.
2. **Correct the importmap rule to FOUR files everywhere** (proposal Impact,
   design risk, tasks 2.2/4.1/5.1/6.4, no-build.md note: "every consuming html
   file," four enumerated). Add a **consistency-checker**: a small node script
   (sibling of `bin/layout-snapshot`) that regex-extracts the module arrays
   from all four html files and diffs against `src/` + `src/worldgen/`
   contents, failing loudly (Architect F2). The shared-bootstrap dedupe is
   parked as a Gary-call follow-up — don't fold prod-loading changes into a
   golden-frozen change.
3. **Discoverability** (Anthropologist F6): CLAUDE.md Run+verify table gains
   the `hub-sandbox.html` row ("one complete hub in 3D — layout/arrangement
   changes"); DEBUGGING.md gains a "layout verification" section (lint CLI +
   `bin/` wrappers, gallery, markers, and the layout-snapshot-vs-golden
   vocabulary note verbatim — "golden" is a known Gary confusion point).
4. **`src/worldgen/README.md` updated** (new task): module list gains
   tuning/lint, the theme-layer section notes the built-truth substrate and
   the deferred extraction, the env-injection guidance and
   dependency-direction rule documented (Architect F7).
5. **CHANGELOG travels per-commit** (dbg verbs, linter CLI, overlay, hub
   viewer, markers each carry their line); task 8.2 becomes the ROADMAP
   "Layout-work agent harness" trim sweep, not a batch entry (Pragmatist F11).
6. Sequencing inside the change (Pragmatist): 1.1+1.2 first and alone;
   1.3/1.4 second; the hoist; linter + baseline = **declared grammar-unblock
   milestone in tasks.md**; hub viewer immediately after (Gary judges in 3D —
   it must exist on day one of grammar iteration); gallery/markers/1.5 as tail
   overlapping grammar planning.

---

## Risk Register

| # | Risk | Severity | Disposition / Owner |
|---|------|----------|---------------------|
| R1 | **Pivot gap**: grammar zone-planner uses analytic extents that drift from built truth | Medium | CG4 (extent helpers) + CG5 (baseline records the headless-vs-built gap as a tracked number; registry mode authoritative) |
| R2 | **Built truth is tier-dependent today** (crowd pool exhaustion consumes draws; tree density tier-scaled) — snapshots/baseline only valid at the pinned tier | High | CG2 (tier pinned + documented). Underlying nondeterminism **accepted for this change**; the real fix (crowd pre-rolled params) is named in D-C′ and lands in the grammar change |
| R3 | **H.2 or live tuning lands mid-freeze** → all snapshots + goldens shift, gate reports false failures | High | CG3 (H.2 = commit zero; tuning freeze agreement; window now ~2 commits, not ~10) |
| R4 | **Hub viewer lies** (no lakes registered, crowd absent → different layouts than the game at the same seed/hub) | High | CG7 (lakes registered first; crowd disposition; acceptance test = diff vs game dump) |
| R5 | **Rebuild-in-place leaks feed back into `closestBuilding`** → hub N+1 layout differs from fresh load (correctness bug, not just a leak) | High | CG7 (shared by-key unload walk, extracted not reinvented) |
| R6 | **Importmap drift across four files** — edits silently stop reloading | Medium | CG8 (four-file correction + consistency-checker script) |
| R7 | **Capture ritual skipped under fatigue** → gate on goldens alone, which are blind to the build | Medium | CG2 (`bin/layout-snapshot`; post-pivot only ~2 gated commits remain) |
| R8 | **Gate blind spots**: registry-invisible draws (torch fields, drum figures, hammocks); conditional branches unexercised at sampled seeds | Medium | CG2 (draw-count canary; shoreline + dense windows; Noon/Midnight screenshot pair). Primarily protects the grammar change — the instrument is built now |
| R9 | **Snapshot reproducibility assumed** (frame-spread generation, spawn-jug registry spiral) | Medium | CG2 (twice-capture self-diff control + settle condition) |
| R10 | **hub-sandbox maps raw CDN three** → tier-divergent materials, re-opens the frozen-namespace temptation | Medium | CG7 (threeShim mapping named in task 6.2 + no-build.md) |
| R11 | **`stageScaleOf` mirror desync** (stale line ref already drifted; scale must stay draw #0 forever) | Low | CG1 (comment fix now); encoded selftest assertion **deferred to grammar** where `layoutStage` exists — accepted with rationale |
| R12 | **Future extractor "fixes" the `Math.random()` sites into `rng()` draws** → injects draws into the cluster stream | Low (here) / High (grammar) | CG1 (transcribe-as-is note handed forward in D-C′) |
| R13 | **Marker flagship scenario fails on mobile** (no key, no overlay, localStorage stranded per device) | Medium | For Gary (scope desktop-only v1 honestly, or add one touch affordance) |
| R14 | **baseline.md goes stale-linked when the change archives** | Low | CG5 (grammar proposal pins the archived path or copies the baseline forward) |

---

## For Gary

1. **The pivot itself (scope cut).** Group 3 / `layouts.js` / the
   `layout-dry-run` capability move out of this change into
   `festival-zone-grammar`, where the builders are being rewritten anyway and
   the POI golden already moves. This change ships the hoist + capture tooling
   + linter + surfaces instead. The council's evidence says the original plan
   was the maximum-risk version of the same outcome — but it's your change to
   re-scope. **Confirm.**
2. **`DEFAULT_WORLDGEN_V2` flip re-sequencing — contradicts the v2 HANDOFF.**
   The HANDOFF still lists "Group I landing" as next-priority #2; executing
   that order ships the jumbled festival to the live deploy (watched by real
   players). Proposed order: H.2 (now) → this harness → festival-zone-grammar
   → H.3/F.5 + I landing. **Confirm, and we'll write it into the HANDOFF.**
3. **Tier pin for snapshots + baseline.** Built truth is tier-dependent today
   (crowd pool, tree density). Recommend pinning `?perf=high` (largest pools,
   least early-return exposure), crowd on, for every capture and the baseline.
   **Confirm or pick a different tier.**
4. **Marker mobile story.** The spec's flagship scenario is "Gary taps the
   marker key mid-drive," but on your phone there's no key and no backtick
   overlay. Option (a): scope v1 to desktop playtests, said honestly in the
   spec. Option (b): one touch affordance (e.g. triple-tap an existing HUD
   element) + a copy button reachable without a keyboard. **Pick.**
5. **Tuning freeze.** During the (now short) group-2 hoist window, please
   don't live-tune `constants.js` / worldgen tuning — it invalidates the
   snapshots. We'll ping when the window opens and closes.
6. **Parked, your call later:** deduplicating the four near-identical inline
   importmap injectors into one shared classic-script bootstrap (touches prod
   loading; stays within no-build but shouldn't ride a golden-frozen change).

---

## Dissents preserved

-   **The original D-C (full extraction in this change).** Its core value —
    one data source shared by plan, build, lint, and overlay — is *deferred,
    not rejected*. The grammar change must still deliver it; D-C′ carries the
    full design guidance forward so nothing is re-derived from scratch.
-   **Adversary's "name the surgery here" option.** His finding-1 hardening
    offered doing the model param extraction *in this change* with the full
    file list named, one model per commit, same gate. Viable — overruled on
    risk-budget grounds: it multiplies the golden-frozen freeze window and
    performs the repo's riskiest refactor twice-adjacent to a rewrite that
    obsoletes half of it. His gate-hardening findings (4, 5, 8) are adopted in
    full precisely so the deferred surgery inherits a sharper instrument.
-   **Architect's `env = { waterAt, blockedAt }` widening.** Correct and
    adopted — but as handed-forward design guidance in D-C′, not implemented
    here, since `layouts.js` no longer exists in this change.
-   **Pragmatist's critical-path math.** His chain assumed group 3 stays
    (L-sized, ~8 gated commits); the pivot dissolves that premise. His
    structural calls — one change not two, declared grammar-unblock milestone,
    hub viewer immediately post-milestone, H.2-first — all survive intact.
-   **Anthropologist's touch-affordance preference.** She leaned toward
    shipping *some* mobile marker path rather than scoping to desktop; left as
    Gary's decision (#4) rather than resolved by the council.

---

## Verdicts Summary

| Persona | Key Concern | Verdict |
|---------|-------------|---------|
| **Adversary** | D-C unimplementable as scoped: model-internal draws, tier-dependent crowd draws, registry guards inside draw loops; the D-A gate blind to registry-invisible draws without a canary + tier pin + control run | Proceed with mitigations (D-C re-scope required) |
| **Architect** | `layouts.js` purity hole — `registry.closestBuilding` mid-rng-loop means `env` needs `blockedAt`; hub-viewer cleanup must be the shared by-key unload walk; importmap surface is four files | Proceed with mitigations |
| **Pragmatist** | Cross-change sequencing — H.2 moves the golden this change freezes against; stale HANDOFF order would ship the jumble; script the gate; declare the grammar-unblock milestone | Proceed with mitigations |
| **Anthropologist** | The D-A gate is a ~50-rep manual ritual (tedious gate = skipped gate = silent drift); violations end in 2D but Gary judges in 3D; hub-sandbox undiscoverable to a fresh session | Proceed with mitigations |
| **Mediator** | Synthesis: take the built-truth pivot; defer extraction to the grammar change | **Proceed with modifications** |

## Next Step

Fold CG1–CG8 back into the artifacts (design D-C→D-C′, tasks group 3 cut +
hardened groups 1/2/4–8, specs/layout-dry-run removed, layout-linter +
layout-surfaces + layout-debug-tools amended, proposal re-pointed), queue the
six For-Gary items in `questions-for-human.md`, and record the pivot as a
D-numbered Key Decision in `session-log.md`. Apply starts after Gary confirms
items 1–3.
