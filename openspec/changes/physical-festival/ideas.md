# Ideas and intent preserved from the discussion

## The goal

The festival should feel physically present and socially alive. Clipping a camp chair should produce motion that follows the contact, and an occupied chair should produce a recognizable human response. Variation comes from interacting rules, objects and personalities. “Infinitely creative” describes the aspiration for surprising combinations, not an unbounded simulation or a promise of endless authored content.

This catalog preserves both Gary's requests and assistant proposals. A proposal is not a claim of implementation or a recorded human approval. The executable sequence is [tasks.md](tasks.md); technical defaults are in [design.md](design.md).

## What Gary explicitly asked for

| Request | Interpretation in this plan |
| --- | --- |
| A chair can go flying and behave like a real chair | Contact-driven sliding, tipping, bouncing, rotation, secondary contacts and believable rest |
| Explore occupied chairs, struck NPCs and how far the idea can go | Graduated person reactions, support release, temporary physics, recovery and social aftermath |
| Find the smartest path to the goal | A production-backed repeatable fixture, gated increments and reuse of current systems |
| The new cooler is a good next object | Cooler follows the chair proof as the next contrasting prop, preserving the existing model |
| Signs at some intersections pointing to points of interest | Sparse deterministic placement at real decision points, meaningful destinations and truthful arrows |
| A sign need not recover; it may flatten or fall | Per-prop aftermath policy, including locally retained fallen/flattened signs without automatic righting |
| Cups at some camp chairs and possibly cooler cupholders | Named holder sockets, plausible placement and release; cups on a seat cushion are a separate support type |
| NPCs sometimes have a drink in hand | Extend the existing ambient beverage path into transferable held objects |
| Reset things after leaving an area far behind | Approved follow-up: temporary neighborhood state with coherent distant reset; no history of old displaced poses |
| Meticulous documentation and an efficient implementation plan | Durable ideas, design, requirements, tasks, verification, source evidence and council review |

## The physical vocabulary

Each prop describes its simple collision shape, weight, balance, surface properties and relevant attachments. A low sling chair scrapes and tips differently from a director chair; a cooler resists motion more than a cup; a tall sign has a different tipping threshold from a chair. Keep physical differences legible at the actual game camera distance.

An off-center hit can rotate a chair around its remaining feet, a square hit can skid it, a caught leg can overturn it, and a second chair can redirect its motion. These are desired results of contacts, not randomly selected launch animations. Authoring still matters: collision shapes, mass distribution, sound and limited physical exaggeration determine how well the result reads.

Use actual gravity/contact behavior as the starting point. Tune friction, balance and impact response before adding arbitrary upward kicks. Do not promise that every hit launches something. A quiet scrape or narrow recovery gives the larger accidents contrast.

## People and occupied furniture

The response range includes a glance, a foot planted to steady the chair, a lean, a hurried stand, a sideways step, a stumble, a fall and a recovery. The most characterful moments can be successful saves: a sitter rocks onto two legs, windmills an arm, saves their drink and looks at Zerble.

An occupied chair starts with the person's load included in its support approximation. The person follows the seat while supported, tries a bounded recovery when unstable, and separates when a controlled exit or fall begins. They inherit continuous motion from the moving/rotating seat, rather than remaining glued to airborne furniture or snapping to a stationary pose.

The first people implementation uses an inexpensive body proxy with purposeful animation. A small articulated ragdoll is an extension when a specific shot demonstrates that limb contacts improve the experience. Full active balance control, general inverse kinematics and a physically simulated skeleton for the entire crowd are not prerequisites.

Possible aftermath includes getting up, looking at the chair, dusting off, retrieving a cup, righting a chair, finding a replacement seat, accepting help or briefly retreating. Calm and skittish people can react differently. Preserve personality and identity throughout; an accident must not respawn a different person to simplify recovery.

Loveseats offer a later multi-occupant test: each person has independent support and release, and the remaining person's load continues to matter. A person standing should not release both seats or erase the other occupant.

## Cooler

The existing cooler is the next contrasting object. Desired base behavior is a heavy slide, a scrape, a tip and stable rest. Use the real cup wells as support locations, including on a closed lid. Preserve the visual model and its pooled resources.

A hinged lid, latch release and a few escaping cans are additional expressive features. The lid should open about a mechanical pivot and move only its own parts; the current cream material batch is not a correct articulated assembly. An empty/full load variant can provide meaningful balance and weight variation if it is visible enough to justify tuning.

Loose contents are bounded props, not an excuse to spawn dozens of bodies. The first cooler proof is complete with a closed lid and correct holder motion; articulation is a subsequent explicit task in the plan.

## Cups and handheld drinks

Ambient handheld drinks already exist. Preserve that appearance and participation baseline while introducing a logical cup identity and transfer between hand, holder, supported surface and free motion. A hand pose hiding a drink during a conflicting activity must not silently create a physical duplicate.

Default ambient placement uses holders on compatible chair styles and the cooler's modeled wells. A cup sitting on an empty chair cushion is an optional surface placement; it obstructs that seat until removed and is never treated as a holder attached to a person. Do not populate every socket or make every person carry a drink.

Desired small interactions include sipping, keeping a drink upright while walking, putting it down before a two-handed task, catching or retaining it through a small wobble, dropping it during a hard fall and retrieving it afterward. Prioritize hand placement and transfer correctness before elaborate gestures.

