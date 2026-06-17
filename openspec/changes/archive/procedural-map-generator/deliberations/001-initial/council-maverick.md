# Maverick Deliberation — Procedural Map Generator

> Lens: maximum delight per unit of surface area. Is there a simpler, more
> elegant path to "this reads as a real festival"? What's the single
> highest-signal slice that proves or kills the direction? What's gold-plating?

## The Maverick's Order of Operations

### Priority Sequence

The plan's instinct is right — build the brain before the body, prove the
macro structure where the 3D game can never show it. But the plan is sequenced
as a **waterfall of 10 sections that all ship in one change**, and that's the
trap. The make-or-break question (D9: "does the heart distribution read as a
real festival, or a lattice?") is answerable at the END of section 3. Sections
4–8 (roads, lakes, density, roles, rivers, bridges) are all *downstream of an
unproven premise*. If hearts read as a grid, every road you draw connects grid
nodes and the whole thing dies — and you'll have spent the river-and-bridge
budget before learning it.

So I'd re-cut the work into **two gates**, and treat the first as a kill switch:

1. **GATE 1 — Prove the macro structure (the only thing that matters first).**
   §1 (scaffolding + determinism helpers + self-test), §2 (heart field with
   rank/mega), §3 (the 2D shell — pan/zoom/seed, heart layer only, on-screen
   determinism check). Then §3.4: **tune hearts by eye until they read as
   "real, not a lattice."** This is the acceptance test for the entire
   direction. Capture the constants. **If hearts can't escape the lattice with
   a macrocell approach, stop here and pivot the generator (see Alternative
   Approach) — do not proceed to roads.**

2. **GATE 2 — Prove "leads somewhere" (roads on top of proven hearts).**
   §4 arterials (the proximity graph + meander + perpendicular seam crossing)
   and §9.2 (proximity-graph consistency check). The pair "hearts + arterials"
   is the *minimum viable festival map*: rare centers, roads that connect them,
   open land between. **If those two layers read as intentional, the change has
   already delivered 80% of its delight.** Everything after is texture.

3. **Then, and only then, the texture layers — in cheapest-payoff order:**
   §5 lakes (cheap, the macrocell pattern already exists in `lakes.js:32`),
   §6 tree-density field (cheap, pure noise minus footprints), §7 roles + the
   off-road anchor (this is the layer that structurally kills the
   "stages-on-roads" bug — high payoff, do it before rivers).

4. **Rivers + bridges (§8): cut from this change.** See the scope argument
   below. Park them on ROADMAP as a follow-up. They're the highest-complexity,
   most-coupled, lowest-marginal-delight slice, and they sit *last* in the
   plan's own sequence precisely because they're the riskiest. Shipping the
   change without them loses nothing the make-or-break test cares about.

The reordering is small but the framing change is large: **§3.4 is a go/no-go
gate, not a task.** The current `tasks.md` lists it as checkbox 3.4 with the
same weight as "add a road layer toggle." It is not the same weight. It decides
whether the next 6 sections are worth writing.

### Impact Assessment

**What earns its keep (high delight per unit effort):**

- **Hearts + ranks.** This IS the idea. "Intentional structure inside infinity"
  is the whole pitch, and the central-place hierarchy is a genuinely elegant
  way to get it — sparsity falls out as the space between centers for free, no
  separate "sparsity system" needed (D3, well-reasoned). High signal.
- **Arterials connecting hearts.** "Roads that lead somewhere" is the second
  half of the pitch and the direct fix for the squirrely-grid complaint in the
  proposal's Why. High signal.
- **Off-road, road-facing anchor (§7.1).** This is the sleeper win. It
  *structurally* kills the "stages-on-roads" bug (proposal line: tent stage
  placed at chunk center, on the path intersection). That's a real, nameable
  defect in the live game, fixed by a layout rule rather than a hack. Cheap,
  high payoff. Don't let it get buried behind rivers.

**What's lower signal than its cost:**

- **Rivers + bridges (D7, §8).** A meandering pair-seeded curve that routes
  around heart cores, carries a no-build corridor, and produces deterministic
  road×river bridge intersections is the single most complex thing in the
  change — and in *2D, with no 3D water and no collision*, the payoff is "a
  blue squiggle on a canvas." The wow only lands when there's actual water + a
  bridge you drive over, and that's explicitly a *future* change (Non-Goals).
  So this change pays the full complexity cost of rivers for none of the
  delight. That's the worst trade in the plan.
- **Mega-heart 2×2 (D3, §2.2).** See dedicated section below — it's a
  seeding-complexity tax for a marginal "ooh, a big one" payoff that the sandbox
  can't even let you experience (you can't drive through a mega in a 2D canvas).

