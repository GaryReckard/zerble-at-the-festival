# DEBUGGING.md — the agent iteration & debugging surface

This is the toolkit for **verifying and iterating fast** — built so an agent (or
Gary) can drive, inspect, and screenshot the running game in seconds instead of
booting it and chasing the camera around by hand. Read this before any
model/visual/gameplay change you intend to verify.

If you only remember one thing: **`window.__dbg` is the one door.** Open the
console (or `preview_eval`) and call `window.__dbg.help()`.

---

## The one door: `window.__dbg` (local dev only)

`__dbg` ([main.js](src/main.js)) is the **automation control surface** — it drives
the running game programmatically, bypassing the UX that resists scripting (see
[Why `__dbg` exists](#why-__dbg-exists-the-footguns) below). It's gated to
`localhost` / `127.0.0.1` and never ships to production.

It's also the *single entry point*: it aliases the other two surfaces, so you
never have to juggle namespaces.

```js
window.__dbg.help()          // prints the whole map — start here
```

### Drive the running game
| Call | Does |
|---|---|
| `start()` | Boot straight into gameplay, past the title-card trusted-gesture gate. Skips the intro reveal; audio is best-effort (stays silent in headless dev). |
| `teleport(x, z)` | Move the cart to world (x, z), zero speed. |
| `tod(t)` | Set time of day, `0..1` (0 dawn · .25 noon · .5 dusk · .75 midnight). |
| `setJuice(meters)` | Set the bubble-juice meter (drives the machine liquid, reserve jugs, HUD). |
| `addSmiles(n)` | Raise the score through the real HUD path, including the score pulse and session-latched personal-best celebration. |
| `boostStreak()` | Emit one reusable golden wake ring beyond Zerble's rear bumper. |
| `photographer()` | Promote one loaded crowd NPC through the isolated photographer profile and trigger its real notice, pose, and flash state sequence. |
| `fillSeats(kind?)` | Seat crowd NPC(s) — `kind` = `bench` \| `driver_seat` \| `roof`; no arg seats one of each. For pose-testing riders without waiting for organic boarding. |
| `rider(kind)` | Seat one free NPC in the first open slot of `kind`. |

### Festival Run drills (festival-run-stakes)

Stakes drills need an ACTIVE run: set `localStorage['zerble-mode'] = 'festival'`
before boot (or pick Festival Run on the card), then `start()`. In Cruisin' they
answer "no active Festival Run" instead of silently doing nothing.

| Call | Does |
|---|---|
| `runInfo()` | The whole run at a glance: mode, serialized run state (day/clock/sputter/vibe/rescue/over/cause), score + high-water, multiplier + chain, and the zerble sputtering flag. **Read this, don't poke internals.** |
| `runDay(n)` | Jump the day ramp — re-applies the day's jug keep-fraction + frown multiplier the way a real dawn does, and reports the day's tuning row. Day-5 tuning must not cost 30 real minutes. |
| `vibe(v)` | Set the vibe meter directly (no warn/eject side effects — pure meter nudge). |
| `strike(n)` | Land `n` real damaging-hit vibe strikes through `applyVibeStrike` — fires the warn whistle/toast at the threshold crossing and the `vibed_out` death at eject. |
| `sputterLeft(s)` | Shrink the 45s dry-tank grace (only while sputtering) so the expiry → death/rescue path runs in seconds. |
| `showScoreScreen(mock?)` | Raise the score screen with mock or real board data (view-only supported). |
| `seedBoard(n)` | Insert `n` fake local-leaderboard entries for score-screen rendering checks. |

Canonical death drills: **dry** — `setJuice(0)` → wait for `runInfo().run.sputter`
→ `sputterLeft(0.1)` → death screen (`ran_dry`), or the Lurleen tow rescue if she's
following and unused. **Vibe-out** — `strike(4)` for the whistle, keep striking to
eject. **Headless caveat:** under SwiftShader, game time runs at a few percent of
wall time (dt clamps at 0.05/frame) — drills must POLL `runInfo()` predicates, never
sleep wall-clock seconds, and toast asserts need a beat after the trigger
(MutationObserver delivery is deferred past a same-frame read).

### Camera for close-up screenshots
| Call | Does |
|---|---|
| `camLock(px,py,pz, tx,ty,tz)` | Pin the camera to a fixed world pose (position → look target). **Overrides the chase cam** every frame so it can't drag back. `tx,ty,tz` default to `(0, 1.8, 0)`. |
| `topDown(x?, z?, span)` | Pin a straight-down plan view centered on `(x, z)` (default: the cart), framing a `span`-metre square (default 240). Height solves `span = 2·H·tan(fov/2)`. North-up (the nadir gimbal singularity is handled in camera.js). `camUnlock()` restores Y-up. |
| `camUnlock()` | Release back to the normal chase cam (restores Y-up). |

### Tour + inspect hubs
| Call | Does |
|---|---|
| `gotoHub(n)` | Teleport to the `n`th-nearest festival hub and `camLock` a canonical 3/4 view of its stage front. `n` is ranked from the **spawn hub** (the major the game relocates to), so `gotoHub(0)` is the spawn hub itself. Prints the planned `hub-sandbox.html?seed=…&at=x,z` URL so the same hub re-opens in the group-6 viewer. |
| `showFootprints(on)` | Toggle a footprint overlay: a green ring at each festival cluster's clear-radius + the yellow dancefloor rects in front of every nearby stage (scenery — trees, shorelines, path nodes — is skipped). Plain line geometry, never registered/`shared`/shadow-casting; disposes fully on toggle-off (`renderer.info` returns to pre-toggle counts). |

### Far-field horizon (on by default; `?farField=0` disables)
| Call | Does |
|---|---|
| `horizon()` | **Read-only** live stats for the far-field layer: `{stats: {active, overflow, rebuilds, superseded, roadVertsUsed, roadsClipped, maxColdStepMs, handoffs}, playerCell, pendingCells, committed, counts (per pool), activeHandoffs, override}`. Returns `{enabled: false}` when `?farField=0` or `?worldgen=0` disables it. |
| `horizon('proxy')` | Force EVERY proxy visible (snaps, no envelope) — the "what does the pure horizon look like" side of a fixed-seed A/B screenshot pair. |
| `horizon('real')` | Force every proxy dissolved — the flag-on-but-invisible side of the pair (alignment/z-fighting checks against the real world). |
| `horizon('live')` | Back to normal predicate-driven handoff (proxies follow real chunk completion). |
| `horizon('replan')` | Drop the committed+pending snapshot so the next frame replans from scratch at the current cell — byte-identical result, for deterministic rebuild-timing and long-travel lifecycle captures. |

Planning is incremental (one 240m coarse cell per frame, inside the remainder
of the chunk streaming budget), so after boot or a teleport give the horizon a
few dozen frames before sampling — `horizon().committed` flips true when the
first snapshot lands. On SwiftShader (see "When no browser here can do WebGL
at all") frames are slow, so budget ~25s on low / ~2min on high for the first
plan; on real hardware it's ~1s. The hub sandbox has the same layer as an
isolated mode (Far field panel: Proxy only / Real only / Handoff + a simulated
player-distance slider) for composition iteration without the full game.

### Inspect the built layout
| Call | Does |
|---|---|
| `dumpRegistry(bounds?)` | **Read-only** JSON-able array of every registry entry — `{kind, x, z, footprint, colliderR, damage, attractorR, attractorW, chunkKey}`. Optional `bounds = {minX,minZ,maxX,maxZ}` clips to a window (one hub). This is the "built truth" the layout linter checks and `bin/layout-snapshot` freezes against; never mutates anything. |
| `dumpDrawCounts(bounds?)` | **Read-only** `{"kind@x,z": n}` map of how many times each worldgen cluster drew from its local rng — the canary. Positions matching but a count moving = an invisible draw add/drop/reorder. Same optional `bounds`. |

### Capture perf data over time
| Call | Does |
|---|---|
| `recordPerf(on = true)` | Start (or stop) the **perf-log recorder**: samples engine stats — `fps`, frame `avg`/`p95`/`max` ms, `draws`, `tris`, `geo`/`tex`, **`prog`** (live shader-program count), adaptive `quality`/`qualityLevel`, pixel ratio, bloom/bubble state, Trip state/envelope/progress/pass, star power, `heapMB`, `npc`/`reg`/`col` counts, chunk-gen `cgN`/`cgSlow`/`cgWorst`, and `x,z` — into a ring buffer at a fixed wall-clock interval (default 1 s). Each sample is persisted to `localStorage['zerble_perflog']` **as it's taken**, so the data survives the page going unresponsive + a force-reload. |
| `perfLog()` | Return a copy of the recorded sample array (`[{t, ts, …}]`). |
| `startDeviceCapture()` / `sendDeviceCapture()` | Start or manually upload the opt-in `?perfCapture=1` real-device report. Normal play starts this only after the real Start tap; these calls exist for diagnostics. |
| `chunkStages(reset = false)` | With `?debug=1`, return count/total/average/max milliseconds for each v2 chunk stage (`region`, `roads`, `props`, `trees`, `crowd`, `jugs`, `campsites`, `hedges`). Pass `true` to return the current snapshot and zero the stage counters before a controlled drive or teleport. The normal production path does not take the per-stage timestamps. |
| `foodCourtVisual()` | Jump directly to the deterministic food court at Midnight, wait for both chunk generation and registry population to settle while rendered frames continue advancing, then frame the court from inside its outer ring. |
| `foodCourtCapture()` | Park at the same food court, freeze NPC AI, pin the camera and render quality, sample real scene draws/tris, and write `.claude/captures/foodcourt-<tier>-<mode>.json`. Pair the shipping default (`modelMerge=0`) with experimental `?modelMerge=1` for a one-variable before/after. |
| `foodCourtLifecycle()` | Alternate between the same food court and a distant deterministic location for five settled load/unload cycles, then write the GPU-geometry plateau plus exact merged-geometry create/dispose ownership counters to `.claude/captures/`. |

This is the tool for a **slow-onset hang** ("typing in the console gets
impossible, then the page goes unresponsive after a while") — a leak or
unbounded growth, not steady-state cost. Record, play until it degrades, then
read `perfLog()` (or the panel's **copy JSON**). The tell is `geo`, `tex`,
`prog`, or `heapMB` climbing **monotonically** and never coming back down.
The same surface lives in the backtick overlay's **Perf log** section
(Record / copy JSON / clear + an interval picker), plus a one-shot **copy
snapshot** button on the Stats readout. Pairs with `K`-markers — drop a marker
when you trigger an effect so its `ts`/`sessionTime` lines up against the perf
samples.

The complete perf-pass-4 gate is automated behind one local URL. Open this and
leave the tab focused until the in-game toast says the suite is complete:

```text
http://127.0.0.1:8765/?seed=3948869160&perf=low&modelMerge=0&perfGate=suite&perfGateStep=0
```

It reloads through unmerged/merged low, mid, and high draw captures, then runs
high-tier lifecycle controls for both modes. The server writes eight JSON files;
`bin/report-food-court-gate` prints the paired deltas and lifecycle verdict.
The total `renderer.info.memory.geometries` plateau allows one percent of
background renderer variance after two warm-up cycles, while the merge-specific
create/dispose count must be exact. The final URL gains `perfGateDone=1`, a
long-lived completion toast appears, and the camera settles on a Midnight court.
For the final view without rerunning the suite, use
`?seed=3948869160&perf=high&perfGate=visual`.

### Find a shader-program leak

| Call | Does |
|---|---|
| `dumpPrograms({raw?})` | **Read-only** analysis of three.js's live program cache (`renderer.info.programs`). Groups every program by material family (shaderID + token-count, so cacheKey columns align within a family) and, per family, reports which cacheKey token POSITION varies and its sample values. `{raw:true}` also returns every `cacheKey` string for offline diffing. |

When `perfLog()`'s **`prog`** field climbs monotonically, something mints a new
shader program (a distinct material-parameter combo) as you explore and never
releases it — a per-link stall *and* an OOM vector. `dumpPrograms()` names the
proliferating parameter instead of guessing: call it, drive/`gotoHub` across a
few hubs, call it again, and the family whose `programs` count exploded is the
leak host; its top `varying` token (a light count, a `#define`, map presence, a
material's `customProgramCacheKey`) is the cause. **The cacheKey changes on
light-COUNT changes** — toggling `light.visible` (the `contextLights` culler did
this) drops a light from `NUM_*_LIGHTS` and recompiles every material, so a
constant scene light count is the fix. The shipped default (`contextLights` off)
holds flat (~130 programs across 8 hubs, verified); the climb only appears with
the opt-in context lights enabled.

### Reach into the other surfaces
| Property | Is |
|---|---|
| `__dbg.game` | The live object refs (same as `window.__game`). |
| `__dbg.debug` | The interactive overlay API (same as `window.__debug`). |

---

## The three surfaces — why they're separate

They differ along **gating** and **intent**, which is why they aren't merged
into one object — but `__dbg` gives you one access point regardless.

| Surface | Role | Gating | Owner |
|---|---|---|---|
| **`__game`** | **nouns** — live object references | always-on (game code reads it too) | [main.js](src/main.js) |
| **`__debug`** | **interactive** verbs + the backtick overlay | always-on (hidden prod Easter egg) | [debug.js](src/debug.js) |
| **`__dbg`** | **automation** verbs for headless/agent driving | localhost-only | [main.js](src/main.js) |

- **`__game`** is not purely a debug handle — runtime code uses it (e.g.
  [lurleen.js](src/lurleen.js) reads `window.__game?.camera`). Don't remove it.
- **`__debug`** is coupled to the visual debug panel and ships to production
  (players can discover it; we don't advertise it).
- **`__dbg`** does prod-unsafe things (skips the start gesture) and needs main.js
  loop internals (`running`, `controlsLocked`), so it's localhost-only.

**Default to `__dbg` for all automated verification.** Use `__dbg.game` /
`__dbg.debug` to reach the rest.

---

## `__game` — live object references

`window.__game` ([main.js](src/main.js)): `camera`, `zerble`, `scene`,
`renderer`, `crowd`, `registry`, `chaseCam`, `lurleen`, `getTimeOfDay`, `Trip`,
`midi`, `birds`, `bubbles`, `sound`. Read-only introspection from the console /
`preview_eval`, e.g. `window.__dbg.game.zerble.position`.

## `__debug` — interactive overlay API + the backtick panel

`window.__debug` ([debug.js](src/debug.js)) is the human-facing live-debug
toolkit. Press **`` ` ``** (backtick) to toggle the overlay; **`T`** toggles the
trip/psychedelic panel.

Console API: `teleport(x,z)`, `god(bool)` (invincible), `freezeNPCs(bool)`
(pause crowd AI — great for clean screenshots), `showColliders(bool)` (wire-ring
viz over every collider), `pause(bool)` + `step(n)` (single-step the loop),
`dropSmile(n)`, `spawnNPC(n)`, `dropMarker(note?)` + `markers()` (see below).

Overlay hotkeys (only while the panel is open): `P` pause · `.` step · `C`
colliders · `G` god · `F` freeze.

Global hotkeys (work whether or not the overlay is open): `T` trip panel ·
**`K` drop a playtest marker**.

The panel shows live **perf budgets** (draws/tris vs per-tier targets with
`ok`/`!`/`!!` markers), frame-time stats (avg/p95/max), GPU memory, chunk-gen
timing, the session seed, Zerble pos/heading, NPC counts, a **copy snapshot**
button (one-shot machine-readable dump of the live stats), and collapsible
**Teleport** (locate-nearest-landmark + jump), **Render** (adaptive-quality
overrides), **Lights**, **Markers**, and **Perf log** sections.

### Playtest markers (group 7)

When you spot a layout problem mid-drive, **press `K`** to drop a pin at the
cart — `{ seed, x, z, heading, tod, sessionTime, note }` appended to
`localStorage['zerble_markers']`, with a toast. On **touch** (phone playtests of
the live deploy), **triple-tap the bottom-left corner** (a deliberately awkward
gesture so it doesn't fire by accident) — same drop. So feedback arrives as
*teleportable coordinates*, not "somewhere near a stage."

The backtick overlay's **Markers** section lists every pin with an editable
note, a per-marker **`tp`** button (teleports the cart back to that exact
spot + heading + time-of-day — lands within 1 m), a per-marker **`×`** delete,
and **`copy JSON`** (clipboard + a select-all textarea, so a phone with no
keyboard can still get the list off the device) / **`clear`**. The seed in each
record is the numeric session seed; pair it with `?seed=<n>` to reopen the same
world. The key + gesture are deliberately **absent from all player-facing copy**
(Easter-egg rule) — they live here only.

### Perf log recorder

The backtick overlay's **Perf log** section (and `__dbg.recordPerf()` /
`perfLog()` — see [Capture perf data over time](#capture-perf-data-over-time))
samples engine stats into a `localStorage`-backed ring buffer for diagnosing
**slow-onset hangs**: the kind where the page degrades over a minute or two of
play and eventually goes unresponsive (a leak or unbounded growth, not
steady-state cost — for that, read the live budget markers instead).

- **Record / Stop** toggles sampling; an interval picker (`0.5s`/`1s`/`2s`/`5s`)
  sets the cadence. The wall-clock gate means a stalling frame *backs the
  cadence off* rather than over-sampling a frozen frame.
- Each sample — `{ t, ts, fps, fAvg, fP95, fMax, draws, tris, geo, tex, prog,
  quality, qualityLevel, pixelRatio, bloom, bubbles, tripState, tripEnvelope,
  tripProgress, tripPass, starPower, heapMB, npc, reg, col, cgN, cgSlow,
  cgWorst, x, z }` — is written to
  `localStorage['zerble_perflog']` **the instant it's taken**, capped at a
  5000-sample ring. So even if the tab locks up and you have to force-reload,
  reopen the panel and the log is still there to **copy JSON**.
- **What to look for:** `geo`, `tex`, `prog` (live shader-program count), or
  `heapMB` climbing *monotonically* across the run is the leak signature.
  Flat draws/tris with a ballooning `heapMB` points at a JS-object leak;
  climbing `geo`/`tex`/`prog` points at a disposal/recompile leak.
- **copy JSON** / **clear** mirror the Markers controls (clipboard + a
  select-all textarea fallback for clipboard-blocked contexts). Recording runs
  whether or not the panel is open, so you can toggle it on and close the
  overlay while you play.

### Phone/iPad performance capture over the same Wi-Fi

The opt-in device bridge records the real browser, GPU, viewport, adaptive-
quality transitions, world position, and live engine counters on a phone or
tablet, then writes the report straight into this workspace. It is especially
useful for iOS Safari because desktop emulation cannot reproduce its GPU,
thermal limits, memory pressure, audio gesture rules, or background/resume
behavior.

1. Put the Mac and device on the same Wi-Fi, then start the explicit LAN server:

   ```
   python3 .claude/serve_nocache.py 8765 --lan
   ```

2. Open one of the printed tokenized URLs on the device. Prefer the address on
   the Wi-Fi interface, usually `192.168.x.x`; a `172.x.x.x` address may belong
   to a VPN. Allow incoming Python connections if macOS asks. Add
   `&seed=3948869160` for a reproducible world, and add
   `&perf=low|mid|high` only when the test needs a pinned tier.
3. Tap the real Start button. The small top-right control changes from
   **PERF · ARMED** to **● REC · SEND**. Play a representative route and put the
   game into the background and foreground once.
4. Tap **SEND** before leaving. The recorder also uploads every 30 seconds and
   sends a bounded final report on page exit, so a dropped manual tap does not
   usually lose the run.
5. Reports land as ignored `.claude/captures/device-*.json` files, where an
   agent can inspect them without asking you to copy console output.

When reading a report, reconstruct `samples[].quality` transitions first, then
compare adjacent samples for `draws`, `tris`, `geo`, `tex`, `prog`, `cgN`, and
position. Samples also carry the far-field horizon counters (`ffActive`,
`ffCold`, `ffRebuilds`, `ffHandoffs`, `ffOverflow`; `ffActive: null` means the
layer is off) — `ffCold` is the worst indivisible planning step in ms, the
number to check against the 2ms tier gate on real hardware. Trip and star-power state matter because each can add screen-space or
particle work; compare active and inactive samples at similar scene counts. A
timestamp gap over the chosen sample interval usually marks the
intentional background/foreground test; do not mislabel that wall-clock pause as
a gameplay hitch. `fAvg`/`fP95`/`fMax` are reset to zero on the exact sample that
records an adaptive-quality transition because each rung deliberately starts a
fresh observation window. Monotonic `tex` growth while `geo` rises and falls is
the signature of texture ownership leaking across streamed unloads.

The bridge is deliberately local-first. The normal server remains bound to
loopback, `--lan` generates a new write token for that server run, and LAN POSTs
without it receive `403`. The public GitHub Pages game has no capture sink, so
collecting reports from remote players would require a separately designed
hosted collector with privacy, retention, abuse, and consent rules.

---

## The sandbox — isolated entity viewer

[sandbox.html](sandbox.html) is the **primary surface for any model/visual
change**. It renders one entity on a bare plane with a free-orbit camera — no
driving, no procedural festival, no camera wrestling.

```
http://127.0.0.1:8765/sandbox.html?entity=<name>
```

- Deep-linkable `?entity=` — re-open the exact same view across iterations.
- Time-of-day slider + Morning/Noon/Dusk/Midnight presets.
- Audio panel + a per-entity **"Hit it"** SFX button.
- Camera presets `1`–`6`, `R` reset, `L` ground toggle.
- `window.__sandbox` exposes `{ scene, camera, currentEntity, Trip, midi, Sound,
  songStates, fireCheer }`.
- Composite scenes for context (`puppet_lineup`, `campsite_small/medium/large`,
  `leaf_drum_circle_day/night`, `lake_with_beach`, `cheer_demo` — a small NPC
  cluster + a "Fire cheer" button / `__sandbox.fireCheer()` to iterate the
  jump + arms-up cheer pose in isolation).
- **Music panel** drives any stage genre (jam / brass / drum / forest / dance /
  world / dub), an **"End song now"** button (`Sound._debugEndSong()`), a live
  **song-state readout**, and a **trip-sweep** slider (0→1) that drives the MIDI
  + procedural trip warp without the wook flow — verify the reverb swell +
  granular climax there (a real panel-fired trip overrides the slider).

Adding a model? It's not done until it has a sandbox entry — see
[.claude/rules/sandbox-and-testing.md](.claude/rules/sandbox-and-testing.md).

---

## URL flags / runtime overrides

| Flag | Effect |
|---|---|
| `?perf=low\|mid\|high` (or `window.__perfProfile`) | Force a performance tier ([perf.js](src/perf.js)). Test low/mid — high hides regressions that crush integrated GPUs. |
| `?seed=<string\|int>` | Pin the procedural world layout ([main.js](src/main.js)); echoed in the debug HUD so a world is reproducible. |
| `?perfCapture=1&captureToken=<token>` | Arm the local-device performance reporter. Use the complete tokenized URL printed by `serve_nocache.py --lan`; recording begins only after the real Start tap. |
| `?layoutCapture=1` | Localhost-only, data-only world-streaming mode used automatically by `bin/layout-snapshot capture`. It preserves registry updates while skipping pixels; it is not a visual test mode. |
| `?modelMerge=1` | Measurement-only opt-in that reproduces the rejected perf-pass-4 food-truck and Sugar Shack broad merges. The shipping default leaves them off while retaining the older tent merge. |
| `?perfGate=suite&perfGateStep=0` | Run the full local food-court draw and lifecycle capture sequence. Start with the fixed URL above so tier and merge mode also match step 0. |
| `?perfGate=visual` | Jump directly to the settled Midnight food-court framing. Completion adds `perfGateDone=1` to the URL. |
| `?bootDelay=<ms>` | Local-only delay, capped at 10 seconds, before `main.js` is injected. Use it to hold and inspect the static title-card loading state; production ignores it. |
| `?sounddebug=1` | On-screen toast a beat after Start with the iOS audio-unlock state — diagnose mobile audio without Safari Web Inspector. Also enabled by `?debug` or a `zerble.debug` localStorage flag; off by default in production. |

## Audio diagnostics

- `window.__game.sound.diagnostics()` — AudioContext state, gains, each unlock
  stage, sample rate, and `outputRouting` (channel count + audio-output device
  labels with a likely-Bluetooth flag).
- `window.__game.sound.natureDiagnostics()` — bird/cricket/frog/owl gating state.
- `window.__game.sound.songStates()` — live snapshot of every active stage
  **song**: `{genre, songIdx, tempo, keyShift, tonicHz, section, beatInSong,
  totalBeats, phase}`. The way to verify songform structure without listening —
  poll it to watch sections advance, a song end (`phase: 'cheerGap'`), and a new
  song start at a different tonic/tempo.
- `window.__game.sound._debugEndSong()` — force every active stage song into its
  cheer gap *now* (fires the crowd cheer + applause at real stage positions),
  so you don't wait out a full song to verify the cheer.
- `window.__game.sound.setMuted(true)` / `setNatureVolume(v)` — runtime audio
  controls (also persisted; surfaced as backtick-overlay sliders/checkbox).

---

## Why `__dbg` exists (the footguns)

The running game actively resists automation. `__dbg` exists to route around
each of these:

1. **The title card won't dismiss via synthetic clicks** — iOS audio gating
   wants a trusted gesture. → `__dbg.start()` boots directly.
2. **The chase cam overrides any camera you set** every frame. → `__dbg.camLock()`
   pins a pose the chase loop honors.
3. **Driving `zerble.update(dt, stubInput, n)` with a hand-rolled input corrupts
   physics** (stub input → `NaN` position). → use the real loop; nudge state via
   `__dbg.teleport` / `setJuice` / etc. instead.
4. **Background tabs**: the loop falls back to `setTimeout(16ms)` when
   `document.hidden` (the preview MCP keeps the tab hidden), so the world keeps
   ticking — but `renderer.info.render.calls` can read a bogus `1`; trust
   screenshots over that counter.

## The canonical verification loop

```
1. preview_start (or reuse) on http://127.0.0.1:8765/
2. preview_eval:  window.__dbg.start()
3. preview_eval:  window.__dbg.fillSeats()        // or teleport/tod/setJuice as needed
4. preview_eval:  window.__dbg.camLock(px,py,pz, tx,ty,tz)
5. preview_screenshot                              // ground truth
6. preview_console_logs (level: error)             // no TypeError/shader fail?
7. preview_eval:  window.__dbg.camUnlock()         // when done
```

For model/visual work, prefer the **sandbox** loop (edit → screenshot
`?entity=foo` → repeat). For emergent/world/crowd/collision behavior — anything
the sandbox doesn't exercise — drive the **main game** with `__dbg`. Always boot
the main game before declaring done; sandbox-pass + game-crash has happened.

Two small effect entries avoid full-game driving for this polish pass:

- `sandbox.html?entity=boost_streaks&perf=high` drives Zerble right-to-left while the fixed eight-slot pool leaves cart-sized golden wake rings in world space behind him, on the open side of the canvas. The rings should separate clearly from the Bubble Juice Machine; the same page exposes the synthesized empty-juice sputter in the Audio panel.
- `sandbox.html?entity=crowd_photographer&perf=high` runs one forced photographer through the real Crowd matrices. **Take picture** triggers the production timing, while **Hold flash for inspection** extends only the debug preview so the opaque mesh flash can be checked at Noon and Midnight.

The frisbee arm rig has three focused views plus the integrated toss:

- `sandbox.html?entity=frisbee_player` holds the ordinary both-arms-down pose.
- `sandbox.html?entity=frisbee_player_catch` holds the one-arm catch reach.
- `sandbox.html?entity=frisbee_player_throw` loops the bent-elbow windup and straight release.
- `sandbox.html?entity=frisbee_pair` runs the full toss, chase, catch, and pickup sequence, with both players biased into the open canvas and the disc attached to the animated hand until release.

### When no browser here can do WebGL at all — `bin/verify-headless`

On some headless Linux boxes/VMs (virtio-gpu + Wayland, no real GPU driver)
**every** normal surface fails to create a WebGL context, which kills the whole
loop above before step 2: `main.js` throws at renderer construction, so
`window.__dbg` never installs. The failure signatures, so you recognize it in
minutes instead of an hour:

- Preview/Browser pane console: `THREE.WebGLRenderer: A WebGL context could not
  be created … ErrorMessage = BindToCurrentSequence failed` (ANGLE over
  llvmpipe), then `Uncaught Error: Error creating WebGL context` from main.js.
- A bare `canvas.getContext('webgl2') || canvas.getContext('webgl')` probe
  returns **null** in that pane.
- Snap Firefox headless: `RenderCompositorSWGL failed mapping default
  framebuffer, no dt`, then hangs (and, being a snap, it can't write
  screenshots outside `$HOME` anyway).

Installing a different browser does **not** fix this — the machine has no GL
path to give. The fix is software rasterization: headless Chromium forced onto
**SwiftShader**, which is exactly what `bin/verify-headless` drives. It loads a
URL, optionally runs a JS snippet (that's how `__dbg.start()` gets called),
waits, screenshots via raw CDP (`page.screenshot()`'s 30s stability wait times
out under SwiftShader), reports console errors, and exits nonzero on any. The
Playwright + Chromium runtime installs **outside the repo** (one-time setup is
printed by the script if missing; default `~/.zerble-verify`, override with
`ZERBLE_VERIFY_ROOT`) so `bin/` stays dependency-free and the no-build stance
holds.

```
bin/verify-headless --url "http://127.0.0.1:8765/?perf=low" \
    --eval "window.__dbg.start()" --wait 9000 --shot /tmp/boot.png
```

SwiftShader is slow — budget generous `--wait`s, prefer `?perf=low` when the
tier doesn't matter, and know that a high-tier bloom frame can take >30s to
settle. Data-only layout captures should still go through `bin/layout-snapshot`
(it skips pixel rendering entirely — see below); this tool is for the cases
that need actual pixels, console output, or `__dbg` driving.

---

## Layout snapshots — capturing built truth

A **layout snapshot** is the registry, captured as data, normalized so two
captures are byte-comparable. It's the gate the worldgen hoist + the future
grammar rewrite are measured against: "did the *built* world change?" (The
determinism *goldens* — `selftest.js` hashes — cover the *plan*, not the build.
Two different things; keep the words apart. A snapshot is **not** a golden.)

Built truth lives in the **browser** (the registry is populated by `chunks.js`
running in a live scene — there is no headless *node* path). The dev server must
be running on `:8765` either way.

### The one-command path (default)

`bin/layout-snapshot capture <seed>` drives a headless browser via the globally
installed **`agent-browser`** CLI — boot → `__dbg.start()` → settle (poll the
registry count until stable) → dump → normalize → write, in one command:

```
bin/layout-snapshot capture 1234 --bounds 163,-186,403,54 --window spawn
# → verification/snapshots/1234.json   (omit --bounds for the whole world)
```

The twice-capture self-diff control is then just two runs + a diff:

```
bin/layout-snapshot capture 1234 verification/snapshots/1234.a.json --bounds 163,-186,403,54
bin/layout-snapshot capture 1234 verification/snapshots/1234.b.json --bounds 163,-186,403,54
bin/layout-snapshot --diff verification/snapshots/1234.a.json verification/snapshots/1234.b.json   # MUST be EMPTY
```

### Why the one-command path now survives software WebGL

On a headless-only machine Chromium uses SwiftShader, and the full festival at
`perf=high` can consume every available CPU core before browser-control commands
get a turn. The capture command therefore opens a localhost-only
`?layoutCapture=1` mode. The ordinary update, chunk-streaming, registry, and
draw-count-canary paths still run on a yielding timer, but the composer skips
pixel rendering because pixels are not part of a layout snapshot.

The driver also owns one unique named browser session, uses a 320×180 viewport,
honors `--tier`, settles on the bounds-clipped registry count, and gives every
browser command a hard deadline. Its unconditional cleanup closes the named
session and compares exact automation PIDs against the pre-launch baseline. If
anything created by that invocation survives, it is terminated and the command
returns a cleanup failure instead of leaving a laptop-burning process behind.

Use `--command-timeout <ms>` to adjust the default 12-second command deadline
and `--settle-ms <ms>` to adjust the minimum five-second settle window. A
successful snapshot proves data determinism only; use the sandbox or full game
for pixels, draw/tris counters, lighting, and visual quality. If the installed
browser CLI is absent or genuinely broken, use the manual recipe below.

### The manual recipe (approved fallback if agent-browser is flaky/absent)

`bin/layout-snapshot --recipe <seed>` (or `--seeds` for the multi-seed playbook)
prints the preview-MCP copy-paste version: boot `?worldgen=1&seed=<S>&perf=high`,
`__dbg.start()`, settle (read `window.__dbg.dumpRegistry().length` until stable —
NO driving), then
`({entries: __dbg.dumpRegistry(B), drawCounts: __dbg.dumpDrawCounts(B)})`, save
to `verification/raw/<seed>.json`, and `bin/layout-snapshot <seed>` to normalize.

### What normalize guarantees

Either path, `bin/layout-snapshot` **drops the two moving kinds** (`lurleen`,
`hula_hoop`) — they're actors, not layout, and would make a self-diff differ
forever. It rounds coords to `1e-4` and sorts by `kind+x+z` so identical builds
serialize identically. Capture defaults to `perf=high` and records the selected
`--tier` because built truth is tier-dependent today (crowd draws from the
cluster rng stream). `--diff` exits
`0` (`EMPTY`) when layouts match, `1` with a per-kind report otherwise, and flags
per-cluster draw-count (canary) drift even when every position still matches.

## Layout linter — checking arrangement against rules

A **layout snapshot** captures *what* the world built; the **linter**
(`src/worldgen/lint.js`, run via `bin/lint`) checks whether that arrangement is
*good* — nothing clipping, dancefloors clear, booths off the road, stages spaced.
It's the detector that used to be "Gary driving around noticing things." Two
modes (design D-D — **registry is the authority**):

| Mode | Over what | Needs | Precision |
|---|---|---|---|
| **plan** | the worldgen PLAN's analytic cluster extents | nothing — pure node | approximate (cluster-center circles) |
| **registry** | EXACT built sub-component positions in a snapshot | a `bin/layout-snapshot` file | exact |

```
bin/lint --seeds 10                                  # plan-mode sweep, 10 seeds, headless
bin/lint --seed-list 1234,0xf7ef2a3c --bounds -1000,-1000,1000,1000
bin/lint verification/snapshots/0xf7ef2a3c.spawn.json # registry mode (PRIMARY) — no game needed
bin/lint <snap.json> --json                          # raw violations payload
```

Exit code: `0` clean, `2` if any **error**-severity rule fired (CI-friendly).
Every violation carries the full **eyes pipeline** — a 2D `map-sandbox` link, a
3D `hub-sandbox` link (`?at=x,z`; the viewer lands in group 6, the link is
forward-compatible today), and a paste-ready `__dbg.teleport(x,z)` snippet — so a
finding is one click from a look in any surface.

**The link seed is decimal, on purpose.** Both `main.js` and `map-sandbox.html`
resolve `?seed=` as `/^-?\d+$/.test(raw) ? Number(raw) : FNV(raw)`. A decimal
string round-trips to the exact same `SESSION_SEED`; a `0x…` hex string would
fall to the FNV path and open a *different* world. So links emit the decimal
session seed even though findings *display* the `0x…` form.

Rules (registry mode): `overlap` (exact collider interpenetration > 0.5 m, minus
an allowed-pairs table of same-cluster adjacencies — stage-deck tiles, the
arch's segments, a drum circle's firepit-in-bench-ring), `water-clear`,
`dancefloor-clear`, `booth-on-road`, `potty-attached`, `truck-off-road`,
`drum-in-trees` (the LEAF drum circle must sit in a treed pocket and not inside
another cluster's envelope — Gary saw one inside a food-truck circle), and
`arch-placement` (the spawn arch must be over a road, outside dancefloors, and
≥ `ARCH_MIN_STAGE_DIST` from the stage). Scenery (`forest_tree`, `lake_edge`,
`shore`, `path_node`, `lamppost`) is excluded so the report is festival clutter,
not 1000-tree forest density. Plan mode adds the cross-hub `stage-spacing` and
`spawn-arrival` rules, plus an approximate `drum-in-trees` (density-field proxy).
The `drum-in-trees` / `arch-placement` thresholds (`DRUM_TREE_RADIUS`,
`DRUM_TREE_MIN`, `DRUM_TREE_MIN_DENSITY`, `ARCH_MIN_STAGE_DIST`) are tunable in
`FESTIVAL_TUNING`.

**This change RECORDS the baseline; it does not fix violations** — the layout fix
is the follow-up `festival-zone-grammar` change. A firing rule here is the
instrument working, not a bug to chase (the only fixable thing in *this* change
is a false-positive rule).

`__dbg.gotoHub(n)` prints the plan-mode violations for the hub it teleports to,
so touring hubs surfaces their findings inline.
