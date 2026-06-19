## ADDED Requirements

### Requirement: Dynamic bloom gating

The bloom pass SHALL be skipped on frames where nothing bright enough to bloom is
in view, coordinated with (not fighting) AdaptiveQuality's existing bloom control.

#### Scenario: Bloom is skipped during bright-emissive-free daytime driving

- **WHEN** the player is driving in open daytime territory with no bright emissive
  source (stage lights, fire, night bulbs) in frame
- **THEN** the bloom pass is disabled for those frames, saving its full-screen
  multi-tap cost
- **AND** when a bright emissive source comes into view (or night falls), bloom
  re-enables with hysteresis so it does not flicker at the threshold.

#### Scenario: Dynamic gating defers to AdaptiveQuality and the tier

- **WHEN** AdaptiveQuality has dropped bloom under load, or the tier disables
  bloom (`PERF.bloom` false)
- **THEN** the dynamic gate never re-enables bloom against that decision — the
  effective state is the AND of (tier allows) ∧ (AdaptiveQuality allows) ∧
  (something bright in frame).

### Requirement: Arrival-transition curtain

The renderer SHALL support a brief, deliberate arrival transition that, when triggered on hub entry, hosts any residual shader-compile cost so a leftover stall reads as an intentional arrival beat. The transition MAY be disabled (it is a polish item, gated on whether a residual stall remains), but when enabled it MUST behave as the scenario describes.

#### Scenario: Hub entry plays a bounded arrival flourish

- **WHEN** the player crosses into a hub's influence for the first time
- **THEN** a short (~400ms) bloom/warm-grade swell with an audio cue plays once,
  and any unavoidable first-render compile work is scheduled within that window
- **AND** the flourish is rate-limited so it does not replay on every chunk or
  re-fire while already inside the same hub.
