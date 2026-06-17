## Round 2 — Reactions

### (a) Pragmatist's `closestBuilding → _fpGrid` broadphase — I concede this, with a structural correction that makes it *more* clean, not less

**Pragmatist (Finding 1, Critical Path step 3) and Profiler (Allocation vs
steady-state note) both land the same point: the real unbounded root-cause-2
work is `closestBuilding` (`registry.js:143-157`), a full O(n) scan over
`this.entries.values()`, called from 20+ chunk-gen sites — not the capped crowd
separation. They convinced me.** My Round-1 sequence under-weighted this: I put
2b (the `_maxFp`/`_maxCol` padding audit) at priority 4 and never named
`closestBuilding` as the bigger registry-side lever. The Pragmatist's site
enumeration (`chunks.js:499/1068/1154/1240/...`, `forests.js:909`, `lakes.js:711`,
`obstacles.js:1114`, `starPower.js:415`) and the Profiler's observation that
`starPower.js:415` runs it *in a loop during the worst-trace session* are
concrete, cited, and correct. This is a registry-internal change — exactly the
module home I argued 2b belongs in — so it sits squarely inside the boundary
discipline I care about. I'm revising it up to priority 2.

**But I have verified the routing against the actual semantics, and the
Pragmatist's "drop-in, identical results" claim needs one structural guard to be
true.** I read `closestBuilding` and `forEachNear` line-by-line:

- `closestBuilding` computes `d = Math.hypot(dx, dz) - e.footprint` and accepts
  any entry with `d < radius` (`registry.js:150-151`). So an entry qualifies when
  its *center* is within `radius + e.footprint` — the reach is inflated by the
  candidate's **own footprint**, not by a fixed radius.
- `_fpGrid.forEachNear` visits cells covering `[pos ± query_radius]`
  (`spatialGrid.js:49-50`), and `footprintsNear` already pads the query by
  `this._maxFp` (`registry.js:112`) — the **largest** footprint in the registry.

That `_maxFp` padding is precisely what makes the broadphase superset-safe for
`closestBuilding`: any entry that could satisfy `d < radius` has its center at
most `radius + e.footprint ≤ radius + _maxFp` away, so it lives in a cell the
padded query visits. The grid returns a superset; the exact `hypot - footprint`
test inside the callback does the real selection and picks the true minimum.
**The SpatialGrid superset contract I flagged in Round 1 is preserved — but only
if the port reuses the `+ _maxFp` padding (i.e., goes through `footprintsNear`,
or replicates its padding), not a bare `forEachNear(x, z, radius, ...)`.** A
naive port that pads by `radius` alone would turn the superset into a *subset*
and silently drop a large building (stage/truck footprint) whose center sits just
outside `radius` but whose footprint reaches in — the exact correctness
regression I warned about for 2b, now reachable through this fix instead. So:
concede the lever, but the implementation note is **route through
`footprintsNear`'s padding discipline, and add `excludeKinds` filtering inside the
callback** (the current default excludes `'tree'`). With that, results are
provably identical to the linear scan and the boundary stays clean.

This also subsumes my Round-1 2b: once `closestBuilding` rides the `_fpGrid`, the
`_maxFp` inflation the Profiler/Adversary worried about becomes the *shared*
padding for all three registry queries. If one oversized footprint is bloating
`_maxFp`, it now bloats `closestBuilding` too — which makes the 2b audit (find
the fat footprint) a strict prerequisite-or-companion, not a separate parked item.
They're the same registry-policy surface.

### (b) Adversary's `compileAsync` pre-warm as a 1a Safari safety net — I concede it has legitimate, *distinct* value, and I now know exactly where it belongs structurally

