// Device performance profile. Detected once at boot from cheap signals
// (touch, screen size, hardware concurrency, deviceMemory). Everything that
// has a knob — renderer pixel ratio, post-processing, shadow map, crowd
// density, chunk draw distance — reads from PERF instead of hardcoding.
//
// Override at runtime for testing: `window.__perfProfile = 'low'; location.reload()`.

function lsGet(key) {
  try { return (typeof localStorage !== 'undefined') ? localStorage.getItem(key) : null; }
  catch (e) { return null; }
}

// The override the player (or a URL flag) has pinned, if any — wins over
// hardware detection. Precedence: runtime window flag > ?perf= URL > the
// persisted Settings choice (localStorage). Returns null for "Auto" (no
// override), in which case rawDetect() decides.
function resolveOverride() {
  const forced = (typeof window !== 'undefined' && window.__perfProfile) ||
                 (typeof location !== 'undefined' && new URLSearchParams(location.search).get('perf')) ||
                 lsGet('zerble.perfOverride');
  return (forced === 'low' || forced === 'mid' || forced === 'high') ? forced : null;
}

// Pure hardware detection — what the device WOULD get with no override. Kept
// separate from the override so the Settings panel can show "Auto · detected:
// Low" truthfully even while a manual tier is pinned.
function rawDetect() {
  const isTouch =
    (typeof window !== 'undefined') &&
    (('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0));

  // Hardware signals (not all browsers expose these).
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4; // GB; iOS Safari doesn't expose this — left at default
  const smallScreen = Math.min(window.innerWidth, window.innerHeight) < 700;

  // Touch + small screen = phone. Treat as low-end by default; iPhones lie
  // about deviceMemory so we can't trust it on iOS.
  if (isTouch && smallScreen) return 'low';
  // Touch + big screen = tablet → also 'low'. iPads booted 'mid' and ran
  // laggy: this engine is draw-bound (B0 profiling: ~3.7k median / 9.2k peak
  // draws vs a 400 budget), and the mid→low delta that actually cuts draws is
  // density — chunkLoadRadius 2→1 + crowdMax 320→180 — NOT the fill-rate knobs
  // (pixel ratio, bloom) that AdaptiveQuality sheds. So a tablet that boots
  // 'mid' can never recover into a smooth frame by ramping down; only a lower
  // START does it. AdaptiveQuality still runs on top of 'low' to shed further
  // (pixel-50 / cheap-bubs) for the weaker tablet tail. Capable iPad Pros lose
  // little: the festival carries its look on emissive + bloom, so shadows-off
  // barely reads and crowd 180 vs 320 is imperceptible at radius-1 view range.
  if (isTouch) return 'low';
  // Anemic desktop (cheap laptops, old machines).
  if (cores <= 2 || mem <= 2) return 'mid';
  return 'high';
}

// Raw hardware tier (ignores any override) — exported for the Settings panel's
// "detected:" label. The effective profile applies the override on top.
export const DETECTED_TIER = rawDetect();
const profile = resolveOverride() || DETECTED_TIER;

// v2 worldgen flag — the procedural-map-generator → live-3D wire-in. Resolved
// ONCE here at module load (read once per chunk downstream, never per placement
// point). DEFAULT is the line below: it stays FALSE (legacy world ships) while v2
// was built incrementally; it now ships as the default (landed 2026-06-16). The
// production deploy real players see is the v2 procedural festival. Override
// either way at runtime: `?worldgen=1` forces v2 on, `?worldgen=0` forces the
// legacy v1 world (kept as an escape hatch for now; slated for removal).
const DEFAULT_WORLDGEN_V2 = true;
export const USE_WORLDGEN_V2 = (() => {
  if (typeof location === 'undefined') return DEFAULT_WORLDGEN_V2;   // headless self-test
  const v = new URLSearchParams(location.search).get('worldgen');
  return v === '1' ? true : v === '0' ? false : DEFAULT_WORLDGEN_V2;
})();

const TABLE = {
  low: {
    name: 'low',
    pixelRatioCap: 1.25,
    bloom: true,
    bloomStrength: 0.35,    // softer than desktop (was 0.6)
    bloomRadius: 0.7,
    bloomThreshold: 0.85,
    shadows: false,
    shadowType: 'basic',
    crowdMax: 180,
    chunkLoadRadius: 1,
    chunkUnloadRadius: 2,
    // Forest tree count multiplier. Trees doubled in size (2026-06-01), so
    // each one fills more screen — fill-rate, not draw count, is what hurts
    // integrated GPUs. Trim the count 30% on low; the bigger crowns fill the
    // gaps so the woods still read dense. mid/high keep the full count.
    forestTreeDensityMul: 0.7,
    // Bubble pool — small on low so transmission shader cost stays bounded.
    bubblePoolMax: 200,
    // Firework spark pool (additive instanced, one draw call). Smaller bursts
    // on low so a finale barrage doesn't blow the tri budget.
    fireworksPoolMax: 280,
  },
  mid: {
    name: 'mid',
    pixelRatioCap: 1.5,
    bloom: true,
    bloomStrength: 0.5,
    bloomRadius: 0.8,
    bloomThreshold: 0.8,
    shadows: true,
    shadowType: 'basic',
    crowdMax: 320,
    chunkLoadRadius: 2,
    chunkUnloadRadius: 3,
    forestTreeDensityMul: 1.0,
    bubblePoolMax: 350,
    fireworksPoolMax: 550,
  },
  high: {
    name: 'high',
    pixelRatioCap: 2,
    bloom: true,
    bloomStrength: 0.6,
    bloomRadius: 0.85,
    bloomThreshold: 0.78,
    shadows: true,
    shadowType: 'soft',
    crowdMax: 500,
    chunkLoadRadius: 2,
    chunkUnloadRadius: 3,
    forestTreeDensityMul: 1.0,
    // Roomy enough that blast mode is visibly denser than ambient — the
    // old 200 cap was already saturated at normal play, so G had no
    // visible effect even though the spawn rate doubled.
    bubblePoolMax: 600,
    fireworksPoolMax: 1000,
  },
};

export const PERF = TABLE[profile];

// Player shadow override (Settings → "Shadows & lights"; reload to apply). This
// is a BOOT setting because shadows can't be reconstructed live: the sun light's
// castShadow + shadow map + every material's shadow sampling are wired at boot
// from PERF.shadows (world.js sun, main.js renderer, the per-tier material swap).
// 'on' forces it on, 'off' forces it off, absent = tier default. The matching
// runtime piece is the governor's per-effect pin (AdaptiveQuality shadows
// override, set at boot from the same value) so a pinned-on shadow is never
// auto-dropped under load.
const _sh = lsGet('zerble.gfx.shadows');
if (_sh === 'on') PERF.shadows = true;
else if (_sh === 'off') PERF.shadows = false;

// Optional lighting upgrades — both off by default at every tier. The
// per-fragment cost of additional dynamic lights is significant on most
// GPUs (a single Sugar Shack with all-on is 3 cluster lights + 20 per-bulb
// lights = 23, and that's before tiki torches, drum circles, etc.). Users
// opt in via the backtick debug menu; preference persists in localStorage
// and is picked up at boot.
//
//   contextLights = proxy PointLight per cluster (campsite firepit, drum
//                   circle, Sugar Shack interior + spots). Off → emissive +
//                   bloom carry the visual.
//   fancyLights   = real PointLight on every torch / bulb / fixture, on top
//                   of contextLights. Light count can balloon fast.
function lsBool(key) {
  try {
    return (typeof localStorage !== 'undefined') && localStorage.getItem(key) === '1';
  } catch (e) {
    return false;
  }
}
PERF.contextLights = lsBool('zerble.contextLights');
PERF.fancyLights   = lsBool('zerble.fancyLights');

if (typeof console !== 'undefined') {
  console.info('[perf] profile =', PERF.name, PERF);
}
