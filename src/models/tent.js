// Vendor / craft tent — 4 legs, white pyramid roof, and an interior arranged
// into one or more table "slots" (each filled with a product spread) plus a
// shopkeeper standing the booth. Roof is always white per the festival
// aesthetic; trim band + cloth color + slot arrangement + per-table product
// spread + shopkeeper outfit all vary per-tent so a row of tents reads as a
// real market lineup instead of clones.
//
// Returns a THREE.Group anchored at (0,0,0), opening facing +Z.

import * as THREE from 'three';
import { VENDOR_ROOF_SHAPE } from '../festivalShapes.js';
import { buildSimpleNPC } from './puppet.js';
import { mergeStaticDecor } from '../mergeDecor.js';

// Vendor canopies carry the festival color from a distance, while table cloth
// stays a softer related shade so the merchandise remains easy to read.
const TENT_PALETTES = [
  { roof: 0xe87859, cloth: 0xf2c0a7 }, // coral
  { roof: 0x4f9b69, cloth: 0xb8d59a }, // leaf green
  { roof: 0x4f7faf, cloth: 0xaac9dc }, // blue
  { roof: 0xc39437, cloth: 0xe6ce8a }, // marigold
  { roof: 0x9165a5, cloth: 0xd0b3d8 }, // violet
  { roof: 0x369b91, cloth: 0x9dd1bd }, // teal
];
const TRIM_COLORS  = [0xff6f9c, 0x6fcf6a, 0xffd28a, 0xb285ff, 0x66d9ff, 0xff8a5b];

// ----- Shared resources --------------------------------------------------
// Each vendor row chunk spawns 10–14 tents; before pooling, every tent
// re-allocated identical leg / roof / trim / table geometry and a fresh
// material. Pool by topology + color-key per .claude/rules/perf-pooling.md
// so a row of tents shares draw-batchable resources. All entries are tagged
// userData.shared = true so chunk-unload disposal walks skip them.
const _LEG_GEO  = new THREE.BoxGeometry(0.15, 2.5, 0.15);   _LEG_GEO.userData.shared = true;
const _ROOF_GEO = new THREE.ConeGeometry(VENDOR_ROOF_SHAPE.radius, VENDOR_ROOF_SHAPE.height, 4); _ROOF_GEO.userData.shared = true;
const _TRIM_GEO = new THREE.BoxGeometry(4.5, 0.18, 4.5);    _TRIM_GEO.userData.shared = true;

const _LEG_MAT = new THREE.MeshStandardMaterial({
  color: 0x3a2e22, roughness: 0.8, flatShading: true,
});
_LEG_MAT.userData.shared = true;
const _ROOF_MATS = new Map();
function _roofMat(hex) {
  let m = _ROOF_MATS.get(hex);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.85, flatShading: true });
    m.userData.shared = true;
    _ROOF_MATS.set(hex, m);
  }
  return m;
}

const _BULB_GEO = new THREE.SphereGeometry(.095, 6, 4);
const _BULB_MAT = new THREE.MeshBasicMaterial({color:0xffdc90});
const _BED_GEO = new THREE.BoxGeometry(1.75, .22, .65);
const _BED_MAT = new THREE.MeshStandardMaterial({color:0x586d80, roughness:1});
for (const resource of [_BULB_GEO, _BULB_MAT, _BED_GEO, _BED_MAT]) resource.userData.shared = true;

// Table geometry + cloth/trim material pools — keyed for reuse.
const _TABLE_GEOS = new Map(); // 'lengthxdepth' → BoxGeometry
function _tableGeo(length, depth) {
  const k = `${length}x${depth}`;
  let g = _TABLE_GEOS.get(k);
  if (!g) {
    g = new THREE.BoxGeometry(length, 0.1, depth);
    g.userData.shared = true;
    _TABLE_GEOS.set(k, g);
  }
  return g;
}
const _CLOTH_MATS = new Map(); // colorHex → material
function _clothMat(hex) {
  let m = _CLOTH_MATS.get(hex);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: hex, roughness: 0.9, flatShading: true,
    });
    m.userData.shared = true;
    _CLOTH_MATS.set(hex, m);
  }
  return m;
}
const _TRIM_MATS = new Map();
function _trimMat(hex) {
  let m = _TRIM_MATS.get(hex);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: hex, roughness: 0.85, flatShading: true,
    });
    m.userData.shared = true;
    _TRIM_MATS.set(hex, m);
  }
  return m;
}

