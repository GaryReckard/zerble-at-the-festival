## Anthropologist's Position

_Domain: player feel + the next agent's/dev's verification experience. Grounded in
design.md "Festival Layout Redesign (D-K..D-Q)", tasks.md D2.1–D2.8, the legacy
`chunks.js` builders, `CHANGELOG.md:611-613`, `sandbox.html`, and `map-sandbox.html`._

### Priority Sequence

This is the order that protects player feel AND keeps the next agent able to verify
in seconds rather than driving across chunks hunting for a cluster.

1. **Build the festival-plan overlay in `map-sandbox.html` FIRST — before writing
   `festival.js` against the running game.** `festivalPlan(heart)` is pure DATA, and
   the map sandbox already renders hearts/roads/water/density/roles and already has a
   `wouldHost` text inspector (`map-sandbox.html:323`, `:250-263`). It does NOT draw a
   single POI marker today. Add a `festival` layer toggle that calls
   `festivalPlan`/`poisInBounds`/`campVillagesNear` and draws stage dots, court rings,
   vendor-row line segments, drum-circle markers, and camp-village footprints in 2D.
   This is the ONE surface where the next agent can see "does this read as a designed
   festival" without booting the 3D game, driving to a heart, and wrestling the chase
   cam. It is also where Gary can A/B the layout against a seed in seconds. **This is
   the harness for D2; per CLAUDE.md "build the harness, then the feature," it comes
   before the feature, not after.** It is currently absent from the D2 task list — that
   is the single biggest gap in this plan from my domain.

2. **`approachRoadsOf` + `nearestMajorHeart` + `shoreBand` (D2.2), then `festival.js`
   (D2.1) verified against that 2D overlay.** Iterate the cluster geometry — court
   radius, vendor-row offset, arch placement, village envelope — in the cheap 2D loop
   until the plan reads right, THEN build the 3D consumers. Tuning truck-ring radius by
   booting the game and driving to a court is the exact slow loop the sandbox doctrine
   exists to kill.

3. **The arrival moment (D2.6 spawn) as its own verified beat.** "Spawn outside the
   arch facing the main stage" is the single most important player-feel moment in the
   whole change — it is the first frame every player sees. It must be screenshotted at
   noon AND midnight, and it must be checked that the composition reads: arch in the
   foreground, stage past it, crowd density between. Don't fold this into a generic
   "boot the game" smoke test; it deserves an explicit before/after screenshot pair.

4. **Cluster catalog 3D build (D2.3, D2.4) verified in the booted game at a spawn
   heart + a minor + a lakeshore region (D2.8).** This is unavoidably game-only —
   anchors are sandbox-invisible (sandbox.html builds one model; a heart's arch + stage
   + court is an emergent composition across the placement layer). The 2D overlay tells
   you the PLAN is right; the booted game tells you the BUILD matches the plan.

5. **Determinism + perf gates (D2.7), then docs.** Correctness gates last because the
   2D overlay already gives the window-invariance check a visual home (a cluster seeded
   off an out-of-window heart would visibly pop in/out as you pan — that is exactly the
   T2/T4 class of bug made eyeball-visible).

### Experience Concerns

#### Player

**Does this read as a *designed* festival? — Yes, and the thesis is correct.** The
camp_village history is the smoking gun and it is documented verbatim:
`CHANGELOG.md:611-613` says the packing RULE (12-20 sites, 50/35/15, ±30 m) was good
across all three attempts; the BUG was that "the *cell* felt off-grid rather than
nestled between roads" because it was anchored to a chunk corner. The redesign's core
move — **keep the tuned packing engine, drop the chunk-corner anchor, re-anchor to a
lakeshore/causeway band off the drag (D-M, D2.4)** — is the precise fix that history
points at. This is not speculation; it is the documented lesson applied. I endorse the
principle (D-K) without reservation: a confetti of single props never reads as a place;
clusters anchored to features do.

**The arrival moment is the make-or-break beat, and the plan gets the ingredients
right.** The legacy `buildMainStage` (`chunks.js:1118-1127`) is the template: stage at
center, entrance arch at `+30`, string lights from `z=-25..25`. The redesign (D-M, D-O)
keeps all three and adds road-facing yaw + spawn-outside-the-arch. Driving IN through
the arch toward the stage with the crowd thickening ahead is the "warm festival-evening"
promise the README and title card make ("Bring the bubbles, collect the smiles"). My
one feel note: the design says spawn faces the stage "drive-in arrival" — make sure the
arch is far enough out (the legacy `+30` from a center that's at `czWorld-20` puts ~50 m
between arch and stage) that the player gets a genuine *approach*, not a stage already
filling the frame at spawn. Too close and the arrival reads as "already arrived." That
distance is a feel-tunable, and it's exactly what the 2D overlay (priority 1) lets you
dial before you ever boot.

**The cluster catalog covers the right vignettes.** Cross-checking D-M against the
legacy builders and the README's promised set ("dancing crowds, drum circles, food
trucks, brass bands, giant puppet parades… hammock groves, lakes, forests"): stage,
food court (truck ring + sugar shack + bubble vendor), vendor row, drum circle,
porta-potty bank, camp village, lakeshore camps, filler hammocks/picnics. That is the
festival. Two things I want to flag as genuinely *better* than legacy, not just ported:

