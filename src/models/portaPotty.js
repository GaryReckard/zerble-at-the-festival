// Festival porta-potty — festival-blue / blue-grey body, light-grey domed roof,
// a door on a real hinge, a vacant/occupied indicator, a side vent that glows
// faintly at night, and squiggly green stink lines that puff out on an exit.
//
// The body is a HOLLOW shell (merged into one geometry, one draw call) with a
// real doorway opening, so when the door swings open you see INSIDE — a grey
// floor + a molded toilet with a dark seat (visible only while the door's open,
// so closed units pay nothing for it). An NPC caught mid-business by an opened
// unlocked door is rendered seated on that toilet (crowd.js handles the pose).
//
// No Light object — the night glow is pure emissive (bloom catches it). Static
// parts are pooled + tagged userData.shared; only the per-unit animated bits
// (vent emissive, indicator color, stink opacity) get their own materials.
//
// Sized at ~2× a person so it reads as a real structure you drive around.

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

// ---- Public tuning (imported by chunks.js + crowd.js so sizes stay in sync) ----
export const DOOR_OPEN_ANGLE = 1.7;   // ~97° — door swings clear of the front approach
export const STINK_DUR = 1.7;         // stink puff lifetime (s)
export const POTTY_FOOTPRINT = 1.3;   // NPC-avoidance radius
export const POTTY_COLLIDER_R = 1.0;  // hard-collider radius
export const POTTY_SPACING = 2.5;     // unit-to-unit spacing in a bank (units are 2.2 wide)
export const POTTY_DOOR_STAND = 2.4;  // how far out from centre an NPC waits at the door
export const POTTY_SEAT_BACK = 0.6;   // toilet sits this far behind centre (along -door-out)
export const POTTY_SEAT_Y = 0.92;     // toilet seat world height (NPC sits here)

// ---- Dimensions (final size — no group.scale; built explicitly) ----
const W = 2.2, D = 2.2, HALF_W = W / 2, HALF_D = D / 2;
const T = 0.12;                 // wall thickness
const BASE_TOP = 0.28;
const WALL_TOP = 4.0;
const WALL_H = WALL_TOP - BASE_TOP;
const WALL_CY = (BASE_TOP + WALL_TOP) / 2;
const DOOR_W = 1.42, DOOR_HALF = DOOR_W / 2;
const DOOR_TOP = 3.5;
const DOOR_H = DOOR_TOP - BASE_TOP;
const DOOR_CY = (BASE_TOP + DOOR_TOP) / 2;
const FRONT_Z = HALF_D - T / 2;   // front-frame plane

// ---- Merged hollow shell (back + sides + ceiling + front frame), one geometry ----
function buildShellGeo() {
  const parts = [];
  const box = (w, h, d, x, y, z) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    parts.push(g);
  };
  box(W, WALL_H, T, 0, WALL_CY, -HALF_D + T / 2);                 // back
  box(T, WALL_H, D, -HALF_W + T / 2, WALL_CY, 0);                 // left
  box(T, WALL_H, D, HALF_W - T / 2, WALL_CY, 0);                  // right
  box(W, T, D, 0, WALL_TOP - T / 2, 0);                           // ceiling
  const jambW = HALF_W - DOOR_HALF;                               // front frame
  box(jambW, WALL_H, T, -(DOOR_HALF + jambW / 2), WALL_CY, FRONT_Z);   // left jamb
  box(jambW, WALL_H, T, DOOR_HALF + jambW / 2, WALL_CY, FRONT_Z);      // right jamb
  box(DOOR_W, WALL_TOP - DOOR_TOP, T, 0, (DOOR_TOP + WALL_TOP) / 2, FRONT_Z); // lintel
  box(DOOR_W, 0.14, T, 0, BASE_TOP + 0.07, FRONT_Z);              // threshold
  const merged = BufferGeometryUtils.mergeGeometries(parts);
  for (const g of parts) g.dispose();
  merged.userData.shared = true;
  return merged;
}

