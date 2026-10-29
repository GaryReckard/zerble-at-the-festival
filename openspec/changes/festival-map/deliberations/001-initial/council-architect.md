## Architect's Position

### Priority Sequence

1. Freeze the data contracts before the view: canonical world identity, worker initialization/results, discovery blocks, stable static landmarks, live markers, and objective exceptions. Keep the reviewed separation between geography, discovery, live availability, and selection.
2. Build the lightweight harness around those contracts, including worker/world changes, unloaded landmarks, concurrent persistence and discarded callbacks. A map can be geometrically correct while observing the wrong world.
3. Integrate one central game update adapter and a map-owned worker/storage lifecycle, then add the compact/expanded view. Preserve the running game and the existing control owners rather than adopting Passport's modal behavior.
4. Verify the production Vite worker and harness outputs, then full-game driving, unload/reload, and browser restoration. Current Vite instructions govern; historical importmap inventories do not.

### Structural Risks Identified

- **Worker world identity must be explicit.** The generator's seed is module-local (`src/rng.js:17`, `src/rng.js:21`) and its caches also depend on a separate worldgen epoch (`src/worldgen/roads.js:31`). A worker import has its own module state. Initialize it with the canonical numeric seed from `getSessionSeed()`, a layout/schema version, and the relevant CONFIG snapshot; attach a world-generation token to every request/result and reject mismatches. Do not pass a numeric seed as a string, because strings are hashed while numbers are used directly (`src/rng.js:23`, `src/rng.js:29`). Keep runtime invalidation epochs separate from the durable layout compatibility version. The latter must remain stable across reloads.

- **Legacy mode needs an explicit map policy.** The live game still exposes a v1/v2 switch (`src/perf.js:69`), while this design queries only the v2 geography. A v2 background over a legacy v1 world would be false navigation. Either support legacy geography through its own adapter or explicitly disable the geographic map in that debug escape hatch with a diagnostic. Namespace stored discovery by world-generation mode so v1 and v2 records cannot mix. Do not alter the existing generation switch simply to avoid the issue.

- **Observation is not world ownership.** Registry membership and runtime IDs are allocated during `add()` (`src/registry.js:54`), and chunks unload through their existing owner (`ARCHITECTURE.md:174`). The map may remember a discovered static landmark, but must not retain its Group/material or cause a chunk to stay loaded. Retain plain metadata with a stable identity and position. Nearby-only dynamic entries must be reread from their actual owner and never promoted into durable static landmarks. Objective coordinates survive chunk unloading independently of both.

- **Keep map updates in the existing central loop without pausing the game.** The architecture owns physics and rendering centrally (`ARCHITECTURE.md:115`). Passport returns early from `tickBody()` while open (`src/main.js:1125`); that pattern contradicts the confirmed expanded-map behavior. Give the map a `tick/suspend/resume/dispose` contract, with hidden rendering distinct from continued discovery. Avoid a second unowned perpetual animation loop. DOM transition animation may remain browser-driven.

- **Persistence promises must match the session-seed contract.** Ordinary loads use a fresh seed unless a seed or settings-resume snapshot is supplied (`src/main.js:195`). Persisting by seed correctly restores the same festival, but does not imply the next random festival should inherit its terrain. Keep this explicit in player copy and acceptance. Broader world-resume policy would be a separate gameplay decision, not an incidental map change.

- **Harness and worker production wiring are part of the feature.** The Vite build has an explicit HTML page list (`vite.config.mjs:8`, `vite.config.mjs:34`). Add the new harness there if it is intended to ship, and use Vite's statically analyzable module-worker URL construction. Verify the production preview at the GitHub Pages relative base (`vite.config.mjs:17`), not only dev. Worker failures should leave a usable map shell and diagnostic status without a fallback synchronous generation spike on the gameplay thread.

### Verdict

- **Verdict**: Proceed with mitigations
- **Key Concern**: The worker, persistence layer, and live scene must agree on world identity without sharing scene ownership.
- **Recommendation**: The proposed module boundaries are appropriate and need no Three.js lifecycle changes. Add the explicit worker handshake/world-mode policy and central lifecycle contract before implementation, then verify durable metadata and production worker loading through the harness and real game.
