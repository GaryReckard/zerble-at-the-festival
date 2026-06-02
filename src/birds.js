// Birds — a global flock of small creatures that fly over the festival and
// perch in trees. Emergent behaviour layered on top of the bird model:
//
//   - Boids flocking (separation / alignment / cohesion) within a species.
//   - Per-species cruising altitude bands (sparrows low, crows high).
//   - Mate-seeking: a bird steers to the nearest same-species neighbour and
//     the pair "courts" briefly, calling (priority song — see sound.js).
//   - Landing: a bird picks a free canopy perch from the registry (the
//     `perches` data trees expose) and descends to it; perched birds fold
//     their wings.
//   - Startle: drive Zerble close + fast under a low or perched bird and it
//     bursts back into flight.
//   - Time-of-day rhythm: dawn chorus (most aloft + calling), a midday lull
//     (more perched), a dusk peak, then a night roost — perched birds tuck
//     into the crown and fade out, and the soundscape hands over to crickets
//     and frogs.
//
// Rendering is three InstancedMeshes per species (body + two wings), so the
// whole flock is ~15 draw calls regardless of count. Caps scale by perf tier.
//
// This is a world-roaming, emergent system — verify it in the running game,
// not the entity sandbox (per the sandbox-and-testing doctrine). The static
// `bird_flock` / `bird_in_tree` sandbox entries cover the *model*.

import * as THREE from 'three';
import { PERF } from './perf.js';
import { registry } from './registry.js';
import { BIRD_SPECIES, BIRD_KEYS, birdInstanceGeo, birdInstanceMaterial } from './models/bird.js';

const CAPS = { low: 14, mid: 26, high: 40 };
// Relative spawn weight per species (commons vs. rarer corvids).
const WEIGHTS = { sparrow: 3.0, finch: 2.5, dove: 1.6, jay: 1.2, crow: 0.8 };

const SPAWN_RADIUS = 130;        // birds live within this horizontal range of the player
const DESPAWN_RADIUS = 175;      // past this, a bird treadmills to the far side
const NEIGHBOR_RADIUS = 14;      // boids neighbourhood
const SEP_RADIUS = 4.5;          // separation kicks in closer than this
const PERCH_SEARCH_RADIUS = 55;  // how far a landing bird will look for a tree

// Time-of-day activity curve. t: 0=dawn, 0.25=noon, 0.5=dusk, 0.75=midnight.
// Big dawn chorus spike, a smaller dusk peak, a midday lull, ~silent at night.
function activityCurve(t, nightness) {
  if (nightness > 0.85) return 0.02;
  const dawn = Math.exp(-Math.pow((t - 0.07) / 0.05, 2));
  const dusk = Math.exp(-Math.pow((t - 0.45) / 0.06, 2));
  const middayLull = 1 - 0.5 * Math.exp(-Math.pow((t - 0.25) / 0.07, 2));
  const base = (1 - nightness) * 0.55 * middayLull;
  return Math.min(1, base + 0.95 * dawn + 0.7 * dusk);
}

