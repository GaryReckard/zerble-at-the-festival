## Why

The current broad hills are easy to miss, while zero-height gathering pads suppress relief near destinations. Gary wants recognizable geography that changes travel: mountain barriers, connected camping shelves, sheltered gatherings, and functional stream crossings.

## What Changes

- Add bounded landscape districts with explicit foundations, gentle activity areas, steep wilderness and feasible access routes.
- Prove the Mountain Top sequence: lower camping meadow, upper meadow, side dirt-road ascent and short descending route to a drum circle/fire clearing.
- Add finite source-to-receiver streams and bridge crossings with shared rendered/contact geometry and continuous approaches.
- Separate terrain, water and support surfaces; include vertical solid eligibility and reachable routes for participating movers.
- Introduce opt-in, versioned generation only after a reusable production-backed proof passes. Existing random streams and the current default remain intact during implementation.
- Deliver diagnostics, deterministic contracts, bounded generation, lifecycle and real-device acceptance alongside the feature.
- Keep the later hillside Barn and first-aid booth/tent outside implementation scope; retain their roadmap entries. No guaranteed early hill encounter.

## Capabilities

### New Capabilities

- `landscape-travel`: bounded districts, surface identity, route admission, water/crossing coherence, staged integration and acceptance.

### Modified Capabilities

None in the first proof. Existing terrain/layout contracts remain the default until the versioned production integration task deliberately updates their affected specifications and goldens. The new capability defines that rollout obligation.

## Impact

Touches worldgen, streaming, registry/collision, cart/people motion, near/far presentation, physics surface adapters and sandbox verification. Preserve Three.js shim/tier policy, shared-resource disposal, synchronous start-gesture audio, independently salted randomness, and lake ownership. No library replacement or dependency addition is needed for the initial proof. Developer-visible harness changes require a dated changelog; final gameplay rollout requires separate verified release evidence.

Current AGENTS.md and .claude/rules/no-build.md supersede stale no-build/importmap wording injected by openspec/config.yaml. Use ordinary ES imports and Vite entry discovery; do not restore importmap inventories.

## Scope Check

Source survey found terrainHeight/sampleTerrain consumers in world, chunks, farField, lakes, forests, crowd, Zerble, Lurleen, Nut Wagon, one-wheel riders, camp grounding, birds and activity systems. Include their surface/accessibility audit in production integration, rather than converting only the player. The registry and collisionContacts use X/Z broadphase/contact; keep the broadphase but add explicit vertical narrow-phase eligibility for layered supports. Existing terrainSandbox and terrainDriving provide the first verification surface. The experimental physical-festival fixture owns a plane, so it is an adapter dependency, not proof of terrain integration. Water query river/bridge fields are false stubs; they do not satisfy the new capability.

Detailed checked evidence and full user requirements: [design backlog](../../../docs/backlog/landscape-and-travel.md), [independent Astra review](../../../docs/backlog/landscape-and-travel-astra-review.md). Existing varying-elevation acceptance and concurrent physical-festival changes remain separate and must be preserved.