Liquid can initially be a contained visual fill, with a brief pooled spill effect after release or tipping. Fluid simulation is outside the initial scope. A drink does not imply a purchase system; food-truck ordering and dining remain a separate game loop.

## Signs that help people find things

Place signs selectively where a player must choose a route, or where an entrance is otherwise easy to miss. Candidate destinations include a stage, food court, bubble juice stand, welfare point, camp area or beach when an actual accessible destination exists. These categories are examples; the planner must prove the target and route.

Arrows follow the next valid route segment or a proven clear approach, rather than a straight bearing across a lake, tent or barrier. Use a small number of high-value destinations per sign, stable labels and broad, readable symbols. Begin with at most three destination blades as a tunable layout default, not a measured universal optimum. Avoid advertising distant unbuilt or omitted POIs.

Physical variants can include a freestanding A-frame that topples, a post that falls at its base, or a hinged/flexible board that folds flat. “Flatten” initially means a fallen or folded state; actual mesh crushing is a separate art/physics extension. A fallen sign's arrows remain attached to its physical orientation, not magically upright.

Signs do not automatically spring back or acquire a repair task. A sign stays down while its local arrangement remains live, then can return upright after a safe distance reset and regeneration. Optional later volunteer repair must be an explicit policy, and the festival map remains independent so damage does not erase destination knowledge or create new discovery rewards.

## Relationships that create combinations

| Relationship | Example | Required consequence |
| --- | --- | --- |
| Supported | Person on chair; cup resting on cooler | Loss of support has a defined release transition |
| Held | Cup in a person's hand | One holder, coherent release velocity and one visual |
| Attached | Cooler lid or hanging sign | Pivot/constraint belongs to a defined owner and can be removed safely |
| Owned | Person's drink or preferred chair | An eligible recovery task can find the same object later |
| Shared | Loveseat with two sitters | Claims and loads remain independent |
| Disturbed | Chair hits cooler which drops a cup | Incident provenance can explain the result without endless penalties |

Start with concrete implementations of these relationships. Extract a common abstraction only after two working uses demonstrate the shared contract. Avoid inventing a universal simulation graph before the chair works.

## Sensory and social expression

Material, impact strength and sliding motion can select synthesized frame rattles, scrapes, thuds and cup clinks. Audio thresholds and per-object cooldowns prevent chatter from settling contacts. Nearby people can look, step away, wince, laugh or help according to their activity and personality. Strong sounds and reactions should have local relevance and capped fan-out.

The proposal to make empty-chair brushing less punitive remains a tuning recommendation. Preserve current numeric scoring until a reviewed fixture comparison supports a deliberate change. Physical contact, an injury-like fall animation, a social reaction and a penalty are separate decisions. Warm slapstick is the intended presentation, with no lasting injury system.

## Alternatives considered and retained boundaries

| Alternative | Why it was considered | Current disposition |
| --- | --- | --- |
| Scripted ballistic tumble without an engine | Small dependency footprint and easy first animation | Useful for cosmetic debris, but not the primary approach for secondary contacts/supports |
| Whole-game rigid-body conversion | A unified physical world | Retain Zerble's controller and current people/streaming ownership; solve the bounded prop problem first |
| Rapier | Relevant rigid-body, collider, sleeping and constraint features | First measured candidate; loading/device proof precedes commitment |
| Cannon-style pure-JS engine | Earlier no-build integration concerns | Alternative if the candidate fails a concrete acceptance test, not a parallel implementation project |
| Detach every moving mesh from its batch | Straightforward individual transforms | Prefer stable render bindings; allow a measured active render pool when ownership needs it |
| Full ragdolls immediately | Rich limb motion | Conditional extension after simple-body recovery exposes a visible limitation |
| Automatic repair of every prop | Restores a tidy world | Explicitly rejected for signs as a universal behavior; repair depends on kind and owner |
| Persist all debris forever | Absolute physical history | Rejected for the initial plan: keep temporary neighborhood state, then reset safely at distance |
| Retain a bounded history of visited arrangements | Preserve old accidents on return | Superseded by Gary’s approved distance reset; no serialized displacement history |
| Structural destruction, cloth and fluids | Wider physical sandbox | Preserve as future directions; they are not hidden requirements for this change |

## Distance-reset follow-up

Gary approved returning abandoned areas to their original arrangement after sufficient distance. Nearby consequences remain, and offscreen alone never means reset. A chair followed away from camp or a cup carried by a live nearby person remains live until its own dependencies can safely end. Coherent teardown releases seats, holders and aftermath claims before regeneration. Lasting progress and reward eligibility remain separate.

A festival-themed cleanup event, perhaps between festival days, is an optional presentation idea; no global event is needed for distance reset. The Zelda analogy motivated a clear reset rule, not a claim about another game’s internal memory implementation.

## Completion and future scope

The planned core includes production chairs/occupants, the cooler, transferable cups, route-aware damageable signs and bounded chair/drink aftermath. The ordered tasks cover each. Conditional extensions have explicit experiment/decision tasks so they are neither forgotten nor represented as automatically shipped. Art feel, device capacity and score tuning are judged with evidence, not guessed during documentation.
