// Frozen before Task 2.20. Raw targets exist only in this comparison oracle.
export class SmileOracle {
  update(dt, zerble, onCollect) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const s = this.active[i];
      s.age += dt;

      // Reverse "lost smile": fly from Zerble out to the (moving) grumpy NPC,
      // then fade. No collection, no score change.
      if (s.lost) {
        const toNpc = this._toTarget.set(s.npc.pos.x, s.npc.pos.y + 1.5, s.npc.pos.z).sub(s.mesh.position);
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

      const toZerble = this._toTarget.subVectors(zerble.position, s.mesh.position);
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
