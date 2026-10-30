# Source evidence and freshness

Inspected 2026-10-29 in the shared working tree on `codex/generative-hoop-dancers`. Line anchors are navigation aids, not immutable revision pins. Cooler work and unrelated hoop planning are concurrent; recheck symbols and local diffs before implementation. This document distinguishes observed source from the proposed architecture elsewhere in this change. No runtime performance or browser acceptance was measured during documentation.

## Contacts, people and ownership

| Observed behavior | Verified source | Consequence for this plan |
| --- | --- | --- |
| Legacy contacts use 2D overlap, approach speed and an early first-hit return | [collisionContacts.js:8](../../../src/collisionContacts.js#L8) | Physical contacts require their own authority, not a visual hook after the old bounce |
| `applyHit` reverses speed, nudges the cart and opens a 0.7s window | [zerble.js:1515](../../../src/zerble.js#L1515) | A light movable prop must not receive this response plus a solver impulse |
| The current main contact pass is gated on invulnerability and star power | [main.js:1685](../../../src/main.js#L1685) | Physics stepping must remain independent of damage eligibility; ghost filtering is explicit |
| Ordinary crowd candidates exclude riders, boarders, disembarkers and hidden/sleeping participants | [crowd.js:2517](../../../src/crowd.js#L2517) | New participation must preserve population and protected-state policies |
| An ordinary NPC hit releases activity where possible, offsets 0.6m, flees 3s and can panic neighbors within 6m | [crowd.js:2542](../../../src/crowd.js#L2542) | Existing reactions are scripted; physical falling is new work |
| A trapped camp sitter can refuse seat abandonment until an exit exists | [crowd.js:2576](../../../src/crowd.js#L2576) | Controlled dismount and unavoidable falling need distinct release rules |
| Seat reservations bind a slot to a live activity and entry | [campResources.js:7](../../../src/people/campResources.js#L7) | Availability, occupant release and recovery must go through claims |
| Registry IDs increment at runtime; chunk membership is indexed on add/remove | [registry.js:7](../../../src/registry.js#L7), [registry.js:55](../../../src/registry.js#L55) | Use a separate stable procedural prop key and explicit ownership transitions |
| Activity motion and optional hand pose/readback already have public claim-checked contracts | [people extension guide](../people-npc-architecture/extension-guide.md) | Reuse capabilities; do not let the physics module reach into raw crowd records |

## Chairs, cooler and beverages

| Observed behavior | Verified source | Consequence for this plan |
| --- | --- | --- |
| Chair styles include sling, director, low and loveseat, with actual seat offsets | [campChair.js:4](../../../src/models/campChair.js#L4), [campChair.js:32](../../../src/models/campChair.js#L32) | Physical recipes and support sockets can derive from existing model dimensions |
| Chair batching removes child meshes and stores their transforms in buckets | `batchCampChairs` in [campsite.js](../../../src/models/campsite.js) | Retain logical-part to instance-slot bindings; current batching does not preserve those bindings |
| Campsite child colliders are registered separately and linked to seat slots | [campRegistry.js:106](../../../src/campRegistry.js#L106) | Camp furniture is already solid; reuse metadata without duplicate colliders |
| Stage chairs have seats and footprints but no hard collider | [chunks.js:2009](../../../src/chunks.js#L2009) | Stage-chair integration is a separate explicit task, not covered by a camp-only pass |
| Cooler geometry includes two recessed cup wells and shared body/hardware/lid material groups | [campsite.js:848](../../../src/models/campsite.js#L848), [campsite.js:948](../../../src/models/campsite.js#L948) | Reuse the cooler and add actual transform/socket metadata |
| The cream/lid batch also includes handles, badge and drain details | [campsite.js:901](../../../src/models/campsite.js#L901) | Do not rotate the existing `cooler_lid` mesh as if it were a mechanical lid; partition by articulation first |
| Kitchen construction attaches the cooler but does not return an independent cooler descriptor; its collider uses `ez.group` | [campsite.js:963](../../../src/models/campsite.js#L963), [campsite.js:1303](../../../src/models/campsite.js#L1303) | Expose the actual cooler group; moving it must never move the canopy |
| Cooler tests cover three batches, bounds, pooling and raycast cup wells | [test-camp-cooler](../../../bin/test-camp-cooler) | Preserve those guarantees or deliberately update the budget with evidence |
| Appearance selects a drink with a 0.07 threshold through its seeded appearance RNG | [crowdAppearance.js:17](../../../src/crowdAppearance.js#L17) | Drink presence already exists; preserve stream order and baseline participation |
| Drinks use shared geometry, packed instance slots and arm-relative transforms; some activities hide them | [crowd.js:353](../../../src/crowd.js#L353), [crowd.js:750](../../../src/crowd.js#L750), [crowd.js:1823](../../../src/crowd.js#L1823) | Transfer must prevent duplicate held/dropped visuals and must distinguish hiding from actual dropping |

## Terrain, routes and destinations

| Observed behavior | Verified source | Consequence for this plan |
| --- | --- | --- |
| Terrain sampling follows the rendered grid's triangle split | [terrain.js:125](../../../src/worldgen/terrain.js#L125) | Physics ground must match this surface, including seams and disabled terrain |
| Road APIs expose approach roads, arterial polylines and bounded road queries | [roads.js:132](../../../src/worldgen/roads.js#L132), [roads.js:202](../../../src/worldgen/roads.js#L202), [roads.js:362](../../../src/worldgen/roads.js#L362) | They are useful route evidence; a universal local pedestrian routing graph has not been established by this survey |
| Festival plans expose deterministic POIs and placement structure | [festival.js:818](../../../src/worldgen/festival.js#L818), [festival.js:1291](../../../src/worldgen/festival.js#L1291) | Sign destinations must derive from descriptors and validated built access |
| Map labels and observed landmark identity exist | [markers.js:2](../../../src/festivalMap/markers.js#L2), [markers.js:16](../../../src/festivalMap/markers.js#L16) | Share a pure vocabulary where useful, but do not use discovery visibility as generation truth or reveal the map from a sign |
| Legacy path placement creates a chunk-center crossing | [chunks.js:746](../../../src/chunks.js#L746) | Do not mistake the legacy crossing for every current festival junction |

## Toolchain and verification

- [AGENTS.md](../../../AGENTS.md) and [development rules](../../../.claude/rules/no-build.md) establish Vite, normal imports, current verification and resource ownership. These supersede stale no-build/importmap wording in `openspec/config.yaml`, schema instructions and council templates.
- The workflow's advertised template filenames are stale; the actual [session-log template](../../templates/session-log-template.md) and [questions template](../../templates/questions-for-human-template.md) use a `-template` suffix. Memory files follow those structures and the explicit schema in [OpenSpec rules](../../../.claude/rules/openspec.md).
- [Browser verification](../../../docs/browser-verification.md) and Gary's local instructions require bounded owned browser sessions and explicit cleanup. Do not use `bin/layout-snapshot capture` while its cleanup issue remains unresolved.
- [Performance rules](../../../.claude/rules/performance.md) and [pooling rules](../../../.claude/rules/perf-pooling.md) cover tier budgets, shared-resource safety and instance writes. Existing HUD draw/triangle numbers do not measure physics CPU cost.
- Rapier is a candidate supported by its [rigid-body](https://rapier.rs/docs/user_guides/javascript/rigid_bodies/), [collider](https://rapier.rs/docs/user_guides/javascript/colliders/) and [initialization](https://rapier.rs/docs/user_guides/javascript/getting_started_js/) documentation. Pin and verify the chosen package/version in implementation; this plan does not establish engine performance or cross-browser determinism.
