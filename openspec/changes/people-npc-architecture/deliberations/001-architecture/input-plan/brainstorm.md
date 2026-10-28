# People and NPC architecture: broad exploration

Date: 2026-10-25. This is the divergent phase, before choosing an architecture.
These are candidate directions, not commitments or claims about existing behavior.
The goal is a coherent way to add and maintain festival inhabitants; freeze is only
the observation that exposed inconsistent integration.

## What the code establishes

| Observation | Verified source |
| --- | --- |
| General people combine lifetime, behavior, parties, and instanced render uploads in one update | `src/crowd.js:910-970` |
| Children own separate population, movement, happiness, collision, and mesh state | `src/obstacles.js:389-454`, `src/obstacles.js:495-784` |
| Main knows individual update signatures and collision lists | `src/main.js:1193-1196`, `src/main.js:1219-1244`, `src/main.js:1526-1543` |
| Honks dispatch directly to several groups with different eligibility rules | `src/main.js:1041-1062` |
| Monks reuse crowd identity but install their own avatars and group policy | `src/monks.js:12-49` |
| Healing Arts borrows crowd people and temporarily supplies their visible rig | `src/healingArtsActivity.js:3-50` |
| Camp music already uses a separate activity controller with job-owned claims | `src/campJamActivity.js:10-38` |
| Registry supplies spatial queries and chunk-indexed membership | `src/registry.js:1-4`, `src/registry.js:21-80` |
| People can be authored as place-owned performers, not only roaming populations | `src/chunks.js:61-68`, `src/chunks.js:114-116`, `src/chunks.js:3151` |
| Shared steering already works across different renderers | `src/steering.js:1-12` |
| One-wheel encounters independently query crowd arrays and register moving colliders | `src/oneWheels.js:64-87` |

## Brainstorm without ranking

1. **Conventions only.** Keep controllers and agree on consistent names, time inputs,
   diagnostics, and ownership comments. No new central object.
2. **A thin population coordinator.** Register a controller once to participate in
   scheduling, inspection, interactions, collision collection, and teardown.
3. **A shared person record.** Everyone gets identity, position, heading, traits,
   lifetime ownership, and explicit activity references, regardless of renderer.
4. **A complete entity/component system.** Store entities as IDs and compose movement,
   social behavior, rendering, collision, and activities as separate components.
5. **One enormous improved Crowd.** Fold every human-like entity into the existing
   crowd pool and select behavior by role.
6. **Independent species with shared protocols.** Children, adults, puppets, and riders
   retain separate internal state but expose common participation contracts.
7. **Separate identity from appearance.** Instanced adults, individual child models,
   monk avatars, and activity rigs become alternative views of the same person.
8. **Activities as temporary jobs.** Camping, music, bathrooms, yoga, photography,
   boarding, and bubble play borrow a person rather than owning a new person.
9. **Groups as first-class controllers.** A family, monk party, band, or parade owns
   shared intent and formation without duplicating each member's lifetime.
10. **A reservation service.** Seats, beds, instruments, and activity slots use
    explicit claims with one interruption/release path.
11. **A single interaction router.** Honks, collisions, bubbles, cheers, and love
    buffs reach eligible participants through typed capabilities.
12. **An event bus everywhere.** All systems publish and subscribe, eliminating
    direct dependencies and allowing replay.
13. **A shared neighborhood view.** Systems ask for nearby people through one query
    interface instead of knowing whether they live in `crowd.npcs` or a gaggle.
14. **Register every person in the world registry.** Use its spatial index for all
    actor queries, ownership, interactions, and collisions.
15. **Keep spatial and simulation registries separate.** Population identity and
    lifetime are independent of the registry's footprints and chunk removal.
16. **Deterministic simulation time and replay.** Actors consume explicit time and
    private random streams; a small scene can replay inputs for debugging.
17. **Behavior trees or utility AI.** Choose activities using priorities or scores
    instead of expanding a single growing state machine.
18. **Data-driven archetypes.** Describe speeds, interests, reactions, and capabilities
    as plain data while keeping algorithms in code.
19. **A population director.** Coordinate density, encounters, families, and roles
    across the festival rather than letting each population follow the player.
20. **Simulation levels of detail.** Update distant decisions less often while
    retaining nearby collision correctness and animation quality.
21. **A people workshop.** Extend the sandbox with adults, children, a group,
    activity handoff, collisions, and lifecycle controls using production code.
22. **A contract test kit for new inhabitants.** Every controller passes the same
    lifecycle and integration scenarios before custom behavior is assessed.
23. **Dependency boundaries enforced mechanically.** Prevent model code importing
    gameplay owners and prevent new character-specific branches in `main.js`.
24. **Do nothing structural until a full rewrite.** Keep patching exceptions and
    eventually replace everything in one migration.

## What a good result would feel like

A developer adding a family or a performer can answer: who owns this person,
who decides where they go, who moves them, who draws them, what they react to,
and what releases their claims when they leave. Those answers should be clear
without following unrelated branches through `main.js`.

The player still sees distinct inhabitants with distinct behavior. Shared
infrastructure must not make a child behave like a small adult or make a parade
behave like a collection of independent pedestrians.
