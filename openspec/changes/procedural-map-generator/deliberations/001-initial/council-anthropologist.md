# Council Deliberation — Anthropologist (Experience Advocate)

Change: `procedural-map-generator` · Deliberation 001-initial · Pre-implementation

My lens: the humans on both ends. The **player** who will eventually drive through
whatever this generator produces, and the **next agent** who has to iterate on it.
This change is unusual in that the deliverable _is_ a harness — so the agent-experience
question isn't "does it keep verification cheap," it's "is the verification surface
itself good enough to develop the real thing in." That makes me one of the more
load-bearing voices here, and I want to be specific.

Bottom line up front: I'm strongly in favor of the shape of this plan. The
"render-agnostic generator + 2D sandbox first" structure (D1/D2) is exactly the
"build the harness, then the feature" doctrine (CLAUDE.md) applied at the world-scale,
and it's the right instinct. My concerns are not about whether to do this — they're
about **harness completeness** (the sandbox has gaps that will bite the next agent if
left implicit) and one real **player-feel risk** (sparsity reading as boredom) that the
plan acknowledges but does not yet give the sandbox the tools to actually _judge_.

---

## Anthropologist's Order of Operations

### Priority Sequence

My ordering largely agrees with `tasks.md`, with three deliberate shifts that protect
the experience-of-developing-this:

1. **§1 + §3.1 together as the true first deliverable — the sandbox shell is part of
   the foundation, not a thing built after hearts.** The tasks order is
   scaffolding (§1) → hearts (§2) → sandbox shell (§3). I'd pull `map-sandbox.html`
   pan/zoom/seed shell forward to sit _beside_ §1, before hearts have any visual
   meaning. Reason: the project doctrine is that you should be able to "iterate,
   render, and verify in seconds" (CLAUDE.md, "build the harness, then the feature").
   If hearts land in §2 with no window to look through, the agent is verifying the
   make-or-break knob via `console.log` for a whole task — exactly the slow loop the
   sandbox exists to kill. The heart layer (§3.3) can light up the moment the shell
   exists.

2. **Bake the preview-MCP keep-alive and the determinism self-test into the shell
   itself (§3.1/§3.3), not as later polish.** These two are the difference between a
   sandbox an agent can _trust_ and one they have to babysit. Details in Experience
   Concerns below — both are cheap to add at shell-creation time and expensive to
   retrofit once the render loop calcifies.

3. **Keep the order otherwise:** hearts → roads → lakes → density → roles → rivers
   (§2→§8). I agree rivers go last (D7) — they're the hardest and most coupled, and
   from a player-feel standpoint rivers + bridges are the layer most likely to need
   many tuning passes, so having a shippable skeleton _without_ them is the right
   safety valve. Don't let river difficulty hold the rest hostage.

The one thing I would _not_ reorder: resist any temptation (I expect the Maverick to
push this) to defer the sandbox UI and "just `console.log` the tuples." For a
macro-scale, by-eye knob like heart distribution (D9), text output is not a substitute
for seeing kilometers at once. The whole premise of the change (proposal §Why) is that
"the global structure is invisible inside the chunk-loaded 3D game" — replacing it with
structure that's invisible in a text console defeats the point.

---

### Experience Concerns

#### Next agent / dev — the harness (my primary domain here)

This change lives or dies on whether the 2D sandbox is genuinely a fast, trustworthy
iteration surface. The spec
(`specs/worldgen-2d-sandbox/spec.md`) covers the obvious controls — seed, pan/zoom,
layer toggles, point inspector, hot-reload. Those are right. But there are **four gaps**
that the existing 3D sandbox handles and this one currently leaves implicit. Each is a
concrete, citable thing the next agent will need:

