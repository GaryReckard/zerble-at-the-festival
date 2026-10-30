# Photographer posing verification, October 30, 2026

The photographer uses the existing articulated crowd arms and planted-foot leg
solver. Both hands meet the camera grips throughout a smooth chest-to-eye lift,
settled exposure and return. The flash follows the raised camera. A crouching
photographer lowers the pelvis by 0.18 local metres while keeping the soles at
ground height; the scale applies to both offsets. Ordinary travel retains the
crowd gait while the hands carry the camera. Cups and shopping bags are hidden
while both hands are occupied, and special activity poses keep their priority.

## Repeatable inspection

Open `sandbox.html?entity=crowd_photographer&mute=1` on the local Vite server.
The controls run the production crowd updater in bounded 1/120-second steps:
Inspect carry, Inspect raise, Inspect shot and Inspect lower pause at those
moments. Step 1/60s advances a paused pose; Resume resumes ordinary behavior,
and Take picture begins another complete sequence. Entity switching removes
the fixture controls. Noon and Midnight use the existing lighting controls.

## Evidence

`npm run check` and `npm run build` passed on the shared working tree. The build
reported its existing large-chunk advisory; the checks included the concurrently
developed physics tests, which are outside this commit.

- `node bin/test-photographer-ownership`: 30 profiles × 1,200 frames retain the
  exact role, notice, pose, flash, cooldown and isolated random stream behavior.
  New contact tests sample every hundredth of a second of the shot, checking
  the production arm forward-kinematics result against the camera grip and the
  existing leg solver against grounded soles at scales 0.8, 1 and 1.3. Both
  standing and crouching variants and reused sampler output are covered.
- `node bin/test-crowd-photographer`: flash edge, rare-role determinism, instance
  release and shadow policy regressions.
- [Carry](carry.png), [Noon](noon.png) and [Midnight](midnight.png): real pooled Crowd character in
  the in-app browser, paused during carry and after exposure. The knees bend forward and both
  hands reach the eye-level camera. Sandbox console warnings/errors: none.
- The sandbox HUD reported 12 draws, 1,556 triangles and 19 geometries before
  and after the animation change. No geometry, material or shadow caster was
  added. These are scene counters, not device performance measurements.
- [Low-tier game boot](game-low.png): clicked the ready Just Cruisin’ mode
  button, observed the live world and inspected the console with no warnings
  or errors. The existing local server was reused; the test tab was closed.

Desktop browser evidence does not establish iPhone performance or iOS audio
unlock. All browser verification used `mute=1`.
