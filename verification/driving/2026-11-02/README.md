# Physical driving verification, November 2, 2026

The player uses a dynamic Rapier chassis and four raycast wheels. This follows the same broad design as [Rapier's vehicle controller](https://rapier.rs/docs/user_guides/javascript/vehicle_controller/) and the [cannon-es raycast vehicle example](https://github.com/pmndrs/cannon-es/blob/master/examples/raycast_vehicle.html), while retaining the existing Rapier world and Zerble's game-specific handling.

## Desktop observations

- The Low course replay leaves the ridge, lands on the lower course and records landing damage. See [ridge-low.png](ridge-low.png). The fallback contact shadow is now hidden while the wheels are airborne, and the course camera eases its aim along with its position.
- A seeded Mid-tier Just Cruisin' session drove into a real lake. The cart reached 1.69 m immersion, its engine stopped and sustained submersion opened the game-over screen. See [lake-mid.png](lake-mid.png) and [lake-mid.json](lake-mid.json).
- The real title and driving flow ran on Low and Mid; captures include [Low gameplay](live-low-final.png), [Low at night](live-low-night.png) and [Mid at night](live-mid-night.png). The course sound was enabled and muted without a JavaScript error, but sound quality was not assessed by listening.
- Following feedback about sluggish handling, powered rolling resistance and steering were retuned, boost gained additional acceleration, and the presentation now interpolates between fixed physics steps. The seeded lake approach reached 1.30 m immersion within three seconds of forward driving, where water resistance also applies. The new handling still needs Gary's play-test assessment.
- Gary subsequently reported that the handling still does not feel right. A further candidate increases boost pickup/top speed and compensates for boosted understeer without lifting the front tires. `node bin/test-player-handling` compares both steering directions, countersteering and support; the [rendered boost turn](boost-turn-low.png) exercises the real course. This is mechanically verified candidate behavior, not accepted feel. See the [focused Astra handoff](../../../openspec/changes/physical-zerble-driving/astra-handoff.md) for measurements and the next review's scope.
- Festival Run endings and submission boundaries were tested using a local mock, rather than submitting a test score to the live leaderboard.

- The subsequent [focused handling pass](handling-pass.md) replaces that boost/grip candidate with bounded grounded speed/yaw assistance, restores the specified boost target and records comparable flat/uphill/downhill replays. Gary subsequently accepted this focused handling pass and requested committing the complete implementation.

## Automated coverage

`npm run check` covers fixed-step driving at multiple render rates, cliff motion, surface response, water depths and engine cutoff, collision damage and incident deduplication, bridge rail heights, static scenery, player residency, Star Power re-entry, passenger transforms, both game-over modes and teardown. `npm run build` verifies the production bundle and course entry point.

## Limits

Gary accepted the desktop handling after the focused pass. These observations do not establish iPhone or iPad handling or iOS audio. One Low-tier live capture reported 508 draw calls and 266,647 triangles against displayed targets of 80 and 150,000. A clean comparison build could not be served because the environment denied the additional local socket, so this observation cannot attribute the excess to the driving changes. Physics timings from these desktop runs include startup and concurrent test activity and are not a device benchmark. The remaining device and baseline work is tracked in [ROADMAP.md](../../../ROADMAP.md#physical-driving-acceptance).
