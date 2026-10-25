## Context
Progress is currently split between bubble unlock persistence, scoring, stage challenges and GA rollups. Terrain work is active on the same branch.
## Goals / Non-Goals
Goals: meaningful persistent player stats, accessible passport, trustworthy increments and tests. Non-goals: cloud identity, new leaderboard, terrain/physics edits, new world geometry.
## Decisions
Use a pure stats store with injected storage and clock; DOM UI is separate. Count x/z travel immediately around the actual zerble.update call, excluding any later resolver/tow/teleport jumps. Sample current distance from spawn only for legitimate movement. Start at the original generated entrance, keep origin/visit counters in settings snapshot, migrate lifetime smiles once. Notify stage visits through existing ChallengeTracker radius. Count successful normal/special bubble births without RNG draws. Pause collection while hidden, in title/intro, passport, and after game over. Keep cumulative local state and a separate telemetry checkpoint so GA receives increments only once per interval/hide. Include current/max distance as gauges, never sum snapshots as totals. Persist every ten active seconds, on stamp and hide; guard all storage and analytics failures. Visit ends on ordinary reload/new game; explicit settings restart resumes it.
## Risks / Trade-offs
- Local saves can be cleared or unavailable: label browser-local storage, keep in-memory behavior and show save failure.
- Save schema cannot recover historical movement: import existing lifetime smiles only and label other counters as starting now.
- Stage identities must include world seed and quantized coordinates; never retain mesh objects.
- Geometry, RNG, disposal and material policies unchanged. New module imports are pure and synchronous; preserve Sound.init gesture chain and cover all five importmaps.
- Concurrent work: no terrain/world/zerble edits; review scoped diffs immediately before staging.
## Migration Plan
Version 1 passport save imports existing lifetime smiles once, with no recreation of historical stages/distances or retroactive analytics.
## Open Questions
None.

## Resolved lifecycle contracts
Opening the passport pauses the entire gameplay tick, including resource use, collisions, day progression and camera controls; rendering continues. Input and touch latches clear on both transitions. All mutations share one eligibility predicate excluding hidden/title/intro/capture/game-over/passport states.
Movement sampling compares the previous endpoint with the next physics start. Any external displacement invalidates exploration records/stamps/stage discovery for the remainder of that visit, while the physical current-distance gauge and subsequent genuinely driven distance remain available. A rescue is also marked explicitly. Ordinary reload starts an eligible new visit; settings resume preserves the flag. This conservative rule prevents a teleport followed by ordinary driving from earning remote exploration records. UI explains when exploration records are paused.
Settings capture flushes local totals and consumes any telemetry increments BEFORE serializing visit state; hide therefore cannot duplicate them. Resume restores visit counters but never re-adds them to lifetime totals.
Stamp catalog: Wanderer (500 m from entrance this visit), There and Back (reach 500 m then return within 25 m in the same eligible visit), Stage Hopper (3 distinct stages this visit), Night Owl (a stage visit with nightness > .5), Smile Spreader (1,000 lifetime raw pickups), Bubble Maker (1,000 successful lifetime emissions). Imported smiles do not trigger retroactive telemetry or stamps; a subsequent accepted collection can earn Smile Spreader.
The DOM preview uses the production menu with injected in-memory empty, populated and storage-failure fixtures; it never writes player progress or sends GA.
