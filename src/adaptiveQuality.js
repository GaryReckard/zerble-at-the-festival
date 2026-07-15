// Adaptive quality monitor. Watches frame time over a rolling window and
// downgrades render quality (pixel ratio, bloom, shadows, bubble material)
// when sustained performance drops below a threshold. Ramps back up if the
// budget recovers. Transitions surface as a HUD toast ONLY under the debug flag
// (see AQ_DEBUG below) — the message is dev jargon ("perf: cheap-bubs (~31fps)")
// and was landing center-screen in the same toast lane as player notices
// ("STAR POWER!"), which reads as a glitch to players. The live level is always
// visible in the backtick debug HUD's Render panel (getLevelName), so gating the
// toast loses nothing for devs.
//
// Design notes (perf-pass-4 update):
//   * Pixel ratio is dropped FIRST — on Retina displays (dPR 2) it's the
//     largest single GPU cost. Old order (bloom first) was backwards.
//   * Each level carries a `bubbles` property ('fancy'|'cheap') so the
//     caller can drive material switching via the `onLevelChange` hook
//     without this module knowing about bubbles.js.
//   * DROP triggers on: avg frame time > 22ms sustained, OR p95 > 33ms
//     sustained, OR two consecutive frames > 80ms (single-frame hitch).
//   * RAISE requires all three metrics to be healthy simultaneously so
//     spikes block restoration even when avg looks fine.
//   * Every transition starts a fresh observation window. A downgrade cannot
//     reuse the slow samples that justified the previous rung, and a recovery
//     cannot reuse the cheap rung's good samples to judge the restored rung.
//   * Recovery is deliberately asymmetric: hold a downgraded level for 30s,
//     then require a longer healthy run. If a raise fails within 15s, wait 2m
//     before retrying that boundary, doubling to a 5m cap on repeat failures.
//   * We tweak LIVE renderer/composer/PERF rather than reloading.
//   * Shadows use the castShadow-walk trick (not shadowMap.enabled) so
//     stale ghost shadows don't freeze on the ground.
//
// Usage from main.js (per frame):
//   AdaptiveQuality.tick(dt);

import { PERF } from './perf.js';

// Gate the transition toast behind ?debug / localStorage['zerble.debug'], same
// idiom as the [chunk slow] warnings + renderer.debug.checkShaderErrors. Read
// once at load — toggling localStorage needs a reload, as there.
const AQ_DEBUG = (() => {
  try {
    return new URLSearchParams(location.search).has('debug') || !!localStorage.getItem('zerble.debug');
  } catch (e) { return false; }
})();

const DROP_FRAME_MS   = 22;  // avg > this → drop  (~45fps)
const RAISE_FRAME_MS  = 18;  // avg < this → maybe raise  (~55fps)
const DROP_P95_MS     = 33;  // p95 > this → drop (catches sustained jitter)
const RAISE_P95_MS    = 22;  // p95 < this required before raise
const DROP_MAX_MS     = 80;  // two consecutive frames > this → immediate drop
const RAISE_MAX_MS    = 33;  // max < this required before raise
const WINDOW          = 90;  // rolling window size (~1.5s at 60fps)
const DROP_SUSTAIN_FRAMES = 60;   // consecutive bad frames to trigger
const RAISE_SUSTAIN_FRAMES = 180; // recovery is slower than degradation
const STATS_INTERVAL  = 10;  // recompute p95/max every N frames (fresh enough
                              // for trigger decisions without sorting every tick)
const RAISE_HOLD_MS = 30_000;
const FAILED_RAISE_WINDOW_MS = 15_000;
const FAILED_RAISE_BACKOFF_MS = 120_000;
const MAX_RAISE_BACKOFF_MS = 300_000;

