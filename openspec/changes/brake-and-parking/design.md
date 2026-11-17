## Context

Input.brake is diagnostic-only. The physical controller owns ground-plane
impulses; its velocity-only brake does not cancel downhill gravity at rest.
Touch has three driving buttons and clears gestures on modal entry.

## Goals / Non-Goals

Deliver approved controls, finite slope hold and observable parking state across
live physical and legacy paths. Exclude on-foot play, terrain/RNG changes,
performance tuning and automatic parking while coasting.

## Decisions

- A small DOM-free driving-control owner latches parking once per presented
  frame, consumes the R edge and adapts raw input before either motion path.
  It suppresses propulsion while braking/parked and qualifies release through
  neutral. It publishes brake/parking fields on the cart for presentation.
- Parking requires grounded, upright, near-zero total motion; no deferred
  request. Explicit release always works. Touch Park is visible when eligible
  or set, with a persistent desktop/touch status.
- Ground braking cancels tangential gravity and velocity within the existing
  contact/traction force budget. Apply a joint longitudinal/lateral bound while
  braking, not a pose write or extra native-wheel controller. Missing contacts,
  steep ground and immersion reduce authority. Keep free fall unaffected.
- At throttle release from parking, existing powered grade feed-forward takes
  over in the same frame. It remains finite and cannot guarantee every hill.
- Input clear/blur/cancel releases transient holds and edges, but not the
  parking latch. Restart/relocation clears parking state explicitly or through
  pose discontinuity detection. Diagnostic drives bypass ordinary parking.
- Preserve the existing keyboard precision action; remove only touch Slow.

## Risks / Trade-offs

- Hills can creep from native suspension/contact transients: measure settled
  displacement, not only final scalar speed, at multiple step cadences.
- Braking must not become unlimited lateral grip: bound the combined force and
  prove steep-bank sliding and impact motion.
- Touch state may stick on lost gestures: test actual handlers and modal clear.
- No RNG, threeShim, geometry, disposal, async boot or iOS audio-init changes.
  New pure imports use current Vite discovery, not obsolete importmap inventories.

## Migration Plan

No save migration or seeded layout changes. Update guides, previews and input
tests to the new bindings in the same implementation.

## Open Questions

None requiring user input. Physical iPhone feel remains a separate acceptance.
