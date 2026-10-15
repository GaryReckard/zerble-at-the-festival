import * as THREE from 'three';
import { BUBBLE_TYPES, SPECIAL, computeTint } from './bubbleTypes.js';
import { createHeartGeometry } from './models/heart.js';

const HEART_SHELL_SCALE = 1.4;
const POP_POOL = 128;
const GOLDEN_ANGLE = 2.399963229728653;

const SHELL_VERT = /* glsl */ `
  attribute vec4 aTint;
  varying vec4 vTint;
  varying float vRim;
  #include <fog_pars_vertex>
  void main() {
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * mat3(instanceMatrix) * normal);
    vRim = 1.0 - abs(dot(n, normalize(-mvPosition.xyz)));
    vTint = aTint;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const SHELL_FRAG = /* glsl */ `
  uniform float uCoreAlpha;
  uniform float uRimAlpha;
  varying vec4 vTint;
  varying float vRim;
  #include <fog_pars_fragment>
  void main() {
    float rim = pow(clamp(vRim, 0.0, 1.0), 1.6);
    gl_FragColor = vec4(vTint.rgb * vTint.a * (0.65 + 1.0 * rim),
      uCoreAlpha + uRimAlpha * rim);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export class SpecialBubbleRenderer {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'Special bubbles';

    const sphereGeometry = new THREE.IcosahedronGeometry(0.11, 2);
    const heartGeometry = createHeartGeometry();
    heartGeometry.computeBoundingSphere();
    const heartScale = 0.11 * HEART_SHELL_SCALE / heartGeometry.boundingSphere.radius;
    heartGeometry.scale(heartScale, heartScale, heartScale);
    heartGeometry.computeBoundingSphere();
    this._sphereTint = new THREE.InstancedBufferAttribute(new Float32Array(SPECIAL.pool * 4), 4);
    this._heartTint = new THREE.InstancedBufferAttribute(new Float32Array(SPECIAL.pool * 4), 4);
    sphereGeometry.setAttribute('aTint', this._sphereTint);
    heartGeometry.setAttribute('aTint', this._heartTint);

    this.shellMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        { uCoreAlpha: { value: 0.12 }, uRimAlpha: { value: 0.52 } },
      ]),
      vertexShader: SHELL_VERT,
      fragmentShader: SHELL_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: true,
    });
    this.sphereMesh = new THREE.InstancedMesh(sphereGeometry, this.shellMaterial, SPECIAL.pool);
    this.heartMesh = new THREE.InstancedMesh(heartGeometry, this.shellMaterial, SPECIAL.pool);
    const popGeometry = new THREE.IcosahedronGeometry(0.03, 0);
    this.popMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false,
    });
    this.popMesh = new THREE.InstancedMesh(popGeometry, this.popMaterial, POP_POOL);
    for (const mesh of [this.sphereMesh, this.heartMesh, this.popMesh]) {
      mesh.count = 0;
      mesh.visible = false;
      mesh.castShadow = false;
      mesh.frustumCulled = false;
      this.root.add(mesh);
    }

    this._matrix = new THREE.Matrix4();
    this._position = new THREE.Vector3();
    this._scale = new THREE.Vector3();
    this._rotation = new THREE.Quaternion();
    this._wobbleYaw = new THREE.Quaternion();
    this._wobblePitch = new THREE.Quaternion();
    this._up = new THREE.Vector3(0, 1, 0);
    this._right = new THREE.Vector3(1, 0, 0);
    this._color = new THREE.Color();
    this._tint = { r: 1, g: 1, b: 1, a: 1 };
    this._camera = null;
    this._nightness = 0;
    this._time = 0;
    this._sphereCount = 0;
    this._heartCount = 0;
    this._popCount = 0;
    this._popCursor = 0;
    this._popSerial = 0;
    this._pops = Array.from({ length: POP_POOL }, () => ({
      alive: false, age: 0, life: 0, size: 0,
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rise: 0, color: 0,
    }));
    this._disposed = false;
  }

  beginFrame(camera = null, nightness = 0, dt = 0) {
    this._camera = camera;
    this._nightness = nightness;
    this._time += dt;
    this._sphereCount = 0;
    this._heartCount = 0;
  }

  write(typeIndex, pos, size, spin, age, seed) {
    const type = BUBBLE_TYPES[typeIndex];
    if (!type) return;
    const heart = type.look.shell === 'heart';
    const slot = heart ? this._heartCount++ : this._sphereCount++;
    if (slot >= SPECIAL.pool) return;
    const mesh = heart ? this.heartMesh : this.sphereMesh;
    const tintAttribute = heart ? this._heartTint : this._sphereTint;
    const scale = size * computeTint(type.look, this._time + age * 0.03, this._nightness, seed, this._tint);
    const offset = slot * 4;
    tintAttribute.array[offset] = this._tint.r;
    tintAttribute.array[offset + 1] = this._tint.g;
    tintAttribute.array[offset + 2] = this._tint.b;
    tintAttribute.array[offset + 3] = this._tint.a;

    if (heart && this._camera) {
      // The camera's quaternion faces the heart toward the viewer while
      // preserving screen-up. A direction-only rotation can flip the heart.
      this._rotation.copy(this._camera.quaternion);
      this._wobbleYaw.setFromAxisAngle(this._up, Math.sin(this._time * 2 + seed * 17 + spin) * 0.28);
      this._wobblePitch.setFromAxisAngle(this._right, Math.cos(this._time * 1.7 + seed * 13) * 0.18);
      this._rotation.multiply(this._wobbleYaw).multiply(this._wobblePitch);
    } else {
      this._rotation.setFromAxisAngle(this._up, spin);
    }
    this._position.copy(pos);
    this._scale.set(type.look.scale[0] * scale, type.look.scale[1] * scale, type.look.scale[2] * scale);
    this._matrix.compose(this._position, this._rotation, this._scale);
    mesh.setMatrixAt(slot, this._matrix);
  }

  pop(typeIndex, pos, size) {
    const profile = BUBBLE_TYPES[typeIndex]?.look.pop;
    if (!profile) return;
    const serial = this._popSerial++;
    for (let j = 0; j < profile.count; j++) {
      const d = this._pops[this._popCursor];
      this._popCursor = (this._popCursor + 1) % POP_POOL;
      if (!d.alive) this._popCount++;
      const y = 1 - 2 * (j + 0.5) / profile.count;
      const radius = Math.sqrt(1 - y * y);
      const angle = (serial + j) * GOLDEN_ANGLE;
      const dx = Math.cos(angle) * radius;
      const dz = Math.sin(angle) * radius;
      const speed = profile.speed;
      d.alive = true;
      d.age = 0;
      d.life = profile.life;
      d.size = Math.max(0.7, size);
      d.x = pos.x + dx * 0.11 * size;
      d.y = pos.y + y * 0.11 * size;
      d.z = pos.z + dz * 0.11 * size;
      d.vx = dx * speed;
      d.vy = y * speed;
      d.vz = dz * speed;
      d.rise = profile.rise;
      d.color = profile.colors[j % profile.colors.length];
    }
  }

  endFrame(dt = 0) {
    for (let i = 0; i < POP_POOL; i++) {
      const d = this._pops[i];
      if (!d.alive) continue;
      d.age += dt;
      if (d.age >= d.life) {
        d.alive = false;
        this._popCount--;
        this.popMesh.setMatrixAt(i, this._matrix.makeScale(0, 0, 0));
        continue;
      }
      const damping = Math.pow(0.88, dt * 60);
      d.vx *= damping; d.vy *= damping; d.vz *= damping;
      d.x += d.vx * dt;
      d.y += (d.vy + d.rise) * dt;
      d.z += d.vz * dt;
      this._position.set(d.x, d.y, d.z);
      this._scale.setScalar(d.size * (1 - d.age / d.life));
      this._rotation.setFromAxisAngle(this._up, 0);
      this._matrix.compose(this._position, this._rotation, this._scale);
      this.popMesh.setMatrixAt(i, this._matrix);
      this._color.setHex(d.color).multiplyScalar(1 - d.age / d.life);
      this.popMesh.setColorAt(i, this._color);
    }
    this.sphereMesh.count = Math.min(this._sphereCount, SPECIAL.pool);
    this.heartMesh.count = Math.min(this._heartCount, SPECIAL.pool);
    this.popMesh.count = this._popCount ? POP_POOL : 0;
    this.sphereMesh.visible = this.sphereMesh.count > 0;
    this.heartMesh.visible = this.heartMesh.count > 0;
    this.popMesh.visible = this._popCount > 0;
    if (this.sphereMesh.visible) {
      this.sphereMesh.instanceMatrix.needsUpdate = true;
      this._sphereTint.needsUpdate = true;
    }
    if (this.heartMesh.visible) {
      this.heartMesh.instanceMatrix.needsUpdate = true;
      this._heartTint.needsUpdate = true;
    }
    if (this.popMesh.visible) {
      this.popMesh.instanceMatrix.needsUpdate = true;
      if (this.popMesh.instanceColor) this.popMesh.instanceColor.needsUpdate = true;
    }
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this.root.remove(this.sphereMesh, this.heartMesh, this.popMesh);
    this.sphereMesh.geometry.dispose();
    this.heartMesh.geometry.dispose();
    this.popMesh.geometry.dispose();
    this.shellMaterial.dispose();
    this.popMaterial.dispose();
  }
}