// Each level builds on the previous. `bubbles` is a signal for the caller
// (main.js) to swap the Bubbles material; this module doesn't import bubbles.js.
// `pixelRatioMul` scales the PERF baseline ratio (set at install time).
const QUALITY_LEVELS = [
  { name: 'baseline',   pixelRatioMul: 1.0,   bubbles: 'fancy' },
  { name: 'pixel-87',   pixelRatioMul: 0.875, bubbles: 'fancy' },
  { name: 'no-bloom',   pixelRatioMul: 0.875, bubbles: 'fancy',  bloom: false },
  { name: 'pixel-75',   pixelRatioMul: 0.75,  bubbles: 'fancy',  bloom: false },
  { name: 'cheap-bubs', pixelRatioMul: 0.75,  bubbles: 'cheap',  bloom: false },
  { name: 'no-shadows', pixelRatioMul: 0.75,  bubbles: 'cheap',  bloom: false, shadows: false },
  { name: 'pixel-50',   pixelRatioMul: 0.5,   bubbles: 'cheap',  bloom: false, shadows: false },
];

const state = {
  enabled: true,
  level: 0,
  badRun: 0,
  goodRun: 0,
  frameTimes: [],
  hooks: null,
  // castShadow list saved when we killed shadows; restored on raise.
  _castersTurnedOff: null,
  // Derived frame-time stats — updated every STATS_INTERVAL frames.
  // Shared between the adaptive trigger logic and the debug HUD display.
  // Phase 1 instrumentation (perf-pass-4).
  _statsCache: { avg: 0, p95: 0, max: 0 },
  _statsTick: 0,
  // Raw wall-clock tracking — performance.now() at the previous tick.
  // Independent of dt because dt is capped at 50ms in main.js
  // (Math.min(clock.getDelta(), 0.05)); using dt would clamp p95/max.
  _lastPerfTime: 0,
  // Monotonic time accumulated from the same raw frame samples we evaluate.
  // This makes recovery holds deterministic and independent of frame rate.
  _elapsedMs: 0,
  // Consecutive-frame counter for the instant-drop hitch detector.
  _maxSpikesInRow: 0,
  // Raising quality is intentionally conservative. A normal downgrade holds
  // for RAISE_HOLD_MS; a raise that quickly fails gets exponential backoff.
  _raiseBlockedUntil: QUALITY_LEVELS.map(() => 0),
  _lastRaise: null,
  _raiseBackoffMs: QUALITY_LEVELS.map(() => FAILED_RAISE_BACKOFF_MS),
};

export function install(hooks) {
  // hooks: { renderer, scene, composer, bloomPass, hud, onLevelChange }
  state.hooks = hooks;
  state.level = 0;
  state.bloomAllowed = true;
  state._elapsedMs = 0;
  state._raiseBlockedUntil.fill(0);
  state._lastRaise = null;
  state._raiseBackoffMs.fill(FAILED_RAISE_BACKOFF_MS);
  state._castersTurnedOff = null;
  _resetObservationWindow();
  // Cache the baseline pixel ratio so we can scale it instead of clobbering.
  state.basePixelRatio = hooks.renderer.getPixelRatio();
}

export function setEnabled(v) {
  const next = !!v;
  if (next && !state.enabled) _resetObservationWindow();
  state.enabled = next;
}