- **"Sugar shacks ONLY in the food court" (D-M)** kills the solo-shack-on-random-grass
  bug Gary flagged. A lone sugar shack in a field reads as a glitch; a shack in a truck
  ring reads as the festival's candy stand. Correct call.
- **"One guaranteed bubble vendor per heart" (D-M, D2.3)** makes refuel a first-class
  spatial constraint. From a player's moment-to-moment loop, running dry on bubble juice
  with no vendor in sight is the worst feel-failure in the game — bubbles ARE the verb.
  Guaranteeing one per heart is a real player-experience win, not just tidiness.

**What might be over-engineered / what's missing:** I don't see over-engineering in the
catalog — every cluster maps to a README-promised vignette. The one thing I'd flag as
*missing from the player-feel framing* is **negative space / the quiet drive between
hearts.** D-K mentions "sparsity is the space between hearts" and filler stays sparse,
which is right — but the plan is heavily focused on what's AT a heart. The README sells
"drive into the woods and find a clearing with a fire" and "drive to the shore and find
a canoe" — discovery in the EMPTY space. D-F (forests) + the drum-circle-in-dense-forest
re-home (F.4) carry that, but F.4 is marked "parkable to a fast-follow if the run is
tight." From a player-feel standpoint, the lonely-drum-circle-in-the-woods is one of the
README's headline discovery moments; parking it risks the between-hearts drive feeling
like dead air rather than discovery. Not a blocker — but flag it as a feel cost, not a
free cut.

**Mobile:** Nothing in this change is touch/audio-unlock sensitive (placement is build-
time, not per-frame). The relevant mobile concern is purely perf — a heart-anchor chunk
loading a stage + truck-ring + 22-NPC audience at once on a phone (D-Q's allocation
spike). That's the Profiler's lane, but from my "does it hold up on a phone" lens: a
visible hitch when you boost into a heart on iOS would read as a stutter at the worst
possible moment (the arrival). D2.8's `?perf=low` headless re-measure must include the
arrival-into-a-heart case specifically, on the low tier.

#### Next agent / dev

**The central verification gap: anchors and clusters are sandbox-INVISIBLE, and the
plan does not currently close that gap cheaply.** This is my Key Concern. Two facts:

- `sandbox.html` builds ONE model on a plain plane (`loadEntity` switch,
  `sandbox.html:832+`). It can show you `stage_main`, `food_truck`, `campsite_medium`,
  `entrance_arch` — the *pieces*. It cannot show you a *heart's composition*: arch +
  stage + court + vendor row + crowd density laid out in their spatial relationship.
  The whole POINT of this redesign is the spatial relationship between pieces, which is
  exactly what the single-model sandbox cannot render.
- `map-sandbox.html` renders the worldgen substrate (hearts/roads/water/density) and a
  `wouldHost` TEXT inspector — but draws ZERO POI markers. It shows you where a heart's
  core/district rings are; it does NOT show you where the stage, court, or village
  actually land.

So the next agent who opens this six months from now to tune a court radius has NO
one-URL way to see the festival layout. They're forced into the bad loop the sandbox
doctrine explicitly condemns (`.claude/rules/sandbox-and-testing.md`): boot game → drive
across chunks → wrestle camera → can't tell what changed because 14 other things are in
frame. **The fix is cheap and it's priority 1 above:** a `festival` layer in
map-sandbox that draws the POIs `festivalPlan` returns. `festival.js` is pure data with
a clean signature (`festivalPlan(heart) → [{kind,x,z,yaw,footprint,...}]`, D-L) — it is
*designed* to be renderable in 2D. Tasks.md I.2 acknowledges "`placement.js` is pure
data (its surface = map-sandbox `wouldHost` inspector + the booted game)" — but the
`wouldHost` inspector is a per-point TEXT readout, NOT a plan overlay. Reading "would
host: main stage · food-truck court · vendor rows" as text under your cursor is not the
same as SEEING the court ring drawn where it lands. The plan conflates the two.

**Should a composite sandbox view also exist?** I considered proposing a
`festival_heart` composite in `sandbox.html` (3D, like `puppet_lineup` or
`campsite_medium`). My recommendation: **the 2D map-sandbox overlay is the right primary
surface; a 3D composite is a nice-to-have, not required.** Reasoning: (a) the redesign's
risk is *spatial layout* (where things land relative to roads/shore/center), which 2D
top-down shows better than a 3D close-up; (b) a 3D `festival_heart` composite would have
to re-implement the chunk build half outside `chunks.js`, which duplicates code and risks
the composite drifting from the real build (the exact `buildCampChair` return-shape
class of sandbox-passes-game-fails bug CLAUDE.md warns about). The honest 3D verification
is the booted game at a real heart (D2.8) — and that's already in the plan. So: 2D
overlay REQUIRED (add to D2), 3D composite OPTIONAL (skip unless a specific vignette
proves un-eyeballable in 2D, per the "extend the harness before bypassing it" doctrine).

