// Bubble vendor — a classic-lemonade-stand booth restyled for bubbles. A
// striped awning over a counter, a big "BUBBLES" sign, and a vendor behind
// the counter in a SPACE SUIT with a clear bubble helmet (+ oxygen tank).
// Drive up + linger to refill the bubble meter (free). Group-anchored at
// (0,0,0), facing -Z (the customer side) — same forward convention as the
// NPCs (buildSimpleNPC eyes face -Z). The caller positions/rotates it.
//
// Reuses buildSimpleNPC (puppet.js) for the vendor and buildBubbleJug for the
// jugs on the counter. Textures + materials are module-cached/shared so the
// chunk-unload disposal walk skips them (perf footgun #6).

import * as THREE from 'three';
import { buildSimpleNPC } from './puppet.js';
import { buildBubbleJug } from './bubbleJug.js';

let _signTex = null;
function signTexture() {
  if (_signTex) return _signTex;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 160;
  const cx = c.getContext('2d');
  cx.fillStyle = '#0a2c4e'; cx.fillRect(0, 0, 512, 160);
  // a few printed bubbles
  cx.strokeStyle = 'rgba(180,240,255,0.9)'; cx.lineWidth = 5;
  for (const [x, y, r] of [[55, 44, 24], [104, 30, 14], [455, 116, 22], [476, 58, 13]]) {
    cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.stroke();
  }
  cx.fillStyle = '#c4f2ff';
  cx.font = 'bold 98px sans-serif';
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.fillText('BUBBLES', 256, 88);
  _signTex = new THREE.CanvasTexture(c);
  _signTex.colorSpace = THREE.SRGBColorSpace;
  return _signTex;
}

let _stripeTex = null;
function stripeTexture() {
  if (_stripeTex) return _stripeTex;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const cx = c.getContext('2d');
  const sw = 32;
  for (let x = 0; x < 256; x += sw) {
    cx.fillStyle = ((x / sw) % 2) ? '#ffffff' : '#2b8fe0';
    cx.fillRect(x, 0, sw, 64);
  }
  _stripeTex = new THREE.CanvasTexture(c);
  _stripeTex.wrapS = THREE.RepeatWrapping;
  _stripeTex.repeat.set(3.5, 1);
  _stripeTex.colorSpace = THREE.SRGBColorSpace;
  return _stripeTex;
}

const _mat = {};
function mat(key, make) {
  if (_mat[key]) return _mat[key];
  const m = make();
  m.userData.shared = true;
  _mat[key] = m;
  return m;
}
const _geo = {};
function geo(key, make) {
  if (_geo[key]) return _geo[key];
  const g = make();
  g.userData.shared = true;
  _geo[key] = g;
  return g;
}

