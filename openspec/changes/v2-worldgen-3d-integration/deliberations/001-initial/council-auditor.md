## Auditor's Position

Mechanical code-quality + convention sweep of the `v2-worldgen-3d-integration`
plan, grounded in the artifacts and the current `src/`. All findings cite a
file:line, a decision (`D-x`), or a task number.

### Priority Sequence

The plan's migration order (proposal.md "Migration Plan", tasks 1–11) is sound
from an audit lens, but I'd hard-gate it with mechanical checkpoints. My
ordering, with the conventions wired in *up front* rather than at the end:

1. **Importmap-in-BOTH first, before any wire-in (task 3.2).** Add all 8
   `src/worldgen/*` modules to the `mods` array in BOTH `index.html`
   (lines 87–89) and `sandbox.html` (lines 177–179). Today **neither** lists
   any worldgen module — only `map-sandbox.html` references them (via the `wg`
   array, lines 26–28, AND direct `import` statements, lines 103–106). The
   moment `chunks.js` imports `worldgen/index.js`, the cache-buster stops
   decorating those URLs on dev and edits silently stop reloading. Do this in
   the scaffolding phase, not as cleanup. Add `placement.js` to the same arrays
   in the same commit it's created (task 3.3).
2. **Decide and document the shared road-material policy before task 4.1.**
   D-D says roads "reuse... the shared road material" — but **there is no
   shared road material today** (see Quality Deficiencies). Resolve this before
   writing road-ribbon code, because the wrong choice is a dispose-storm
   footgun, not a cosmetic one.
3. **Determinism salt registration (task 9.1, but enforced from task 3.3 on).**
   Reserve `placement.js`'s jitter salt(s) as a named constant in the same
   `0x4D41_xx` worldgen `SALT` namespace (constants.js:66–76) the day the
   module is created, with a header comment asserting no-collision — don't
   leave salt selection to the moment scatter code is written.
4. **Roads → Lakes → Forests → Themes → Crowd** (tasks 4–8), each ending in a
   boot smoke test (sandbox-pass ≠ game-pass) and a backtick budget read at
   `?perf=low`/`?perf=mid`.
5. **CHANGELOG/ROADMAP discipline applied per-phase, not batched (tasks 1.4,
   11.1, 11.2).** Task 1.4 already correctly demands a same-commit CHANGELOG
   for the 2D road refinement — replicate that bar on every player-visible
   phase, not just the final landing.
6. **Final mechanical sweep (tasks 9–10):** golden re-check both engines,
   shadow-caster count not walked back, full per-tier budget pass, smart-review.

### Quality Deficiencies Found

- **No shared road material exists — D-D's premise is false as written.**
  `placePaths` allocates a fresh `new THREE.MeshStandardMaterial` per chunk
  (chunks.js:617). There is no module-scope `ROAD_MAT`/`DIRT_MAT`. The only
  module-scope path material is `_forestPathMat` (forests.js:330), and it is
  **NOT tagged `userData.shared`** (confirmed: only references are the
  declaration at :330 and two `buildCurvedPath` call sites :359, :632). D-D
  (task 4.1) says roads will "reuse the dirt material, shared" — that material
  doesn't exist yet, and the obvious candidate to promote (`_forestPathMat`) is
  an untagged dispose landmine. **Severity: High.** If task 4.1 hoists a
  module-scope road material reused across many chunk-keyed road meshes and
  forgets the `userData.shared = true` tag, the first chunk unload disposes it
  via the chunks.js walk (chunks.js:344–351), and every other chunk's road mesh
  forces a shader recompile next frame — the exact recompile-storm footgun #6
  warns about. The plan must (a) create the shared road material, (b) tag it
  `userData.shared = true`, and (c) ideally also tag the pre-existing
  `_forestPathMat` while it's in the neighborhood (scope-completeness — same
  pattern, same risk).

