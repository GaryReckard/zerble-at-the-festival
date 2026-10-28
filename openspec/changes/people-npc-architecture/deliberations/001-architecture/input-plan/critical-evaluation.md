# Critical evaluation of the candidate directions

This phase evaluates the preceding [brainstorm](brainstorm.md). Recommendations
are design judgments; current-code claims are grounded in its evidence table.
The pre-council recommendation below is subject to real independent deliberation.

## Evaluation criteria

Prefer a design that makes ownership and integration explicit, preserves distinct
behavior and existing rendering efficiency, can migrate in runnable increments,
and gives the next developer a small testable contract. Do not confuse fewer files
with fewer responsibilities or more abstraction with better structure.

## Decisions before council

| Candidate | Disposition and reasoning |
| --- | --- |
| Conventions only | Necessary but insufficient: no mechanism ensures new groups join interaction, collision, and cleanup paths. Main currently lists each participant explicitly (`src/main.js:1219-1244`, `src/main.js:1526-1543`). |
| Thin coordinator plus explicit protocols | Recommend: makes participation discoverable while preserving controller internals and render batches. It must not become a second behavior engine. |
| Shared identity and renderer-independent access | Recommend a minimal handle and read/query interface, introduced through adapters. Do not immediately replace every internal crowd field. Monks and Healing Arts already preserve crowd identity across different visuals (`src/monks.js:39-49`, `src/healingArtsActivity.js:3-27`). |
| Full entity/component system | Retain as a legitimate alternative, reject for this migration: replacing storage, scheduling, behavior, and renderer integration at once creates more change than the identified boundaries require. No measured requirement here establishes the need for that storage model. |
| Fold everyone into Crowd | Reject: adding child, parade, and rider branches to a controller that already owns behavior and rendering would preserve the responsibility problem (`src/crowd.js:910-970`). |
| Independent controllers with shared contracts | Recommend as the migration mechanism and stable home for genuinely distinct movement policies. Avoid permanent duplicate implementations of identical rules. |
| Temporary activity jobs and group intent | Recommend, building on camp jobs and monk parties (`src/campJamActivity.js:10-38`, `src/monks.js:12-49`). Membership, movement authority, reservation, and renderer attachment must be separate concepts. |
| Universal reservation framework | Narrow to an explicit person-activity ownership protocol and adapters for existing resources first. A generic resource transaction engine would exceed the demonstrated need; registry mutations are not transactional (AGENTS.md, constraint 5). |
| Direct interaction router with capabilities | Recommend. Use explicit synchronous calls and deterministic ordering. Supported reactions can vary; shared infrastructure does not require everyone to cheer, smile, board, or flee. |
| Event bus everywhere | Reject as the default: hidden subscribers obscure order and ownership, which are the questions this refactor should answer. Keep existing bounded audio callbacks where appropriate. |
| Shared neighborhood interface | Recommend an interface over existing candidate providers first. Changing broadphase/storage at the same time can change first-hit behavior; registry explicitly preserves insertion ordering (`src/registry.js:28-30`). |
| Put all identity into world registry | Reject as the lifetime authority. Its chunk ownership index serves world content, while crowd lifetime intentionally follows distance (`src/registry.js:25`, `src/crowd.js:910-915`). Publish spatial facets where useful without transferring lifetime. |
| Simulation clock and deterministic replay | Recommend explicit time for extracted behavior and animation. Preserve existing random streams during structural moves. Full deterministic replay is a separate feature: legacy gaggles use `Math.random()` (`src/obstacles.js:405-426`). |
| Behavior tree or utility AI replacement | Do not adopt during this refactor. First isolate activity selection from execution; the new boundary can support a later algorithm if concrete behavior requirements justify it. |
| Data-driven profiles | Recommend bounded tuning records for existing differences. Do not build an authoring DSL or load executable behavior from configuration. |
| Population director and simulation LOD | Document as extension points, exclude behavior/scheduling policy changes. Existing roadmap requires measurement before changing crowd scheduling (`ROADMAP.md:53-56`). |
| Workshop and contract test kit | Recommend as prerequisites, using production paths. A model-only sandbox cannot prove identity handoff, collision integration, or cleanup (AGENTS.md, verification guidance). |
| Mechanical boundaries | Recommend limited dependency checks once modules have settled. Do not use source-regex checks as proof of actual behavior. |
| Big-bang replacement later | Reject: it provides no enforceable integration path now and concentrates the eventual migration risk. |

## Falsification: how the preferred approach could fail

- A coordinator that merely hides the existing calls can leave duplicated ownership
  and cross-controller writes untouched. Completion must include public person and
  activity boundaries, not only an update loop.
- A universal person object can impose per-person allocation and rendering overhead.
  Handles must refer to existing records, with stable pooled storage where needed.
- Moving monk and activity updates out of Crowd can accidentally tick them twice.
  The migration needs a single-owner schedule and execution-count tests.
- A shared collision query can change candidate order and thus the chosen hit.
  Preserve the existing source order until an intentional behavior change is tested.
- An activity lock can accidentally prevent urgent safety reactions or invalidate
  a seat still owned by another user. Interruption precedence and generation-safe
  ownership must be explicit and verified.
- A new clock can shift dance phases, photographer cooldowns, and day transitions.
  Move clocks separately from module extraction and record any intended visible change.

These are prospective failure modes, grounded in existing scheduling, pooled
identity, collision order, activity claims, and wall-clock animation demonstrated
in `src/crowd.js:910-970`, `src/main.js:1526-1543`,
`src/healingArtsActivity.js:20-50`, `src/models/kid.js:246`, and
`src/registry.js:28-30`; none is asserted to be an observed runtime bug.

## Recommended shape to deliberate

One population runtime coordinates explicit controllers. A minimal person handle
provides identity and access without dictating storage. Activities borrow authority
through explicit claims, group controllers supply intent, movement controllers
apply it, and renderers display the resulting pose. World registry remains spatial
infrastructure. Existing behavior and random draw order are the baseline.

The structural refactor is complete when a new character family can join through
registration and documented capabilities without new character-specific update,
honk, collision, inspection, or cleanup branches in `main.js`.
