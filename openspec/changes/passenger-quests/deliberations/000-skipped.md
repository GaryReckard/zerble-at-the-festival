# Deliberation skipped by Gary's choice

**Decision:** Skip the council. On 2026-11-15 Gary chose "Light OpenSpec, skip council" when asked how heavy the process should be, because his remaining usage window was short. This is a recorded exception, not a claim that the change is trivial or independently reviewed.

| Signature checked | Present? | Mitigation |
| --- | --- | --- |
| Determinism / RNG | No seeded stream is touched | Quest rolls use `Math.random`, as boarding already does. The plan functions are read-only and memoized. No registry or worldgen hash input changes. |
| threeShim / material tiers | Sprite materials only | `SpriteMaterial` is not swapped by the shim. Verify the bubble on Low. |
| Boot order | Low | New modules are imported normally by `main.js`; the real game boot is part of every slice. |
| Chunk / lake / forest lifecycle and disposal | Low | Bubble sprites and textures are owned by one world-lifetime pool and never enter a chunk group. The instance owns its textures without shared tags and disposes them only at pool teardown. |
| Performance budget | Low | The live presentation allocates five reusable sprite slots. Candidate gathering runs when planning hails or boarding offers, rather than on every frame. |
| iOS audio | Touches `sound.js` | New voices are added beside existing ones. Nothing is inserted before `Sound.init()` in the start gesture. |
| Crowd lifecycle | Yes | The runtime polls solo rider liveness and the monk party reports its own departure. This is the implemented mitigation; consult the verification record for executed checks rather than treating this skip as proof of scatter, dry-tank or restart coverage. |
| Leaderboard economy | Yes | Rewards are sized against the Worker's placeholder ceiling and reported in the verification record for Gary's playtest. |