const _GEO = {
  shell:     buildShellGeo(),
  base:      new THREE.BoxGeometry(W + 0.06, BASE_TOP, D + 0.06),
  roof:      new THREE.BoxGeometry(W + 0.14, 0.24, D + 0.14),
  roofCap:   new THREE.BoxGeometry(0.95, 0.18, 1.45),
  door:      new THREE.BoxGeometry(DOOR_W, DOOR_H, 0.08),
  handle:    new THREE.BoxGeometry(0.07, 0.24, 0.09),
  indicator: new THREE.BoxGeometry(0.11, 0.11, 0.04),
  ventGlow:  new THREE.BoxGeometry(0.05, 0.5, 0.72),       // emissive panel on the +X side
  floor:     new THREE.BoxGeometry(W - 2 * T, 0.06, D - 2 * T),
  toiletBase:new THREE.BoxGeometry(0.82, 0.64, 0.72),
  toiletSeat:new THREE.CylinderGeometry(0.3, 0.3, 0.08, 16),
  toiletHole:new THREE.CylinderGeometry(0.19, 0.19, 0.1, 14),
  urinal:    new THREE.BoxGeometry(0.16, 0.44, 0.26),
  innerGlow: new THREE.BoxGeometry(0.6, 0.5, 0.04),         // interior wall glow (seen through open door)
};
// Vent slats: a few dark louvres merged into one geometry, sitting just proud of
// the +X face in front of the glow panel.
{
  const slats = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.BoxGeometry(0.06, 0.045, 0.74);
    g.translate(HALF_W + 0.02, 3.0 + i * 0.12, 0);
    slats.push(g);
  }
  _GEO.ventSlats = BufferGeometryUtils.mergeGeometries(slats);
  for (const g of slats) g.dispose();
}
// Squiggly stink wisp — a thin tube following a wavy vertical curve.
{
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const y = i / 10;
    pts.push(new THREE.Vector3(Math.sin(y * Math.PI * 3) * 0.07, y * 0.95, Math.cos(y * Math.PI * 2.3) * 0.04));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  _GEO.stink = new THREE.TubeGeometry(curve, 20, 0.028, 5, false);
}
for (const g of Object.values(_GEO)) g.userData.shared = true;

// ---- Pooled materials (keyed; side included so we can pool a DoubleSide body) ----
const _matCache = new Map();
function matFor(hex, opts = {}) {
  const side = opts.side ?? THREE.FrontSide;
  const key = `${hex.toString(16)}|${opts.roughness ?? 0.6}|${side}`;
  let m = _matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: hex, roughness: opts.roughness ?? 0.6, metalness: 0,
      flatShading: true, side,
    });
    m.userData.shared = true;
    _matCache.set(key, m);
  }
  return m;
}

// Festival blue + a couple of blue-greys, slight per-unit variety.
const _BODY_COLORS = [0x2f86d6, 0x2f86d6, 0x3a91dd, 0x5a7f9a, 0x6f93ad];
const ROOF_MAT  = matFor(0xdfe4e8, { roughness: 0.55 });
const CAP_MAT   = matFor(0xeef2f5, { roughness: 0.5 });
const BASE_MAT  = matFor(0x16181c, { roughness: 0.85 });
const DARK_MAT  = matFor(0x10131a, { roughness: 0.9 });
const HANDLE_MAT= matFor(0x3a3f47, { roughness: 0.4 });
const FLOOR_MAT = matFor(0xb9bcbf, { roughness: 0.9 });   // light grey interior floor
const TOILET_MAT= matFor(0x9aa0a4, { roughness: 0.8 });   // grey molded toilet
const SEAT_MAT  = matFor(0x1c2026, { roughness: 0.35 });  // dark seat