- **`placement.js` / road-junction code has no defined sandbox surface for
  the 3D path, and "done" is ambiguous.** The road junction-merge (tasks 1.1–
  1.3) correctly lands in `map-sandbox.html` (the worldgen-layout sandbox) —
  that's the right home, and task 1.3 names the seed-1234 screenshot proof.
  Good. But `placement.js` (the role→theme mapping, D-B/task 3.3) is pure data
  with no entity geometry of its own, so the per-entity `sandbox.html` checklist
  doesn't directly apply to it — yet the *result* of placement (anchors,
  scatter) is only observable in the running game (task 7.x) or, partially, in
  `map-sandbox.html`'s `wouldHost()` inspector it's promoted from. **Severity:
  Medium.** Recommendation: state explicitly in tasks that `placement.js`'s
  verification surface is (1) the `map-sandbox.html` role/`wouldHost` inspector
  for the *decision* and (2) the booted game for the *geometry* — and that any
  NEW road/junction *mesh* (not the data) that gets its own builder DOES need a
  `sandbox.html` entry per the new-model checklist (proposal.md Impact already
  flags this, but tasks.md doesn't enumerate it). Don't let "the 2D sandbox
  renders it" stand in for the per-entity checklist if a new mesh builder lands.

- **Tasks omit the explicit "add `placement.js` to BOTH importmaps" step.**
  Task 3.2 covers `src/worldgen/*`; task 3.3 creates `placement.js` *inside*
  `src/worldgen/`, so it's arguably covered — but the most common variant of
  footgun #1 is updating one list and forgetting the other, or adding a module
  and forgetting it's a *new* file needing a *new* entry. **Severity: Low.**
  Make 3.3 say "...and add `worldgen/placement` to the `mods` array in BOTH
  html files." Belt and suspenders on the exact footgun the project calls its
  most common.

- **`buildForestTree` returns a `Group`, but the return-shape footgun is
  re-armed by D-F's scatter rewrite.** The briefing and CLAUDE.md both cite the
  `{group,color,footprint}` vs bare `Group` crash that hung the title card.
  `buildForestTree(rng)` is called bare (forests.js:859, returns a Group used
  directly). D-F (task 6.1) moves tree scatter into the per-chunk path in
  `chunks.js`. **Severity: Medium (process, not a defect yet).** The plan
  must verify the new chunk-side scatter extracts the same return shape
  `forests.js` does — and the only way to catch it is the mandatory boot smoke
  test through `buildWorld → ChunkManager._generate → placement` (tasks 3.4,
  10.3), which the plan does include. Flagging it so it's not skipped.

### Mechanical Assertions

| Check                          | Status        | Notes |
| ------------------------------ | ------------- | ----- |
| Importmap in BOTH html files   | FAIL (today) / PLANNED | Today: 0/8 worldgen modules in `index.html` mods (87–89) or `sandbox.html` mods (177–179); only `map-sandbox.html` has them (wg array 26–28). Task 3.2 fixes this. `placement.js` add not separately enumerated (task 3.3) — Low risk, flag it. |
| Sandbox entry complete         | CONDITIONAL   | Junction-merge → `map-sandbox.html` (task 1.3) ✓. `placement.js` is data, no per-entity entry needed, but ANY new road/junction *mesh* builder needs a `sandbox.html` entry (proposal Impact flags it; tasks.md doesn't enumerate). |
| userData.shared tagging        | AT RISK       | Disposal walks (chunks.js:344–351, lakes.js:663–674) correctly skip `.shared`. New pooled road material under D-D MUST be tagged. Pre-existing `_forestPathMat` (forests.js:330) is module-scope **untagged** — fix while in scope. tree.js pool correctly tagged (tree.js:33,37,44,48,52). |
| castShadow discipline          | PASS (planned)| tree.js already gates crowns to lowest tier only (tree.js:171–185, 257–271); D-F/task 6.1 reuses these models unchanged. Roads `receiveShadow=true` only (chunks.js:725) — no caster added. No reflexive caster in the plan. Hold at 56 (task 9.3). |
| InstancedMesh needsUpdate      | N/A → WATCH   | Roads are ribbon `BufferGeometry`, not instanced (chunks.js:671–728). Forest scatter today is per-Group (forests.js:859), not instanced. D-J *mentions* "InstancedMesh where the current forest uses it" — if D-F introduces instancing for tree scatter, every matrix write needs `instanceMatrix.needsUpdate = true` (footgun #7). Not in current code path; flag for task 6.1. |
| Determinism (fresh salt)       | PASS (planned)| worldgen `SALT` block (constants.js:66–76) is a clean `0x4D41_xx` namespace, explicitly non-colliding with lakes/forests (comment :63–65, rng.js:99–101). chunks.js salts (STYLE=0xC4FE7B2A, SPAWN_JUG=0x5A17B0BB, POTTY=0x9E3779B1, theme=1) are distinct. D-H/task 9.1 commits to fresh salts. **Requirement:** `placement.js` jitter salt must be a NEW named constant, not reuse any of these. |
| CHANGELOG/ROADMAP in commit    | PASS (planned)| Task 1.4 (2D refinement) + 11.1 (v2 headline) demand same-commit CHANGELOG ✓. Task 11.2 trims ROADMAP "wire the generator into the live 3D world" bullet (ROADMAP.md:14) ✓. Enforce per-phase, not batched at the end. |

### Verdict

- **Verdict**: Proceed with mitigations
- **Key Concern**: D-D's "reuse the shared road material" rests on a material
  that doesn't exist (chunks.js:617 allocates per-chunk), and the obvious
  promotion candidate `_forestPathMat` (forests.js:330) is module-scope but
  **untagged `userData.shared`** — so the road wire-in (task 4.1) is one
  forgotten tag away from the chunk-unload dispose-storm footgun #6 explicitly
  warns about.
- **Recommendation**: Proceed — the plan is conventions-aware and the migration
  is correctly phased + flag-gated. Gate it on five mechanical mitigations:
  (1) create + `userData.shared`-tag the road material in task 4.1 and tag the
  pre-existing `_forestPathMat` in the same pass; (2) move the worldgen importmap
  additions (incl. `placement`) to the front, in BOTH html files, in the
  scaffolding commit (task 3.2/3.3); (3) reserve `placement.js`'s jitter salt as
  a named `0x4D41_xx` constant the day the module is created; (4) if D-F
  introduces InstancedMesh tree scatter, assert `instanceMatrix.needsUpdate`
  per write; (5) enumerate in tasks.md that any NEW road/junction *mesh* builder
  gets a `sandbox.html` entry per the new-model checklist, and that the booted
  game (not the sandbox alone) is the verification of placement's return-shape
  contract.
