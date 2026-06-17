## Adversary's Position

Lens: what BREAKS — on Safari/spec-strict, on `?perf=low`, mid-game across
chunk unloads, and against the load-bearing determinism + threeShim tripwires.
The diagnosis is accepted as settled; I attack the **fixes**, not the evidence.

### Priority Sequence

1. **2a — throttle/stagger per-NPC separation + cull far NPCs.** Lowest blast
   radius of all four. It touches crowd *steering* only, which consumes no rng
   and is not golden-locked (see below). Highest steady-state win with zero
   tripwire exposure. Ship first.
2. **1a — `checkShaderErrors = false`, gated, BUT shipped to production too
   (with a hard mitigation, below).** High leverage, but the production-ship
   question has a real Safari trap I want closed before it lands. Sequence it
   second so 2a has already proven the perf-log harness re-captures cleanly.
3. **1b — hunt the program-count leak.** This is the *actual* unbounded bug
   (`prog` 54→691 monotonic). 1a only hides the *sync-stall symptom*; the leak
   keeps eating heap (97→416 MB, rising floor) and will OOM-crash a long mobile
   session even with checkShaderErrors off. 1a without 1b is a tranquilizer,
   not a cure — but 1b is investigation, not a committed change, so it can run
   in parallel after 1a.
4. **2b — `_maxFp`/`_maxCol` audit + size-bucketing.** Deferred and de-risked
   (see determinism attack). The bucketing variant is the one fix here that can
   silently shift the world. Park the *bucketing* approach; ship only the safe
   subset (cap query reach / find the one oversized footprint).
5. **1c — `compileAsync` pre-warm / disposal audit.** ROADMAP. Pre-warm only
   helps the *first-encounter* stalls behind the title card; it does nothing
   for the streaming-in mint-source that 1b must find first.

### Vulnerabilities Found

-   **`checkShaderErrors=false` ships a black screen to real Safari players, silently** — On a genuinely broken shader, three.js with checkShaderErrors off skips `getProgramInfoLog`/link-status validation and renders nothing (or garbage) for that material, with no console error. Today the cart's star-power `onBeforeCompile` rainbow patch and the threeShim Lambert swap (`threeShim.js:52-67`) are exactly the kind of code paths whose GLSL can compile on Chrome/ANGLE-D3D but fail on Apple's Metal-backed WebGL — the threeShim header itself documents the precedent: "Chrome desktop tolerated it, which is why the bug only surfaced in mobile testing" (`threeShim.js:13-17`). With checkShaderErrors on, a future broken shader logs an error a player can screenshot; with it off in production, it ships a silent black object/screen to the exact runtime (Safari mobile) we have the least telemetry on. **The diagnosis's own framing — "a genuinely broken shader now fails silently (black/no draw)" (`perf-unresponsive-diagnosis.md:94`) — is the bug, not a footnote.** — Severity: **High**

-   **Gating 1a on the existing `?debug` flag does NOT make it production-safe — it makes production the *untested* path** — The debug gate (`main.js:540-542`: `?debug` / `localStorage 'zerble.debug'`) means every developer and every agent verifying a shader change runs with checkShaderErrors=**on**, so compile errors surface in dev. Real players run with it **off**. That inverts the safety: the configuration that ships is the one no one tests under. A shader regression that only breaks on Safari Metal sails through all dev verification (which is desktop Chrome) and the debug gate guarantees the dev never sees the error the player hits. The gate is necessary but not sufficient. — Severity: **High**

-   **The mitigation that makes 1a shippable: a one-time boot-time `getError()` / link-status probe before flipping the flag.** Flip checkShaderErrors=false only AFTER a single boot-time compile-and-validate of the core program set (or a `renderer.compileAsync(scene,camera)` at boot with checkShaderErrors still true, THEN set false). That keeps the per-frame sync stall dead while preserving one validation gate on the real production runtime — Safari included. Without this, my verdict on 1a-to-production is Block; with it, Proceed. — Severity: closes the above two.