// Shopkeeper palette — earthy/warm, vendor-coded (think apron-cooks +
// crafter types). Skin tones from the same set used by the sugar shack
// cook so the festival reads as one population.
const SHOPKEEPER_SHIRTS = [
  0xc63a2a, 0x3a72c2, 0xe09818, 0x6b513a,
  0x5a7e3a, 0x2a4b6e, 0xa53a7a, 0x3a8b73,
];
const SHOPKEEPER_SKINS  = [0xe6c098, 0xc09478, 0x8b6f50, 0xf2d4b2];

// Merchants sell recognizable crafts, not just differently colored piles.
// Keep the list stable: it is part of the tent-local seeded visual vocabulary.
const LEGACY_PRODUCT_LAYOUTS = ['pottery', 'hats', 'jars', 'paintings', 'boxes', 'plants'];
const PRODUCT_LAYOUTS = [
  'pottery', 'hats', 'jars', 'paintings', 'boxes', 'plants',
  'textiles', 'instruments', 'lanterns', 'carvings',
];
export const TENT_VENDOR_PROFILES = Object.freeze([
  { id: 'pottery', layouts: ['pottery', 'carvings'] },
  { id: 'textiles', layouts: ['textiles', 'hats'] },
  { id: 'instruments', layouts: ['instruments', 'carvings'] },
  { id: 'lanterns', layouts: ['lanterns', 'paintings'] },
  { id: 'plants', layouts: ['plants', 'pottery'] },
  { id: 'jars', layouts: ['jars', 'boxes'] },
  { id: 'paintings', layouts: ['paintings', 'textiles'] },
].map((profile) => Object.freeze({ ...profile, layouts: Object.freeze(profile.layouts) })));

// Table slots, local to the tent canopy. Tent footprint is 4.5x4.5 with
// legs at corners (±2, ±2); the opening faces +Z, the back wall is -Z.
// Side slots are slightly shorter than the back to leave room for the
// front opening.
const SLOT_BACK   = { length: 3.0, depth: 0.8, x: 0,    z: -1.4, yaw: 0 };
const SLOT_LEFT   = { length: 2.6, depth: 0.8, x: -1.4, z: 0,    yaw: -Math.PI / 2 };
const SLOT_RIGHT  = { length: 2.6, depth: 0.8, x: 1.4,  z: 0,    yaw:  Math.PI / 2 };
const SLOT_CENTER = { length: 3.0, depth: 1.2, x: 0,    z: 0,    yaw: 0 };

// Booth arrangements, weighted random. The U-shape (back + both sides) is
// the most common per Gary's note — it's the "lived-in market stall" shape.
// L-shapes are the next most common; single-back and single-center keep the
// original variety so a row of tents still feels mixed.
const BOOTH_LAYOUTS = [
  { name: 'u',       weight: 5, slots: [SLOT_BACK, SLOT_LEFT, SLOT_RIGHT] },
  { name: 'l_left',  weight: 2, slots: [SLOT_BACK, SLOT_LEFT] },
  { name: 'l_right', weight: 2, slots: [SLOT_BACK, SLOT_RIGHT] },
  { name: 'back',    weight: 2, slots: [SLOT_BACK] },
  { name: 'center',  weight: 2, slots: [SLOT_CENTER] },
];
const _BOOTH_TOTAL = BOOTH_LAYOUTS.reduce((s, b) => s + b.weight, 0);

function pickBooth(rng) {
  let r = rng() * _BOOTH_TOTAL;
  for (const b of BOOTH_LAYOUTS) {
    if (r < b.weight) return b;
    r -= b.weight;
  }
  return BOOTH_LAYOUTS[0];
}

