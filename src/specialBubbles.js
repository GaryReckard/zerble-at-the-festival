import * as THREE from 'three';
import { BUBBLE_TYPES, SPECIAL, computeTint } from './bubbleTypes.js';
import { createHeartGeometry } from './models/heart.js';

const HEART_SHELL_SCALE = 1.4;
const POP_POOL = 128;
const GOLDEN_ANGLE = 2.399963229728653;
const ACCENT_STYLE = Object.freeze({ none: 0, ember: 1, firefly: 2, spark: 3, lantern: 4, brass: 5, music: 6, mushroom: 7 });

const SHELL_VERT = /* glsl */ `
  attribute vec4 aTint;
  attribute vec2 aAccent;
  varying vec4 vTint;
  varying float vRim;
  varying vec2 vFace;
  varying vec2 vAccent;
  #include <fog_pars_vertex>
  void main() {
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * mat3(instanceMatrix) * normal);
    vRim = 1.0 - abs(dot(n, normalize(-mvPosition.xyz)));
    vTint = aTint;
    vFace = position.xy / 0.11;
    vAccent = aAccent;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const SHELL_FRAG = /* glsl */ `
  uniform float uCoreAlpha;
  uniform float uRimAlpha;
  varying vec4 vTint;
  varying float vRim;
  varying vec2 vFace;
  varying vec2 vAccent;
  #include <fog_pars_fragment>
  vec3 dyeColor(float hue) {
    vec3 rgb = clamp(abs(mod(hue * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return mix(vec3(1.0), rgb, 0.68);
  }
  void main() {
    float rim = pow(clamp(vRim, 0.0, 1.0), 1.6);
    vec3 shellColor = vTint.rgb * vTint.a * (0.72 + 1.0 * rim);
    float shellAlpha = uCoreAlpha + uRimAlpha * rim;
    if (vAccent.x > 6.5 && vAccent.x < 7.5) {
      vec2 dyeCenter = 0.14 * vec2(sin(vAccent.y * 0.82), cos(vAccent.y * 0.82));
      vec2 dyePos = vFace - dyeCenter;
      float radius = length(dyePos);
      float angle = atan(dyePos.y, dyePos.x);
      float twist = angle / 6.2831853 + radius * 0.92 - vAccent.y * 0.12
        + 0.055 * sin(dyePos.x * 9.0 + vAccent.y * 0.6);
      float ribbon = 0.5 + 0.5 * cos(twist * 18.849556);
      vec3 dye = dyeColor(fract(twist + 0.68));
      shellColor = mix(shellColor, dye, 0.84);
      shellAlpha = max(shellAlpha, 0.10 + 0.13 * ribbon);
    }
    float accentAlpha = 0.0;
    vec3 accentColor = vec3(1.0);
    if (gl_FrontFacing) {
      vec2 p = vFace;
      float phase = vAccent.y;
      if (vAccent.x > 0.5 && vAccent.x < 1.5) {
        vec2 ember = vec2(p.x * 1.2 + sin(phase * 2.2) * 0.06, (p.y + 0.08) * 0.9);
        float body = exp(-10.0 * dot(ember, ember));
        float hot = exp(-58.0 * dot(ember - vec2(0.0, 0.04), ember - vec2(0.0, 0.04)));
        vec2 fleckA = p - vec2(-0.25, 0.23 + 0.05 * sin(phase * 2.7));
        vec2 fleckB = p - vec2(0.28, -0.18 + 0.04 * cos(phase * 2.1));
        float flecks = exp(-190.0 * dot(fleckA, fleckA)) + exp(-170.0 * dot(fleckB, fleckB));
        accentAlpha = min(0.95, body * 0.57 + hot * 0.45 + flecks * 0.44);
        accentColor = mix(vec3(1.0, 0.22, 0.03), vec3(1.0, 0.73, 0.18), hot);
      } else if (vAccent.x > 1.5 && vAccent.x < 2.5) {
        vec2 fly = vec2(sin(phase * 1.3) * 0.13, cos(phase * 1.1) * 0.12);
        p -= fly;
        float r2 = dot(p, p);
        float blink = 0.82 + 0.18 * sin(phase * 3.4);
        accentAlpha = min(0.98, (exp(-7.0 * r2) * 0.52 + exp(-48.0 * r2) * 0.72) * blink);
        accentColor = vec3(0.43, 1.0, 0.16);
      } else if (vAccent.x > 2.5 && vAccent.x < 3.5) {
        // A point with four slim rays reads as a spark at chase distance.
        float r = length(p);
        float crossRay = min(abs(p.x), abs(p.y));
        float diagonalRay = min(abs(p.x - p.y), abs(p.x + p.y)) * 0.707;
        float ray = (1.0 - smoothstep(0.025, 0.085, min(crossRay, diagonalRay)))
          * (1.0 - smoothstep(0.25, 0.53, r));
        accentAlpha = min(0.96, ray * (0.62 + 0.25 * sin(phase * 5.0))
          + exp(-95.0 * r * r) * 0.85);
        accentColor = vec3(1.0, 0.94, 0.64);
      } else if (vAccent.x > 3.5 && vAccent.x < 4.5) {
        float body = (1.0 - smoothstep(0.24, 0.31, abs(p.x)))
          * (1.0 - smoothstep(0.35, 0.43, abs(p.y)));
        float wick = exp(-40.0 * (p.x * p.x + (p.y + 0.08) * (p.y + 0.08)));
        accentAlpha = min(0.85, body * 0.38 + wick * (0.4 + 0.12 * sin(phase * 1.5)));
        accentColor = mix(vec3(1.0, 0.48, 0.15), vec3(1.0, 0.84, 0.34), wick);
      } else if (vAccent.x > 4.5 && vAccent.x < 5.5) {
        float sweepX = fract(phase / 1.5) * 2.4 - 1.2;
        float stripe = p.x - sweepX - p.y * 0.2;
        float rimFade = 1.0 - smoothstep(0.65, 1.0, length(p));
        float streak = exp(-120.0 * stripe * stripe) * rimFade;
        float flash = exp(-40.0 * dot(p - vec2(sweepX, 0.0), p - vec2(sweepX, 0.0)));
        accentAlpha = min(0.8, streak * 0.55 + flash * 0.25);
        accentColor = vec3(1.0, 0.93, 0.55);
      } else if (vAccent.x > 5.5 && vAccent.x < 6.5) {
        vec2 note = p - vec2(0.10, 0.07);
        vec2 head = note - vec2(-0.18, -0.27);
        float oval = length(vec2((head.x + head.y * 0.25) / 0.29, head.y / 0.18));
        float noteHead = 1.0 - smoothstep(0.82, 1.05, oval);
        float stem = (1.0 - smoothstep(0.035, 0.075, abs(note.x - 0.08)))
          * smoothstep(-0.30, -0.23, note.y) * (1.0 - smoothstep(0.42, 0.50, note.y));
        float flagX = smoothstep(0.05, 0.11, note.x) * (1.0 - smoothstep(0.37, 0.45, note.x));
        float flagTop = 0.50 - (note.x - 0.08) * 0.61;
        float flagBottom = 0.38 - (note.x - 0.08) * 0.74;
        float flag = flagX * (1.0 - smoothstep(flagTop - 0.035, flagTop + 0.015, note.y))
          * smoothstep(flagBottom - 0.015, flagBottom + 0.035, note.y);
        accentAlpha = min(0.96, max(noteHead, max(stem, flag)) * (0.91 + 0.05 * sin(phase * 3.0)));
        accentColor = vec3(1.0, 0.97, 0.75);
      }
    }
    float accent = clamp(accentAlpha * (1.0 - rim * 0.45), 0.0, 1.0);
    gl_FragColor = vec4(mix(shellColor, accentColor, accent),
      shellAlpha + accent * (1.0 - shellAlpha));
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
    this._sphereAccent = new THREE.InstancedBufferAttribute(new Float32Array(SPECIAL.pool * 2), 2);
    this._heartAccent = new THREE.InstancedBufferAttribute(new Float32Array(SPECIAL.pool * 2), 2);
    sphereGeometry.setAttribute('aTint', this._sphereTint);
    sphereGeometry.setAttribute('aAccent', this._sphereAccent);
    heartGeometry.setAttribute('aTint', this._heartTint);
    heartGeometry.setAttribute('aAccent', this._heartAccent);

    this.shellMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        { uCoreAlpha: { value: 0.045 }, uRimAlpha: { value: 0.3 } },
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
    const accentAttribute = heart ? this._heartAccent : this._sphereAccent;
    const scale = size * computeTint(type.look, this._time + age * 0.03, this._nightness, seed, this._tint);
    const offset = slot * 4;
    tintAttribute.array[offset] = this._tint.r;
    tintAttribute.array[offset + 1] = this._tint.g;
    tintAttribute.array[offset + 2] = this._tint.b;
    tintAttribute.array[offset + 3] = this._tint.a;
    accentAttribute.array[slot * 2] = ACCENT_STYLE[type.look.accent] || 0;
    accentAttribute.array[slot * 2 + 1] = this._time + seed * 6.283185307179586;

    if (this._camera) {
      // The camera's quaternion faces the heart toward the viewer while
      // preserving screen-up, and keeps inner sphere accents front-facing.
      this._rotation.copy(this._camera.quaternion);
      if (heart) {
        this._wobbleYaw.setFromAxisAngle(this._up, Math.sin(this._time * 2 + seed * 17 + spin) * 0.28);
        this._wobblePitch.setFromAxisAngle(this._right, Math.cos(this._time * 1.7 + seed * 13) * 0.18);
        this._rotation.multiply(this._wobbleYaw).multiply(this._wobblePitch);
      }
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
      this._sphereAccent.needsUpdate = true;
    }
    if (this.heartMesh.visible) {
      this.heartMesh.instanceMatrix.needsUpdate = true;
      this._heartTint.needsUpdate = true;
      this._heartAccent.needsUpdate = true;
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