function doorMatFor(bodyHex) { return matFor(_darken(bodyHex, 0.82), { roughness: 0.55 }); }
function _darken(hex, f) {
  const r = ((hex >> 16) & 0xff) * f, g = ((hex >> 8) & 0xff) * f, b = (hex & 0xff) * f;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

export function buildPortaPotty(rng = Math.random) {
  const group = new THREE.Group();
  group.name = 'portaPotty';

  const bodyHex = _BODY_COLORS[Math.floor(rng() * _BODY_COLORS.length)];
  // DoubleSide so the hollow shell's interior walls read solid (blue) when the
  // door's open — matches a real unit's blue interior.
  const bodyMat = matFor(bodyHex, { roughness: 0.58, side: THREE.DoubleSide });

  const base = new THREE.Mesh(_GEO.base, BASE_MAT);
  base.position.y = BASE_TOP / 2;
  group.add(base);

  // The shell is the one shadow caster (large, distinct silhouette).
  const shell = new THREE.Mesh(_GEO.shell, bodyMat);
  shell.castShadow = true;
  shell.receiveShadow = true;
  group.add(shell);

  const roof = new THREE.Mesh(_GEO.roof, ROOF_MAT);
  roof.position.y = WALL_TOP + 0.12;
  roof.castShadow = true;
  group.add(roof);
  const cap = new THREE.Mesh(_GEO.roofCap, CAP_MAT);
  cap.position.set(0, WALL_TOP + 0.33, -0.08);
  group.add(cap);

  // ---- Vent on the +X side (off the door face), emissive glow behind louvres ----
  const ventMat = new THREE.MeshStandardMaterial({
    color: 0xfff0cf, emissive: 0xffe6b0, emissiveIntensity: 0.05,
    roughness: 0.5, flatShading: true,
  });
  const vent = new THREE.Mesh(_GEO.ventGlow, ventMat);
  vent.position.set(HALF_W - 0.04, 3.18, 0);
  group.add(vent);
  const slats = new THREE.Mesh(_GEO.ventSlats, DARK_MAT);
  group.add(slats);

  // ---- Door on a hinge (right edge of the opening) ----
  const doorPivot = new THREE.Group();
  doorPivot.position.set(DOOR_HALF, DOOR_CY, HALF_D);
  group.add(doorPivot);
  const door = new THREE.Mesh(_GEO.door, doorMatFor(bodyHex));
  door.position.set(-DOOR_HALF, 0, 0);   // panel centre at body x=0 when shut
  door.castShadow = true;
  doorPivot.add(door);
  const handle = new THREE.Mesh(_GEO.handle, HANDLE_MAT);
  handle.position.set(-DOOR_W + 0.22, -0.12, 0.07);
  doorPivot.add(handle);
  const indicatorMat = new THREE.MeshStandardMaterial({
    color: 0x44dd66, emissive: 0x2a9c46, emissiveIntensity: 0.6,
    roughness: 0.4, flatShading: true,
  });
  const indicator = new THREE.Mesh(_GEO.indicator, indicatorMat);
  indicator.position.set(-DOOR_W + 0.22, 0.55, 0.07);
  doorPivot.add(indicator);

  // ---- Interior (only shown while the door's open) ----
  const interior = new THREE.Group();
  interior.visible = false;
  const floor = new THREE.Mesh(_GEO.floor, FLOOR_MAT);
  floor.position.y = BASE_TOP + 0.03;
  interior.add(floor);
  const tBase = new THREE.Mesh(_GEO.toiletBase, TOILET_MAT);
  tBase.position.set(0, BASE_TOP + 0.32, -HALF_D + 0.5);
  interior.add(tBase);
  const tSeat = new THREE.Mesh(_GEO.toiletSeat, SEAT_MAT);
  tSeat.position.set(0, POTTY_SEAT_Y, -HALF_D + 0.5);
  interior.add(tSeat);
  const tHole = new THREE.Mesh(_GEO.toiletHole, DARK_MAT);
  tHole.position.set(0, POTTY_SEAT_Y - 0.02, -HALF_D + 0.5);
  interior.add(tHole);
  const urinal = new THREE.Mesh(_GEO.urinal, TOILET_MAT);
  urinal.position.set(HALF_W - T - 0.1, 1.3, 0.35);
  interior.add(urinal);
  // Interior wall glow — shares ventMat so it ramps with night; seen through the
  // open door so a lit unit reads "occupied/lit" from the front at night.
  const innerGlow = new THREE.Mesh(_GEO.innerGlow, ventMat);
  innerGlow.position.set(0, 2.7, -HALF_D + T + 0.02);
  interior.add(innerGlow);
  group.add(interior);

  // ---- Stink wisps (hidden until an exit) ----
  const stinkGroup = new THREE.Group();
  // Start near the top of the door and waft upward from there (not down at the sill).
  stinkGroup.position.set(0, DOOR_TOP - 0.6, HALF_D + 0.35);
  stinkGroup.visible = false;
  const stinkParts = [];
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xbfe06a, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(_GEO.stink, mat);
    const baseX = (i - 1) * 0.34;
    m.position.set(baseX, 0, (i % 2) * 0.12);
    m.rotation.y = (rng() - 0.5) * 1.2;
    stinkGroup.add(m);
    stinkParts.push({ mesh: m, mat, baseX, phase: rng() * Math.PI * 2 });
  }
  group.add(stinkGroup);

  return {
    group, doorPivot, doorSign: 1,
    ventMat, indicatorMat,
    interior,
    stink: { group: stinkGroup, parts: stinkParts },
    footprint: POTTY_FOOTPRINT,
    color: bodyHex,
  };
}

