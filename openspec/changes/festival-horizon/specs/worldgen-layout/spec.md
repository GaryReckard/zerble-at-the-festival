## MODIFIED Requirements

### Requirement: Persistent lifecycle (no chunkKey)

Render-agnostic worldgen **query features** (the tuples returned by
`queryPoint`/`queryRegion`: water, rivers, roads, hearts, density) SHALL carry
`lifecycle: 'persistent'` — like lakes, these hold NO `chunkKey`, so a 3D
consumer that registers one must do so in a way that survives host-chunk unload
(`index.js:29-32,74`).

Festival **cluster content** is explicitly outside this persistence guarantee:
per `festival-composition`'s "Cluster-center ownership filter" and the actual
consumption path in `chunks.js`, each cluster's built props are owned (and
chunk-keyed) by the chunk containing the cluster's center, and are torn down
when that chunk unloads. Deterministic descriptors from `festivalPlan` persist
as recomputable pure data; built content does not. A render-only observer such
as the festival horizon MUST therefore bind cluster visibility handoff to
descriptor-center chunk ownership plus `ChunkManager` completion, never to
worldgen persistence.

#### Scenario: Worldgen query feature survives chunk unload

- **WHEN** the chunk hosting a worldgen query feature unloads
- **THEN** the feature's registration (carrying no chunkKey) is not torn down

#### Scenario: Festival cluster content follows its owning chunk

- **WHEN** the chunk owning a festival cluster's center unloads
- **THEN** the cluster's built props (chunk-keyed to that owner) are torn down
- **AND** the underlying deterministic descriptors remain recomputable, so a
  render-only observer can restore its proxy without any worldgen state change
