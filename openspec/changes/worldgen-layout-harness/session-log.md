---
change: worldgen-layout-harness
status: in_progress        # not_started | in_progress | blocked | paused | complete
current_task: "1.6 gotoHub → 1.7 topDown → 1.8 showFootprints → 1.9 DEBUGGING verbs → 1.10 festival.js comment (close group 1); 1.3/1.5 done"
blocked_by: null
open_questions: 0
started: 2026-06-10
last_updated: 2026-06-10
ref: "ROADMAP 'Layout-work agent harness' (added 2026-06-10); gate for festival-zone-grammar"
---

# Session Log: worldgen-layout-harness

> **AGENT DIRECTIVE:** This log is the "why" trail — it is **event-driven**, not a
> per-task diary. Write an entry only when a decision is made, something unexpected is
> discovered, a blocker is hit, or a question is raised for the human. Per-task progress
> lives in `tasks.md` checkboxes; the human-readable summary lives in `README.md`. To
> recover context, read `README.md`, then this file's frontmatter + Key Decisions + the
> latest Work Log entry, then `tasks.md`.

## Key Decisions

- **D1 — Harness lands BEFORE the grammar rewrite, as its gate.** Two playtest
  rounds of item-by-item layout fixes didn't converge because no surface can see
  or assert on the *built composition*. The linter's rules ARE the executable
  grammar spec; `festival-zone-grammar` is measured against this change's
  baseline. (Gary endorsed 2026-06-10.)
- **D2 — `dumpRegistry` is built FIRST (design D-A): instrument before surgery.**
  The behavior-preservation gate for the hoist + dry-run refactors is an empty
  normalized registry-snapshot diff at 3 seeds plus both unchanged goldens.
  Vocabulary: these are **layout snapshots**, not "goldens" (the goldens are the
  determinism hashes; Gary finds "golden" overloaded).
- **D3 — Layout functions own ALL rng draws, cosmetics included (design D-C).**
  The mesh halves of builders go rng-free; cosmetic values ride in the records.
  This is what makes the extraction provably order-preserving. One builder per
  commit so a diff failure localizes.
- **D4 — Water lookup is injected (`env.waterAt`), not imported.** Game passes
  its `isPointInLake` closure (bit-identical behavior); linter/overlay pass
  worldgen `lakeAt`. Shoreline divergence is tagged informational in lint output.
- **D5 — This change is golden-frozen.** Unlike the grammar change (which will
  move the POI golden deliberately), nothing here may move either golden or the
  built world. No "accept the drift" path exists.
- **D6 — THE PIVOT (deliberation 001): dry-run extraction deferred to
  festival-zone-grammar; built-truth capture is this change's substrate.** The
  Adversary proved old D-C unimplementable as scoped (cosmetic draws inside ~8
  model builders; `crowd.spawn` tier-pool draws — built layouts are
  tier-dependent TODAY; `registry.closestBuilding` inside draw loops). The
  registry is the primary, exact data source; the extraction lands inside the
  grammar change under its already-moving golden, gated by this harness. D-C′
  hands the full extraction design forward (model param splits, crowd
  pre-rolled params, `env={waterAt,blockedAt}`, Math.random transcribe-as-is).
  Freeze window collapses ~10 commits → ~2. Pending Gary confirm (-> Q1).
- **D7 — Cross-change sequencing (deliberation 001):** v2 H.2 golden-mover =
  commit zero (before any snapshot capture); `DEFAULT_WORLDGEN_V2` flip
  re-sequenced to AFTER festival-zone-grammar — the v2 HANDOFF's stale "Group I
  next" order would ship the jumble to real players (-> Q2).

## Assumptions

| # | Assumption | Confidence | Status | Resolution |
|---|-----------|------------|--------|------------|
| A1 | The worldgen builders' rng draws can all be moved into pure layout fns without changing draw order (incl. conditional draws in retry loops) | Med | open | Verified per-builder by D2's snapshot diff |
| A2 | `registry.closestBuilding` guards inside builders depend on cross-chunk build order, so lint-time reproduction is approximate — acceptable for a linter | Med | open | Council round 001 to pressure-test |
| A3 | A perspective top-down via existing camLock is sufficient (no ortho camera plumbing) | High | open | Revisit only if seam-checks prove unreadable |

