# Festival performance pass, 2026-10-14

Open `check.html?mute=1` through the local server to run actual production genre definitions in OfflineAudioContext. No audio is played aloud. `results.json` records finite, non-silent, unclipped output across every section type of jam, brass, dance and world, plus deterministic motif assertions. Each section is compressed to two bars for this check, including its transition fill. This is technical verification, not a listening review or a full-song aesthetic assessment.

The same page constructs all nine instrument variants and checks four meshes per performer, one shadow caster, shared geometry/material disposal tags, and independent animation state. The rendered models contain 2,404–3,432 triangles for the tested variant. Cache keys are instrument plus one of four appearance variants. Static stage equipment is one merged mesh per stage with two shared geometry templates.

Sandbox checks used `?perf=mid&mute=1`: main stage at Noon and Midnight, guitarist from front/side/rear, and tent stage from the audience entrance. Main-stage preview reported 54 draws and approximately 23,770 triangles including sandbox ground. Night preview now invokes the existing fixed context-light pool, as the game does. No new light slots or shadow-casting lights were introduced. Individual performer animations and stage/tent animation wiring use the same model hooks.

Main game seed 1234 was started through the title button on both Mid and Low, with no captured warnings or errors. Mid also exercised the nearest-stage teleport and Midnight setting. The game remained session-muted. These are runtime smoke checks, not a whole-world performance certification; the debug panel still reported total scene draws and triangles above its targets.

`npm run check` passed in full, including importmaps, dimensions, shadows, forest determinism, chunk deadlines and the gameplay suites. Road-depth regression evidence lives in `../road-shadows/`.

## Captures

- `stage-noon.png`: main-stage layout and equipment.
- `stage-midnight.png`: performer washes using the shared light pool.
- `guitar.png`: front silhouette and playing pose.
- `tent-stage.png`: equipment and musicians within the tent.
- `game-midnight.png`: main-game smoke check after teleport.

## Maintenance

`buildPerformer().userData.animate(seconds)` changes only per-instance transforms. Stage drummers sit on the riser; marching drummers carry a waist snare. Tent performers now register in the existing chunk-owned animation list and use its unload cleanup. `bakePerformancePart` merges vertex-colored primitives and tags cached geometry as shared; do not dispose these caches during chunk or sandbox entity unload.
