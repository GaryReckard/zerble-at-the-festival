// Festival porta-potty — blue/blue-grey box, light-grey domed roof, a door that
// swings open on a hinge, a vacant/occupied indicator, a vent that glows faintly
// at night ("light inside"), and a set of green stink lines that puff out when the
// door opens on an exit. Caller positions/rotates the group; the door faces local
// +Z so a placed unit's door faces world (sin yaw, cos yaw).
//
// The unit carries no Light object — the night glow is pure emissive (cheap, and
// bloom catches it). Per-unit animated bits (vent emissive, indicator color, stink
// opacity) get their OWN materials so each unit animates independently; everything
// static is pooled + tagged userData.shared so chunk-unload disposal skips it.
//
// Build returns the pieces a caller wires into a state object via createPottyState;
// updatePortaPotty(state, dt, t, nightness) drives the per-frame visuals. The door
// TARGET and occupied flag are set by the crowd AI (crowd.js); this file only
// renders whatever state it's handed.

import * as THREE from 'three';

// How far the door swings open, in radians (~112°).
export const DOOR_OPEN_ANGLE = 1.95;
// How long the stink puff lingers after an exit.
export const STINK_DUR = 1.7;

// ---- Pooled geometry (shared across every unit) ----
const _GEO = {
  body:     new THREE.BoxGeometry(1.1, 2.25, 1.1),
  base:     new THREE.BoxGeometry(1.18, 0.14, 1.18),
  roof:     new THREE.BoxGeometry(1.24, 0.16, 1.24),
  roofCap:  new THREE.BoxGeometry(0.7, 0.12, 1.0),
  door:     new THREE.BoxGeometry(0.62, 1.85, 0.06),
  doorway:  new THREE.BoxGeometry(0.66, 1.9, 0.04),   // dark recess behind the door
  handle:   new THREE.BoxGeometry(0.05, 0.16, 0.07),
  indicator:new THREE.BoxGeometry(0.07, 0.07, 0.03),
  ventGlow: new THREE.BoxGeometry(0.34, 0.22, 0.03),  // emissive panel (night "light")
  ventSlat: new THREE.BoxGeometry(0.36, 0.02, 0.05),  // dark louvre in front of the glow
  corner:   new THREE.CylinderGeometry(0.05, 0.05, 2.25, 6),  // edge posts
  stink:    new THREE.PlaneGeometry(0.2, 0.5),
};
for (const g of Object.values(_GEO)) g.userData.shared = true;

// ---- Pooled non-animated materials ----
const _matCache = new Map();
function matFor(hex, opts = {}) {
  const key = `${hex.toString(16)}|${opts.roughness ?? 0.6}|${opts.metalness ?? 0}`;
  let m = _matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: hex,
      roughness: opts.roughness ?? 0.6,
      metalness: opts.metalness ?? 0,
      flatShading: true,
    });
    m.userData.shared = true;
    _matCache.set(key, m);
  }
  return m;
}

// Body color buckets — festival blue + a couple of blue-greys so a bank reads
// with slight variety rather than five identical units. Door is a hair darker.
const _BODY_COLORS = [0x2f86d6, 0x2f86d6, 0x3a91dd, 0x5a7f9a, 0x6f93ad];
const ROOF_MAT  = matFor(0xdfe4e8, { roughness: 0.55 });   // light grey
const CAP_MAT   = matFor(0xeef2f5, { roughness: 0.5 });    // near-white ridge
const BASE_MAT  = matFor(0x16181c, { roughness: 0.8 });    // dark skirt
const DARK_MAT  = matFor(0x10131a, { roughness: 0.9 });    // doorway recess + slats
const HANDLE_MAT= matFor(0x3a3f47, { roughness: 0.4, metalness: 0.4 });
const TRIM_MAT  = matFor(0xeef2f5, { roughness: 0.5 });    // light edge posts