## Dangling Threads

- Marker hotkey final binding (`m` vs `k`) — resolve against input.js/debug.js/touch.js at build (-> Task 7.1).
- Whether `gotoHub` should print that hub's lint violations once lint lands (design open question).

## Work Log

### 2026-06-10 -- Change created via /opsx:ff; artifacts drafted; council launched
**Event:** phase-change
**What:** Gary pivoted from round-3 symptom fixes to root cause after a structural
analysis showed every arrangement bug traces to the plan/build contract
(`KIND_FOOTPRINT` scalars vs oversized built extents) AND that no harness surface
can see built composition (the only detector is Gary driving). Decision: two
changes — this harness change gates `festival-zone-grammar`. ROADMAP gained both
sections (same date). proposal/design/specs/tasks drafted; deliberation round
001-initial launched with Adversary + Architect + Pragmatist + Anthropologist
(signatures: determinism rng-order, importmap×3, disposal, chunks.js outside the
game).
**Refs:** -> D1..D5, ROADMAP "Layout-work agent harness", deliberations/001-initial/

### 2026-06-10 -- Deliberation 001 returned: THE PIVOT; artifacts revised; 6 questions queued
**Event:** decision + phase-change
**What:** 4/4 personas said proceed-with-mitigations, but the Adversary's
Criticals invalidated the central design decision (old D-C dry-run extraction)
*as scoped* — see -> D6. Mediator synthesis (CG1–CG8) folded back into ALL
artifacts same-day: design D-C→D-C′ + hardened D-A/D-B/D-D/D-E/D-G/D-H +
cross-change sequencing section; tasks group 3 retired (not renumbered), group 0
added (H.2 commit zero + HANDOFF correction), grammar-unblock milestone declared
(groups 1+2+4+8.1); specs/layout-dry-run removed, other four specs amended;
proposal re-pointed (4 capabilities, four-html-file importmap truth). Notable
new instruments from the council: bin/layout-snapshot one-command capture,
per-cluster draw-count canary, twice-capture self-diff control, importmap
consistency checker, hub-viewer acceptance test (diff vs game dump). Six
For-Gary decisions queued (-> Q1–Q6); **apply gates on Q1–Q3.**
**Refs:** -> D6, -> D7, deliberations/001-initial/results.md, -> Q1..Q6

### 2026-06-10 -- Q1–Q6 answered interactively: ALL council recommendations confirmed; apply unblocked
**Event:** question (answered) + phase-change
**What:** Gary answered all six via interactive ELI-JD prompts, confirming every
recommendation: Q1 pivot CONFIRMED (-> D6 stands); Q2 flip re-sequenced — the
v2 HANDOFF correction landed the same hour (-> Task 0.2 ticked, the one
pre-apply task explicitly gated on the confirm); Q3 capture tier pinned
`?perf=high` crowd-on (design D-A updated); Q4 markers ship WITH the touch
affordance (task 7.1 + spec + D-G updated — phone playtests of the deploy must
produce coordinates); Q5 tuning freeze agreed (ping at open/close); Q6
importmap-bootstrap dedupe parked on ROADMAP (bullet added). Nothing blocks
apply except starting it; next session begins at task 0.1 (land v2 H.2 as
commit zero) per the tasks preamble.
**Refs:** -> Q1..Q6 (Answered), -> Task 0.2, -> D6, -> D7, v2 HANDOFF.md, ROADMAP.md

