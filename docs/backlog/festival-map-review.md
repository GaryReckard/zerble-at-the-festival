# Festival map plan review

Date: 2026-10-29. Reviewer: Astra, low reasoning effort, focused single-reviewer pass. Scope: design review with narrow source inspection; no runtime implementation or device measurements.

## TL/DR

The plan is ready for harness-first implementation, with the contracts below added before their respective integration stages. Its separation of geography, discovery, live entities, and objectives is sound. The largest delivery risks are synchronous geography work interrupting driving and input ownership during simultaneous driving and map interaction. None requires changing Gary's decisions about live gameplay, player centering, no panning, or nearby-only characters.

## Findings

### P1: A frame budget cannot interrupt a synchronous worldgen query

The plan correctly calls for bounded work and cancellation, but needs a smallest-work-unit contract. `queryRegion()` synchronously constructs all three feature collections (`src/worldgen/index.js:82`), while a cold festival plan synchronously computes its base and neighboring seam responses (`src/worldgen/festival.js:818`). Both base and seamed caches clear wholesale past 4,000 entries (`src/worldgen/festival.js:786`, `src/worldgen/festival.js:836`). Scheduling one oversized query per frame would still stall driving, and cancelling afterward would only discard the result.

**Recommendation:** Set a hard query extent and measure the worst cold unit before choosing tile dimensions. Stress cache rollover as well as normal cache misses. If one bounded unit exceeds the budget, split the computation or isolate pure generation in a worker; do not rely on a time check between large calls. Acceptance must include worldgen cost and caches, not just map drawing. The plan already names these measurements (`festival-map.md:68`, `festival-map.md:74`); make them a gate before expanded zoom.

### P1: Specify gesture ownership and migrate the touch music action too

Driving controls have their own touch identifiers, while game-camera drag and pinch attach directly to the game canvas (`src/touch.js:32`, `src/touch.js:114`, `src/touch.js:138`). `Input.clear()` resets every touch gesture (`src/input.js:68`), so reusing modal-open behavior would interrupt the driving that Gary explicitly requires. In addition, `consumePressed('M')` combines keyboard M with the touch music latch (`src/input.js:79`), and the main loop consumes that combined action for MIDI (`src/main.js:1235`). Moving only the keyboard binding can make the music button open the map or stop working.

**Recommendation:** Define separate map and music actions, preserve active stick/button gestures through expansion, and claim only touches that start on the map. Map pinch must exclude fingers owned by driving controls. Add tests for holding throttle while opening, zooming, selecting, closing, cancelling a touch, and changing orientation, plus keyboard focus/Space activation without an accidental honk. This concretizes the existing interaction acceptance (`festival-map.md:82`).

### P2: Give persistent landmarks a generator-derived identity

The proposed stable marker ID is essential (`festival-map.md:46`), but registry IDs are allocated with `nextId++` when objects register (`src/registry.js:54`). They cannot identify a landmark across unloading or another session. Festival descriptors already carry `clusterSeed`, used for deterministic model construction (`src/chunks.js:1337`), but uniqueness should be defined rather than assumed.

**Recommendation:** Specify a composite world/layout, owning hub, descriptor, and child-kind identity, with an explicit discriminator for repeated children. Keep runtime registry IDs only as temporary associations. Test unload/reload, changed generation order, persisted selection, and duplicate-kind landmarks. Preserve the existing distinction between planned candidates and actual built destinations (`festival-map.md:48`).

### P2: Add asynchronous persistence races to the fog contract

The plan covers version isolation, resets, failures, and bounded pending work, but does not specify what happens when an old read or write completes after reset or world replacement (`festival-map.md:60`, `festival-map.md:79`). This is a design gap, not an observed runtime defect.

**Recommendation:** Give each loaded discovery session a generation token and fence stale callbacks. Define atomic read/merge/write behavior for discovery bits, including two tabs exploring the same block, and ensure a reset cannot be undone by a queued write. Add delayed-read, delayed-write, reset-during-flush, and concurrent-tab fixtures. When persisted blocks load late, preserve newly discovered in-memory bits rather than replacing them with the older snapshot.

### P2: Distinguish suspension from final disposal

The plan groups closing, resizing, restarting, and page teardown together (`festival-map.md:72`). Existing gameplay already treats persisted page hiding differently from final disposal (`src/main.js:615`) and handles visibility and page restoration separately (`src/main.js:1079`). An unconditional map teardown on pagehide could leave it inert after browser back/forward restoration.

**Recommendation:** Define compact, expanded, hidden, suspended, and disposed states. Closing expansion keeps compact rendering alive; hidden mode keeps discovery alive; suspension stops rendering and resumes cleanly; final disposal removes listeners and invalidates asynchronous work. Add back/forward-cache restoration and repeated visibility transitions to lifecycle acceptance.

## Mission compatibility and readiness

The independent objective identity and visibility exception are appropriate (`festival-map.md:50`). Preserve an objective when its scene object unloads, but never represent a missing moving actor as a fresh location. Add fixtures where an unknown-area objective reveals only its pin, a nearby character leaves range while selected, and multiple objectives retain identity while compact emphasis changes. This also resolves the historical proposal for one compass widget per passenger without committing to duplicate HUDs (`.claude/passenger-quests-design.md:183`).

Proceed with the lightweight harness and these contracts. Pickup visibility and arbitrary personal waypoints remain Gary's explicit open product decisions (`festival-map.md:88`); they need not block discovery and rendering work. No performance or integration acceptance is claimed by this review. Use current Vite check/build and real-game verification requirements, not historical no-build tooling (`AGENTS.md:35`, `AGENTS.md:61`).
