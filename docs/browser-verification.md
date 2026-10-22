# Browser verification and cleanup

[Documentation index](README.md) · [Debugging reference](../DEBUGGING.md)

Use an available browser with a real GPU for ordinary visual verification and
performance measurements. Use the browser tools available in the current
session; `preview_*` names in historical reports are examples, not required
integrations. Keep `mute=1` on every game and sandbox URL unless testing audio.

## Process ownership

Reuse a suitable existing development server, and stop any server you start
when finished. Close test tabs to stop their render loops.

For standalone automation, use one unique named session per bounded task and
keep only one headless WebGL system alive. Record existing browser/daemon PIDs
before launch, impose command deadlines of at most 60 seconds, close the exact
session in `finally`, and verify that every PID created by the task is gone.
Check recorded PIDs directly rather than trusting a truncated process listing.
Do not kill pre-existing processes. If software WebGL pegs the CPU or a command
stalls, stop the owned process tree before doing more testing.

Local `AGENTS.override.md` can impose stricter limits. In particular, Gary's
Mac currently prohibits `bin/layout-snapshot capture` until its cleanup fix has
been verified. The manual data-capture recipe remains available. The presence
of cleanup code is not evidence that its failure path has passed verification.

## Software WebGL fallback

Use this only when a normal browser cannot create a WebGL context and pixels
are needed. Software-rendered timings do not establish device performance.
The commands below require the same bounded lifecycle and cleanup checks.

### `bin/verify-headless`

If a browser cannot create a WebGL context, `main.js` fails before installing
`__dbg`. Confirm that `canvas.getContext('webgl2')` returns null or inspect the
renderer-construction error before changing game code.

`bin/verify-headless` launches Playwright Chromium with SwiftShader, captures
pixels and console errors, and exits nonzero for errors. It loads its runtime
from `~/.zerble-verify` or `ZERBLE_VERIFY_ROOT`, outside the repository; the
script prints setup instructions when that dependency is missing.

```sh
bin/verify-headless --url "http://127.0.0.1:8765/?perf=low&mute=1" \
    --eval "window.__dbg.start()" --wait 9000 --shot /tmp/boot.png
```

Use an external command deadline and process-cleanup checks for this fallback;
the example's `--wait` controls scene settling, not an overall timeout. Prefer
Low when the tier is irrelevant, and stop rather than extending a stalled test
indefinitely. For data-only captures, follow the
[layout verification guide](layout-verification.md) and local restrictions.