**Compounding returns (the genuinely good news):** the render-agnostic
data-only generator (D1) is the right reusable substrate — one layout brain
feeds the 2D sandbox, the future 3D world, and a future map view. That's real
compounding value and I fully endorse it. The boundary just needs the data
model to capture what 3D will need (heights, collider radii, facing) — flagged
under Tensions with Architect.

### Simplification Pressure

**Is the 2D-sandbox-first detour worth it, or a procrastination layer?**

Argue (a): it de-risks the *global* structure the 3D game can never show. True
and important — you genuinely cannot judge "sparsity / hierarchy / a network
that leads somewhere" from inside a chunk-loaded 3D camera. The macro read is
invisible at ground level. This is a real reason the sandbox exists and not a
dodge.

Argue (b): we could prove the *math* headless (assertions + console) and skip a
rendering UI entirely. Also partly true — **determinism and order-independence
(the cardinal risk, footgun #4) need zero pixels to prove.** §1.3, §9.1, §9.2
are pure assertions. You do not need pan/zoom/toggles to assert byte-identical
output across traversal orders. So the determinism half of the change is
better served by a headless test than a UI.

**The synthesis (my actual position): split the verification surface in two.**

- **Determinism → headless self-test.** A tiny `worldgen/selftest.js` (or even
  a `<script>` block) that queries N points in two orders and asserts equality,
  plus the boundary-agreement and proximity-graph-consistency checks. No
  canvas. This is faster to write, faster to run, and is the *correct* tool for
  a correctness property. The plan already half-knows this (§1.3 is a "tiny
  determinism self-test helper") — just don't make it a *button in the UI*
  (§3.3 wires it into the sandbox); make it a standalone assert harness you can
  run on every edit.

- **"Does this read as a festival?" → the 2D canvas, but the MINIMUM canvas.**
  The make-or-break question is a *human eyeball* judgment ("real vs lattice"),
  and only a picture answers it. But the minimum picture is: pan/zoom + seed +
  draw heart dots. That's it for Gate 1. Layer toggles, the point inspector,
  role-tier shading, density shading, river rendering — those are all
  **build-them-when-you-build-the-layer**, not part of the shell. The plan
  mostly does this (§3 is "shell," layers attach in §4–8), which is good. My
  push: keep §3.2/§3.3 ruthlessly minimal. The shell is pan + zoom + seed +
  dots + a console-fed determinism readout. Resist building the full
  toggle/inspector framework up front before you know hearts even work.

So: **the 2D detour is worth it for the eyeball question, a waste for the math
question.** Headless-assert the math, eyeball-test the structure, and don't let
the UI grow beyond what each gate needs.

**Can a config change replace code?** Partly — D9 already names the heart
constants as the tuning surface, which is the right instinct. The risk is the
generator grows knobs faster than the sandbox can let you feel them. Every
constant you add is one you have to tune by eye; keep the named-constant set
small and resist per-layer parameter sprawl.

### Creative Alternatives

This is the section the briefing pushed hardest on, so two non-obvious moves:

**Alternative A — Blue-noise hearts instead of one-per-macrocell (the
anti-lattice generator).**

D3's macrocell-with-jitter approach has a known failure mode the plan itself
flags as make-or-break: jittered-grid placement *still reads as a grid* because
every cell contributes at most one point and the spacing is bounded by the cell
size. Jitter softens the lattice; it doesn't escape it. You can see the rows if
you squint, especially at the zoomed-out scale that is *the entire reason this
sandbox exists*.

A genuinely irregular distribution beats it: **Poisson-disc / blue-noise heart
placement**, still fully deterministic and order-independent. The trick that
keeps it local and seed-stable: sample candidates per macrocell (so the query
stays bounded), but accept/reject against a deterministic min-distance rule
evaluated over the bounded neighborhood — a candidate at cell C survives only
if no higher-priority candidate (priority = a hash of the candidate's own id,
so it's order-independent) lies within the Poisson radius. This is "Wang-tile /
blue-noise via deterministic dart-throwing," it reuses `worldHash` exactly the
way `lakes.js:101` already seeds per-macrocell features, and it produces
spacing that is *irregular but never clumped* — which is precisely what real
geography looks like and precisely what a jittered grid does not.

- **Value:** directly attacks the make-or-break risk (D9 / the "grid-of-
  festivals" risk in design.md Risks) at the generator level instead of hoping
  jitter is enough. If hearts are blue-noise, the lattice is gone by
  construction, and Gate 1 passes on the first try instead of after a tuning
  slog.
- **Risk:** the accept/reject-over-neighborhood rule has the *same* order-
  independence subtlety as the proximity graph (D6) — a candidate's survival
  can depend on a higher-priority candidate just outside a small window. Same
  mitigation (generous bounded neighborhood + the §9.2 consistency assert), so
  it doesn't add a *new* class of risk, it shares one you're already paying for.
- **Effort:** comparable to the jittered-grid heart field, maybe slightly more.
  But it front-loads the risk onto the layer you have to get right anyway, and
  may *save* the §3.4 tuning loop entirely. Net effort could be lower.

I'd at least prototype both in the §3.4 tuning gate and pick by eye. If
jittered-grid reads fine zoomed out, keep it (simplest). If you see rows —
which I'd bet on — blue-noise is the elegant escape, not "more jitter +
more rank variation" (which is the plan's current fallback and is just
fighting the lattice with epicycles).

**Alternative B — A small set of hand-tuned heart archetypes instead of pure
procedural rank.**

Instead of "every heart rolls minor/major/mega from weights," define a *handful*
of named festival archetypes (e.g. "main-stage hub," "food + vendor cluster,"
"quiet camping basin," "drum-circle clearing") and have each heart deterministi-
cally pick an archetype. The archetype carries its own role/theme/density
profile. This trades a continuous-rank knob for a discrete, *authored* palette —
which is how you get character without a global planner, and it's the same move
the live game already makes with chunk *themes* (`pickTheme`, chunks.js:511).

- **Value:** each heart becomes a *place with an identity* ("the food one," "the
  big stage one") instead of a size tier. That's more festival-delight per heart
  than rank alone, and it's the kind of variety the eyeball test rewards.
- **Risk:** archetypes are content you have to author and balance; more upfront
  taste required than a weight table.
- **Effort:** similar to ranks; you're replacing a weight roll with an archetype
  roll. Could fold *into* the role layer (§7) rather than the heart layer.

I'm not insisting on B — it may be better as a follow-up once the skeleton
proves out. But it's the more interesting answer to "how does this read as a
*real* festival" than mega-heart-is-bigger.

### Risk-Reward Honesty

Where I'd hold the conservative line:

- **Determinism is non-negotiable** (footgun #4, CLAUDE.md). My blue-noise
  alternative must clear the exact same order-independence bar as the plan's
  approach — I'm not advocating any cleverness that compromises byte-identical
  output. The plan's edge/pair-seeding (D4) and its rejection of forward-passing
  is *correct* and I fully endorse it; that's not where I'd innovate.
- **Reuse `rng.js`, don't fork it.** §1.2 says build new helpers on the existing
  `hash2`/`worldHash`/`mulberry32` contract — right call, and `lakes.js:101`
  already shows the per-macrocell seeding idiom to copy. Don't invent a second
  seeding scheme.
- **My "cut rivers" push is a deferral, not a deletion.** Park on ROADMAP with
  the rest of the future-3D-integration follow-ups (§10.2 already does this for
  the integration). The skeleton is explicitly designed to ship without rivers
  ("keep the skeleton shippable without them," design.md Risks) — so cutting
  them is taking the plan at its own word, not overriding it.

Where the conservative approach is honestly *more* correct than my instinct:
the data-only render-agnostic boundary (D1) and Canvas-2D-not-three.js (D2) are
both right, and I have no cheaper alternative. Canvas 2D for kilometers of
top-down dots and lines is exactly correct; three.js ortho would add the very
tripwires (D2 rightly lists threeShim/material-tier/shadow-budget) for zero
gain. No notes.

### The mega-heart 2×2: cool, or gimmick?

**Gimmick, in *this* change.** Here's the honest cost/benefit:

- **Cost:** the 2×2 footprint is the one place the otherwise-clean
  one-feature-per-cell determinism model gets a special case. A mega claims four
  cells and "suppresses lesser hearts within its footprint" (spec, §2.2) — which
  means the *other three cells* must, order-independently, know they're inside a
  mega's claim and yield. That's a multi-cell consensus rule: cell (C) has to
  check whether any of the cells whose 2×2 block could contain C rolled a mega,
  and defer. It's solvable (seed the mega from the anchor cell, have the other
  three query the anchor), but it's strictly more seeding logic than every other
  feature, and it's exactly the kind of multi-cell dependency where
  order-dependence sneaks back in if you're not careful. The Adversary will (and
  should) want a proof that the suppression is order-independent.
- **Benefit:** "a rare big one." But you cannot *experience* bigness in a 2D
  canvas of dots — a mega is a slightly bigger dot with a slightly bigger domain
  circle. The payoff of a mega-heart is a 3D thing (driving into a huge
  multi-stage hub), and 3D is out of scope. So this change pays the full seeding
  complexity for a payoff it can't show.

**My recommendation:** ship rank as `minor / major` only for this change. Domain
radius already scales with rank, so "major" hearts already give you size
variation and a hierarchy. Defer the mega rank (and its 2×2 special-case) to the
3D-integration change *where the bigness actually lands and the suppression rule
can be validated against real chunk lifecycle.* This removes the single
gnarliest determinism special-case from the make-or-break gate, where you want
the seeding model as clean as possible. If Gary loves the mega idea (and it is a
nice idea for the 3D world), it costs nothing to add it later — the rank weight
table is one constant.

### Alternative Approach

[Headline alt, per my agent's required section format.]

**Prove the macro read with blue-noise hearts + arterials only; headless-assert
the determinism; defer rivers and the mega-rank.**

Concretely, the minimal thing that actually answers "does this read as a real
festival":

1. Blue-noise (Poisson-disc, deterministic dart-throw over a bounded
   neighborhood) heart placement with two ranks (minor/major). (Alternative A.)
2. Arterials connecting nearest-neighbor hearts (the proximity graph, D6) with
   perpendicular seam crossing.
3. A minimal Canvas-2D shell: pan/zoom + seed + draw hearts and arterials. No
   toggles, no inspector, no layer framework yet.
4. A separate headless `selftest.js` asserting byte-identical output across
   traversal orders + boundary agreement + proximity-graph consistency. No UI.

Stop. Look at the zoomed-out picture. **That image either reads as "rare
festivals connected by roads through open country" or it reads as "a grid."**
That is the entire bet, and it's reachable in roughly the first 4 of the plan's
10 sections.

-   **Value:** kills or confirms the whole direction at ~40% of the planned
    effort, before a single line of river/bridge/density/role/mega code is
    written. The blue-noise heart placement attacks the make-or-break risk
    structurally instead of hoping jitter-plus-rank-variation is enough.
    Headless determinism asserts run on every edit in milliseconds, decoupled
    from the eyeball loop. The render-agnostic, single-source-of-truth substrate
    (D1) is preserved exactly — this is a *sequencing and heart-algorithm*
    change, not an architecture change.
-   **Risk:** blue-noise carries the same (not a new) order-independence subtlety
    as the proximity graph, mitigated the same way. Cutting rivers + mega means
    two specs (`world-layout-generator` "Lakes and rivers" / "Bridges" and the
    mega clause of "Heart field") move to a follow-up change — a spec edit and a
    ROADMAP line, not lost work. If Gary specifically wants rivers visualized in
    2D as part of *this* exploration (Q4's default is "in scope, built last"),
    that's a legitimate override of my cut — but I'd argue the 2D blue squiggle
    isn't worth the coupling and the determinism surface it drags in.
-   **Effort:** lower than the full plan to reach the go/no-go answer (sections
    1–4 + a headless test, vs. all 10). Total effort if everything proceeds is
    roughly the same minus rivers minus the mega special-case — call it 15–20%
    off the top, with the riskiest decision pulled forward to the cheapest point.

### Anticipated Tensions

-   **Tension with Architect (completeness):** Architect will want all the
    layers specified and built so the data model is *complete* before the 3D
    integration consumes it — and will defend rivers/bridges/mega as part of a
    coherent whole rather than a pick-and-choose menu. I agree the *spec* should
    describe the full target (so the data model is designed for it), but I
    disagree that *this change must build all of it*. My cut keeps the spec
    aspirational and the implementation gated. The genuine friction:
    Architect's "boil the ocean" reading of completeness (CLAUDE.md) says do the
    whole thing; my reading says completeness applies to *correctness of the
    slice you ship*, not to shipping every slice before you've proven the
    first one reads right. We also share a concern I'll hand to Architect: the
    data-only boundary (D1) must capture what the future 3D port needs (heights,
    collider radii, facing/orientation for the off-road anchor) — if the 2D
    model omits those, the "single source of truth" promise breaks and the 3D
    change re-forks the generator. That's a real boundary-design item for
    Architect to own.

-   **Tension with Adversary (proof before building):** We're mostly *allies*
    here — Adversary wants the determinism proven before building on top of it,
    and my Gate-1/headless-selftest reordering hands Adversary exactly the early
    proof it wants. Where we may diverge: Adversary may demand byte-identical
    proof of *every* layer (including the mega 2×2 suppression and the
    river/bridge intersection determinism) before declaring the change sound. My
    answer is to *remove* the two hardest-to-prove things (mega suppression,
    river×road bridges) from this change rather than build elaborate proofs for
    features whose payoff is deferred to 3D anyway. So the tension is: Adversary
    might say "prove the mega suppression is order-independent"; I say "don't
    ship the mega in this change, then there's nothing to prove." Cutting risk
    beats proving risk when the feature isn't earning its place yet.

-   **Tension with Pragmatist (effort/critical-path):** Likely strong agreement.
    Pragmatist owns the generator's per-pixel cost concern (the briefing handed
    it over); my minimal-shell push (sampled-resolution heart dots only at Gate
    1) keeps the zoomed-out draw cheap by construction. The one place we might
    rub: Pragmatist may see my blue-noise alternative as added critical-path
    risk vs. the simpler jittered grid. Fair — so I frame it as "prototype both
    in the §3.4 gate, pick by eye," not "blue-noise mandatory." If the grid
    reads fine, ship the grid.

### Verdict

-   **Verdict**: Proceed with mitigations.
-   **Key Concern**: The change is sequenced as a 10-section waterfall that
    builds 6 layers downstream of an **unproven** premise (that the heart field
    reads as a real festival, not a lattice). The make-or-break test (D9 / §3.4)
    must be a hard go/no-go **gate** after the heart layer — not checkbox 3.4
    with the same weight as "add a road toggle" — and rivers + the mega 2×2 are
    the lowest-delight, highest-complexity, hardest-to-prove slices, paying full
    cost in a 2D-only change for payoff that's deferred to 3D.
-   **Recommendation**: Proceed, with three mitigations: (1) Treat §3.4 as a
    kill switch — prove "hearts + arterials read as intentional" before building
    lakes/density/roles/rivers; if hearts can't escape the lattice, pivot the
    heart algorithm (blue-noise, Alternative A) before going further. (2) Split
    verification: headless `selftest.js` for the determinism math (the cardinal
    risk, needs zero pixels), minimal Canvas shell for the eyeball question only.
    (3) Cut rivers + bridges (§8) and the mega rank/2×2 special-case to the
    follow-up 3D-integration change — keep them in the *spec* as the target, out
    of *this* implementation. The core direction (render-agnostic central-place
    generator + 2D macro sandbox, D1/D2/D3/D4) is genuinely elegant and I
    endorse it; the friction is scope and sequencing, not architecture.
