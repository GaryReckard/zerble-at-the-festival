# Bubble Upgrades baseline observations

- Starting ref: `b215b8d08cbfb1928806ac36607e3b000f5ab2ec`.
- Baseline `npm run check`: passed; full output is in `npm-run-check.txt`.
- Sandbox views visually inspected in the in-app browser:
  - `sandbox.html?entity=bubbles&perf=low&mute=1`, Noon (`t=0.30`, `nightness=0`).
  - `sandbox.html?entity=bubbles&perf=low&mute=1`, Midnight (`t=0.75`, `nightness=1`).
  - `sandbox.html?entity=bubbles&perf=high&mute=1`, Noon (`t=0.30`, `nightness=0`).
  - `sandbox.html?entity=bubbles&perf=high&mute=1`, Midnight (`t=0.75`, `nightness=1`).
- Main game visually booted on Low at `/?perf=low&mute=1`. With the cart parked and bubbles flowing, one HUD sample read 1,598 draws and 449,881 triangles at `t=0.17`, with juice at 95%. The world was still streaming, so this is a point-in-time sample rather than a settled comparison.

The four screenshots were displayed during the browser inspection, but the
available in-app browser screenshot API did not provide a filesystem path or a
way to save its returned image bytes into this evidence directory. The empty-
tank HUD sample is also missing: the in-app browser has no JavaScript console,
and the detached Chrome DevTools console opened on its own `devtools://` context,
where `__dbg` was undefined. The existing agent-browser/headless-shell PIDs were
already present before this task, so I did not launch another headless WebGL
browser alongside them. Checkpoint 0.3 remains unchecked until the four image
files and empty-tank draw/triangle sample are saved here.
