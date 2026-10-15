# Bubble Upgrades

**Status:** Planned. Implementation hasn't started. **Author:** Claude, from a planning session with Gary. **Date:** 2026-10-15.
**Source baseline:** `b215b8d`. Every `file:line` below was verified at that commit. Lines drift, so recheck each anchor before editing.

**TL;DR:** Players earn special bubble types by doing memorable things at the festival (finding Lurleen, sitting in with a drum circle after dark, staying up for the midnight fireworks). Once earned, a type shows up on its own as a rare, bigger "featured" bubble in Zerble's normal stream, roughly one every two seconds, more often when the context fits (hearts near Lurleen, embers near a drum circle). A new **Bubble Upgrades** menu lists every upgrade: earned ones in color with an on/off toggle, locked ones greyed out with a hint, and the one secret type hidden until someone earns it. Each earned upgrade also helps the crowd warm to bubbles a little faster: with ten upgrades, the bubble half of the happiness meter fills 40% quicker. The first wave ships eleven types, starting with a Heart vertical slice that proves the whole loop end to end.

This is a standalone implementation handoff in the same shape as [`PUPPET-PARADE-PLAN.md`](PUPPET-PARADE-PLAN.md), not an OpenSpec change. The checkboxes are the execution record, so leave each one unchecked until its "Done when" evidence exists. It supersedes the older "Bubble varieties" idea at [`ROADMAP.md:807`](ROADMAP.md:807), which proposed a loadout picker and different unlocks.

## Contents