In Round 1 I called `compileAsync` "a non-fix for the leak" and parked it. **I
stand by that narrow claim — it does nothing for the unbounded keyspace — but the
Adversary (Vulnerabilities #2, #3, and the mitigation at line 37/63-70) is making
a *different* argument I did not address, and it's correct.** His point is not
"compileAsync fixes the leak." It's: gating `checkShaderErrors=false` on `?debug`
makes **production the untested path** — every developer verifies with the flag
*on* (errors visible), every player runs with it *off* (errors silent), so a
shader that compiles on Chrome/ANGLE but fails on Safari/Metal ships a silent
black object to the one runtime with the least telemetry and the most documented
GLSL divergence (`threeShim.js:13-17`). That inversion is real and I missed it.
My Round-1 production answer leaned on "the shader set is fixed at ship time," but
the Adversary's rebuttal is that *fixed* ≠ *validated on the target runtime* —
Chrome-green is not Metal-green.

His mitigation closes it without re-coupling anything: keep `checkShaderErrors =
true` through a **one-time** boot-time `renderer.compileAsync(scene, camera)`,
*then* flip it to `false`. Net: every program present at boot is link-validated
once on the real device (Safari included); streaming programs after boot pay no
per-frame sync stall. That is a genuine safety net, and it is **structurally
distinct from leak-fixing** — it's a boot-sequence validation gate, not a
hot-path change.

**Where it belongs structurally — and this matters for boundary cleanliness:** it
is a *boot-order* concern, so it lives in `main.js`'s init sequence, adjacent to
the renderer construction and the `checkShaderErrors` set itself (after
`main.js:114`), strictly *before the title-card gesture completes* so the
one-time async compile is invisible behind the title card (the same place the
project already does first-frame setup). It must NOT live in `threeShim.js` (same
Round-1 reasoning: that file is module-resolution-time, has no renderer instance,
no scene). And the ordering is load-bearing and easy to get wrong:
`checkShaderErrors = true` → `await renderer.compileAsync(scene, camera)` →
`checkShaderErrors = (debug flag)`. Flip the flag before the compile and you've
validated nothing.

**One structural caveat I'll add that the Adversary didn't:** `compileAsync` only
validates the materials *in the scene at boot*. At the title card the world isn't
streamed yet — the scene is near-empty — so the pre-warm validates the cart, the
core shim materials, the post-process/Trip/FXAA passes, and whatever the boot
scene holds, but NOT the per-chunk theme materials minted later. That's still a
real net positive (the cart's star-power `onBeforeCompile` patch and the threeShim
Lambert swap — the two paths the Adversary names as Safari-divergence risks — are
both present at boot), but it is a *partial* validation gate, not a total one. So
I'd accept it as the shippable form of 1a-to-production **and** keep my Round-1
required mitigation (the visual three-tier boot check at `?perf=low/mid/high`),
because the low-tier Lambert program path is exactly the set `compileAsync` may
not fully exercise at an empty-scene boot. Belt and suspenders: compileAsync
validates the boot set on the real device; the tri-tier visual check catches the
streamed-material silent-fail the boot pre-warm can't reach.

This reverses my Round-1 "park 1c's pre-warm." I now sequence the `compileAsync`
pre-warm as a **coupled enabler of 1a-to-production**, not parked — while keeping
it explicitly separate from (and not a substitute for) the 1b leak hunt, which
remains the real cure for the monotonic `prog` climb.

### Where I did NOT move

- **Profiler/Adversary/Auditor all converge with me that 1a hides the symptom,
  not the leak (`prog` 54→691, heap 97→416), and that 1b is a release-tracked
  follow-up, not optional.** No friction — this strengthens my Round-1 priority 3.
  I'll only sharpen: the Adversary calling 1b a "release blocker paired with 1a"
  vs. the Pragmatist "parks behind a diagnostic, doesn't block the ship" is a real
  disagreement, but it's a *scheduling* call outside my lens. Structurally my
  position holds either way: 1b is instrumentation-first on the `__dbg` surface
  (Auditor confirms the `recordPerf` recorder already samples `prog`, so it's an
  extension of an existing affordance, not a new subsystem or importmap touch),
  and no program-leak *fix* gets written before the cacheKey dump names the mint
  source.

- **The Auditor's exoneration of 1c-as-disposal-fix reinforces my Round-1
  conditional park.** He mechanically confirms the dispose-safety convention is
  honored at every real teardown (`chunks.js:543`, `lakes.js:866`) and that a
  re-disposed material *reuses* its cache-key (oscillates, not climbs) — so it
  cannot produce the monotonic `prog` growth. That's a cleaner proof than my
  "conditional on 1b" hedge. I adopt it: **don't ship 1c's pooling half on spec**;
  the evidence already clears the shared-material churn hypothesis. (His
  `main.js:1560` `showColliders` missing-guard note is a real hygiene nit but
  dev-only and out of scope — agreed.)

- **2a hard/soft split — unanimous, no movement needed.** The Adversary and
  Auditor independently reached my Round-1 split (every-frame hard-overlap floor,
  staggered soft steering) and the deterministic-round-robin-not-`Math.random()`
  requirement. The Adversary's affirmative clearance against `selftest.js` and the
  `spatialGrid.js` no-rng header confirms 2a has nil golden-snapshot exposure —
  green light, as I said. The only revision is *priority*: the Pragmatist is right
  that 2a is the smallest, riskiest, capped-crowd sliver, so it drops below the
  `closestBuilding` port in sequence — but its structural shape is unchanged.

### Revised Verdict

- **Verdict**: Proceed with mitigations. (Unchanged.)
- **What moved me**: Two arguments landed. (1) The Pragmatist + Profiler
  `closestBuilding → _fpGrid` broadphase is a cleaner, higher-impact registry-side
  fix than my Round-1 2b framing — and I verified it preserves the SpatialGrid
  superset contract **provided it reuses `footprintsNear`'s `+ _maxFp` padding and
  applies `excludeKinds` in-callback**; a bare `forEachNear(x,z,radius)` would turn
  superset into subset and silently drop large buildings. I'm revising it up to
  priority 2 and folding my old 2b into it (same `_maxFp` policy surface). (2) The
  Adversary's `compileAsync` boot pre-warm is *not* a leak fix (I was right there)
  but **is** a legitimate, distinct Safari validation gate that closes the
  "production is the untested path" inversion in 1a's `?debug` gating — it belongs
  in `main.js`'s boot sequence before the title card, ordered
  `checkShaderErrors=true → await compileAsync → checkShaderErrors=flag`, and I'm
  un-parking it as a coupled enabler of 1a-to-production (with my tri-tier visual
  check retained, because an empty-scene boot pre-warm can't validate
  later-streamed chunk materials).
- **Revised Recommendation**: Ship 1a (production, debug-gated, **with the
  `compileAsync` boot pre-warm ordered before the flag flip**, plus the visual
  three-tier boot check) and 2a (hard/soft split, deterministic round-robin) as
  the first wave. Add the **`closestBuilding → _fpGrid` port** as priority 2 of
  the registry work — routed through `footprintsNear`'s `+ _maxFp` padding so it's
  superset-faithful and identical to the linear scan — which subsumes my old
  standalone 2b. Run 1b instrumentation-only on `__dbg` to name the mint-source
  before any program-leak fix. Don't ship 1c's pooling half on spec — the
  Auditor's cache-key-reuse proof exonerates it.
