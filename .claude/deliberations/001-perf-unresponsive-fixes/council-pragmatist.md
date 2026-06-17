## The Pragmatist's Position

### Critical Path

The user's actual blocker is "the page goes unresponsive after a while" on the
live deploy, observed by real players (GA4 wired). Two independent costs cause
it, and they are **decoupled** — one is a per-link sync stall, the other is a
steady-state CPU grind. That decoupling is the key to sequencing: neither fix
gates the other, so the critical path is "ship the cheapest thing that moves the
player-visible needle first, measure, then decide if the rest is even needed."

The longest dependency chain here is **not** in the code — it's in the
*measurement loop*. Every fix in this plan is verified the same way: ship it,
re-run `__dbg.recordPerf()` for ~160 s, read the `prog`/`fMax`/`fAvg` trend
(diagnosis doc, "Confirmation" section). The recorder already shipped (commit
`ed57cc6`). So the harness is done — that's the force multiplier already in
hand. The real critical path is:

1. Land 1a (one line, gated). Re-capture. Confirm the `getProgramInfoLog` spikes
   (the 88 % of every >150 ms task) are gone.
2. **Read the new trace before doing anything else.** 1a removes the *spike
   mechanism*. If the program-COUNT leak (54→691) is no longer producing
   visible stalls once the sync call is gone, the leak hunt (1b) drops in
   priority — it becomes a long-session heap concern, not an unresponsiveness
   bug. You cannot know that until 1a's trace is in hand. This is the single
   most important sequencing decision in the whole plan.
3. Land the cheap half of root cause 2 (`closestBuilding` broadphase — see
   below, it's a bigger win than the briefing's 2a/2b framing credits).

Everything else is measure-gated and parks cleanly.

### Force-Multiplier Findings (grounded in the code)

**Finding 1 — the real root-cause-2 win is `closestBuilding`, not NPC
separation throttling.** The briefing's fix 2a (throttle per-NPC separation) and
2b (audit `_maxFp`/`_maxCol`) both target `forEachNear`, but the crowd side is
already bounded: `MAX_NPCS = PERF.crowdMax` is hard-capped at 180/320/500 per
tier (`crowd.js:30`, `perf.js:59/79/94`). A capped crowd cannot be the
*unbounded* grind that grows "after a while." The thing that grows monotonically
with exploration is the **registry entry count** (~3000→4100, diagnosis doc).
And `closestBuilding` (`registry.js:143-157`) is a **full linear scan over
`this.entries.values()` — it does not touch the spatial grid at all**, unlike
its siblings `footprintsNear`/`collidersNear` (`registry.js:111-118`) which do.
It is called from **20+ sites in `chunks.js`** alone (`499, 1068, 1154, 1240,
1243, 1363, 1468, 1657, 1681, 2035, 2071, 2086, 2238, 2461, 2481, 2504, 2573,
2960`), plus `forests.js:909`, `lakes.js:711`, `obstacles.js:1114`,
`starPower.js:415`. Every one of those is O(n) over the *entire* resident
registry, and the heaviest cluster runs them in tight placement loops during
chunk gen. **Routing `closestBuilding` through `_fpGrid.forEachNear` (it already
exists, already maintained per-frame at `registry.js:90-104`) is the
force multiplier** — one ~10-line change converts 20+ O(n) hotspots to
O(cells) at once. This is a *better* lever than per-NPC throttling and it's
lower-risk (it's a pure broadphase prune; the grid contract guarantees a
superset, so results are identical — `spatialGrid.js:6-15`).

**Finding 2 — 1a is genuinely one line and genuinely reversible.** The renderer
is constructed at `main.js:103`. `renderer.debug.checkShaderErrors = false`
gated behind the existing debug flag is a true one-liner with a known three.js
production-guidance pedigree. Lowest effort, highest claimed leverage (kills the
88 %). This is the obvious Slice-1 anchor.

