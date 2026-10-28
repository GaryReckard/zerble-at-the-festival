# Why

Roads are flat brown strips beside textured grass, so the festival grounds lack surface detail and a readable distinction between busy access routes and quieter paths. Selective paving should follow the existing map plan and road graph rather than a random cosmetic roll.

# What Changes

- Add tiled dirt grain, worn patches and small stones, with a separate restrained asphalt texture.
- Assign coherent surfaces to complete existing road edges using planned hub roles, with somewhat wider paved access routes and dirt roads serving smaller festival areas.
- Carry surface and width metadata through layout queries, clearance, map drawing, detailed roads and distant proxies.
- Preserve terrain conformity, deterministic road routes, world resource ownership and tier support.

# Capabilities

## New Capabilities
- `road-surfaces`: semantic road surfaces, texture scale and map/render/clearance agreement.

## Modified Capabilities
None. Existing roads retain their graph topology and arterial compatibility tier.

# Impact

Worldgen road metadata and footprint consumers; chunk and far-field road rendering; procedural textures and shared materials; map/production previews and verification. This touches determinism, shared resource lifetime, Low-tier materials and terrain clipping. Player-visible changes require CHANGELOG documentation. No audio or scoring changes, no commit or deployment.

# Scope Check

The relevant parallel surfaces are detailed worldgen arterials and legacy paths in src/chunks.js, access paths built by festival/woodland/camp helpers, coarse roads in src/farField.js, both map-sandbox road passes, planner clearance in src/worldgen/roads.js and festival.js, and road-based placement in chunks/woodland/camping. Grass texture generation in src/world.js establishes the existing procedural texture idiom. Dirt texture applies consistently to dirt paths; semantic paving applies only to explicitly planned road edges. The completed road underlay terrain fix must remain intact. Stage seating refinements are a separate user follow-up tracked in verification/people/stage-followups.md and must be preserved throughout this change.
