# Deliberation Briefing: What should the next performance work be, especially for iPads?

**Tier 3, debate mode.** Round 1 is written in isolation. Round 2 follows.

## Task

Gary (solo developer) asks the council to review everything that has been
done, researched, built and planned to improve this game's performance, and to
decide **what would most significantly improve performance next, especially on
iPads**. Produce a prioritized, evidence-grounded order of operations. Say what
to do, what to stop doing, and what must be measured before committing.

This is a strategy deliberation. Do not write or edit application code. You
may read any file in the repository and run read-only commands.

## Context

- **Project Charter**: `openspec/council/charter.md` (read the Non-Negotiables
  and your own Persona Notes subsection). Note that the charter's "no build
  step / importmap" text is stale: Gary approved Vite on 2026-10-29
  (`.claude/rules/no-build.md`, `docs/toolchain.md`). Workers and a bundler are
  now technically available.
- **Shared project rules**: `AGENTS.md`, `.claude/rules/performance.md`,
  `.claude/rules/perf-pooling.md`.
- **Roadmap (pending performance work)**: `ROADMAP.md` section "Performance".
- **Backlog with evidence status**: `docs/backlog/performance.md`, including
  the table "November 11 review: unmeasured candidates".
- **Evidence bundles** (each has a README; newest are most relevant):
  - `verification/performance/2026-11-07-ipad/` (first physical-iPad capture)
  - `verification/performance/2026-11-08-ipad-child-density/` (fixed-route
    iPad baseline with per-subsystem world timing)
  - `verification/performance/2026-11-11-far-field-publication/` (the latest fix)
  - `verification/performance/2026-11-07-structural-options/` (structural
    rewrites investigated and declined)
  - `verification/performance/2026-11-05-optimization/`,
    `2026-11-06-terrain-sampling/`, `2026-11-03-lab/`,
    `2026-11-02-render-load/`, `2026-10-22/`, `2026-10-08/` to `2026-10-21/`
- **Prior performance changes and councils**:
  `openspec/changes/perf-pass-4/`,
  `openspec/changes/repeatable-performance-lab/`,
  `openspec/changes/structural-performance-redesign/` (two councils, ended
  with no selected rewrite), `.claude/deliberations/001-perf-unresponsive-fixes/`.
- **Device procedure**: `docs/performance-playtests.md`, `DEBUGGING.md`.
- **Key source**: `src/main.js` (frame loop), `src/world.js`, `src/chunks.js`,
  `src/farField.js`, `src/crowd.js`, `src/perf.js` (tier table),
  `src/adaptiveQuality.js` (Auto governor), `src/contextLights.js`,
  `src/debug.js` (capture), physics via `@dimforge/rapier3d-compat`.
- **Specs**: `openspec/specs/perf-tiers`, `render-pipeline`, `world-streaming`,
  `crowd-ai`, `ambient-backdrop`, `lighting-and-time-of-day`.

## Factual digest (verify anything you rely on against the files)

**What has shipped for performance**, roughly in order: three early passes
(shadow-caster audit, pooling, post-process gating, tier table); pass 4 (true
draw measurement, crowd allocation pooling, bloom gating, forest-tree
instancing, fog far-cull); the June unresponsive-page fixes (shader error
checks off, live spatial grid, fixed light pool); the October 8 audit fixes
(render-target sizing, empty bubble pass, lake index, shadow policy, road
cache, shared streaming deadline); October 22 bloom/Trip pre-preparation and
registry index maintenance; the November 2 render-load fixes; a repeatable
performance lab with fixed-route autopilot and device capture upload; November
5 child pooling and presentation instancing; November 6 terrain sampling
reuse; and the November 11 far-field publication change that prepares the
horizon in bounded pieces.

