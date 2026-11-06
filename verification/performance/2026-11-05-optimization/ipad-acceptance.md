# Older-iPad Safari acceptance

The desktop lab establishes the recorded fixed-tier Chrome conditions only.
Gary's reported device was an older iPad of unknown model, using Safari on the
published game. The local implementation has not been deployed, and the
[published-version receipt](published-version.json) records a verified source
difference. Do not use that old release as an equal-content A/B control.

## Record the device and build

Record the model and iPadOS version from Settings, Safari version where
available, orientation, Low Power Mode, whether the device is charging, and
whether it feels warm. Use the same settings and camera for comparable runs,
and allow cooling between runs. Save a separate source/build manifest alongside
the guided report, since its current session metadata records settings and the
seed rather than an immutable source/build identity. A workflow revision by
itself does not establish the exact served asset.

## Capture the actual symptom

Use the existing [guided capture workflow](../../../docs/performance-playtests.md#capture-workflow)
from this repository on the same Wi-Fi as the iPad:

```sh
bin/playtest-perf drive --tier auto --seed 3948869160
```

Scan its QR code, open Safari, and start through the ready Just Cruisin' plank.
Keep Safari foregrounded, follow the parked/drive/recovery phases, and use
FELT LAG for noticeable hitches. Drive through a populated hub and into new
terrain during the driving phase; switch among chase, first-person and top-down
and use the normal touch camera controls. Note driving feel and any disappearing
children, misplaced shadows, input problems or unusual warmth. Wait for SAVED
before closing the tab and stopping the launcher with Control-C. This also
tests the actual synchronous audio-start gesture; muted desktop runs cannot
establish audible iOS behavior.

For a second fixed-tier investigation, run the launcher separately with
`--tier low`. Auto quality changes belong to the real-world symptom capture;
fixed Low helps identify whether tier selection explains a difference. Those
two captures have different conditions and are not an equal-work A/B comparison.
Use the same tier and quality policy for any later before/after claim.

Read the exact saved JSON with `bin/report-perf-playtest /absolute/path/to/capture.json`.
Retain frame distributions, worst stalls, quality/resolution transitions,
visibility interruptions and felt-lag markers, alongside the written device
notes. If the intended route was stationary or the app was backgrounded,
preserve that report and repeat rather than treating it as a successful drive.

No hardware-Safari performance result is implied until this procedure produces
valid saved evidence. The local tokenized upload URL must remain private.