export function tick(dt) {
  if (!state.enabled || !state.hooks) return;

  // Wall-clock delta — raw, unclamped. dt from main.js is capped at 50ms
  // so we don't use it for frame-time measurement.
  const now = performance.now();
  const wallMs = state._lastPerfTime > 0 ? now - state._lastPerfTime : dt * 1000;
  state._lastPerfTime = now;
  state._elapsedMs += wallMs;

  // A recovered level that survives its probation is no longer considered a
  // failed raise if performance degrades later because the scene changed.
  if (state._lastRaise && state._elapsedMs - state._lastRaise.atMs > FAILED_RAISE_WINDOW_MS) {
    state._raiseBackoffMs[state._lastRaise.fromLevel] = FAILED_RAISE_BACKOFF_MS;
    state._lastRaise = null;
  }

  state.frameTimes.push(wallMs);
  if (state.frameTimes.length > WINDOW) state.frameTimes.shift();

  // Don't judge until the window is full — avoids whipsawing on boot spikes.
  if (state.frameTimes.length < WINDOW) return;

  // Recompute avg every frame (cheap sum), p95+max every STATS_INTERVAL
  // frames (needs a sort — still fast at 90 samples, but skip it most ticks).
  let sum = 0;
  for (const x of state.frameTimes) sum += x;
  const avg = sum / state.frameTimes.length;

  state._statsTick++;
  if (state._statsTick >= STATS_INTERVAL) {
    state._statsTick = 0;
    const sorted = state.frameTimes.slice().sort((a, b) => a - b);
    const p95Idx = Math.floor(sorted.length * 0.95);
    state._statsCache = {
      avg,
      p95: sorted[p95Idx] ?? 0,
      max: sorted[sorted.length - 1] ?? 0,
    };
  }

  const { p95, max } = state._statsCache;

  // ---- DROP logic ----
  // Three independent triggers; any one fires the bad-run counter.
  // The hitch detector is special: two consecutive worst-case frames
  // immediately apply one downgrade without waiting for SUSTAIN_FRAMES.
  const sustained_bad = avg > DROP_FRAME_MS || p95 > DROP_P95_MS;
  if (sustained_bad) {
    state.badRun++;
    state.goodRun = 0;
    if (state.badRun >= DROP_SUSTAIN_FRAMES && state.level < QUALITY_LEVELS.length - 1) {
      _dropQuality(avg);
      return;
    }
  } else {
    state.badRun = Math.max(0, state.badRun - 1);
  }

  // Instant hitch drop: two consecutive frames over DROP_MAX_MS.
  if (wallMs > DROP_MAX_MS) {
    state._maxSpikesInRow++;
    if (state._maxSpikesInRow >= 2 && state.level < QUALITY_LEVELS.length - 1) {
      _dropQuality(avg);
      return;
    }
  } else {
    state._maxSpikesInRow = 0;
  }

  // ---- RAISE logic ----
  // All three metrics must be healthy — spikes block restore even if avg looks fine.
  const all_good = avg < RAISE_FRAME_MS && p95 < RAISE_P95_MS && max < RAISE_MAX_MS;
  if (all_good) {
    state.goodRun++;
    state.badRun = 0;
    if (state.goodRun >= RAISE_SUSTAIN_FRAMES && state.level > 0 &&
        state._elapsedMs >= state._raiseBlockedUntil[state.level]) {
      _raiseQuality(avg);
    }
  } else if (!sustained_bad) {
    // Middle band — decay both counters slowly.
    state.goodRun = Math.max(0, state.goodRun - 1);
  }
}

function _dropQuality(avgMs) {
  const fromLevel = state.level;
  const toLevel = fromLevel + 1;
  const failedRaise = state._lastRaise &&
    state._lastRaise.toLevel === fromLevel &&
    state._lastRaise.fromLevel === toLevel &&
    state._elapsedMs - state._lastRaise.atMs <= FAILED_RAISE_WINDOW_MS;

  if (failedRaise) {
    state._raiseBlockedUntil[toLevel] = state._elapsedMs + state._raiseBackoffMs[toLevel];
    state._raiseBackoffMs[toLevel] = Math.min(
      state._raiseBackoffMs[toLevel] * 2,
      MAX_RAISE_BACKOFF_MS,
    );
  } else {
    state._raiseBlockedUntil[toLevel] = state._elapsedMs + RAISE_HOLD_MS;
    state._raiseBackoffMs[toLevel] = FAILED_RAISE_BACKOFF_MS;
  }
  state._lastRaise = null;
  _apply(toLevel, avgMs);
}

function _raiseQuality(avgMs) {
  const fromLevel = state.level;
  const toLevel = fromLevel - 1;
  state._lastRaise = { fromLevel, toLevel, atMs: state._elapsedMs };
  _apply(toLevel, avgMs);
}

function _resetObservationWindow() {
  state.badRun = 0;
  state.goodRun = 0;
  state.frameTimes.length = 0;
  state._statsCache = { avg: 0, p95: 0, max: 0 };
  // Recompute p95/max on the first frame after the fresh window fills instead
  // of briefly pairing the new average with an empty stats cache.
  state._statsTick = STATS_INTERVAL - 1;
  state._lastPerfTime = 0;
  state._maxSpikesInRow = 0;
}