function doorMatFor(bodyHex) {
  return matFor(_darken(bodyHex, 0.82), { roughness: 0.55 });
}
function _darken(hex, f) {
  const r = ((hex >> 16) & 0xff) * f;
  const g = ((hex >> 8) & 0xff) * f;
  const b = (hex & 0xff) * f;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

export function buildPortaPotty(rng = Math.random) {
  const group = new THREE.Group();
  group.name = 'portaPotty';

  const bodyHex = _BODY_COLORS[Math.floor(rng() * _BODY_COLORS.length)];
  const bodyMat = matFor(bodyHex, { roughness: 0.58 });

  // Base skirt
  const base = new THREE.Mesh(_GEO.base, BASE_MAT);
  base.position.y = 0.07;
  group.add(base);

  // Body — the one shadow caster (large, reads as a distinct shape on the ground).
  const body = new THREE.Mesh(_GEO.body, bodyMat);
  body.position.y = 0.14 + 2.25 / 2;   // sits on the base
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Light edge posts at the four vertical corners (the reference unit has them).
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const post = new THREE.Mesh(_GEO.corner, TRIM_MAT);
    post.position.set(sx * 0.55, body.position.y, sz * 0.55);
    group.add(post);
  }

  // Roof — light grey slab + a near-white raised ridge to imply the dome.
  const roofY = 0.14 + 2.25 + 0.08;
  const roof = new THREE.Mesh(_GEO.roof, ROOF_MAT);
  roof.position.y = roofY;
  roof.castShadow = true;
  group.add(roof);
  const cap = new THREE.Mesh(_GEO.roofCap, CAP_MAT);
  cap.position.set(0, roofY + 0.12, -0.05);
  group.add(cap);

  // Vent on the upper front — an emissive glow panel (per-unit material so it can
  // ramp with nightness independently) behind a few dark louvres. Visible head-on
  // so the "light inside" reads from the approach side even with the door shut.
  const ventMat = new THREE.MeshStandardMaterial({
    color: 0xfff0cf, emissive: 0xffe6b0, emissiveIntensity: 0.05,
    roughness: 0.5, flatShading: true,
  });
  const vent = new THREE.Mesh(_GEO.ventGlow, ventMat);
  vent.position.set(-0.26, 0.14 + 2.25 - 0.28, 0.555);
  group.add(vent);
  for (let i = 0; i < 3; i++) {
    const slat = new THREE.Mesh(_GEO.ventSlat, DARK_MAT);
    slat.position.set(-0.26, vent.position.y + 0.06 - i * 0.06, 0.575);
    group.add(slat);
  }
  // A second emissive panel inside the doorway so an OPEN door glows at night too.
  const interior = new THREE.Mesh(_GEO.ventGlow, ventMat);
  interior.position.set(0.0, 1.3, 0.30);
  interior.rotation.y = Math.PI;
  group.add(interior);

  // Dark doorway recess (seen when the door swings open).
  const doorway = new THREE.Mesh(_GEO.doorway, DARK_MAT);
  doorway.position.set(0, 1.105, 0.52);
  group.add(doorway);

  // ---- Door on a hinge ----
  // Pivot sits at the door's RIGHT vertical edge (body x=+0.31, front z=+0.56).
  // The panel is a child offset to the left so the free edge swings out front
  // when the pivot rotates +DOOR_OPEN_ANGLE about Y.
  const doorPivot = new THREE.Group();
  doorPivot.position.set(0.31, 1.105, 0.56);
  group.add(doorPivot);

  const door = new THREE.Mesh(_GEO.door, doorMatFor(bodyHex));
  door.position.set(-0.31, 0, 0);   // panel center at body x=0 when closed
  door.castShadow = true;
  doorPivot.add(door);

  // Handle near the free (left) edge.
  const handle = new THREE.Mesh(_GEO.handle, HANDLE_MAT);
  handle.position.set(-0.55, -0.05, 0.05);
  doorPivot.add(handle);

  // Vacant/occupied indicator (per-unit material — green vacant, red occupied).
  const indicatorMat = new THREE.MeshStandardMaterial({
    color: 0x44dd66, emissive: 0x2a9c46, emissiveIntensity: 0.6,
    roughness: 0.4, flatShading: true,
  });
  const indicator = new THREE.Mesh(_GEO.indicator, indicatorMat);
  indicator.position.set(-0.55, 0.18, 0.05);
  doorPivot.add(indicator);

  // ---- Stink lines (hidden until an exit) ----
  // A few wispy green planes just outside the door, billboarded loosely toward
  // +Z. Each gets its own transparent material so opacity animates per-unit; the
  // group is invisible (zero draw) when idle.
  const stinkGroup = new THREE.Group();
  stinkGroup.position.set(0, 0, 0.78);
  stinkGroup.visible = false;
  const stinkParts = [];
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xbfe06a, transparent: true, opacity: 0,   // sickly yellow-green
      depthWrite: false, side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(_GEO.stink, mat);
    const baseX = (i - 1) * 0.26;
    const baseY = 0.7 + (i % 2) * 0.2;
    m.position.set(baseX, baseY, 0);
    m.rotation.z = (rng() - 0.5) * 0.6;   // slight lean so they don't read as flat cards
    stinkGroup.add(m);
    stinkParts.push({ mesh: m, mat, baseX, baseY, phase: rng() * Math.PI * 2 });
  }
  group.add(stinkGroup);

  return {
    group,
    doorPivot,
    doorSign: 1,
    ventMat,
    indicatorMat,
    stink: { group: stinkGroup, parts: stinkParts },
    footprint: 0.95,
    color: bodyHex,
  };
}