export function buildTent(callerRng = Math.random, options = {}) {
  // The historical one-argument path retains its original RNG draw order and
  // six merchandise categories. World callers opt into an isolated stream for
  // the expanded vendor profiles, so their shared chunk RNG is untouched.
  const rng = callerRng;
  const merchandiseRng = options.rng || callerRng;
  const legacyMerch = !options.rng && !options.profile;
  const g = new THREE.Group();

  // One cloth color per tent — every table in this booth shares it so the
  // booth reads as a single vendor's space rather than an improvised pile.
  const palette = TENT_PALETTES[Math.floor(rng() * TENT_PALETTES.length)];
  const baseColor = palette.cloth;

  // ----- Legs -----
  for (const [lx, lz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
    const leg = new THREE.Mesh(_LEG_GEO, _LEG_MAT);
    leg.position.set(lx, 1.25, lz);
    g.add(leg);
  }

  // ----- Roof — palette-colored festival canvas; jitter avoids clones.
  const roof = new THREE.Mesh(_ROOF_GEO, _roofMat(palette.roof));
  roof.position.y = VENDOR_ROOF_SHAPE.centerY;
  roof.rotation.y = Math.PI / 4 + (rng() - 0.5) * 0.06;
  roof.castShadow = true;
  g.add(roof);

  // ----- Trim band — saturated festival color, vendor-personality cue.
  const trimColor = TRIM_COLORS[Math.floor(rng() * TRIM_COLORS.length)];
  const trim = new THREE.Mesh(_TRIM_GEO, _trimMat(trimColor));
  trim.position.y = 2.55;
  g.add(trim);

  // ----- Booth interior — a vendor specialty gives each stall a recognizable
  // trade, with occasional complementary goods to keep the displays varied.
  const booth = pickBooth(rng);
  let profile = null;
  if (!legacyMerch) {
    profile = options.profile
      ? TENT_VENDOR_PROFILES.find((candidate) => candidate.id === options.profile)
      : TENT_VENDOR_PROFILES[Math.floor(merchandiseRng() * TENT_VENDOR_PROFILES.length)];
    if (!profile) throw new RangeError(`Unknown tent vendor profile: ${options.profile}`);
  }
  for (let slotIndex = 0; slotIndex < booth.slots.length; slotIndex++) {
    const slot = booth.slots[slotIndex];
    // New merchandise uses a local seed, while a compact draw-only mirror
    // advances the caller exactly as the former six layouts did. Shopkeeper
    // and later world-generation rolls therefore retain their old stream.
    if (options.rng) consumeLegacyTableDraws(rng);
    g.add(buildTableSlot(merchandiseRng, slot, baseColor, profile, legacyMerch, slotIndex === 0));
  }
  g.userData.vendorProfile = profile ? profile.id : 'legacy';

  // ----- Shopkeeper — minds the booth. 70% inside (behind tables, facing
  // out the tent opening), 30% out front (loitering, facing back in).
  const shopkeeper = buildShopkeeper(rng);
  placeShopkeeper(shopkeeper, booth.name, rng);
  shopkeeper.userData.noMerge = true;   // animated/skinned — keep out of the static merge
  g.add(shopkeeper);

  // Collapse the static decor (legs, roof, trim, tables, goods) into merged
  // meshes — the booth's ~40 draws → ~2 + emissive art + the shopkeeper.
  if (options.merge !== false) mergeStaticDecor(g);

  // Only the booth owns these clones; pooled materials remain untouched.
  const materials = [];
  for (const mesh of g.children) {
    if (!mesh.isMesh || !mesh.material?.emissive || mesh.material.transparent) continue;
    const mat = mesh.material.clone();
    mat.userData.shared = false;
    mat.emissive.setHex(0xffb351);
    mat.emissiveIntensity = 0;
    // Light the display height and preserve each product's baked color;
    // the roof must not turn into an enormous glowing lantern.
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = 'varying float vDisplayHeight;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>', '#include <begin_vertex>\n vDisplayHeight = position.y;');
      shader.fragmentShader = 'varying float vDisplayHeight;\n' + shader.fragmentShader.replace(
        '#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= diffuseColor.rgb * smoothstep(0.3, 0.8, vDisplayHeight) * (1.0 - smoothstep(2.1, 2.5, vDisplayHeight));');
    };
    mat.customProgramCacheKey = () => 'vendor-display-v1';
    mesh.material = mat;
    materials.push(mat);
  }
  const lights = new THREE.InstancedMesh(_BULB_GEO, _BULB_MAT, 3);
  const transform = new THREE.Matrix4();
  for (let i = 0; i < 3; i++) lights.setMatrixAt(i, transform.makeTranslation((i - 1) * 1.4, 2.3, .6));
  lights.instanceMatrix.needsUpdate = true;
  lights.userData.noMerge = true;
  lights.visible = false;
  g.add(lights);
  const bed = new THREE.Mesh(_BED_GEO, _BED_MAT);
  bed.position.set(0, .13, .8);
  bed.visible = false;
  g.add(bed);
  g.userData.evening = {vendor:shopkeeper, home:shopkeeper.position.clone(),
    yaw:shopkeeper.rotation.y, lights, bed, materials};
  return g;
}