1. **Preview-MCP keep-alive — REQUIRED, currently unstated.** The existing
   `sandbox.html` ticks via RAF but falls back to `setTimeout(tick, 16)` when
   `document.hidden` (`sandbox.html:2363-2367`), with the comment "Preview MCP runs
   the page document.hidden — RAF throttles to ~0 fps when hidden." `main.js` does the
   same. This is the documented mechanism (CLAUDE.md "Run + verify") that lets
   `preview_screenshot` capture a _live_ frame. A Canvas-2D map sandbox with any
   animation/redraw loop (pan/zoom inertia, the determinism self-test running, tile
   streaming on pan) will silently freeze under the preview MCP if it uses bare RAF.
   The next agent would take a screenshot, see a stale or blank canvas, and waste a
   loop blaming the generator. **This belongs as an explicit task under §3.1.** Note:
   if the agent makes the map a pure event-driven redraw (draw only on
   pan/zoom/seed-change, no loop), the trick is moot — but then the self-test's
   on-screen pass/fail and any progressive tile fill also need to be event-driven and
   the "draw a frame on demand for preview" path must be reachable. Either way, this
   needs a decision recorded, not left to chance.

2. **Deep-linkable state beyond seed — the agent's "re-open the exact same view"
   guarantee.** The spec requires seed via URL param (good), and the 3D sandbox's
   single best agent-affordance is that `?entity=<key>` + `replaceState`
   (`sandbox.html:2113`) lets you "re-open the exact same view across iterations and
   after restarts" (`.claude/rules/sandbox-and-testing.md`). For a _pannable,
   zoomable_ map that's even more important: a heart-distribution bug at world
   coordinate (12400, -8800) zoom 0.02 is worthless to report if the next agent can't
   navigate back to it. **The URL should carry `?seed=&cx=&cz=&zoom=&layers=`** (or
   similar) and `replaceState` on pan/zoom end, mirroring the entity-sandbox pattern.
   Right now `tasks.md` 3.2 only says "seed input + URL param." Make the camera state
   part of the URL contract — it's the single highest-leverage agent affordance and
   it's nearly free to add.

3. **The determinism self-test should be an on-screen, one-click affordance — and the
   plan already gets this right; keep it that way.** `tasks.md` 3.3 puts a "determinism
   toggle that runs the §1.3 self-test and reports pass/fail on screen." This is
   excellent and exactly the kind of thing that makes a harness trustworthy — it's the
   2D analog of the backtick budget HUD that the perf rules lean on
   (`.claude/rules/performance.md`, "you can't tune what you can't see"). My only
   push: make it report _where_ it failed (the offending coordinate + which field
   diverged), not just red/green. A bare "FAIL" sends the agent back to bisecting by
   hand; "FAIL at (x,z), field `roadTier` A=arterial B=collector" is a fix in minutes.
   This is the Anthropologist's version of the Adversary's rigor: I want the same
   byte-identical guarantee they want, but I want the _failure_ to be legible at a
   glance, because a determinism bug the agent can't localize is a determinism bug
   that ships.

4. **`window.__mapSandbox` introspection handle for `preview_eval`.** The 3D sandbox
   exposes `window.__sandbox = { scene, camera, currentEntity }`
   (`sandbox.html:719`) so an agent can drive a precise close-up via `preview_eval`
   without clicking. The 2D sandbox needs the equivalent:
   `window.__mapSandbox = { seed, view:{cx,cz,zoom}, queryPoint(x,z), setView(...),
   runSelfTest() }`. That lets an agent script "set seed 7, jump to (5000,5000), query
   this point, screenshot" in one eval instead of fumbling pan/zoom through synthetic
   mouse events — which the preview MCP is bad at. This is unstated in both spec and
   tasks and is, frankly, the thing I'd reach for most as the next agent. **Add it to
   §3.1.**

On the parts the plan _does_ get right for dev experience: the point inspector
(spec "Point inspector") is the 2D analog of clicking an entity in the 3D sandbox and
is well-specified — show the _full_ tuple. The per-layer toggles let you tune one layer
in isolation, which mirrors the "toggle a layer off to tune in isolation" workflow that
makes the budget HUD and the entity sandbox usable. Hot-reload via the cache-buster
list is correctly flagged (no-build rule). Good.