// Build the mutable state object the per-frame updater + crowd AI read/write.
// Caller fills outX/outZ (the world-space door-outward direction) after placement.
export function createPottyState(built) {
  return {
    obj: built.group,
    doorPivot: built.doorPivot,
    doorSign: built.doorSign,
    ventMat: built.ventMat,
    indicatorMat: built.indicatorMat,
    stink: built.stink,
    phase: Math.random() * Math.PI * 2,

    doorOpen: 0,        // current 0..1 (lerps toward doorTarget)
    doorTarget: 0,      // 0 closed, 1 open — set by crowd AI
    occupied: false,
    occupantId: null,
    locked: false,      // did the occupant lock it? (drives the "surprise" path)
    stinkTimer: 0,
    noiseCd: 0,         // throttle for the comedic poop noise (main.js)
    wob: 0,             // eased 0..1 in-use wobble amount

    outX: 0,
    outZ: 1,
  };
}

const _RED = new THREE.Color(0xff4436);
const _GREEN = new THREE.Color(0x44dd66);

// Per-frame visual update. `t` is seconds (performance.now()*0.001), nightness 0..1.
export function updatePortaPotty(p, dt, t, nightness) {
  // Door swing — ease toward the target the crowd AI set.
  p.doorOpen += (p.doorTarget - p.doorOpen) * Math.min(1, dt * 8);
  if (p.doorPivot) p.doorPivot.rotation.y = p.doorOpen * DOOR_OPEN_ANGLE * p.doorSign;

  // Night vent glow — off by day (nightness²), faint warm flicker by night, a
  // touch brighter when someone's inside with the "light on." No Light object.
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

  // In-use wobble — the unit rocks slightly while occupied + shut. Applied on the
  // x/z tilt axes only so it composes with the placement yaw (rotation.y).
  const wantWob = (p.occupied && p.doorOpen < 0.5) ? 1 : 0;
  p.wob += (wantWob - p.wob) * Math.min(1, dt * 4);
  if (p.obj && p.wob > 0.001) {
    const amp = 0.02 * p.wob;
    p.obj.rotation.x = Math.sin(t * 7 + p.phase) * amp;
    p.obj.rotation.z = Math.cos(t * 9 + p.phase * 1.7) * amp;
  } else if (p.obj && (p.obj.rotation.x !== 0 || p.obj.rotation.z !== 0)) {
    p.obj.rotation.x = 0;
    p.obj.rotation.z = 0;
  }

  // Stink puff — rises, sways, fades over STINK_DUR after an exit opens the door.
  if (p.stinkTimer > 0) {
    p.stinkTimer -= dt;
    const k = Math.max(0, Math.min(1, p.stinkTimer / STINK_DUR)); // 1 → 0
    const age = 1 - k;                                            // 0 → 1
    p.stink.group.visible = true;
    for (const s of p.stink.parts) {
      s.mesh.position.y = s.baseY + age * 1.0;
      s.mesh.position.x = s.baseX + Math.sin(t * 5 + s.phase) * 0.14;
      s.mat.opacity = Math.sin(k * Math.PI) * 0.42;   // soft puff — fade in then out
      // Stretch taller than wide as it rises so it reads as a wisp, not a card.
      s.mesh.scale.set(0.8 - age * 0.25, 0.7 + age * 1.1, 1);
    }
  } else if (p.stink.group.visible) {
    p.stink.group.visible = false;
  }
}