function smoothstep(a, b, x) {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

// Scratch objects — reused every frame to avoid per-bird allocation.
const _sep = new THREE.Vector3();
const _ali = new THREE.Vector3();
const _coh = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _mat = new THREE.Matrix4();
const _matW = new THREE.Matrix4();
const _hinge = new THREE.Matrix4();
const _flapM = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _pos = new THREE.Vector3();
const _scl = new THREE.Vector3();
const _mirror = new THREE.Matrix4().makeScale(-1, 1, 1);

export class Birds {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'birds';
    this.max = CAPS[PERF.name] || 20;
    this.activityLevel = 0;
    this._occupied = new Set();      // "treeId:idx" perch reservations
    this._perchRescan = 0;

    // Per-species instanced meshes (body + left wing + right wing).
    this._species = {};
    const mat = birdInstanceMaterial();
    for (const key of BIRD_KEYS) {
      const geo = birdInstanceGeo(key);
      const body = new THREE.InstancedMesh(geo.body, mat, this.max);
      const wingL = new THREE.InstancedMesh(geo.wing, mat, this.max);
      const wingR = new THREE.InstancedMesh(geo.wing, mat, this.max);
      for (const im of [body, wingL, wingR]) {
        im.castShadow = false;       // small + airborne — shadows aren't worth the budget
        im.frustumCulled = false;    // we manage visibility via count
        im.count = 0;
        this.group.add(im);
      }
      this._species[key] = { geo, body, wingL, wingR, count: 0 };
    }

    this.birds = [];
    for (let i = 0; i < this.max; i++) this.birds.push(this._spawnBird(pickSpecies(), null));
  }

  // ---- spawn / placement ----

  _spawnBird(species, playerPos) {
    const sp = BIRD_SPECIES[species];
    const ang = Math.random() * Math.PI * 2;
    const r = playerPos ? (SPAWN_RADIUS * 0.85) : Math.random() * SPAWN_RADIUS;
    const cx = playerPos ? playerPos.x : 0;
    const cz = playerPos ? playerPos.z : 0;
    const y = sp.altitude[0] + Math.random() * (sp.altitude[1] - sp.altitude[0]);
    const heading = Math.random() * Math.PI * 2;
    const speed = sp.speed * (0.7 + Math.random() * 0.5);
    return {
      species,
      pos: new THREE.Vector3(cx + Math.cos(ang) * r, y, cz + Math.sin(ang) * r),
      vel: new THREE.Vector3(Math.sin(heading) * speed, 0, Math.cos(heading) * speed),
      state: 'flying',
      flapPhase: Math.random() * Math.PI * 2,
      flapHz: 4.5 + (1 - sp.size) * 3,
      bobPhase: Math.random() * Math.PI * 2,
      perch: null,
      perchUrge: Math.random() * 0.4,
      restTimer: 0,
      scale: 1,
      wantSong: 0,
      songCooldown: Math.random() * 4,
      mateTimer: 0,
    };
  }

  _relocate(bird, playerPos) {
    this._releasePerch(bird);
    const sp = BIRD_SPECIES[bird.species];
    const ang = Math.atan2(bird.pos.z - playerPos.z, bird.pos.x - playerPos.x) + Math.PI + (Math.random() - 0.5);
    bird.pos.set(
      playerPos.x + Math.cos(ang) * SPAWN_RADIUS * 0.9,
      sp.altitude[0] + Math.random() * (sp.altitude[1] - sp.altitude[0]),
      playerPos.z + Math.sin(ang) * SPAWN_RADIUS * 0.9,
    );
    const speed = sp.speed * (0.7 + Math.random() * 0.5);
    bird.vel.set((playerPos.x - bird.pos.x), 0, (playerPos.z - bird.pos.z)).setLength(speed);
    bird.state = 'flying';
    bird.scale = 1;
  }

  _releasePerch(bird) {
    if (bird.perch) {
      this._occupied.delete(`${bird.perch.treeId}:${bird.perch.idx}`);
      bird.perch = null;
    }
  }

  // Find the nearest free canopy perch within range. Bounded scan over the
  // registry's tree entries — only called when a bird actually wants to land.
  _findPerch(bird) {
    let best = null;
    let bestD = PERCH_SEARCH_RADIUS * PERCH_SEARCH_RADIUS;
    for (const kind of ['forest_tree', 'tree']) {
      const ids = registry.byKind.get(kind);
      if (!ids) continue;
      for (const id of ids) {
        const e = registry.entries.get(id);
        if (!e || !e.perches || e.perches.length === 0) continue;
        const dx = e.position.x - bird.pos.x;
        const dz = e.position.z - bird.pos.z;
        const d = dx * dx + dz * dz;
        if (d > bestD) continue;
        for (let i = 0; i < e.perches.length; i++) {
          if (this._occupied.has(`${id}:${i}`)) continue;
          best = { treeId: id, idx: i, pos: e.perches[i], crown: e.crown };
          bestD = d;
          break;
        }
      }
    }
    return best;
  }

  // ---- main update ----

  update(dt, playerPos, tod, playerSpeed = 0) {
    const t = tod ? tod.t : 0.2;
    const nightness = tod ? tod.nightness : 0;
    const activity = activityCurve(t, nightness);
    this.activityLevel = activity;
    const roostiness = smoothstep(0.4, 0.85, nightness);   // 0 day → 1 deep night

    const birds = this.birds;
    for (let i = 0; i < birds.length; i++) {
      const b = birds[i];
      const sp = BIRD_SPECIES[b.species];

      // Treadmill: keep density around the player.
      if (b.state === 'flying') {
        const dxp = b.pos.x - playerPos.x;
        const dzp = b.pos.z - playerPos.z;
        if (dxp * dxp + dzp * dzp > DESPAWN_RADIUS * DESPAWN_RADIUS) {
          this._relocate(b, playerPos);
        }
      }

      // Startle — a low/perched bird near a fast Zerble bursts away.
      if ((b.state === 'perched' || (b.state === 'flying' && b.pos.y < 5)) && playerSpeed > 8) {
        const dxp = b.pos.x - playerPos.x;
        const dzp = b.pos.z - playerPos.z;
        if (dxp * dxp + dzp * dzp < 7 * 7) {
          this._releasePerch(b);
          b.state = 'flying';
          b.scale = 1;
          _tmp.set(dxp, 0, dzp).setLength(sp.speed * 1.6);
          b.vel.copy(_tmp);
          b.vel.y = 4 + Math.random() * 2;
          b.wantSong = 0;
        }
      }

      if (b.state === 'flying') this._updateFlying(b, sp, dt, playerPos, activity, roostiness);
      else if (b.state === 'descending') this._updateDescending(b, sp, dt);
      else if (b.state === 'perched') this._updatePerched(b, sp, dt, activity, roostiness, nightness);

      // Song eagerness: builds during high activity, spikes while courting.
      b.songCooldown -= dt;
      if (b.songCooldown < 0) {
        b.wantSong = Math.max(b.wantSong, activity * (0.4 + 0.6 * Math.random()));
        if (b.mateTimer > 0) b.wantSong = 1;
        b.songCooldown = 2.5 + Math.random() * 4;
      }
      b.wantSong = Math.max(0, b.wantSong - dt * 0.25);
      if (b.mateTimer > 0) b.mateTimer -= dt;

      b.flapPhase += dt * Math.PI * 2 * b.flapHz;
      b.bobPhase += dt;
    }

    this._writeInstances();
  }

  _updateFlying(b, sp, dt, playerPos, activity, roostiness) {
    // --- boids over same-species neighbours ---
    _sep.set(0, 0, 0); _ali.set(0, 0, 0); _coh.set(0, 0, 0);
    let nNeighbors = 0, nSep = 0;
    const birds = this.birds;
    for (let j = 0; j < birds.length; j++) {
      const o = birds[j];
      if (o === b || o.species !== b.species || o.state !== 'flying') continue;
      const dx = o.pos.x - b.pos.x, dy = o.pos.y - b.pos.y, dz = o.pos.z - b.pos.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > NEIGHBOR_RADIUS * NEIGHBOR_RADIUS || d2 < 1e-4) continue;
      _ali.add(o.vel); _coh.add(o.pos); nNeighbors++;
      if (d2 < SEP_RADIUS * SEP_RADIUS) {
        const inv = 1 / Math.sqrt(d2);
        _sep.x -= dx * inv; _sep.y -= dy * inv; _sep.z -= dz * inv;
        nSep++;
      }
    }
    const flock = sp.flock;
    if (nNeighbors > 0) {
      _ali.multiplyScalar(1 / nNeighbors).sub(b.vel).multiplyScalar(0.4 * flock);
      _coh.multiplyScalar(1 / nNeighbors).sub(b.pos).multiplyScalar(0.25 * flock);
      b.vel.addScaledVector(_ali, dt);
      b.vel.addScaledVector(_coh, dt);
    }
    if (nSep > 0) b.vel.addScaledVector(_sep, dt * 6);

    // --- mate-seeking: steer toward nearest same-species bird during peaks ---
    if (activity > 0.5 && b.mateTimer <= 0 && Math.random() < 0.02) {
      let mate = null, md = 1e9;
      for (let j = 0; j < birds.length; j++) {
        const o = birds[j];
        if (o === b || o.species !== b.species || o.state !== 'flying') continue;
        const d2 = b.pos.distanceToSquared(o.pos);
        if (d2 < md) { md = d2; mate = o; }
      }
      if (mate) {
        _tmp.copy(mate.pos).sub(b.pos).setLength(sp.speed);
        b.vel.lerp(_tmp, 0.5);
        if (md < 9) { b.mateTimer = 2.5; mate.mateTimer = 2.5; b.wantSong = 1; mate.wantSong = 1; }
      }
    }

    // --- altitude band: steer back toward [min,max], gentle vertical wander ---
    const [aMin, aMax] = sp.altitude;
    if (b.pos.y < aMin) b.vel.y += (aMin - b.pos.y) * 0.6 * dt + dt * 1.5;
    else if (b.pos.y > aMax) b.vel.y -= (b.pos.y - aMax) * 0.6 * dt + dt * 1.5;
    else b.vel.y += Math.sin(b.bobPhase * 0.7) * 0.4 * dt;
    b.vel.y *= 0.96;

    // --- horizontal wander + soft pull back toward the player's region ---
    b.vel.x += (Math.random() - 0.5) * sp.speed * 0.5 * dt;
    b.vel.z += (Math.random() - 0.5) * sp.speed * 0.5 * dt;
    const dxp = b.pos.x - playerPos.x, dzp = b.pos.z - playerPos.z;
    const horiz = Math.hypot(dxp, dzp);
    if (horiz > SPAWN_RADIUS) {
      b.vel.x -= (dxp / horiz) * sp.speed * dt;
      b.vel.z -= (dzp / horiz) * sp.speed * dt;
    }

    // Clamp horizontal speed to the species cruise (keep vertical separate).
    const hs = Math.hypot(b.vel.x, b.vel.z);
    const maxH = sp.speed * 1.3, minH = sp.speed * 0.45;
    if (hs > maxH) { b.vel.x *= maxH / hs; b.vel.z *= maxH / hs; }
    else if (hs < minH && hs > 1e-3) { b.vel.x *= minH / hs; b.vel.z *= minH / hs; }
    b.vel.y = THREE.MathUtils.clamp(b.vel.y, -3.5, 3.5);

    b.pos.addScaledVector(b.vel, dt);

    // --- decide whether to land ---
    b.perchUrge += dt * (0.04 + roostiness * 0.6 + (1 - Math.min(1, this.activityLevel)) * 0.08);
    if (b.perchUrge > 1 && b.mateTimer <= 0) {
      const perch = this._findPerch(b);
      if (perch) {
        b.perch = perch;
        this._occupied.add(`${perch.treeId}:${perch.idx}`);
        b.state = 'descending';
      }
      b.perchUrge = 0.2;   // back off and try again later if no perch found
    }
  }

  _updateDescending(b, sp, dt) {
    // Perch may have been torn down with its chunk — bail back to flight.
    if (!b.perch || !registry.entries.has(b.perch.treeId)) {
      this._releasePerch(b);
      b.state = 'flying';
      return;
    }
    const target = b.perch.pos;
    _tmp.set(target.x - b.pos.x, target.y - b.pos.y, target.z - b.pos.z);
    const d = _tmp.length();
    if (d < 0.4) {
      b.pos.set(target.x, target.y, target.z);
      b.state = 'perched';
      b.restTimer = 4 + Math.random() * 8;
      // Face outward from the trunk so it reads as perched on the edge.
      b.vel.set(target.x - (b.perch.crown ? b.perch.crown.x : target.x), 0,
                target.z - (b.perch.crown ? b.perch.crown.z : target.z));
      if (b.vel.lengthSq() < 1e-3) b.vel.set(0, 0, 1);
      return;
    }
    // Ease in, slowing as it arrives.
    const speed = Math.max(2.5, Math.min(sp.speed, d * 2.2));
    _tmp.setLength(speed);
    b.vel.lerp(_tmp, 0.25);
    b.pos.addScaledVector(b.vel, dt);
  }

  _updatePerched(b, sp, dt, activity, roostiness, nightness) {
    if (!b.perch || !registry.entries.has(b.perch.treeId)) {
      this._releasePerch(b);
      b.state = 'flying';
      b.scale = 1;
      return;
    }
    // Night roost: tuck toward the crown centre and fade out of view.
    if (nightness > 0.8) {
      const crown = b.perch.crown;
      if (crown) {
        b.pos.x += (crown.x - b.pos.x) * Math.min(1, dt * 1.5);
        b.pos.y += (crown.y - b.pos.y) * Math.min(1, dt * 1.5);
        b.pos.z += (crown.z - b.pos.z) * Math.min(1, dt * 1.5);
      }
      b.scale = Math.max(0, b.scale - dt * 1.2);
      return;
    }
    b.scale = Math.min(1, b.scale + dt * 2);
    b.restTimer -= dt;
    // Take off again when rested and the day is active (never mid-roost).
    if (b.restTimer <= 0 && roostiness < 0.5 && Math.random() < activity * dt * 1.5) {
      this._releasePerch(b);
      b.state = 'flying';
      b.vel.set((Math.random() - 0.5), 0.8, (Math.random() - 0.5)).setLength(sp.speed);
      b.vel.y = 2.5;
    }
  }

  // ---- instanced matrix writes ----

  _writeInstances() {
    for (const key of BIRD_KEYS) this._species[key].count = 0;

    for (let i = 0; i < this.birds.length; i++) {
      const b = this.birds[i];
      if (b.scale < 0.05) continue;          // fully roosted/faded — skip drawing
      const S = this._species[b.species];
      const idx = S.count++;
      const geo = S.geo;

      // Orient: +Z forward toward velocity (yaw + slight pitch), small bank.
      const vx = b.vel.x, vy = b.vel.y, vz = b.vel.z;
      const yaw = Math.atan2(vx, vz);
      const speed = Math.hypot(vx, vy, vz) || 1;
      const pitch = b.state === 'perched' ? 0 : -Math.asin(THREE.MathUtils.clamp(vy / speed, -1, 1)) * 0.6;
      _euler.set(pitch, yaw, 0, 'YXZ');
      _quat.setFromEuler(_euler);

      const bob = b.state === 'perched'
        ? Math.sin(b.bobPhase * 2.2) * 0.012 * geo.s
        : Math.sin(b.flapPhase) * 0.03 * geo.s;
      _pos.set(b.pos.x, b.pos.y + bob, b.pos.z);
      _scl.set(b.scale, b.scale, b.scale);
      _matW.compose(_pos, _quat, _scl);
      S.body.setMatrixAt(idx, _matW);

      // Wing flap angle (folded when perched, symmetric flap when flying).
      const flap = b.state === 'perched' ? -1.05 : (Math.sin(b.flapPhase) * 0.95 + 0.2);

      // Left wing: body * T(+wingX, wingY, 0) * Rz(flap)
      _hinge.makeTranslation(geo.wingX, geo.wingY, 0);
      _flapM.makeRotationZ(flap);
      _mat.copy(_matW).multiply(_hinge).multiply(_flapM);
      S.wingL.setMatrixAt(idx, _mat);

      // Right wing: body * T(-wingX, wingY, 0) * mirrorX * Rz(flap)
      _hinge.makeTranslation(-geo.wingX, geo.wingY, 0);
      _mat.copy(_matW).multiply(_hinge).multiply(_mirror).multiply(_flapM);
      S.wingR.setMatrixAt(idx, _mat);
    }

    for (const key of BIRD_KEYS) {
      const S = this._species[key];
      S.body.count = S.count;
      S.wingL.count = S.count;
      S.wingR.count = S.count;
      if (S.count > 0) {
        S.body.instanceMatrix.needsUpdate = true;
        S.wingL.instanceMatrix.needsUpdate = true;
        S.wingR.instanceMatrix.needsUpdate = true;
      }
    }
  }

  // ---- song handoff (consumed by sound.js's bird-song scheduler) ----
  //
  // Returns up to `max` audible birds near the player, sorted by song
  // eagerness then proximity. Courting / dawn-chorus birds bubble to the top.
  songCandidates(playerPos, maxDist = 60, max = 6) {
    const out = [];
    const md2 = maxDist * maxDist;
    for (let i = 0; i < this.birds.length; i++) {
      const b = this.birds[i];
      if (b.scale < 0.3 || b.wantSong < 0.05) continue;
      const d2 = (b.pos.x - playerPos.x) ** 2 + (b.pos.z - playerPos.z) ** 2;
      if (d2 > md2) continue;
      out.push({ species: b.species, x: b.pos.x, y: b.pos.y, z: b.pos.z, priority: b.wantSong, d2 });
    }
    out.sort((a, c) => (c.priority - a.priority) || (a.d2 - c.d2));
    return out.slice(0, max);
  }
}

function pickSpecies() {
  let total = 0;
  for (const k of BIRD_KEYS) total += WEIGHTS[k] || 1;
  let r = Math.random() * total;
  for (const k of BIRD_KEYS) {
    r -= WEIGHTS[k] || 1;
    if (r <= 0) return k;
  }
  return BIRD_KEYS[0];
}
