# Safe contact restoration after seat release

October 30, 2026. The adapter now owns a bounded, generation-safe exclusion for a specific pair of bodies. Seat preparation reserves it before admitting the supported load, and body removal clears it. Default capacity is zero, preserving the current live empty-prop path.

The exclusion uses Rapier 0.21.0 `ActiveHooks.FILTER_CONTACT_PAIRS` and returns no contact for that pair only. Other solid contacts continue to compute impulses. `resumeSeparatedContacts` checks current compound shape transforms with a 3 cm margin before removing the exclusion, and exhausted queries retain protection. This is a geometry decision, not a timer. The pinned package contract is in `node_modules/@dimforge/rapier3d-compat/dist/pipeline/physics_hooks.d.ts` and `dist/geometry/shape.d.ts`.

## Evidence

- [Contact regressions](../../bin/test-physics-contact-suppression) compare an overlapping unfiltered negative control with the protected body, verify real ground landing, restore contacts after separation and test a later return collision. They cover pair capacity, foreign/stale tokens, current transforms before stepping, query exhaustion, margin, two independent exclusions, body-ID reuse and 100 teardown cycles.
- [Seat release regressions](../../bin/test-physics-seat-release) reserve exclusions at saturated body/collider capacity, reject exhausted pair capacity before transferring a sitter, and release from a real tilted sling chair over ground. The person remains finite, below the test's 10 m/s speed bound, and above the ground. Existing momentum and rollback checks remain in place.
- [Camp transfer regression](../../bin/test-camp-support-transfer) composes these reservations with actual person/seat ownership and cleanup.
- The full `npm run check` suite and production build passed. A fresh Low game boot used the ready Just Cruisin’ button, rendered the festival and returned no captured console warnings/errors. The test tab and temporary preview were closed; Gary’s separate preview remains available.

## Discovery and limits

The first tilted-chair assertion assumed the bodies would naturally separate after landing; the real solver disproved it. Both can settle while still overlapping. The corrected test verifies protection persists and only ends after an explicitly clear later pose. That test movement is not a shipped recovery animation or stand-up planner.

This does not prevent a released body passing through its original chair while they overlap. It deliberately prevents artificial depenetration energy during the handoff. Ground and other furniture remain solid. Live reaction control must poll restoration, and a clear recovery target must precede stand-up. Future carried attachments need their own reserved exclusions. No live occupied-chair admission, visible fall, recovery, phone performance or iOS acceptance is claimed here.