**Finding 3 — the program-leak hunt (1b) is open-ended and must NOT block the
ship.** The diagnosis is explicit: "The mint-source of unbounded distinct shader
cache-keys is **not yet identified**" and "Don't guess without that dump." An
unscoped hunt has no effort bound. Treating it as a Slice-1 blocker would hold a
shippable fix hostage to an investigation. It parks behind a diagnostic
(dump `renderer.info.programs[].cacheKey`, diff) that can run *after* 1a ships.

### Priority Sequence

1. **1a — `checkShaderErrors = false` (gated on `?debug`).** One line at
   `main.js:103` renderer block. Kills the per-link sync stall (the spike
   mechanism behind every >150 ms freeze). Highest leverage : lowest effort.
   Verify at `?perf=low/mid/high`, re-capture trace, confirm `getProgramInfoLog`
   gone from the CPU top.
2. **2 (revised) — route `closestBuilding` through the existing `_fpGrid`
   broadphase.** Converts 20+ O(n) call sites to O(cells) in one change. Same
   broadphase the other two queries already use (`registry.js:111-118`); the
   grid's superset guarantee (`spatialGrid.js:6-15`) means identical results.
   This is the bigger, cleaner half of root cause 2. Verify the chunk-gen
   `[chunk slow]` warnings (`chunks.js:339`) drop and `forEachNear` self-time
   falls in a fresh trace.
3. **2b — audit `_maxFp`/`_maxCol` radius inflation** (`registry.js:112/117`).
   Cheap to *investigate* (dump the largest footprint/collider kind), cheap to
   fix if one outlier is widening every query. Do it only if step 2's trace
   still shows `forEachNear` hot. Measure-gated.
4. **2a — throttle/cull per-NPC separation.** Only if the crowd separation scan
   (`crowd.js:1015`) still shows in the trace after steps 2/2b. The crowd is
   already capped, so this is the smallest remaining sliver — likely unnecessary
   once the registry-side O(n) work is gone. Stagger/round-robin risks the
   "NPCs visually stack" regression (`crowd.js:1010` comment: "always active —
   prevents the cluster-stack bug"), so it carries the highest behavioral risk
   for the smallest gain. Park it unless measured.
5. **1b — program-count leak hunt.** Diagnostic first (cacheKey dump + diff),
   then fix the mint source. Open-ended scope; runs *after* 1a's trace tells us
   whether the leak still bites once the sync stall is gone.
6. **1c — `compileAsync` pre-warm / pooling-disposal audit.** Pure polish.
   Park.

### Deferred / Park on ROADMAP

- **1b (program-count leak hunt):** Park behind a diagnostic. NOT blocked by
  shipping 1a — 1a removes the *stall*; the *count* leak is a separate
  long-session heap concern (`heapMB` 97→416, rising floor). The diagnosis
  itself says the source is unidentified and warns against guessing. Shipping
  1a first is strictly safe; the leak hunt loses nothing by waiting for 1a's
  trace.
- **2a (per-NPC separation throttle):** Park unless step-2's trace still shows
  `crowd.js:1015` hot. The crowd is capped (`crowd.js:30`), so this is bounded
  cost; the cluster-stack regression risk (`crowd.js:1010`) outweighs the
  likely-small win. Nothing downstream depends on it.
- **1c (`compileAsync` pre-warm, pooling/disposal audit):** Park. Pure
  steady-state polish. Pooling does "almost nothing for steady-state FPS"
  (`.claude/rules/performance.md`, allocation-vs-steady-state section); this is
  not the unresponsiveness bug.
- **`[chunk slow]` console spam** (`chunks.js:339`): Already correctly flagged
  "Secondary (not the unresponsiveness cause)" in the diagnosis. Park — but note
  step 2 (`closestBuilding` broadphase) will *incidentally* improve it, since
  that spam is partly gen-time `closestBuilding` cost.

### Production question — ship `checkShaderErrors = false` to live, or dev-only?

**Ship it to the live deploy.** Reasoning:

- The unresponsiveness is *reported on the live deploy*, by real players. A
  dev-only fix leaves the actual bug in front of actual users — that fails the
  whole point of the work.
- `checkShaderErrors = false` is standard three.js *production* guidance
  precisely because the sync `getProgramInfoLog`/`getShaderInfoLog` call is a
  dev-time validation aid, not a runtime feature. Players gain nothing from it
  being `true` and pay the per-link sync stall for it.
- The risk it trades away — "a genuinely broken shader fails silently (black/no
  draw) instead of logging" — is a *development* risk, not a production one. By
  the time code is on GitHub Pages, shaders that work in dev have already
  compiled. A silent-shader regression would be caught in the dev/sandbox loop,
  not by a console.warn a player will never read.
