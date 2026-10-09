# Smile Pickup Face

Open `sandbox.html?entity=smile_face` for a stationary front close-up or `sandbox.html?entity=smile_pickup` for live rise/homing motion. The face points along actual displacement, not at the camera, so it intentionally becomes edge-on or hidden when travelling sideways or away. Gold body and halo behavior are unchanged; lost red orbs retain their existing appearance.

The face is a single unlit dark mesh curved over the orb, with shared geometry/material per Smiles instance, no texture or shadow caster, and 64 triangles per earned pickup. [Noon](noon.png) and [Midnight](midnight.png) captures use Low tier.

Run the real-Three.js regression from either local page:

```js
const { checkSmiles } = await import('/verification/smiles/check.mjs');
await checkSmiles();
```

It checks finite geometry, resource sharing, face orientation during rise/homing and target direction changes, unchanged scoring, and no happy face on lost orbs. Low-tier game boot through the real title button and its browser error check passed.
