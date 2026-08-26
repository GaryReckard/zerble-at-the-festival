import * as THREE from 'three';

export const BOOST_STREAK_POOL_SIZE = 8;
export const BOOST_STREAK_LIFE = 0.42;

const EMIT_INTERVAL = 0.05;
const MIN_SPEED = 15;

const BOOST_STREAK_GEOMETRY = new THREE.RingGeometry(0.44, 0.52, 16);
const BOOST_STREAK_MATERIAL = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  vertexColors: true,
  side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  toneMapped: false,
});
BOOST_STREAK_GEOMETRY.userData.shared = true;
BOOST_STREAK_MATERIAL.userData.shared = true;

export function shouldShowBoostStreaks({ boosting, speed, reducedMotion, effectsEnabled }) {
  return !!boosting && Math.abs(speed || 0) >= MIN_SPEED && !reducedMotion && effectsEnabled !== false;
}

export class BoostStreaks {
  constructor() {
    this.mesh = new THREE.InstancedMesh(
      BOOST_STREAK_GEOMETRY,
      BOOST_STREAK_MATERIAL,
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
    this._color = new THREE.Color();
    this._zero = new THREE.Matrix4().makeScale(0, 0, 0);

    for (let i = 0; i < BOOST_STREAK_POOL_SIZE; i++) {
      this.mesh.setMatrixAt(i, this._zero);
      this.mesh.setColorAt(i, this._color.setRGB(0, 0, 0));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
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
    let colorsChanged = false;
    for (let i = 0; i < BOOST_STREAK_POOL_SIZE; i++) {
      if (!this._active[i]) continue;
      const age = this._ages[i] + dt;
      this._ages[i] = age;
      if (age >= BOOST_STREAK_LIFE) {
        this._active[i] = 0;
        this.mesh.setMatrixAt(i, this._zero);
        this.mesh.setColorAt(i, this._color.setRGB(0, 0, 0));
        matricesChanged = true;
        colorsChanged = true;
        continue;
      }

      const p = age / BOOST_STREAK_LIFE;
      const scale = 0.72 + p * 0.78;
      this._dummy.position.set(this._x[i], this._y[i] + p * 0.08, this._z[i]);
      this._dummy.rotation.set(0, this._yaw[i] + Math.PI, 0);
      this._dummy.scale.set(scale, scale, scale);
      this._dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this._dummy.matrix);

      const glow = (1 - p) * (1 - p);
      this.mesh.setColorAt(i, this._color.setRGB(glow, glow * 0.58, glow * 0.2));
      matricesChanged = true;
      colorsChanged = true;
    }

    if (matricesChanged) this.mesh.instanceMatrix.needsUpdate = true;
    if (colorsChanged) this.mesh.instanceColor.needsUpdate = true;
  }

  trigger(zerble) {
    this._emit(zerble);
  }

  clear() {
    for (let i = 0; i < BOOST_STREAK_POOL_SIZE; i++) {
      this._active[i] = 0;
      this.mesh.setMatrixAt(i, this._zero);
      this.mesh.setColorAt(i, this._color.setRGB(0, 0, 0));
    }
    this._emitAcc = 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }

  _emit(zerble) {
    if (!zerble?.position) return;
    const i = this._cursor;
    this._cursor = (this._cursor + 1) % BOOST_STREAK_POOL_SIZE;
    const heading = zerble.heading || 0;
    const rear = 2.25;
    this._active[i] = 1;
    this._ages[i] = 0;
    this._x[i] = zerble.position.x + Math.sin(heading) * rear;
    this._y[i] = (zerble.position.y || 0) + 0.72;
    this._z[i] = zerble.position.z + Math.cos(heading) * rear;
    this._yaw[i] = heading;
  }
}