- The correct gating is exactly what the diagnosis proposes: **`true` on
  `?debug` (and ideally on local dev / `127.0.0.1`), `false` otherwise.** That
  keeps shader-authoring diagnostics fully intact for the agent loop while
  giving players the fix. This is the standard split and it's safe.

Caveat (a mitigation, not a blocker): land 1a behind the flag, then verify a
clean boot at all three tiers *with the flag off* before deploying — a broken
shader that previously logged loudly will now go quiet, so the one-time
verification matters. After that, ship to live.

### Incremental Delivery Plan

- **Slice 1 (ship first — single commit):** 1a (`checkShaderErrors = false`,
  gated) **+** step 2 (`closestBuilding` → `_fpGrid` broadphase). Both are
  small, both are independently safe, both attack one of the two root causes
  head-on, and together they cover the spike mechanism *and* the largest
  unbounded O(n) grind. Verify: boot clean at `?perf=low/mid/high`; re-capture a
  160 s perf-log; confirm `getProgramInfoLog` is out of the CPU top and
  `forEachNear`/`closestBuilding` self-time has dropped. CHANGELOG under
  `Performance`, remove/trim the ROADMAP "unresponsive" bullet to reflect what's
  left (the leak hunt). *Rationale for bundling these two: they're both
  one-to-few-line, both verified by the same single trace re-capture, and
  splitting them doubles the measurement cost for no safety gain.*
  - *If a reviewer prefers strict one-fix-per-commit:* ship 1a alone first
    (it's the lowest-risk, highest-leverage line), then `closestBuilding` as the
    immediate follow-up commit. Either is fine; I'd bundle.
- **Slice 2 (ship after, measure-gated):** 2b (`_maxFp`/`_maxCol` audit) and/or
  2a (separation throttle) — **only if** Slice 1's trace still shows
  `forEachNear` hot. If Slice 1's trace is green, Slice 2 may not exist at all.
- **Slice 3 (parked, diagnostic-gated):** 1b leak hunt — cacheKey dump + diff,
  then fix the mint source. Independent track; can start any time after Slice 1
  ships, runs on its own timeline.

### Effort Reality Check

- **1a:** genuinely one line + flag plumbing + a tri-tier boot verify. Real, but
  small. The only non-trivial step is the *measurement* re-capture, and that
  harness already exists.
- **`closestBuilding` broadphase:** ~10 lines, but DON'T undersell the verify —
  it touches a function called from 20+ chunk-gen sites and from worldgen
  guards. The grid guarantees a superset so determinism is safe (`spatialGrid.js`
  consumes no rng — file header), but a full game boot at all three tiers is
  mandatory (sandbox can't exercise `chunks.js` gen paths — CLAUDE.md "Smoke-test
  before declaring done"). Budget the boot-verify, not just the edit.
- **2a (separation throttle):** the briefing makes this sound simple. It is the
  *riskiest* item: staggering the separation scan can reintroduce the
  cluster-stack bug the code explicitly guards against (`crowd.js:1010`), and
  "skip off-screen NPCs" needs a frustum/distance test that itself costs
  something. High hidden effort, smallest payoff. Don't lead with it.
- **1b (leak hunt):** unbounded. Could be 30 minutes (one `#define` outlier) or
  a day (an `onBeforeCompile` cache-key bug). The diagnosis is honest that the
  source is unknown. Never put an unbounded investigation on the critical path
  of a shippable fix.

### Verdict

- **Verdict**: Proceed with mitigations.
- **Key Concern**: The plan's framing under-weights the cheapest, highest-impact
  root-cause-2 win — `closestBuilding` is a full O(n) linear scan
  (`registry.js:143-157`) hit from 20+ sites, while the spatial grid it should
  use already exists and is already maintained. Lead root cause 2 with that, not
  with per-NPC separation throttling (which is bounded and behaviorally risky).
- **Recommendation**: Ship Slice 1 = 1a (`checkShaderErrors = false`, gated,
  **to live** — it's standard production guidance and the bug is live) +
  `closestBuilding` broadphase, in one commit, verified by one trace re-capture.
  Park the program-leak hunt (1b) behind a cacheKey-dump diagnostic and the
  separation throttle (2a) behind a measurement — neither blocks the ship, and
  Slice 1's trace decides whether either is even needed.

## Round 2 — Reactions

### (a) Profiler: "don't smuggle `closestBuilding` into the hang patch — it breaks the one-variable rule for attributing the `forEachNear` win"

**Concede the commit boundary, reject the parking.** Profiler is right on the
attribution mechanics and wrong on the disposition.

Where I'm moved: Profiler (`council-profiler.md:121-122`, and again in the
Recommendation `:214-217`) and Auditor (`:51` "One-variable rule: don't bundle
this with 2a or you can't attribute the win") both land the same methodological
point, and it holds. `1a` is a *sync-stall* fix verified by `fMax` collapsing
(the 314/245/207 ms spikes). `closestBuilding`→grid is a *steady-state /
gen-time CPU* fix verified by `forEachNear`/`closestBuilding` self-time falling
in the trace. Those are **different metrics in the same re-captured trace** — so
I was wrong in Round 1 to say "splitting them doubles the measurement cost for no
safety gain" (`council-pragmatist.md:159`). It does **not** double the
measurement cost: one 160 s re-capture reads *both* `fMax` (for 1a) and
`closestBuilding` self-time (for the broadphase) simultaneously. The cost of
separate commits is one extra `git commit`, not one extra trace. My own
"doubles the measurement" rationale was the load-bearing reason to bundle, and
it's false. **So: two commits, not one. I revise that.**

Where Profiler did NOT move me: Profiler parks `closestBuilding` to ROADMAP
entirely (`:122` "not part of this hang fix"; `:191`; `:214` "as ROADMAP"). I
reject that, and the irony is that Profiler's own evidence is why. Profiler
writes (`:114-117`) that `starPower.js:415` "calls it in a loop during star
power, which is exactly the worst-trace session" — i.e. the single most
unresponsive capture in the diagnosis is partly *driven by the O(n)
`closestBuilding` scan Profiler wants to park*. You cannot name a fix as a
contributor to the worst hang capture and then file it under "different symptom,
ship later." The "allocation-time, not the hang" framing (`:191`,
`council-adversary` echoes it at `:120`) is too clean: `closestBuilding` is
called from `starPower.js:415` and `crowd.js`-adjacent steady drive paths, not
only chunk-gen. It is gen-time *and* it spikes the worst session. That's
in-scope for "the page goes unresponsive."

**Net on (a):** I split Slice 1 into two commits — `1a` first (attribution-clean
for `fMax`), then `closestBuilding`→`_fpGrid` as an *immediate* second commit
(attribution-clean for `closestBuilding` self-time), both inside the same ship
wave, both read off one re-captured trace. I do NOT park it to ROADMAP. This is
exactly the "either is fine; I'd bundle" escape hatch I already wrote at
`council-pragmatist.md:160-162` — Profiler's one-variable argument tips it to the
two-commit form, which I'd flagged as acceptable. Note the Architect (`:78-99`)
and Adversary (`:41`) independently confirm the *safe shape*: keep
`closestBuilding`'s scan **semantics** identical (superset-safe min selection),
route only the *iteration* through the grid. That's a pure broadphase prune, not
a re-bucketing — so it carries none of the placement-flip risk Adversary flags
for 2b's *bucketing* variant (`:41`). My broadphase proposal and Adversary's 2b
veto are not in conflict; they're different changes.

### (b) Adversary: "1a must be coupled with a `compileAsync` boot pre-warm, not a bare flip — Block without it"

**Concede the boot-validation gate; reject pulling the full `compileAsync`
pre-warm into Slice 1, and reject calling a bare gated flip a Block.**

Adversary's real worry (`council-adversary.md:33,35,37`) is sound and I take it:
with `checkShaderErrors=false`, a shader that compiles on Chrome/ANGLE but fails
on Safari Metal ships a **silent black object** to the runtime we have the least
telemetry on, and the `?debug` gate *inverts* safety because every dev runs with
errors ON and every player runs with them OFF (`:35`). The threeShim header
precedent (`threeShim.js:13-17`, "only surfaced in mobile testing") is a real
scar, not a hypothetical. That much is conceded.

But there are two different things bundled in Adversary's "mitigation" (`:37`,
`:66`), and they have very different costs:

1. **A one-time boot-time compile-and-validate of the core program set with
   `checkShaderErrors` still `true`, THEN flip to `false`.** This is cheap,
   bounded, and it's the actual safety mechanism. It closes the silent-Safari-
   break window for every program that exists at boot.
2. **A full `renderer.compileAsync(scene, camera)` pre-warm as fix 1c "pulled
   forward" (`:66`).** This is the part I push back on — and the *rest of the
   council agrees with me, not Adversary*. Architect (`:122-131`) and Profiler
   (`:55-57`, `:128`) both establish that `compileAsync` pre-warm is the **wrong
   tool for an unbounded keyspace**: the leak is `prog` 54→691 *monotonic from
   chunks that don't exist at boot* (Architect `:127` "there is no finite set to
   pre-warm — new keys are minted from chunks that don't exist at boot"). So
   pre-warming the *boot* scene neither fixes the leak nor validates the streaming
   shaders that mint after boot. It is not load-bearing for either the perf win or
   the Safari-safety goal.

So the question "does the extra work belong in Slice 1?" splits cleanly:

- **The boot-validate-then-flip (item 1) — YES, it's in Slice 1.** It's small,
  it's the mitigation that turns Adversary's Block into Proceed, and it's exactly
  the kind of one-time boot config that already lives next to the renderer
  (`main.js:103-114`). It does NOT bloat the smallest-safe-slice — it *is* what
  makes the slice safe. I fold it in.
- **The full `compileAsync` scene pre-warm (item 2) — NO, it stays parked.**
  Pulling it forward is solving a problem (first-encounter stall smoothing) that
  isn't the hang, against a keyspace the council agrees is unbounded. That's
  scope bloat dressed as a safety requirement.

Crucially: Adversary's silent-Safari-break risk is *also* covered, more cheaply,
by the mitigation **every other persona already requires** — the visual
three-tier boot smoke check (Architect `:162-169`, Profiler `:135`, Auditor
`:131-137`). A black object on `?perf=low` (the iOS default tier, `perf.js:25`)
is caught by *looking at the render at low tier*, which is mandatory anyway per
CLAUDE.md "ALWAYS boot the main game" + "verify on `?perf=low/mid/high`." The
boot-validate-then-flip is belt; the tri-tier visual check is suspenders. Both
are cheap. The full `compileAsync` pre-warm is a third mechanism that's heavier
than either and doesn't even validate the post-boot streaming shaders that are
the actual Safari-divergence risk.

**Net on (b):** Slice 1's `1a` is **not** a bare flip — it's
`compile-core-set-with-errors-on → flip-to-false`, plus the mandatory tri-tier
visual boot check. That satisfies Adversary's safety bar without importing the
full `compileAsync` pre-warm (1c), which Architect and Profiler independently
show is a non-fix for the unbounded keyspace. The smallest *safe* slice includes
the boot-validate; it does not include speculative pre-warm.

### Where the council converged (and it changes my park list)

Auditor's mechanical finding (`council-auditor.md:32-74`) that the dispose-safety
convention is **already honored at every real teardown path** (`chunks.js:543`,
`lakes.js:866`) and that a re-disposed material *reuses its cache-key* (so it
oscillates, not climbs — it cannot produce the monotonic `prog` 54→691) is the
strongest single piece of analysis in the round. It moves my Slice-3 framing: the
pooling/disposal half of 1c isn't just "park it," it's "the evidence *exonerates*
it — don't ship it on spec at all." The 1b cacheKey dump must name the mint source
before any pooling work; pooling-on-spec would churn correct code. I adopt that.

### Revised Verdict

- **Verdict:** **Proceed with mitigations.** (Unchanged.)
- **Key Concern:** (Unchanged in substance — `closestBuilding` is the
  under-weighted O(n) lever — but now with the attribution caveat.) Lead root
  cause 2 with the `closestBuilding`→`_fpGrid` broadphase, but ship it as its
  **own commit** so its `closestBuilding`-self-time win is attributable
  independently of 1a's `fMax` win. Both read off one re-captured trace.
- **Recommendation (revised):**
  - **Slice 1 = two commits, one ship wave.** Commit A: `1a` =
    *compile-core-program-set-with-`checkShaderErrors=true` at boot, then flip to
    `false`* (gated `true` under `?debug`), to **live** — this is the
    boot-validate-then-flip form, NOT a bare flip, and it closes Adversary's
    silent-Safari-break window without importing the full `compileAsync`
    pre-warm. Commit B (immediate follow-up): `closestBuilding`→`_fpGrid`
    broadphase, scan semantics preserved exactly (superset-safe min selection).
    Verify the whole wave with ONE 160 s re-capture reading `fMax` (Commit A) +
    `closestBuilding`/`forEachNear` self-time (Commit B), plus a **visual**
    tri-tier boot check at `?perf=low/mid/high`. Each commit carries its own
    `### Performance` CHANGELOG entry; trim (not delete) the two-cause Bugs bullet
    at `ROADMAP.md:9-21`.
  - **What I conceded from Round 1:** two commits, not one (Profiler's
    one-variable point — and my own "doubles the measurement cost" rationale was
    simply wrong: separate commits cost one `git commit`, not one trace).
  - **What I held:** `closestBuilding` stays in *this* ship wave, not ROADMAP —
    Profiler's own evidence (`:114-117`, it's in the worst-trace star-power
    session) makes parking it incoherent. And the full `compileAsync` pre-warm
    stays parked — Architect (`:122-131`) and Profiler (`:55-57`) prove it's a
    non-fix for an unbounded keyspace; the boot-validate-then-flip is the cheap
    safety mechanism, not the whole pre-warm.
  - **Slice 2 (measure-gated):** 2b `_maxFp`/`_maxCol` audit, then 2a
    soft-steer-only stagger (hard-overlap floor every frame, per Adversary `:43`
    / Architect `:60-69`) — only if Slice 1's trace still shows `forEachNear`
    hot. Likely thin once the registry-side O(n) is gone.
  - **Slice 3 (diagnostic-gated):** 1b cacheKey dump as a `__dbg` affordance.
    1c's pooling half is **exonerated by Auditor's audit** — do not ship on spec;
    1c's `compileAsync` pre-warm is a non-fix for the unbounded keyspace. Both
    wait on 1b naming the mint source.
