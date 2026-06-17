# Council Deliberation — The Adversary

## The Adversary's Order of Operations

### Priority Sequence

The plan's instinct to put the determinism self-test in §1.3 is right, but it is
sequenced as a *helper*, not a *gate*, and the self-test as written is too weak to
catch the failure modes that will actually bite. My reordering forces the hardest
determinism proofs to happen on the cheapest possible artifact (a stub field)
before any feature work earns the right to proceed.

1. **Prove the seeding primitives are integer-domain and engine-portable BEFORE
   any feature uses them (§1.2 first, hardened).** Every `hash2` input must be a
   true 32-bit integer. `hash2` already coerces with `x | 0` (`rng.js:42`), but
   that means the *contract* is "I will silently truncate your float." The moment
   a worldgen layer wants to hash a *float* (a jittered heart position, a curve
   sample point, a distance), the author must quantize it deliberately — and the
   quantization scheme itself becomes part of the determinism contract. Lock this
   down and write it into the `pairHash`/`edgeHash` helper signatures before
   hearts.

2. **Upgrade the §1.3 self-test from "two traversal orders" to a real adversary
   harness BEFORE building hearts.** See "Is the self-test theater?" below. Re-
   ordering the same query loop proves almost nothing.

3. **Build hearts (§2), then immediately run the windowing test against
   `nearestHeart` — not after roads.** `nearestHeart` over a "bounded macrocell
   neighborhood" (§2.3) is the first place a too-small window silently returns a
   *wrong but stable* answer. Prove the window bound against jitter + mega 2×2
   suppression before any road depends on it.

4. **Derive the proximity-graph lookup radius as a math bound, not "generous"
   (before §4.1).** See "The generous lookup radius" below.

5. **Roads (§4) with the seam-crossing curve proven byte-identical from both
   sides — using integer-quantized sample parameters, not raw floats.**

6. **Defer rivers (§8) — and seriously consider cutting them from this change.**
   See "Rivers" below. They are the hardest determinism problem and the self-test
   does not cover them at all.

7. **Only then: density, roles, point inspector.**

The principle: **prove the unhappy path on a stub before building the feature.**
Every layer added before the windowing/boundary test is hardened is a layer you
must re-audit later.

### Vulnerabilities Found

#### Determinism — where order-dependence sneaks back in

D4 ("edge/pair-seeded, never forward-passed") is the correct *architecture*, and
it genuinely defeats the load-order/unload-reload class of bug (chunks unload past
`UNLOAD_RADIUS`; `lakes.js:111-120` already rebuilds deterministically on return —
the precedent works). But D4 is a property of the *seeding*, not of the *whole
generator*. The generator can be perfectly pair-seeded and *still* be non-
deterministic in four concrete ways the plan does not address:

-   **`nearestHeart` window truncation produces wrong-but-stable answers.** —
    `nearestHeart` (§2.3) scans a "bounded macrocell neighborhood." If the window
    is N×N cells and the true nearest heart — after jitter — falls just outside
    that window for query point A but inside it for query point B, then A and B
    disagree about "the nearest heart," and *every* downstream layer (role tier,
    road graph, density clearing) inherits the disagreement. This is NOT caught by
    the §1.3 "query twice" test, because a given point always truncates the same
    way. It only surfaces when two *different* points that should share a nearest
    heart compute different ones, or when you widen the window and the answer
    changes. Severity: **Critical** — it's the determinism cardinal sin (footgun
    #4) wearing a disguise: locally stable, globally inconsistent.

-   **Float non-associativity in meander-curve summation.** — D5/D7 meanders are
    "deterministic curves." If a curve is evaluated as a sum of sinusoids or a
    layered-noise accumulation (the lake outline already does this —
    `lakes.js:138` "two layered sin perturbations"), the *order of summation*
    changes the last ULP. That's fine within one engine, but a road sampled
    "from region A's side" walking the parameter `t` forward and "from region B's
    side" walking it backward (or starting at a different `t0`) can produce
    `f(t)` values that differ in the low bits — and if any consumer then quantizes
    that to an integer cell or a hash input, the low-bit difference crosses a
    rounding boundary and the two sides disagree. Severity: **High** — exactly the
    seam-kink/boundary-disagreement the plan waves at with "perpendicular crossing"
    but never pins numerically.