**What was investigated and declined**: broad model geometry merges (rejected
by a real-GPU gate, draws rose); ground-support certificates, explicit
registry publication, static booth transform flags, and shopkeeper part
batching (November 7, none reached the nomination threshold on desktop);
three-mesh-bvh and lookAt caching (won't-do).

**Physical iPad evidence** (iPadOS 18.7.8, Safari 18.7.5, exact hardware model
unknown, detected Low tier, quality policy Auto):

| Capture | Parked FPS (median) | Driving FPS (median) | Quality reached | Draws (median) | Worst driving world interval |
| --- | ---: | ---: | --- | ---: | ---: |
| Nov 7, human-driven, 1,558 m | 34 before, 40 after | 29 | `pixel-50`, bloom off, shadows off, 675×462 | 514 parked, 710 driving | 357 ms retained exact frame, 451 ms window max |
| Nov 8, autopilot route, 641 m | 29 before, 26 after | 25 | ended at `pixel-50` | 1,023 parked, 1,025 driving | 424 ms, of which 423 ms was `farField` |

Further recorded facts from those captures:

- Retained ordinary driving frames show total main-loop work of about 22–31 ms,
  with the world-update timer at about 0–2 ms and the CPU-side render timer at
  about 5–9 ms. The backlog records that roughly 13 ms per frame lies outside
  render and world with no device breakdown.
- Every one of the largest retained world intervals on November 8 was
  attributed to far-field work (424, 323, 155, 136, 122, 120, 119 ms while
  driving; 1,421 ms during settling).
- Ordinary chunk generation peaked at 31–41 ms per chunk on the device.
- Low-tier settings include `crowdMax: 180` and `pixelRatioCap: 1.25`; the HUD
  budget for Low is 80 draws / 150k triangles.
- The October 22 phone comparison (Low tier) recorded Auto at `pixel-50` with
  median 57 FPS and Sustained at 1.09–1.25 DPR with median 58 FPS.

**Status of the November 11 far-field fix**: byte-identical output proven for
120 published horizons; offline Node timing on an M4 Pro shows the worst
driving call falling from 61–176 ms to 3–33 ms; one cold festival or woodland
plan remains a single 15–30 ms unit on the M4. **No browser, GPU or iPad
result exists for it yet.** The October 22, November 5 and November 6 changes
are likewise still awaiting device verification.

**Unmeasured candidates already on record** (from the backlog table): stop the
horizon at the fog limit; render directly when bloom and Trip are both off;
per-tier context-light pool; freeze static chunk subtrees; budget chunk
unloads; give lake builds the streaming deadline; cheaper terrain cache keys;
attribute iPad game-update time. Also parked: Web Workers for worldgen
(byte-identical probe exists), splitting hot chunk builders, distant cluster
instancing/LOD, HUD budget recalibration, texture/mesh compression.

You are not limited to that list. Propose anything the evidence supports.

## Constraints

From the charter Non-Negotiables and `AGENTS.md`:

1. Determinism is load-bearing: never reorder or re-salt existing `rng()`
   draws; memoized worldgen arrays are shared truth.
2. Patch Three.js only through `src/threeShim.js` (frozen module namespaces).
3. iOS audio initializes synchronously inside the start gesture.
4. Lifecycle and disposal safety: lakes omit `chunkKey`; never dispose
   `userData.shared` resources; registry mutations are not transactional.
5. Collider truth stays synchronous with chunk admission.
6. Tier policy: Low has shadows off and the Lambert fallback; verify graphics
   changes on Low and Mid, not just High.
7. Sandbox pass is not game pass; every change needs a full-game boot smoke.
8. Player copy never reveals Easter eggs or hidden flags.
9. Desktop or Node measurements never establish a device result. Software-
   rendered FPS is not a device measurement.
10. Population, terrain, physics and simulation behavior were treated as
    protected in the November 7 investigation. If you propose relaxing any of
    them, say so explicitly and justify it.
11. Gary is the only person who can run a physical-iPad capture. His time on
    the device is the scarcest resource.

### Your Output

Write your full deliberation to: `[OUTPUT_PATH]`

Write the file early and update it as you go, so that partial work survives an
interruption. Return a brief summary to the orchestrator containing: your
Verdict, your Key Concern, and 3 bullet points.

### Your Task

You are working in isolation. You cannot see the other positions, so any
tension you name would be a guess. Do NOT speculate about other personas, and
do NOT write an Anticipated Tensions section.

1. Propose your prioritized order of operations for this task.
2. Identify risks and concerns from YOUR perspective.
3. Give a verdict (Proceed | Proceed with mitigations | Block) with your
   single Key Concern.
4. Write your full output to the file path specified above.

Cite evidence for every project-specific claim (file path and line, evidence
file, or command output). Remove claims you cannot cite.