**Self-documenting / the "why" in six months.** The module names are clear
(`festivalPlan`, `approachRoadsOf`, `nearestMajorHeart`, `shoreBand`). The one place the
*why* MUST be commented (and the plan is silent on this) is the **chunk-corner-anchor
removal**. A future reader who finds `festival.js` anchoring villages to shore bands has
no way to know that anchoring to chunk corners was tried and failed THREE times unless
there's a comment pointing at `CHANGELOG.md:611-613`. Per CLAUDE.md's comment bar
("comment the *why* where non-obvious"), the village placement deserves a one-line "anchor
to shore/district, NOT chunk corner — see CHANGELOG 2026-05-28, three failed framings."
Otherwise some future agent re-introduces the chunk-corner bug as an "optimization."

**Debuggability.** The plan's window-invariance check (D-P, D2.7) is the right instinct,
and the 2D overlay makes it eyeball-debuggable: pan the map and watch for a cluster that
pops in/out as the scan window crosses its anchor heart. Worth noting in D2.8 that the
overlay should let you toggle the scan-window boundary so this is visible, not just
asserted in a self-test.

#### Cognitive Load

**Low-to-moderate, and mostly reusing familiar patterns.** For the next agent the new
concepts are: (1) a POI layer (`festival.js`) sitting above the worldgen substrate, and
(2) cluster ownership = center-chunk-builds-the-whole-cluster. Both are *already in the
codebase's vocabulary*: the cluster-spills-into-neighbors model is exactly how the legacy
camp village worked (`chunks.js:1849`, `D-N` cites this), and the memoized-per-feature
pattern mirrors the existing worldgen caches and `arterialPolyline`'s `pairRng` trick
(D-L). So no NEW paradigm is invented — the agent who knows the legacy code recognizes
all of it. That's a genuine strength of this design.

**For the player, cognitive load is zero — which is the goal.** A well-designed festival
asks nothing of the player; they just drive and it feels coherent. The whole change is
invisible-as-effort and visible-as-result, which is the right shape.

The one load-adder is the `USE_WORLDGEN_V2` flag + dual-path coexistence (D-G) — but
that's a correctness/migration tool, not a feel concern, and it's the safe call.

### Experiences Not Addressed

- **As the next agent, I'd be unable to see a redesigned festival heart / camp village /
  the spawn arrival from one URL** — because `sandbox.html` builds one model and
  `map-sandbox.html` draws no POI markers. The plan's stated pure-data verification
  surface (the `wouldHost` text inspector) shows role-tier text, not the actual cluster
  layout. **Gap: a `festival` POI-overlay layer in `map-sandbox.html` is missing from
  the D2 task list and should be added as the FIRST D2 task** (build the harness, then
  the feature).

- **As a player, I'd expect the drive BETWEEN hearts to be a discovery space** (the
  README's "drive into the woods and find a clearing with a fire," "drive to the shore
  and find a canoe") — but the plan front-loads what's AT a heart and marks the
  lonely-drum-circle-in-dense-forest re-home (F.4) as parkable. The between-hearts feel
  is a headline promise; parking its signature vignette is a feel cost, not a free cut.

- **As a player, the arrival distance (arch → stage gap) determines whether spawn reads
  as "approaching" or "already arrived,"** and the plan specifies the ingredients (D-O)
  but not the *spacing* as a feel-tunable. It should be dialed in the 2D overlay before
  the 3D build, with an explicit noon+midnight arrival screenshot pair in D2.8.

- **As the next agent, I'd re-introduce the chunk-corner village bug** unless the village
  placement carries a one-line comment pointing at the three-failed-framings history
  (`CHANGELOG.md:611-613`). The plan ports the fix but doesn't preserve the *why* at the
  code site.

### Verdict

-   **Verdict**: Proceed with mitigations.
-   **Key Concern**: The redesign's entire value is the *spatial relationship between
    clustered pieces*, and that is invisible in both existing sandboxes — `sandbox.html`
    shows one model, `map-sandbox.html` shows no POI markers. Without a 2D festival-plan
    overlay (which `festival.js`'s pure-data design makes cheap), the next agent is forced
    into the exact slow drive-and-hunt loop the project's sandbox doctrine exists to
    eliminate. Build that overlay FIRST.
-   **Recommendation**: Proceed — the player-feel thesis is correct and grounded in the
    documented camp_village history (`CHANGELOG.md:611-613`); the cluster catalog covers
    the right vignettes; cognitive load reuses familiar patterns. Mitigations: (1) ADD a
    `festival` POI-overlay layer to `map-sandbox.html` as the first D2 task and iterate
    cluster geometry there before the 3D build; (2) treat the arch→stage arrival spacing
    as a feel-tunable dialed in 2D, with an explicit noon+midnight arrival screenshot pair
    in D2.8; (3) preserve the chunk-corner-was-wrong *why* as a one-line comment at the
    village placement site; (4) reconsider parking F.4 (the woods drum-circle), since the
    between-hearts discovery drive is a README headline promise.
