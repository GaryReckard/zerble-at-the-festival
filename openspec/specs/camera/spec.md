# Capability: camera

> **Source:** `src/camera.js` (`ChaseCamera` — three modes + zoom + the intro
> reveal + the debug pin). Input comes from `input-controls`; the debug camera-lock
> surface is in `sandbox-harness`.

The camera is a three-mode chase rig. Arrow keys add persistent yaw/pitch offsets,
wheel and pinch zoom each mode appropriately, and an intro reveal orbits from a PNG-match
pose into the chase pose at boot.

## ADDED Requirements

### Requirement: Three cycleable camera modes

`ChaseCamera` SHALL provide `third` (chase — fixed offset behind the cart, smooth
follow), `first` (eye-level, follows heading), and `top` (zoomable top-down), cycled by
`V` or the Cam button. Arrow keys SHALL add yaw/pitch offsets that **persist** when
released (no auto snap-back) (`camera.js:4,82,117-131`, `ARCHITECTURE.md:287-294`).

#### Scenario: Camera offsets persist

- **WHEN** the player yaws the camera with an arrow key and releases it
- **THEN** the camera holds the new bearing rather than snapping back behind the cart

### Requirement: Per-mode zoom that persists across switches

Zoom SHALL be wheel + two-finger pinch, routed per mode: chase uses a dolly multiplier
(`chaseZoom`) on default distance/height; first-person uses an FOV (telephoto) change
(`fpvFov`) since UP/DOWN are pitch there; top-down uses its height. Each SHALL persist
across mode switches so a mode returns exactly as last left (`camera.js:43-55,85-88,150-161`).

#### Scenario: Top-down returns where you left it

- **WHEN** the player zooms top-down, switches to chase, and switches back
- **THEN** top-down restores its previous zoom height

### Requirement: Intro reveal orbit

At boot the camera SHALL run an intro reveal: hold a pose matching the title PNG while
it cross-dissolves, then orbit around to the chase pose while the FOV widens from a long
lens, before handing control to the normal chase follow (`camera.js:57-73,257-328`).

#### Scenario: Boot orbits into the chase pose

- **WHEN** the game starts
- **THEN** the camera orbits from the PNG-match pose to the chase pose, then follows normally

### Requirement: Debug camera pin overrides the chase

A debug pin SHALL be able to re-assert a fixed pose every frame, ignoring chase/intro
logic, so a close-up screenshot pose can't be stolen back by the chase follow (the
`__dbg.camLock`/`camUnlock` surface) (`camera.js:90-95,166-178,333-337`, `sandbox-harness`).

#### Scenario: A locked camera holds for a screenshot

- **WHEN** the debug pin is active
- **THEN** the camera holds the fixed pose every frame regardless of cart movement