-   **1a alone leaves the real leak running — heap OOM on long mobile sessions** — `prog` is monotonic 54→691 and "still climbing at capture end" with `heapMB` floor rising 97→416 (`perf-unresponsive-diagnosis.md:41-50`). checkShaderErrors=false removes the *sync stall per link* but NOT the *minting of new programs*. Each live program holds GPU + JS heap. iOS Safari kills tabs that breach its (low, undocumented) memory ceiling — capping textures at 1024 exists for exactly this (`rules/performance.md`). So 1a "fixes" the desktop freeze and converts the mobile failure mode from "janky" to "tab reload after 10 minutes," which is *worse* for a player and *invisible* in a 160 s capture. **1a must not ship as "the fix" — it must ship paired with the 1b investigation tracked as a release blocker, not a follow-up.** — Severity: **High**

-   **2b size-bucketing is the one fix that can shift the deterministic world** — `closestBuilding` (`registry.js:143-157`) is a **full linear scan** over `entries.values()` — it does NOT use the spatial grid (only `footprintsNear`/`collidersNear` at `registry.js:111-118` do). It is called as a *placement guard* dozens of times per chunk in `chunks.js` (e.g. `:1068, :1240, :1657, :2071`: `if (registry.closestBuilding(...)) continue`). The boolean result gates whether a prop/tree/camp spawns. If 2b buckets colliders by size or reorders entries, and that changes which entry is "closest" or whether the guard trips at a boundary distance, the **boolean flips and placement shifts** — the same class of break the determinism tripwire warns about, except it routes through query order instead of rng order. Any 2b variant must preserve `closestBuilding`'s scan semantics exactly (superset-safe, same min selection). Capping the grid query *radius* on `footprintsNear`/`collidersNear` is safe (the grid is a documented superset accelerator, `spatialGrid.js:4-15`); touching what `closestBuilding` returns is not. — Severity: **High**

