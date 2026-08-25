## ADDED Requirements

### Requirement: Dynamic bloom gating

The bloom pass SHALL be skipped during bright daytime unless star power is active,
coordinated with (not fighting) AdaptiveQuality's existing bloom control.

#### Scenario: Bloom is skipped during ordinary daytime driving

- **WHEN** `nightness` is at or below 0.08 and star power is inactive
- **THEN** the bloom pass is disabled for those frames, saving its full-screen
  multi-tap cost
- **AND** when `nightness` rises above 0.08 or star power activates, bloom
  re-enables without flickering at the threshold.

#### Scenario: Dynamic gating defers to AdaptiveQuality and the tier

- **WHEN** AdaptiveQuality has dropped bloom under load, the player has explicitly
  disabled bloom, or the tier disables bloom (`PERF.bloom` false)
- **THEN** the dynamic gate never re-enables bloom against that decision — the
  effective state is the AND of (tier allows) ∧ (AdaptiveQuality allows) ∧
  (`nightness > 0.08` or star power is active).

### Requirement: Arrival-transition curtain

The renderer SHALL support a brief, deliberate arrival transition that, when triggered on hub entry, hosts any residual shader-compile cost so a leftover stall reads as an intentional arrival beat. The transition MAY be disabled (it is a polish item, gated on whether a residual stall remains), but when enabled it MUST behave as the scenario describes.

#### Scenario: Hub entry plays a bounded arrival flourish

- **WHEN** the player crosses into a hub's influence for the first time
- **THEN** a short (~400ms) bloom/warm-grade swell with an audio cue plays once,
  and any unavoidable first-render compile work is scheduled within that window
- **AND** the flourish is rate-limited so it does not replay on every chunk or
  re-fire while already inside the same hub.

### Requirement: Unique streamed textures follow owner disposal

Every non-shared texture created for a streamed world object SHALL be disposed
when its owning object unloads, without disposing module-cached textures still in
use elsewhere.

#### Scenario: A campsite tapestry unloads

- **WHEN** a chunk, lake, hub preview, or sandbox removes a campsite tapestry and
  disposes its unique material
- **THEN** the tapestry's unique CanvasTexture is disposed in the same lifecycle
- **AND** repeated load/unload cycles return `renderer.info.memory.textures` to
  the pre-load baseline.
