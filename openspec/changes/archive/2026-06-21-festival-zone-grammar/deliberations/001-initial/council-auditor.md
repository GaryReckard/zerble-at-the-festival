## Auditor's Position

My lens is mechanical correctness and convention compliance: will every commit
of this plan pass a rigorous review against the project's hard rules? I audited
the gate ritual, importmap/no-build completeness, pooling + `userData.shared`
dispose-safety through the layout/mesh split, `castShadow`/`InstancedMesh`
discipline, the D8 "two owners → legal merge" claim, the single-golden-move
determinism discipline, and CHANGELOG/ROADMAP same-commit hygiene. The plan is
unusually well-instrumented: the harness already shipped the gate, and I
verified it on disk.

### Priority Sequence

The plan's group ordering (0→8) is correct from my domain and I would not
resequence the macro-phases. The extraction MUST precede the placement change
so the only golden-moving commit is the deliberate one (design D1/D6) — that is
the single most important sequencing fact and the plan honors it. My refinement
is *within* the groups, to harden the gate ritual:

1. **0.1 gate-reproducibility FIRST, as a hard precondition.** Before any
   edit, prove the "before" reproduces: `bin/lint verification/snapshots/baseline/<seed>.json`
   must match `verification/baseline.md` (106 error / 92 warn). I confirmed all
   10 snapshots exist and all 10 carry `drawCounts` (the canary), so this is
   runnable today. If the baseline does not reproduce bit-for-bit, STOP — the
   measuring stick is broken and nothing downstream is gateable.
2. **Group 1 extraction, easy→hard, one builder per commit, EMPTY-diff-gated.**
   Order `buildVendorRowAt` (1.1) → `buildFoodCourtAt` (1.2) → `buildCampVillageAt`
   (1.3) → `buildStage` (1.4) → small builders (1.5) → model param splits (1.6).
   `buildStage` (1.4) is the trap commit (the `Math.random()` transcription) and
   belongs late, after the pattern has settled on three lower-risk builders.
3. **Group 2 crowd pre-roll + env widen.** The tier-equality assertion (2.1:
   identical normalized layout at `?perf=low` and `?perf=high`) is the proof
   obligation; it must pass before extents are promoted, because tier-dependence
   pollutes every later snapshot comparison.
4. **Group 3 extents promoted but READ-ONLY** (not yet consumed by placement) —
   goldens stay frozen.
5. **Group 4 — THE golden move**, all in one commit: slotting + re-record +
   node==browser re-verify + cosmetic path records. Nothing else in this commit.
6. **Groups 5→6→7→8** (registry backstop → burndown → verify both tiers/both
   flags → close with CHANGELOG/ROADMAP). Group 7.1's both-tier/both-flag boot is
   non-negotiable (sandbox-pass ≠ game-pass).

### Quality Deficiencies Found

- **Gate-artifact path drift in the briefing/docs — LOW (doc-only, but verify-blocking if trusted literally).**
  The briefing and `proposal.md:26` / tasks 0.1 reference
  `verification/baseline.md` as the harness change's artifact, but it actually
  lives at repo-root `verification/baseline.md` (tracked; commit `ecbd9af`), and
  the snapshots at `verification/snapshots/baseline/*.json` — NOT under
  `openspec/changes/worldgen-layout-harness/verification/`. The harness change
  folder has no `verification/` dir at all. The plan is sound and the artifacts
  exist; this is only a stale path. Fix: task 0.1 should cite the real repo-root
  path so a future agent doesn't conclude the gate is missing and skip it.

- **`worldgenDrawCounts` keying collides on co-located same-kind clusters — LOW/MEDIUM (canary blind spot).**
  The canary writes `worldgenDrawCounts.set(\`${d.kind}@${Math.round(d.x)},${Math.round(d.z)}\`, _draws)`
  (chunks.js:1226). The key is `kind@roundedX,roundedZ`. Two clusters of the same
  kind that quantize to the same rounded meter — far more likely once *slotting*
  packs zones tightly than under the old scatter — would overwrite each other's
  draw count, and the canary would silently under-report. This is an extraction-
  era safety net the grammar commit then stresses harder. Mitigation: during
  group 1, confirm the canary key is unique per cluster (e.g. include
  `clusterSeed` or `role`/`rank` in the key) BEFORE relying on it across groups 1–3.

