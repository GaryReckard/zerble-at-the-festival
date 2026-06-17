# Deliberation Briefing: Procedural Map Generator (pre-implementation)

## Task
Stress-test the plan for the `procedural-map-generator` OpenSpec change **before**
implementation. The change builds a deterministic, render-agnostic infinite-world
**layout generator** plus a dedicated **2D top-down Canvas sandbox** to develop and
tune it — explicitly deferring all 3D-game integration to a later change. Goal of
this deliberation: surface tensions, validate (or break) the key design decisions,
and produce unified Change Groups to fold into `tasks.md`.

Read these before forming an opinion:
- `openspec/changes/procedural-map-generator/proposal.md`
- `openspec/changes/procedural-map-generator/design.md` (decisions D1–D11)
- `openspec/changes/procedural-map-generator/specs/world-layout-generator/spec.md`
- `openspec/changes/procedural-map-generator/specs/worldgen-2d-sandbox/spec.md`
- `openspec/changes/procedural-map-generator/tasks.md`
- `CLAUDE.md`, `.claude/rules/*.md` (tripwires), and skim `ROADMAP.md`.

## Context
- **OpenSpec Change**: `openspec/changes/procedural-map-generator/`
- **Subsystem(s)**: world-streaming (new, parallel to chunks/forests/lakes),
  sandbox-harness (new 2D page), determinism (rng.js reuse). NOT touching the live
  3D render pipeline, crowd, or audio in this change.
- **Files affected (planned)**: new `src/worldgen/` module set (no `three` import),
  new `map-sandbox.html` + driver (Canvas 2D), possible helper additions to `rng.js`.
- **Origin**: an `/opsx:explore` thread on making festival paths "more sensible" —
  the squirrely uniform grid, stages-on-roads, no intentional structure.

## The specific tensions to stress-test
1. **Determinism / order-independence (the core risk, footgun #4).** Design D4 uses
   **edge/pair-seeded shared features** (a road crossing a region edge, a river
   between two lakes seeded by the feature's own identity) and explicitly REJECTS
   the "neighbor generates first and hands its ports forward" idea as order-dependent.
   Does edge/pair-seeding actually hold byte-identical across unload/reload and under
   `?seed`? Where could order-dependence sneak back in (e.g. proximity-graph edges
   that depend on a third point outside the window, float non-associativity, curve
   tangents at seams)?
2. **Render-agnostic generator + 2D Canvas sandbox as single source of truth**
   (D1/D2/D11) for a FUTURE 3D world + map view. Is the data-only boundary real, or
   will the 3D port need data the 2D model didn't capture (heights, collider radii,
   facing)? Is Canvas 2D the right call vs three.js ortho?
3. **Central-place heart hierarchy** (D3: rare rank-weighted hearts; mega occupies a
   2×2 block). Does it actually avoid a "grid-of-festivals" at the macro scale, or
   does one-heart-per-macrocell just push the lattice up a level? Is the heart
   distribution (the stated make-or-break knob) tunable enough?
4. **Road consistency across the infinite plane** (D5 perpendicular seam-crossing,
   D6 generous proximity-graph lookup radius). Is the lookup-radius approach sound,
   or is there a cleaner guarantee? Seam kinks?
5. **Rivers/bridges coupling** (D7, built last). Right call to defer within the
   change, or should they be cut to a separate change entirely?
6. **Scope cut**: is "generator + 2D sandbox only, 3D integration deferred" the right
   boundary, or is the 2D detour a risk of building something that doesn't survive
   contact with the 3D game / chunk lifecycle?

## Constraints (the tripwires — non-negotiable)
- No build step; a new src/ module goes in the cache-buster importmap list of any
  page that loads it (here, the new `map-sandbox.html`).
- ES module namespaces are frozen — no `THREE.X = Y` after import (N/A here: the
  sandbox is Canvas 2D, not three.js — but flag if that assumption is wrong).
- iOS audio inits synchronously inside the start gesture (N/A here; no audio).
- **Determinism is load-bearing** — don't reorder/re-salt existing `rng()` calls;
  reuse `hash2`/`worldHash`/`mulberry32` rather than forking the seeding scheme.
- Lakes omit `chunkKey` on purpose; shared pooled resources tagged
  `userData.shared = true` must not be disposed (relevant to the FUTURE 3D port).
- Per-tier perf budgets (N/A to 2D Canvas, but the future 3D port + the generator's
  per-pixel cost when drawing kilometers are worth a glance).
- A new model is not done until it has a sandbox entry (N/A — this IS a sandbox).
- **Sandbox-pass ≠ game-pass** — the eventual 3D integration must boot clean; does
  the 2D plan set that up to succeed or to surprise us later?

### Note on council composition
Profiler and Auditor were deselected for fit (Canvas-2D/no-three.js → low perf risk;
no-build + CHANGELOG hygiene already baked into tasks.md). Architect: please absorb
module-boundary/hygiene concerns. Pragmatist: please absorb effort/critical-path and
any perf-of-the-generator concern.

### Your Output
Write your full deliberation to: `[OUTPUT_PATH]`
Return a brief summary to the orchestrator containing: your Verdict, Key Concern, and
3 bullet points.

### Your Task
1. Propose your prioritized order of operations for this task.
2. Identify risks/concerns from YOUR perspective.
3. Identify anticipated tensions with other approaches where they genuinely exist.
4. Write your full output to the file path specified above.
