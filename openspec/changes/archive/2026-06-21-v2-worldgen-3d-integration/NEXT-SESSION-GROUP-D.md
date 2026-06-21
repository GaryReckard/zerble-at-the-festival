# NEXT SESSION — Group D (placement.js anchors + role×rank scatter)

> Paste the prompt at the bottom into a fresh session, or just hand it this file.
> This is the **headline + highest-crash-risk** group of `v2-worldgen-3d-integration`.
> Groups A (paperwork), B (scaffolding), C (roads) are DONE + committed. You are
> picking up at **Group D**.

---

## 0. Read these first, in this order

1. **`CLAUDE.md`** (repo root) — the tripwires. Non-negotiable.
2. **`HANDOFF.md`** (this folder) — the full endeavor in one screen; the 6 binding
   apply-gates; the file map; how to run + verify.
3. **`tasks.md`** (this folder) — Groups A–I. A/B/C are checked. **Group D is your
   work** (the `## D.` block) — each sub-task has the hardened detail folded in.
4. **`deliberations/001-initial/results.md`** — the Risk Register (R1–R15). For Group
   D the binding ones are **R2** (heart-anchor boot crash / return-shape) and **R4**
   ((roleTier, heart.rank) tuple-key collision). Read those rows + the "Change Group D"
   section.
5. **`session-log.md`** — frontmatter → Current Status → the latest Work Log entry
   (2026-06-07, Group C) → **Dangling Threads** (one matters for D, see below).
6. `design.md` D-A/D-B/D-C (the sampler shape, the role→theme table, anchor ownership).

Don't re-explore the whole codebase. The map is in HANDOFF + below.

---

## 1. Exact state — what's already wired (commit `db4e0ef`)

`src/chunks.js` `_generateWorldgen(ctx)` (the v2 content path, behind `USE_WORLDGEN_V2`):

```js
_generateWorldgen(ctx) {
  const half = CHUNK_SIZE / 2;
  ctx.region = queryRegion({ minX:…, minZ:…, maxX:…, maxZ:… }); // ONE call/chunk (D-A/R7)
  placeWorldgenRoads(ctx, ctx.region.roads);                    // Group C — DONE
  const props = placeChunkProps(ctx.cx, ctx.cz, CHUNK_SIZE);    // [] until Group D ← YOU
  void props;
}
```

- `ctx.region` = `{ hearts, lakes, roads }` is **already computed once per chunk** — reuse
  it, don't re-query (R7). Hearts + lakes are sitting there ready for you.
- `src/worldgen/placement.js` is the **pure** decision module (no `three`, no `models/*`).
  It already has, as stubs to fill:
  - `isHeartCenterChunk(heart, cx, cz, chunkSize)` — the explicit center test (D.1/R2). **Done, use it.**
  - `ROLE_THEME` — the `(roleTier × rank)` → `{anchor:[…], scatter:[…]}` table, keyed
    `'core×major'`, `'core×minor'`, `'district×major'`, … with the R4 warning in the header. **Wire it up.**
  - `roleKey(roleTier, rank)`.
  - `placeChunkProps(cx, cz, chunkSize)` → returns `[]`. **This is the function you fill.**