-   **`Math` transcendental divergence across engines.** — `Math.sin`, `Math.cos`,
    `Math.pow`, `Math.hypot`, `Math.atan2` are NOT bit-identical across JS engines
    (V8 vs JavaScriptCore/Safari vs SpiderMonkey/Firefox). ECMA-262 explicitly
    permits implementation-defined results for these. The meander curves
    (`sin`/`cos`), the role-tier `angle` (`atan2`), and any `hypot` distance all
    use transcendentals. A heart-spacing or river-avoidance test that passes
    byte-identical in the dev's Chrome can disagree in the *last bits* on a
    player's Safari — and again, if those bits feed a quantize→hash or a `<`
    threshold, the disagreement becomes a *visible* layout fork (a road present on
    one device, absent on another). Severity: **High**, and it is **invisible in a
    single-browser sandbox** — the exact sandbox-pass-≠-real-pass trap. The
    sandbox runs in *one* engine.

-   **JS object/Map key-ordering as a hidden input.** — If the proximity graph
    collects candidate hearts into an object/Map and then iterates to pick "the
    nearest few," insertion order leaks into the result whenever distances tie or
    a "first K" cut is taken. Candidates discovered by scanning cells in a
    different window order land in a different iteration order. The fix (sort by a
    total order — distance, then a tiebreaker on the heart's integer cell id — and
    never rely on Map iteration order) is easy, but it is *not stated anywhere* in
    design or tasks. Severity: **Medium**, trivially avoidable but a classic miss.

#### The "generous lookup radius" (D6) — prayer, not guarantee

D6 says arterials use a relative-neighborhood/Gabriel-style graph and reads "a
deliberately generous macrocell neighborhood," with the radius "verified
empirically in the sandbox." This is the weakest load-bearing claim in the whole
design.

-   **The radius has an actual derivable bound; "generous + eyeballed" is a
    latent ship-blocker.** — In a relative-neighborhood graph, hearts A and B are
    connected iff *no third heart C* lies in the lens (intersection of the two
    disks of radius |AB| centered on A and B). To decide A–B you must be certain
    you've seen *every* C that could be in that lens. With heart cells of size
    `HEART_CELL` and jitter up to `±J`, the farthest a connectable neighbor B can
    sit is bounded, but the *blocker* C can sit anywhere in the lens — which for a
    long edge A–B extends well beyond B. So the window needed to *confirm* an edge
    is a function of the longest edge you'll admit, not of the cell size. If you
    cap edges at "nearest few neighbors" you bound it; if you don't, the window is
    unbounded. Severity: **High** — "verify empirically" cannot prove a *negative*
    (that no farther-out config breaks it). The sandbox can show you 100 seeds that
    work and the 101st player seed forks a road across a region seam. **Concrete
    failure case:** two minor hearts A and B are ~1.4 cells apart and would be RNG-
    connected; a *major* heart C sits ~2.1 cells away in the lens. A query window
    centered near A that extends 2 cells sees A and B but *not* C → draws the
    arterial. A query window centered near the A–B midpoint that extends 2 cells in
    all directions *does* see C → suppresses the arterial. Same world point, two
    windows, two answers. Demand: derive the bound from the edge-length cap and
    encode it as `ROAD_NEIGHBORHOOD_R = ceil(maxEdgeLen/HEART_CELL) + jitterPad`,
    with the §9.2 multi-origin test asserting agreement *at that radius and one
    smaller* (the smaller must FAIL, proving the test has teeth).

#### Rivers (D7/§8) — routing around hearts over an infinite plane

-   **"Routed around heart cores" can depend on hearts outside the local
    window.** — A river is a pair-seeded meander between lake L1 and L2 (good,
    deterministic *endpoints*). But "bend around heart cores" means the curve's
    shape depends on *which hearts are near the curve* — and the curve can pass
    arbitrarily far from both lakes. To compute the river's deflection at param
    `t`, you must know every heart whose core the curve would otherwise hit, which
    requires a window around the *whole curve*, not around either endpoint. If the
    avoidance reads only hearts near L1/L2 (a natural but wrong implementation),
    then a heart sitting mid-span outside that window is *not* avoided from one
    query path and *is* avoided when the window happens to include it → the river
    crosses a heart core in one render and detours in another. This violates the
    spec's own hard requirement "Rivers SHALL never pass through a heart core"
    (`spec.md:81`) *non-deterministically*. Severity: **Critical** for the river
    layer specifically; it is why I'd cut rivers from this change.

