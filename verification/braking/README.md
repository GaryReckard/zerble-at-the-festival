# Brake and parking verification

November 17, 2026. Implementation is in the working tree after planning commit
`65f1b0c` was pushed. This record does not establish a deployed release or physical
phone acceptance. See the [change](../../openspec/changes/brake-and-parking/README.md)
and [design](../../openspec/changes/brake-and-parking/design.md).

The later [focused touch-controls work](../touch-controls/README.md) supersedes
the initial touch layout pictured here; the native brake/parking contracts remain.

## Contracts and native physics

- `node bin/test-driving-controls`: neutral-qualified forward/reverse release,
  held throttle, explicit release, brake priority, total velocity/air eligibility,
  no queued rejection, relocation/reset and parking persistence across neutral.
- `node bin/test-brake-input`: actual keyboard/touch handlers, Space/E/R separation,
  simultaneous sources coalescing, browser shortcut and text isolation,
  touchcancel/blur/modal clear and the Park button's accessible state.
- `node bin/test-vehicle-braking`: 54 native Rapier cases across grass, asphalt and
  riverbed profiles, 30/60/120 Hz physics steps, level and ±30% grades, with aligned
  and cross-slope headings. Each exercises five seconds of settled service hold,
  three seconds of latched parking, fresh-throttle departure, forward braking,
  reverse braking and release to roll on slopes. All settled holds drifted less
  than 1 mm in these authored fixtures. [Saved measurements](native-results.json).
- The same native test proves a 140% bank can slide despite braking, airborne
  braking applies no impulse and leaves gravity active, and an external impulse
  moves a parked cart, which then holds its new stop rather than returning to an
  old pose. This is finite force control, not a transform lock.
- `node bin/test-player-handling`, `node bin/test-player-vehicle`,
  `node bin/test-player-driving-live` and `node bin/test-touch-steering` passed
  after integration. Existing keyboard trajectories and analog steering reversal
  checks remain covered. The debug-teleport input-isolation check now exercises
  the complete Input facade rather than a source fragment missing Input.clear.

`npm run check` passed in full. `npm run build` passed. Existing Node module-type
and build chunk-size warnings remain; they are not failures or device timings.

## Browser observation

Used the in-app browser and one tab at a time, always muted. No standalone
headless browser or software-WebGL process was launched.

- Normal ready mode-plank clicks booted Low and Mid real-game worlds. Low showed
  parking set with R and release on W. Mid additionally covered the service
  brake, fresh reverse release, parking persistence across Passport open/close,
  rejection while moving and successful parking after braking. Error-level
  console inspection returned no entries after the observed runs.
- Mid daytime started at time .25; the capture was around .28 as the game clock
  continued. The Midnight command set time .75 for the night capture. Both show
  readable parking feedback: [daytime](mid-noon-parking.jpg) and
  [Midnight](mid-midnight-parking.jpg).
- `/menu-preview.html?screen=brakes&touch=1&mute=1` exercises production Touch,
  Input, parking and HUD without a second physics/render world. At 844×390, all
  six 88×88 touch buttons fit inside the viewport in two rows. Park changed to
  Unpark with persistent feedback; fresh throttle cleared parking. The fixture
  console had no error entries. [Landscape capture](touch-parking.jpg).
- Closed the test tab, reset the temporary viewport override and stopped the
  Vite server started for this task.

## Acceptance limits

The touch capture uses mouse/keyboard browser automation and a forced touch
layout; unit checks dispatch actual touch handlers. Neither substitutes for an
iPhone finger playtest. Real-phone thumb reach, stick precision without Slow,
hill-start feel and passenger pickup/drop-off comfort remain in
[ROADMAP](../../ROADMAP.md#physical-driving-acceptance). No phone frame-time or
performance improvement is claimed. The renderer-free preview has no physical
motion and does not prove hill holding; the native tests supply that evidence.