// t=0 is dawn and .75 is midnight, matching TimeOfDay rather than wall time.
export function updateTent(tent, t, nightness) {
  const state = tent.userData.evening;
  if (!state) return;
  const sleeping = t >= .75 || t < .04;
  const closing = t >= .735 && t < .75 ? (t - .735) / .015 : 0;
  const glow = !sleeping && t > .43 ? nightness * (1 - closing) : 0;
  state.lights.visible = glow > .02;
  for (const material of state.materials) material.emissiveIntensity = glow * .45;
  state.bed.visible = sleeping;
  const vendor = state.vendor;
  vendor.rotation.x = 0;
  vendor.rotation.z = sleeping ? Math.PI / 2 : 0;
  vendor.rotation.y = sleeping ? Math.PI / 2 : state.yaw;
  if (sleeping) vendor.position.set(.7, .28, .8);
  else vendor.position.set(state.home.x * (1 - closing), state.home.y,
    state.home.z + (.8 - state.home.z) * closing);
}

function consumeLegacyTableDraws(rng) {
  const layouts = LEGACY_PRODUCT_LAYOUTS;
  const key = layouts[Math.floor(rng() * layouts.length)];
  if (key === 'pottery') {
    const count = 4 + Math.floor(rng() * 3);
    for (let i = 0; i < count; i++) {
      rng();                 // tall/short choice
      rng();                 // radius
      rng();                 // height jitter exists in both ternary branches
      rng();                 // hslMat color
      rng();                 // position z jitter
    }
  } else if (key === 'hats') {
    const count = 5 + Math.floor(rng() * 3);
    for (let i = 0; i < count; i++) {
      const stacked = rng() < 0.4;
      const stack = stacked ? 2 + Math.floor(rng() * 2) : 1;
      for (let s = 0; s < stack; s++) {
        rng();               // hslMat color
        rng();               // brim position z jitter
      }
    }
  } else if (key === 'jars') {
    const count = 7 + Math.floor(rng() * 4);
    for (let i = 0; i < count; i++) { rng(); rng(); }
  } else if (key === 'paintings') {
    const count = 3 + Math.floor(rng() * 2);
    for (let i = 0; i < count; i++) { rng(); rng(); rng(); rng(); rng(); }
  } else if (key === 'boxes') {
    const count = 5 + Math.floor(rng() * 4);
    for (let i = 0; i < count; i++) {
      const boxes = rng() < 0.35 ? 2 : 1;
      for (let s = 0; s < boxes; s++) { rng(); rng(); rng(); rng(); rng(); rng(); rng(); }
    }
  } else if (key === 'plants') {
    const tiers = 2 + Math.floor(rng() * 2);
    for (let t = 0; t < tiers; t++) {
      const count = 3 + Math.floor(rng() * 2);
      for (let i = 0; i < count; i++) { rng(); rng(); }
    }
  }
}

// ----- Slot + layout helpers --------------------------------------------

// Build a tablecloth-covered table at a given slot, with a product spread
// rolled from PRODUCT_LAYOUTS. Returns a group rooted at the tent's origin
// (the group itself is positioned/rotated to land in the slot).
function buildTableSlot(rng, slot, baseColor, profile, legacyMerch, isPrimarySlot) {
  const group = new THREE.Group();
  group.position.set(slot.x, 0, slot.z);
  group.rotation.y = slot.yaw;

  const table = new THREE.Mesh(_tableGeo(slot.length, slot.depth), _clothMat(baseColor));
  table.position.set(0, 1.0, 0);
  table.castShadow = true;
  table.receiveShadow = true;
  group.add(table);

  const merchandise = new THREE.Group();
  merchandise.userData.vendorMerchandise = true;
  const layoutKey = legacyMerch
    ? LEGACY_PRODUCT_LAYOUTS[Math.floor(rng() * LEGACY_PRODUCT_LAYOUTS.length)]
    : isPrimarySlot
      ? profile.layouts[0]
    : rng() < 0.72
      ? profile.layouts[Math.floor(rng() * profile.layouts.length)]
      : PRODUCT_LAYOUTS[Math.floor(rng() * PRODUCT_LAYOUTS.length)];
  merchandise.userData.vendorLayout = layoutKey;
  merchandise.userData.primaryDisplay = !!profile && isPrimarySlot;
  fillProducts(layoutKey, merchandise, rng, slot.length, slot.depth, !legacyMerch);
  group.add(merchandise);
  return group;
}

