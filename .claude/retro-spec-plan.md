# Retroactive Capability Specs — master plan

**Goal:** give every future agent a thorough, accurate lay of the land by
populating `openspec/specs/` — the canonical "what the system does today" source
of truth that OpenSpec is built around but which has never existed in this repo.

**Status:** ✅ COMPLETE 2026-06-17 — all 20 capability specs authored in
`openspec/specs/` (+ `models/CATALOG.md`, `special-modes/NOTES.md`, `README.md` index);
config.yaml `specs_index` refreshed; the two complete changes archived; ARCHITECTURE.md
+ config.yaml drift fixed (see below); self-consistency sweep passed (every requirement
has ≥1 scenario, no format typos).

**Decisions (from Gary):**
- **Taxonomy:** full decomposition (~20 capabilities), not config.yaml's coarse 9.
- **Format:** Requirement/Scenario specs for behavioral systems + prose companions
  (`CATALOG.md` / `NOTES.md`) where that shape is awkward (model catalog, the trip
  Easter egg, tuning tables).
- **Existing change folders:** reconcile their deltas into `openspec/specs/`, AND
  archive the two genuinely-complete changes (`procedural-map-generator`,
  `worldgen-layout-harness`) into `openspec/changes/archive/`. Leave the two
  in-progress ones (`v2-worldgen-3d-integration`, `festival-zone-grammar`) in place.
- **Verification:** inline tracing — every requirement cites `file:line` or observed
  behavior as it's written; final self-consistency sweep. No spawned review agents.

## The core gap

There is no `openspec/specs/`. Every spec is a *delta* trapped inside an in-flight
change folder, and all 10 existing deltas are worldgen-only. The entire pre-OpenSpec
game (carts, audio, crowd, feedback, render, perf, camera, input, HUD, models) has
zero spec coverage. Two jobs:

1. **Promote + reconcile** the 10 worldgen deltas into canonical specs, resolving
   "Deferred this change" stubs (rivers/bridges/mega-hearts) against what shipped,
   and fixing the v2-is-now-default reality.
2. **Author from scratch** for everything else, traced to code.

## Accuracy hazards (ARCHITECTURE.md is a guide, not gospel)

ARCHITECTURE.md predates recent work and has drifted. Confirmed stale points to
reconcile against code/git:
- Says worldgen v2 is "OFF by default" — `9af5959` made it the **default**.
- Omits `starPower.js`, `birds.js`/`bird.js`, `spatialGrid.js`, `adaptiveQuality.js`,
  `contextLights.js`, `midiPlayer.js` (partially), and ~8 model files
  (`bubbleJug`, `bubbleVendor`, `frisbeePlayer`, `hulaHooper`, `picnicTable`,
  `portaPotty`, `shrub`).
- Predates: star-power buff, NPCs sitting at picnic tables, sparkles/tire-tracks.

**Rule:** trace every requirement to `file:line` or observed behavior. Cite or cut.

## Capability taxonomy (20) + coverage matrix

Every `src/**` file maps to exactly one owning capability (cross-cutting consumers
noted in parentheses). This matrix is the completeness backstop.

### Core engine
| Capability | Owns | Notes |
|---|---|---|
| `render-pipeline` | `main.js` (loop+composer), `threeShim.js` | renderer→composer→passes, tier-aware MeshStandard swap, hidden-tab setTimeout, collision *dispatch* (model in registry-collision) |
| `lighting-and-time-of-day` | `timeOfDay.js`, `contextLights.js` | nightness curve, sun/hemi/sky/fog, per-cluster context lights, the poll-everywhere pattern |
| `determinism` | `rng.js` | hash2 + mulberry32 seeding contract, session seed, salt discipline |
| `perf-tiers` | `perf.js`, `adaptiveQuality.js` | low/mid/high knobs, URL/runtime override, runtime quality drops, budget panel |

### World
| Capability | Owns | Notes |
|---|---|---|
| `world-streaming` | `world.js`, `chunks.js`, `forests.js`, `lakes.js`, `mountains.js` | v1 chunk/forest/lake lifecycle + disposal-safety + the v2 consumption path in chunks.js (`_generateWorldgen`, `buildWorldgenKind`, scatter passes) |
| `worldgen-layout` | `worldgen/{index,hearts,roads,water,density,roles,selftest}.js` | render-agnostic data contract, point-query tuple, determinism goldens. Promotes `world-layout-generator`, `worldgen-3d-world`, `worldgen-road-junctions` |
| `festival-composition` | `worldgen/{festival,placement,constants,tuning}.js` | per-heart POI zone-slotter, cross-hub seam grammar, cluster-center ownership, FESTIVAL_TUNING. Promotes `festival-zone-grammar`, `builder-layout-extraction`, `festival-tuning` |