**Self-documenting / onboarding (§10.3):** A single README/header documenting "the
layered pipeline, the determinism contract, and the single-source-of-truth intent" is
the floor, not the ceiling. The thing that will actually make the _next_ agent
productive is a short **"how to look at it"** paragraph in that README — the equivalent
of CLAUDE.md's "Run + verify" table. Specifically: the map-sandbox URL with its param
contract, the self-test button, the `window.__mapSandbox` handle, and which layer to
toggle when debugging which symptom. Six months from now the open question "why does
this module exist and how do I see its output" should be answered in the file, not
rediscovered. I'd promote that from "brief README" to "README with a Verify section."

#### Player — the felt experience of the eventual map

I have to advocate for the player even though no player touches this change. The whole
justification (proposal §Why) is a _feel_ claim: the current world "reads as a squirrely
uniform grid" and we want something that "reads like a real festival." So the acceptance
bar for this generator is ultimately a feel bar, and I want the sandbox able to judge it.

1. **Sparsity is the headline risk, and it's a felt risk, not a structural one.** D3's
   thesis — "sparsity is simply the space between hearts; intentionality is everything
   orienting to its nearest heart" — is geographically elegant. But the player doesn't
   experience geography, they experience _the drive between hearts_. The current game's
   sin is monotony-from-uniformity; the new failure mode is **monotony-from-emptiness** —
   long stretches of outskirts where nothing happens and the "collect the smiles" loop
   goes quiet. The plan's only tool for judging this is the zoomed-_out_ macro view
   (D9 acceptance check). But "looks like real geography from 2km up" and "is fun to
   drive across at boost speed" are _different questions_, and the macro view answers
   only the first. **The sandbox needs a sense of the player-scale traversal**, e.g. a
   "drive-time ruler" or a path-trace tool that samples the tuple along a line between
   two hearts and shows you what you'd pass (road / open / forest / nothing). Q1 even
   frames spacing in terms of "drive time at boost" — so give the sandbox a way to
   measure that, not just eyeball density. Without it, the agent tunes for a pretty map
   and discovers the boring drive only after 3D integration (a separate change), which
   is the worst possible time to learn it.

2. **"You arrive somewhere" needs a readable threshold, not just a radius.** The
   core→district→outskirts role tiers (spec "Per-location role") are the mechanism for
   the arrival feeling. From the player's seat, "arrival" is a _transition_ — the
   outskirts thinning, then density ramping, then you're in it. If the tier boundaries
   are hard radius cutoffs, the player crosses an invisible line and the festival
   pops in. The plan doesn't say whether tiers blend. From a feel standpoint I'd want
   the density ramp to be continuous (the tree-density field D8 already is a continuous
   field — good instinct; apply the same continuity thinking to role density). This
   isn't a blocker for the 2D change, but it's a data-model question the 2D model should
   capture _now_ (a continuous "heart influence" scalar, not just a discrete tier label)
   so the 3D port doesn't have to reverse-engineer the ramp later. See "Experiences Not
   Addressed."

3. **Mobile / readability-in-motion (deferred but worth a flag):** none of this is
   player-facing yet, so no mobile concern in _this_ change. But the eventual in-game
   map view (Q3) will be touched on a phone, and a kilometers-spanning map with five
   toggleable layers is a dense thing to render on a small screen. Not this change's
   problem — but if the 2D sandbox's rendering choices (layer colors, line weights,
   heart glyphs) are made now, making them legible-at-a-glance pays off twice: once for
   the agent squinting at screenshots, once for the eventual map view. Cheap to keep in
   mind.

#### Cognitive load

This is well-managed. The plan reuses familiar paradigms rather than inventing new ones:
macrocell + jitter + deterministic-hash is _exactly_ the pattern lakes.js and forests.js
already use (design §Context cites this explicitly), so an agent who knows the existing
world code will recognize the generator's shape. Reusing `rng.js` primitives (one
seeding contract, not two — proposal §Scope Check) is the right call and keeps the
mental model singular. The new concepts a developer must hold — heart rank hierarchy,
the layered pipeline, edge/pair-seeding — are genuinely new, but they're the irreducible
essence of the feature, not incidental complexity. The `src/worldgen/` split into
`hearts/roads/water/density/roles/index` (D11) maps one-file-per-concept, which is
legible.

