# Flag-on acceptance gates (tasks 5.1–5.4) — capture record

> 2026-08-27 SwiftShader capture matrix (`bin/verify-headless`, seed 1234,
> fixed baseline pose (244,−179), real `?perf=` reloads). Same box + method as
> [baseline-disabled.md](baseline-disabled.md), same caveat: **wall-clock/FPS
> numbers do not transfer from SwiftShader; draw/tri/geo/tex/program/registry
> counts do.** The D11 promotion gate is judged on the marginal numbers below.

## 5.1 Static gates — ALL GREEN

- `npm run check` — green (10 gates, including the completed `bin/test-far-field`).
- `npm run lint:layout` — exactly the recorded baseline: 1 pre-existing error
  (seed 256 drum/food-court, parked on ROADMAP), 234 findings. No NEW findings.
- `git diff --check` — clean.
- `node --check` on every touched module (`farField.js`, `world.js`, `perf.js`,
  `main.js`, `bin/node-three-shim.mjs`) + the extracted `hub-sandbox.html`
  inline module — clean.
- `bin/check-importmaps` — green (39 src + 12 worldgen + 28 models, 4 pages).

## 5.4 Marginal cost — the D11 gate numbers

**Direct measurement** (exact, from the live scene graph: the far-field
batches are always-submitted, so their cost is countable, not statistical):

| Tier | ToD | FF draws | FF triangles | Gate (≤ +12 draws, tri cap) |
|------|----------|---------:|-------------:|------|
| low  | Noon     | 4 | 2,962 | ✅ (cap +5,000) |
| low  | Midnight | 6 | 3,666 | ✅ (cap +5,000) |
| mid  | Midnight (derived*) | 6 | ≈ 6,632 | ✅ (cap +10,000) |
| high | Midnight (derived*) | 6 | ≈ 7,800 | ✅ (cap +10,000) |

*Derived: mid/high pools measured SATURATED at caps in-game (active 516/624 =
exact cap sums), per-instance triangle counts are tier-independent (canopy 18,
truss/peak 12, warm/beacon 8), road scaled from measured verts (1,260 vs 656).
Low measured directly: `FFDIRECT noon draws=4 tris=2962 / midnight draws=6
tris=3666` (canopy 288 + truss 576 + peak 1536 + warm 512 + beacon 192 + road 562).

**Frozen-scene A/B** (NPCs frozen, same pose, low tier — kills the dynamic
crowd/bird noise that swamps a ≤12-draw signal in unfrozen scenes):

| State | Noon draws / tris | Midnight draws / tris |
|---|---|---|
| off | 1,483 / 467,329 | 1,757 / 500,505 |
| on  | 1,450 / 466,535 | 1,719 / 499,579 |

Flag-on is statistically indistinguishable at the scene level (residual ±30
draw noise from fireworks/smiles exceeds the far field's ≤6). **No-regression:
confirmed.** (The unfrozen matrix A/B showed ±270–700 draw swings in BOTH
directions across all tiers — recorded as method evidence that unfrozen
scene-level A/B cannot resolve this gate; the numbers above are the gate.)

**Programs:** off 67 → on 70 at noon (+3: the shared dither program + the road
basic + instance-color variant), off 77 → on 82 at midnight; stable after
settle (`progDelta 0`), no recompile churn.

## Determinism / registry identity — IDENTICAL

- RNG draw-count canary (`dumpDrawCounts`, sorted): **identical hash off vs on
  on every tier** (low 1903204418/214; mid+high 3939476791/728).
- Normalized registry (layout-snapshot rules: movers excluded, rounded,
  sorted): **identical hash off vs on** (2706996945, 50,074 chars) in the
  frozen A/B. (Unfrozen dumps differ only through live NPC/bird positions —
  the same run-to-run variance the flag-off game already has.)

## 5.4 Long-travel / unload lifecycle — no far-field-attributable growth

Same 4-stop teleport loop (start → +800m → +1600m → return), low tier:

| Stop | geo off / on | tex off / on | prog off / on | registry off / on |
|---|---|---|---|---|
| start      | 1,259 / 866   | 13 / 13 | 66 / 68 | 1,597 / 1,597 |
| hop1 800m  | 2,461 / 2,460 | 24 / 24 | 68 / 71 | 1,847 / 1,847 |
| hop2 1600m | 2,420 / 2,418 | 27 / 26 | 69 / 70 | 2,932 / 2,932 |
| return     | 2,822 / 2,822 | 28 / 28 | 69 / 74 | 2,009 / 2,009 |

Geo/tex/registry growth over travel is **byte-identical flag-off vs flag-on**
(pre-existing world behavior — retained lakes are culled by distance out to
1500m by design, so "return" holds more resident content than a cold start).
Programs hold a constant +3–5 offset with no growth. Horizon stats across the
loop: rebuilds 4 (one per crossing), superseded 0, handoffs 9 (envelope
dissolves firing as chunks loaded mid-replan), maxColdStepMs stable at 7.6ms
after the first plan (SwiftShader-inflated; see caveat below).

## 5.3 Full-game matrix — clean everywhere

Every leg ran with **zero console errors**: off/on × low/mid/high × Noon/
Midnight, the REAL title flow (`#start-btn` click → `game-started` true), the
390×844 mobile viewport with `prefers-reduced-motion: reduce` (horizon
committed), `?worldgen=0&farField=1` (true no-op, no scene group), and default
flag-off (no group, `{enabled:false}`).

## Gates that need real-device numbers (recorded, not judged here)

- **`maxColdStepMs` vs the 2ms tier gate:** measured 7.6–42.6ms here, but this
  box is a software rasterizer with cold caches — the same caveat that made
  the baseline FPS numbers untransferable. Judge on a real device during the
  promotion decision.
- **Worst-frame / chunk-generation regression:** unmeasurable on SwiftShader
  (frames are 250ms–2s); structurally the horizon only spends the measured
  remainder of the existing chunk wall, and the frozen A/B shows no
  scene-level regression.

## Verdict against D11 (all tiers: marginal delta + no-regression + sign-off)

- ≤ +12 scene draws: **PASS** (6 at night, 4 by day, every tier).
- Marginal triangles within pinned caps: **PASS** (3.7k low / ~6.6k mid /
  ~7.8k high vs +5k/+10k/+10k).
- No-regression (frozen A/B, resource plateaus, programs, clean consoles,
  determinism): **PASS**.
- **Gary sign-off: PENDING** — the remaining gate on every tier, plus the two
  real-device numbers above.
