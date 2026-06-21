# Draw-call reduction — scoping the real steady-state lever

Authored 2026-06-19, after the `perf-pass-4` round-trip-1 capture. This is the
strategy doc for the **real** draw bottleneck (geometry-merge turned out to be
only a ~2–4% cut — see `openspec/changes/perf-pass-4/deliberations/002-geometry-merge/`).
Not yet a plan-of-record; it sets up the precise plan once the census lands.

## The problem (measured)

B0 (true draw measurement under post-processing) revealed the steady-state ceiling:
**`draws` = median ~3,750, max 9,232 per frame** against the **400** high-tier
budget — 12–23× over. `tris` ~1.4M (slightly over the 1.2M high budget). FPS is
GPU-bound on draw-call submission, not CPU (avoidMs 0.1–0.3) and not shaders
(progDelta ~0 that run). [[perf-draws-are-bottleneck]]

## Build the harness first: `__dbg.drawCensus()`

B0 gave the draw *count*; we need the *composition* to aim. New tool
(`main.js`, `__dbg.drawCensus({top?})`): walks the live scene, buckets every
visible rendered mesh by **geometry fingerprint** and by **material**, and reports
the dominant draw sources. It separates the two levers by construction:

- **A shared geometry drawn hundreds of times → InstancedMesh candidate** (one
  geo, many transforms — collapse N draws → 1).
- **A pile of unique (drawn-once) geos sharing a material → geometry-merge
  candidate** (the `mergeCandidateUniqueGeosByMaterial` field).

It's a scene-graph census (PRE-frustum), so it over-counts vs `renderer.info`
(post-cull) — read it for the **ratio between kinds**, not the exact frame number.

**Run it:** drive to a dense hub (vendor rows + stages + food court), park,
`__dbg.drawCensus()` → paste the JSON (or `__dbg.capture('census', __dbg.drawCensus())`).

## Code-grounded hypothesis (to confirm with the census)

What's **already** InstancedMesh / pooled / merged (i.e. NOT the problem):
forests/trees, crowd, lakes, campsites + their torches, sugar-shack bulbs,
leaf-drum-circle benches, birds, bubbles, picnic tables (self-merge), vendor-booth
goods (the shipped −36% merge), food trucks (pooled materials).

What is **NOT** batched and repeats across the world (the likely draw hogs):
- **Tents** — every vendor-row booth is a Group of ~4 legs + roof + trim + table
  slots + shopkeeper NPC + 2 merged-decor meshes (~10–15 draws), and a hub has
  many booths across multiple rows. The leg/roof/trim **geometry is shared across
  every tent in the world** → prime cross-cluster InstancedMesh target.
- **Stages** — decks, trusses, banners, speakers (per-mesh).
- **Food trucks** — pooled *materials* but still N meshes each, repeated per food court.
- **Scattered props** — signage, cans, misc per-chunk decor.

If the census confirms this, **tent structural parts are almost certainly the
single biggest line item**, and they're the cleanest instancing win (identical
geometry, transform-only variation, color via `setColorAt`).

## The two levers

1. **Cross-cluster InstancedMesh for repeated structural geometry.** One persistent
   InstancedMesh per shared structural geo (tent legs, tent roof, tent trim, then
   food-truck bodies, stage parts), spanning the whole loaded world; add/remove
   instances as chunks load/unload via matrix writes (`instanceMatrix.needsUpdate`).
   This is the big one — collapses hundreds of tent-part draws to a handful.
2. **Distance LOD / billboard impostors for the far field.** Beyond ~60–100m, swap
   full tent/stage/tree geometry for a baked camera-facing card. Cuts both draws
   and tris in forest-dense / hub-approach views (perf-brainstorm E2/E4, ROADMAP).

## The budget-realism question (raise with Gary)

The 400-draw high-tier budget predates v2 worldgen, which is visibly denser. Either
(a) v2 genuinely needs the draw cuts above to fit 400, or (b) 400 is stale and
should move to a realistic v2 number once instancing lands. **Don't tune the budget
before instancing — fix the draws first, then set the budget to the new floor.**

## Sequence (once the census lands)

1. `drawCensus` at a dense hub → the top geometry buckets name the instancing targets.
2. Instance the top 1–2 structural geos (likely tent parts) cross-cluster. Re-census
   + Gary B0 capture before/after on `?perf=low/mid/high` (low matters most).
3. If draws still high → the far-field LOD/billboard pass.
4. Revisit the 400 budget against the new floor.

This is meaty + lifecycle-sensitive (cross-cluster instance free-list across chunk
load/unload, disposal, `needsUpdate`, determinism-safe because it's post-construction
and rng-free). It warrants its **own OpenSpec change + deliberation** before code —
this doc is the pre-read for that.

## Tripwires for this work

- InstancedMesh writes need `instanceMatrix.needsUpdate = true` (footgun #7).
- Cross-cluster instances must survive chunk unload correctly — the instance pool is
  module-persistent (`userData.shared`), slots recycled as chunks load/unload; don't
  let `disposeChunkByKey` free it.
- Determinism: instancing/LOD is post-construction, consumes no `rng()` — safe, but
  prove it (registry dump unchanged).
- Per-tier budget + `castShadow`: one big instanced mesh casting shadow vs many small
  non-casters — keep the audited caster set; don't reflexively cast.
- Billboards + nightness: a flat card won't respond to lights like the real mesh —
  needs an emissive/lit-card hack (the E2/E4 caveat).