-   **2a staggering can desync crowd separation into visible stacking on the slow tier** — The separation pass is documented "always active — prevents the cluster-stack bug" (`crowd.js:1010`) with a hard-overlap push applied *instantly* every frame (`crowd.js:1028-1037`). If 2a round-robins only a fraction of NPCs per frame, the `HARD_SEPARATION` floor (`crowd.js:89`, 0.85m) is no longer enforced every frame for every NPC — on `?perf=low` (lower fps, so a given NPC's turn comes around less often in wall-clock time) two NPCs can interpenetrate visibly between their scan turns. The hard-overlap resolution must stay every-frame for every NPC; only the *soft* separation steering accumulation is safe to stagger. Split the pass: cheap hard-floor every frame, expensive soft-steer round-robin'd. Cull-by-distance is safe (far NPCs off-screen). — Severity: **Medium**

-   **2a determinism / golden-snapshot exposure is NIL — confirmed, not assumed** — I checked: the worldgen self-test (`worldgen/selftest.js:14`) hashes `queryPoint` tuples over a fixed sample grid — a pure function of the worldgen layers (`festival.js`/`roads.js`/`hearts.js`), entirely independent of the registry and the crowd. The spatial grid "consumes no rng, feeds no world generation, and changes no placement" (`spatialGrid.js:4-6`). Crowd separation runs post-placement and uses `Math.random()` + `performance.now()` for jitter (`crowd.js:982, 989`) — already non-deterministic by design, not seeded. So 2a cannot move the 20/20 goldens or the layout snapshots. This is a green light for sequencing 2a first; I'm flagging it affirmatively so no one blocks it on a determinism fear that doesn't apply. — Severity: **None (clearance, not a risk).**

-   **threeShim interaction with 1a on `?perf=low`** — On low tier, every `MeshStandardMaterial` is silently a `MeshLambertMaterial` (`threeShim.js:46,62`). Lambert and Standard compile to *different* programs/defines. So the low-tier program population is a different set than high-tier — and low tier is the iOS-phone default (`perf.js:25`). Whatever mints the unbounded cache-keys (1b's target) may proliferate *differently* on low vs high. **1a and 1b verification must both run `?perf=low` AND `?perf=high`** (the perf-log `prog` trend captured on each), or a leak that only blooms under the Lambert swap is missed — this is the textbook sandbox-pass≠game-pass / high-hides-low-regression trap (`rules/performance.md` "Don't ship a perf change without checking ?perf=low and ?perf=mid"). The diagnosis's verify note ("Verify on ?perf=low/mid/high", `:96`) is correct — hold the fix to it. — Severity: **Medium**

-   **Sandbox-pass ≠ game-pass for all four fixes** — None of these are observable in `sandbox.html`: the program leak only manifests under streaming chunk churn, `forEachNear`/`closestBuilding` cost only scales with the ~3000-entry resident registry the running game builds, and `checkShaderErrors` only matters across the full material population. Every fix here MUST be verified by booting `http://127.0.0.1:8765/` and driving across multiple chunk loads with the perf-log recorder running (`__dbg.recordPerf()`), not in the entity sandbox. The boot-chain `buildWorld → ChunkManager.update → _generate → THEME_BUILDERS[theme]` is where a TypeError from a botched separation-stagger refactor would hang the title card. — Severity: **Medium**

### The production question for 1a (answered explicitly)

**Ship `checkShaderErrors=false` to production — but ONLY with the boot-time
validation probe, not the bare flag flip.**

- **Dev-only is wrong.** The freeze is a *production* symptom Gary hit on the
  live GitHub Pages deploy with real GA4 players. Gating the fix behind `?debug`
  means production keeps the 88%-of-long-tasks sync stall — the bug stays live
  for everyone except developers. That defeats the fix.
- **Bare flip-to-false in production is also wrong** (Block): it ships silent
  black-screen risk to Safari Metal, the runtime we have the least visibility
  into and the highest GLSL-divergence history (`threeShim.js:13-17`).
- **The shippable form** (Proceed): keep checkShaderErrors=**true** through a
  boot-time `renderer.compileAsync(scene, camera)` pre-warm of the core program
  set (this is fix 1c, pulled forward as the *enabler* for 1a, not an optional
  extra), THEN set `checkShaderErrors=false`. Net: every program that exists at
  boot is validated once on the real device (Safari included); streaming
  programs after boot pay no sync stall. The dev `?debug` gate stays as a
  belt-and-suspenders authoring aid. This is the only form where production gets
  the perf win without trading it for a silent-failure class on mobile.

### Verdict

-   **Verdict**: **Proceed with mitigations.**
-   **Key Concern**: A bare `checkShaderErrors=false` flip shipped to the live
    Safari/iOS deploy trades a visible freeze for a *silent* black-screen /
    OOM-reload failure class on the exact runtime with the least telemetry and
    the most GLSL divergence (`threeShim.js:13-17`) — and 1a alone leaves the
    real monotonic program leak (`prog` 54→691, heap 97→416) running, so it's a
    symptom-mask, not the cure.
-   **Recommendation**: Ship 2a first (split hard-floor every-frame / soft-steer
    staggered; zero determinism exposure, confirmed against `selftest.js` and
    `spatialGrid.js`). Ship 1a to production only in its `compileAsync`-pre-warm
    form so Safari still validates the core programs once at boot. Treat 1b (the
    real leak) as a release blocker paired with 1a, not a follow-up — verify both
    on `?perf=low` AND `?perf=high` via the perf-log `prog` trend in the running
    game, never the sandbox. Park 2b's size-bucketing variant: it's the one fix
    that can flip a `closestBuilding` placement guard (`registry.js:143`,
    `chunks.js:1068+`) and shift the deterministic world; ship only the
    query-radius cap, which the grid's superset guarantee makes safe.

## Round 2 — Reactions

### (a) Does the tri-tier boot-verify satisfy me for a bare `checkShaderErrors=false`, or do I still demand the `compileAsync` pre-warm?

**Partial concession. I drop `compileAsync` as a *blocker*; I do NOT drop the verification it was standing in for. I move my requirement from a code mitigation to a process mitigation — but a *stronger* process gate than the four personas wrote.**

What moved me: **Architect** ("`compileAsync` pre-warms programs *for the materials currently in the scene*… If the leak is an unbounded distinct keyspace there is no finite set to pre-warm — new keys are minted from chunks that don't exist at boot", council-architect.md:122-131). That argument is correct and it directly undercuts my Round-1 enabler. The program set is NOT bounded at boot — it grows as you stream (`prog` 54→691, the leak 1b is hunting). So a boot-time `compileAsync(scene, camera)` validates only the title-card/spawn-hub program set, NOT the chunk-streamed materials a player actually hits minutes in. The exact materials most likely to diverge on Safari Metal (a chunk-streamed `onBeforeCompile` variant, a Lambert-path `#define` collapse) are precisely the ones NOT in the boot scene. My Round-1 mitigation was load-bearing on a false premise: it would have validated the wrong program set and shipped a *false sense of coverage*. Concede the mechanism.

What did NOT move me — **and where I split from the consensus**: **Profiler** (council-profiler.md:166-170), **Pragmatist** (council-pragmatist.md:133-136), **Auditor** (council-auditor.md:122-129), and **Architect** (council-architect.md:152-156) all assert the same load-bearing claim: *"the production shader set is fixed and already ships green; a silent-shader regression is a dev-time event caught in the dev/sandbox loop."* **That claim is half-true and the false half is exactly where the bug lives.** It is true that no shader is *authored* against the live deploy. It is **false** that "compiles in dev ⇒ compiles in prod," and the project's own primary tripwire says so in plain language: the threeShim Lambert swap exists *because* "Chrome desktop tolerated it, which is why the bug only surfaced in mobile testing" (`threeShim.js:13-17`). Dev is desktop Chrome/ANGLE; production-mobile is Safari/Metal. A GLSL program that links green in every dev/sandbox loop and links *broken* on Safari Metal is not a hypothetical — it is the documented failure class that the entire shim file was written to survive. With `checkShaderErrors=false`, that exact divergence ships a silent black object/screen to the iOS player with **no console line to screenshot** — and iOS-low is the *default* tier (`perf.js:25`), the Lambert path (`threeShim.js:46,62`), the one with the least telemetry. So "caught in the dev loop" is precisely the assumption the shim disproves. The four personas are reasoning from the desktop happy path; the tripwire is about the Safari unhappy path.

**Where I land:** the bare flip is shippable, but the tri-tier boot-screenshot the personas propose is **necessary and not sufficient** as they've scoped it. They scope it to *boot* (title card / spawn hub). A boot screenshot validates the boot program set — the same finite set `compileAsync` would have — and is blind to the chunk-streamed materials that mint after you drive. So my revised mitigation, stricter than the consensus:

1. The release gate for any shader-touching change must be a **drive-and-screenshot at `?perf=low` AND `?perf=high`** — `__dbg.start()` → drive across ≥4 chunk loads (low-tier Lambert path especially) → screenshot — **not** a boot-only smoke test. A silent break in a chunk-streamed material is invisible at the title card by construction.
2. Keep the `?debug`→`checkShaderErrors=true` gate (consensus) as the authoring net.
3. This is a **standing process gate on the shader surface**, not a one-time check at flip-time. Profiler at least gestured at this ("run the `?perf=low/mid/high` boot smoke check as a *release gate* whenever a shader-touching change ships", council-profiler.md:172-176) — I'm hardening "boot smoke" to "drive-and-screenshot," because boot doesn't exercise the streamed program population and that population is the whole risk.

Net on (a): **`compileAsync` pre-warm conceded as a blocker** (Architect's unbounded-keyspace argument is decisive). My block on the *bare flip* is **lifted** — conditional on a drive-across-chunks tri-tier screenshot gate, which is a hardened form of the verify the personas already accept, not a new demand. Verdict moves from "Block bare flip / Proceed only with compileAsync" to **Proceed with the drive-and-screenshot release gate.**

### (b) Is the grid-backed `closestBuilding` broadphase (Pragmatist's Slice-1 inclusion) determinism-safe to ship?

**Full concession — I was wrong to flag the broadphase itself as a determinism risk. It is safe, and I can now be precise about why, and about the one part that is genuinely not.**

I reacted to **Pragmatist**'s Finding 1 (council-pragmatist.md:34-54: route `closestBuilding` through `_fpGrid.forEachNear` in Slice 1). My Round-1 vulnerability claimed bucketing/reordering could "flip the boolean and shift placement." Having now read the function and every call site, **the broadphase as Pragmatist scoped it cannot flip any boolean.** Three facts settle it:

1. **`closestBuilding`'s distance test subtracts the footprint** — `d = Math.hypot(dx, dz) - e.footprint` (`registry.js:150`). A big-footprint entry whose *center* sits outside `radius` can still satisfy `d < radius`. This is the exact same hazard `footprintsNear` already solves by padding the grid query with `_maxFp` (`registry.js:112`). So the correct broadphase is `_fpGrid.forEachNear(x, z, radius + this._maxFp, fn)` with the existing exact test inside the callback. Padded by `_maxFp`, the visited set is a **documented superset** (`spatialGrid.js:8-9`: "returns a SUPERSET… never a subset… results match a full linear scan exactly"). Same min-selection over the same candidate set ⇒ **identical `best`**.

2. **Every call site is a boolean guard, not a value read** — I verified all 27: `chunks.js:499/1068/1154/1240/1243/1363/1468/1657/1681/2035/2071/2086/2238/2461/2481/2504/2573/2960`, `forests.js:909`, `lakes.js:711`, `obstacles.js:1114`, `starPower.js:415` — every one is `if (registry.closestBuilding(...)) continue/return`. None reads *which* entry came back. So even the theoretical residual risk (visit-order changing which entry wins an exact-float `bestDist` tie, since `d < bestDist` is strict and keeps first-seen) **collapses to nothing**: a tie still yields a non-null `best` either way, the boolean is unchanged, the guard trips identically, the downstream `rng()` stream is untouched. The superset guarantee makes even the null/non-null result identical; the boolean-only usage makes the tie-break irrelevant on top of that. Two independent reasons it's safe.

3. This is why **Pragmatist's "results are identical" (council-pragmatist.md:53-54) and Auditor's PASS on determinism (council-auditor.md:168) are correct** and my Round-1 caution was misaimed. I conflated *Pragmatist's broadphase* (preserves scan semantics exactly) with *the briefing's 2b bucketing* (could change scan semantics). They are different changes. **Concede the broadphase.**

**Precise split — what is safe vs. what is still risky:**
- **SAFE to ship in Slice 1:** the `_fpGrid.forEachNear(radius + _maxFp)` broadphase. Superset-preserving, boolean-only consumers, zero rng/draw-order shift. This is the good lever Pragmatist found. I withdraw my objection to it specifically.
- **STILL RISKY (and my Round-1 vulnerability stands, re-pointed):** any 2b variant that **caps the query reach below `radius + _maxFp`**, or **buckets oversized entries out of the queried grid**, turning the superset into a *subset*. Architect named the safe shape for that (council-architect.md:94-98: a *second grid* for oversized entries, query both — not a single capped grid). A subset-returning "optimization" would make a guard that should trip *not* trip → a prop/tree/camp spawns where the full scan would have blocked it → **placement shifts mid-world for anyone playing across the change**. That is the determinism break, and it routes through query *completeness*, not query *speed*. The broadphase doesn't go near it; a careless `_maxFp` cap does.

So: **broadphase = green, ship it; reach-capping/size-bucketing = red, gate behind a second-grid design or don't ship it.** I was wrong to color the whole region red.

**One residual caveat I keep (not a determinism risk — a scope-creep risk):** Pragmatist bundles the broadphase into the *same commit* as 1a (council-pragmatist.md:149-159). I side with **Profiler**'s one-variable objection (council-profiler.md:121-122: "don't smuggle a `closestBuilding` rewrite into the hang patch"). Not because the broadphase is unsafe — it's safe — but because it touches a function on the longest boot chain (`buildWorld → _generate → THEME_BUILDERS`) hit from 27 sites, and bundling it with the renderer-flag flip means a boot `TypeError` from the rewrite and a silent-shader regression from 1a land in one un-bisectable commit on exactly the path where "a boot-time TypeError is worse than a missing feature" (CLAUDE.md). Ship them as two commits, same wave. Pragmatist already offered this as the acceptable fallback (council-pragmatist.md:160-162) — take the fallback.

### Net Verdict change

My Round-1 verdict was **Proceed with mitigations**, with the mitigation being "1a only ships paired with `compileAsync` pre-warm." Two things moved:
- **`compileAsync` pre-warm dropped as the enabler** (Architect's unbounded-keyspace argument — it validates the wrong, boot-only program set). Replaced by a **drive-across-chunks tri-tier screenshot release gate** on the shader surface, which is the verify the streamed-material risk actually needs.
- **`closestBuilding` broadphase reclassified from "risk" to "safe, ship it"** — superset-preserving + boolean-only consumers; my determinism flag was misaimed at the broadphase when it belonged only on reach-capping/bucketing.

Verdict stays **Proceed with mitigations** — but the mitigation set is now tighter and better-targeted: (1) drive-and-screenshot tri-tier gate replaces the boot-only smoke test for 1a; (2) the grid broadphase ships, in its own commit, with the `_maxFp` pad intact; (3) the still-red item is narrowed to *subset-producing* `_maxFp` caps / size-bucketing, which need Architect's second-grid shape or a park; (4) 1b (the real monotonic leak) remains a release blocker paired with the wave, not a follow-up — nothing in Round 2 touched that, the leak still OOM-risks long iOS-low sessions regardless of 1a.
