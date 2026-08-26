import * as THREE from 'three';

export const BOOST_STREAK_POOL_SIZE = 8;
export const BOOST_STREAK_LIFE = 0.42;
export const BOOST_STREAK_REAR = 3.35;
export const BOOST_STREAK_HEIGHT = 1.15;

const EMIT_INTERVAL = 0.05;
const MIN_SPEED = 15;

// A low-poly tube reads as a cart-sized golden wake ring from both the chase
// camera and a side view. The old 0.5m flat ring sat against the bubble machine
// and looked like part of its liquid column instead of a separate speed effect.
const BOOST_STREAK_GEOMETRY = new THREE.TorusGeometry(0.95, 0.055, 4, 18);
BOOST_STREAK_GEOMETRY.userData.shared = true;

export function shouldShowBoostStreaks({ boosting, speed, reducedMotion, effectsEnabled }) {
  return !!boosting && Math.abs(speed || 0) >= MIN_SPEED && !reducedMotion && effectsEnabled !== false;
}

export class BoostStreaks {
  constructor() {
    // Geometry is safe to share across preview instances. The material is
    // owned by this pool so sandbox teardown can dispose it without poisoning
    // a later preview that reuses a module-level material.
    const material = new THREE.MeshBasicMaterial({
      color: 0xff8f32,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    material.name = 'BoostWakeMaterial';
    this.mesh = new THREE.InstancedMesh(
      BOOST_STREAK_GEOMETRY,
      material,
      BOOST_STREAK_POOL_SIZE,
    );
    this.mesh.name = 'BoostStreaks';
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.frustumCulled = false;

    this._ages = new Float32Array(BOOST_STREAK_POOL_SIZE);
    this._x = new Float32Array(BOOST_STREAK_POOL_SIZE);
    this._y = new Float32Array(BOOST_STREAK_POOL_SIZE);
    this._z = new Float32Array(BOOST_STREAK_POOL_SIZE);
    this._yaw = new Float32Array(BOOST_STREAK_POOL_SIZE);
    this._active = new Uint8Array(BOOST_STREAK_POOL_SIZE);
    this._cursor = 0;
    this._emitAcc = 0;

    this._dummy = new THREE.Object3D();
    this._zero = new THREE.Matrix4().makeScale(0, 0, 0);

    for (let i = 0; i < BOOST_STREAK_POOL_SIZE; i++) {
      this.mesh.setMatrixAt(i, this._zero);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  update(dt, zerble, { reducedMotion = false, effectsEnabled = true } = {}) {
    const showing = shouldShowBoostStreaks({
      boosting: zerble?.isBoosting,
      speed: zerble?.speed,
      reducedMotion,
      effectsEnabled,
    });

    if (showing) {
      this._emitAcc += dt;
      while (this._emitAcc >= EMIT_INTERVAL) {
        this._emitAcc -= EMIT_INTERVAL;
        this._emit(zerble);
      }
    } else {
      this._emitAcc = 0;
    }

    let matricesChanged = false;
    for (let i = 0; i < BOOST_STREAK_POOL_SIZE; i++) {
      if (!this._active[i]) continue;
      const age = this._ages[i] + dt;
      this._ages[i] = age;
      if (age >= BOOST_STREAK_LIFE) {
        this._active[i] = 0;
        this.mesh.setMatrixAt(i, this._zero);
        matricesChanged = true;
        continue;
      }

      const p = age / BOOST_STREAK_LIFE;
      const scale = 0.82 + p * 0.68;
      this._dummy.position.set(this._x[i], this._y[i] + p * 0.08, this._z[i]);
      this._dummy.rotation.set(0, this._yaw[i] + Math.PI, 0);
      this._dummy.scale.set(scale, scale * 0.82, scale);
      this._dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this._dummy.matrix);
      matricesChanged = true;
    }

    if (matricesChanged) this.mesh.instanceMatrix.needsUpdate = true;
  }

  trigger(zerble) {
    this._emit(zerble);
  }

  clear() {
    for (let i = 0; i < BOOST_STREAK_POOL_SIZE; i++) {
      this._active[i] = 0;
      this.mesh.setMatrixAt(i, this._zero);
    }
    this._emitAcc = 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  _emit(zerble) {
    if (!zerble?.position) return;
    const i = this._cursor;
    this._cursor = (this._cursor + 1) % BOOST_STREAK_POOL_SIZE;
    const heading = zerble.heading || 0;
    this._active[i] = 1;
    this._ages[i] = 0;
    this._x[i] = zerble.position.x + Math.sin(heading) * BOOST_STREAK_REAR;
    this._y[i] = (zerble.position.y || 0) + BOOST_STREAK_HEIGHT;
    this._z[i] = zerble.position.z + Math.cos(heading) * BOOST_STREAK_REAR;
    this._yaw[i] = heading;
  }
}
