# Bounded Astra plan review

November 17, 2026. Requested by Gary and completed before implementation by
gpt-6.2-astra, high reasoning, read-only with an eight-minute maximum brief.

## Recommendations adopted

- Keep the paused touch menu below child sheets so close returns to the menu.
  Existing menuUi.js focus/clear and passportMenu.js inert lifecycle support it.
- Execute menu actions directly after clear, not through queued J/V edges;
  guard overlapping MIDI lazy-load toggles and retain unread bubble feedback.
- Route world-canvas lower-left touches to the stick without overlaying map/HUD.
  Process every changed identifier, including stick motion during a pinch.
- Remove conflicting global touch sizing from festival-map.css, and explicitly
  position the compact map away from Brake.
- Use touch gesture modality and active holds for chase return, with grace,
  speed hysteresis, shortest yaw arc and exponential decay. Preserve stationary,
  parked, reverse, mouse/arrow, first/top and zoom behavior.
- Test pause/focus/input handoff and combined portrait/short-landscape geometry.

## Source pointers supplied by reviewer

`src/menuUi.js:26`, `src/passportMenu.js:97`, `src/main.js:1296`,
`src/input.js:78`, `src/camera.js:151`, `src/touch.js:371`,
`festival-map.css:30`, `src/drivingControls.js:34`.

Line numbers describe the pre-implementation tree. The reviewer made no edits.
