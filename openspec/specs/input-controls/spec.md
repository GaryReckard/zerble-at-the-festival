# Capability: input-controls

> **Source:** `src/input.js` (keyboard + touch blend, the source-agnostic facade),
> `src/touch.js` (virtual thumbstick, action buttons, drag/pinch). Driving consumers
> are `carts`; camera consumers are `camera`.

Input is a single source-agnostic facade. Keyboard and touch both feed the same
`Input` getters/edges so the rest of the game never branches on input source.

## ADDED Requirements

### Requirement: Source-agnostic input facade

`Input` SHALL expose `throttle`/`steer`/`boost` axes, `steeringDirection(speed)`, `camYaw`/`camPitch`, edge
helpers (`consumePressed`, `isDown`), and touch-only camera deltas/zoom consumers.
Driving axes SHALL blend a keyboard digital axis (`{-1,0,1}`) with the touch analog
axis (`[-1..1]`), with touch winning when active, clamped to `[-1,1]`, so the rest of
the game stays input-source-agnostic (`input.js:47-110`).

#### Scenario: Touch overrides keyboard when active

- **WHEN** the touch thumbstick reports a nonzero steer while no steer key is held
- **THEN** `Input.steer` returns the touch value

### Requirement: Keystrokes never leak into text fields

The keydown handler SHALL ignore events whose target is an `input`, `textarea`,
`select`, or `[contenteditable]`, so typing (e.g. a debug marker note) never fires
V/B/H/Y/M/G as game actions. Held keys SHALL clear on window blur, and default-blocked
movement keys (WASD/space/shift/arrows) SHALL `preventDefault` (`input.js:25-45`).

#### Scenario: Typing a note doesn't flip the camera

- **WHEN** the player types into a focused text field
- **THEN** no game action fires and the camera does not change

### Requirement: Virtual touch controls

`touch.js` SHALL install a left-side virtual thumbstick (throttle + steer, anchored
where the finger lands), right-side Honk / Boost / Cam buttons, drag-anywhere-else for
camera orbit/tilt, and two-finger pinch for zoom — feeding axes and one-shot edges
(honk, music) back into `Input`. It SHALL allow simultaneous stick + button + drag,
add a body `.is-touch` class to reveal the overlay on touch detection, and kill iOS
pinch + double-tap page zoom (`touch.js:1-48`, `ARCHITECTURE.md:278-283`).

#### Scenario: Thumbstick and a button work together

- **WHEN** one finger drives the thumbstick and another presses Boost
- **THEN** both register simultaneously

#### Scenario: Two-finger pinch zooms, not page-zooms

- **WHEN** the player pinches with two fingers on the canvas
- **THEN** a multiplicative zoom factor feeds the camera and the OS page zoom is suppressed

### Requirement: Touch steering stays continuous through a direction change

Nonzero touch steering SHALL follow actual signed travel speed, with the direction
factor fading linearly from -1 to +1 between -1.5 and +1.5 m/s. The thumbstick
SHALL apply independent 0.12 axis deadzones after radial clamping. Keyboard
steering SHALL retain its existing throttle-intent response, including when used
on a touch-capable device.

#### Scenario: Changing gear while turning

- **WHEN** the player pulls the stick backward while still rolling forward and turning
- **THEN** the cart brakes without immediately inverting its turn
- **AND** turning fades to zero at rest and reverses as the cart moves backward
- **AND** the same continuity holds when changing from reverse to forward

#### Scenario: A sideways thumb wobbles vertically

- **WHEN** vertical displacement stays within 0.12 of the stick radius
- **THEN** throttle remains zero while horizontal steering still works