function fillProducts(key, g, rng, length, depth, matteArt = false) {
  switch (key) {
    case 'pottery':   layoutPottery(g, rng, length, depth); break;
    case 'hats':      layoutHats(g, rng, length, depth); break;
    case 'jars':      layoutJars(g, rng, length, depth); break;
    case 'paintings': layoutPaintings(g, rng, length, depth, matteArt); break;
    case 'boxes':     layoutBoxes(g, rng, length, depth); break;
    case 'plants':    layoutPlantStand(g, rng, length, depth); break;
    case 'textiles':  layoutTextiles(g, rng, length, depth); break;
    case 'instruments': layoutInstruments(g, rng, length, depth); break;
    case 'lanterns':  layoutLanterns(g, rng, length, depth); break;
    case 'carvings':  layoutCarvings(g, rng, length, depth); break;
  }
}

function hslMat(rng, sat = 0.7, light = 0.55) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(rng(), sat, light),
    roughness: 0.7, flatShading: true,
  });
}

// Each layout fills a table of `length` along local X, `depth` along local
// Z, with products above the table top (y >= 1.05). z-jitter scales with
// depth so the narrow side tables don't overshoot their cloth.

function layoutPottery(g, rng, length, depth) {
  const count = 4 + Math.floor(rng() * 3);
  const xa = -length / 2 + 0.25;
  const xb =  length / 2 - 0.25;
  const xs = spread(count, xa, xb);
  const zJit = depth * 0.20;
  for (let i = 0; i < count; i++) {
    const tall = rng() < 0.6;
    const r = 0.16 + rng() * 0.10;
    const h = tall ? (0.55 + rng() * 0.35) : (0.30 + rng() * 0.15);
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.85, r, h, 12),
      hslMat(rng, 0.4, 0.5),
    );
    pot.position.set(xs[i], 1.05 + h / 2, (rng() - 0.5) * zJit);
    g.add(pot);
  }
}

function layoutHats(g, rng, length, depth) {
  const count = 5 + Math.floor(rng() * 3);
  const xa = -length / 2 + 0.25;
  const xb =  length / 2 - 0.25;
  const xs = spread(count, xa, xb);
  const zJit = depth * 0.15;
  for (let i = 0; i < count; i++) {
    const stack = rng() < 0.4 ? 2 + Math.floor(rng() * 2) : 1;
    for (let s = 0; s < stack; s++) {
      const brim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.04, 14),
        hslMat(rng, 0.5, 0.55),
      );
      brim.position.set(xs[i], 1.06 + s * 0.10, (rng() - 0.5) * zJit);
      g.add(brim);
      const crown = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 0.12, 12),
        brim.material,
      );
      crown.position.copy(brim.position);
      crown.position.y += 0.07;
      g.add(crown);
    }
  }
}

function layoutJars(g, rng, length, depth) {
  const count = 7 + Math.floor(rng() * 4);
  const xa = -length / 2 + 0.20;
  const xb =  length / 2 - 0.20;
  const xs = spread(count, xa, xb);
  const zRow = depth * 0.18;
  for (let i = 0; i < count; i++) {
    const jar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.10, 0.10, 0.30, 10),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(rng(), 0.55, 0.45),
        roughness: 0.3, metalness: 0.2,
        transparent: true, opacity: 0.85,
      }),
    );
    const z = (i % 2 === 0 ? -zRow : zRow) + (rng() - 0.5) * 0.06;
    jar.position.set(xs[i], 1.20, z);
    g.add(jar);
    const lid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.105, 0.105, 0.04, 10),
      new THREE.MeshStandardMaterial({
        color: 0xcfcfcf, roughness: 0.4, metalness: 0.6,
      }),
    );
    lid.position.copy(jar.position);
    lid.position.y += 0.17;
    g.add(lid);
  }
}

