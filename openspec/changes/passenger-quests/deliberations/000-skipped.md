# Deliberation skipped by Gary's choice

**Decision:** Skip the council. On 2026-11-15 Gary chose "Light OpenSpec, skip council" when asked how heavy the process should be, because his remaining usage window was short. This is a recorded exception, not a claim that the change is trivial or independently reviewed.

| Signature checked | Present? | Mitigation |
| --- | --- | --- |
| Determinism / RNG | No seeded stream is touched | Quest rolls use `Math.random`, as boarding already does. The plan functions are read-only and memoized. No registry or worldgen hash input changes. |
| threeShim / material tiers | Sprite materials only | `SpriteMaterial` is not swapped by the shim. Verify the bubble on Low. |
| Boot order | Low | New modules are imported normally by `main.js`; the real game boot is part of every slice. |
| Chunk / lake / forest lifecycle and disposal | Low | Bubble sprites and textures are owned by one world-lifetime pool and never enter a chunk group. Shared textures are tagged `userData.shared`. |
| Performance budget | Low to medium (revised after audit 001) | Up to five sprites and three DOM chips. A destination search runs per boarding and per hail attempt (at most one attempt every 9 s while fewer than two people hail), and each attempt scans the adult list once. Quests are switched off entirely under the performance lab, device autopilot and timed captures. |
| iOS audio | Touches `sound.js` | New voices are added beside existing ones. Nothing is inserted before `Sound.init()` in the start gesture. |
| Crowd lifecycle | Yes | The runtime polls `crowd.riderInfo` each frame instead of a hook. Node tests cover the engine and, with a fake crowd, the runtime's hailing, cap and shutdown; the real crowd methods have no unit test and scatter, dry-tank and run-end paths were not exercised in the game (corrected after audit 001, which found the original claim overstated). |
| Leaderboard economy | Yes | Rewards are sized against the Worker's placeholder ceiling and reported in the verification record for Gary's playtest. |
