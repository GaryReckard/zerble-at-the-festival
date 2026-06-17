# Capability specs — the canonical lay of the land

This directory is the **source of truth for what Zerble at the Festival does today.**
Each subfolder is one capability with a `spec.md` in Requirement/Scenario form (the
zerble OpenSpec schema), some with prose companions (`CATALOG.md` / `NOTES.md`).

These were authored retroactively (2026-06-17) by tracing the shipped code — not by
trusting the prose docs, which had drifted. Every requirement cites a `file:line` or
observed behavior. When code and a narrative doc disagreed, code won and the doc was
fixed. See `.claude/retro-spec-plan.md` for the authoring plan + the `src → capability`
coverage matrix (all ~70 source files mapped).

**How to use these:** start here for "what is the contract of subsystem X." For "how is
it built / where do I edit," follow the `> Source:` line at the top of each spec into the
code, then `ARCHITECTURE.md` for the walkthrough and `DEBUGGING.md` for the iteration
surface. In-flight *changes* to these capabilities live in `openspec/changes/`; archived
ones in `openspec/changes/archive/`.

## The 20 capabilities

### Core engine
| Capability | What it owns |
|---|---|
| [render-pipeline](render-pipeline/spec.md) | Renderer + composer chain, the per-frame loop, hidden-tab setTimeout, the threeShim tier-aware material swap |
| [lighting-and-time-of-day](lighting-and-time-of-day/spec.md) | The day/night clock, `nightness`, sky/sun/hemi/fog, the distance-culled context-light budget |
| [determinism](determinism/spec.md) | The `rng.js` seeding contract — hash flavors, salts, quantization, order-independent seam seeding |
| [perf-tiers](perf-tiers/spec.md) | Boot tier detection, the `PERF` profile, `USE_WORLDGEN_V2`, the runtime adaptive-quality monitor |

### World
| Capability | What it owns |
|---|---|
| [world-streaming](world-streaming/spec.md) | Global world build, chunk/forest/lake lifecycle + disposal, the v1↔v2 branch + v2 consumption pipeline |
| [worldgen-layout](worldgen-layout/spec.md) | The render-agnostic generator (hearts/roads/water/density/roles), the point-query contract, determinism goldens |
| [festival-composition](festival-composition/spec.md) | The per-heart POI zone-slotter, cross-hub seam grammar, cluster-center ownership, FESTIVAL_TUNING |

### Entities
| Capability | What it owns |
|---|---|
| [registry-collision](registry-collision/spec.md) | The world-entity store, spatial broadphase, the approach-speed collision model |
| [carts](carts/spec.md) | Zerble's arcade physics + nightness lights; Lurleen's chase state machine |
| [crowd-ai](crowd-ai/spec.md) | Pooled NPC state machine, smile mechanic, roaming obstacle groups |
| [models](models/spec.md) | The `buildX→Group` contract, animatables, pooling, sandbox registration ([CATALOG](models/CATALOG.md)) |

### Player I/O + feedback
| Capability | What it owns |
|---|---|
| [feedback-systems](feedback-systems/spec.md) | Bubbles + the juice resource, smile pickups, the lost-smile cue |
| [input-controls](input-controls/spec.md) | The source-agnostic input facade, keyboard + virtual touch controls |
| [camera](camera/spec.md) | The three-mode chase rig, per-mode zoom, intro reveal, debug pin |
| [hud](hud/spec.md) | Score/best, juice gauge, toast, hit flash, star vignette, title card |

### Audio
| Capability | What it owns |
|---|---|
| [audio-synthesis](audio-synthesis/spec.md) | The bus graph, iOS unlock, engines, SFX, drum circles, stage songform, MIDI, nature bed |

### Special / ambient (internal Easter eggs + backdrop)
| Capability | What it owns |
|---|---|
| [special-modes](special-modes/spec.md) | Star power + the wook trip post-process (internal — see [NOTES](special-modes/NOTES.md)) |
| [ambient-backdrop](ambient-backdrop/spec.md) | The boids bird flock, night sky (stars + moon), the mountain ring |

### Tooling / meta
| Capability | What it owns |
|---|---|
| [sandbox-harness](sandbox-harness/spec.md) | The three sandboxes, the backtick overlay, the `__dbg` driving surface, the layout linter |
| [analytics](analytics/spec.md) | The fail-safe GA4 event taxonomy |

## Known not-yet-shipped (target-only in the specs, flagged where they appear)

- **Rivers + bridges** — contract stubs (`onRiver`/`bridge` always false). See `worldgen-layout`.
- **Mega heart rank** + its 2×2 suppression — cut; minor/major only. See `worldgen-layout`.
- **Collectors + footpaths** — parked; arterials only. See `worldgen-layout`.
- **Road junction-merge** — an in-flight refinement, not in `roads.js`; lives in the
  `v2-worldgen-3d-integration` change, not promoted here.