function layoutPaintings(g, rng, length, depth, matteArt = false) {
  const count = 3 + Math.floor(rng() * 2);
  const xa = -length / 2 + 0.3;
  const xb =  length / 2 - 0.3;
  const xs = spread(count, xa, xb);
  const backZ = -depth / 2 + 0.15;   // hugging the back edge of the table
  for (let i = 0; i < count; i++) {
    const w = 0.55 + rng() * 0.25;
    const h = 0.5 + rng() * 0.35;
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, 0.04),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(rng(), 0.6, 0.45),
        roughness: 0.7, flatShading: true,
      }),
    );
    frame.position.set(xs[i], 1.05 + h / 2, backZ);
    frame.rotation.x = -0.18;
    g.add(frame);
    const art = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.82, h * 0.82, 0.01),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(rng(), 0.7, 0.6),
        emissive: new THREE.Color().setHSL(rng(), 0.5, 0.4),
        // Ordinary painted artwork can join the booth's static batch.
        emissiveIntensity: matteArt ? 0 : 0.25,
      }),
    );
    art.position.copy(frame.position);
    art.position.z += 0.025;
    art.rotation.x = frame.rotation.x;
    g.add(art);
  }
}

function layoutBoxes(g, rng, length, depth) {
  const count = 5 + Math.floor(rng() * 4);
  const xa = -length / 2 + 0.25;
  const xb =  length / 2 - 0.25;
  const xs = spread(count, xa, xb);
  const zJit = depth * 0.22;
  for (let i = 0; i < count; i++) {
    const stacked = rng() < 0.35;
    for (let s = 0; s < (stacked ? 2 : 1); s++) {
      const bw = 0.22 + rng() * 0.22;
      const bh = 0.18 + rng() * 0.20;
      const bd = 0.22 + rng() * 0.18;
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(bw, bh, bd),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(rng(), 0.7, 0.55),
          roughness: 0.7, flatShading: true,
        }),
      );
      box.position.set(
        xs[i] + (rng() - 0.5) * 0.08,
        1.05 + bh / 2 + s * (bh + 0.04),
        (rng() - 0.5) * zJit,
      );
      box.rotation.y = (rng() - 0.5) * 0.5;
      g.add(box);
    }
  }
}

function layoutPlantStand(g, rng, length, depth) {
  const tiers = 2 + Math.floor(rng() * 2);
  const xa = -length / 2 + 0.3;
  const xb =  length / 2 - 0.3;
  const zRow = depth * 0.18;
  for (let t = 0; t < tiers; t++) {
    const shelfY = 1.05 + t * 0.30;
    const count = 3 + Math.floor(rng() * 2);
    const xs = spread(count, xa, xb);
    for (let i = 0; i < count; i++) {
      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.10, 0.16, 10),
        new THREE.MeshStandardMaterial({
          color: 0x8b5a2b, roughness: 0.85, flatShading: true,
        }),
      );
      pot.position.set(xs[i], shelfY + 0.08, t === 0 ? -zRow : zRow);
      g.add(pot);
      const leaves = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.16 + rng() * 0.05, 0),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(0.28 + (rng() - 0.5) * 0.06, 0.55, 0.45),
          roughness: 0.85, flatShading: true,
        }),
      );
      leaves.position.copy(pot.position);
      leaves.position.y += 0.22;
      g.add(leaves);
    }
  }
}

