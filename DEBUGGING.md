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
| `fillSeats(kind?)` | Seat crowd NPC(s) — `kind` = `bench` \| `driver_seat` \| `roof`; no arg seats one of each. For pose-testing riders without waiting for organic boarding. |
| `rider(kind)` | Seat one free NPC in the first open slot of `kind`. |

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

### Inspect the built layout
| Call | Does |
|---|---|
| `dumpRegistry(bounds?)` | **Read-only** JSON-able array of every registry entry — `{kind, x, z, footprint, colliderR, damage, attractorR, attractorW, chunkKey}`. Optional `bounds = {minX,minZ,maxX,maxZ}` clips to a window (one hub). This is the "built truth" the layout linter checks and `bin/layout-snapshot` freezes against; never mutates anything. |
| `dumpDrawCounts(bounds?)` | **Read-only** `{"kind@x,z": n}` map of how many times each worldgen cluster drew from its local rng — the canary. Positions matching but a count moving = an invisible draw add/drop/reorder. Same optional `bounds`. |

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
`dropSmile(n)`, `spawnNPC(n)`.

Overlay hotkeys (only while the panel is open): `P` pause · `.` step · `C`
colliders · `G` god · `F` freeze.

The panel shows live **perf budgets** (draws/tris vs per-tier targets with
`ok`/`!`/`!!` markers), frame-time stats (avg/p95/max), GPU memory, chunk-gen
timing, the session seed, Zerble pos/heading, NPC counts, and collapsible
**Teleport** (locate-nearest-landmark + jump), **Render** (adaptive-quality
overrides), and **Lights** sections.

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
serialize identically. The tier is pinned (`perf=high`) because built truth is
tier-dependent today (crowd draws from the cluster rng stream). `--diff` exits
`0` (`EMPTY`) when layouts match, `1` with a per-kind report otherwise, and flags
per-cluster draw-count (canary) drift even when every position still matches.
