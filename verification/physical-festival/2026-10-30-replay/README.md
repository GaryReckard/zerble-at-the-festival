# Repeatable occupied-chair reactions

October 30, 2026. The [production-Crowd replay fixture](../seat-reaction.html)
now supports resettable wobble/save, controlled exit and physical fall/recovery,
normal and quarter-speed playback, pause, single-step and peak-wobble inspection.

## Ground truth and results

Wobble and exit prescribe the dynamic chair's pose to isolate the supported
reaction; they are not a measurement of natural chair stability. The support
height follows its lower edge rather than floating above the floor. The fall
starts with a tilted dynamic chair and uses real gravity, contacts and recovery.
All paths use the real reserved person body and production reaction controller.

- [Save result](save.json): bracing at step 15, supported again at step 68, relaxed
  by step 180, zero seat releases and one retained supported load.
- [Exit result](exit.json): bracing, then dismounting at step 10, complete at 57,
  with one seat release and no retained person reservation.
- [Normal fall](fall-normal.json) and [quarter-speed fall](fall-quarter.json):
  falling at step 1, settled at 60, recovering at 68 and complete at 151.
  Their transition histories match exactly in the same Chrome runtime.
- Pausing held step 69 unchanged across inspection; single-step advanced a fresh
  peak-wobble inspection from 30 to 31. Reset checks that the previous reservation
  was released. Disposal reported zero engine bodies, colliders, supported loads,
  contact pairs and budget records, and disabled the controls.
- Low [Noon](low-noon.png) and [Midnight](low-midnight.png) captures show supported
  bracing. The [paused recovery](recovery-paused.png) capture shows the fallen
  sitter beside/overlapping the fallen chair silhouette before clearing it.
  This is a simple capsule reaction with temporary self-chair contact protection,
  not an articulated ragdoll. Full player visual acceptance remains open.
- The fixture retains 29 draws and 2,006 triangles through the observed modes.
  These are fixture counters, not mobile performance measurements.
- `npm run check`, `npm run build` and the fixture build passed. Chrome reported
  no fixture errors; main-game smoke used a real ready Just Cruisin’ click,
  world boot and console inspection. Existing module-type and bundle-size warnings
  remain. Owned tabs and the temporary server were stopped after verification.

## Reproduce

```sh
node --input-type=module -e 'import {build} from "vite"; await build({build:{outDir:"/tmp/zerble-replay-fixture",rollupOptions:{input:["index.html","verification/physical-festival/seat-reaction.html"]}}});'
npm run preview -- --host 127.0.0.1 --port 8766 --strictPort --outDir /tmp/zerble-replay-fixture
```

Open `/verification/physical-festival/seat-reaction.html?mute=1&perf=low` on that
preview, choose a replay, and use Playback or Pause / resume to inspect it.
Stop the preview afterward. Existing player previews are unchanged.

## Scope

This completes the supported-load/bracing inspection when combined with the
[real-engine supported-load and lifetime tests](../2026-10-30-supported-loads.md)
and [bracing input/clock tests](../2026-10-30-bracing/README.md). The wider
occupied-chair gate, device measurements, drinks and broader release acceptance
remain incomplete. Next implement actual cooler cup-well sockets and separate
lid geometry before comparing controlled and physical hinge behavior.