One cognitive-load snag: **`map-sandbox.html` as a _second_ sandbox page risks confusion
with the existing `sandbox.html`.** Two pages named almost identically, one three.js one
Canvas-2D, with overlapping vocabulary ("sandbox," "entity," "seed"). The next agent
reading CLAUDE.md's "Run + verify" table will see one sandbox documented and one not.
Mitigation is cheap: a one-line addition to the CLAUDE.md / DEBUGGING verify table and a
clear name. I'd lean toward a name that telegraphs the difference — `map-sandbox.html`
is okay, but the README and the verify table must spell out "entity sandbox = one model
in 3D; map sandbox = the whole world layout in 2D top-down." This is a doc task, fold it
into §10.

---

### Experiences Not Addressed

Framed as the humans who'll hit the gap:

- **As the next agent debugging a determinism failure, I'd be unable to localize it**
  because the planned self-test (§1.3 / §3.3) reports pass/fail but the spec doesn't
  require it to report the offending coordinate + diverging field. A red light tells me
  _that_ I broke determinism, not _where_. → Make the self-test failure legible (which
  point, which field, the two values).

- **As the next agent, I'd be unable to re-open the exact macro view where I spotted a
  problem** because the URL contract is only `?seed=` (spec "Seed control"); pan/zoom
  camera state isn't in the URL. The 3D sandbox solved this with `?entity=` +
  `replaceState` and it's the most-used agent affordance. → Put `cx/cz/zoom/layers` in
  the URL and `replaceState` on view change.

- **As the next agent, I'd be unable to script a precise query/screenshot via
  `preview_eval`** because there's no `window.__mapSandbox` introspection handle (the
  3D sandbox has `window.__sandbox`, `sandbox.html:719`). I'd be stuck synthesizing
  mouse events for pan/zoom, which the preview MCP handles poorly. → Expose a
  `window.__mapSandbox` with `setView/queryPoint/runSelfTest`.

- **As the next agent taking a screenshot through the preview MCP, I'd see a frozen or
  blank canvas** if the map uses a bare RAF loop, because the preview MCP keeps
  `document.hidden` and RAF throttles to ~0fps (the exact reason `sandbox.html:2363-2367`
  exists). → Either adopt the `document.hidden → setTimeout` fallback or commit to a
  pure event-driven redraw that's explicitly reachable for the preview. Record the
  decision.