### 2026-06-10 -- Delegation refinement pass: APPLY-GUARDRAILS.md + anchored tasks + a real bug found
**Event:** decision + discovery
**What:** Gary asked whether a cheaper model (Opus/Sonnet) could implement this
change safely. Assessment: ~80% yes already (the deliberation's gates make
mistakes loud); refinement pass closed the rest. Shipped: (1)
**APPLY-GUARDRAILS.md** — one-page DO-NOT list, the literal gate ritual,
stop-and-report conditions, model routing (0.1 → Fable; 6.1/6.2 → Fable or
careful Opus 4.8; rest → Opus/Sonnet; /smart-review after group 2 and 8.1),
and a verified code-anchor table; (2) tasks.md rewritten with inline verified
file:line anchors + a "done =" criterion per task. **Discovery during anchor
verification (D8-worthy):** design/spec said hub-sandbox should copy
*sandbox.html's* `'three'` mapping — but sandbox.html deliberately maps
`'three'` to raw unpkg (sandbox.html:176 comment, no threeShim); it's
*index.html:101* that maps the shim. A skimming implementer would have built a
tier-divergent viewer whose acceptance test could never pass. Corrected in
design D-E, specs/layout-surfaces, task 6.2, and guardrail #9.
**Refs:** APPLY-GUARDRAILS.md, tasks.md (all groups), design D-E, -> Q1/Q3/Q4 answers baked into anchors

