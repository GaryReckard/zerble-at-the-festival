# Cooler lid partition and cup-well sockets

October 30, 2026, on `codex/physical-festival-integration`.

## Model contract

[The production cooler builder](../../../src/models/campsite.js) separates the
cream body trim from the lid. Handles, badge and drain stay on the body; the lid,
its catches and two cup wells rotate about the rear hinge at `(0, .372, -.223)`.
The opening axis is negative X and the angle is clamped to 0–1.85 radians.
The shell and seam now have an interior cavity, and each well has a sealed
underside so opening the lid does not expose a see-through hole.

`cupWells` exposes immutable left/right lid-local floor positions, upward axes,
0.063 m radii, 0.03 m depths and one-cup capacities. `sampleCupWell(id, out)`
publishes the native model's world floor position and opening direction after
rotation/scale. Once batching detaches the native meshes, this sampler refuses
to publish a false world pose, and direct lid manipulation requires a render
binding. The next integration must use the adopted instance transforms, not
these detached native meshes.

## Verification and measured cost

- `node bin/test-camp-cooler`: 40 native Three builds pass shared-resource,
  deterministic color, closed footprint, grounding and no-shadow assertions.
  Downward/reverse raycasts verify well floors and sealed undersides; transformed
  raycasts verify sockets with an open lid, translated/rotated/scaled root.
  Matrix checks prove opening does not move body hardware or cream trim, and
  a ray into the opened body reaches the cavity floor below 0.1 m.
- `node bin/test-physics-cooler`: real production kitchen/batch/registry adoption,
  30/60/120 Hz cart collisions, zero smile cost, source unload, regeneration and
  cleanup passed with the partitioned model.
- `npm run check` and `npm run build` passed; the targeted model test and build
  were repeated after adding underside and detached-model guards. Existing
  module-type and bundle-size warnings remain.
- Standalone model cost changed from **3 draws / 1,460 triangles** to
  **4 draws / 1,832 triangles**. The four geometries and existing materials are
  shared across variants; the new cavity adds 372 triangles. The sandbox scene
  reports 6 draws / 1,880 triangles / 7 geometries including its surroundings.
  This is a measured geometry/draw delta, not phone performance acceptance.
- Chrome sandbox captures: [Low closed](low-closed.png), [Low Noon](low-noon.png),
  [Low Midnight](low-midnight.png), [Mid Noon](mid-noon.png) and
  [Mid Midnight](mid-midnight.png). Opening preserves the handles, badge and drain;
  switching to another entity removes the lid controls. No console errors.
- Main-game smoke used a real Just Cruisin’ ready click and Stage cooler
  encounter; the production cooler reached active ownership and a Coast forward
  run recorded [one impact](live-result.json), zero overflow and no support block
  or console errors.
  Owned tabs and the temporary preview were cleaned up afterward.

## Next integration

The game still uses a closed-cooler collision recipe. This checkpoint supplies
mechanical model parts and socket metadata, not impact-driven lid motion, cups
or contents. Next compare a controlled lid against a physical hinge/latch with
bounded resources, then connect the selected behavior to adopted render parts
and transferable drinks. The pending phone and occupied-chair feel gates remain.