- **`drawCounts` cluster-count equality is necessary but not sufficient for "EMPTY diff" — LOW (gate-strength).**
  The snapshot tool normalizes and diffs both entries and `drawCounts`
  (`bin/layout-snapshot`), and the canary catches a *changed total draw count
  with identical positions* (design "Extraction perturbs draw order invisibly").
  Good. But the failure mode the extraction must guard is draw-order perturbation
  that nets the *same* per-cluster total — e.g. two cosmetic draws swapped within
  one builder. The canary tallies per-cluster totals, not per-draw ordering, so a
  same-count reordering inside one cluster passes the canary yet could shift a
  downstream model variant. The R19 design (model variation rides `clusterSeed`,
  not `ctx.rng` — festival.js:26-29) bounds the blast radius to *within* one
  cluster, which is acceptable, but the plan should state explicitly that
  intra-cluster draw ORDER is held by code review per commit, since the canary
  alone won't catch it.

### Mechanical Assertions

| Check                          | Status        | Notes |
| ------------------------------ | ------------- | ----- |
| Importmap in FOUR html files   | PASS (likely) | Plan expects NO new modules — extraction splits functions *within* existing files (chunks.js, festival.js, crowd.js). proposal.md:26 commits to all-four + `bin/check-importmaps` IF a module appears. If group 1.6 ever hoists a `pickXParams` into a NEW `src/` file, gate it on `bin/check-importmaps`. |
| Gate ritual per extraction     | PASS          | Snapshot tool + per-cluster `drawCounts` canary exist (`buildWorldgenKind` chunks.js:1207-1226; `bin/layout-snapshot` normalizes+diffs both). 10 baseline snapshots present, all carry `drawCounts`. EMPTY-diff-per-commit is enforceable today. |
| Single deliberate golden move  | PASS          | D6 + task 4.2: POI golden moves ONCE (group 4), re-recorded, node==browser re-verified; queryPoint golden frozen; spur/drum paths are COSMETIC PATH RECORDS not roads.js arterials (task 4.3) — keeps queryPoint input unchanged. All of groups 1–3 keep both goldens frozen. Clean. |
| userData.shared preserved      | PASS w/ watch | 65 `userData.shared` tags across 16 files incl. all touched models (tent, foodTruck, sugarShack, campsite, puppet, portaPotty, picnicTable, bubbleVendor/Jug). Tagging lives in the MESH half (design Risk "Disposal"). The layout/mesh split must keep every tag on the buildMesh side — verify per builder in group 1; a tag that migrates into the pure `layout` half is dead (no three.js there) and the resource reverts to per-call alloc + dispose storm. |
| castShadow discipline          | PASS w/ watch | Audit holds at 56 casters. Touched models already disciplined (tent 2, foodTruck 2, sugarShack 10, campsite 8, puppet 4); chunks.js has 1. Behaviour-preserving extraction must TRANSCRIBE existing `castShadow` flags, not re-derive them. No new casters expected (slotting adds no geometry — design Risk "Perf budget"). |
| InstancedMesh needsUpdate      | PASS w/ watch | 30 `instanceMatrix.needsUpdate` sites; InstancedMesh users incl. campsite, sugarShack, leafDrumCircle, crowd. Extraction must keep every write→`needsUpdate=true` pairing intact when a build loop is split into `pickParams`/`buildMesh`. A dropped flag shows as frozen instances (CLAUDE.md #7). Verify visually in the hub viewer per builder. |
| Determinism (no reorder/resalt)| PASS          | festival.js header (17-41) documents the fixed per-heart rng stream + R19 clusterSeed discipline. D2 crowd pre-roll is the one risky move: `crowd.spawn` (crowd.js:338) draws ~10 rng()/NPC with a zero-draw early return at pool exhaustion (`if (this.free.length === 0) return null`, line 339). Pre-rolling count+seeds into layout records and consuming them draw-free in buildMesh is the CORRECT fix (it also removes tier-dependence). Proof obligation: task 2.1 tier-equality at low vs high. |
| D8 two-owners → legal merge    | PASS (verify) | tuning.js:91-105 lists the "do NOT merge yet" pairs: `DANCEFLOOR_DEPTH_BASE=38` (tuning.js:118, festival.js:92) vs buildStage's internal dancefloor literal; the legacy `buildFoodPlaza`/`buildVendorRow`/`buildCampVillage` twins (left as literals). Task 3.1 unifies the dancefloor pair as part of promoting extents. The merge becomes LEGAL here because world drift is expected and golden-gated. Audit obligation: confirm the unified constant produces the SAME number both owners read today BEFORE group 4 (in groups 1–3 the merge must be value-preserving — a diff in group 3 would mean the "same number" claim was false). |
| CHANGELOG/ROADMAP in commit    | PASS          | Task 8.1 splits it correctly: extraction commits (groups 1–2) are behaviour-preserving → dev-workflow/internal CHANGELOG (or skip per the refactor rule); the grammar commit (group 4) is player-visible → required entry. ROADMAP "Festival layout" trimmed (8.2), deferring per-truck customization + the V2 flip. This matches `.claude/rules/changelog-and-roadmap.md`. Caveat below. |

### CHANGELOG severity calibration (one nuance)

The extraction commits (groups 1–2) are *behaviour-preserving by construction*
(EMPTY snapshot diff), so they are genuinely the "internal refactor with no
observable behavior change" case where the changelog may be skipped — BUT D2
(crowd pre-roll) closes the harness-R2 tier-dependence, which IS observable: the
shipped low/mid worlds change to agree with high. That is a player-visible
behavior change living inside an "extraction" group. It warrants a CHANGELOG
entry (Fixed: "crowd layout no longer differs by perf tier"), not a skip. Task
8.1 should call out 2.1 specifically as the one extraction-group commit that is
player-visible.

### Scope completeness — the registry-clearance restore (D5)

design D5 / task 5.1 restores per-sub-component `registry.closestBuilding()`
with bounded retry/skip in the mesh half. The repeated pattern already lives at
chunks.js:489 (`free` helper), 1047 (tree guard), 1163 and 1277 (cluster guard,
in BOTH `placeWorldgenProps` AND `buildHubPreview`). Scope obligation: the
restore must touch every builder that places sub-components blind (vendor row,
food court, camp village, potty bank), AND the hub-viewer build path
(`buildHubPreview`, chunks.js:1273-1284) must stay diff-faithful to the game
path — they share `buildWorldgenKind`, so a clearance check added to one builder
automatically reaches both, which is the right architecture. Confirm no
clearance check leaks into the pure `layout` half (D5 is explicit: mesh-half
only, since `layout` has no live registry).

### Verdict

- **Verdict**: **Proceed with mitigations.**
- **Key Concern**: The draw-count canary key (`kind@roundedX,roundedZ`,
  chunks.js:1226) can collide for co-located same-kind clusters and silently
  under-report draws — exactly the regime slotting creates. Harden the canary key
  to be unique-per-cluster (include `clusterSeed`/`role`) during group 1, BEFORE
  relying on EMPTY-diff gating through groups 1–3.
- **Recommendation**: The gate is real and on disk (10 baseline snapshots with
  `drawCounts`, the canary wired into `buildWorldgenKind`, the snapshot tool
  diffing both entries and counts), the single-golden-move discipline is
  correctly sequenced (extraction before placement; queryPoint frozen via
  cosmetic path records), and pooling/`castShadow`/`InstancedMesh`/importmap
  conventions are all addressed. Three mitigations gate "proceed": (1) harden the
  canary key against collisions; (2) fix the stale `verification/baseline.md`
  path in task 0.1 and reproduce the 106/92 baseline before editing; (3) the D8
  dancefloor merge (task 3.1) must be value-preserving in group 3 (any group-3
  diff falsifies the "same number" claim), and D2's tier-dependence fix (2.1)
  gets its own player-visible CHANGELOG entry rather than being folded into the
  silent-refactor exemption.