export function createPottyState(built) {
  return {
    obj: built.group,
    doorPivot: built.doorPivot,
    doorSign: built.doorSign,
    ventMat: built.ventMat,
    indicatorMat: built.indicatorMat,
    interior: built.interior,
    stink: built.stink,
    phase: Math.random() * Math.PI * 2,

    doorOpen: 0, doorTarget: 0,
    occupied: false, occupantId: null, locked: false,
    stinkTimer: 0, noiseCd: 0, wob: 0,
    outX: 0, outZ: 1,
  };
}

const _RED = new THREE.Color(0xff4436);
const _GREEN = new THREE.Color(0x44dd66);

export function updatePortaPotty(p, dt, t, nightness) {
  // Door swing toward the crowd-AI-set target.
  p.doorOpen += (p.doorTarget - p.doorOpen) * Math.min(1, dt * 8);
  if (p.doorPivot) p.doorPivot.rotation.y = p.doorOpen * DOOR_OPEN_ANGLE * p.doorSign;

  // Interior only renders when the door's actually open (closed units pay nothing).
  if (p.interior) p.interior.visible = p.doorOpen > 0.08;

  // Night vent glow — off by day (nightness²), faint warm flicker by night.
  if (p.ventMat) {
    const glow = nightness * nightness;
    const flick = 0.92 + 0.08 * Math.sin(t * 3 + p.phase);
    p.ventMat.emissiveIntensity = (0.04 + 0.85 * glow) * (p.occupied ? 1.4 : 1.0) * flick;
  }

  // Indicator — red while occupied + shut, green otherwise.
  if (p.indicatorMat) {
    const wantRed = p.occupied && p.doorOpen < 0.5;
    p.indicatorMat.color.lerp(wantRed ? _RED : _GREEN, Math.min(1, dt * 10));
    p.indicatorMat.emissive.copy(p.indicatorMat.color);
  }

  // In-use wobble — rocks slightly while occupied + shut (x/z tilt only, so it
  // composes with the placement yaw on rotation.y).
  const wantWob = (p.occupied && p.doorOpen < 0.5) ? 1 : 0;
  p.wob += (wantWob - p.wob) * Math.min(1, dt * 4);
  if (p.obj && p.wob > 0.001) {
    const amp = 0.018 * p.wob;
    p.obj.rotation.x = Math.sin(t * 7 + p.phase) * amp;
    p.obj.rotation.z = Math.cos(t * 9 + p.phase * 1.7) * amp;
  } else if (p.obj && (p.obj.rotation.x !== 0 || p.obj.rotation.z !== 0)) {
    p.obj.rotation.x = 0;
    p.obj.rotation.z = 0;
  }

  // Stink puff — squiggly wisps rise, sway, and fade over STINK_DUR.
  if (p.stinkTimer > 0) {
    p.stinkTimer -= dt;
    const k = Math.max(0, Math.min(1, p.stinkTimer / STINK_DUR)); // 1 → 0
    const age = 1 - k;                                            // 0 → 1
    p.stink.group.visible = true;
    for (const s of p.stink.parts) {
      s.mesh.position.y = age * 1.6;   // waft up + out the top
      s.mesh.position.x = s.baseX + Math.sin(t * 4 + s.phase) * 0.12;
      s.mesh.rotation.y += dt * 1.5;          // slow twist so the squiggle drifts
      s.mat.opacity = Math.sin(k * Math.PI) * 0.5;
      s.mesh.scale.set(1, 0.8 + age * 0.8, 1);
    }
  } else if (p.stink.group.visible) {
    p.stink.group.visible = false;
  }
}
