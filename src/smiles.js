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

      if (s.age < RISE_TIME) {
        // Brief upward pop so the player can see where the smile came from.
        s.mesh.position.y += RISE_SPEED * dt;
      } else {
        // Always home — speed ramps up so smiles from far-away NPCs catch up reasonably fast.
        const speedScale = 1 + Math.min(2.5, s.age * 0.3);
        toZerble.normalize().multiplyScalar(SEEK_SPEED * speedScale * dt);
        s.mesh.position.add(toZerble);
      }

      // Bobble & spin
      s.mesh.rotation.y += dt * 2.5;
      s.mesh.position.y += Math.sin(s.age * 4 + i) * 0.005;

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