-   **Bridge-intersection determinism is a float root-find.** — "Bridge = road ×
    river intersection" (§8.2) is finding where two parametric curves cross. That's
    a numerical root-find; its result depends on sample step, starting bracket, and
    transcendental evaluation order — all the float/`Math` hazards above, now
    *compounded* across two independently-meandered curves. Two regions that each
    "own" part of the crossing can land the bridge at slightly different points.
    Severity: **High** — bridges are the most coupled, least determinism-friendly
    primitive, built last for good reason, but the self-test (§9) never exercises a
    road×river crossing for agreement.

#### Sandbox-pass ≠ game-pass — the deferred 3D landmine

CLAUDE.md's motivating failure (`buildCampChair` returns `{group,color,footprint}`,
the chunks call site forgot) is *exactly* the class this plan re-creates at larger
scale: a clean, isolated harness that exercises a *different code path* than the
eventual integration.

-   **The 2D sandbox runs one JS engine; the live game runs on every player's
    browser.** — The single most dangerous thing the sandbox will say "ship it" on
    is **engine-portable determinism**. The sandbox proves the data is internally
    consistent *in Chrome*. It cannot prove the meander/angle/distance math is
    bit-identical on iOS Safari, which is precisely where the threeShim freeze and
    the iOS-audio bugs already taught this project that "Safari is a different
    runtime." When the v2-worldgen integration ships and a player on Safari sees a
    road that the dev's Chrome sandbox never drew, the determinism contract is
    *already* broken and no one will know until a player reports a seam. Severity:
    **High** — and the mitigation (force all hash inputs through explicit integer
    quantization so transcendental low-bits *never* reach a hash or a threshold) is
    a design constraint that must be set NOW, while the generator is being written,
    not retrofitted during 3D integration.

-   **The 2D model may under-capture data the 3D port needs — but that's a
    feature-completeness risk, not mine to own.** I flag only the determinism
    facet: if the 3D port later adds heights/collider-radii/facing and seeds *any*
    of them, that's new randomness that must use fresh salts (footgun #4) and must
    not reorder the existing worldgen `rng()` draws. The plan should state that the
    point-query tuple is *append-only* across the 2D→3D boundary: the 3D port may
    add fields but must never reorder or re-salt the draws that produce the
    existing ones, or every 2D-tuned seed regenerates. Severity: **Medium**, future
    change, but cheap to write into the determinism contract doc (§10.3) today.

-   **`?seed` reproducibility couples to `setSessionSeed` string-hashing.** — The
    sandbox takes a seed "via input and/or URL param" (`spec.md:14`). `rng.js`'s
    `setSessionSeed` (`rng.js:21`) FNV-hashes *strings* but truncates *numbers* via
    `(seedInput | 0) >>> 0`. If the sandbox parses the URL param as a Number but the
    future 3D game's `main.js` passes the raw string (or vice-versa), the *same*
    visible seed text produces two different `SESSION_SEED`s → the map the dev tuned
    in the sandbox is NOT the map the player gets. The plan must pin: the sandbox
    resolves its seed through the *identical* `setSessionSeed` path the game uses,
    and echoes back the resolved 32-bit int (which `setSessionSeed` already returns).
    Severity: **Medium**, a silent reproducibility fork hiding in plain sight.

#### Is the §1.3 / §9 self-test strong enough — or theater?

As written, **it is closer to theater than to a gate.** §1.3 / §9.1: "query a set
of points in two different traversal orders and assert byte-identical." Because
`queryPoint(seed,x,z)` is a pure function with no shared mutable state, querying it
in a different *order* is guaranteed identical by construction — the test passes
trivially and proves nothing about the bugs above. It is the equivalent of testing
that `Math.abs(-3)` returns the same value if you call it after `Math.abs(-5)`.

To have teeth, the self-test must assert the things that can actually differ:

1.  **Window-invariance** (the real D6 test, partially in §9.2): same world point,
    *different neighborhood-window origin AND size* → identical tuple. And a
    *negative* control: a window one cell too small must *fail*, proving the bound
    is tight, not just large.
2.  **Boundary agreement with a constructed crossing** (§9.1 mentions it but with
    no method): take a known arterial that crosses a region seam, sample it from
    A's side and B's side, assert the crossing point and curve match to the *exact
    bit* — not "to within epsilon," because epsilon-equality hides the quantize-
    boundary fork.
