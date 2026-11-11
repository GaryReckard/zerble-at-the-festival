# Verification status, November 11

[Back to the report](README.md)

| Check | Result |
|---|---|
| `npm run check` | Passed (exit 0), including the new bounded-publication block in `bin/test-far-field`. |
| `npm run build` | Passed (exit 0). |
| Fingerprints, one call per snapshot | 120 horizons identical to the unchanged source. |
| Fingerprints, 0.5 ms budget | 120 horizons identical to the unchanged source. |
| Mutation checks on the new tests | Five deliberate defects were introduced one at a time and the source restored after each. Wrong height offsets, a dirt road reused against different pavement, a job kept across a cell change and a memo kept across a terrain change each failed the suite. The fifth, running road preparation without a deadline, publishes the same horizon in one call and is not a defect the suite should catch. |
| Real game, Low, production build | Title card, a real click on the Just Cruisin' plank, world boot. The first horizon published 1,004 instances and 3,903 road vertices, the same counts the Node probe gives for this seed and anchor, over 68–79 frames. A teleport of about 230 m published a second horizon (1,008 instances, 4,062 road vertices) over 26 frames with five ownership handoffs. No console errors after the page load. |
| Noon and Midnight | Captured on Low with a raised fixed camera: [before the first publication](screens/low-noon-before-first-publication.jpg), [Noon published](screens/low-noon-published.jpg), [Midnight published](screens/low-midnight-published.jpg). |

## Not verified

- **Frame timing in a browser.** The session's browser pane was not on screen, so the page ran at roughly one frame per second. The frame counts above are counts of game frames, and the 55–62 ms `maxApplyStepMs` values seen there come from a throttled background page; neither is a performance measurement.
- **Mid and High in the browser.** The publication path is the same on every tier and all three were fingerprinted in Node, but only Low was booted.
- **The iPad.** The fixed-route run is the acceptance check. Read `ffApply`, `ffApplyFrames` and the far-field world section, and watch how long the first horizon takes to appear after Start.

## Notes

- One console error in the session came from my own misuse of the debug surface: `__dbg.camLock` was called with an object instead of six numbers, which made the camera pose non-finite and stopped the loop in `updateAudioListener`. The page was reloaded and the checks repeated. `camLock` does not validate its arguments.
- The dev server started for this check was stopped afterwards.