- Salt is reserved: `SALT.placement = 0x4D41_0A` in `constants.js`. All placement jitter
  must draw from `cellRng(cx, cz, SALT.placement)` — never reorder an existing rng (footgun #4).

---

## 2. What Group D actually builds

**Two halves, keep the boundary clean:**

- **`placement.js` (pure data):** given the chunk + its `region`, decide the descriptors.
  For the heart whose CENTER is in this chunk (`isHeartCenterChunk`), emit the **anchor**
  descriptors (main/side stage, food court, arch, …) at the heart center. For every chunk,
  **scatter** the role×rank `scatter` kinds at jittered points where `!noBuild`, re-deriving
  role/rank from `queryPoint`/`heart` math — **never** a registry lookup of the anchor (it
  may be unloaded → R2/D.2). Return plain descriptors:
  `{ kind, x, z, yaw, footprint, role, rank, anchor }` (WORLD coords).
  Decide the interface: it needs the worldgen data — either pass `ctx.region` in, or have it
  call `queryPoint` for scatter points (queryPoint is the intended scatter sampler per D-A).
  **Do NOT import `three` or `models/*` here** (Architect #3 — keeps the self-test + map-sandbox runnable).

- **`chunks.js` (build + register):** a new `placeWorldgenProps(ctx)` (call it from
  `_generateWorldgen` in place of the `void props`) that maps each descriptor's `kind` →
  the right `buildX()` → a Group, positions it at `(x, 0, z)` rotated by `yaw`, and
  `registry.add({ kind, position, footprint, collider?, attractor?, chunkKey: ctx.key })`.
  **Reuse the existing legacy theme-builder logic as your reference** — the legacy
  `THEME_BUILDERS` in chunks.js show exactly what each kind builds + registers:
  `buildMainStage` (~L801), `buildSideStage`, `buildFoodPlaza` (~L1028), `buildVendorRow`,
  `buildDrumCircle`, `buildCampVillage`. Anchors aren't just geometry — stages also register
  `stageLightLenses`, `stageBeamRefs`, `stageMusic`, and `stagePerformers`. Port that.

---

## 3. The two BINDING gates for Group D (do NOT skip)

### R4 — `(roleTier, heart.rank)` tuple-key collision (the silent-wrong-world bug)
Two **distinct** enums that share words:
- `roleTier(heart, dist)` → `'core' | 'district' | 'outskirts'` — a **distance band** (`roles.js`).
- `heart.rank` → `'minor' | 'major'` — a **size class** (`hearts.js`).

Key placement on the **tuple** `${roleTier}×${rank}` (the `ROLE_THEME` table already does this).
A `switch` on the wrong axis **silently places nothing and still passes the green self-test** —
no crash, just a too-sparse world. Name both enums where you key. Verify by counting placed
props per role in the booted game, not by trusting the self-test.

### R2 — heart-anchor boot crash + the return-shape footgun (the documented crash class)
The longest call chain in the codebase is `buildWorld → ChunkManager.update → _generate →
placement`, and the anchor path is the rarest + sandbox-invisible. **Model builders return
DIFFERENT shapes — verified 2026-06-07:**

| Returns a bare `THREE.Group` | Returns `{ group, … }` (extract `.group`!) |
|---|---|
| `buildFoodTruck`, `buildSugarShack` (has `userData.cookEntry`), `buildBubbleVendor`, `buildEntranceArch`, `buildForestTree`, `buildTent` | `buildStage` (L197), `buildTentStage` (L188), `buildCampChair` / `buildCampTent` / `buildChiminea` (`{group,color,footprint}`), `buildPortaPotty` (L241) |

`grep "return" src/models/<file>.js` before wiring each one. A `{group,…}` treated as a Group
crashes with `Cannot read properties of undefined (reading 'set')` at world-gen and hangs the
title card. This exact bug shipped before (see CLAUDE.md "ALWAYS boot the main game").

---

## 4. Hard-won lessons from Group C (will save you hours)

1. **NEVER create a `depthWrite:false` material at MODULE-EVAL.** It renders **invisibly**
   in-game (meshes draw under the player-centered ground plane). The road material had to be
   created lazily at runtime (`roadMat()` in chunks.js). If you add any new shared
   ground-decal material, create it lazily on first use. (This is also why `_forestPathMat`
   forest paths may be invisible in legacy — see Dangling Threads. Anchors/scatter are 3D
   objects, not flat decals, so they're not at risk — but keep it in mind.)
2. **ToD is counter-intuitive:** `__dbg.tod(0.25)` ≈ **noon** (nightness 0); `__dbg.tod(0.72)`
   ≈ **midnight** (nightness 1). `0.5` is night, NOT noon. Screenshot at both per CLAUDE.md.
3. **`__dbg.start()` boots the sim but may NOT dismiss the title overlay.** If the title card
   is still up, `preview_click('#start-btn')`. The `#start-btn.offsetParent !== null` check is
   a false-positive (it fades via opacity) — just screenshot to see the real state.
4. **Preview MCP is a hidden tab → throttled to ~1 fps** on `setTimeout`. After `camLock`/`tod`,
   `await` ~1.3–2.5 s before `preview_screenshot`, or navigate to a fresh deep-link.
5. **The browser `[chunk slow] … ms` warnings are CPU-throttle inflation, NOT real cost.**
   Group C chunks logged 50–230 ms in-browser but measured 4.9 ms cold / <0.4 ms warm
   **headlessly in node**. For the R7/R11 perf gate, measure the per-chunk sampler cost in
   node (`node --input-type=module -e "…"` importing the worldgen modules), not from the HUD.
6. **Anchors are sandbox-invisible by construction.** `sandbox.html` builds models in
   isolation; `map-sandbox.html` is 2D. You MUST boot the real game at a **heart-center chunk**
   to see/verify an anchor.

---

## 5. Run + verify recipe (with seed-1234 coordinates)

```
python3 .claude/serve_nocache.py 8765        # or preview_start name "zerble"
```

- **v2 with a pinned seed:** `http://127.0.0.1:8765/?seed=1234&worldgen=1`
  (force legacy with `?worldgen=0`; force a tier with `&perf=low|mid|high`).
  The query string can get dropped by the preview harness — set `window.location.href` to the
  full URL in `preview_eval` and re-check `new URLSearchParams(location.search)`.
- **Boot:** `preview_click('#start-btn')` (or `__dbg.start()`), then `__dbg.teleport(hx, hz)`.
- **Heart locations at seed 1234** (teleport TO the heart center to land on its anchor chunk):
  - **`__dbg.teleport(701, -204)`** — a **MAJOR** heart (chunk (8,-3)). Best anchor test (biggest build).
  - `__dbg.teleport(62, 1463)` — another major (chunk (0,18)).
  - `__dbg.teleport(-103, 134)` — a minor heart near spawn (chunk (-2,1)).
  - (Roads from Group C run E-W through chunks (-5..-3, 0) ≈ world x −400..−240, z≈0–16.)
- **Close-up:** `__dbg.camLock(px,py,pz, tx,ty,tz)`; `__dbg.camUnlock()` for the real chase cam.
- **Verify loop:** boot → teleport to a major heart → wait ~2.5 s → `preview_console_logs`
  (level `error`) MUST be empty → `preview_screenshot` at noon (`tod 0.25`) + midnight
  (`tod 0.72`) → check the registry has the expected anchor kinds + NO props in water/on roads.
- **Inspect registry from eval:**
  `const reg = window.__dbg.game.registry; const a = [...reg.entries.values()]; …` (count by `e.kind`).
- **Self-test (determinism, must stay 20/20 / golden `63c8dea2`):**
  `node --input-type=module -e "import('./src/worldgen/selftest.js').then(m=>{const r=m.runSelfTest();console.log(r.pass,r.goldenHash)})"`
  Placement only READS the contract, so it stays green by construction — but run it after.

### Group D done-gate (from tasks.md D.5/D.6)
- A/B vs `?worldgen=0`: stages-on-roads is **structurally gone**, **nothing placed in water**.
- Boot the REAL game at a heart-center chunk; `buildWorld → … → placement` clean; backtick
  budget + `chunkGenStats.slowest` OK at `?perf=low`/`mid`.
- Both flag states boot with **zero console errors**.
- CHANGELOG entry in the SAME commit (it travels with each content slice — I.4). ROADMAP
  bullet stays until landing (I.5) — don't remove it yet.

---

## 6. Standing directive (Gary)

Take this all the way to a working v2 world, within OpenSpec (plan → /deliberate ✓ → apply →
verify → /smart-review). **Don't stop to ask** — state an assumption + sensible default,
proceed, log it (in session-log + questions-for-human if it's a real question). Commit
bootable, flag-gated checkpoints with CHANGELOG in the same commit. At ~75% context: write a
fresh HANDOFF, compact, continue. Order after D: **E lakes → F forests → G crowd → H
gates → I verify/review/docs.**

---

## Paste-ready continuation prompt

> Continue the `v2-worldgen-3d-integration` OpenSpec change in
> `~/Sites/zerble-at-the-festival`. Groups A/B/C are done + committed (`db4e0ef`); roads
> render in-game behind `?worldgen=1`. **Start Group D (placement.js anchors + role×rank
> scatter).** First read, in order: `CLAUDE.md`, then in
> `openspec/changes/v2-worldgen-3d-integration/`: `NEXT-SESSION-GROUP-D.md` (full Group-D
> brief — read this carefully, it carries the hard-won footguns), `HANDOFF.md`, `tasks.md`
> (the `## D.` block), `deliberations/001-initial/results.md` (Risk Register R2 + R4 are
> the binding gates), and the latest `session-log.md` Work Log entry. The v2 content path is
> `chunks.js _generateWorldgen` — it already calls `queryRegion` once and stores `ctx.region`;
> `placeChunkProps` in `worldgen/placement.js` is the stub you fill (pure, no three/models),
> plus a new `placeWorldgenProps(ctx)` on the chunks.js side to build + register. Honor the
> R4 tuple-key, the R2 return-shape footgun (model builders return mixed Group vs `{group,…}`),
> and verify by booting the REAL game at a heart-center chunk (e.g. `__dbg.teleport(701,-204)`,
> a major heart at seed 1234) — anchors are sandbox-invisible. Don't stop to ask; log
> assumptions and proceed. Gods peed.