// Rolled rugs and folded fabric create a low, broad silhouette that reads
// differently from the upright pottery and jar displays.
function layoutTextiles(g, rng, length, depth) {
  const count = 3 + Math.floor(rng() * 3);
  const xs = spread(count, -length / 2 + 0.28, length / 2 - 0.28);
  for (let i = 0; i < count; i++) {
    const roll = rng() < 0.45;
    const color = hslMat(rng, 0.66, 0.48);
    if (roll) {
      const rug = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.42 + rng() * 0.2, 8), color);
      rug.rotation.z = Math.PI / 2;
      rug.position.set(xs[i], 1.22, (rng() - 0.5) * depth * 0.28);
      g.add(rug);
    } else {
      const folded = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, Math.min(0.36, depth * 0.48)), color);
      folded.position.set(xs[i], 1.12 + rng() * 0.12, (rng() - 0.5) * depth * 0.22);
      folded.rotation.y = (rng() - 0.5) * 0.4;
      g.add(folded);
    }
  }
  // A small rack of hanging swatches makes the textile trade read vertically
  // in the row, where low stacks alone disappear behind the table edge.
  const rackZ = -depth * 0.22;
  for (const x of [-0.5, 0.5]) {
    const post = new THREE.Mesh(_textileRackPostGeo, _woodMat);
    post.position.set(x, 1.40, rackZ);
    g.add(post);
  }
  const bar = new THREE.Mesh(_textileRackBarGeo, _woodMat);
  bar.position.set(0, 1.72, rackZ);
  g.add(bar);
  for (const x of [-0.34, 0, 0.34]) {
    const swatch = new THREE.Mesh(_textilePanelGeo, hslMat(rng, 0.72, 0.52));
    swatch.position.set(x, 1.40, rackZ + 0.035);
    swatch.rotation.z = (rng() - 0.5) * 0.06;
    g.add(swatch);
  }
}

// Stringed instruments and hand drums give the stall a distinct music-maker
// identity while staying within the table footprint.
function layoutInstruments(g, rng, length, depth) {
  const count = 3 + Math.floor(rng() * 3);
  const xs = spread(count, -length / 2 + 0.3, length / 2 - 0.3);
  for (let i = 0; i < count; i++) {
    const z = (rng() - 0.5) * depth * 0.35;
    if (rng() < 0.62) {
      const body = new THREE.Mesh(_guitarBodyGeo, _woodMat);
      body.scale.set(0.78, 1.2, 0.45);
      body.position.set(xs[i], 1.28, z);
      const neck = new THREE.Mesh(_instrumentNeckGeo, _woodMat);
      neck.position.set(xs[i], 1.62, z);
      neck.rotation.z = (rng() - 0.5) * 0.22;
      const soundhole = new THREE.Mesh(_guitarSoundholeGeo, _soundholeMat);
      soundhole.position.set(xs[i], 1.29, z + 0.105);
      const headstock = new THREE.Mesh(_guitarHeadstockGeo, _woodMat);
      headstock.position.set(xs[i], 1.98, z);
      const strings = new THREE.Mesh(_guitarStringsGeo, _stringMat);
      strings.position.set(xs[i], 1.63, z + 0.112);
      g.add(body, neck, soundhole, headstock, strings);
    } else {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.34, 10), _woodMat);
      drum.position.set(xs[i], 1.22, z);
      const skin = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.025, 10), _drumSkinMat);
      skin.position.set(xs[i], 1.395, z);
      g.add(drum, skin);
    }
  }
}

function layoutLanterns(g, rng, length, depth) {
  const count = 3 + Math.floor(rng() * 3);
  const xs = spread(count, -length / 2 + 0.3, length / 2 - 0.3);
  for (let i = 0; i < count; i++) {
    const color = _lanternMats[Math.floor(rng() * _lanternMats.length)];
    const z = (rng() - 0.5) * depth * 0.3;
    const body = new THREE.Mesh(_lanternGeo, color);
    body.position.set(xs[i], 1.28 + rng() * 0.18, z);
    const cap = new THREE.Mesh(_lanternCapGeo, _metalMat);
    cap.position.set(xs[i], body.position.y + 0.2, z);
    g.add(body, cap);
  }
}

function layoutCarvings(g, rng, length, depth) {
  const count = 4 + Math.floor(rng() * 3);
  const xs = spread(count, -length / 2 + 0.25, length / 2 - 0.25);
  for (let i = 0; i < count; i++) {
    const size = 0.19 + rng() * 0.13;
    const carving = new THREE.Mesh(
      i % 2 ? new THREE.DodecahedronGeometry(size, 0) : new THREE.ConeGeometry(size * 0.72, size * 2, 5),
      _woodMat,
    );
    carving.position.set(xs[i], 1.08 + size, (rng() - 0.5) * depth * 0.28);
    carving.rotation.y = rng() * Math.PI;
    g.add(carving);
  }
}