3.  **Serialize→reparse round-trip**: `JSON.stringify` the tuple, reparse, re-query,
    assert equal — catches `-0` vs `0`, `NaN`, and float-formatting drift that a
    naive `===` in-memory comparison misses.
4.  **Cross-engine canary (the one the project's own history demands)**: capture a
    golden hash of N tuples across M seeds in the dev engine and check it into the
    repo; the future 3D integration re-computes it on the target browsers. Without
    this, "deterministic" means "deterministic in Chrome," which footgun-#4 and the
    Safari-freeze history say is not good enough.

Severity of leaving the test as-is: **High** — a green self-test will be cited as
"determinism proven" when it has proven only purity.

### Anticipated Tensions

-   **Tension with the Maverick (and the proposal's own scope):** the Maverick will
    likely defend keeping rivers in-scope ("built last, isolated, shippable
    skeleton without them" — D7/Risks). I agree the *skeleton* is shippable without
    them; I disagree that prototyping rivers in 2D de-risks them. The river-around-
    heart-over-infinite-plane determinism problem (Critical, above) is *fully
    present in 2D* and is the hardest thing in the change. Prototyping it in the
    sandbox doesn't make it easier — it just lets a single-engine sandbox bless a
    curve that may fork on Safari. My push: cut rivers to their own change (answers
    Q4 with "defer even the 2D work"), or at minimum gate §8 behind a passing
    river×heart window-invariance test that does not exist in the current §9.

-   **Tension with the Architect:** the Architect will favor D1/D11's clean pure-
    module boundary as sufficient determinism insurance. I argue the module
    boundary protects *render-agnosticism*, not *engine-portable determinism* —
    those are different properties. A pure module full of `Math.sin` sums is pure
    *and* engine-divergent. The boundary must additionally forbid transcendental
    low-bits from reaching any hash input or threshold (explicit integer
    quantization at every hash/compare site), which is a constraint on the module's
    *internals*, not just its imports. The Architect's "no `three` import" check
    (§9.3) does nothing for this.

-   **Tension with the Pragmatist:** the Pragmatist (absorbing critical-path/effort)
    will want to treat the §1.3 self-test as a quick early task and move on. I'm
    asking to *front-load* the hard part: derive the D6 radius bound, build the
    window-invariance + negative-control + cross-engine-canary harness, and only
    then build hearts. That is more up-front effort and it pushes visible progress
    (a pretty heart map) later. I'll concede the cost is real, but the alternative
    is tuning a make-or-break heart distribution (§3.4) on top of a `nearestHeart`
    window whose bound was never proven — re-tuning after a window fix is the more
    expensive path.

-   **Agreement, not tension, on scope (D1/D2):** Canvas 2D over three.js ortho
    correctly sidesteps the threeShim freeze, material-tier, and shadow-budget
    tripwires — I have no quarrel there. My concern is the *opposite* of "is 2D too
    little": it's that 2D is a single-engine oracle and will *over*-state
    determinism confidence.

### Verdict

-   **Verdict**: Proceed with mitigations.
-   **Key Concern**: The determinism story is sound at the *seeding* layer (D4 is
    the right call and the lakes precedent proves it) but unproven at the
    *numeric/windowing* layer — `nearestHeart` window truncation, the "generous"
    (= underived) D6 radius, float/transcendental low-bits reaching hash inputs and
    `<` thresholds, and river-around-heart avoidance depending on hearts outside the
    local window. The §1.3/§9 self-test as written ("query in two orders, assert
    identical") is theater against these, because `queryPoint` is already a pure
    function — re-ordering it proves nothing.
-   **Recommendation**: Don't block — the architecture is correct and the failure
    modes are all *fixable by design constraints set now*. Before building hearts:
    (1) rewrite the self-test to assert window-invariance with a *negative control*,
    boundary agreement to the exact bit, a serialize→reparse round-trip, and a
    checked-in cross-engine golden hash; (2) derive the D6 lookup radius as a math
    bound from the edge-length cap, not "generous"; (3) make explicit-integer-
    quantization-before-hash-or-threshold a hard rule so transcendental low-bits
    never fork the layout across engines; (4) sort proximity-graph candidates by a
    total order with an integer-cell tiebreaker (never Map iteration order); (5)
    cut rivers to a follow-up change, or gate §8 behind a river×heart window-
    invariance test the current §9 does not contain.