### 2026-06-10 -- Apply started; task 0.1 (v2 H.2) landed — the expected golden move did NOT happen
**Event:** discovery + phase-change
**What:** Commit zero landed (cross/dot rewrite of the roads.js detour side
decision — details in the v2 change's session-log, same date). The discovery:
the queryPoint golden this change freezes against did NOT move (`eddf8e50` →
`eddf8e50`) — the sequencing rationale (-> D7) assumed H.2 would move it before
snapshots were captured; instead a 5-seed/2,171-detour-edge probe proved the new
arithmetic decision-equivalent to the old atan2 one everywhere real, so the
freeze baseline is simply confirmed, not re-recorded. Browser POI hash recorded
for the first time (`4825fd0b`, Chromium — the accepted cosmetic fork class).
Also re-confirmed at apply start: node selftest at HEAD is 23/24 — the seed-0
road-negative-control teeth-loss documented in the v2 log (noneBelow=0.05
baseline, proven not-a-regression 2026-06-09) — so every "selftest passes" gate
in this change reads as "23/24 with ONLY that known miss; both hashes pinned."
**Refs:** -> Task 0.1, -> D7, v2 session-log 2026-06-10 entry, CHANGELOG 2026-06-10

### 2026-06-10 -- Group 1 instrument (1.1 dumpRegistry + 1.2 layout-snapshot) — capture is browser+node SPLIT
**Event:** decision + discovery
**What:** D-A reads "`bin/layout-snapshot` one command wrapping boot → start →
settle → dump → normalize → write." That literal reading is impossible: the
registry is populated by `chunks.js` running in a LIVE BROWSER scene; there is
no headless-node path and no browser driver in this no-build repo (checked:
node 24 present, no puppeteer/playwright, no node_modules). So capture is split
and the split is the honest architecture, not a shortcut: the BROWSER produces
the raw `dumpRegistry()` array (via the preview-MCP recipe, which `--recipe`/
`--seeds` print and DEBUGGING.md documents); `bin/layout-snapshot` is the
DETERMINISTIC NODE HALF (normalize → write → `--diff`). Two decisions baked in:
(1) **movers excluded** — `lurleen` + `hula_hoop` mutate position every frame
(actors, not layout); normalize drops them or the twice-capture self-diff could
never be empty (it dropped 3 in the seed-1234 spawn window). (2) **settle proxy
= registry entry count**, not chunk count — `__dbg.game` exposes `registry` but
not the chunk manager, and entry-count-stable is a faithful "this window's
chunks all loaded" signal. CONTROL PROVEN: two fresh captures of seed 1234
(spawn window, perf=high, no driving) → byte-identical normalized snapshots
(`--diff` EMPTY, 546 entries); negative control confirms the diff catches a
0.5m move. `round4` is JSON-format-noise insurance — identical builds already
yield identical floats. Also FIXED a bug my own 0.1 commit introduced: the
`## 2026-06-10` CHANGELOG header had overwritten `## 2026-06-09`, mislabeling
that day's shipped work (picnic tables / vendor straddle / arrival) under the
10th — header restored. Capture payload note: full-world dump is ~3k entries
(~500KB), over the preview-eval token cap — hub-window bounds keep it small
*and* match D-A's "deliberate snapshot windows," so window captures are the
norm. `verification/raw/` gitignored (reproducible scratch); `snapshots/` is
the committed baseline.
**Refs:** -> Task 1.1, -> Task 1.2, design D-A, DEBUGGING.md "Layout snapshots", -> A1 (movers/settle inform the grammar change's extraction)

> The three findings above were flagged by Gary as the "future reader can't
> reconstruct this" class and broken out below as atomic Event: discovery
> entries (the entry above is the in-the-moment integrated note).

### 2026-06-10 -- DISCOVERY: two registered kinds hold LIVE per-frame positions (movers in the registry)
**Event:** discovery
**What:** The registry isn't all static layout. `lurleen` ([lurleen.js:131](../../../src/lurleen.js#L131))
and `hula_hoop` ([obstacles.js:1169](../../../src/obstacles.js#L1169)) register
entries whose `position` is a REFERENCE that the actor mutates every frame
(registry.js header even names "drifting hula-hoopers"). I confirmed via a full
`registry.add(` sweep that those are the only two movers — all other registered
kinds (stages, trucks, booths, pottys, camps, trees, arches, lakes, roads/
path_nodes) are placed once and frozen. **Why it matters / forward implication:**
ANY built-truth consumer — `dumpRegistry` snapshots, the `--diff` control, and
the future grammar-change linter — must treat these two as ACTORS, not layout, or
it compares wandering positions and never converges. `bin/layout-snapshot`
normalize drops exactly this set; the linter (group 4) and the grammar change's
extraction inherit the same exclusion list.
**Refs:** -> Task 1.2, -> A1, registry.js:16 comment, festival-zone-grammar (linter exclusion)

### 2026-06-10 -- DISCOVERY: settle signal had to switch from chunk-count to registry-count
**Event:** discovery
**What:** D-A specifies settle as "loaded-chunk count stable for 60 frames."
But `__dbg.game` exposes `registry`, `crowd`, `zerble`, etc. — NOT the chunk
manager (verified: `Object.keys(__dbg.game)` has no `chunks`). So the literal
chunk-count signal isn't readable from the debug surface. Switched the settle
proxy to **`__dbg.dumpRegistry().length` stable** — a faithful substitute
because registry entries are added as chunks build and chunks never unload once
created (CLAUDE.md footgun #5), so a stable entry count means "this window's
chunks have all loaded." **Why it matters:** both the manual recipe AND the new
one-command `capture` settle-loop key off this; if a future change starts
unloading chunks, this proxy's "never decreases" assumption breaks and the
settle logic needs revisiting.
**Refs:** -> Task 1.2, design D-A (settle), CLAUDE.md footgun #5

### 2026-06-10 -- DISCOVERY→DECISION: built truth is browser-only; agent-browser makes capture genuinely one command
**Event:** discovery + decision
**What:** DISCOVERY: the registry is populated only by `chunks.js` in a LIVE
browser scene — there is no headless-*node* path (the worldgen modules run in
node, but the BUILD that fills the registry does not), and the repo has no
bundler/driver. So D-A's "one command wrapping boot→dump→write" can't be a pure
node CLI; capture is inherently browser(raw) + node(normalize). INITIALLY I
shipped that as a documented preview-MCP recipe + node normalize (1.1/1.2
commits). DECISION (Gary, this session): the globally-installed `agent-browser`
CLI (`/opt/homebrew/bin/agent-browser` 0.9.1 — NOT a repo dep) closes the gap:
`bin/layout-snapshot capture <seed>` now shells out to it (open → eval start →
poll-settle → eval dump → close → normalize → write) so it's genuinely ONE
command per the spec. Verified end-to-end: TWO independent cold headless boots
of seed 1234 → byte-identical layouts (`--diff` EMPTY), and that live snapshot
is byte-identical (layout + canary) to the manual-recipe baseline — i.e. the two
capture paths cross-validate each other. agent-browser handled the full ~500KB
payload (the preview-MCP eval can't — it token-caps), and object-return eval
emits clean single-encoded JSON. **The documented recipe stays as the approved
fallback** (Gary) for when agent-browser is absent/flaky — `capture` dies
pointing at `--recipe`. **Forward implication:** group 4's `bin/lint --seeds`
and group 8.1's baseline can now auto-capture across seeds without manual
MCP round-trips.
**Refs:** -> Task 1.2, design D-A, DEBUGGING.md "Layout snapshots" (one-command path), Gary 2026-06-10

### 2026-06-10 -- CORRECTION + DISCOVERY: chunks DO unload — which is what makes teleport-capture clean
**Event:** discovery
**What:** The 1.3/1.5 capture pass needed shoreline/dense windows that sit
~700–960m from the spawn hub. With the pinned "no driving" protocol, those
chunks NEVER GENERATE — only the spawn vicinity loads. So `capture` gained an
`--at x,z` flag that `__dbg.teleport`s to the window center before settling (a
debug jump, NOT driving — protocol-compliant). While verifying this I hit a
load-bearing contradiction: **CLAUDE.md footgun #5 says chunks "never unload
once created" — that is FALSE.** [chunks.js:345](../../../src/chunks.js#L345)
unconditionally unloads any chunk beyond `UNLOAD_RADIUS` (high tier = 3) from
the player, calling `_unload` → `registry.removeChunk` (chunks.js:376). My OWN
earlier settle-proxy entry (2026-06-10, "settle had to switch to registry-count")
inherited that wrong "never decreases / never unload" rationale from the
footgun. **The correction:** the registry-count settle proxy still works, but
NOT because the count is monotonic — it isn't. It works because a STATIONARY
player (no driving, post-teleport) produces no load/unload churn, so the count
goes flat once the current vicinity finishes building. And teleport-capture is
*clean* precisely BECAUSE far chunks unload: after the jump, spawn chunks drop
and only the teleport vicinity remains, so a `--bounds`-clipped dump is the
window's built truth, not spawn debris. Proven: 4 teleported-window self-diffs
EMPTY across 3 seeds (the unload+reload path is deterministic). **Forward
implication:** the grammar-change linter and any built-truth consumer must NOT
assume "every chunk ever generated is still in the registry" — only the current
load neighborhood is. Footgun #5's wording should be corrected project-wide
(flagged to Gary; out of THIS change's scope to edit CLAUDE.md).
**Refs:** -> Task 1.3, -> Task 1.5, chunks.js:340-348/376, CLAUDE.md footgun #5 (stale), prior 2026-06-10 settle-proxy entry (corrected)

### 2026-06-10 -- DISCOVERY: capture windows located from the worldgen plan in node, not eyeballed
**Event:** discovery
**What:** Task 1.5 says "locate windows via map-sandbox." Instead I derived all
nine windows DETERMINISTICALLY from the worldgen plan in node (it runs headless:
`setSeed` → `heartsInBounds`/`lakesInBounds`/`nearestMajorHeart`), which is more
rigorous and re-runnable than eyeballing a 2D canvas. Per seed: **spawn** = 300m
box on `nearestMajorHeart(0,0)` (the game's spawn-relocation target,
[main.js:232](../../../src/main.js#L232)); **shoreline** = 300m box on the heart
closest to a lake outline (gap 5–<radius m) so a hub + a shore share the frame
for the future `water-clear` rule; **dense** = 300m box (20m grid search ±800m)
maximizing heart-center count (the overlap-prone case). **Why 300m (±150):** the
high-tier load ring is a 5×5 chunk square (±200m), so a ±150 window fills fully
from one jump with margin — bigger windows leave empty corners. The chosen
centers/bounds are recorded per-file in verification/MANIFEST.md (so re-capture
is exact) along with the derivation rule (so the *method* is reproducible, not
just the numbers). **Forward implication:** 1.6 `gotoHub` should reuse the same
`nearestMajorHeart`/`heartsInBounds` selection so its hub indices line up with
these baseline windows; group-4 lint `--seeds` can auto-pick the same windows.
**Refs:** -> Task 1.5, -> Task 1.6, hearts.js (heartsInBounds/nearestMajorHeart), water.js (lakesInBounds), verification/MANIFEST.md
