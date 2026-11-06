# Boost wake rendering, November 2, 2026

Gary reported rings that appeared intermittently and seemed visible only over Zerble's silhouette.

`src/boostStreaks.js` used additive blending with `depthWrite: false`, but omitted `transparent: true`. Three.js therefore scheduled it in the opaque queue, allowing later ground/scenery draws to erase its colour. The material now enters the transparent pass, keeps depth testing, and uses `forceSinglePass` to retain one instanced draw for the additive double-sided geometry. No new geometry, lights, shadows or allocations were added to the update loop.

The main update also gated the wake with `AdaptiveQuality.bloomAllowed()`, even though these rings are ordinary geometry and need no bloom. That dependency is removed. Emission still requires boost, at least 15 m/s, and reduced motion disabled. Existing rings expire within 0.42 seconds after emission stops.

The game-juice regression now uses real Three.js materials and render-list classification rather than its former lightweight material stubs. It confirms the transparent queue, depth policy, single-pass policy, fixed pool, lifetime and accessibility gating. Low-tier sandbox observations show rings outside the cart silhouette over the ground at [Noon](noon.png) and [Midnight](midnight.png), with no console errors. The sandbox reported 244 scene draws and 31,105 triangles; these are an observation, not a device benchmark.

`npm run check` and `npm run build` passed. The full-game smoke test reused the existing development server, started through a normal ready Just Cruisin' title click, reached supported gameplay and returned no console errors. Sustained boost appearance was inspected in the effect sandbox, not established by a measured keyboard replay in the full game. The temporary browser tabs were closed; no development server or standalone browser was started. Physical-device acceptance is not established by these desktop observations.
