# DEBUGGING.md — the agent iteration & debugging surface

This is the toolkit for **verifying and iterating fast** — built so an agent (or
Gary) can drive, inspect, and screenshot the running game in seconds instead of
booting it and chasing the camera around by hand. Read this before any
model/visual/gameplay change you intend to verify.

If you only remember one thing: **`window.__dbg` is the one door.** Open the
browser console and call `window.__dbg.help()`.

## Quick start

Run these from the repository root:

```sh
npm ci
npm run dev
# In another terminal, for code changes:
npm run check
npm run build
# Stop dev before serving the production build on the same port:
npm run preview
```

Reuse an existing server when possible. Open `http://127.0.0.1:8765/?mute=1`,
click a ready mode plank, and use `__dbg.help()` in the browser console.
Choose the smallest relevant surface: entity sandbox for a model, hub viewer
for a built festival cluster, map sandbox for pure layout, or the full game
for streaming and integration. All browser URLs used by agents need `mute=1`.

- [Game controls and inspection](#the-one-door-window__dbg-local-dev-only)
- [Entity sandbox](#the-sandbox--isolated-entity-viewer)
- [URL flags](#url-flags--runtime-overrides)
- [Verification loop](#the-canonical-verification-loop)
- [Performance playbook](docs/performance-playtests.md)
- [Layout verification](docs/layout-verification.md)
- [Browser cleanup and software WebGL](docs/browser-verification.md)

For build/deployment details, see [the toolchain guide](docs/toolchain.md).
Game JavaScript edits trigger a full reload; CSS uses Vite updates. The capture
endpoint is available in both development and production preview.

## Desktop and phone performance playtests

Use the [performance playbook](docs/performance-playtests.md) for guided phone
and desktop captures, quality-governor comparisons, first-use shader probes,
and registry benchmarks. Measurements and their limits belong in dated
[verification reports](verification/README.md), while pending acceptance stays
in [ROADMAP.md](ROADMAP.md).

## Festival Passport preview

Open `http://127.0.0.1:8765/passport-preview.html?case=populated&mute=1` on the loopback Vite server. Fixtures `empty`, `populated`, `migrated`, `long` and `blocked` use the production menu with memory-only progress, without GA or WebGL. This preview is intentionally outside the LAN page allowlist. Test the live title and book buttons or `P` for integration; `__dbg.passport()` reads the live snapshot and `__dbg.passport(true)` opens it. A passport pauses gameplay, including Festival Run resource/timer changes, while preserving rendering.

`node bin/test-player-stats` and `node bin/test-passport-integration` exercise travel/return, relocation, stage identity, migration, persistence, settings continuity, analytics privacy/checkpoints, real bubble births, and input release. Both are included in `npm run check`. [Contracts and analytics fields](docs/passport.md).

## Festival map workshop

Open `/festival-map-preview.html?mute=1` for the production discovery/storage/worker/view without WebGL. **Check storage** exercises real IndexedDB concurrent unions, seed isolation, reset epochs, and stale-write rejection in an isolated temporary database; **Check input** exercises the actual touch stick, expansion/zoom/close preservation, music action separation, and Space isolation. **Check transitions** samples live animated viewport/backing agreement, rapid reversals, circular focus, border removal, and expanded opacity. **Drive / stop**, **Relocate**, and **Track unexplored stage** expose live reveal, teleport discontinuities and the objective fog exception. Diagnostics report rolling map main-thread time, raster/worker cost, payload bytes, caches, dirty blocks and backing pixels.

Use `&viewport=portrait` or `&viewport=landscape` for 390×844 and 844×390 touch layout frames. These validate layout in the desktop browser, not real-device input or performance. `node bin/test-festival-map` runs pure/persistence/worker/live-marker regressions and is included in `npm run check`. The real game's `__dbg.festivalMap()` returns diagnostics. Browser tests must still start through a ready mode plank. [Evidence and limits](verification/festival-map/README.md).

## Terrain driving proof

Open `http://127.0.0.1:8765/terrain-sandbox.html?mute=1` on the existing
Vite server, or follow **Drive the terrain course** in the entity sandbox.
WASD/arrows drive, Space brakes, Shift boosts, and R resets the selected stretch.
On-screen buttons also support touch; Boost ↑ combines forward throttle and boost.
Enable engine sound starts the existing game engine audio inside that tap. The section picker jumps directly to the
ascent, crest, descent, sideways slope or plateau; Chase, High and Orbit views,
Noon/Midnight and wireframe help inspect contact. **Run repeatable drive** follows
28 seconds of fixed simulation input and parks on the plateau. **Check wheel
contacts** compares the sampler against 96 raycasts into the actual meshes.

`node bin/test-terrain` covers the pure surface and movement contracts and is
included in `npm run check`. This course is an isolated authored fixture, not
procedural festival terrain. [Results and limitations](verification/terrain/2026-10-24-driving-proof.md).

## Flow hoop choreography workshop

Open `/sandbox.html?entity=flow_hooper_workshop&mute=1` for actual Crowd-owned
classic and flow participants. Seed, Lyrical/Playful/Aerial profile, one/two
hoops, scale and heading controls rebuild the same production activity. Mode
offers Waist hooping, Choreographed flow and Partner exchange. Waist mode uses
the same expressive arms, planted knees/feet and head animation contract. These fixtures
own their people, venue and props, so replay/seek never rewinds the live game.

The Planted step, Waist groove, Moving isolation, Toss flight and Chest roll buttons rebuild
a compatible solo fixture and pause inside that phase. The support label identifies
which foot is planted, while exported diagnostics include plant IDs, root height
and whether contacts use an inertial frame. Chest roll selects the lyrical single-hoop
variant, switching to seed 2 if the current seed chooses the short forearm roll.
The hoop-support label distinguishes hand, arm, chest and waist contact. Aerial diagnostics show the seeded
toss rise and flight duration; Toss flight also frames the full arc. Change Seed
and replay to compare throws, or Resume to watch the catch.

Pause, single-frame/one-second accepted steps and the score slider expose held isolations and contact transfers;
contact markers compare shader-equivalent hand positions with the ring under
the actual published person matrix. The displayed contact error covers declared
hand contacts, not airborne or body-supported intervals. Honk, remove venue,
remove person and dispose/recreate exercise normal claims and resource cleanup.
Partner interruption cancels both sides, and Replay creates a fresh exchange.

Normal-distance view checks whether a motif reads from the game camera's usual
scale. Save scene PNG captures the current canvas, while Save diagnostics JSON
records score/replay, camera, lighting and counters. The Classic baseline uses
the same participant count/positions/appearance for cost comparisons. The
sandbox deliberately retains Standard materials on Low; verify the actual
Lambert material path in the full Low game too. The debug Stats hoop line shows
classic/flow/pair counts, visible props and the actual material type. On localhost,
`&hoopFlow=0` keeps the live activity entirely classic for a matched baseline;
the flag is ignored on public hosts and does not change saved settings.

`node bin/test-hoop-score`, `node bin/test-hoop-flow-session`,
`node bin/test-hoop-pair`, `node bin/test-hoop-legs`, `node bin/test-hoop-classic`, `node bin/test-hoop-chest-roll`
and `node bin/test-hoop-workshop` are included in
`npm run check`. See [hoop verification](verification/hoops/README.md) for evidence
and remaining device limitations.

## Silent agent launches

Use `?mute=1` (or append `&mute=1`) on every agent-driven game or sandbox URL unless intentionally checking audio. It initializes the session-only output gate before AudioContext output connects, preserves saved volume levels, and remains effective across reloads. `Sound.setMuted(false)` can explicitly unmute for an audio test; restore mute afterward.

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
before boot (or pick Festival Run on the card), then `start()`. The four
mutating drills (`runDay`/`vibe`/`strike`/`sputterLeft`) answer "no active
Festival Run" in Cruisin' instead of silently doing nothing; `runInfo()` reads
fine in either mode, and the two board drills below don't need a run at all.

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

The stakes regression battery is repo-resident: **`bin/drill-stakes`** (same
Playwright-under-`~/.zerble-verify` harness as `bin/verify-headless`; dev server
on :8765 required) runs the cross-mode-resume invariance drill — the seam both
review-001 P0s lived in — plus the Cruisin' HUD-geometry assert and the two
death paths.

### Global leaderboard without wrangler

On localhost, `__dbg.leaderboardInfo()` returns the last 100 local events across
reloads, including the selected mode at Start, run-token acquisition, score
requests, HTTP status/rejection reason, local-save results, and board reads.
The player-facing Settings and score screen no longer show diagnostics. The
history records future play, not sessions from before the feature was installed.
Just Cruisin' records its mode but sends no score requests.

The report contains no player names, run IDs, signatures, or request bodies and
is not uploaded automatically. Storage-blocked browsers retain it in memory only.
A beacon marked
`queued_unacknowledged` is not proof of delivery; `acknowledged_unverified` means
the Worker has not supplied the new diagnostic headers. `boards_written` means
both KV board writes completed, not a transactional or permanent-retention guarantee.
The Worker README documents structured Cloudflare logs and matching request IDs;
the Worker must be redeployed separately for those outcomes to appear.

`npm run test:board` exercises Worker and client diagnostics offline, including
storage failures, rejected submissions, timeouts, privacy, and retained history.

The Worker (`workers/leaderboard/worker.js`) is plain Request→Response, so it
runs anywhere node does — no wrangler, no deploy, no network:

- `bin/test-leaderboard-worker` — the no-browser gate (mock KV): protocol e2e,
  sig binding, the plausibility-ceiling worked example, sanitation, quarantine,
  admin delete. Part of `npm run check`.
- `node workers/leaderboard/dev-server.mjs 8787` — a localhost HTTP bridge
  around the same handler (in-memory KV, lives for the process). Point the
  real game at it with `localStorage['zerble-board-url'] =
  'http://127.0.0.1:8787'` — the override is **localhost-gated** (production
  origins ignore it) and is read **once at module load**, so set it before the
  page loads (init script) or reload after setting it. Same knob works against
  a real `wrangler dev` later.

### Camera for close-up screenshots
| Call | Does |
|---|---|
| `camLock(px,py,pz, tx,ty,tz)` | Pin the camera to a fixed world pose (position → look target). **Overrides the chase cam** every frame so it can't drag back. `tx,ty,tz` default to `(0, 1.8, 0)`. |
| `topDown(x?, z?, span)` | Pin a straight-down plan view centered on `(x, z)` (default: the cart), framing a `span`-metre square (default 240). Height solves `span = 2·H·tan(fov/2)`. North-up (the nadir gimbal singularity is handled in camera.js). `camUnlock()` restores Y-up. |
| `camUnlock()` | Release back to the normal chase cam (restores Y-up). |

### Tour + inspect hubs
| Call | Does |
|---|---|
| `gotoHub(n)` | Teleport to the `n`th-nearest festival hub and `camLock` a canonical 3/4 view of its stage front. `n` is ranked from the **spawn hub** (the major the game relocates to), so `gotoHub(0)` is the spawn hub itself. Prints the planned `hub-sandbox.html?seed=…&at=x,z&mute=1` URL so the same hub re-opens in the group-6 viewer. |
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

### Drive the trip (psychedelic post-process)
The trip is a three-minute scripted timeline, so looking at any single moment
of it used to mean parking next to a wook, accepting, and waiting. The scrub
control removes that: it pins the trip at any point on its timeline and holds
it there, which is the difference between iterating on a per-effect curve in
seconds and in minutes.

| Call | Does |
|---|---|
| `tripScrub(p)` | Hold the trip at progress `p` (0..1 across the whole `fadeIn + duration + fadeOut`). Forces Dynamic mode, pins the master envelope open, and bypasses the state machine, so nothing advances and no narration toast fires while held. `Trip.state` reads `'scrub'` and the perf samples record it, so a held window is never mistaken for an organic trip. |
| `tripScrub()` | Release the hold and return the trip to `idle` (pass disabled). |
| `tripAB(opts?)` | Scripted, **labelled** perf A/B for the trip pass. Walks the recorder through `warmup → baseline → fade-in → active → peak → after`, holding the cart still and changing nothing else, then prints the per-phase table. Opts: `{baselineS, fadeS, activeS, peakS, afterS}`. |

**Tuning an effect while the trip runs.** Dynamic mode's scripted curves own
every effect uniform, so dragging an effect slider used to do nothing. Touching
one now takes that effect off its curve and puts it under the slider — the label
reads `(manual)` — while everything else keeps animating. **RELEASE TO CURVES**
(or any preset button) hands them all back. A slider labelled `(low: off)` is
held at 0 by the tier contract and will not render on this tier no matter where
you drag it; use `__dbg.tripMask(false)` to lift that for measurement.

The same scrub lives in the **T menu** as a slider plus `Early` / `Peak` /
`Late` / `Release` jump buttons; `Peak` reads `PEAK_CENTER` from `trip.js`, the
one constant that also centres the MIDI player's audio crescendo, so picture and
sound always climax together.

**Why the labelling matters.** The trip is a post-process pass, and
`InfoCapturePass` records draws/tris *earlier* in the composer chain
([main.js](src/main.js)) — so the backtick HUD's draw/tri budgets structurally
**cannot see the trip**. Frame time is the only column that responds to it.
That makes it essential to know exactly which samples were taken with the pass
hot, which is what `perfPhase` / `tripAB` provide.

### Capture perf data over time
| Call | Does |
|---|---|
| `recordPerf(on = true)` | Start (or stop) the **perf-log recorder**: samples engine stats — `fps`, frame `avg`/`p95`/`max` ms, `draws`, `tris`, `geo`/`tex`, **`prog`** (live shader-program count), adaptive `quality`/`qualityLevel`, pixel ratio, bloom/bubble state, Trip state/envelope/progress/pass, star power, `heapMB`, `npc`/`reg`/`col` counts, chunk-gen `cgN`/`cgSlow`/`cgWorst`, and `x,z` — into a ring buffer at a fixed wall-clock interval (default 1 s). Each sample is persisted to `localStorage['zerble_perflog']` **as it's taken**, so the data survives the page going unresponsive + a force-reload. |
| `perfLog()` | Return a copy of the recorded sample array (`[{t, ts, …}]`). |
| `perfPhase(label)` | Stamp a window label onto every subsequent sample (`''` clears it). `tripAB()` drives this automatically; set it by hand for any other one-variable comparison. |
| `perfPhaseSummary()` | Collapse the recorded samples to one row per label — `fps`, `fAvg`, `fP95`, `fMax`, `draws`, `tripPass` — and print the table. Frame-time columns are averaged over **populated samples only**: `AdaptiveQuality` publishes no frame stats until its 90-frame window fills, so early samples carry a frame time of 0, and averaging those in would make the earliest window (usually the baseline) look *faster* than it was. The `warmup` column counts how many were skipped — if it approaches `n`, that row is warm-up noise and the window needs to be longer. |
| `startDeviceCapture()` / `sendDeviceCapture()` | Start or manually upload the opt-in `?perfCapture=1` real-device report. Normal play starts this only after a real mode-plank tap; these calls exist for diagnostics. |
| `chunkStages(reset = false)` | With `?debug=1` or `?perfCapture=1`, return count/total/average/max milliseconds for each v2 chunk stage (`region`, `roads`, `props`, `woodland`, `trees`, `crowd`, `jugs`, `campsites`, `hedges`). Pass `true` to return the current snapshot and zero the stage counters before a controlled drive or teleport. The normal production path does not take the per-stage timestamps. |
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
browser evaluation, e.g. `window.__dbg.game.zerble.position`.

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

Use the [guided desktop and phone performance playtests](#desktop-and-phone-performance-playtests)
for a comparable drive or Trip capture. The lower-level
`python3 .claude/serve_nocache.py 8765 --lan` command remains available for an
unstructured session. It prints a tokenized URL with `?perfCapture=1`; tap the
ready mode plank, play until the symptom appears, then tap **SEND**. The
recorder also uploads every 30 seconds and sends a bounded report on page exit.
Only the guided scenarios auto-complete.

When reading a report, reconstruct `samples[].quality` transitions first, then
compare adjacent samples for `draws`, `tris`, `geo`, `tex`, `prog`, `cgN`, and
position. Compare `canvasW/H` with `targetW/H` after quality transitions;
`bloomW/H` should be about half their dimensions, while `bubbleActive` explains
when detailed-bubble transmission work was possible. Samples also carry the far-field horizon counters (`ffActive`,
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

## Physical furniture playground

Open `/physical-sandbox.html?mute=1&perf=low&fixture=chair&seed=1977` on the Vite server. Choose a chair style and encounter, then use Run encounter, reset, slow motion or single step. Collision shapes, model bounds and seat anchors help inspect the provisional recipes. Inputs, contacts, and limits contains the copied report and Dispose scene control. Repeat Noon/Midnight and Low/Mid when changing presentation.

This is an engine proof using the real Zerble controller, a conservative kinematic contact hull and either fixture ground or the exact production-terrain triangle surface. Cart ghost mode can change during an encounter; ending it inside a prop waits for clearance before restoring contacts. The report exposes ghost state and pending clearance. It does not exercise production occupants, streaming ownership or the main game contact barrier, and disabling physics shows a static reference rather than legacy collisions. See [evidence and limitations](verification/physical-festival/README.md). Run `npm run test:physics` for actual Rapier lifecycle/contact and fixed-clock tests.

## The sandbox — isolated entity viewer

[sandbox.html](sandbox.html) is the **primary surface for any model/visual
change**. It renders one entity on a bare plane with a free-orbit camera — no
driving, no procedural festival, no camera wrestling.

```
http://127.0.0.1:8765/sandbox.html?entity=&mute=1<name>
```

- Deep-linkable `?entity=` — re-open the exact same view across iterations.
- Time-of-day slider + Morning/Noon/Dusk/Midnight presets.
- Audio panel + a per-entity **"Hit it"** SFX button.
- Camera presets `1`–`6`, `R` reset, `L` ground toggle.
- `window.__sandbox` exposes `{ scene, camera, currentEntity, Trip, midi, Sound,
  songStates, fireCheer }`.
- Composite scenes for context (`puppet_lineup`, `campsite_small/medium/large`, `campsite_activity`,
  `leaf_drum_circle_day/night`, `lake_with_beach`, `cheer_demo` — a small NPC
  cluster + a "Fire cheer" button / `__sandbox.fireCheer()` to iterate the
  jump + arms-up cheer pose in isolation).
- **Puppet parade iteration** uses the production `PuppetParade` controller in
  `?entity=puppet_parade`; its preview-only option fixes the route at the origin
  and disables recycling; the camera follows the middle of the procession.
  `?entity=puppet` is the seeded heron (`seed=1`) with close/game-distance
  camera buttons, a pause checkbox, and a gait-cycle scrubber. Named entries are
  `puppet_heron`, `puppet_dragon`, `puppet_seahorse`, `puppet_jellyfish`,
  `puppet_moon`, and `puppet_star`. `?entity=puppet_lineup` shows all six units
  plus a 1.9 m comparison human under one owned scene root.
  `__sandbox` exposes `loadEntity`, `entityRoot`, `renderer`, and `tod` for
  repeatable checks. Run `ZERBLE_BROWSER_SESSION=<owned-session> npm run test:puppets`
  on an existing sandbox browser to test real geometry, support endpoints, and
  the production controller without launching another browser. Saved evidence
  and capture scripts live in [verification/puppet-parade/](verification/puppet-parade/README.md).
  Press `H` to hide/show the panel, `2`/`4` for side
  views, and `6` for the rear three-quarter view; the heron opens from a
  forward three-quarter camera so its beak is visible. Midnight is `t=0.75`,
  Noon is `t=0.30`.
- **Lurleen photo comparison:** `?entity=lurleen&view=still&mute=1` holds her wander target, while `?entity=lurleen_zerble&view=still&mute=1` also aligns both carts for a front-to-front scale comparison. Eye motion, twinkle lights, disco and bubbles keep updating. [Model and game checks](verification/lurleen/README.md) cover low/high tiers and Noon/Midnight.
- **Nut Wagon model preview:** `?entity=nut_wagon` opens the doorless wagon with its hatch raised; `?entity=nut_wagon_closed` checks the shut hatch and hidden supports. The model exposes `userData.hatch`, four `userData.wheels`, and nine independent provisional `userData.riderMounts`. Its pooled light strings follow the sandbox day/night cycle through `setNutWagonNightness`. The separate nut_wagon_cruise preview exercises its driving, boarding, riders and music controller. Open `verification/nut-wagon/check.html?perf=low` or `?perf=mid` on the same server for real-Three geometry, pooling, transform-isolation, bounds, and shader checks. [Saved views and results](verification/nut-wagon/README.md).
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
| `?x=<number>&z=<number>&heading=<radians>&tod=<0..1>` | Preload a fresh game at a reported location; both coordinates are required and bounded to ±10 million. Heading/time are optional. Settings Apply & restart retains its saved session precedence. |
| `?seed=<string\|int>` | Pin the procedural world layout ([main.js](src/main.js)); echoed in the debug HUD so a world is reproducible. |
| `?perfCapture=1&captureToken=<token>` | Arm the local-device performance reporter. Use the complete tokenized URL printed by `serve_nocache.py --lan`; recording begins only after a real mode-plank tap. |
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

1. Reuse a development server or start the no-cache server from the quick start.
2. Open `http://127.0.0.1:8765/?mute=1` and confirm the title card loads without errors.
3. Click a ready mode plank to verify the real start path. For a scripted scenario,
   `__dbg.start()` bypasses the gesture, so it does not prove iOS audio unlock.
4. Use `__dbg.fillSeats()`, `teleport()`, `tod()` and `camLock()` as the scenario needs.
5. Inspect the screenshot and browser console, then check the relevant counters.
6. Call `__dbg.camUnlock()`, close test tabs and stop any server you started.

Run `npm run check` for code changes, alongside the relevant browser checks.
Documentation-only edits need link and command validation, not a game boot.
For visual changes, capture Noon and Midnight; test Low when touching materials,
shaders or boot order. See [browser cleanup](docs/browser-verification.md) before
using standalone automation.

For model/visual work, prefer the **sandbox** loop (edit → screenshot
`?entity=foo` → repeat). For emergent/world/crowd/collision behavior — anything
the sandbox doesn't exercise — drive the **main game** with `__dbg`. Boot the main game for runtime changes; sandbox-pass + game-crash has happened.

Two focused effect previews avoid full-game driving:

- `sandbox.html?entity=boost_streaks&perf=high&mute=1` drives Zerble right-to-left while the fixed eight-slot pool leaves cart-sized golden wake rings in world space behind him, on the open side of the canvas. The rings should separate clearly from the Bubble Juice Machine; the same page exposes the synthesized empty-juice sputter in the Audio panel.
- `sandbox.html?entity=crowd_photographer&perf=high&mute=1` runs one forced photographer through the real Crowd matrices. **Take picture** triggers the production timing, while **Hold flash for inspection** extends only the debug preview so the opaque mesh flash can be checked at Noon and Midnight.

The frisbee arm rig has three focused views plus the integrated toss:

- `sandbox.html?entity=frisbee_player&mute=1` holds the ordinary both-arms-down pose.
- `sandbox.html?entity=frisbee_player_catch&mute=1` holds the one-arm catch reach.
- `sandbox.html?entity=frisbee_player_throw&mute=1` loops the bent-elbow windup and straight release.
- `sandbox.html?entity=frisbee_pair&mute=1` runs the full toss, chase, catch, and pickup sequence, with both players biased into the open canvas and the disc attached to the animated hand until release.

### When no browser here can do WebGL at all — `bin/verify-headless`

See [browser verification and cleanup](docs/browser-verification.md) for the
software WebGL fallback, process ownership, and local restrictions. Software
rendering can verify pixels and errors; it cannot measure device performance.

## Layout snapshots — capturing built truth

See [layout verification](docs/layout-verification.md#layout-snapshots--capturing-built-truth)
for registry capture, normalization, self-diffs, and the manual capture recipe.
Local browser safety restrictions apply before using automated capture.

## Layout linter — checking arrangement against rules

See the [layout linter reference](docs/layout-verification.md#layout-linter--checking-arrangement-against-rules)
for plan and built-registry modes, rules, and interpretation.

## Nut Wagon iteration

`/sandbox.html?entity=nut_wagon_cruise&mute=1` previews driving, stopping and regular NPC boarding on an empty corridor, with a following orbit camera. The original `nut_wagon` and `nut_wagon_closed` cases retain the reference-sized model.

On localhost, `/?seed=1234&nutwagon=1&mute=1` forces the nearest clear road encounter, follows it with the debug camera and displays occupancy/state/speed. Start with the regular title button. This skips only the random/off-camera encounter gate, never the road-clearance gate. `__dbg.nutWagon()` reports state and tuning; `__dbg.summonNutWagon()` tries a nearby clear road. Ordinary player launches have no preview overlay or camera override. The feature uses the default worldgen-v2 roads; legacy-layout previews do not schedule it.

Run `node bin/test-nut-wagon` for route math and `/verification/nut-wagon/system.html?perf=low&mute=1` for the real Three/Crowd controller checks, including boarding, movement, music position, and lifecycle cleanup.

Monk previews (always append mute=1): sandbox.html?entity=monk&mute=1 for the model, entity=monk_party for loose wandering, and entity=nut_wagon_monks for six-person boarding and riding. The __dbg.monks() helper reports party count, state, vehicle, amenity waiting and destination. The localhost forced-wagon overlay also shows monk count/state. verification/nut-wagon/monks.html?perf=low&mute=1 runs production party/Crowd checks; repeat with perf=mid. [Saved evidence](verification/nut-wagon/MONKS.md).

The backtick panel’s Teleport picker includes **Nut Wagon (active)** and **Monks (active group)** in the current festival layout. Select one and press **Go** to move beside its live position, facing it. Missing encounters show a specific not-spawned message; teleporting does not force a spawn.

### Mixed people workshop and frame characterization

Open `sandbox.html?entity=people_workshop&seed=1977&mute=1` for production Crowd,
children, photographer, monk party, campsite/camp-music and Healing Arts controllers.
Pause/resume, single-step, honk, take a picture, unload Healing Arts and dispose the
workshop through its controls, then switch away and back to check a fresh owner.
The status includes active populations, visitors, music jobs and registry counts.
Claim/publication cleanup precedes the sandbox's normal GPU-resource disposal on
selector changes. The workshop uses the registered runtime and production ownership boundaries,
with the same accepted-frame clocks and explicit cleanup as the game.

For bounded real-game characterization, start the no-cache development server and
open `/?mute=1&perf=low&seed=1977&peopleTrace=1&peopleTraceFrames=600` on localhost
(or use `perf=mid`). Enter a mode through its ready title-card control, then use
**Trace: add two smile pickups** before the recording fills. After the save control
shows 600/600, click it to write `.claude/captures/people-frames-low-startup.json` or the Mid
equivalent through the existing local sink. Saving has a five-second timeout and
reports failure with a retry control. `__dbg.peopleFrames()` returns a copied report.
Validate a saved JSON or gzip with `node bin/test-people-frame-trace <path>`.
Recording is opt-in, retains copied state rather than actors, and stops after its
bounded frame count (1–600, default 120); normal launches do not create a recorder.
The recorder observes ordering, pickups and collision publication, and is **not a
performance benchmark**. [Saved captures and coverage limits](verification/people/2026-10-26/README.md).

The additional trace controls restart a bounded recording around a real moving
person contact, star-love activation, a 1,800m streaming relocation, or the existing
seat-fill diagnostic. Scenario captures use `people-frames-<tier>-<scenario>.json`.
Seat inspection follows membership in each owner's slot array, including the cart's
legacy slots which omit a vehicle reference. The capture oracle requires positive
results for these named scenarios rather than passing on empty branches.

Use a separate `/?mute=1&perf=low&seed=1977&peopleBaseline=1` launch (repeat Mid)
to measure the implementation baseline. Click a ready mode, then **Measure people
baseline**. It pins quality level 0, camera and time of day, warms for 120 accepted
frames and records 180 more before restoring method probes. **Save people baseline**
writes `people-baseline-<tier>.json` through the local sink. It records CPU timing
and operation counts, live populations/claims, GPU/viewport/physical dimensions,
visibility, scene resources, and three isolated spawn/remove probes using a private
fixture RNG. Validate with `node bin/test-people-baseline <path>`. Compare only runs
with matching recorded setup and the same instrumentation; background or software
WebGL timings do not establish physical-device FPS. Closing the page releases probes.

### People inspection and matched comparisons

`/inspect people` and `__dbg.people()` show copied population/display counts, declared
slots and capabilities. Query identity, interactive activity authority and decorative
display participation are intentionally different. The
[extension guide](openspec/changes/people-npc-architecture/extension-guide.md) contains
the exact person/place contract and current eligibility matrix, and
[dependency slots](openspec/changes/people-npc-architecture/dependency-slots.md)
records the required scoring/streaming/render barriers.

For a repeatable initial scene comparison, add `peopleBaselineAuto=1` and
`peopleBaselineCohort=1` to the baseline URL, set the same viewport, and enter through
the ready title-mode control. The optional cohort flag isolates child/frisbee
construction only; normal launches retain their random streams. The auto flag starts
on the first accepted gameplay frame. Save after the bounded window completes.
`python3 bin/prepare-people-render-comparison` exports the immutable pre-refactor
revision with just the current probes and prints its owned temporary path. Serve
that export on a separate loopback port, then stop both owned servers and tabs.
An optional existing export path refreshes only recognized probe files, without
switching or resetting the working checkout.

`node bin/check-people-render-comparison` validates the saved matched Low/Mid evidence,
including exact initial topology buckets and bounded matrix writes. Cumulative
renderer cache counts and live culled draws need not match when motion/effect/upload
history differs. See [acceptance and measured costs](openspec/changes/people-npc-architecture/acceptance.md)
for the actual CPU increase and physical-device limits. This is not a phone-FPS claim.
`node bin/test-people-boundaries` checks the finalized dependency directions with
rejecting fixtures. No people module owns an autonomous RAF or timer.

### Healing Arts preview

Open `sandbox.html?entity=healing_arts&seed=1977&mute=1` for the complete canopy,
loose yoga class and circulating night dancers, or use
`sandbox.html?entity=healing_arts_activity&mute=1` for a real crowd handoff.
Click Noon, then Midnight to watch the staggered class exit and arrivals; the
status line counts yoga participants, departures, arrivals and dancers. The
backtick panel's Teleport picker includes **Healing Arts tent**, and its stats
show live visitor counts. Seed `1234` has a tent near `(534, 15)`.
[Verification and captures](verification/healing-arts/README.md).

### One-wheel preview

Use `sandbox.html?entity=one_wheel&mute=1` for the helmeted rider and board,
or `sandbox.html?entity=one_wheel_route&mute=1` for the same live controller
with a crossing pedestrian. The route preview counts yield and resume events.
The model status separates construction time from rendering counters; append
`baseline=1` to hide the model for an empty-view comparison.

On localhost, `/?seed=1234&onewheel=1&mute=1` forces one nearby road encounter
and follows it with a close camera after a real start-plank click. Normal games
use the seeded occasional encounter gate. `__dbg.oneWheels()` returns status,
`__dbg.summonOneWheel()` requests a safe nearby encounter, and the backtick
Teleport picker includes **One-wheel rider (active)**. The debug stats show
its current behavior. [Evidence and lifecycle checks](verification/one-wheel/README.md).

### Campsite daily-routine preview

Open `sandbox.html?entity=campsite_activity&seed=1977&mute=1` for a seeded large camp using the production registry and crowd routines. The status line counts approaching, seated and sleeping people. Noon exercises short chair rests, Midnight exercises evening gathering, the time slider near `0.95` exercises tent entry and fire extinction, and Morning exercises emergence. Each shelter supplies independent sleeping reservations up to its modeled capacity, while visitors without a free spot continue their ordinary routines. Small/medium/large previews use the same seed parameter and frame the complete scaled site.

Use `entity=camp_seating` to inspect real seated NPCs on sling, director, low lounge and loveseat chairs at three body scales, including both loveseat positions. The preview deliberately exercises dance-floor flags and animation phases while the seated body remains aligned to the chair fabric. Keys 1–6 show the contact from different angles.

Additional campsite previews use `entity=campsite_cluster` for compact mixed households, `campsite_cluster_roomy` for the roomier counterpart, `campsite_family-base` / `campsite_canvas-lodge` / `campsite_social-lounge` / `campsite_light-travelers` for archetypes, and `camp_tent_ridge` / `camp_tent_dome` / `camp_tent_octagon` / `camp_tent_cabin` / `camp_tent_multiroom` for shelters. `camp_chair_lineup` compares all four chair styles, while `crowd_hair` shows all six hair silhouettes from the front and back. Add `seed=1977&mute=1` for repeatable muted inspection. The neighborhood previews use the real planner, builders, registry and disposal path, with world roads and lakes intentionally absent from the isolated ground.

### Woodland camping in the live generator

Open `sandbox.html?entity=woodland_camping&seed=1977&mute=1` for a real density-field campground, surrounding instanced forest and resident crowd. Noon/Midnight and the late-night slider exercise the existing camp routines. The debug Teleport menu's **Woodland campground** destination uses the same pure planner and places the cart at the host's access frontage. The default v2 world generator now builds these groups before trees; the legacy `forests.js` interior algorithm remains separate.

`entity=camp_instruments` compares the five pooled acoustic instruments. `entity=camp_jam&seed=1977&mute=1` starts a real crowd at evening time and displays each volunteer’s instrument, activity stage and elapsed stage time. Allow the tent-fetch walk before judging arrival; the normal time slider ends or restarts recruitment. Audio remains behind the normal user gesture and session mute.

### Keyboard command prompt and teleport cycling

Press `/` outside a text field to open the debug command prompt, then use `/tp camp` for woodland camping, `/tp village`, `/tp stage`, `/tp lake`, or `/help` for all targets. `/tp 120 -340` accepts explicit world coordinates. Matching commands appear as you type, and `/tp ` lists available destination arguments with descriptions. Tab completes a suggestion, Up/Down select one, clicking or Enter accepts the selection, and Enter with no selection runs the command. Alt+Up/Down recalls the last 30 commands, while ordinary Up/Down also recalls history when no suggestions are shown. Escape closes the prompt. Commands use an allowlisted parser and never evaluate JavaScript. Text entry suppresses driving and debug shortcuts, including previously held keys.

The Teleport menu's Go button and `window.__debug.locate(kind)` share the same itinerary as `/tp`. Repeating a category within 30m of its last arrival skips visited matches before wrapping, while moving away or changing seed resets nearest-first selection. Moving actors and single destinations such as Spawn remain usable when no alternative exists. Searches retain the existing bounded procedural windows or loaded-registry scope, so a cycle covers available matches rather than promising every landmark in the infinite world. `bin/test-debug-teleports` covers cycling, wrap, missing/single matches, seed/position resets and command parsing.

### Expanded slash commands (October 24)

All commands share the same parser and autocomplete schema. Use `/help <command>` for its syntax, type a command followed by a space to discover arguments, and press Tab or select a suggestion. Invalid values or extra arguments do not partially execute. Commands require a running game, except for help.

| Command | Purpose and limits |
| --- | --- |
| `/help [command]` | List all commands or explain one |
| `/tp <destination>` or `/tp <x> <z>` | Existing landmark cycling or finite coordinates within ±10,000,000 |
| `/time [preset or 0..1]` | Read or set dawn, morning, noon, dusk, evening or midnight; the cycle continues on subsequent simulation frames |
| `/pause`, `/resume` | Pause simulation or resume it and clear queued steps |
| `/step [1..120]` | Pause and replace the step queue with this many frames; default 1 |
| `/god [on|off|toggle]` | Invincibility; default toggle |
| `/colliders [on|off|toggle]` | Collision outlines; default toggle |
| `/npc <status|freeze|resume|cheer>` | Inspect crowd states or use existing freeze/cheer behavior; cheering does not override seated, sleeping or other protected interactions |
| `/juice [0..100]` | Read or set reserve meters; this is a debug input bound, not a gameplay stockpile cap |
| `/smiles [1..100]` | Request collectible smile pickups near the cart, default 10; does not directly award score |
| `/star [find|spawn|trigger|end]` | Find the live star-power pickup and its distance, spawn one 10m ahead, start the buff directly, or fade an active buff |
| `/heading [0..360]` | Read degrees, or set heading and stop the cart |
| `/stop`, `/where`, `/seed`, `/status` | Stop, locate the cart, show the seed or inspect simulation/world/scene counters |
| `/inspect <camps|npcs|audio|world>` | Up to 20 built camps within 200m with chair/bed claims, crowd states, session audio/jams or world status; claims include approaching NPCs |
| `/camera <chase|top> [20..600]` | Existing chase or top-down camera, with a top-down span in metres (default 120); paused worlds need a step/resume to render a changed view |
| `/perf [status|on|off]` | True scene counters or existing local performance recording |
| `/mute [on|off|toggle]` | Read or change session mute; no-argument form only reads |

The grammar lives in `src/debugCommands.js`, with game adapters in `src/debug.js`. Focused checks are `bin/test-debug-commands`, `bin/test-debug-actions` and `bin/test-debug-teleports`; the [October 24 report](verification/debug-commands/2026-10-24/README.md) records browser evidence and boundaries.

### Vendor-market activity preview

Open `sandbox.html?entity=vendor_activity&perf=low&mute=1` for two opposing
booths and eight regular NPCs using the production crowd controller. The status
line counts approaches, browsing, conversations, purchases and carried bags.
Noon exercises open stalls, Midnight cancels visits and puts keepers to bed,
and Morning reopens them. Repeat with `perf=mid`. Run
`node bin/test-vendor-shopping` for reservations, lifecycle, frontage rotation,
collision clearance, non-buyers and world-RNG preservation.
[Evidence and captures](verification/vendors/2026-10-25/README.md).


### People ownership and extension contracts

Open `/verification/people/contracts.html?mute=1&perf=low` for real Crowd/child
lifetime, relocation, publication and disposal assertions. Open
`/verification/people/extension.html?mute=1&perf=low` for the shared visit behavior
across Crowd and an independent fixture population, standing slots and a counter,
and an optional borrowed rig. Finish the visits to check ordinary binding and
reservation restoration; the page renders on demand without an autonomous loop.
Routine commands are `node bin/test-children-ownership`,
`node bin/test-healing-arts-ownership` and `node bin/test-people-extension`, all
included in `npm run check`. See the
[extension guide](openspec/changes/people-npc-architecture/extension-guide.md).


For the extracted wook controller, open
`/sandbox.html?entity=wook_population&mute=1&perf=low`. The bounded initial spread
keeps five production actors inspectable while retaining normal gameplay defaults.
The controls exercise parked honk, driver motion, distant recycle and population
cleanup; the status includes approach and public Trip-query counts.
`node bin/test-wooks-ownership` compares frozen legacy frames and the actual Trip
proximity/offer/accept state machine, and is part of the routine suite.


The production parade preview remains
`/sandbox.html?entity=puppet_parade&mute=1&perf=low`; its local clock drives preview
nightness and its ground follows the route. Use
`/sandbox.html?entity=brass_population&mute=1&perf=low` for the actual seven-musician
controller, route/scatter and owned music cleanup, rather than only the stationary
model lineup. `node bin/test-formations-ownership` compares 400 frozen legacy frames
per formation, while `node bin/test-stage-audio-lifecycle` covers cancelled deferred
stage descriptors and the existing adoption delay. Both run in the routine suite.


The `monk_party` sandbox uses the public group boundary and includes **Clear group**
and **Respawn five monks** controls. Clear should report zero population identities
and leave only the ground draws; respawn creates fresh lifetimes and restores the
five existing-model avatars. `nut_wagon_monks` exercises the real all-or-none group
boarding path. `node bin/test-monks-ownership` compares recorded group intent and
poses and checks contention, stale arrivals/releases, exclusive activity binding,
person/owner-first cleanup and partial-spawn rollback.


The `nut_wagon_monks` fixture also exposes **Park and board group**, **Leave wagon**,
**Unload wagon** and **Revisit wagon**. Its count distinguishes occupied seats from
live reservation claims, which should return to zero on unload. Revisit creates new
vehicle slots; old passenger tokens must stay invalid. Former drivers retain the
existing ordinary-person fallback and can become guests, so revisit counts need not
match the initial seven-seat scene. `test-seat-reservations` and
`test-boarding-ownership` are mandatory resource and movement checks.


### Hammock and picnic ownership fixtures

`sandbox.html?entity=hammock_activity&mute=1` and
`sandbox.html?entity=picnic_activity&mute=1` run production Crowd and activity owners.
Their controls start/interrupt a visit and unload/revisit the place, while the status
reports phase, claims and occupancy. Both must return to zero claims and unoccupied
old resources after active unload, then successfully acquire a fresh place.
`node bin/test-rest-activities` compares 800 frames per activity and verifies
contention, stale commands, resource replacement, group eligibility and cleanup.
The frozen oracle intentionally retains the old double timer decrement. This is an
ownership refactor, not a dwell-duration retune.

The `potty_activity` sandbox exercises production bathroom visits, unlocked-door
surprise, ramming, interruption and unload/revisit. `node bin/test-potty-ownership`
compares frozen behavior and checks stale unit/person cleanup.

The `vendor_activity` fixture now reports activity claims and frontage reservations,
with explicit interruption/unload/revisit controls. `node bin/test-market-ownership`
compares production behavior with frozen methods, including the actual salted stream
and replacement-safe cleanup.

Camp and music verification: `node bin/test-camp-ownership` compares seating/sleeping
against frozen methods and checks safe exit, while `node bin/test-camp-music-ownership`
compares ensemble phases and tests person/place teardown, handoff, rollback and an
injected audio-stop failure. `campsite_activity` and `camp_jam` now expose owned
rest/music claim counts and interruption/unload/revisit controls. The sandbox's
**Hold time of day** checkbox holds the actual time; its readout tracks the live
time when advancing, so an old preset label cannot misidentify a later phase.

Photographer commands on Crowd take and return person handles: `forcePhotographer`,
`triggerPhotographer`, `previewPhotographerFlash`; `readPhotographer` writes copied
role/display fields into caller scratch. A competing activity/group/seat is protected
from forced shots, and promotion requires a free camera slot. The production
`crowd_photographer` fixture follows that public view; its picture and flash buttons
use the same handle commands. Run `node bin/test-photographer-ownership` for exact
role/pose comparisons and stale/protected-command checks.