// F1 (perf-pass-4): whether bloom is permitted by the tier AND the current
// adaptive-quality level. main.js ANDs this with an in-frame brightness check to
// produce the single `bloomPass.enabled` write each frame. Defaults to the tier
// setting before the first _apply (state.bloomAllowed undefined → not false).
// Per-effect player overrides (Settings → tri-state Off / Auto / On). `null` =
// Auto: the governor manages this effect. `true`/`false` = the player pinned it,
// so the governor leaves THIS effect alone while still managing everything else
// (pixel ratio first, plus any effect left on Auto) to defend the frame rate.
// The governor itself never stops — there's no global "off" anymore.
const overrides = { bloom: null, bubbles: null, shadows: null };
export function setOverride(key, val) {
  if (!(key in overrides)) return;
  overrides[key] = val;
  // Shadows apply live (the cast-shadow walk), so a pin takes effect immediately
  // — including re-enabling shadows the governor had already dropped. bloom /
  // bubbles are read live elsewhere (bloomAllowed / effectiveCheap), so they
  // need no poke here.
  if (key === 'shadows') _applyShadowsNow();
}
export function getOverride(key) { return key in overrides ? overrides[key] : null; }

// Glow: pinned value wins (still gated by tier capability); else the governor's
// per-level decision. main.js's per-frame tick ANDs this with the brightness
// gate and is the single owner of `bloomPass.enabled`.
export function bloomAllowed() {
  if (overrides.bloom !== null) return overrides.bloom && !!PERF.bloom;
  return !!PERF.bloom && state.bloomAllowed !== false;
}

// "Use the cheap bubble material?" for a level, honoring the override. main.js
// passes the current level's lvl object from onLevelChange; Settings reads the
// current one when the player flips the control back to Auto.
export function effectiveCheap(lvl) {
  return overrides.bubbles !== null ? !overrides.bubbles : (lvl.bubbles === 'cheap');
}
export function currentCheap() { return effectiveCheap(QUALITY_LEVELS[state.level]); }

// Shadows: pinned value wins, but still gated by the tier's shadow infrastructure
// (PERF.shadows = whether the renderer compiled shadow support at boot — you
// can't pin shadows ON live if the shadow map was never enabled). Else the
// governor's per-level decision. A pinned "On" is what stops the governor from
// auto-dropping shadows under load.
export function effectiveShadows(lvl) {
  const auto = lvl.shadows !== false && PERF.shadows;
  return overrides.shadows !== null ? (overrides.shadows && !!PERF.shadows) : auto;
}
function _applyShadowsNow() {
  const h = state.hooks;
  if (h) _setShadowsOn(h.scene, h.renderer, effectiveShadows(QUALITY_LEVELS[state.level]));
}

function _apply(newLevel, avgMs) {
  const lvl = QUALITY_LEVELS[newLevel];
  state.level = newLevel;
  const { renderer, scene, composer, bloomPass, hud } = state.hooks;

  // Bloom — F1 (perf-pass-4): AdaptiveQuality no longer writes
  // `bloomPass.enabled` directly. It records whether THIS quality level permits
  // bloom; main.js is the single per-frame owner that ANDs (tier) ∧ (this flag)
  // ∧ (something bright in frame), so the three writers can't fight. See
  // AdaptiveQuality.bloomAllowed() + the gate in main.js's tick.
  state.bloomAllowed = lvl.bloom !== false;
  // Shadows — honor a player pin (Settings → Off/Auto/On); else this level's value.
  _setShadowsOn(scene, renderer, effectiveShadows(lvl));
  // Pixel ratio — scale from the baseline captured at install time.
  const pixMul = lvl.pixelRatioMul ?? 1;
  renderer.setPixelRatio(state.basePixelRatio * pixMul);
  // Composer size must re-sync so bloom render targets track the new resolution.
  composer.setSize(window.innerWidth, window.innerHeight);

  // Toast uses wall-clock avg (avgMs here is the live avg, not clamped dt).
  const fps = avgMs > 0 ? (1000 / avgMs).toFixed(0) : '?';
  const msg = newLevel > 0
    ? `perf: ${lvl.name} (~${fps}fps)`
    : `perf: full quality (~${fps}fps)`;
  if (AQ_DEBUG) hud?.toast?.(msg, 1800);

  // Notify caller — main.js uses this to swap bubble material without
  // creating a direct dependency between this module and bubbles.js.
  // avgMs lets the caller log the frame time that triggered the change.
  state.hooks.onLevelChange?.(newLevel, lvl, avgMs);

  // The next decision must be based entirely on frames rendered at the new
  // level. Keeping the previous rung's samples is what made the old governor
  // walk effects down and back up on stale evidence.
  _resetObservationWindow();
}

