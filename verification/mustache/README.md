# Zerble Mustache

The references are Gary's front-on photos of the real red cart with purple faux-fur handlebars. This interpretation retains the game's stylized geometry: two broad flattened lobes, a central part, narrow outward sweeps, and small open upturned curls. Tiny saturated bulbs follow both edges of each half. The mustache sits lower with a mirrored four-degree outward tilt to clear the eyes. Below the hood, four broad headlight lenses sit against a black fascia with a small lower center panel. No textures, additional light sources, or cart physics changes are involved.

## View

Open `http://127.0.0.1:8765/sandbox.html?entity=zerble&perf=high` and set the camera through the existing sandbox door:

```js
__sandbox.cam.yaw = Math.PI;
__sandbox.cam.pitch = 0.08;
__sandbox.cam.dist = 8;
__sandbox.cam.target.set(0, 2, 0);
__sandbox.applyCam();
```

Use Noon and Midnight. Checked captures: [Noon](noon.png), [Midnight](midnight.png). For an oblique view, use yaw `Math.PI - 0.5` and pitch `0.24`.

## Regression Check

Headlight follow-up: the lens gaps are 0.08 m, between the original wide gaps and the first 0.018 m revision. The lower center panel is 0.81 m wide, half its previous width; the wide bar beneath it has been removed. Night spotlight intensity is 18 (previously 8.5), range is 36 m (previously 28), and the ground targets sit farther ahead at local z=-12. The same two shadow-free lights remain off in daylight; lens emissive brightness is unchanged.

The check runs against real Three.js geometry, not the no-op Node geometry shim:

```js
const { checkMustache } = await import('/verification/mustache/check.mjs');
checkMustache(__sandbox.currentEntity);
```

In the main game, pass `__dbg.game.zerble` instead. It verifies mirrored/shared body geometry, finite front-facing normals, silhouette bounds, flattened depth, instanced tufts, animation references, full-edge small bulbs, thin headlight dividers, black fascia, two shadow casters, and an 11,000-triangle budget. The final result is 68 mesh submissions and 10,368 triangles for the mustache, including 64 bulbs. The existing star-power material traversal remains in place.

The initial shape was verified on high and low sandbox paths; the follow-up was checked at Noon/Midnight on high and in the Low main game after the real title-button click, with no browser errors. Before the final one-mesh bumper removal, fixed-camera sandbox stats were 240 scene draws versus the original 391, including the additional perimeter bulbs and front fascia. This is a draw-count observation, not a device FPS benchmark. The original before screenshot is retained temporarily at `/var/folders/87/21271msd0sd1z2063kqknpbh0000gp/T/opencode/mustache-before.png`.
