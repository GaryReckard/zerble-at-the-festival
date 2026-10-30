// Frozen pre-change geometry for the visual comparison only.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
function mergeGeometrySet(parts) {
 const flat=parts.map(g=>g.index?g.toNonIndexed():g.clone());
 const result=mergeGeometries(flat);
 for(const g of [...parts,...flat])g.dispose();
 return result;
}
export function buildBaselineHair() {
    const hairCap = new THREE.SphereGeometry(0.22, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.58);
    hairCap.scale(1.02, 0.72, 0.94); hairCap.translate(0, 1.79, 0.005);
    const fringe = new THREE.IcosahedronGeometry(0.13, 0);
    fringe.scale(1.0, 0.54, 0.62); fringe.translate(0, 1.72, -0.14);
    const sideL = new THREE.BoxGeometry(0.07, 0.18, 0.13); sideL.translate(-0.19, 1.67, -0.005);
    const sideR = new THREE.BoxGeometry(0.07, 0.18, 0.13); sideR.translate(0.19, 1.67, -0.005);
    const shortHair = mergeGeometrySet([hairCap, fringe, sideL, sideR]);
    const curlParts = [];
    // A rounded crown plus separate coils reads as curls rather than a larger cap.
    for (let ring = 0; ring < 2; ring++) for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 + ring * .3;
      const coil = new THREE.IcosahedronGeometry(.09, 0);
      coil.translate(Math.cos(a) * (ring ? .17 : .13), ring ? 1.75 : 1.91, Math.sin(a) * (ring ? .16 : .12));
      curlParts.push(coil);
    }
    const curls = mergeGeometrySet(curlParts);
    const longCap = new THREE.SphereGeometry(0.22, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.62);
    longCap.scale(1.02, 0.75, 0.94); longCap.translate(0, 1.79, 0.005);
    const lockL = new THREE.CapsuleGeometry(0.075, 0.52, 2, 5); lockL.translate(-0.19, 1.36, 0.035);
    const lockR = new THREE.CapsuleGeometry(0.075, 0.52, 2, 5); lockR.translate(0.19, 1.36, 0.035);
    const backHair = new THREE.BoxGeometry(.35, .58, .13); backHair.translate(0, 1.4, .16);
    const longHair = mergeGeometrySet([longCap, lockL, lockR, backHair]);
    const ponyTail = new THREE.CapsuleGeometry(.085, .45, 2, 5);
    ponyTail.rotateX(-.3); ponyTail.translate(0, 1.49, .3);
    const ponytail = mergeGeometrySet([shortHair.clone(), ponyTail]);
    const hairBun = new THREE.IcosahedronGeometry(.145, 1);
    hairBun.scale(1, .9, 1); hairBun.translate(0, 1.95, .13);
    const bun = mergeGeometrySet([shortHair.clone(), hairBun]);
    const braidParts = [shortHair.clone()];
    for (const side of [-1, 1]) for (let i = 0; i < 6; i++) {
      const knot = new THREE.IcosahedronGeometry(.067 - i * .003, 0);
      knot.scale(1, 1.2, 1);
      knot.translate(side * (.19 + .018 * Math.sin(i * Math.PI / 2)), 1.64 - i * .095, .08 + (i % 2) * .02);
      braidParts.push(knot);
    }
    const braids = mergeGeometrySet(braidParts);


return [shortHair,curls,longHair,ponytail,bun,braids];
}
