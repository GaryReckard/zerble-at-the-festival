# Zerble at the Festival — Improvement Plan

> A prioritized backlog of performance, engineering-health, feature, and platform
> work, grounded in the current codebase. Every project-specific claim cites a
> `file:line` or a doc. Date: 2026-06-05.
>
> Codebase reviewed: all of `src/` + `src/models/`, `index.html`, `sandbox.html`,
> `styles.css`, and the docs (`ARCHITECTURE.md`, `ROADMAP.md`, `CHANGELOG.md`,
> `DEBUGGING.md`, `CLAUDE.md`, `.claude/rules/*`, the three perf-pass plans, and
> the two feature design docs).

---

## Contents

- [1. Priorities at a glance](#1-priorities-at-a-glance)
- [2. Tier 1 — Engineering health](#2-tier-1--engineering-health)
  - [2.1 Spatial-hash performance pass](#21-spatial-hash-performance-pass)
  - [2.2 Automated test + verification harness](#22-automated-test--verification-harness)
  - [2.3 JSDoc `@ts-check` type safety](#23-jsdoc-ts-check-type-safety)
- [3. Tier 2 — Player-facing features](#3-tier-2--player-facing-features)
  - [3.1 Settings + Accessibility panel](#31-settings--accessibility-panel)
  - [3.2 Daily Seed Challenge](#32-daily-seed-challenge)
- [4. Tier 3 — Bigger bets](#4-tier-3--bigger-bets)
  - [4.1 PWA / offline / installable](#41-pwa--offline--installable)
  - [4.2 Forest geometry merging + LOD](#42-forest-geometry-merging--lod)
  - [4.3 Weather system](#43-weather-system)
- [5. Tier 4 — Insurance](#5-tier-4--insurance)
  - [5.1 Lifecycle / duplication refactor](#51-lifecycle--duplication-refactor)
- [6. Second-tier ideas](#6-second-tier-ideas)
- [7. Shovel-ready (already designed)](#7-shovel-ready-already-designed)
- [8. Considered and cut](#8-considered-and-cut)
- [9. Recommended sequence](#9-recommended-sequence)

---

## 1. Priorities at a glance

| # | Item | Tier | Effort | Verdict |
|---|---|---|---|---|
| 2.1 | Spatial-hash performance pass | 1 | M (~6–9h) | ✅ Shipped 2026-06-05 |
| 2.2 | Test + verification harness (layers 1+2) | 1 | M (~14–22h for 80%) | Do first |
| 2.3 | JSDoc `@ts-check` type safety | 1 | M (~8–14h) | Do, phased |
| 3.1 | Settings + Accessibility panel | 2 | M (MVP) / L (full) | Do the MVP |
| 3.2 | Daily Seed Challenge (v1) | 2 | M (~8–12h) | Strong, opt-in |
| 4.1 | PWA / offline / installable | 3 | S (MVP) / M (full offline) | MVP yes; full needs sign-off |
| 4.2 | Forest geometry merging + LOD | 3 | M (~5–8h) | After 2.1 |
| 4.3 | Weather system | 3 | M (~8–12h) | Best feature bet, lower priority |
| 5.1 | Lifecycle / duplication refactor | 4 | M (~7–9h) | Insurance only; (1)-half only |

---

## 2. Tier 1 — Engineering health

These three close gaps the project's own discipline has already identified (unshipped perf work, zero tests, no types). Lowest regret, highest leverage.

### 2.1 Spatial-hash performance pass

> ✅ **Shipped 2026-06-05** — `crowd.update()` 39.7 ms → 6.96 ms at 500 NPCs
> (+0.65 ms/frame index rebuild). Footprint avoidance verified byte-identical to
> the old full scan; collider query a verified superset; determinism untouched.
> See CHANGELOG. (Forest geometry merging, §4.2, remains as the render-side
> follow-up if the HUD draw budget is still over after this.)

**Effort: M (~6–9h). Verdict: do first — the one number everyone feels.**

This is [.claude/perf-pass-4-plan.md](.claude/perf-pass-4-plan.md)'s **Path B (crowd-first)**, planned but never shipped. Phases 1–3 of that plan landed (frame-stats instrumentation, adaptive-quality overhaul, bubble cleanups — see CHANGELOG 2026-05-28); the spatial grids did not (`grep` for `SpatialGrid`/`footprintsNear`/`_footprintGrid` across `src/` returns nothing).

**The measured problem (steady-state CPU, not GPU):**

- Parked at the main stage `(0,0)`, `?perf=high`, 499 NPCs, 3760 registry entries: **fps=19, avg 52.4ms, p95 58.1ms** ([perf-pass-4-plan.md:21-31](.claude/perf-pass-4-plan.md)). Cart doing nothing → pure simulation cost.
- Chunk gen averages 3.3ms (worst 15.2ms) — **not** the bottleneck ([perf-pass-4-plan.md:27,33](.claude/perf-pass-4-plan.md)).
- NPC-NPC separation: [crowd.js:915](src/crowd.js) `for (const other of this.npcs)` inside `_updateNpc`, run per NPC → up to **~250k pair checks/frame** + sqrt.
- Footprint avoidance: [crowd.js:1554](src/crowd.js) `nearestFootprintAvoidance` walks all `registry.footprints()` per moving NPC → **~0.5–1M `Math.hypot` checks/frame** (forest_tree footprints dominate).
- Kids collider scan: [obstacles.js:693](src/obstacles.js) `pushOutOfHardColliders` walks `registry.colliders()` per kid per frame.
- `Registry` ([registry.js:9-13](src/registry.js)) has only `entries` + `byKind` — no spatial index; `colliders()`/`footprints()` are generators over the whole Map.

**Design:**

- New `src/spatialGrid.js`: a uniform hash grid keyed on packed integer cell coords (`(cx & 0xffff) << 16 | (cz & 0xffff)` — avoids string-key GC churn; world spans `WORLD_BOUND = 230` so cells stay well within range). API: `clear()` (reuse buckets via `length = 0`, don't reallocate), `insert(x, z, item)`, `forEachNear(x, z, radius, fn)`.
- **Crowd separation grid:** `this._sepGrid = new SpatialGrid(SEPARATION_RADIUS)` (cell = 1.9m, [crowd.js:80](src/crowd.js)) in the constructor; rebuild per-frame in `update()` before the NPC loop; replace the full scan at [crowd.js:915](src/crowd.js) with a 9-cell `forEachNear` query. Keep the body verbatim (same accumulation into `sepX/sepZ/overlapPushX/overlapPushZ`).
- **Registry footprint index:** an incremental grid (~8m cells) built on `Registry.add`/torn down on `remove`. Expose `registry.footprintsNear(pos, radius, fn)` (callback form — no per-call array allocation across 499 calls/frame). Pad the queried cell ring by a tracked `_maxFootprint` so a large stage footprint isn't missed from a neighboring cell. Switch [crowd.js:1554](src/crowd.js); keep the existing in-loop kind-skip (`tree`/`path_node`) — the win is the index, not the filter.
- **Moving-entry exception:** Lurleen registers `position: this.position` and mutates it every frame ([lurleen.js:133](src/lurleen.js) — "mutated each frame; registry holds the reference"). An insert-on-add grid would strand her in a stale cell. Keep a tiny `_movingFootprints` linear list (~1 entry) that `footprintsNear` also scans.
- **Kids collider grid:** same machinery (`registry.collidersNear`); swap [obstacles.js:693](src/obstacles.js). Lower priority but nearly free once the index exists.
- **GC cleanup (perf-pass-4 phase 4):** [main.js:885-913](src/main.js) rebuilds `npcColliders = []` + a fresh `{position:{x,y,z},...}` literal per broadphase NPC + an 8-way spread `allColliders` materializing all 3312 colliders every frame. Reuse a `_npcColliderScratch`, pass `n.pos` (already a `Vector3`), build via explicit loop or (better) route Zerble's own `resolveCollision` through `collidersNear`.

**Determinism:** safe. The grids are runtime query accelerators — they never call `rng()`, never reorder generation, never feed placement. A query returns the same neighbors a full scan would (given conservative radius padding). No world-layout shift possible.

**Files to touch:**

| File | Where | Change |
|---|---|---|
| `src/spatialGrid.js` | new | `SpatialGrid` class |
| `index.html` / `sandbox.html` | mods arrays | add `'spatialGrid'` (both) |
| `src/registry.js` | `:10-13`, `add` `:24`, `remove` `:34` | grid(s) + `_movingFootprints` + `_maxFootprint`; `footprintsNear`/`collidersNear` |
| `src/crowd.js` | `:100`, `:530-554`, `:915`, `:1554` | sep grid + footprint query |
| `src/obstacles.js` | `:693` | kids collider query |
| `src/main.js` | `:885-913` | scratch arrays / `collidersNear` |

**Risks / adversarial:**

- 19 fps is the **single densest spot**. The grids remove the O(n²) wall, but a clean 60 isn't guaranteed — the residual may be the 7 crowd `InstancedMesh` `needsUpdate` matrix uploads ([crowd.js:556-562](src/crowd.js)) + the high-tier draw budget (400 draws / 1.2M tris, [debug.js:37](src/debug.js)). **Verification must read draws/tris at the same parked spot** to decide whether the next lever is [§4.2](#42-forest-geometry-merging--lod).
- Radius-padding bug is the classic spatial-hash error: under-pad and NPCs clip through large stages. Track `_maxFootprint`/`_maxColliderRadius`, pad the ring, screenshot-verify NPC flow.
- No "max k per cell" cap — separation/avoidance forces are accumulated sums; visit every in-radius neighbor or the steering feel drifts.

**Verification:**

- Reproduce baseline at `?perf=high&adaptive=0`, `__dbg.start()` → `__dbg.teleport(0,0)`, read the backtick HUD frame row (avg/p95/max) + draws/tris.
- After each commit, re-measure at the same spot; record the delta in the CHANGELOG `### Performance` block per [.claude/rules/changelog-and-roadmap.md](.claude/rules/changelog-and-roadmap.md).
- Behavior check: screenshots at Noon (`tod(0.25)`) + Midnight (`tod(0.75)`); confirm NPCs still flow around the stage, no stacking, no clipping through Lurleen.
- `?perf=mid&adaptive=0` + `?perf=low&adaptive=0` (low catches the threeShim/module-freeze class even though materials are untouched).
- Full-game smoke: load `/`, start, `preview_console_logs` clean.

**Commits:** (1) `SpatialGrid` + crowd sep grid; (2) registry footprint index + `footprintsNear`; (3) collision GC cleanup + kids collider grid. Each ships its own dated `### Performance` block.

---

### 2.2 Automated test + verification harness

**Effort: M–L (~32–52h full; ~14–22h delivers ~80% of value). Verdict: do first (layers 1+2).**

There are zero automated tests today (no `package.json`, no `.github/`). The project's #1 principle is "build the harness, then the feature" (CLAUDE.md) — the manual surfaces (sandbox, `__dbg`, the backtick HUD) are excellent but there's no automated layer, so regressions are only caught when a human re-opens the exact view. A documented crash class exists that manual sandbox testing structurally cannot catch ([sandbox-and-testing.md](.claude/rules/sandbox-and-testing.md): the camp-chair bug — sandbox rendered fine, the game crashed at world-gen because `buildCampChair` returns `{group,color,footprint}` and the call site forgot `.group`).

**Four layers, ranked by value/maintenance-cost:**

1. **Unit tests for pure functions** (highest value/cost — zero deps, never flaky):
   - `rng.js` `hash2`/`mulberry32`/`worldHash`/`setSessionSeed` ([rng.js:40,62,55,21](src/rng.js)) — the literal root of "determinism is load-bearing."
   - `E()` Euclidean rhythm ([sound.js:1646](src/sound.js)), `nightnessFromT` ([timeOfDay.js:68](src/timeOfDay.js)), `Registry` add/remove/byKind/closestBuilding, `outlineRAt`/`isPointInLake` ([lakes.js:192,718](src/lakes.js)), `pathLength`/`samplePath` ([obstacles.js:936,946](src/obstacles.js)).
   - **Caveat:** `registry.js` *does* import THREE ([registry.js:5,27](src/registry.js)) — it's not three-free. Use `node:test` (ships with Node, zero devDeps) + a ~15-line `Vector3`/`MathUtils.clamp` stub aliased for `'three'`. `E`, `nightnessFromT`, `outlineRAt`, `pathLength`/`samplePath` are module-private — add `export` (one-token, behavior-neutral) so they're directly testable.
2. **Headless smoke boot** (second-highest): Playwright `page.goto('/')` → `__dbg.start()` ([main.js:1128](src/main.js)) → ~3s tick → assert zero `pageerror` + zero `console.error` matching `/TypeError|ReferenceError|shader|compile/`. Optionally teleport across chunks to exercise `buildWorld → ChunkManager._generate → THEME_BUILDERS[theme]`. Run at `?perf=low/mid/high`.
3. **Determinism snapshot:** boot `/?seed=zerble-golden`, drive a fixed teleport sweep, serialize a canonical projection of `registry.entries` (`{kind, x, z, footprint}` rounded + sorted, excluding the monotonic `id`), hash it, store the golden in `test/golden/`. The PR diff *is* the footgun-#4 early-warning. Needs a browser (registry only populates in-game). Regenerate via `--update-golden`.
4. **Visual-regression + perf-budget** (lowest value/cost — ship last, keep advisory): `__dbg.camLock` + `freezeNPCs` + Noon/Midnight screenshots diffed against goldens; and read `__game.renderer.info.render` ([debug.js:783-805](src/debug.js)) to assert `calls`/`triangles` under the per-tier budget (low 80/150k, mid 200/400k, high 400/1.2M). Also assert `chunkGenStats.slowest`/`avgMs` ([chunks.js:245-256](src/chunks.js)) under `SLOW_THRESHOLD_MS = 8`. **Caveat:** in a hidden tab `renderer.info.render.calls` can read a bogus `1` ([DEBUGGING.md:172-175](DEBUGGING.md)) — sample the perf assertion from a non-hidden page over several frames.

**Tooling / no-build:** the unit layer is zero-dep `node:test` via a dev-only `package.json` (`"type":"module"`); the browser layers add Playwright as a dev devDependency. Neither touches the shipped game — `index.html`, the importmap, and "open it and it runs" are unchanged. Surface the dev-`package.json` addition explicitly per [no-build.md:13-16](.claude/rules/no-build.md).

**CI:** `.github/workflows/verify.yml` — a `unit` job (`node --test`, required for merge) + a `headless` job (Playwright; smoke required, determinism + visual advisory until goldens stabilize). Server: reuse `.claude/serve_nocache.py 8765`.

**Risks / adversarial:**

- Visual goldens rot fastest on a deliberately-visual, fast-iterating project — keep them `continue-on-error`, make `--update-golden` one command, ship them last.
- Determinism snapshots are *supposed* to break on intentional generation changes — frame the red as the feature (footgun-#4 review surface), not noise.
- Solo-dev maintenance: the `node:test` unit layer (zero deps, milliseconds, no browser) can be the entire required gate; the browser job is advisory.

**Rollout:** P1 `package.json` + `Vector3` stub + rng unit tests + `unit` CI (S, 4–6h) → P2 remaining unit tests (S–M, 4–6h) → P3 Playwright smoke ×3 tiers (M, 6–10h) → P4 determinism snapshot (M, 6–10h) → P5 perf-budget (S–M, 4–6h) → P6 visual regression, advisory (M–L, 8–14h). P1+P2+P3 deliver the rng-determinism + crash-class gates.

---

### 2.3 JSDoc `@ts-check` type safety

**Effort: M (~8–14h to Phase C). Verdict: do, phased.**

Static type-checking with **no build step**: `tsc --noEmit` as a *checker* (emits nothing — shipped `.js` is byte-identical; `@ts-check` is a comment; types live in JSDoc). This fits the no-build philosophy — [no-build.md](.claude/rules/no-build.md) forbids a bundler/transpiler for the *shipped artifact*, not a dev-time check that emits nothing. Document this distinction in `no-build.md` so a future reader doesn't delete the config as a stray build artifact.

**Bug classes it catches in this codebase:**

- **The `buildCampChair` shape crash** (the documented shipped bug). `buildCampChair` returns `{group,color,footprint}` ([campsite.js:190](src/models/campsite.js)); the scar-comment still sits at [chunks.js:1516](src/chunks.js). A `@typedef` on the return + `@ts-check` on `chunks.js` flags `chair.position` at check time.
- **Registry entry shape** — the contract lives only in a comment ([registry.js:17-23](src/registry.js)); dozens of hand-built call sites. A `@typedef Entry` catches misspelled keys + wrong value types.
- **The frozen-namespace footgun** — `THREE.X = Y` after `import * as THREE` is a genuine TS error (read-only namespace property). Turns the Safari-only runtime crash ([threeShim.js:12-17](src/threeShim.js)) into a desktop check-time error.

**Honest limits:** *not* type-catchable — forgetting `instanceMatrix.needsUpdate` (a valid boolean assignment you simply omit), the determinism-salt rule, the lake-omits-chunkKey rule, the `userData.shared` dispose convention. All semantic.

**three.js types without a runtime dep:** runtime resolves `import * as THREE from 'three'` → `threeShim.js` → CDN. The checker needs three's `.d.ts`. Dev-only `package.json` with `devDependencies: { typescript, three@0.160.0 }` (pin exactly to the CDN pin at [index.html:72](index.html)). `jsconfig.json` with `checkJs`/`allowJs`/`noEmit`/`moduleResolution: bundler` and `paths` mapping `'three'`, `'three/addons/*'`, `'three-actual'` to the npm package. `threeShim.js` is the trickiest file (its deliberately-wrong low-tier `MeshStandardMaterial` constructor fights the checker) — leave it unchecked initially.

**Phased adoption** (per-file `// @ts-check`, never blocks): A — pure-ish modules (`rng.js`, `perf.js`, `registry.js`); B — the two `@typedef`s that crashed (`Entry` on `Registry.add`, `CampChairResult` on `buildCampChair`); C — model-builder return contracts across `src/models/*`; D (optional, may be noisy) — the big integration files (`chunks.js`/`crowd.js`/`main.js`).

**Check command:** `npx tsc --noEmit`. Recommend a *non-blocking* convention (run before committing a `@ts-check`'d file) over a hard pre-commit hook on a solo project; revisit a gate once the tree is green.

**Risks / adversarial:**

- Annotation noise vs the project's "no comments unless the *why* is non-obvious" style — mitigate by annotating only cross-module contracts, never locals.
- three.js/shim typing friction could eat an afternoon for marginal benefit — prove value on Phases A/B before touching `threeShim.js`.
- Maintenance discipline: the value only holds if `@ts-check` headers stay on and the check stays run. Scope to A–C; stop if D is noisy.
- Version drift between the dev `three` pin and the CDN pin — add "bump both" to the no-build.md bump rule.

---

## 3. Tier 2 — Player-facing features

### 3.1 Settings + Accessibility panel

**Effort: M (MVP) / L (full). Verdict: do the MVP — the comfort toggle can prevent harm to real players.**

The only place to change volume/quality/comfort today is the hidden backtick dev overlay ([debug.js:439-505,526-621](src/debug.js)) — which CLAUDE.md insists stays hidden. The `Sound` volume API exists and persists to `zerble.vol.*` ([sound.js:776-819](src/sound.js)) with no player UI. Real accessibility harms ship with zero opt-out:

- The 3-minute Trip post-process — chromatic aberration, lens "breathe" ([trip.js:75](src/trip.js)), brightness/vignette pulse, posterize ([trip.js:431](src/trip.js)) — a photosensitivity/motion-sickness hazard.
- UnrealBloom at every tier; first-person camera; no reduced-motion path.
- Smiles vs lost-smiles distinguished by **color only** (yellow `0xffe066` vs red `0xff6b6b`, [smiles.js:20-33](src/smiles.js)) — colorblind-invisible.
- No `prefers-reduced-motion`/`prefers-contrast` handling anywhere.

**UI:** new `src/settings.js` + `#settings-card` DOM reusing title-card styling ([styles.css:270-296](styles.css)). Entry points: a "Settings" link on the title card + an in-game gear button (HUD corner / touch stack). Strictly separate from the dev overlay — exposes only player-safe knobs (no `t` panel, teleport, god/freeze, seed readout, draw budgets, `?perf=`).

**Settings:**

- **Audio:** Master/Music/SFX/Nature/MIDI sliders wired 1:1 to the existing `Sound` setters (persistence is automatic via `_saveVolumes`).
- **Reduced motion / comfort** (default = `matchMedia('(prefers-reduced-motion: reduce)')`): kills bloom (`bloomPass.enabled = false` at boot) and clamps Trip via a new `Trip.comfortMode` flag — zero `lensDistortion`/`vignettePulse`/`brightnessPulse`/`chromaticAberration`/`uvRipple` and cap `intensity` at the end of `_writeDynamicCurves`/`_pushConfigToUniforms`, leaving a gentle hue/sat drift so the wook bit still reads. Gated strictly on the flag so non-opted players get the full unchanged experience.
- **Colorblind-safe smiles** (default = `prefers-contrast: more`): give lost-smiles a shape/outline difference, not just hue, in the `Smiles` constructor.
- **Quality** (low/mid/high): persist a new `zerble.quality` key read inside `perf.js detect()` ([perf.js:8-31](src/perf.js)) so it survives reload *without* exposing `?perf=`. "Reload to apply" note (tier is read once at boot).
- **HUD text scale:** a `--hud-scale` custom property + body class. Pure CSS.
- **Key rebinding:** defer — keys are bare literals across `input.js`/`main.js`/`debug.js`; real rebinding is a separate L-effort action→key-map refactor.

**Persistence:** `zerble.*` dotted keys (matching the existing convention). Apply at boot — `zerble.quality` inside `perf.js detect()`; comfort/altSmiles/hudScale in a `Settings.applyAtBoot()` before the composer/Trip/Smiles construction. Add a CSS `@media (prefers-reduced-motion: reduce)` block to drop the juice-empty + toast-tap animations.

**Risks / adversarial:** scope-creep concern is real, but the photosensitivity + colorblind gaps are genuine harm on a live deploy, not polish — a subset is clearly justified. Touch-button real estate is tight (4 buttons already to `bottom:340px`); prefer a single HUD-corner gear on small screens. New module → both importmaps.

**MVP (ship first):** `prefers-reduced-motion` default + comfort toggle (bloom + Trip clamp); colorblind-safe lost-smile shape; Master/Music/SFX sliders; title-card link + one gear entry. Defer Nature/MIDI sliders, quality selector, text scale, rebinding.

---

### 3.2 Daily Seed Challenge

**Effort: v1 M (~8–12h, no backend); v2 M (~6–10h). Verdict: strong, strictly opt-in.**

The hard part — reproducible worlds — already ships. `setSessionSeed` accepts a date-string and FNV-hashes it ([rng.js:21-36](src/rng.js)); `initSessionSeed` wires `?seed=` ([main.js:62-80](src/main.js)); the origin `(0,0)` stage stays pinned across seeds ([main.js:54-61](src/main.js)). Best-score persistence ([hud.js:82-94](src/hud.js)) and `session_end` analytics ([analytics.js:211-227](src/analytics.js)) already exist.

**v1 (no backend):**

- Seed = `daily-YYYY-MM-DD` (local date). A fresh load → navigate to `?seed=daily-…` so the world boots seeded from scratch (both `initSessionSeed` + `buildWorld` run at module-eval, before any click); detect the `daily-` prefix on `window.__seedInput` at boot to flip daily framing.
- Title card gets a second button (`#start-daily-btn`) beside `#start-btn`; free-play is unchanged.
- A run = a fixed-length **timed smile-rush** (default 2:00). Score = the existing net `score` (already nets collisions/frowns against gathered smiles), so the chill verb *is* the competitive verb — no new mechanic, no fail-state. When the clock hits zero, `running = false` and an end screen shows. Start the countdown only after `finishIntroReveal` so the ~2.5s reveal doesn't eat run time.
- Shareable result: a Wordle-style copyable block (smiles + time + date-seed) via `navigator.clipboard` + a `?seed=daily-…` share URL. Per-day local best in `zerble.daily` (separate namespace from `zerble-best-smiles`).
- New modules `src/daily.js` + `src/runTimer.js` (HUD-styled), both added to both importmaps.

**Fairness (honest):** ambient crowd placement **is** seeded (`ctx.crowd.spawn({rng: ctx.rng})`, [chunks.js:1709](src/chunks.js)) — so the map *and* starting crowd are identical for two players on the same daily. But the mobile obstacles (puppet/band/kids/wooks) use `Math.random()` and are explicitly not seed-deterministic ([obstacles.js:102-103](src/obstacles.js)); ongoing crowd AI (boarding/wander/attractor picks) also uses `Math.random()`. So: **fair terrain, jittering encounters** — like a real-time roguelike daily. Frame it "same festival, your own chaos"; don't claim frame-perfect parity.

**v2 (optional leaderboard):** Cloudflare Worker + KV (`POST/GET /score?date=`). Client scores are forgeable — accept it for a hobby game (label it "friendly board"), or add server-side seed-validation + plausibility caps. GA4 `daily_run_end` + `daily_share` events.

**Risks / adversarial:** a chill no-fail sandbox is arguably the wrong genre for competitive dailies — mitigated by keeping it strictly opt-in (the free-play default never changes) and framing it as "share your run," not "beat everyone." Timezone/midnight edge is acceptable (the share URL carries the explicit date).

---

## 4. Tier 3 — Bigger bets

### 4.1 PWA / offline / installable

**Effort: MVP S (~2–3h); full offline M (+4–6h, needs sign-off). Verdict: MVP yes; full offline pending vendoring decision.**

iOS web-app meta is already present ([index.html:34-37](index.html): `apple-mobile-web-app-capable`, `theme-color #1a1430`). Turns "open index.html" into "install + offline." Faster repeat loads (today every prod load re-pulls ~600KB three.js from unpkg).

**Two facts that shape the offline story:**

- It's **not** fully self-contained: `assets/music/` ships 3 real `.mid` files (~195KB) and `midiPlayer.js` lazy-loads **Tone.js + @tonejs/midi from esm.sh** ([midiPlayer.js:22-23](src/midiPlayer.js)). So a true-offline build confronts *three* CDN deps, not one.
- `assets/zerble.png` is 1088×960 non-square RGBA — icon generation needs cropping/padding (ROADMAP already flags "multiple icon sizes").

**The three.js tension (the crux):** offline needs three.js bytes local, but [no-build.md:37](.claude/rules/no-build.md) says "Don't vendor it locally."

- *Option A — SW runtime-caches the unpkg/esm.sh responses:* keeps the importmap untouched, but only gives "offline after first online load," and esm.sh's redirect/sub-dependency graph is fragile to cache.
- *Option B — vendor pinned `three.module.js` + ~13 addon files* (`EffectComposer`, `RenderPass`, `UnrealBloomPass`, `OutputPass`, `ShaderPass`, `FXAAShader`, `BufferGeometryUtils` + their transitive deps `Pass`/`CopyShader`/`MaskPass`/`LuminosityHighPassShader`/`OutputShader`), repoint `'three-actual'` + `'three/addons/'` in both importmaps (the shim stays intact). **Violates the letter** of the rule but adds zero build step and arguably honors the spirit better (fewer moving parts, truly zero network). **Needs explicit sign-off** per [no-build.md:13-16](.claude/rules/no-build.md).

Keep Tone/MIDI lazy-loaded from esm.sh as an **online-only enhancement** (`midiPlayer.js` already degrades gracefully on import failure). Precache the `.mid` files cheaply so they're local when Tone is online.

**SW strategy:** PROD-ONLY, gated by the same `isLocal` check as the gtag/cache-buster blocks ([index.html:10-22,46-58](index.html)) — a cache-first SW would otherwise fight the `?v=` cache-buster on local dev. Cache-first app shell in a versioned cache (`zerble-shell-v<VERSION>`); network-first for navigations; bypass esm.sh + GA4 + `?v=`-suffixed manifest fetches; old-cache cleanup on `activate`. Bust via a manual `const VERSION` bump tied to CHANGELOG discipline (no build step to inject a hash). **The precache list must be generated from the real `find src -name '*.js'`** — generating from disk (rather than copying the importmap arrays) avoids the kind of drift that left those arrays stale before the 2026-06-05 fix.

**Manifest:** static `manifest.webmanifest` — `display: standalone`, `theme/background_color #1a1430`, `start_url ./`, pre-generated 192/512/512-maskable icons + a 180×180 `apple-touch-icon`. Closes the ROADMAP icon-sizes gap.

**Graceful degradation:** wrap registration in `if ('serviceWorker' in navigator && !isLocal)`; no SW support, `file://`, or precache failure → the game runs identically. Same defensive posture as the analytics try/catch.

**Risks / adversarial:** a service worker is the most footgun-prone web primitive and "exactly the moving part no-build.md warns against" — but it's additive, prod-only, gracefully-degrading, and deletable by removing two files + one block. Don't call `skipWaiting()` (swapping modules mid-session is risky given the frozen-namespace sensitivity). iOS evicts Cache Storage after ~7 days unused ("offline until iOS reclaims it, then one online load re-primes"); no `beforeinstallprompt` on iOS (manual "Add to Home Screen"). Determinism unaffected.

**MVP (installable, not fully offline):** manifest + icons + `<link>` tags + a minimal same-origin SW. **Full offline:** Option-B vendoring (gated on sign-off) + repoint both importmaps + extend the precache + iOS-install/`?perf=low` testing.

---

### 4.2 Forest geometry merging + LOD

**Effort: M (~5–8h). Verdict: do after 2.1; primarily a low/mid-tier draw win.**

`scatterForestTrees` places trees at `FOREST_TREE_TARGET_DENSITY = 0.022` trees/m² ([forests.js:765](src/forests.js)); the calibration comment notes ~80 placed × ~5 sub-meshes ≈ **400 meshes/chunk → ~3600 forest draws across 9 chunks**. Material pooling does NOT cut draw calls (three.js sorts by material but issues one draw per Mesh — [perf-pass-4-plan.md:53-60](.claude/perf-pass-4-plan.md)). Per-tier draw budgets: low 80 / mid 200 / high 400 ([debug.js:35-37](src/debug.js)) — ~3600 blows low/mid by 18–45×.

**Design:** add `mergeForestTrees(ctx.group)` at the end of `buildForestChunk` ([forests.js:286-314](src/forests.js)), before `scene.add(group)`. Walk the group, bucket leaf meshes by `(material.uuid, castShadow)`, normalize indexed↔non-indexed (`toNonIndexed()` per the [bird.js:164](src/models/bird.js) trap), bake the chunk-local transform (`mesh.matrixWorld`; the chunk group is added at identity — confirmed [chunks.js:459](src/chunks.js)), `BufferGeometryUtils.mergeGeometries` per bucket → ~14–28 merged meshes/chunk. **Preserve tree.js's per-submesh `castShadow` decisions** (pine lowest cone only [tree.js:185](src/models/tree.js); oak bumps off; birch lowest puff [tree.js:271](src/models/tree.js)) — that's why `castShadow` is in the bucket key; don't flatten it. Remove + dispose the original per-tree geometries; leave merged buffers `userData.shared`-false so `_unload` ([chunks.js:339-355](src/chunks.js)) frees them and skips the shared materials. `BufferGeometryUtils` is already imported (crowd/bird) — no importmap change, no new module if the helper lives in `forests.js`.

**LOD:** defer. `THREE.LOD` is core (no addon) but per-tree LOD *re-fragments* the merged draws (they're in tension); the right design is chunk-level billboard swap layered on the merged mesh, beyond ~60m. perf-pass-4 says ship merging first.

**Risks / adversarial:**

- This is a **low/mid draw + long-session geometry win, NOT a high-tier fps win** — the high-tier wall is sim-side ([§2.1](#21-spatial-hash-performance-pass)). perf-pass-4 even parks it as "Phase 7B, only if HUD draws/tris are still over budget."
- Merging breaks per-tree frustum culling (one merged chunk-spanning box) — keep the merge per-chunk (80m granularity), measure tris at a forest edge.
- Lake island/lakeside trees ([lakes.js:364,515](src/lakes.js), disposed by `destroyLake`) carry a non-identity `tree.scale` — `matrixWorld` baking captures it; defer to a second commit.
- Re-check the slow-chunk counter ([chunks.js:317](src/chunks.js)) stays under 8ms — the merge adds a one-shot CPU pass at finalization (allocation cost; watch for boost-into-forest stalls).
- Guard the merge in try/fallback (attribute-mismatch can throw).

**Verification:** boot the main game (chunks are game-only), `?perf=low`/`?perf=mid`, read draws/tris + `info.memory.geometries`; screenshots in a forest at Noon + Midnight (no stacked-at-origin trees, trunk shadows still render); drive a circuit to force unload and confirm geometry count returns to baseline (merged buffers freed, no recompile storm).

**Commits:** (1) forest chunk merge (remove ROADMAP "Geometry merging at chunk completion"); (2) optional lake-tree merge. LOD deferred.

---

### 4.3 Weather system

**Effort: M (~8–12h). Verdict: best feature bet, lower priority than the health work.**

A second global-poll layer modeled on `nightness` (CLAUDE.md footgun #8 blesses the poll-everywhere pattern as intentional + cheap). `getTimeOfDay()` is already a class with a polled getter + per-frame `update(dt)` ([timeOfDay.js:80-122](src/timeOfDay.js)) writing sky/sun/hemi/fog; bubbles already accept an env scalar (`bubbles.update(dt, zerble, nightness)`, [main.js:640](src/main.js)); the nature scan runs per-frame ([main.js:760-808](src/main.js)). A new `src/weather.js` exposing `getWeather()` `{phase, wetness, rainIntensity, fogBoost, skyTint}` is structurally identical, slotted into `updateWorld` next to `timeOfDay.update(dt)` ([world.js:82](src/world.js)).

**Determinism:** seed the *timeline*, free-run the *clock*. Derive a per-session weather RNG `mulberry32(worldHash(0, 0, WEATHER_SALT))` with a **fresh `WEATHER_SALT`** so it can't disturb chunk/prop/lake seeds (footgun #4 — salt with a new constant, don't reorder). Same seed → same arc at the same elapsed time (reproducible for the daily challenge); the visible clock is real-time. Add a `__dbg.weather(phase)` hook mirroring `__dbg.tod`.

**Rain:** an `InstancedMesh` of thin streaks (per `performance.md` "InstancedMesh + variant buckets"), `alphaTest` not transparency (the GPU can't depth-sort within one draw call), camera-relative scroll like the sky/ground/mountains ([world.js:86-129](src/world.js)), tier-gated via a new `rainPoolMax` knob (**low: 0** / mid ~200 / high ~500) read at construct like `bubblePoolMax`. Optional cheap wet-ground: nudge the ground material's roughness with `wetness` ([world.js:407](src/world.js)).

**Mechanical tie-ins:**

- **Bubble lifetime:** extend `bubbles.update(dt, zerble, nightness, wetness)` and apply the multiplier at *spawn* (`p.life`, [bubbles.js:298](src/bubbles.js)), not by mutating the const. Drain is spawn-rate-based ([bubbles.js:185](src/bubbles.js)), so shorter trails **don't touch the juice economy** — keep wetness off spawn rate.
- **Crowd sheltering:** a weather-aware weight multiplier on shelter-kind attractors (`tent`/`tent_stage`/canopy) inside `pickAttractor` ([registry.js:79](src/registry.js)) / at its `idle`-state call site ([crowd.js:748](src/crowd.js)). Caveat: `pickAttractor` only fires on `idle→walking`, so sheltering ramps in over a few seconds (reads as a gradual scurry) — don't force-interrupt locked states.
- **Fog/sky:** `timeOfDay._applyVisuals` writes `scene.fog` + sky uniforms every frame ([timeOfDay.js:142-198](src/timeOfDay.js)). Weather must run **after** `timeOfDay.update` and **read-then-modify** (lerp toward overcast, tighten `fog.near/far`) — one writer per frame in sequence, or you get fog flicker. **This is the key correctness pitfall.**

**Audio:** a rain bed on the nature bus — a `setRainBed(level)` setter + a `rainTick` scheduler that early-outs below threshold, mirroring crickets ([sound.js:595,3309](src/sound.js)); filtered noise through the stereo panner pool. Push from [main.js:806](src/main.js).

**Rainbow:** a single `MeshBasicMaterial` arc, gated to `phase === 'clearing'` AND `nightness < ~0.3`, camera-relative, `.visible`-skipped when absent (the moon-halo idiom, [world.js:325-340](src/world.js)). Cheaper than the parked Fireworks item.

**Risks / adversarial:** steady-state cost is one extra draw + one polled `update` — well inside budgets; low tier = 0 instances (class early-outs). The fog double-write is the real risk (sequencing). Bigger surface area (5 modules) than simpler parked items (Fireworks) — worth it only if scoped tightly; the rainbow alone could ship as a teaser. Gate fully off on low (audio + tint are ~free; rain visual off).

**Commits:** (1) global state + fog/sky tint + `__dbg.weather` + sandbox slider; (2) rain visual (`rainPoolMax` knob, low=0); (3) audio rain bed; (4) bubble-lifetime + crowd-shelter tie-ins; (5) rainbow.

---

## 5. Tier 4 — Insurance

### 5.1 Lifecycle / duplication refactor

**Effort: M (~7–9h). Verdict: insurance only — do the chunk-scoped half, skip the rest.**

Two real duplications:

1. **Eight hand-spliced per-chunk lists** in [chunks.js `_unload`:334-396](src/chunks.js): `stagePerformers`, `stageMusic` (+ `Sound.detachStageMusic`), `stageLightLenses`, `stageBeamRefs`, `sugarShackCooks`, `forestAnimatables`, `forestDrumCircles`, `forestDrumMusic` (+ detach). Several live in other modules. Adding a new per-chunk animated system means remembering a splice loop in `_unload` — a *documented* footgun ([forests.js:38-40](src/forests.js)); a miss is a silent leak.
2. **Six "relocate-around-player + avoid-lakes" reimplementations:** `placeLoop`/`maybeRecycleLoop` ([obstacles.js:69-87](src/obstacles.js)), KidGaggle ([obstacles.js:467](src/obstacles.js)), Wooks ([obstacles.js:800](src/obstacles.js)), HulaHoopers `_rescan` (attractor-based — exclude), lurleen `_relocateNearPlayer` ([lurleen.js:154](src/lurleen.js)), birds `_relocate` ([birds.js:130](src/birds.js)).

**Design (1):** a new `src/chunkScoped.js` — a `ChunkScoped` collection (`add(value, key, dispose)`, `releaseKey(key)`, `Symbol.iterator` yielding `value`). Each system keeps its own instance where its list lives today; `_unload` collapses to one `releaseKey` per collection (or a `CHUNK_COLLECTIONS` loop). The `dispose` hook carries `Sound.detachStageMusic`. **Do NOT extend `Registry`** (it's a hot spatial-query store; these are per-frame animation/handle lists). **Preserve the lake asymmetry** by simply never calling `releaseKey` from a chunk path — keep `lakeAnimatables` a plain array swept by `lakeKey` in `destroyLake` ([lakes.js:679](src/lakes.js)). `userData.shared` disposal is orthogonal (it disposes meshes on the group, not these lists).

**Design (2):** a shared `recycleAround(anchor, playerPos, {recycleDist, near, far, spread?, others?, cone?})` in `obstacles.js` wrapping the existing `_pickPositionAvoidingLakes` + folding in the wook spread check + lurleen's forward cone. Per-unit specifics stay (KidGaggle's `userData.center` re-anchor, Wooks' phase re-roll, etc.).

**Risks / adversarial:**

- **Pure risk, zero user benefit** — no observable change → no CHANGELOG entry — on the most-warned-about non-transactional subsystem (CLAUDE.md #5).
- Determinism proximity: the recycle paths already use `Math.random()` (non-deterministic by design, [obstacles.js:102-103](src/obstacles.js)) so reordering there is invisible — but lurleen/birds sit nearer seeded paths. **Exclude lurleen + birds** from the roaming refactor.
- **Recommendation: do (1) only**, keep lakes untouched, then (2) **obstacles-internal only** as a separate change. If forced to pick one: (1), and stop.

**Verification (the only deliverable is proof of zero regression):** boot smoke; force many chunk load/unload cycles via `__dbg.teleport` sweeps; watch `info.memory.geometries`/`.textures` over a long drive for a slow climb (a missed `releaseKey`); confirm a lake collider survives its host-chunk unload (the asymmetry); A/B that drum circles + stages still animate after unload→reload; test `?perf=low`/`mid` (unload cadence differs by tier).

---

## 6. Second-tier ideas

Real and worth tracking, but folded or not fully specced:

- **Central tuning file + live-edit** — a `tuning.js` of named constants the debug panel can hot-edit; aligns with the harness doctrine, speeds balance iteration.
- **Festival "pins" / achievements** — localStorage + a small DOM board; clean meta layer, ties into the parked bubble-variety unlocks.
- **Cart customization** — on-brand (the real Zerble is custom); pairs with the parked name-entry ROADMAP item.
- **Environmental reverb** — reuse the treeness/lakeness scan already in `main.js` to change master reverb in forests/tents.
- **Decals / tire tracks** — pooled ribbon; pairs with the parked "boost streaks."
- **Headliner "set-list" goal** — gentle direction reusing the song-end events that already fire.
- **Cookieless-analytics / consent review** — GA4 is live with no visible consent banner; worth a compliance look if there's EU traffic.

---

## 7. Shovel-ready (already designed)

Complete design docs exist — these are queued, not new ideas. Highest-impact *features* to build next:

- **Bubble varieties** — earnable, mix-and-match, per-instance shader attribute ([ROADMAP.md](ROADMAP.md) "Gameplay verbs").
- **Passenger quests** — full design in [.claude/passenger-quests-design.md](.claude/passenger-quests-design.md).
- **Star Power** — full design in [.claude/star-power-design.md](.claude/star-power-design.md).

---

## 8. Considered and cut

| Idea | Reason |
|---|---|
| Web-Worker / OffscreenCanvas chunk-gen or render | The bottleneck is sim-side CPU, not rendering or chunk-gen (perf-pass-4). Solves the wrong wall. |
| WebGPU renderer | Experimental in 0.160; breaks "open index.html and it just works"; renderer isn't the wall. |
| KTX2 / compressed textures | Textures are canvas-baked + capped; `performance.md` deprioritizes texture size as non-FPS/non-memory-bound here. No evidence of memory pressure. |
| SoA crowd / frustum-cull AI | The spatial hash wins without a rewrite or visible pop-in. Premature. |
| Split `sound.js`/`chunks.js`/`crowd.js` | Pure churn, no observable benefit; files are cleanly sectioned; every new file needs two importmap edits. |
| Event bus | Callback wiring is small + explicit; indirection for no gain. |
| Real-time multiplayer / Electron / Steam | Scope/infra blowout that changes the project's nature. |
| HMR-lite | Existing `no-store` + cache-buster reload is sub-second; sandbox makes iteration cheap. |
| CSM shadows / SSAO | Sun shadow is already tier-tuned + frustum-centered; complexity for marginal gain at this scale. |
| LUT color grade | ACES + bloom already give a cohesive look; marginal. |
| Reflector water / Fireworks / crowd photographer / bubble inhabitants | Already parked on ROADMAP (designed/deferred). |

---

## 9. Recommended sequence

- [ ] **Engineering health:** spatial-hash perf pass ✅ ([§2.1](#21-spatial-hash-performance-pass)) → test harness layers 1+2 (rng unit tests + smoke boot, [§2.2](#22-automated-test--verification-harness)) → `@ts-check` Phases A–C ([§2.3](#23-jsdoc-ts-check-type-safety)).
- [ ] **Player value (by appetite):** Settings + Accessibility MVP ([§3.1](#31-settings--accessibility-panel)) → Daily Challenge v1 ([§3.2](#32-daily-seed-challenge)).
- [ ] **Bigger bets:** PWA MVP ([§4.1](#41-pwa--offline--installable)) → forest geometry merging ([§4.2](#42-forest-geometry-merging--lod)) → weather ([§4.3](#43-weather-system)).
- [ ] **Insurance, only if it earns it:** chunk-scoped lifecycle refactor, half (1) only ([§5.1](#51-lifecycle--duplication-refactor)).
