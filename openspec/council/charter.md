# Council Charter — Zerble at the Festival

<!-- Project-specific council knowledge lives HERE and only here. The council
     plugin's engine, personas, and commands are generic; they read this charter
     at the start of every deliberation. Keep it current — a stale charter
     produces stale deliberations. Scaffolded by /council:init (migration from
     the pre-plugin local council, 2026-08-27). -->

## Project Identity

- **Project**: Zerble at the Festival — a no-build browser game; drive a
  mustachioed bubble cart through an infinite procedural music festival.
  "Bring the bubbles, collect the smiles"; warm festival-evening tone.
- **Stack**: plain ES modules + importmap (no bundler, transpiler, framework,
  or npm dependencies), three.js pinned at 0.160.0 from the unpkg CDN through
  `src/threeShim.js`, Web Audio synthesis for all sound (no audio assets),
  ~70 hand-rolled modules across `src/`, `src/models/`, and `src/worldgen/`.
- **Deployment**: GitHub Pages
  (<https://garyreckard.github.io/zerble-at-the-festival/>), GA4 wired. The
  production deploy is observed by real players — determinism shifts and perf
  regressions are player-visible.
- **Scale facts**: solo hobby project (Gary's); mobile + desktop; three perf
  tiers (low/mid/high) with hard HUD budgets; the world streams in 80m chunks
  (3x3 load ring on low, 5x5 on mid/high, unload with hysteresis) plus 320m
  lake macrocells and 3x3-chunk forest blocks; deterministic worldgen v2 is
  the shipping default (`?worldgen=0` remains a legacy escape hatch). No Jira
  — the audit trail is CHANGELOG + ROADMAP + git.
- **Verification surfaces**: `sandbox.html?entity=<name>` (one model in
  isolation), `hub-sandbox.html` (one festival hub through the real game
  path), `map-sandbox.html` (2D worldgen layout), and the full game driven by
  `window.__dbg` (see DEBUGGING.md).

## Non-Negotiables

1. **Determinism is load-bearing.** Never reorder or re-salt existing `rng()`
   calls; new randomness gets a fresh salt constant through `rng.js`, never raw
   `Math.random()` in seeded paths (changing hash inputs regenerates every
   existing chunk/forest/lake for anyone mid-game). Memoized worldgen arrays
   are shared truth — never mutate them in place.
2. **ES module namespaces are frozen.** No `THREE.X = Y` after
   `import * as THREE`; tier-aware overrides go through `src/threeShim.js`,
   the `'three'` importmap entry (Safari mobile throws "Cannot assign to
   property of [object Module]" and the boot dies).
3. **iOS audio initializes synchronously inside the title-card gesture.** No
   `await`/`setTimeout`/async hop between the tap and `Sound.init()`, and the
   three-stage unlock chain stays intact (otherwise iOS Safari ships silent).
4. **No build step.** A new `src/` module must be added to the importmap
   cache-buster lists in the three full pages (`index.html`, `sandbox.html`,
   `hub-sandbox.html`; `map-sandbox.html` is worldgen-only) and verified with
   `bin/check-importmaps` — without the entry, local edits silently stop
   reloading. A bundler is on the table only behind a measured perf proposal
   raised explicitly with Gary (`.claude/rules/no-build.md`).
5. **Lifecycle disposal safety.** Lakes deliberately omit `chunkKey` (their
   colliders must survive host-chunk unload); pooled resources tagged
   `userData.shared = true` are never disposed (one mis-dispose storms shader
   recompiles — periodic ~200ms stalls that look like GC pauses but aren't).
6. **Per-tier perf budgets hold**: low 80 draws / 150k tris, mid 200 / 400k,
   high 400 / 1.2M (the backtick HUD panel). No reflexive `castShadow = true`
   — the shadow audit holds at 56 casters. Graphics changes verify on
   `?perf=low` and `?perf=mid`, not just high.
7. **Sandbox-pass ≠ game-pass.** A new model is not done without its full
   sandbox entry (importmap + `<option>` + `loadEntity()` case + hit
   kind/music style where relevant), and no task is done until the main game
   boots clean (title card → world generation → clean console).
8. **InstancedMesh writes flip `instanceMatrix.needsUpdate`** — a "frozen"
   instanced mesh is almost always this flag.
9. **Player-facing copy holds the tone and never reveals Easter eggs.** The
   Wook trip, the `t` menu, `?perf=`, and other hidden flags stay out of the
   README and title card; players discover them.

## Project-Specific Resolution Rules

Applied by the Mediator BEFORE the generic hierarchy:

1. **A tripwire violation loses, full stop** — regardless of how many personas
   endorse the plan containing it.
2. **Verifiability over speed**: a plan that lands the sandbox/harness surface
   and a clean full-game boot beats a faster plan that doesn't. "Build the
   harness, then the feature" is the project's operating principle.
3. **Perceivable player impact over effort**: player delight wins when safe
   and within budget, and effort must stay proportional to what a player can
   perceive at driving speed and camera distance.
4. **Perf work stops at green**: when the budget panel is green at the target
   tier, declare done. "Boil the ocean" applies to correctness, not perf polish.
5. **Human corrections are authoritative**: when `git blame`/`git log` shows
   Gary corrected agent-written code, any proposal reverting that correction
   loses.

## Custom Personas

None. The plugin's generic seven + Mediator cover this project — the
pre-plugin local council was the same eight personas re-domained, and their
project knowledge now lives in this charter.

## Selection Matrix Extensions

| Task Characteristic | Recommended Personas |
| ------------------- | -------------------- |
| New model / visual entity | Architect + Anthropologist + Profiler |
| New gameplay system (greenfield) | Architect + Maverick + Adversary |
| World-gen / chunk-lifecycle change | Architect + Adversary + Profiler |
| Audio change | Adversary + Anthropologist + Profiler |
| Determinism / rng-seeding change (5-persona) | Adversary + Architect + Auditor + Profiler + Pragmatist |
| threeShim / material-tier change (5-persona) | Architect + Adversary + Profiler + Auditor + Anthropologist |
| Boot-order / module-load change (5-persona) | Architect + Adversary + Auditor + Pragmatist + Profiler |

## Risk Signature Additions

These trigger the deliberation gate and Tier 3 escalation, in addition to the
engine's generic signatures (they mirror the gate in
`openspec/schemas/zerble/schema.yaml`):

- **Determinism**: touching `rng.js` salts, `hash2(cx,cz)` inputs, or
  seed/`rng()` call ordering.
- **Render pipeline / threeShim / material-tier**: anything near the
  frozen-namespace override path or the tier material swap.
- **Boot order / module load**: the
  `buildWorld → ChunkManager.update → _generate → THEME_BUILDERS[theme]`
  chain — the longest in the codebase; a boot-time TypeError hangs the title
  card.
- **World lifecycle**: chunk/forest/lake load-unload, disposal walks,
  `userData.shared` tagging, the lake-omits-chunkKey contract, registry
  `chunkKey` semantics.
- **Perf budget**: geometry/draw-adding features, shadow-caster changes, new
  post-process passes.
- **iOS audio init**: any change near `sound.js`'s synchronous gesture-unlock
  chain.
- **Importmap**: changes to the module cache-buster lists in any of the four
  HTML pages.

Does **not** trigger: a single isolated model tweak verifiable in the sandbox,
copy/README-only changes, or doc-only changes.

## Domain Spec Index

All specs live in `openspec/specs/` (20 capabilities in Requirement/Scenario
form, traced to code — see its README.md).

| Lens | Most-relevant specs |
| ---- | ------------------- |
| Architecture (Architect) | `render-pipeline`, `world-streaming`, `registry-collision`, `models`, `worldgen-layout`, `festival-composition`, `carts` |
| Quality/testing (Auditor) | `sandbox-harness`, `models`, `determinism`, `perf-tiers` |
| Security/failure modes (Adversary) | `determinism`, `world-streaming`, `audio-synthesis`, `render-pipeline`, `special-modes` |
| Performance (Profiler) | `perf-tiers`, `render-pipeline`, `lighting-and-time-of-day`, `crowd-ai`, `ambient-backdrop` |
| UX/DX (Anthropologist) | `sandbox-harness`, `hud`, `input-controls`, `feedback-systems`, `camera`, `analytics` |
| Delivery (Pragmatist, Maverick) | `sandbox-harness`, `models`, `feedback-systems`, plus ROADMAP.md (queued + parked) and CHANGELOG.md |

## Persona Notes

### council-architect

Read the ARCHITECTURE.md section for the subsystem in play, plus the
`src/registry.js` header. Patterns to enforce: models in `src/models/` return
a `THREE.Group` anchored at origin (callers position/rotate); animation via
updater closures walked by the central per-frame ticker in `main.js`;
`zerble.js`/`lurleen.js` stay in `src/` because they carry physics + state;
registry entries carry `kind`/`position`/`footprint`/optional
`collider`/`attractor`/`chunkKey`. Lifecycle owners: chunks (80m grid, load
ring + unload beyond the hysteresis radius), forests (3x3 chunk blocks), lakes
(320m macrocell, deliberately no `chunkKey`). `threeShim.js` is the only
material-override path. Watch for physics leaking into `models/` and bespoke
render loops bypassing the central ticker.

### council-maverick

Check ROADMAP.md's parked/"Out of scope" lists before proposing — Gary has
considered and shelved many ideas (including perf won't-dos like
three-mesh-bvh and lookAt caching; don't re-propose them). Existing systems
(models, pooled materials, particle/feedback systems, music generators,
registry attractors, theme builders) may already cover 70% of a new idea. The
vibe is a constraint: warm festival evening — innovation that breaks the tone
or a tripwire isn't innovation. An Easter-egg/discovery framing (kept out of
the README) often fits this game better than a front-and-center feature.

### council-pragmatist

Verification is cheap here — lean on `sandbox.html?entity=`,
`hub-sandbox.html`, and `window.__dbg` instead of hand-driving the game; if a
change has no one-URL view, building that surface is the real first task.
Slice plans so each slice is sandbox-verifiable AND boots the game clean.
Reuse before building: the `buildSimpleNPC` pool, color-keyed `matFor` caches,
existing music generators, the central ticker. Deploy reality: GitHub Pages,
real players, CHANGELOG + ROADMAP as the audit trail (no Jira). "Simple model"
hides animation + collision + perf budget + five sandbox-wiring steps —
challenge estimates.

### council-auditor

Run the mechanical sweeps: (1) importmap — new `src/` modules in the three
full pages' `mods` lists, `bin/check-importmaps` passes; (2) new-model sandbox
checklist — `<option>` in the right `<optgroup>`, `loadEntity()` case
extracting the correct return shape (`{ group, color, footprint }` vs a bare
Group), `updateFn` if animated, `ENTITY_HIT_KIND`/`ENTITY_MUSIC_STYLE` where
relevant; (3) pooling — module-scope geometry/materials tagged
`userData.shared`, disposal walks respect the tag, variant-bucketed materials;
(4) shadows/instancing — no reflexive `castShadow` (the 56-caster audit),
`needsUpdate` after instance writes; (5) determinism — fresh salts, no
`Math.random()` in seeded paths; (6) CHANGELOG same-commit + ROADMAP trim;
(7) scope completeness — does the same pattern exist elsewhere in
`src/models/*`? Comments only where the *why* is non-obvious. Read
`.claude/rules/{no-build,sandbox-and-testing,perf-pooling,changelog-and-roadmap}.md`.

### council-anthropologist

Two humans matter: the **player** (mobile + desktop; feel at driving speed and
camera distance; warm tone; Easter eggs never revealed in README/title card)
and the **next agent** (the harness doctrine — every change needs a one-URL
verification view; composites like `puppet_lineup` and `campsite_medium` exist
for in-context reads; extend the harness, never bypass it). Check at least two
time-of-day presets (Noon + Midnight) — emissive/lighting interactions only
show across the cycle. Debuggability: `window.__dbg` and the backtick overlay
should reach the new thing. Read DEBUGGING.md and
`.claude/rules/sandbox-and-testing.md`.

### council-profiler

Read `.claude/rules/performance.md` (plus `.claude/perf-audit-plan.md` and
`.claude/perf-pass-2-plan.md`) first. Budgets: low 80 draws/150k tris, mid
200/400k, high 400/1.2M. Audit order: renderer.info HUD → shadow casters →
dispose-safety → post-process gating → instancing → pooling → pixel-ratio/AA →
textures. Diagnose **allocation** cost (spawn stalls; fix with pooling and the
per-frame chunk budget) vs **steady-state** cost (baseline FPS; fix with
shadow audit, pass gating, instancing, AA strategy) — match the fix to the
symptom. Tier rules: low runs shadows off + Lambert swap + FXAA; pixel-ratio
caps live in `perf.js`'s tier TABLE. One light per cluster; emissive over
lights; `alphaTest` over `transparent`. The engine is draw-bound (B0
profiling: ~3.7k median draws vs a 400 budget) — density knobs (chunk radius,
crowdMax) move the needle, not fill-rate knobs. High tier hides regressions:
verify `?perf=low` and `?perf=mid`.

### council-adversary

The tripwires are the attack surface. Zerble-specific vectors: determinism
regression (reordered/re-salted `rng()` calls, or in-place mutation of
memoized worldgen arrays — a break no RNG-draw-count test sees); the Safari
module-freeze; an async hop before `Sound.init()`; sandbox-pass/game-crash
(the sandbox case using a different constructor path than the `chunks.js`
call site — `buildCampChair` returns `{ group, color, footprint }`, not a
bare Group, and the game once crashed on exactly that); lifecycle disposal
(a `chunkKey` on a lake, a dispose without the `userData.shared` check);
frozen InstancedMesh (`needsUpdate`); NaN physics from stub input to
`zerble.update`; boot-chain fragility (a TypeError anywhere in
`buildWorld → theme builders` hangs the title card); background-tab tick (the
main loop swaps RAF → `setTimeout(16)` on hidden tabs so previews keep
ticking — don't assume RAF). Read the `threeShim.js` header and `src/sound.js`
before attacking. Human corrections in `git blame` are authoritative.

### council-mediator

Apply this charter's Non-Negotiables and Resolution Rules before the generic
hierarchy. Change Group shape for this project: Group 1 is
foundation/prerequisites *including any sandbox-harness work needed first*;
then core implementation; then quality gates (sandbox verify, full-game boot
smoke, backtick budget panel, `?perf=low`/`?perf=mid`); then polish +
CHANGELOG/ROADMAP same-commit discipline. After tripwires, resolve conflicts
in this order: safety/correctness (determinism, boot integrity, iOS audio) →
architecture adherence → verifiability → perceivable player impact →
simplicity.