- **As the player, I'd expect the drive _between_ hearts to stay engaging**, but the
  plan's only judging tool is the zoomed-out macro view (D9), which can't tell me
  whether the outskirts are "pleasantly open" or "dead air." → Add a player-scale
  traversal probe to the sandbox (a path-trace / drive-time ruler between two hearts
  that shows what you'd pass). Ties directly to Q1's "drive time at boost" framing.

- **As the eventual 3D-port author (and the eventual map-view author, Q3), I'd be
  unable to reconstruct a smooth arrival ramp** if the 2D role model only stores a
  discrete core/district/outskirts label and a hard radius. → Have the data model
  expose a continuous "nearest-heart influence" scalar now (the tree-density field D8
  is already continuous — same thinking), so the 3D density ramp and the map view's
  shading are a read, not a re-derivation. This is the cheapest possible insurance for
  Q3: make the generator's output _already_ carry what a map view would shade by.

None of these are blockers. All six are small, cheap-if-done-now / expensive-if-retrofit
additions to the harness or the data model. They're the difference between a sandbox the
next agent loves and one they tolerate.

---

### Anticipated Tensions

- **Tension with the Maverick (likely "skip/minimize the rendering UI, just dump
  tuples / build the generator and inspect in console").** I oppose this directly. The
  premise of the change (proposal §Why; D9 naming the heart distribution "the
  make-or-break knob ... tuned by eye at the macro scale") is that the structure is only
  judgeable _visually, across kilometers_. A console dump can verify determinism but it
  cannot answer "does this read as a real festival or a lattice," which is the actual
  goal. The 2D Canvas viewer isn't gold-plating — it _is_ the feature's acceptance
  instrument. Where I'd _agree_ with a Maverick: don't over-build the chrome. No fancy
  styling, no settings persistence beyond the URL, no minimap-of-the-minimap. Lean
  shell, rich data. But the pan/zoom/toggle/inspect core is non-negotiable.

- **Tension with the Adversary (determinism rigor vs. my "make it lookable fast").**
  Mostly aligned, with a difference of emphasis. The Adversary will (rightly) want
  exhaustive byte-identical proofs, boundary-agreement checks, float-associativity
  scrutiny — and I fully support the self-test gate (§9). My friction: rigor that lives
  _only_ in a CI-style assertion the agent runs occasionally is weaker, from a human
  standpoint, than rigor that's a **one-click on-screen affordance with legible
  failure**. I want the Adversary's guarantees, surfaced the way the backtick HUD
  surfaces perf budgets — always glanceable, failure localized. Tension point: if the
  Adversary pushes determinism verification entirely into headless test scripts, I'll
  argue some of it must live _in the sandbox UI_ where the developing agent actually
  works, or it won't get run during the tight tuning loop where regressions are born.

- **Tension with the Pragmatist (effort/critical-path; they're absorbing the
  "perf-of-the-generator" concern per the briefing).** I'm _adding_ scope they may want
  to trim: the player-scale traversal probe, the `__mapSandbox` handle, URL camera
  state, legible self-test failures, the continuous-influence scalar. I'd defend the
  harness items (handle, URL, legible failure, keep-alive) as load-bearing-for-iteration
  and cheap — they pay for themselves within the change. I'd _concede_ the traversal
  probe and the continuous-influence scalar are lower priority and could be fast-follows
  _if_ the Pragmatist shows the critical path is at risk — but I'd want them at least
  recorded as ROADMAP follow-ups (§10.2) rather than forgotten, because they're the
  player-feel insurance and the Q3 map-view insurance respectively.

- **Tension with the Architect (module-boundary purity).** Minor and friendly. The
  Architect will defend the render-agnostic boundary (D1: no `three`, no DOM in the
  generator) hard, and I agree it's the right discipline. My only nudge: the boundary
  shouldn't be defended so zealously that the generator omits data the _consumers_
  (sandbox now, 3D + map view later) will obviously need — facing/angle, influence
  scalar, collider-radius hints. "Render-agnostic" means "doesn't render," not "doesn't
  anticipate what renderers need." The data model should be generous with _descriptive_
  fields even though it draws nothing. No real conflict, just a reminder that the
  single-source-of-truth promise (D1) is only kept if the data is rich enough to be the
  source for all three consumers.

---

### Verdict

- **Verdict**: **Proceed with mitigations.**
- **Key Concern**: The sandbox — which _is_ the deliverable here — has unstated
  agent-experience gaps (preview-MCP keep-alive, deep-linkable camera state in the URL,
  a `window.__mapSandbox` introspection handle, and legible determinism-failure
  reporting) that the existing 3D `sandbox.html` already solves; left implicit, they'll
  cost the next agent loops on a tool whose entire reason for existing is to make those
  loops cheap.
- **Recommendation**: The plan's structure is right and matches the project's
  "build the harness, then the feature" doctrine — proceed. Before/while building §3,
  fold in the four harness affordances above (they're nearly free and mirror patterns
  already in `sandbox.html`). Make the determinism self-test an on-screen, one-click,
  failure-localizing affordance (agreeing with the Adversary's rigor but on my terms of
  legibility). Add a player-scale traversal probe so the agent can judge the
  drive-_between_-hearts feel — the one genuine player-experience risk — instead of only
  the zoomed-out macro view. And have the data model carry a continuous heart-influence
  scalar + facing now, so the future 3D port and map view (Q3) are a read, not a rewrite.
  None of this blocks; all of it is cheap now and expensive later.
