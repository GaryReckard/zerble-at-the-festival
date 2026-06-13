---
change: worldgen-layout-harness
status: in_progress        # not_started | in_progress | blocked | paused | complete
current_task: "Group 5 (map-sandbox overlay + gallery) COMPLETE — 5.1 true-extent layer (exact snapshot + analytic envelopes), 5.2 point-inspector naming, 5.3 ?gallery=N contact sheet, 5.4 plan-mode lint badges. Remaining in change: group 7 (playtest markers), 8.2 ROADMAP trim, 8.3 final smoke. Grammar-unblock milestone met since 8.1."
blocked_by: null
open_questions: 0
started: 2026-06-10
last_updated: 2026-06-13
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

- **D8 — Hoist scope boundary (group 2, task 2.1).** `tuning.js` holds the
  CROSS-CLUSTER arrangement surface (the planner's dancefloor bases, stage-scale
  coeffs, walk distances, cluster counts, drum band, nudge ring, village grid,
  `KIND_FOOTPRINT`) + the per-cluster builder ring/spacing/offset/count constants
  D-B names (food-court ring, vendor-row spacing/offset/camper, camp-village
  packing). EXCLUDED with reasons (guardrail #2 + D-B "out"): (a) the *legacy*
  theme builders `buildVendorRow`/`buildFoodPlaza`/`buildCampVillage` hold the
  SAME numbers but are a different owner — left as literals, do NOT merge
  (`buildFoodPlaza` was missed in the first inventory pass and caught during the
  chunks.js rewire when `ring + 2.5` matched twice); (b) `buildStage`'s own
  audience/chair/light sub-layout is the stage cluster's BODY, not inter-cluster
  spacing — and its `dancefloorDepth=9*scale` is a different owner than the
  planner's `DANCEFLOOR_DEPTH_BASE=38` (do NOT merge); (c) `ANGLE_BINS`,
  `DRY_PROBES`, `MAX_POI_REACH`, `SALT.*` are determinism/structural machinery,
  not tunable arrangement. Full inventory with old file:lines lives in the
  tuning.js header comment (the 2.1 deliverable).

## Assumptions

| # | Assumption | Confidence | Status | Resolution |
|---|-----------|------------|--------|------------|
| A1 | The worldgen builders' rng draws can all be moved into pure layout fns without changing draw order (incl. conditional draws in retry loops) | Med | open | Verified per-builder by D2's snapshot diff |
| A2 | `registry.closestBuilding` guards inside builders depend on cross-chunk build order, so lint-time reproduction is approximate — acceptable for a linter | Med | open | Council round 001 to pressure-test |
| A3 | A perspective top-down via existing camLock is sufficient (no ortho camera plumbing) | High | open | Revisit only if seam-checks prove unreadable |

## Dangling Threads

- Marker hotkey final binding (`m` vs `k`) — resolve against input.js/debug.js/touch.js at build (-> Task 7.1).
- ~~Whether `gotoHub` should print that hub's lint violations once lint lands (design open question).~~ Resolved 2026-06-13 — yes; -> Task 4.6 wires plan-mode lint into `gotoHub(n)` (console `[lint]` lines + a `· lint:` summary on the return string).
- **Hub-viewer acceptance (6.3) is N=1** — faithfulness proven only at seed 1234's spawn hub. The clusterSeed-independence argument is general, but before `festival-zone-grammar` grades against the hub viewer, widen the diff to 2–3 more seeds (cheap: capture viewer + game dumps, run the chunkKey-agnostic compare from `reviews/hub-acceptance-6.3.md`). *(adversarial review 2026-06-13)*
- **`arch-placement` fires on ~100% of seeds** — a global "arch system wrong" flag, not a per-hub discriminator. After the grammar fix it should drop to ~0; if it doesn't, the `ARCH_MIN_STAGE_DIST` (30 m) threshold is miscalibrated, not the placement. Watch in the grammar before/after. *(adversarial review 2026-06-13)*
- **`drum-in-trees` registry count depends on capture-window completeness** — tightly-bounded snapshots clip edge trees → possible false positives (caveated in `baseline.md`). If the grammar change needs exact counts, capture those seeds at full load-ring. *(adversarial review 2026-06-13)*

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

### 2026-06-10 -- DISCOVERY: seed-type parse footgun caught my seed-1234 windows in the WRONG world
**Event:** discovery
**What:** Booting `gotoHub(0)` (task 1.6) under `?seed=1234` framed a hub at
(318,-93), but my node window-finder had placed seed-1234's spawn window on
(261,-96). Root cause: `?seed=` parses a **pure-digit** string as a NUMBER but
everything else as a STRING HASH ([main.js:76](../../../src/main.js#L76),
`/^-?\d+$/`). `setSeed('1234')` (string → FNV `4257489661`) and `?seed=1234`
(number `1234`) build DIFFERENT worlds. My finder used the string `'1234'`, so
its three windows were located in the FNV world while the captures (driven by
the `?seed=1234` URL) built the number world — the shoreline/dense windows
landed on arbitrary ground, and spawn was off-center. The two hex seeds
(`0xf7ef2a3c`/`0xf7ef2a3d`) fail the digit regex, so node and browser both
string-hash them — those six windows were already correct. **Fix:** re-derived
seed-1234's windows with the browser-faithful parse
(`/^-?\d+$/.test(raw) ? Number(raw) : raw`) and re-captured all three + the
self-diff control + the Noon/Midnight pair (the new shoreline genuinely
straddles a lake: lake_edge 170 / shore 2 alongside stage 14 / truck 13). The
mistaken windows were committed in af32d85 and corrected the same day.
**Forward implication:** the group-4 lint `--seeds` and group-8.1 baseline
locate windows in node too — they MUST mirror this parse, or pure-digit seeds
silently diverge from the running game. Noted in MANIFEST.md "Seed-type footgun".
This is also why "boot the game and demonstrate" is non-negotiable: the node
finder and the self-diffs were internally consistent and EMPTY — only the live
game exposed the world mismatch.
**Refs:** -> Task 1.5, -> Task 1.6, main.js:76 (seed parse), rng.js setSessionSeed, af32d85 (corrected), verification/MANIFEST.md

### 2026-06-11 -- Group 2 commit A: tuning.js + planner rewire, gated EMPTY
**Event:** phase-change (hoist begun) + decision (commit split)
**What:** Tuning freeze announced OPEN to Gary, then landed the FIRST of the
two hoist commits. Commit A = create `src/worldgen/tuning.js` (the 2.1
inventory baked into its header + the `FESTIVAL_TUNING` mutable CONFIG +
`setFestivalTuning` + `MODEL_DIMS` + `clusterExtent`) and rewire the PLANNER
(`festival.js`) to read it, + importmap in the three live html files
(hub-sandbox doesn't exist yet — group 6). Split rationale: commit A = planner
(positions), commit B = builder (`chunks.js` model variation + the drift
asserts). Splitting localizes any snapshot drift to one half — D-B explicitly
allows "one or two commits"; two is safer for a golden-frozen change. The
planner change is proven value-identical the strongest possible way: the POI
golden hashes every descriptor's kind/x/z/yaw/footprint/fbin/scale, and it did
NOT move (`01532955`), so the plan is byte-identical by construction; the
registry snapshot diff (full built world, incl. per-cluster draw canary) was
EMPTY across 5 windows / 3 seeds as belt-and-suspenders. Both `?worldgen=1` and
`?worldgen=0` boot clean (zero console errors). 2.1 ticked; 2.2 stays open
until commit B (its done-line wants zero literals at the chunks.js sites too).
**Refs:** -> Task 2.1, -> Task 2.2, -> Task 2.3, -> D8, design D-B, src/worldgen/tuning.js, src/worldgen/festival.js

### 2026-06-11 -- Group 2 commit B: builder rewire + drift guard; hoist COMPLETE, freeze CLOSED
**Event:** phase-change (group 2 done)
**What:** Second hoist commit. `chunks.js` worldgen builders (`buildFoodCourtAt`,
`buildVendorRowAt`, `buildCampVillageAt`) now read `FESTIVAL_TUNING.*`; a
one-shot localhost drift guard (`assertTuningDrift` in `buildWorldgenKind`)
warns if `MODEL_DIMS` drifts from the live model exports. **Surprise caught:**
`buildFoodPlaza` (the LEGACY food court) is a third do-not-merge twin I missed
in the 2.1 inventory — surfaced when `ring + 2.5` matched twice in the rewire.
Rewired only the worldgen `*At` sibling; added buildFoodPlaza to the excluded
inventory (tuning.js header + -> D8). Literal audit: `14*FOOD_TRUCK_SCALE`,
`MIN_SPACING = 5.5`, `spacing = 5.0` each now appear exactly ONCE — in their
legacy builder only. Builder change is the test the POI golden can't do (it
hashes the plan, not the build); the registry snapshot — which captures
build-half model variation — diffed EMPTY × 5 windows / 3 seeds incl. canary,
both flags boot clean, no drift warning. Tuning freeze CLOSED. Group 2 done in
two commits (D-B's "one or two"); next is the group-2 `/smart-review` milestone
(APPLY-GUARDRAILS), then group 4 linter → 8.1 baseline (grammar-unblock).
**Refs:** -> Task 2.2, -> Task 2.3, -> D8, src/chunks.js buildWorldgenKind, 4419cb3 (commit A)

### 2026-06-12 -- Group-2 /smart-review milestone DONE (Fable): Approve with changes; P1 → Task 2.4
**Event:** phase-change + discovery
**What:** The APPLY-GUARDRAILS group-2 review milestone ran as `/smart-review` in a
Fable session (satisfies the routing table's "smart-review or a Fable session") on
`2ded863..26a540d`. Four specialists (gameplay, performance, sandbox, docs) in one
parallel batch; rendering/audio skipped (nothing owned in the diff). **Verdict:
Approve with changes.** The hoist itself is verified value-identical — every constant
spot-checked old-literal vs tuning field, zero rng-order change, legacy twins
untouched, importmap wired in all three live html files, perf/lifecycle clean.
**The discovery (P1, orchestrator-confirmed against live files):** the stage-scale
hoist landed PLANNER-ONLY — `buildStage` (chunks.js:2309–2311) still draws scale from
literals while the new comments (festival.js:105–109, tuning.js:121) claim both halves
read `FESTIVAL_TUNING.STAGE_SCALE_*`. Values identical today (goldens legitimately
passed), but the first 6.4 slider tune of STAGE_SCALE_* would desync plan vs build
(D3.3) — and the comments now say it's safe. Folded back as **-> Task 2.4** (rewire
the draw; stays buildStage's first ctx.rng() call, so zero rng-order change; full 2.3
gate ritual; optionally widen the drift-guard hostname gate, chunks.js:1181, in the
same commit). Lesser findings: P2 ROADMAP step-(1) hoist bullet not trimmed (+
pre-existing stale `__dbg` bullet — sweep both in a docs commit); P3 the 2.3 gate
record never logged the "HUD budgets unchanged" observation (this entry doesn't cure
that — record it during 2.4's ritual). One docs ambiguity resolved benign via git:
commit A's CHANGELOG bullet did NOT prematurely name buildFoodPlaza; commit B amended
it. Artifacts: reviews/001-group2-tuning-hoist/ (review-summary.md,
specialist-findings.md, diff.patch).
**Refs:** -> Task 2.4, -> D8, reviews/001-group2-tuning-hoist/review-summary.md, APPLY-GUARDRAILS "Model routing"

### 2026-06-12 -- Task 2.4 (review P1) code complete; BLOCKED on browser gates (no tooling in session)
**Event:** blocker + phase-change
**What:** Wrote the P1 fix from reviews/001 (Opus 4.8). `buildStage`'s scale draw
(chunks.js:2319-2321) now reads `FESTIVAL_TUNING.STAGE_SCALE_*` like the planner's
`stageScaleOf` already did — the comments (festival.js:104-109, tuning.js:121) that
claimed "both read tuning / one source" are now TRUE, and their stale line-refs were
corrected (2279/2273 → 2319/2309). Also widened the dev-only drift-guard hostname gate
(chunks.js:1181) from `^(localhost|127.0.0.1)$` to the repo's canonical `isLocal`
predicate (adds 0.0.0.0/.local/10./192.168/172.16-31/claude-preview/happycog) so the
guard actually fires under the preview host — review P3, same commit.
**Gate status — the two browser-free gates PASS:**
  1. node selftest: pass=false (the SOLE pre-existing fail = "road negative control
     (seed 0)", confirmed identical with-edits vs stashed-HEAD), goldens UNCHANGED
     queryPoint `eddf8e50` / poi `4825fd0b`. festival.js+tuning.js edits are
     comment-only and chunks.js isn't imported by selftest, so the plan is provably
     untouched.
  2. Build-half value-identity proof (node): `FESTIVAL_TUNING.STAGE_SCALE_*` ===
     1.15/0.25/1.0/0.5 byte-equal to the old buildStage literals (Object.is), and the
     diff preserves the single `ctx.rng()` draw in its exact position → scale value
     byte-identical → every downstream registry field (sphereR=2.5*scale, collider
     cols×rows count, stage_front pos + attractorR=14*scale, chair-band positions,
     clumpCount/chairsInClump rng-consumption order) byte-identical.
**BLOCKER:** gates 2-4 of the APPLY-GUARDRAILS ritual need a live browser
(snapshot dumpRegistry, boot-smoke both flags, HUD budgets). THIS session has NO
preview MCP, NO `agent-browser`, NO headless Chrome — so they could not be run.
Per the DO-NOT-rationalize clause, the change is NOT committed and 2.4 is NOT ticked
on a construction argument alone. Code is staged in the working tree, ready.
**REMAINING-GATE RECIPE (next preview-enabled session — dev server on :8765):**
  - Snapshot (gate 2), per canonical spawn window (bounds from verification/MANIFEST.md):
      `node bin/layout-snapshot capture 1234 --bounds 168,-243,468,57 --tier high --window spawn`
      then `node bin/layout-snapshot --diff verification/snapshots/1234.spawn.json <fresh>`  → must be EMPTY (incl. draw canary).
      Repeat: `0xf7ef2a3c` bounds `-444,-394,-144,-94`; `0xf7ef2a3d` bounds `-583,323,-283,623` (both spawn, no teleport).
      (No `agent-browser`? Use the preview-MCP manual recipe: `node bin/layout-snapshot --recipe <seed> spawn`.)
  - Boot smoke (gate 3): `?worldgen=1` AND `?worldgen=0` → start → ~3s → console clean
      (no TypeError/Reference/shader); confirm NO `[tuning drift]` warn (the widened
      guard now actually runs under the preview host — that's the point).
  - HUD budgets (gate 4): backtick overlay, draws/tris unchanged vs HEAD (no game-path
      geometry added — only a dev console.warn + a value-identical literal swap).
  Then: CHANGELOG bullet (drafted in review-summary.md §Suggested), tick Task 2.4,
  commit code + CHANGELOG together.
**Refs:** -> Task 2.4, -> reviews/001-group2-tuning-hoist/review-summary.md (P1+P3), APPLY-GUARDRAILS "gate ritual"

### 2026-06-12 -- Task 2.4 BLOCKER CLEARED: all 4 gates ran headless (agent-browser) → SHIPPED
**Event:** phase-change (blocker resolved)
**What:** Gary installed `agent-browser` + playwright in the session, clearing the
~~"no browser tooling"~~ blocker from the prior entry. Ran the full APPLY-GUARDRAILS
ritual headless and committed 2.4.
  - **Gate 1 (selftest):** goldens UNCHANGED `eddf8e50` / `4825fd0b` (the SOLE fail is
    the pre-existing road-neg-control seed 0, identical with-edits vs HEAD).
  - **Gate 2 (built-world snapshot, 3 canonical seeds, spawn windows):** ALL EMPTY incl.
    the per-cluster draw-count canary — `1234` 842 entries / 18 canary keys, `0xf7ef2a3c`
    514 / 11, `0xf7ef2a3d` 318 / 16. Clipped counts settled to the EXACT MANIFEST
    baselines (842/514/318) before capture. This is the real gate for the build-half
    change and it's byte-identical.
  - **Gate 3 (boot both flags):** `?worldgen=1` AND `?worldgen=0` boot clean — ZERO
    `error`-level console messages; every warning is the headless-only `[chunk slow]`
    perf timing (SwiftShader software-GL is slow); crucially NO `[tuning drift]` warn, so
    the widened guard ran and MODEL_DIMS is in sync. worldgen=0 generated 5813 entries fine.
  - **Gate 4 (draws/tris):** the per-cluster draw-count canary (gate 2) IS the worldgen
    draw count and was byte-identical; the diff adds zero geometry (a literal→named-const
    swap + a dev `console.warn`). The live HUD per-frame counter is NOT readable here —
    forcing one full-scene `renderer.render()` wedges SwiftShader for >2min (which is
    exactly why the canary instrument exists). Canary + no-geometry diff = gate satisfied.
  **Headless capture method (reusable, worth recording):** the full game at `perf=high`
  saturates headless SwiftShader so the RAF render loop never yields and CDP `eval` hangs.
  Fix = force `document.hidden=true` via an `--init-script` (defineProperty getter), which
  flips the game onto its `setTimeout(16ms)` loop (main.js:1093) so the main thread yields
  between ticks and eval lands. `bin/layout-snapshot capture` dies on agent-browser's
  load-wait timeout (the page loads fine; the 'load' event is just slow), so drive the
  steps manually: `eval --json '(dumpObj)'` → `jq .data.result` → `bin/layout-snapshot
  <seed> --stdin --tier high --window spawn` → `--diff` vs the committed baseline.
**Refs:** -> Task 2.4, -> reviews/001-group2-tuning-hoist/review-summary.md, CHANGELOG 2026-06-12, main.js:1093, bin/layout-snapshot

### 2026-06-12 -- Doc-hygiene close-out + POI-golden V8-fork discovery
**Event:** discovery + decision
**What:** Audited what the 2.4 run left undocumented and codified two learnings
(commit 7449590) + closed the review's ROADMAP debt:
  - **POI golden is a V8-VERSION fork, not node-vs-browser.** Running
    `runSelfTest()` here returned poi `4825fd0b` — the value selftest.js records
    as "browser", NOT the recorded "node" `01532955`. Cause: this box's Node is
    v24 (V8 ~12.x), which now matches Chromium; the older node that recorded
    `01532955` was a different V8. Both are accepted and `poiGoldenHash` is
    informational (never pushed as a hard-fail — only the queryPoint golden +
    the road-neg-control are). Clarified inline in selftest.js so the next agent
    doesn't read `4825fd0b` as a moved golden. (My 2.4 CHANGELOG cites
    `4825fd0b`; the group-2 entry cites `01532955` — same dual-recorded golden,
    different engine, both correct.)
  - **Headless-capture method** codified in DEBUGGING.md "Layout snapshots"
    (document.hidden init-script + manual eval→jq→--stdin; the draws/tris HUD is
    unreadable while hidden so the draw canary is the gate-4 instrument).
  - **ROADMAP** (review P2/P3): marked the FESTIVAL_TUNING hoist step-1 + the
    group-1 `__dbg` verbs as shipped; parked "teach `bin/layout-snapshot
    capture` to survive headless boxes"; noted dry-run builders deferred to
    festival-zone-grammar (D6).
  Group 2 (+2.4) fully closed and documented. Next is group 4 (layout linter).
**Refs:** -> Task 2.4, commit 7449590, selftest.js POI golden comment, DEBUGGING.md "Layout snapshots", ROADMAP

### 2026-06-13 -- Group 4 (layout linter) COMPLETE + gated (Opus 4.8)
**Event:** phase-change (group 4 done)
**What:** Built out the linter (4.1-4.6). `src/worldgen/lint.js` plan rules
existed from the wip commit; this work added registry mode (the PRIMARY one),
the `bin/lint` CLI, gotoHub wiring, importmaps, and the gate. Two genuinely
non-obvious findings that shaped the design:
  - **The link seed must be DECIMAL, not the 0x… hex.** Both main.js
    (`initSessionSeed`) and map-sandbox (`resolveSeed`) resolve `?seed=` as
    `/^-?\d+$/.test(raw) ? Number(raw) : FNV(raw)`. The wip lint.js emitted
    `seed='0x'+(seed>>>0).toString(16)` into the deep-links — a hex string that
    FNV-hashes to a DIFFERENT world on reopen (and `(seed>>>0)` on a hex STRING
    seed → 0). Fixed: links carry `String(seedNum)` (the numeric session seed in
    base-10), which round-trips through the number path to the exact same world.
    Verified: link decimal 1658821542 → 0x62df9ba6 == the capture seed. The
    displayed `violation.seed` stays hex for readability.
  - **Registry kinds are SUB-COMPONENTS, not plan kinds.** A `food_court` plan
    cluster builds many `truck` registry entries; a `vendor_row` builds `tent`
    entries (the booths) + `campsite` (campers). So the 4.5 "truck×vendor-booth"
    acceptance is a `truck × tent` overlap in registry terms. The allowed-pairs
    whitelist + scenery-exclude were GROUNDED IN MEASURING the 3 canonical seeds
    (script over the committed snapshots): stage-deck = many `stage` tiles, the
    spawn arch = 6 `arch` colliders, drum circle nests `firepit` in `bench_ring`
    → same-cluster, allowed; `forest_tree`(~520/window)/`lake_edge`(~117)/shore/
    path_node/lamppost = scenery, excluded. Everything else firing is real signal.
**Verification (group 4 is NOT golden-frozen — no game-path rng/geometry added):**
  - Gate 1 selftest: goldens UNCHANGED `eddf8e50` / `4825fd0b` (sole fail = the
    pre-existing road-neg-control seed 0). lint.js is read-only + not on the build
    path; gotoHub is console-only.
  - Registry mode verified in PURE NODE against the committed snapshots (no game):
    `0xf7ef2a3c.spawn` → overlap fires tent×truck 5.8m (ACCEPTANCE), plus
    booth-on-road×8, dancefloor-clear×2. Plan `bin/lint --seeds 10` runs instantly.
  - Gate 3 boot smoke (agent-browser headless, document.hidden trick): `?worldgen=1`
    AND `?worldgen=0` at seed 1234 boot clean — zero errors (only `[chunk slow]`
    SwiftShader perf warns); worldgen=0 generated 5780 entries. lint.js loading into
    the game module graph (main.js import) is itself proven by `__dbg.start()` working.
  - 4.6: gotoHub(0)@1234 → "· lint: 3 (overlap)" + console "[lint] hub (1,-1):
    overlap×3" with teleport links.
  - 4.5 screenshot: in-game at 0xf7ef2a3c, teleport(-377,-262)+topDown+showFootprints
    shows the visible booth/truck jumble (reviews/acceptance-4.5-truck-tent-overlap.png).
    The hub3d link form (sandbox.html?entity=hub_preview) awaits the group-6 viewer.
  ROADMAP "Layout linter" bullet marked shipped (matching the group-1 ✓ pattern);
  full 8.2 trim sweep still pending. **Grammar-unblock milestone is now groups 1+2+4
  done — only task 8.1 (baseline) remains to unblock festival-zone-grammar.**
**Refs:** -> Task 4.1-4.6, -> Task 8.1, CHANGELOG 2026-06-13, src/worldgen/lint.js, bin/lint, DEBUGGING.md "Layout linter", APPLY-GUARDRAILS "gate ritual" (group 4 not golden-frozen)

### 2026-06-13 -- Task 8.1 baseline DONE → GRAMMAR-UNBLOCK MILESTONE MET
**Event:** phase-change (milestone)
**What:** `verification/baseline.md` recorded from REGISTRY mode at perf=high over
10 seeds. **This completes the grammar-unblock milestone (groups 1+2+4+8.1) —
festival-zone-grammar is now unblocked.** Results: 106 error / 92 warn —
overlap 48, water-clear 58, booth-on-road 74, dancefloor-clear 10,
potty-attached 8; worst single clip = seed 1234 tent×truck 7.5m. The plan-vs-
registry gap is itself informative (plan overlap 632 vs registry's exact 48 —
plan's cluster circles over-count because they include stage dancefloor
clearings; registry is the real sub-component clip count). RECORD-not-fix.
**Capture method (worth recording — the unbounded dump was the bottleneck):**
First attempt dumped the WHOLE loaded neighborhood (~3000-4200 entries/seed) and
ran ~180s/seed → 560s timeout after only 3 seeds. Fix that cut it to ~30-60s/seed:
(1) **bound the dump** to a ±280m spawn-hub box — found per-seed by calling
`__dbg.gotoHub(0)` and parsing its "@ (x,z)" return (works even for far spawn hubs,
e.g. seed 42's at (955,716)); (2) cap the settle poll at 6 reads; (3) batch in
groups of ~4 under the timeout. The 3 original seeds kept their full-load-ring
windows (more hubs) — so the doc shows per-seed SOLID counts + a window caveat,
and leans on the penetration-sorted worst-offenders list (exposure-independent)
as the actionable view. 10 snapshots committed under
verification/snapshots/baseline/ so `bin/lint <file>` reproduces every row.
Screenshots (in-game topDown+showFootprints; group-6 hub viewer will render
natively): baseline-offender-{1234,31337,0xf7ef2a3d}.png — the first two are
booth-clips-truck, the third a truck-ring-too-tight, two distinct failure modes.
ROADMAP: festival-zone-grammar "gate now MET" note updated; full 8.2 trim sweep
still pending. Next: 8.2/8.3 close + fast-follows 5/6/7 (hub viewer first per CG3).
**Refs:** -> Task 8.1, -> Task 8.2, -> Task 8.3, CHANGELOG 2026-06-13, verification/baseline.md, ROADMAP "Festival layout" gate note

### 2026-06-13 -- Task 4.7: two new lint rules from Gary's playtest (drum-in-trees + arch-placement)
**Event:** decision (Gary-directed) + phase-change
**What:** Gary's 2026-06-12 playtest found two arrangement classes the original
8 rules miss, requested as task 4.7 (added to tasks.md §4). Implemented both in
lint.js:
  - **drum-in-trees** (error, plan + registry): the LEAF drum circle must sit in
    a treed pocket AND not inside another cluster's envelope. Trigger: a drum
    spawned INSIDE a food-truck circle — plain `overlap` misses it (benches nest
    between trucks, no collider clash). Registry counts real `forest_tree`
    colliders within DRUM_TREE_RADIUS; plan uses the `treeDensity` field (no built
    trees). The envelope check uses clusterExtent for food_court/vendor_row but
    the DIRECTIONAL dancefloorRect for stages (a radial stage extent falsely
    flagged drums BEHIND a stage — refined after first run, 9→8).
  - **arch-placement** (error, registry-only — the arch isn't a plan descriptor;
    festival.js emits none, it's built in main.js): over a road, outside every
    dancefloor rect, ≥ ARCH_MIN_STAGE_DIST from the stage.
  Thresholds (DRUM_TREE_RADIUS/MIN/MIN_DENSITY, ARCH_MIN_STAGE_DIST) live in
  FESTIVAL_TUNING per Gary — value-neutral (no build path reads them; goldens
  eddf8e50/4825fd0b UNCHANGED, boot clean). Both fire on REAL baseline seeds
  (registry drum-in-trees=8, arch-placement=21 — arch fires on ~every seed since
  it lands ~15·scale off-road in the lit dancefloor today). baseline.md got an
  APPENDED "2026-06-13" block; the original 8 rules' counts untouched. Spec
  (layout-linter) + DEBUGGING.md updated. RECORD-not-fix — both are
  festival-zone-grammar's to fix (DRAFTING-BRIEF already cites the drum case).
**Refs:** -> Task 4.7, CHANGELOG 2026-06-13, src/worldgen/lint.js, FESTIVAL_TUNING, verification/baseline.md (appended block), festival-zone-grammar/DRAFTING-BRIEF.md

### 2026-06-13 -- Group 6.2: hub viewer renders (buildHubPreview + hub-sandbox.html)
**Event:** phase-change
**What:** The missing middle surface — one whole festival hub in 3D on a flat
plane, built through the EXACT game code. `buildHubPreview(scene, heart, {crowd,
lakes})` (chunks.js) iterates `festivalPlan(heart)` (NOT chunk-clipped — the whole
hub) + camp villages within MAX_POI_REACH, through the same `buildWorldgenKind`
dispatch. The faithfulness key: `buildWorldgenKind`'s rng is `mulberry32(clusterSeed)`
— chunk-INDEPENDENT — so a cluster builds byte-identically whether the game spreads
it across chunks or the viewer builds it all at once. Two non-obvious wiring points:
  - **crowd parked at the hub.** A real Crowd is passed (never omit — crowd.spawn
    draws from the cluster rng + early-returns on pool exhaustion, the tier-dependence
    from D6). First run spawned 22 then the frame loop's `crowd.update(dt, dummyZerble)`
    CULLED them to 0 because the dummy player sat at (0,0,9999), far from the hub —
    NPCs out of range get dropped. Fix: park dummyZerble at the heart on each build.
  - **no Sound.init.** buildStage/drum call `Sound.attachStageMusic`, which returns a
    DEFERRED no-op handle when the AudioContext is null (sound.js) — so the viewer
    needs no audio init and doesn't crash. Confirmed.
  hub-sandbox.html: own importmap with `'three'`→threeShim (index.html's mapping,
  guardrail #9 — NOT sandbox.html's raw unpkg, so materials match the game),
  OrbitControls, TimeOfDay presets, 700m ground, `?seed=&hub=`/`?at=x,z`,
  `window.__hubSandbox` door. Verified headless: seed 1234 hub 0 → spawn hub
  (1,-1)@(318,-93), 96 objects, full festival renders, `?at=` resolves, 0 errors.
  buildHubPreview is viewer-only (not on the game path) → game boot + goldens
  unaffected; 6.1's disposeChunkByKey is the rebuild teardown (feeds 6.3).
**Refs:** -> Task 6.1, -> Task 6.2, -> Task 6.3, CHANGELOG 2026-06-13, src/chunks.js buildHubPreview, hub-sandbox.html

### 2026-06-13 -- Group 6 (hub viewer) COMPLETE
**Event:** phase-change
**What:** All of 6.1-6.7 shipped (careful-Opus; Fable was unavailable, gates are
the safety net). 6.1 disposeChunkByKey (golden-frozen, snapshot diff EMPTY ×3
teleported windows). 6.2 buildHubPreview + hub-sandbox.html (renders a whole hub
via the exact build path). 6.3 acceptance: spawn-hub stage deck matches the game
21/21 tiles, 81 festival sub-components matched, every diff explained (window≠hub
+ the main.js arch + lake-load timing), 10-rebuild leak check 172×10 identical.
6.4 live FESTIVAL_TUNING sliders (rebuild on release; ring-mult visibly moved the
trucks). 6.5 bin/check-importmaps (catches a dropped module, names file+module).
6.6 docs (CLAUDE.md hub row + no-build four-files + sandbox-and-testing + worldgen
README). 6.7 Noon/Midnight screenshots + clean game boot both flags.
**The one surprise (Gary-reported mid-flight):** the hub viewer crashed a few
seconds in — `crowd._updateNpc` reads zerble.forwardWorld, but the frame loop's
dummy player only had position/pos. The crash only appeared AFTER 6.2's "park the
dummy at the hub" fix (which stopped NPC culling) brought NPCs close enough to
trigger the smile path. Fix: a COMPLETE zerble stub (forwardWorld/heading/speed/
seatSlots:[]→no boarding/worldSeatPosition) + smiles.update to drain emitted
smiles. Lesson for the grammar change: a viewer that reuses crowd.update needs
the full zerble shape, not a minimal stub.
**Refs:** -> Task 6.1..6.7, CHANGELOG 2026-06-13, hub-sandbox.html, src/chunks.js (buildHubPreview/disposeChunkByKey), bin/check-importmaps, reviews/hub-acceptance-6.3.md

### 2026-06-13 -- Group 5 (map-sandbox true-extent overlay + seed gallery) COMPLETE
**Event:** phase-change
**What:** Built 5.1-5.4 entirely inside `map-sandbox.html` (pure dev surface —
no src/ change, so both goldens are definitionally untouched, confirmed
eddf8e50/4825fd0b). Two non-obvious points worth recording:
  - **The exact overlay is seed-gated by NUMERIC session seed, not the string.**
    A snapshot's filename/`seed` field is the RAW seed string ("1234" /
    "0xf7ef2a3c"); the map's seed input holds the same string. But a hex string
    FNV-hashes (0xf7ef2a3c → 1658821542) while a decimal string parses as a
    number — so comparing strings would mostly work but is fragile. I store
    `snapshot._num = seedNumOf(snapshot.seed)` (a setSeed→getSeed→restore helper,
    side-effect-free) and gate the exact layer on `_num === getSeed()`. Same
    seed-parse footgun the group-1 capture + group-4 links hit; the overlay
    inherits the fix rather than re-tripping it.
  - **Gallery lint uses PLAN mode on purpose (5.4) — no boots.** `runLint({seeds,
    bounds})` is pure (sets+restores the session seed), so a 12-tile contact
    sheet computes 12 lint passes with zero game boots. Counts are PLAN-mode
    (approximate, over-counts overlap vs registry — baseline.md tracks that gap),
    which is the right precision for a relative across-seeds glance; the header
    labels them approximate. Progressive fill = paint tile synchronously, then
    setTimeout(0) the lint so the tile shows before its badge.
  Verified headless (agent-browser, canvas-2D so no SwiftShader issue): extent
  overlay at 0xf7ef2a3c shows the vendor-booth grid interpenetrating the
  food-court trucks (5.1 acceptance), inspector named a `tent r=2.2m (exact)`
  (5.2), gallery=12 painted 12 tiles with lint badges + tile-click navigated
  to the full-map deep-link (5.3/5.4), and the analytic-only fallback (extent on,
  no committed snapshot for the seed) drew envelopes + a clear status line.
  Console clean on every load. check-importmaps clean (tuning+lint already in
  `wg` from groups 2/4). Remaining: group 7 (markers), 8.2 ROADMAP trim, 8.3
  final smoke — then verify + smart-review (Gary's stated plan).
**Refs:** -> Task 5.1..5.4, CHANGELOG 2026-06-13, map-sandbox.html, src/worldgen/{tuning,lint}.js (consumed, not changed)
