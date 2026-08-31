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

// Far-field festival horizon (festival-horizon change). Resolution is a pure
// function so bin/test-far-field can lock the truth table without faking
// `location`. EFFECTIVE enablement is `requested && USE_WORLDGEN_V2`
// (design D6 / audit V2): `?worldgen=0` is a live escape hatch to the legacy
// v1 world, and a horizon of v2 hearts drawn over the v1 world would be a
// permanent false horizon whose proxies never hand off. `?worldgen=0` with
// the horizon requested therefore resolves to a zero-allocation no-op — no
// FarField GPU resources, no shader programs, no planning work.
// Default ON since 2026-08-28 (promotion gates passed + Gary's real-device
// sign-off, Q1 in the change log); `?farField=0` stays as the one-variable
// A/B control.
const DEFAULT_FAR_FIELD = true;
export function resolveFarField(search, useWorldgenV2) {
  const v = new URLSearchParams(search || '').get('farField');
  const requested = v === '1' ? true : v === '0' ? false : DEFAULT_FAR_FIELD;
  return requested && !!useWorldgenV2;
}
export const USE_FAR_FIELD = (() => {
  if (typeof location === 'undefined') return false;   // headless: never on
  return resolveFarField(location.search, USE_WORLDGEN_V2);
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
    // Streaming may start more than one cheap chunk in a frame, but never starts
    // another after spending this long. Dense single chunks are split separately.
    chunkBudgetMs: 3,
    // Fog is fully opaque at 520m, but the shared backdrop sets the safe floor:
    // sky 900m, stars 850m, and randomized mountain vertices at <= ~1012m.
    // 1040m keeps those intact while culling retained lakes out to 1500m.
    cameraFar: 1040,
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
    // Far-field festival horizon (festival-horizon change; inert unless
    // USE_FAR_FIELD). Tier-owned radius/density/pool caps — capacities are
    // MEASURED (2026-08-28 demand run: 5 seeds x 2,615 poses, within-radius
    // candidate counts; see CHANGELOG), not design guesses. The
    // rebuild budget is NOT a knob here by design: FarField planning spends
    // only the REMAINDER of the world-owned chunkBudgetMs wall above (chunks
    // consume first — design D3); maxColdStepMs gates the largest measured
    // indivisible planning step instead.
    farField: {
      // Design D6 shipped a sparser 340m band here; the first real-device
      // field report (2026-08-28) read the unproxied 340-520m gap as missing
      // content (fog is only OPAQUE at 520m), so low now reaches the fog
      // limit like mid/high. Caps sized from the measured within-radius
      // candidate demand across 5 seeds x 2,615 poses (max: canopy 25,
      // truss 76, beacon 25 at r520; peaks/warm scale by densityMul).
      radius: 520,
      densityMul: 0.6,        // thins per-hub supporting silhouettes, never the stage anchor
      // Re-budgeted 2026-08-31 (the horizon-fidelity pass). Three shape fixes
      // moved demand: vendor rows became TWO booth lines at ~5/side (peaks up),
      // tent stages moved out of `canopy` into `peak` (canopy + truss down), and
      // FOREST_DENSITY_THRESHOLD fell 0.45 -> 0.15 so treed ground actually gets
      // a silhouette (forest up ~3x). Caps re-sized from a fresh within-radius
      // demand sweep (5 seeds x 24 poses); `forestStep` grew alongside the lower
      // threshold so a coarser grid of larger domes covers far more ground for a
      // similar instance count. Camp villages joined the layer on the same day
      // (they ride their own coarse grid outside festivalPlan, so they had no
      // silhouette at all) — they are sparse, ~4 within the radius, so they cost
      // only ~20 more peaks; peak/warm carry the usual ~15% headroom over the
      // measured maximum.
      marginalTriCap: 9700,   // worst case at full caps: 9,216 tris
      maxColdStepMs: 2,
      forestStep: 72,         // coarse forest-mass sample grid (m)
      caps: { canopy: 32, truss: 96, peak: 192, warm: 144, beacon: 32, forest: 96, roadVerts: 4096, roadIndices: 6144 },
    },
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
    chunkBudgetMs: 4,
    cameraFar: 1040,
    forestTreeDensityMul: 1.0,
    bubblePoolMax: 350,
    fireworksPoolMax: 550,
    // Provisional caps — see the low-tier farField comment.
    farField: {
      radius: 520,            // the fog-opaque limit (design D6)
      densityMul: 1.0,
      marginalTriCap: 13300,  // worst case at full caps: 13,184 tris
      maxColdStepMs: 2,
      forestStep: 56,
      // canopy/truss/beacon raised 2026-08-28: measured within-radius demand
      // (max 25 stages / 76 truss parts) exceeded the provisional 24/72 —
      // dense seeds dropped a VISIBLE stage. Sized from the same demand run
      // as low; peak/warm/forest re-sized in the 2026-08-31 fidelity pass (see
      // the low tier's note for what moved).
      caps: { canopy: 40, truss: 120, peak: 320, warm: 192, beacon: 40, forest: 176, roadVerts: 4096, roadIndices: 6144 },
    },
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
    chunkBudgetMs: 5,
    cameraFar: 1040,
    forestTreeDensityMul: 1.0,
    // Roomy enough that blast mode is visibly denser than ambient — the
    // old 200 cap was already saturated at normal play, so G had no
    // visible effect even though the spawn rate doubled.
    bubblePoolMax: 600,
    fireworksPoolMax: 1000,
    // Provisional caps — see the low-tier farField comment.
    farField: {
      radius: 520,
      densityMul: 1.0,
      marginalTriCap: 15000,  // worst case at full caps: 14,848 tris
      maxColdStepMs: 2,
      forestStep: 40,         // finest forest grid — high absorbs the tris
      caps: { canopy: 40, truss: 120, peak: 320, warm: 192, beacon: 48, forest: 256, roadVerts: 4096, roadIndices: 6144 },
    },
  },
};

export const PERF = TABLE[profile];

// Read-only per-tier far-field knobs for the hub sandbox's composition
// preview (festival-horizon task 4.1). Sandbox tier selection previews
// COMPOSITION only — real tier/threeShim/shader behavior is verified via
// actual ?perf= page reloads (design D7).
export const FAR_FIELD_TIERS = {
  low: TABLE.low.farField,
  mid: TABLE.mid.farField,
  high: TABLE.high.farField,
};

// Player shadow override (Settings → Effects). Shadows are LIVE on a tier that
// already has the shadow machinery (mid/high): the governor's per-effect pin
// (AdaptiveQuality shadows override) adds and removes them with no reload —
// adding is the symmetric inverse of the governor's own live removal.
//
// This boot flag covers ONLY the low-tier turn-on. On low the machinery ships
// off (no sun caster, no shadow map, materials compiled without shadow sampling),
// and that CAN'T be built live — it needs every material to recompile. So 'on'
// forces the machinery on at boot. 'off' / Auto never DISABLE the machinery on a
// shadow tier; they just hide shadows via the live pin, so the player can flip
// back On without a restart.
if (lsGet('zerble.gfx.shadows') === 'on') PERF.shadows = true;

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