1. [The player's view](#1-the-players-view)
2. [Decisions](#2-decisions)
3. [The first wave](#3-the-first-wave)
4. [Architecture](#4-architecture)
5. [Guardrails](#5-guardrails)
6. [Implementation checklist](#6-implementation-checklist)
7. [Review packets](#7-review-packets)
8. [Agent prompts](#8-agent-prompts)
9. [Later waves and parked ideas](#9-later-waves-and-parked-ideas)
10. [Defaults Gary can override](#10-defaults-gary-can-override)
11. [Verified anchors](#11-verified-anchors)

## 1. The player's view

Gary's guiding principle for the feature: discover something memorable, then carry a little piece of that experience with Zerble afterward.

Here's the loop a player sees. They find Lurleen, and the usual "You found Lurleen!" toast plays. A couple of seconds later a second toast announces "New bubble upgrade: Heart Bubbles!", and for four seconds Zerble's stream fills with pink heart bubbles so the reward is impossible to miss. From then on, in every session, a heart bubble drifts out of the stream every so often (more often while Lurleen is tagging along). A small dot appears on the new in-game Bubble Upgrades button. Opening the menu (the button, the title card, or the `U` key) shows Heart Bubbles in color with a toggle, the other upgrades greyed out with hints like "Join a drum circle after dark," and a line reading "Bubble charm +4%."

The first vertical slice must prove exactly that sequence: **find Lurleen → Heart unlocked → hearts mix into the stream permanently → Heart appears earned in the Bubble Upgrades menu.**

## 2. Decisions

Gary settled these on 2026-10-15. Treat them as fixed unless Gary changes them.

| # | Decision | Why |
|---|---|---|
| D1 (rare featured bubbles) | Special bubbles come from their own slow emitter (base rate 0.5 per second while bubbling) instead of replacing a percentage of the 40-per-second stream. They're bigger and floatier than standard bubbles. Context raises a type's share and the total special rate (capped at 3×). | A 15% mix would be 6 specials per second cruising and about 17 during a G blast ([`bubbles.js:11`](src/bubbles.js:11), [`bubbles.js:217-224`](src/bubbles.js:217)), so nothing would feel special once several types were unlocked. |
| D2 (type is semantic, one cheap renderer) | A bubble's type is data on the particle. Every special type renders through one cheap, non-transmissive shell shader on every tier, so there's no separate low-quality path and identity never degrades. | The October 8 audit measured the transmissive bubble mesh alone pushing scene draws from 2,160 to 4,245 ([`.claude/rules/performance.md`](.claude/rules/performance.md), priority 2). Specials must never trigger that pass. |
| D3 (separate special pool) | Specials live in their own small particle pool inside `Bubbles`, sharing the physics step. Standard bubble behavior, counts and visibility stay byte-for-byte unchanged. | Keeps the existing bubble tests green without edits and stops specials from being starved when a G blast saturates the standard pool. |
| D4 (auto mix plus toggles) | Earned types mix in automatically and default to on. The menu lets the player switch any earned type off. There is no loadout picker. | Some players will tire of a type, and toggles help screenshots. |
| D5 (Bubble Upgrades menu) | The menu lists every non-secret upgrade in catalog order. Earned ones show in color with a toggle, and locked ones are greyed out with a hint. A secret type is completely absent (and not counted in the totals) until earned. | Gary wants players to see what's coming. Secret content stays secret (the Wook trip is discovery content, [`NOTES.md`](openspec/specs/special-modes/NOTES.md)). |
| D6 (charm bonus) | Each earned upgrade adds 4% to the bubble term of the crowd's happiness meter, capped at level 10 (×1.40). Applies in both modes. Toggling a type off does **not** reduce charm. | Gary asked for "a wee bit easier" smiles per upgrade. During planning the bonus was described as "about 5%, capped at about +40%"; 4% per upgrade is the version that actually lands on +40% at ten upgrades. |
| D7 (leaderboard headroom) | The leaderboard Worker's plausibility ceiling gains a `CHARM_ALLOWANCE` factor (1.4). Gary deploys the Worker. | The ceiling is built from `BASE_SMILES_PER_MIN` ([`worker.js:51-58`](workers/leaderboard/worker.js:51)). It's a generous placeholder today (40 × 8 × 1.5 × 1.5 = 720 per minute), so rejection risk is low now. It becomes real once Gary calibrates the base rate to the observed p99 ([`ROADMAP.md:24-34`](ROADMAP.md:24)), and the fix is one extra factor. |
| D8 (both modes) | Every upgrade can be earned in Just Cruisin' and Festival Run, and Confetti needs Festival Run by nature. | Upgrades are a lifetime collection, independent of mode. |
| D9 (first wave) | Eleven types, built in this order: Heart, Music, Ember, Firefly, Rainbow, Sparkler, Lantern, Smile, Confetti, Mushroom (secret), Brass (last in line, easiest to cut). | Gary's picks from the full catalog. |
| D10 (no quest system yet) | The menu has no Quests tab in v1, and nothing is built for quests. | No quest system exists. Section 9 lists the later Quests tab. |
| D11 (menu doesn't pause) | Opening the menu doesn't pause gameplay, matching the Settings overlay. | Consistent with Settings. Gary can override this (Section 10). |
| D12 (session counters reset on load) | "In one session" counters (stages visited, hubs reached) reset on every page load, including the Settings panel's "Apply & restart" reload. | Accepted. A player loses partial progress toward two upgrades only if they change a reload-required graphics setting mid-hunt. |
| D13 (verified on the v2 world) | Triggers are built and verified on the default v2 world. Under `?worldgen=0` some triggers won't fire. | v1 is an escape hatch ([`perf.js:69-73`](src/perf.js:69)), not a supported way to play. |

## 3. The first wave

The trigger column is the exact rule the tracker evaluates. "Night" means `nightness >= NIGHT_MIN` (start at 0.6 and tune). Hint text is draft player-facing copy for Gary to tune, and the looks are starting values to iterate in the sandbox.

| # | Id | Name | Trigger | Hint (draft) | Look (start values) | Pop | Context boost |
|---|---|---|---|---|---|---|---|
| 1 | `heart` | Heart Bubbles | Lurleen enters `aware` for the first time ever (the existing one-shot at [`main.js:1103-1107`](src/main.js:1103)). | Somebody special is cruising the grounds. Go find her. | Heart-shaped shell, `#ff5fa2`, brighter at night. Faces the camera with a gentle wobble. | 12 droplets, pink and pale pink | ×4 while Lurleen is `aware` or `following` |
| 2 | `music` | Music Bubbles | Zerble comes within 30 m of three distinct `stage_front` registry entries in one session. The spawn stage counts. | Catch three different stages. | Sphere, `#8a7dff`, pulses in scale (±8%) and brightness at 2 Hz. | 10 droplets, violet and teal | ×3 within 40 m of any stage front |
| 3 | `ember` | Ember Bubbles | At night, Zerble comes within 20 m of a drum circle (`bench_ring` in v2, `drum_circle` in v1). | Join a drum circle after dark. | Translucent `#ff8a2a` sphere with a glowing red-orange coal and two drifting flecks. | 10 orange droplets that rise and linger (0.8 s) | ×3 within 30 m of a drum circle, ×1.5 at night elsewhere |
| 4 | `firefly` | Firefly Bubbles | At night, Zerble is on dry ground and at least one of 8 points on an 18 m ring around it is in a lake (`isPointInLake`). | Find the water's edge at night. | Dusky `#2f5a4a` shell around a drifting, blinking yellow-green light. | 6 yellow-green droplets, slow, 1 s life | ×2 at night, ×0.5 in full daylight |
| 5 | `rainbow` | Rainbow Bubbles | Zerble enters the core radius of 8 distinct hearts (hubs) in one session. The spawn hub counts. | Roam far: reach eight festival hubs in one trip. | Sphere, hue cycles through the full spectrum (about 0.3 turns per second, per-bubble phase). | 12 droplets across the spectrum | none |
| 6 | `sparkler` | Sparkler Bubbles | The fireworks finale fires while the game is running (new `fireworks.onFinale` hook at [`fireworks.js:363-366`](src/fireworks.js:363)). | Stay up for the midnight fireworks. | Translucent warm white-gold `#ffe39a` sphere with a bright inner spark and brief twinkle spikes. | 14 gold droplets, fast, 0.6 s | ×2 at night |
| 7 | `lantern` | Lantern Bubbles | Zerble comes within 20 m of any lantern parade carrier (`puppets.colliders`, [`obstacles.js:155-158`](src/obstacles.js:155)). | Catch up to the lantern parade. | Slightly tall, translucent `#ff6a3d` sphere enclosing a warm paper-lantern core. | 8 warm droplets | ×3 within 40 m of the parade, ×1.5 at night |
| 8 | `smile` | Smile Bubbles | The lifetime count of collected smiles reaches 1,000 (organic pickups only, counted at [`main.js:1073`](src/main.js:1073)). | Collect 1,000 smiles, all-time. | Sphere, `#ffd84a`, steady. | 10 yellow droplets (stretch goal: arranged as a smiley) | none |
| 9 | `confetti` | Confetti Bubbles | A Festival Run reaches day 2 (`RunState.tickDay` returns true at [`main.js:1024`](src/main.js:1024) with `RunState.day >= 2`). | Make it to day two of a Festival Run. | Sphere, each bubble a random pastel from a fixed palette. | 16 multicolor droplets, slow fall | none |
| 10 | `mushroom` | Mushroom Bubbles (secret) | The player accepts a wook's offer (inside the existing `Trip.onAccept` handler at [`main.js:273`](src/main.js:273)). Manual T-menu trips never count. | Never shown before it's earned. Earned line (draft): "A gift from a new friend." | Sphere, hue drifts slowly between `#9b5de5` and `#3ddc97` (about 6 s), scale breathes ±6% at 0.4 Hz. | 10 droplets, purple and green | ×3 while `Trip.isActive()` ([`trip.js:382`](src/trip.js:382)) |
| 11 | `brass` | Brass Bubbles | Zerble comes within 15 m of any brass band member (`band.colliders`, [`obstacles.js:276-281`](src/obstacles.js:276)). | Roll with the brass band. | Sphere, `#d9a520`, a bright glint sweeps across every 1.5 s (per-bubble offset). | 10 gold droplets | ×3 within 30 m of the band |

Three constraints apply to every look. Each bubble must still read as a bubble (a bright rim with a see-through core, never a solid ball). A type's moving pattern or inner accent must distinguish it at chase distance, rather than hue alone. Rainbow and Mushroom must be easy to tell apart (fast full spectrum versus a slow two-color drift with breathing).

## 4. Architecture

### 4.1 Module map

Five new modules and a set of edits to existing ones.

| File | New or edited | Owns |
|---|---|---|
| `src/bubbleTypes.js` | New. Pure: no DOM, no `three`. | The catalog (Section 3 as data), tuning constants, the weighted picker, the rate function, the charm math, and `computeTint()` for per-bubble color animation. |
| `src/bubbleProgress.js` | New. Pure, with storage injected. | Lifetime state: earned types, toggles, the lifetime smile counter, and the localStorage schema. Emits unlock events to listeners. |
| `src/bubbleChallenges.js` | New. Pure, with world queries injected. | The trigger rules, the session counters, and the context snapshot the emitter reads. |
| `src/specialBubbles.js` | New. Imports `three`. | The renderer: the shell shader, one sphere mesh, one heart mesh, one pop-particle mesh. |
| `src/upgradesMenu.js` | New. DOM only. | The Bubble Upgrades overlay, its entry points, and the unread dot. |
| `src/bubbles.js` | Edited | The special pool, the special emitter, the unlock burst, and the forced-type debug hook. The physics step is shared with standard bubbles. |
| `src/crowd.js` | Edited | The charm knob on the bubble term at [`crowd.js:1488-1492`](src/crowd.js:1488). |
| `src/main.js` | Edited | Boot load, the tracker tick, event hooks, the unlock sequence, the `U` key, analytics, and `__dbg` hooks. |
| `src/fireworks.js` | Edited | An `onFinale` callback at the finale latch. |
| `src/sound.js` | Edited | `playUpgradeUnlock()`, a short rising arpeggio on the SFX bus. Optional pop voices for Music and Brass go behind a listening gate. |
| `src/analytics.js` | Edited | `bubbleUnlocked`, `upgradesMenuOpen`, and `charm_level` on `run_end` and `session_end`. |
| `index.html`, `sandbox.html`, `hub-sandbox.html` | Edited | Five new names in each page's `mods` importmap array ([`index.html:90`](index.html:90), [`sandbox.html:183`](sandbox.html:183), [`hub-sandbox.html:42`](hub-sandbox.html:42)). `index.html` also gets the title-card button beside Settings ([`index.html:255-258`](index.html:255)). `map-sandbox.html` needs nothing, because it only lists worldgen modules ([`bin/check-importmaps`](bin/check-importmaps) lines 10-13). |
| `styles.css` | Edited | Menu, cards, toggles, the in-game button, and the unread dot. The in-game button sits beside `#settings-gear` ([`styles.css:1509-1529`](styles.css:1509)). |
| `workers/leaderboard/worker.js`, `wrangler.toml`, `dev-server.mjs`, `README.md` | Edited | The `CHARM_ALLOWANCE` factor. |
| `bin/node-three-shim.mjs` | Edited | Minimal stubs so the node tests can import the new renderer (see task 2.1). |
| `bin/test-*`, `package.json` | New and edited | The test files listed in each checkpoint, wired into `npm run check`. |

### 4.2 The catalog shape

`bubbleTypes.js` exports the catalog as a frozen array in display order. A sketch of one entry:

```js
export const BUBBLE_TYPES = Object.freeze([
  {
    id: 'heart',
    name: 'Heart Bubbles',
    order: 1,
    secret: false,
    hint: 'Somebody special is cruising the grounds. Go find her.',
    earnedLine: null,              // optional override for the earned card; falls back to hint
    look: {
      shell: 'heart',              // 'sphere' | 'heart'
      tint: 0xff5fa2,
      accent: 'none',             // none | ember | firefly | spark | lantern; more styles can join the same shader
      anim: 'steady',              // steady | pulse | flicker | blink | hue | twinkle | lantern | confetti | swirl | glint
      nightBoost: 0.4,             // brightness added at full nightness
      scale: [1, 1, 1],            // per-axis shell scale (Lantern uses [1, 1.2, 1])
      pop: { colors: [0xff5fa2, 0xffd1e6], count: 12, life: 0.45, speed: 1.0, rise: 0 },
    },
    boost: (ctx) => (ctx.lurleenNear ? 4 : 1),
  },
  // ...one entry per Section 3 row
]);
```

Exported tuning constants (all live in this one file, mirroring how [`runMode.js`](src/runMode.js) keeps its tuning in one place):

```js
export const SPECIAL = Object.freeze({
  baseRate: 0.5,            // specials per second while bubbling at cruising speed, full juice
  rateMaxMult: 3,           // the strongest context boost can raise the total rate at most 3x
  blastMult: 2,             // the G blast doubles the special rate
  sizeMin: 1.6, sizeMax: 2.4,   // standard bubbles are 0.7-2.0 (bubbles.js:400)
  lifeMult: 1.2,
  pool: 48,
  burstSec: 4, burstRate: 6,
  nightMin: 0.6,
});
export const CHARM = Object.freeze({ perUpgrade: 0.04, maxLevel: 10 });
export const CHALLENGE = Object.freeze({
  musicStages: 3, stageRadius: 30,
  rainbowHubs: 8,
  drumRadius: 20, shoreRing: 18,
  paradeRadius: 20, bandRadius: 15,
  lifetimeSmiles: 1000,
  tickSec: 0.5,
});
```

Pure functions the tests exercise directly:

- `pickSpecial(eligibleIds, ctx, rand)` returns a type id or `null`. Eligible means earned and enabled. Each type's weight is `boost(ctx)`.
- `specialRate(eligibleIds, ctx)` returns `SPECIAL.baseRate × clamp(maxWeight, 1, SPECIAL.rateMaxMult)`, or 0 with no eligible types.
- `charmLevel(earnedCount)` returns `min(earnedCount, CHARM.maxLevel)`, and `charmGain(level)` returns `1 + CHARM.perUpgrade × level`.
- `computeTint(look, t, nightness, seed, out)` writes `out.r/g/b/a` (rgb in 0..1, `a` as brightness) and returns a scale multiplier for pulse and breathe animations. It must allocate nothing.
- `visibleCatalog(earnedSet)` returns the entries the menu shows (secrets only when earned) plus `{ found, total }` for the header.

### 4.3 Persistence

`bubbleProgress.js` stores one JSON document under the localStorage key `zerble.bubbleUpgrades`:

```json
{ "v": 1,
  "earned": { "heart": { "at": "2026-10-15T14:02:11Z", "mode": "cruisin" } },
  "disabled": ["rainbow"],
  "lifetimeSmiles": 1234 }
```

Its rules:

- Construct it with a storage adapter (`{ get(key), set(key, value) }`). The game passes a localStorage adapter wrapped in try/catch like [`settings.js:44-46`](src/settings.js:44). Tests pass an in-memory adapter or one that throws.
- Corrupt JSON, a missing key, or a throwing storage all yield an empty state with no exception. When storage throws, progress lives in memory for the session.
- Keep unknown type ids in `earned` when saving (a future or removed type must survive a round trip), but ignore them everywhere else.
- `unlock(id, mode)` is idempotent and returns `true` only the first time. Newly earned types are enabled.
- `setEnabled(id, on)` and `unlock` save immediately. `addLifetimeSmiles(n)` saves at most every 10 seconds, and `flush()` saves immediately. `main.js` calls `flush()` on `pagehide` and on `visibilitychange` to hidden.
- `onUnlock(cb)` registers a listener and returns an unsubscribe function.
- Expose `earnedIds()`, `enabledIds()`, `isEarned(id)`, `isEnabled(id)`, `earnedCount()`, `lifetimeSmiles`, and `reset()` (reset is for `__dbg` only).

### 4.4 The emitter

The special emitter runs inside `Bubbles.update` after the standard spawn loop ([`bubbles.js:203-230`](src/bubbles.js:203)):

```
eligible  = progress.enabledIds()               // earned AND toggled on
rate      = specialRate(eligible, ctx)          // 0 when eligible is empty
rate     *= juiceFactor                         // same 0..1 factor as standard (bubbles.js:223)
rate     *= 0.55 + min(1, speed / 8) * 0.45     // same speed curve as standard (bubbles.js:224)
rate     *= blastMode ? SPECIAL.blastMult : 1
acc      += rate * dt  -> spawn pickSpecial(eligible, ctx, rand) per whole unit
```

Plus three special cases:

- **Unlock burst.** `bubbles.unlockBurst(id)` forces `id` at `SPECIAL.burstRate` for `SPECIAL.burstSec`, ignoring juice (it's a gift, the way star power's emit boost costs no juice, [`bubbles.js:168-170`](src/bubbles.js:168)).
- **Forced type.** `bubbles.forceSpecial(id | null)` makes every special spawn that type at 3× rate. It's a debug and sandbox aid only.
- **Context.** `bubbles.setSpecialContext(ctx)` stores the latest snapshot from the tracker. The emitter never computes context itself.

Specials use the same physics as standard bubbles through a shared step method, with three differences: size comes from `SPECIAL.sizeMin..sizeMax`, life is multiplied by `SPECIAL.lifeMult`, and wind influence is halved so they hang in view longer (tune in the sandbox). Each special particle also carries `type` (catalog index) and `seed` (`Math.random()` at spawn, used for per-bubble animation phase).

`forEachAlive` ([`bubbles.js:444-449`](src/bubbles.js:444)) visits standard and special particles, so specials charm the crowd ([`crowd.js:863`](src/crowd.js:863)) like any other bubble.

The standard `activeCount`, `mesh.count` and `mesh.visible` must count **standard bubbles only**. If specials kept the transmissive standard mesh visible, they would reintroduce exactly the empty-pass cost the audit fixed.

### 4.5 Rendering

`SpecialBubbleRenderer` owns a `root` group with three `InstancedMesh` children. `main.js` adds `bubbles.specialRoot` to the scene next to `bubbles.mesh` ([`main.js:367-369`](src/main.js:367)), and so does the sandbox. The root must **not** be a child of `bubbles.mesh`, because the standard mesh hides whenever no standard bubbles are alive.

- **Sphere shells**, capacity `SPECIAL.pool`: an owned `IcosahedronGeometry(0.11, 2)` (the standard radius from [`bubbles.js:50`](src/bubbles.js:50), one detail level smoother).
- **Heart shells**, capacity `SPECIAL.pool`: an owned copy from `createHeartGeometry()` ([`heart.js`](src/models/heart.js)). **Never** use or mutate `sharedHeartGeometry`, which Lurleen uses. Normalize the copy so its bounding radius equals 0.11 m × `HEART_SHELL_SCALE` (start at 1.25). An extruded heart vanishes edge-on, so heart instances face the camera (yaw and pitch toward it) with a ±20° wobble, and `Bubbles.update` gains an optional `camera` argument (the main camera is `camera`, [`main.js:177`](src/main.js:177)).
- **Pop particles**, capacity 128: `IcosahedronGeometry(0.03, 0)` with `MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false })` and per-instance color via `setColorAt`, the same per-instance color technique fireworks uses ([`fireworks.js:13-16`](src/fireworks.js:13)).

Both shell meshes share one shader material. Per-instance color and brightness come from `aTint` (4 floats), while `aAccent` (style and phase) draws the inner motif in the same shader. Camera-facing sphere instances keep these motifs legible. This preserves the limit of two shell draws plus one pop draw, only while something is alive. The reference sketch below describes the original rim path; the checked-in renderer also blends the per-type inner accents and uses a lighter core and rim than the sketch.

```js
const SHELL_VERT = /* glsl */ `
  attribute vec4 aTint;            // rgb = tint (0..1), a = brightness
  varying vec4 vTint;
  varying float vRim;
  #include <fog_pars_vertex>
  void main() {
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * mat3(instanceMatrix) * normal);
    vRim = 1.0 - abs(dot(n, normalize(-mvPosition.xyz)));
    vTint = aTint;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
const SHELL_FRAG = /* glsl */ `
  uniform float uCoreAlpha;
  uniform float uRimAlpha;
  varying vec4 vTint;
  varying float vRim;
  #include <fog_pars_fragment>
  void main() {
    float rim = pow(vRim, 1.6);
    gl_FragColor = vec4(vTint.rgb * vTint.a * (0.55 + 0.9 * rim), uCoreAlpha + uRimAlpha * rim);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;
const shellMat = new THREE.ShaderMaterial({
  uniforms: THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    { uCoreAlpha: { value: 0.18 }, uRimAlpha: { value: 0.7 } },
  ]),
  vertexShader: SHELL_VERT,
  fragmentShader: SHELL_FRAG,
  transparent: true,
  depthWrite: false,
  fog: true,
});
```

Renderer rules:

- Each frame, `beginFrame()` resets per-mesh cursors. `write(typeIndex, pos, size, spin, age, seed)` packs the instance matrix and `aTint` into the next free slot of the right mesh, and `endFrame()` sets each mesh's `count`, sets `visible = count > 0`, and flags `instanceMatrix.needsUpdate` and the `aTint` attribute's `needsUpdate`. The pop mesh does the same from its own particle list.
- `pop(typeIndex, pos, size)` spawns that type's droplet burst. Reuse slots in a ring like the standard droplets ([`bubbles.js:336-355`](src/bubbles.js:336)).
- No `castShadow`, no transmission, no `MeshPhysicalMaterial`, and no new lights.
- Nothing allocates per frame. Reuse scratch vectors, matrices and the `computeTint` output object.
- The renderer owns its geometries and materials (the instance-owned pattern in [`.claude/rules/perf-pooling.md`](.claude/rules/perf-pooling.md)), and `dispose()` frees them. Since it never enters a chunk group, it doesn't need the `userData.shared` tag.

### 4.6 The challenge tracker

`ChallengeTracker` in `bubbleChallenges.js` is constructed with `progress` and a `world` adapter of plain functions, so node tests can fake the world entirely:

```js
world = {
  zerblePos: () => ({ x, z }),
  nightness: () => number,
  lurleenNear: () => bool,                    // lurleen.state is 'aware' or 'following' (main.js:1099)
  stageFronts: (fn) => void,                  // fn(x, z) per resident 'stage_front' entry
  drumCircles: (fn) => void,                  // fn(x, z) per resident 'bench_ring' or 'drum_circle'
  isPointInLake: (x, z) => bool,              // lakes.js:931
  heartAt: (x, z) => ({ key, dist, coreR }),  // nearestHeart + CONFIG.HEART_DOMAIN[rank].core
  paradePositions: (fn) => void,              // fn(x, z) per puppets.colliders[i].position
  bandPositions: (fn) => void,                // fn(x, z) per band.colliders[i].position
  tripActive: () => bool,                     // Trip.isActive()
}
```

In `main.js`, `stageFronts` and `drumCircles` iterate `registry.byKind.get(kind)` and look each id up in `registry.entries` ([`registry.js:22-23`](src/registry.js:22)). They're cheap because only resident entries of that kind are visited. `heartAt` wraps `nearestHeart` ([`hearts.js:58-77`](src/worldgen/hearts.js:58)) with the core radius from `HEART_DOMAIN` ([`constants.js:20-23`](src/worldgen/constants.js:20)).

The tracker's API:

- `tick(dt)` accumulates time and evaluates the proximity rules and the context snapshot every `CHALLENGE.tickSec`. It never runs proximity scans every frame.
- `context` is the latest snapshot: `{ nightness, lurleenNear, nearStage, nearDrum, nearShore, nearParade, nearBand, tripActive }`. `main.js` hands it to `bubbles.setSpecialContext()` after each evaluation.
- Event methods for the one-shot triggers: `onLurleenFound()`, `onFireworksFinale()`, `onTripAccepted()`, `onRunDay(day)`, `onSmilesCollected(n)`.
- Session state: `stagesSeen` and `hubsSeen` are `Set`s of position keys (`Math.round(x) + ',' + Math.round(z)` for stages and `cx + ',' + cz` for hearts). Position keys matter because a chunk that unloads and reloads re-registers the same stage with a new registry id.
- `debugState()` returns the counters for `__dbg.challenges()`.

Each rule calls `progress.unlock(id, mode)` and does nothing else. Everything that follows an unlock (toast, unlock burst, sound, analytics, charm) hangs off `progress.onUnlock` in `main.js`, so every unlock path (real or `__dbg`) behaves the same.

### 4.7 The unlock sequence

`main.js` registers one `progress.onUnlock(({ id, mode }) => ...)` listener that does the following, in this order:

1. Calls `bubbles.unlockBurst(id)` immediately.
2. Queues the toast "New bubble upgrade: {name}!" (append the type's emoji to match the existing toast style at [`main.js:1105`](src/main.js:1105)). Show queued toasts 2.5 s after the trigger and 2.5 s apart, because Heart unlocks on the same frame as "You found Lurleen!" and `HUD.toast` replaces whatever is showing ([`hud.js:536-539`](src/hud.js:536)).
3. Calls `Sound.playUpgradeUnlock()` when the toast shows.
4. Calls `Analytics.bubbleUnlocked(id, mode, progress.earnedCount())`.
5. Calls `crowd.setBubbleCharm(charmGain(charmLevel(progress.earnedCount())))`.
6. Calls `UpgradesMenu.markUnread()`.

### 4.8 Charm and the leaderboard

In `crowd.js`, add `this.bubbleCharm = 1` in the constructor and a `setBubbleCharm(g)` setter. Multiply the bubble term at [`crowd.js:1491`](src/crowd.js:1491) by it, so `gain += 1.0 * (1 - bd / BUBBLE_RANGE)` becomes `gain += this.bubbleCharm * (1 - bd / BUBBLE_RANGE)`. Leave `BUBBLE_RANGE`, the eye-contact term and the cooldowns untouched. Each person can still smile only once per 3 s and 28 m ([`crowd.js:73-74`](src/crowd.js:73)), so the real gain in smiles per minute will be smaller than the meter boost. Measure it rather than assume it.

In the Worker, `ceilingFor` ([`worker.js:51-58`](workers/leaderboard/worker.js:51)) gains `const charm = num(env.CHARM_ALLOWANCE, 1.4);` as a fifth factor. Add `CHARM_ALLOWANCE = "1.4"` to `[vars]` in [`wrangler.toml`](workers/leaderboard/wrangler.toml:36), add it to [`dev-server.mjs`](workers/leaderboard/dev-server.mjs:24) and the `bin/test-leaderboard-worker` env (line 104), and update the formula in the Worker README (line 12) and the comment at [`worker.js:26`](workers/leaderboard/worker.js:26). 1.4 is a sound upper bound: the charm multiplies only one of the two terms that fill the meter, so it can't raise the organic rate by more than 40%.

`Analytics.runEnd` and `Analytics.sessionEnd` gain `charm_level`, so Gary can calibrate `BASE_SMILES_PER_MIN` against charm-0 runs only.

### 4.9 The Bubble Upgrades menu

`upgradesMenu.js` builds a DOM overlay modeled on the Settings overlay ([`settings.js:170-183`](src/settings.js:170)): backdrop, close button, Escape and backdrop click to close, and wheel events stopped at the overlay.

- **Entry points.** The menu opens from a title-card button `#upgrades-open-title` labeled "Bubble upgrades" in `.title-footer` ([`index.html:255-258`](index.html:255)), from an in-game round button `#upgrades-btn` beside the Settings gear (created the same way, [`settings.js:84`](src/settings.js:84), and shown when `body.game-started`), and from the `U` key via `Input.consumePressed('U')` next to the `V` handler ([`main.js:949`](src/main.js:949)). `U` is unbound today, but re-grep `src/` for `'U'` before using it.
- **Header.** "Bubble Upgrades" with a subline like "3 of 10 found · Bubble charm +12%". Totals come from `visibleCatalog`, so an unearned secret is neither shown nor counted.
- **Cards** in catalog order. Earned cards show a colored swatch (a CSS radial gradient from the type's tint with a bright rim), the name, the hint or `earnedLine`, and a toggle (`role="switch"`, `aria-checked`). Locked cards show a greyed swatch, the name, the hint and a lock mark.
- **Toggles** call `progress.setEnabled` and take effect on the next special spawn.
- **Unread dot.** `markUnread()` shows a dot on `#upgrades-btn` until the menu next opens.
- **Accessibility.** Use `role="dialog"` and `aria-modal="true"`, focus the close button on open, and restore focus on close. With reduced motion on (the [`a11y.js`](src/a11y.js) module), swatches don't animate. Touch targets are at least 44 px, and the overlay scrolls on a 375 × 812 phone.

### 4.10 Debug surface

Add these to `window.__dbg` ([`main.js:1858`](src/main.js:1858)) and to its `help()` text ([`main.js:2590`](src/main.js:2590)):

| Hook | Does |
|---|---|
| `upgrades()` | Returns a table of every type (earned, enabled, secret) plus charm level, lifetime smiles and session counters. |
| `unlock(id \| 'all')` | Unlocks through `progress.unlock`, so the full unlock sequence runs. |
| `relock(id \| 'all')` | Removes earned state (calls `progress.reset()` for `'all'`). |
| `forceSpecial(id \| null)` | Forces every special to one type, for screenshots. |
| `unlockBurst(id)` | Runs the unlock burst. |
| `lifetimeSmiles(n)` | Sets the lifetime counter, to test the Smile threshold. |
| `challenges()` | Returns `tracker.debugState()`. |

The sandbox gets a new entity, `bubbles_special` (an `<option>` next to `bubbles` at [`sandbox.html:342`](sandbox.html:342) and a `case` next to [`sandbox.html:2707`](sandbox.html:2707)):

- `?entity=bubbles_special` shows the **lineup**: all eleven types frozen in catalog order 1.2 m apart at size 2.0, with a standard bubble at each end for scale, animations running, plus a "Pop all" button.
- `?entity=bubbles_special&type=<id>` shows the **stream**: a fake Zerble (as the existing `bubbles` case does) emitting that type through the real emitter, plus an "Unlock burst" button.
- **Camera.** Add a "Chase distance" control that puts the camera 12 m behind and 6.5 m above the emitter, matching the game's default chase framing (`DEFAULT_DISTANCE` and `DEFAULT_HEIGHT`, [`camera.js:11-12`](src/camera.js:11)). This is the readability gate's camera.
- Scope the controls to this entity the way the puppet views scope theirs ([`sandbox.html:930-960`](sandbox.html:930)).

## 5. Guardrails

### Do not

- **Touch determinism.** Don't touch `rng.js`, any salt, any worldgen file, or any `ctx.rng` stream. Nothing in this feature needs seeded randomness. `Math.random` is fine for bubbles, as it already is.
- **Use expensive materials on specials.** No transmission, no `MeshPhysicalMaterial`, no `castShadow`, and no new lights.
- **Change standard bubble behavior.** `bin/test-bubble-pop` and `bin/test-bubbles-visibility` must pass **without edits**. You may add new assertions in new test files.
- **Let specials affect the standard mesh.** Specials must never keep the standard bubble mesh visible.
- **Mutate shared geometry.** Never mutate `sharedHeartGeometry`.
- **Touch the iOS audio path.** Leave `Sound.init` and anything in the title-card tap path alone (CLAUDE.md tripwire 3). The new sound plays only after the game has started.
- **Leak secrets.** Never mention Mushroom, wooks, trips or star power in `README.md`, the title card, the how-to page, or any toast or hint visible before the Mushroom unlock.
- **Patch three.js after import.** Never `THREE.X = Y` (CLAUDE.md tripwire 2).
- **Add a bundler**, or any build step.
- **Write to localStorage every frame** or on every smile.
- **Deploy, push or commit** unless Gary asks. **Never** run `wrangler deploy`. That step is Gary's.

### Stop and report to Gary

- The baseline `npm run check` fails before you change anything. Record it and ask before proceeding.
- An existing bubble test needs editing to pass.
- The draw count rises while no specials are alive, or the transmission pass runs when it didn't before.
- The shell shader fails to compile on any tier after two fix attempts (the circuit breaker).
- A trigger can't be implemented without new world content or a worldgen change.
- Any type looks like a solid ball or can't be told apart at chase distance on Low tier after two iterations. That's a Gary visual call.
- `main.js` boot order would need to change for the progress load, for example moving anything into or out of the title tap.

### Model routing

| Work | Model | Why |
|---|---|---|
| Checkpoint 0 (baseline) and Checkpoint 1 (pure modules and tests) | Sonnet | The spec is complete and the tests define done. |
| Checkpoint 2 (renderer, shader, `bubbles.js` surgery) | Opus | Hot-path edits plus a custom shader, where failures look plausible but wrong. |
| Checkpoint 3 (`main.js` wiring, toast queue, menu) | Opus for `main.js`, Sonnet for the menu DOM and CSS | `main.js` is 2,700 lines with boot-order tripwires. The menu follows `settings.js`. |
| Checkpoint 4 (remaining types) | Sonnet, escalating to Opus for any new `anim` kind that misbehaves | Data entries and trigger rules on a proven pipeline. |
| Checkpoint 5 (charm and Worker) | Sonnet | Small and well-specified. Gary deploys. |
| Checkpoint 6 (perf, docs) | Sonnet, then a stronger model for the read-only review in task 6.4 | Mechanical, with the review as insurance. |

## 6. Implementation checklist

### Checkpoint 0: Baseline

- [x] **0.1 Read.** Read `CLAUDE.md`, `DEBUGGING.md`, `.claude/rules/sandbox-and-testing.md`, `.claude/rules/performance.md`, `.claude/rules/perf-pooling.md`, `.claude/rules/no-build.md` and this plan. Load the `threejs-shaders` and `threejs-geometry` skills before Checkpoint 2. Confirm the branch and a clean tree with `git status`.
  **Done when:** you can name the four tripwires this feature brushes (importmaps, threeShim, iOS audio, perf budget).
- [x] **0.2 Baseline checks.** Run `npm run check` and record pass or fail per suite.
  **Done when:** the result is recorded in your report. Report any failure that predates your changes, and leave it alone.
- [ ] **0.3 Baseline captures.** Capture `sandbox.html?entity=bubbles` at Noon and Midnight on `?perf=low` and `?perf=high`. In the main game, record draws and triangles from the backtick overlay while parked with bubbles flowing, and again with the tank empty (`__dbg.setJuice(0)`).
  **Done when:** four screenshots and both draw counts are saved under `verification/bubble-upgrades/baseline/` with the git ref noted.

**Exit condition:** you have a known-good baseline to compare every later number against.

### Checkpoint 1: Data, persistence and tracker (pure, no rendering)

- [x] **1.1 `src/bubbleTypes.js`.** Build the catalog (all eleven Section 3 rows), `SPECIAL`, `CHARM`, `CHALLENGE`, `pickSpecial`, `specialRate`, `charmLevel`, `charmGain`, `computeTint` (all ten `anim` kinds) and `visibleCatalog`. No imports from DOM or `three`.
  **Done when:** `node -e "import('./src/bubbleTypes.js').then(m => console.log(m.BUBBLE_TYPES.length))"` prints 11.
- [x] **1.2 `src/bubbleProgress.js`.** Implement Section 4.3.
  **Done when:** the tests in 1.4 pass for the fresh, corrupt, throwing and round-trip cases.
- [x] **1.3 `src/bubbleChallenges.js`.** Implement Section 4.6 with every rule in Section 3.
  **Done when:** the tests in 1.4 pass for each rule's positive and negative case.
- [x] **1.4 Tests.** Write `bin/test-bubble-types`, `bin/test-bubble-progress` and `bin/test-bubble-challenges` (node, `node:assert/strict`, the same style as [`bin/test-bubble-pop`](bin/test-bubble-pop)). Cover at least:
  - Catalog integrity: unique ids, orders 1-11, only `mushroom` secret, every `anim` kind handled, and every pop count under 20.
  - `pickSpecial` with a seeded `rand`: it returns only eligible ids, a ×4 weight wins about 4× as often over 10,000 picks (±10%), and it returns `null` with no eligible types.
  - `specialRate`: 0 with nothing eligible, `baseRate` with neutral context, and capped at 3× however large a boost is.
  - `charmGain(charmLevel(n))`: 1.00 at 0, 1.04 at 1, 1.40 at 10 and at 11.
  - `computeTint`: finite output in range for `t` from 0 to 100 and nightness 0, 0.5 and 1 for every type, with no allocation (the same `out` object comes back).
  - `visibleCatalog`: 10 entries and a total of 10 with `mushroom` unearned, 11 and 11 with it earned.
  - Progress: idempotent unlock, toggles persist, unknown ids survive a save, the lifetime-smile save is debounced, and `flush()` writes.
  - Tracker: the Lurleen event; drum circle at night versus day; the shore ring on land versus in a lake; 2 versus 3 stages, including the same stage re-registered under a new id; 7 versus 8 hubs; finale; trip accepted; day 2 versus day 1; parade and band in and out of radius; lifetime smiles 999 then 1,000. Also check that the context snapshot fields match the fake world.
  **Done when:** all three pass under plain `node`.
- [x] **1.5 Wiring.** Add the three new modules (and the two from Checkpoints 2 and 3 once they exist) to the `mods` arrays in `index.html`, `sandbox.html` and `hub-sandbox.html`. Add the three tests to `npm run check` and add `test:upgrades` to `package.json`.
  **Done when:** `bin/check-importmaps` and `npm run check` pass.

**Exit condition:** the whole rule set is proven in node with no rendering and no game boot.

### Checkpoint 2: Renderer and emitter (sandbox first)

- [x] **2.1 Shim stubs.** Extend the stub source in `bin/node-three-shim.mjs` with constructor-only stubs: `ShaderMaterial` (stores params), `UniformsLib = { fog: {} }`, `UniformsUtils = { merge: (list) => Object.assign({}, ...list) }`, `Shape` (no-op `moveTo` and `bezierCurveTo`), and `ExtrudeGeometry extends GeometryStub`. Add no-op `center()`, `rotateZ()`, `scale()` and `computeBoundingSphere()` (which sets `boundingSphere = { radius: 1 }`) to `GeometryStub`, each returning `this`. Without these, importing `heart.js` throws at module load, and `bubbles.js` will import the renderer that imports it. Don't add fake geometry math.
  **Done when:** `bin/test-bubble-pop` and `bin/test-bubbles-visibility` still pass after `bubbles.js` imports the renderer.
- [x] **2.2 `src/specialBubbles.js`.** Implement Section 4.5.
  **Done when:** the sandbox lineup (2.4) renders with no console or shader errors on `?perf=low` and `?perf=high`.
- [x] **2.3 `bubbles.js` special pool.** Add the special pool, emitter, `unlockBurst`, `forceSpecial`, `setSpecialContext`, `specialRoot`, the optional `camera` argument, and a `progress` reference set by `bubbles.setProgress(progress)` (no progress set means no specials, so the existing tests and sandbox entity behave exactly as before). Factor the per-particle physics into a shared step method without changing standard behavior.
  **Done when:** the existing bubble tests pass unedited, and `forEachAlive` visits specials.
- [x] **2.4 Sandbox entity.** Add `bubbles_special` (Section 4.10), including the importmap entries in `sandbox.html`.
  **Done when:** `sandbox.html?entity=bubbles_special` and `sandbox.html?entity=bubbles_special&type=heart` both load from a cold reload.
- [x] **2.5 `bin/test-special-bubbles`.** Assert that:
  - with no progress, no special ever spawns;
  - with Heart earned and enabled, 100 simulated seconds at cruising speed spawns 50 ± 10;
  - an empty tank spawns none, but an unlock burst still spawns 24 ± 2 in 4 s;
  - the pool cap holds;
  - `specialRoot` children are invisible when nothing is alive;
  - the standard mesh stays invisible when only specials are alive;
  - the shell material is a `ShaderMaterial` with no `transmission`.

  Add the test to `npm run check`.
  **Done when:** it passes.
- [ ] **2.6 Heart look.** Iterate the Heart in the sandbox: rim strength, core alpha, heart scale, wobble and pop. Capture the lineup and the Heart stream at Noon and Midnight on Low and High, close up and at chase distance. Then stop for **Gary gate A**.
  **Done when:** Gary approves the Heart look. A technically passing render is not visual approval.

  Gary's 2026-10-15 review asked for more translucent shells and visible inner details on some types. The revised Low and High captures are in [the Gate A packet](verification/bubble-upgrades/checkpoint-2/GATE-A.md). Gate A remains open for a decision on that revision.

**Exit condition:** Heart bubbles render, pop and stream in isolation, cheaply, on every tier.

### Checkpoint 3: The Heart vertical slice in the game

- [ ] **3.1 Boot wiring.** In `main.js`:
  - Construct the progress module at module evaluation with a localStorage adapter. Not inside the title tap.
  - Call `bubbles.setProgress(progress)`, add `scene.add(bubbles.specialRoot)` next to [`main.js:369`](src/main.js:369), and pass `camera` to `bubbles.update` at [`main.js:1001`](src/main.js:1001).
  - Construct the tracker with the real world adapter from Section 4.6, call `tracker.tick(dt)` in the loop, and pass `tracker.context` to `bubbles.setSpecialContext`.
  - Call `progress.flush()` on `pagehide` and on hidden visibility.

  **Done when:** the game boots with zero console errors and no specials appear on a fresh profile.
- [ ] **3.2 Heart trigger.** Call `tracker.onLurleenFound()` inside the existing one-shot at [`main.js:1103-1107`](src/main.js:1103).
  **Done when:** teleporting next to Lurleen in a fresh profile unlocks Heart through the real trigger. Find her with `__dbg.game` and use `__dbg.teleport`. Calling `__dbg.unlock` doesn't count.
- [ ] **3.3 Unlock sequence.** Implement Section 4.7, including the toast queue.
  **Done when:** on finding Lurleen, "You found Lurleen!" shows in full, then the upgrade toast follows about 2.5 s later, and the unlock burst begins at the moment of discovery.
- [ ] **3.4 `Sound.playUpgradeUnlock()`.** Build a short rising arpeggio on the SFX bus, synthesized like the existing one-shots (see `playJuicePickup` at [`sound.js:973`](src/sound.js:973)).
  **Done when:** it plays once per unlock, respects the SFX volume slider, and is silent when muted.
- [ ] **3.5 Menu.** Build `src/upgradesMenu.js`, the CSS, the title-card button, the in-game button, the `U` key and the unread dot (Section 4.9).
  **Done when:**
  - a fresh profile shows ten greyed cards and no Mushroom card;
  - after the Heart unlock, Heart shows in color with a toggle, the header reads "1 of 10 found · Bubble charm +4%", and the dot shows until the menu opens;
  - the toggle stops hearts within one spawn interval and survives a reload;
  - the menu works at 375 × 812 with touch, and with the keyboard only.
- [ ] **3.6 Analytics.** Add `Analytics.bubbleUnlocked(type, mode, count)` sending `bubble_unlocked { type, mode, unlocked_count, time_in_run_s }`, and `Analytics.upgradesMenuOpen()` sending `upgrades_menu_open` once per run (use the existing `state.firsts` pattern in `bubbleBlast` at [`analytics.js:167-168`](src/analytics.js:167)). Record toggles with `Analytics.featureUsed('upgrade_toggle')` ([`analytics.js:185`](src/analytics.js:185)).
  **Done when:** a console stub (`window.gtag = (...a) => console.log(a)`, since `send` calls `window.gtag` directly at [`analytics.js:36-37`](src/analytics.js:36)) logs both events with the right params.
- [ ] **3.7 Debug hooks.** Add the `__dbg` hooks from Section 4.10 and their `help()` lines.
  **Done when:** each hook runs from the console without errors and does what the table says.
- [ ] **3.8 Smoke test.** Boot `http://127.0.0.1:8765/` on Low and High: title card, real Start, a few seconds of play, console clean. Reload and confirm Heart persists and hearts keep mixing in. Then run a Festival Run with Heart earned and confirm specials don't affect scoring, juice or the vibe meter (charm comes in Checkpoint 5).
  **Done when:** screenshots and console output are saved under `verification/bubble-upgrades/slice/`.
- [ ] **3.9 Gary gate B.** Hand Gary the slice review packet (Section 7) and stop for a playtest.
  **Done when:** Gary approves the slice or lists changes, recorded in this plan.

**Exit condition:** find Lurleen → Heart unlocked → hearts mix in permanently → Heart shows earned in the menu, on desktop and phone widths.

### Checkpoint 4: The remaining ten types

Build one type at a time in D9 (first wave) order. For each type, every step below must happen before moving to the next type:

1. Its catalog entry and look already exist from 1.1. Tune them in `sandbox.html?entity=bubbles_special&type=<id>`.
   Use `&view=still` to inspect one shell and its inner motif without the stream. Check that the moving pattern or accent, not just its tint, distinguishes the type at chase distance.
2. Wire its trigger in `main.js` if it's event-based (the finale, trip, run day and smile hooks below), or confirm the tracker's proximity rule fires live.
3. Prove the trigger live in the game through its real path, not `__dbg.unlock`.
4. Capture its stream at Noon and Midnight, Low tier, at chase distance.

- [ ] **4.1 Music.** Proximity rule.
  **Done when:** driving past three distinct stages unlocks Music, and re-entering a stage you already visited never counts twice.
- [ ] **4.2 Ember.** Proximity at night.
  **Done when:** a drum circle at Noon doesn't unlock it, and the same drum circle at Midnight (`__dbg.tod`) does.
- [ ] **4.3 Firefly.** Shore ring at night.
  **Done when:** a lakeshore at Midnight unlocks it and an inland spot at Midnight doesn't.
- [ ] **4.4 Rainbow.** Hub cores.
  **Done when:** `__dbg.challenges()` shows the hub count climbing as you drive, and the eighth distinct hub unlocks it. Record the real driving time it took so Gary can judge whether 8 is the right number.
- [ ] **4.5 Sparkler.** Add `this.onFinale = null` to `Fireworks` and call it beside `this._finaleFired = true` ([`fireworks.js:364`](src/fireworks.js:364)). Wire `fireworks.onFinale = () => tracker.onFireworksFinale()` next to `fireworks.onBurst` ([`main.js:388`](src/main.js:388)).
  **Done when:** scrubbing time to the finale unlocks Sparkler exactly once.
- [ ] **4.6 Lantern.** Parade proximity.
  **Done when:** reaching the parade (find it via `__dbg.game.puppets`) unlocks it.
- [ ] **4.7 Smile.** Call `tracker.onSmilesCollected(_collectedThisFrame)` beside [`main.js:1073`](src/main.js:1073). The progress module accumulates and debounces the counter. `__dbg.addSmiles` must not count.
  **Done when:** `__dbg.lifetimeSmiles(995)` followed by collecting five real smiles unlocks it.
- [ ] **4.8 Confetti.** Call `tracker.onRunDay(RunState.day)` inside the day-up branch at [`main.js:1024-1029`](src/main.js:1024).
  **Done when:** a Festival Run reaching day 2 unlocks it (use the stakes drills listed in `__dbg.help()`), and Just Cruisin' never does.
- [ ] **4.9 Mushroom.** Call `tracker.onTripAccepted()` inside the existing `Trip.onAccept` handler at [`main.js:273`](src/main.js:273). Add the ×3 boost while `Trip.isActive()`.
  **Done when:** accepting a wook's offer unlocks it, a manual T-menu trip doesn't, and before the unlock the menu, README and title card show no trace of it.
- [ ] **4.10 Brass.** Band proximity.
  **Done when:** rolling alongside the band unlocks it.
- [ ] **4.11 Gary gate C.** Send Gary the lineup at Noon and Midnight plus one chase-distance stream per type. Batch the requests (for example, 4.1-4.4, then 4.5-4.8, then 4.9-4.10) instead of one per type.
  **Done when:** Gary approves each look or lists changes.

**Exit condition:** all eleven types unlock through their real triggers and read as distinct at chase distance on Low tier.

### Checkpoint 5: Charm and leaderboard headroom

- [ ] **5.1 Crowd charm.** Add the knob from Section 4.8 to `crowd.js` and apply it at boot (from `progress.earnedCount()`) and on every unlock. Add `charm_level` to `runEnd` and `sessionEnd`.
  **Done when:** `__dbg.unlock('all')` makes `crowd.bubbleCharm` read 1.4, `__dbg.relock('all')` makes it read 1.0, and the GA payloads carry `charm_level`.
- [ ] **5.2 Worker.** Add `CHARM_ALLOWANCE` (Section 4.8) and an assertion in `bin/test-leaderboard-worker` that the ceiling scales by it.
  **Done when:** `npm run test:board` passes.
- [ ] **5.3 Measure.** Run two comparable 3-minute drives through the same hubs, one at charm 0 and one at charm 10. Record `Scoring.rawSmiles` per minute for each.
  **Done when:** both numbers are recorded in this plan. Treat them as indicative, since crowd placement varies.
- [ ] **5.4 Gary gate D (Gary-only).** Gary deploys the Worker with `npx wrangler deploy` in `workers/leaderboard/` before the charm change reaches GitHub Pages.
  **Done when:** Gary confirms the deploy.

**Exit condition:** upgrades make smiles slightly easier, and an honest charm-10 run can't trip the plausibility ceiling.

### Checkpoint 6: Performance, docs and final review

- [ ] **6.1 Performance.** Compare against the Checkpoint 0 numbers on `?perf=low`, `?perf=mid` and `?perf=high`. With all types earned and specials flowing, check three things. Draws may rise by 3 at most. Draws with the tank empty and no specials alive must match baseline. Midnight bloom must not blow specials out into white blobs.
  **Done when:** the numbers and Midnight screenshots are saved under `verification/bubble-upgrades/perf/`.
- [ ] **6.2 Docs.**
  - `CHANGELOG.md`: an entry in the same commit as each shipped piece of work, per [`.claude/rules/changelog-and-roadmap.md`](.claude/rules/changelog-and-roadmap.md).
  - `ROADMAP.md`: replace the "Bubble varieties" bullet ([`ROADMAP.md:807-818`](ROADMAP.md:807)) with the Section 9 backlog, and update the "Bubble-variety juice costs" note at [`ROADMAP.md:820`](ROADMAP.md:820).
  - `README.md`: add `U` (Bubble upgrades) to the controls table and the in-game button to the touch list. No secrets.
  - `DEBUGGING.md`: the `__dbg` hooks and the sandbox entity.
  - `ARCHITECTURE.md`: a short Bubble Upgrades section.
  - Capability specs: update [`openspec/specs/feedback-systems/spec.md`](openspec/specs/feedback-systems/spec.md), `hud/spec.md`, `analytics/spec.md` and `crowd-ai/spec.md` so the reference stays true.

  **Done when:** each doc reflects what shipped, and `README.md` contains no trace of Mushroom.
- [ ] **6.3 Final checks.** Run `npm run check` and `bin/check-importmaps`, plus the main-game smoke test on Low, Mid and High at Noon and Midnight, including a 375 × 812 viewport.
  **Done when:** everything passes, or each failure is listed separately from the baseline failures.
- [ ] **6.4 Review.** One agent, working alone and read-only, reviews everything this work changed (the diff from the starting commit plus untracked files). At minimum it checks:
  1. Every ticked box has its "Done when" evidence under `verification/bubble-upgrades/`.
  2. `git diff <start> -- bin/test-bubble-pop bin/test-bubbles-visibility` is empty and both tests pass.
  3. Specials never trigger the transmission pass: the shell material is non-transmissive, special meshes hide when empty, and standard mesh visibility counts standard bubbles only.
  4. The special emitter, renderer and tracker tick allocate nothing per frame (no `new`, object or array literals, closures or `.clone()` on per-frame paths).
  5. Progress and the tracker are built at module evaluation, and nothing was added to the title-tap path or `Sound.init`.
  6. `rg -n -i "mushroom|wook|trip|star power" README.md index.html` and the hint and toast strings show nothing a player sees before the Mushroom unlock.
  7. Charm changes only the bubble term in `crowd.js`, caps at 1.4, ignores toggles, and the Worker's `CHARM_ALLOWANCE` has a passing test.
  8. Corrupt or blocked localStorage can't throw during boot, and lifetime-smile saves are debounced.
  9. `bin/check-importmaps` passes, and the CHANGELOG, ROADMAP, README, DEBUGGING and ARCHITECTURE edits match what shipped.
  10. `npm run check` passes.

  Save the findings to `verification/bubble-upgrades/review.md` in the format of [`verification/nut-wagon/adversarial-review.md`](verification/nut-wagon/adversarial-review.md): ranked most severe first, each with `file:line`, the failure scenario, and its likelihood and impact. Add each must-fix finding to this checklist as a new unchecked task.
  **Done when:** `review.md` exists and every must-fix finding has a task here.
- [ ] **6.5 Gary gate E.** Hand over the final review packet. Commit only when Gary asks.
  **Done when:** Gary approves.

## 7. Review packets

**Gate A (Heart look):**

- The lineup at Noon and Midnight.
- The Heart stream at chase distance on Low and High.
- A close-up of one heart bubble and one heart pop.
- The sandbox URLs used.

**Gate B (the slice):**

- A short sequence of stills: Lurleen found toast, unlock burst, upgrade toast, the stream a minute later, the menu with Heart earned, the menu at phone width.
- `npm run check` output.
- Console output from the Low and High smoke tests.
- Draws before and after.

**Gate C (looks):**

- The full lineup at Noon and Midnight.
- One chase-distance stream screenshot per type in the batch.
- Any type the agent thinks is weak, flagged as such.

**Gate D (Worker):**

- The `CHARM_ALLOWANCE` diff, the passing `test:board` output, and the exact deploy command.

**Gate E (final):**

- The Section 6.1 performance table.
- The task 6.4 review (`verification/bubble-upgrades/review.md`).
- The docs diff.
- Every unchecked box in this plan, with a reason.

## 8. Agent prompts

**Checkpoints 0-2 (Sonnet for 0-1, Opus for 2):**

> Read `BUBBLE-UPGRADES-PLAN.md` in full, then `CLAUDE.md` and the rules files it lists in task 0.1. Execute Checkpoints 0 through 2 in order, ticking each box only when its "Done when" evidence exists. Follow Section 5 (Guardrails) strictly, and stop at Gary gate A with the Section 7 packet. Don't commit.

**Checkpoint 3 (Opus):**

> Gary approved the Heart look in `BUBBLE-UPGRADES-PLAN.md` gate A. Execute Checkpoint 3. Heart must unlock through the real Lurleen trigger, not a debug call. Respect the boot-order and iOS-audio guardrails in Section 5. Stop at gate B with the Section 7 packet. Don't commit.

**Checkpoints 4-6 (Sonnet, escalate as Section 5 says):**

> Gary approved the Heart slice (gate B in `BUBBLE-UPGRADES-PLAN.md`). Execute Checkpoint 4 one type at a time in the listed order, batching look approvals as gate C describes, then Checkpoints 5 and 6. Never run `wrangler deploy`, since that's Gary's step at gate D. Don't commit until Gary asks.

## 9. Later waves and parked ideas

These were considered on 2026-10-15 and left out of the first wave. Move them to `ROADMAP.md` in task 6.2.

- **Ready to build on the same pipeline:**
  - **Gold Star:** hit a ×4 combo; Festival Run only, because combos are stakes-only ([`scoring.js:42-44`](src/scoring.js:42)).
  - **Carpool:** give 10 passengers a ride.
  - **Sunset:** be at a stage as the sun goes down.
  - **Shooting Star:** catch the falling star; a secret type, since star power is discovery content.
- **Behavior types that need more than a look:**
  - **Mega:** a rare oversized bubble with a crowd-wide pop.
  - **Cluster:** stuck-together bubbles that drift apart.
- **Blocked on content that doesn't exist yet:**
  - **Disco:** there's no dance tent or electronic stage.
  - **Flower/Petal:** there's no garden.
  - **Peace:** needs quests.
  - **Lightning:** there's no weather.
- **Systems:**
  - A **Quests** tab in the Bubble Upgrades menu once the passenger-quest system ships ([`ROADMAP.md:824`](ROADMAP.md:824)), with quests able to reference bubble types.
  - The **bubble-variety juice costs** idea at [`ROADMAP.md:820`](ROADMAP.md:820).
  - **Pop sounds for Music and Brass**, if Gary likes them after a listen.

## 10. Defaults Gary can override

The plan proceeds with these unless Gary says otherwise.

- The menu doesn't pause the game (D11 (menu doesn't pause)).
- The menu header shows "Bubble charm +N%." The alternative is to keep the bonus invisible.
- Rainbow needs 8 hubs, and Smile needs 1,000 lifetime smiles. Task 4.4 records real driving time to inform the hub count.
- The hint, toast and earned-line copy in Section 3 is a draft.
- The how-to page doesn't mention upgrades. The menu's title-card button is the discovery path.
- No pop sounds in v1 beyond the unlock arpeggio.

## 11. Verified anchors

Each anchor was checked at `b215b8d` on 2026-10-15. Recheck before editing.

| Anchor | What's there |
|---|---|
| [`src/bubbles.js:11`](src/bubbles.js:11) | `SPAWN_PER_SEC = 40` |
| [`src/bubbles.js:50`](src/bubbles.js:50) | Standard bubble geometry, `IcosahedronGeometry(0.11, 1)` |
| [`src/bubbles.js:196-198`](src/bubbles.js:196) | `setCheapMaterial` fancy and cheap swap |
| [`src/bubbles.js:203-230`](src/bubbles.js:203) | `update`: juice drain, rate formula, spawn loop |
| [`src/bubbles.js:315-322`](src/bubbles.js:315) | Standard mesh `count` and `visible` from live standard bubbles |
| [`src/bubbles.js:400`](src/bubbles.js:400) | Standard size range, 0.7-2.0 |
| [`src/bubbles.js:444-449`](src/bubbles.js:444) | `forEachAlive` |
| [`src/crowd.js:71-74`](src/crowd.js:71) | `BUBBLE_RANGE`, `HAPPINESS_THRESHOLD`, smile cooldowns |
| [`src/crowd.js:1486-1495`](src/crowd.js:1486) | Happiness gain from eye contact and bubbles |
| [`src/main.js:177`](src/main.js:177) | Main `camera` |
| [`src/main.js:273`](src/main.js:273) | `Trip.onAccept` handler (wook accept only, [`trip.js:278-286`](src/trip.js:278)) |
| [`src/main.js:367-369`](src/main.js:367) | `new Bubbles()` and `scene.add(bubbles.mesh)` |
| [`src/main.js:388`](src/main.js:388) | `fireworks.onBurst` wiring |
| [`src/main.js:949`](src/main.js:949) | `Input.consumePressed('V')` key pattern |
| [`src/main.js:1001-1002`](src/main.js:1001) | `bubbles.update` and `fireworks.update` |
| [`src/main.js:1024-1029`](src/main.js:1024) | Festival Run day-up branch |
| [`src/main.js:1073`](src/main.js:1073) | `Scoring.collect(_collectedThisFrame)` (organic pickups) |
| [`src/main.js:1099-1107`](src/main.js:1099) | Lurleen following flag and the one-shot found toast |
| [`src/main.js:1858`](src/main.js:1858), [`src/main.js:2590`](src/main.js:2590) | `window.__dbg` and its `help()` |
| [`src/fireworks.js:34`](src/fireworks.js:34), [`src/fireworks.js:363-366`](src/fireworks.js:363) | `FINALE_NIGHT` and the once-per-night finale latch |
| [`src/trip.js:382`](src/trip.js:382) | `Trip.isActive()` |
| [`src/obstacles.js:155-158`](src/obstacles.js:155), [`src/obstacles.js:276-281`](src/obstacles.js:276) | Parade and band collider positions |
| [`src/chunks.js:1960`](src/chunks.js:1960), [`src/chunks.js:2838`](src/chunks.js:2838) | One `stage_front` per stage (tent and main/side) |
| [`src/forests.js:605`](src/forests.js:605), [`src/chunks.js:2514`](src/chunks.js:2514) | Drum circle markers: v2 `bench_ring`, v1 `drum_circle` |
| [`src/lakes.js:931`](src/lakes.js:931) | `isPointInLake` (indexed by the October audit fix) |
| [`src/worldgen/hearts.js:58-77`](src/worldgen/hearts.js:58), [`src/worldgen/constants.js:17-23`](src/worldgen/constants.js:17) | `nearestHeart` and the heart cell and core radii |
| [`src/registry.js:22-23`](src/registry.js:22) | `entries` and `byKind` |
| [`src/settings.js:44-46`](src/settings.js:44), [`src/settings.js:84`](src/settings.js:84), [`src/settings.js:174-183`](src/settings.js:174) | Safe localStorage helpers, gear creation, overlay wiring |
| [`src/hud.js:536`](src/hud.js:536) | `HUD.toast(msg, ms, opts)` replaces the current toast |
| [`src/analytics.js:118`](src/analytics.js:118), [`src/analytics.js:185`](src/analytics.js:185), [`src/analytics.js:239`](src/analytics.js:239) | `lurleenFound`, `featureUsed`, `sessionEnd` |
| [`src/scoring.js:42-44`](src/scoring.js:42) | Combos exist only with stakes on |
| [`src/timeOfDay.js:19`](src/timeOfDay.js:19) | `CYCLE_SECONDS = 360` (a full day is six minutes) |
| [`workers/leaderboard/worker.js:51-58`](workers/leaderboard/worker.js:51) | `ceilingFor` |
| [`bin/node-three-shim.mjs`](bin/node-three-shim.mjs) | No `ShaderMaterial`, `UniformsLib`, `Shape` or `ExtrudeGeometry` stubs yet |
| [`index.html:90`](index.html:90), [`sandbox.html:183`](sandbox.html:183), [`hub-sandbox.html:42`](hub-sandbox.html:42) | `mods` importmap arrays |