// Toggle shadows in a way that doesn't leave stale ghost shadows on the
// ground.
//
// The naive approach — `renderer.shadowMap.enabled = false` — stops the
// shadow map from being re-rendered, but materials compiled with shadow
// support still SAMPLE the depth texture, which keeps its stale contents.
// Result: frozen shadows frozen exactly where they last drew, looking
// like a bug.
//
// Instead: leave `shadowMap.enabled` alone and walk every casting mesh,
// turning off `castShadow` (saving the list for restore). The next
// shadow-map render is then EMPTY, so every receive-shadow mesh samples
// a clear depth texture and reads "fully lit" — no stale shadows. Cost
// is one shadow render with no occluders (cheap) instead of skipping
// the render entirely; net perf is still much better than full shadows
// because the per-caster fill cost is gone.
function _setShadowsOn(scene, renderer, on) {
  if (on) {
    // Restore the casters we'd previously turned off. Skip any that were
    // already nulled out by other systems (defensive).
    if (state._castersTurnedOff) {
      for (const m of state._castersTurnedOff) {
        if (m && !m.castShadow) m.castShadow = true;
      }
      state._castersTurnedOff = null;
    }
    renderer.shadowMap.enabled = true;
    // Force the shadow map to re-render now that casters are back — don't wait
    // on whatever it last cached (the empty map from when they were turned off).
    renderer.shadowMap.needsUpdate = true;
  } else {
    // Collect every casting mesh + flip its flag off. Save the list so we
    // can flip them back on a future raise. Set `shadowMap.needsUpdate`
    // so the next render writes a clean empty depth texture.
    const turned = [];
    scene.traverse((o) => {
      if (o.isMesh && o.castShadow) {
        o.castShadow = false;
        turned.push(o);
      }
    });
    state._castersTurnedOff = turned;
    renderer.shadowMap.needsUpdate = true;
  }
}

export function getLevel() { return state.level; }
export function getLevelName() { return QUALITY_LEVELS[state.level].name; }
export function getLevelCount() { return QUALITY_LEVELS.length; }
export function getLevelNames() { return QUALITY_LEVELS.map(l => l.name); }

// Phase 1 instrumentation — frame-time stats for the debug HUD.
// Returns the most recently computed { avg, p95, max } (ms). Updated once
// per ~60 frames, so it lags reality slightly — good enough for display.
export function getFrameStats() { return state._statsCache; }

// ---- Debug / manual override helpers ----
// Used by the debug HUD Render panel so individual settings can be inspected
// and overridden while the auto-tuning loop is paused (setEnabled(false)).

// Force a specific quality level. Call setEnabled(false) first to keep it
// pinned; otherwise the next tick may overwrite it.
export function applyLevel(n) {
  if (n >= 0 && n < QUALITY_LEVELS.length) {
    _apply(n, state._statsCache.avg || 16);
  }
}

// Toggle shadows directly (bypasses level logic; useful for manual overrides
// while adaptive quality is paused).
export function setShadows(on) {
  if (!state.hooks) return;
  _setShadowsOn(state.hooks.scene, state.hooks.renderer, on);
}

// Read current effective state of bloom and shadows so the debug UI can
// initialise checkboxes to match reality rather than the level table.
export function getBloomEnabled() {
  const bp = state.hooks?.bloomPass;
  return bp ? bp.enabled : true;
}
export function getShadowsEnabled() {
  // _castersTurnedOff is non-null only while shadows are explicitly OFF.
  return state._castersTurnedOff === null;
}

// Baseline pixel ratio captured at install() time. Level multipliers scale
// from this value, so manual overrides should too.
export function getBasePixelRatio() {
  return state.basePixelRatio ?? 1;
}

// Set pixel ratio directly (mul relative to base). Used by the Render panel's
// pixel-ratio override. Also re-syncs the composer size.
export function setPixelRatio(mul) {
  if (!state.hooks?.renderer) return;
  state.hooks.renderer.setPixelRatio((state.basePixelRatio ?? 1) * mul);
  state.hooks.composer?.setSize(window.innerWidth, window.innerHeight);
}
