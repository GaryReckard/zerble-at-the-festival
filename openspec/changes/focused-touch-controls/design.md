## Context

The bounded [Astra review](reviews/astra-plan.md) precedes implementation. Native
brake/parking behavior remains authoritative; this change refines interaction.

## Goals / Non-Goals

Goals: forgiving two-thumb driving, clear action hierarchy, safe menu navigation
and touch-only chase assistance. No new gameplay, physics tuning, desktop camera
assistance, automatic camera movement while parked, or new rendering resources.

## Decisions

- Keep a touch-only compact menu open beneath child sheets, at a layer below
  Settings (40), Upgrades (42) and Passport (65). Its presence pauses through the
  existing render-only branch and disables progress collection. Closing a child
  returns to the menu; Resume ends the pause. Input clears at each boundary.
- Child actions focus their own menu button before synchronously opening the
  existing sheet. Camera/music actions close and clear first, then directly call
  shared keyboard callbacks rather than creating an edge lost to clear(). Music
  toggle calls are serialized while the existing lazy load resolves. Do not
  change Sound.init or the iOS start-gesture chain.
- Retain a visible stick and add canvas-only lower-left start routing. Never
  cover HUD/map with an invisible gesture catcher. Each changed identifier is
  handled independently, including stick updates during a pinch. Retain raw
  contact as axis origin while clamping the drawn base inside viewport bounds.
- Consolidate touch sizing in styles.css; map CSS owns only its own placement.
  Move the compact map beside the upper-right menu, outside driving targets.
- Record camera gesture modality, active holds and a reset generation in Input.
  Touch orbit arms assistance; mouse/arrow orbit disarms it. While forward speed
  stays above hysteresis thresholds, wait a 1.25 s manual-release/motion-start
  grace, then ease yaw along its shortest arc and pitch toward the chase default
  at an exponential rate. Keep zoom. Reverse and parking veto assistance.
- Apply assistance only in chase, after intro/debug ownership checks. Pause,
  input reset, camera mode changes and stopped-to-moving transitions restart
  grace. Low/Mid material and audio ownership remain untouched.

## Risks / Trade-offs

- A hidden stylesheet override invalidated isolated layout assumptions: load map
  CSS in the new controls fixture and test combined geometry at short landscape.
- Held camera fingers can have zero deltas: test explicit gesture ownership,
  pinch survivors and hybrid mouse overrides rather than movement alone.
- Parent/child focus and pause can leak: test actual dialog stacking, wheel
  suppression, input reset and world/progress pause before claiming integration.
- All return timing uses simulation dt, with no wall-time resume catch-up.

## Migration Plan

No save or seeded-world migration. Title links and desktop shortcuts remain.

## Open Questions

None blocking implementation. Phone thumb reach and comfort remain acceptance.
