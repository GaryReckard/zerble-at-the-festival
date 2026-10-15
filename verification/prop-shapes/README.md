# Prop shape verification

The canoe, hammock, kiosk and jug improvements shipped in `dbf29dd`. This follow-up records verification and extends the Node import stub for canoe curve geometry.

- `check.html?mute=1`: 317 assertions passed against actual Three.js builders, covering finite geometry, hollow hull, tapered hammock fabric, suspension, seat anchors, RNG consumption and resource ownership. See `results.json`.
- Two-paddler canoe: 23 meshes, 3 shadow casters, 2,072 triangles. Posted hammock: 7 meshes, 1 caster, 304 triangles. Tree hammock: 5 meshes, 1 caster, 240 triangles.
- Noon and midnight screenshots cover all four props; the hammock preview includes a seated NPC.
- Main game booted with seed 932033385, low tier and `mute=1`, with no captured warnings or errors.
- `npm run check` passed after adding the missing TubeGeometry/CatmullRomCurve3 import stubs. These stubs support logic tests; the browser fixture checks real geometry.