export function buildBubbleVendor(rng = Math.random) {
  const group = new THREE.Group();

  const woodMat = mat('wood', () => new THREE.MeshStandardMaterial({ color: 0xb98a4e, roughness: 0.85, flatShading: true }));
  const counterMat = mat('counter', () => new THREE.MeshStandardMaterial({ color: 0x2b8fe0, roughness: 0.7, flatShading: true }));
  const topMat = mat('top', () => new THREE.MeshStandardMaterial({ color: 0xf2f6fa, roughness: 0.6, flatShading: true }));
  const awningMat = mat('awning', () => new THREE.MeshStandardMaterial({ map: stripeTexture(), roughness: 0.8, flatShading: true }));
  const signMat = mat('sign', () => new THREE.MeshStandardMaterial({ map: signTexture(), emissive: 0x224a6e, emissiveIntensity: 0.4, roughness: 0.6 }));
  const signBackMat = mat('signback', () => new THREE.MeshStandardMaterial({ color: 0x0a2c4e, roughness: 0.7 }));

  const W = 2.6;   // stand width

  // ----- Counter (front, -Z side) -----
  const counter = new THREE.Mesh(geo('counter', () => new THREE.BoxGeometry(W, 1.0, 0.55)), counterMat);
  counter.position.set(0, 0.5, -0.6);
  counter.castShadow = true;
  group.add(counter);
  const top = new THREE.Mesh(geo('top', () => new THREE.BoxGeometry(W + 0.15, 0.09, 0.7)), topMat);
  top.position.set(0, 1.02, -0.6);
  group.add(top);

  // ----- Corner posts -----
  const postGeo = geo('post', () => new THREE.BoxGeometry(0.12, 2.2, 0.12));
  for (const px of [-W / 2 + 0.1, W / 2 - 0.1]) {
    for (const pz of [-0.85, 0.5]) {
      const post = new THREE.Mesh(postGeo, woodMat);
      post.position.set(px, 1.1, pz);
      group.add(post);
    }
  }

  // ----- Striped awning (slanted forward over the counter) -----
  const awning = new THREE.Mesh(geo('awning', () => new THREE.BoxGeometry(W + 0.4, 0.12, 1.7)), awningMat);
  awning.position.set(0, 2.32, -0.3);
  awning.rotation.x = -0.18;            // tilt the front edge down
  awning.castShadow = true;
  group.add(awning);
  // Scalloped valance hanging off the awning front.
  const valance = new THREE.Mesh(geo('valance', () => new THREE.BoxGeometry(W + 0.4, 0.28, 0.06)), awningMat);
  valance.position.set(0, 2.18, -1.12);
  group.add(valance);

  // ----- "BUBBLES" sign on top -----
  const sign = new THREE.Mesh(geo('sign', () => new THREE.BoxGeometry(W - 0.2, 0.72, 0.08)), [
    signBackMat, signBackMat, signBackMat, signBackMat, signMat, signBackMat,
  ]);
  sign.position.set(0, 2.85, -0.05);
  sign.castShadow = true;
  group.add(sign);

  // ----- The spacesuit vendor behind the counter (faces -Z, the customer) -----
  const vendor = buildSimpleNPC(0xeaf0f5, 0xd8b48a, { armPose: 'rest', pantsHex: 0xdfe7ee });
  vendor.position.set(0, 0, 0.25);
  group.add(vendor);
  // Clear bubble helmet over the head (head sits at y≈1.65).
  const helmet = new THREE.Mesh(
    geo('helmet', () => new THREE.SphereGeometry(0.33, 16, 12)),
    mat('helmet', () => new THREE.MeshStandardMaterial({
      color: 0xddf6ff, transparent: true, opacity: 0.26, roughness: 0.05, metalness: 0.0,
      emissive: 0x9fe4ff, emissiveIntensity: 0.25, depthWrite: false,
    })),
  );
  helmet.position.set(0, 1.66, 0.25);
  group.add(helmet);
  const collar = new THREE.Mesh(
    geo('collar', () => new THREE.TorusGeometry(0.2, 0.05, 8, 16)),
    mat('collarmat', () => new THREE.MeshStandardMaterial({ color: 0xc9d2da, roughness: 0.5, metalness: 0.3, flatShading: true })),
  );
  collar.position.set(0, 1.42, 0.25);
  collar.rotation.x = Math.PI / 2;
  group.add(collar);
  // Oxygen tank backpack.
  const tank = new THREE.Mesh(
    geo('tank', () => new THREE.CylinderGeometry(0.12, 0.12, 0.5, 8)),
    mat('tankmat', () => new THREE.MeshStandardMaterial({ color: 0xcfd6dd, roughness: 0.4, metalness: 0.4, flatShading: true })),
  );
  tank.position.set(0, 1.0, 0.5);
  group.add(tank);

  // ----- A couple of glowing jugs on the counter -----
  const jugs = [];
  for (const jx of [-0.7, 0.55]) {
    const jug = buildBubbleJug();
    jug.scale.setScalar(0.5);
    jug.position.set(jx, 1.06, -0.6);
    jug.rotation.y = rng() * Math.PI;
    group.add(jug);
    jugs.push(jug);
  }

  // ----- Decorative floating bubbles drifting above the stand -----
  const bubbleMat = mat('floatbub', () => new THREE.MeshStandardMaterial({
    color: 0xffffff, transparent: true, opacity: 0.35, roughness: 0.1,
    emissive: 0xbfeaff, emissiveIntensity: 0.5, depthWrite: false,
  }));
  const bubbleGeo = geo('floatbubgeo', () => new THREE.SphereGeometry(0.12, 10, 8));
  const floaters = [];
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(bubbleGeo, bubbleMat);
    const ang = rng() * Math.PI * 2;
    b.position.set(Math.cos(ang) * 0.9, 1.3 + rng() * 1.2, -0.6 + Math.sin(ang) * 0.5);
    b.scale.setScalar(0.6 + rng() * 0.9);
    b.userData.phase = rng() * Math.PI * 2;
    b.userData.baseY = b.position.y;
    group.add(b);
    floaters.push(b);
  }

  let t = Math.random() * 10;
  group.userData.anim = (dt) => {
    t += dt;
    for (const j of jugs) j.userData.anim?.(dt);
    for (const b of floaters) {
      b.position.y = b.userData.baseY + Math.sin(t * 0.9 + b.userData.phase) * 0.18;
      b.rotation.y += dt * 0.5;
    }
  };
  group.userData.anim(0);
  return group;
}
