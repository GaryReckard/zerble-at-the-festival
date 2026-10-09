// Smile pickups: glowing yellow orbs that float up from happy NPCs and drift toward Zerble.

import * as THREE from 'three';
import { A11y } from './a11y.js';

const PICKUP_RADIUS = 2.4;
const SEEK_SPEED = 14;       // base speed; ramps up over time so distant smiles arrive eventually
const LOST_SEEK_SPEED = 6;   // slower — a lost smile sadly drifts out to the grumpy NPC so you SEE it go
const RISE_TIME = 0.25;       // tiny "pop and rise" before homing
const RISE_SPEED = 2.8;
const LIFETIME = 14;

export class Smiles {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Smiles';
    this.active = [];

    // Reusable geometry/material for visual smile bodies
    this._geo = new THREE.IcosahedronGeometry(0.32, 1);
    this._mat = new THREE.MeshStandardMaterial({
      color: 0xffe066,
      emissive: 0xffcc33,
      emissiveIntensity: 2.4,
      roughness: 0.4,
    });
    // Reddish "lost smile" body — the reverse pickup that flies from Zerble out
    // to an unhappy NPC when the bubble tank is dry (it does NOT come back).
    this._lostMat = new THREE.MeshStandardMaterial({
      color: 0xff6b6b,
      emissive: 0xd62828,
      emissiveIntensity: 2.0,
      roughness: 0.4,
    });
    // Colorblind tell: a bright "−" bar on the lost orb so it reads as a loss by
    // SHAPE, not just by its red-vs-gold colour (added in spawnLost when the
    // accessibility option is on). Shared across lost smiles; never disposed
    // (lives for the session on this Smiles instance).
    this._minusGeo = new THREE.BoxGeometry(0.42, 0.1, 0.1);
    this._minusMat = new THREE.MeshBasicMaterial({ color: 0xfff6e6 });

    // One curved decal mesh shared by every earned smile. Lift it just above
    // the orb's circumsphere so the faceted body cannot swallow the features.
    const vertices = [];
    const vertex = (x, y) => vertices.push(x, y, Math.sqrt(0.33 ** 2 - x * x - y * y));
    for (const eyeX of [-0.105, 0.105]) {
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2, b = (i + 1) / 12 * Math.PI * 2;
        vertex(eyeX, 0.09);
        vertex(eyeX + Math.cos(a) * 0.035, 0.09 + Math.sin(a) * 0.048);
        vertex(eyeX + Math.cos(b) * 0.035, 0.09 + Math.sin(b) * 0.048);
      }
    }
    for (let i = 0; i < 20; i++) {
      const a = Math.PI * (1.10 + i / 20 * 0.80);
      const b = Math.PI * (1.10 + (i + 1) / 20 * 0.80);
      const point = (angle, radius) => [Math.cos(angle) * radius, Math.sin(angle) * radius - 0.015];
      const p = point(a, 0.17), q = point(b, 0.17), r = point(a, 0.125), s = point(b, 0.125);
      vertex(...p); vertex(...q); vertex(...r);
      vertex(...r); vertex(...q); vertex(...s);
    }
    this._faceGeo = new THREE.BufferGeometry();
    this._faceGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    this._faceMat = new THREE.MeshBasicMaterial({ color: 0x301d08, toneMapped: false });
    this._faceForward = new THREE.Vector3(0, 0, 1);
    this._travel = new THREE.Vector3();
  }

  // A smile leaving Zerble for a grumpy NPC. Spawns at `fromPos`, homes to the
  // NPC (tracked live as it walks away), then fades — purely a visual cue that
  // you lost a smile (the score deduction happens in crowd.onFrown).
  spawnLost(fromPos, npc) {
    const mesh = new THREE.Mesh(this._geo, this._lostMat);
    mesh.position.copy(fromPos);
    mesh.position.y += 1.4;
    this.group.add(mesh);
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.7, 18),
      new THREE.MeshBasicMaterial({
        color: 0xff6b6b, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false,
      })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = -0.25;
    mesh.add(halo);
    if (A11y.colorblind) {
      mesh.add(new THREE.Mesh(this._minusGeo, this._minusMat));
    }
    this.active.push({ mesh, halo, age: 0, seeking: false, lost: true, npc });
  }

  spawn(worldPos) {
    const mesh = new THREE.Mesh(this._geo, this._mat);
    const face = new THREE.Mesh(this._faceGeo, this._faceMat);
    face.name = 'SmileFace';
    mesh.add(face);
    mesh.position.copy(worldPos);
    mesh.position.y += 1.6;
    this.group.add(mesh);

    // Soft halo
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.7, 18),
      new THREE.MeshBasicMaterial({
        color: 0xffe066,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = -0.25;
    mesh.add(halo);

    this.active.push({
      mesh,
      face,
      halo,
      age: 0,
      seeking: false,
    });
  }

  update(dt, zerble, onCollect) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const s = this.active[i];
      s.age += dt;

      // Reverse "lost smile": fly from Zerble out to the (moving) grumpy NPC,
      // then fade. No collection, no score change.
      if (s.lost) {
        const toNpc = new THREE.Vector3(s.npc.pos.x, s.npc.pos.y + 1.5, s.npc.pos.z).sub(s.mesh.position);
        const dist = toNpc.length();
        if (s.age < RISE_TIME) {
          s.mesh.position.y += RISE_SPEED * dt;
        } else {
          toNpc.normalize().multiplyScalar(LOST_SEEK_SPEED * dt);
          s.mesh.position.add(toNpc);
        }
        s.mesh.rotation.y += dt * 2.5;
        s.halo.scale.setScalar(1 + Math.sin(s.age * 5) * 0.2);
        if (dist < 1.0 || s.age >= LIFETIME) {
          this.group.remove(s.mesh);
          this.active.splice(i, 1);
        }
        continue;
      }

      const toZerble = new THREE.Vector3().subVectors(zerble.position, s.mesh.position);
      toZerble.y += 1.5;
      const dist = toZerble.length();
      this._travel.copy(s.mesh.position);

      if (s.age < RISE_TIME) {
        // Brief upward pop so the player can see where the smile came from.
        s.mesh.position.y += RISE_SPEED * dt;
      } else {
        // Always home — speed ramps up so smiles from far-away NPCs catch up reasonably fast.
        const speedScale = 1 + Math.min(2.5, s.age * 0.3);
        toZerble.normalize().multiplyScalar(SEEK_SPEED * speedScale * dt);
        s.mesh.position.add(toZerble);
      }

      // Keep the face leading the actual movement, including the rise and bob.
      s.mesh.position.y += Math.sin(s.age * 4 + i) * 0.005;
      this._travel.subVectors(s.mesh.position, this._travel);
      if (this._travel.lengthSq() > 1e-12) {
        s.face.quaternion.setFromUnitVectors(this._faceForward, this._travel.normalize());
      }

      // Halo pulse
      s.halo.scale.setScalar(1 + Math.sin(s.age * 5) * 0.2);

      // Collect
      if (dist < PICKUP_RADIUS) {
        this.group.remove(s.mesh);
        s.mesh.geometry = null;
        this.active.splice(i, 1);
        onCollect(1);
        continue;
      }

      // Despawn after lifetime
      if (s.age >= LIFETIME) {
        this.group.remove(s.mesh);
        this.active.splice(i, 1);
      }
    }
  }
}