### Entities / world objects
| Capability | Owns | Notes |
|---|---|---|
| `registry-collision` | `registry.js`, `spatialGrid.js`, `main.js#resolveCollision` | entry shape, chunkKey lifecycle, lake-omits-chunkKey, broadphase, approach-damage model |
| `carts` | `zerble.js`, `lurleen.js` | arcade physics, controls, world-bound, hit/invuln; Lurleen as spatialized companion |
| `crowd-ai` | `crowd.js`, `obstacles.js` | NPC pool/state machine/steering/smile mechanic; roaming groups (puppet parade, brass band, kid gaggle, wooks) |
| `models` | `src/models/**` | the buildX→Group contract, animatables, pooling/userData.shared, sandbox-registration rule. + `CATALOG.md` prose companion |

### Player feedback & I/O
| Capability | Owns | Notes |
|---|---|---|
| `feedback-systems` | `bubbles.js`, `smiles.js`, `models/heart.js` | bubble InstancedMesh, smile pickups + anti-farm reset, score/juice, hearts |
| `input-controls` | `input.js`, `touch.js` | held/edge keys, virtual thumbstick, source-agnostic blend, iOS zoom kill |
| `camera` | `camera.js` | chase/first-person/top-down, persistent yaw/pitch |
| `hud` | `hud.js`, `styles.css` | score+best persistence, toast, hit flash, title card |

### Audio
| Capability | Owns | Notes |
|---|---|---|
| `audio-synthesis` | `sound.js`, `midiPlayer.js` | Web Audio bus graph, iOS sync-gesture unlock, engine (Zerble+Lurleen spatial), collision/honk SFX, drum circles, stage songform, nature bed, MIDI player |

### Special / ambient (internal — don't leak into README/title card)
| Capability | Owns | Notes |
|---|---|---|
| `special-modes` | `starPower.js`, `trip.js` | star-power buff (ghost mode, sparkles, tire-tracks, beam); Wook trip system + post-process pass. Easter eggs — internal-only. + `NOTES.md` |
| `ambient-backdrop` | `birds.js`, `models/bird.js`, `mountains.js`, star field | bird flock + birdsong gating, Blue Ridge backdrop, night stars |

### Tooling / meta
| Capability | Owns | Notes |
|---|---|---|
| `sandbox-harness` | `sandbox.html`, `hub-sandbox.html`, `map-sandbox.html`, `debug.js`, `worldgen/lint.js`, `__dbg` | the three sandboxes, debug overlay/backtick, `window.__dbg` driving surface, the layout linter as a dev gate. Promotes `worldgen-2d-sandbox`, `layout-debug-tools`, `layout-surfaces`, `layout-linter`. Cross-links DEBUGGING.md (don't duplicate) |
| `analytics` | `analytics.js` | GA4 event taxonomy, fail-safe try/catch |

**Unmapped-file check:** `birds.js`✓ `bubbles.js`✓ `camera.js`✓ `chunks.js`✓
`contextLights.js`✓ `crowd.js`✓ `debug.js`✓ `forests.js`✓ `hud.js`✓ `input.js`✓
`lakes.js`✓ `lurleen.js`✓ `main.js`✓ `midiPlayer.js`✓ `mountains.js`✓ `obstacles.js`✓
`perf.js`✓ `registry.js`✓ `rng.js`✓ `smiles.js`✓ `sound.js`✓ `spatialGrid.js`✓
`starPower.js`✓ `threeShim.js`✓ `timeOfDay.js`✓ `touch.js`✓ `trip.js`✓ `world.js`✓
`zerble.js`✓ `adaptiveQuality.js`✓ `analytics.js`✓ `worldgen/*`✓ `models/*`✓ — all 70 accounted for.

## Execution order

Author in dependency order so cross-references resolve forward:
1. `determinism` → 2. `perf-tiers` → 3. `render-pipeline` → 4. `lighting-and-time-of-day`
→ 5. `registry-collision` → 6. `world-streaming` → 7. `worldgen-layout` →
8. `festival-composition` → 9. `models` (+CATALOG) → 10. `carts` → 11. `crowd-ai` →
12. `feedback-systems` → 13. `audio-synthesis` → 14. `input-controls` → 15. `camera`
→ 16. `hud` → 17. `special-modes` (+NOTES) → 18. `ambient-backdrop` →
19. `sandbox-harness` → 20. `analytics`.

Then: 21. `openspec/specs/README.md` index. 22. Refresh `config.yaml` `specs_index`.
23. Archive the two complete changes. 24. Cross-link from ARCHITECTURE.md +
fix the v2-default drift. 25. Final self-consistency sweep.

## Format conventions (zerble schema)

- `### Requirement: <name>` + SHALL/MUST normative prose.
- `#### Scenario: <name>` (exactly 4 hashes) WHEN/THEN; ≥1 per requirement.
- Since there's no prior baseline, these are plain ADDED-style requirements (no
  delta operators — the canonical spec IS the baseline).
- Lead each spec with a short `> Source:` note listing the files it's traced from.
- Prose companions (`CATALOG.md`, `NOTES.md`, `TUNABLES.md`) sit beside `spec.md`
  in the capability folder for things that resist requirement/scenario shape.