const _woodMat = new THREE.MeshStandardMaterial({ color: 0x79502f, roughness: 0.84, flatShading: true });
const _drumSkinMat = new THREE.MeshStandardMaterial({ color: 0xd9bd8b, roughness: 0.9 });
const _metalMat = new THREE.MeshStandardMaterial({ color: 0x63584b, roughness: 0.55, metalness: 0.35 });
const _soundholeMat = new THREE.MeshStandardMaterial({ color: 0x2d1c13, roughness: 0.9 });
const _stringMat = new THREE.MeshStandardMaterial({ color: 0xe1d1ac, roughness: 0.5, metalness: 0.15 });
const _lanternMats = [0xe06b38, 0xe7bd58, 0x54a89a].map(color =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.65, flatShading: true })
);
const _instrumentNeckGeo = new THREE.BoxGeometry(0.09, 0.56, 0.08);
const _guitarBodyGeo = new THREE.IcosahedronGeometry(0.22, 1);
const _guitarSoundholeGeo = new THREE.SphereGeometry(0.065, 8, 6);
const _guitarHeadstockGeo = new THREE.BoxGeometry(0.16, 0.15, 0.1);
const _guitarStringsGeo = new THREE.BoxGeometry(0.018, 0.56, 0.012);
const _lanternGeo = new THREE.BoxGeometry(0.25, 0.3, 0.2);
const _lanternCapGeo = new THREE.ConeGeometry(0.19, 0.13, 4);
const _textileRackPostGeo = new THREE.BoxGeometry(0.05, 0.65, 0.05);
const _textileRackBarGeo = new THREE.BoxGeometry(1.05, 0.05, 0.05);
const _textilePanelGeo = new THREE.BoxGeometry(0.28, 0.48, 0.04);
for (const material of [_woodMat, _drumSkinMat, _metalMat, _soundholeMat, _stringMat, ..._lanternMats]) material.userData.shared = true;
for (const geometry of [
  _instrumentNeckGeo, _guitarBodyGeo, _guitarSoundholeGeo, _guitarHeadstockGeo,
  _guitarStringsGeo, _lanternGeo, _lanternCapGeo,
  _textileRackPostGeo, _textileRackBarGeo, _textilePanelGeo,
]) geometry.userData.shared = true;

function spread(count, a, b) {
  if (count === 1) return [(a + b) * 0.5];
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(a + (b - a) * (i / (count - 1)));
  }
  return out;
}

// ----- Shopkeeper -------------------------------------------------------

function buildShopkeeper(rng) {
  const shirt = SHOPKEEPER_SHIRTS[Math.floor(rng() * SHOPKEEPER_SHIRTS.length)];
  const skin  = SHOPKEEPER_SKINS[Math.floor(rng() * SHOPKEEPER_SKINS.length)];
  return buildSimpleNPC(shirt, skin);
}

// 70% inside the booth (behind tables, facing the customer at +Z), 30% out
// front (loitering on the customer side, facing back into the booth).
// Interior spot depends on the booth layout — the shopkeeper has to fit
// between whichever tables are there.
function placeShopkeeper(npc, layoutName, rng) {
  if (rng() < 0.30) {
    npc.position.set((rng() - 0.5) * 2.2, 0, 2.3 + rng() * 0.4);
    npc.rotation.y = 0;                // NPC default eyes face -Z (into booth)
    return;
  }
  let x = 0, z = -0.5;
  if (layoutName === 'u') {
    x = (rng() - 0.5) * 0.8;
    z = -0.4;
  } else if (layoutName === 'l_left') {
    x = 0.4 + (rng() - 0.5) * 0.4;     // open side is the right; shopkeeper sits center-right
    z = -0.5;
  } else if (layoutName === 'l_right') {
    x = -0.4 + (rng() - 0.5) * 0.4;
    z = -0.5;
  } else if (layoutName === 'back') {
    x = (rng() - 0.5) * 1.2;
    z = -0.7;
  } else {                              // 'center' — table fills the middle
    x = (rng() < 0.5 ? -1.2 : 1.2) + (rng() - 0.5) * 0.3;
    z = -1.0;
  }
  npc.position.set(x, 0, z);
  npc.rotation.y = Math.PI;             // face +Z (out the tent opening)
}
