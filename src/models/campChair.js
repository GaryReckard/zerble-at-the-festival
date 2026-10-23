import * as THREE from 'three';

const COLORS = [0xc44a4a, 0x3b7fbe, 0x4f9c4f, 0xd4c177, 0xb86bc7, 0x444b55];
export const CAMP_CHAIR_STYLES = Object.freeze(['sling', 'director', 'low', 'loveseat']);
const SINGLE_STYLES = CAMP_CHAIR_STYLES.slice(0, 3);
const tube = new THREE.CylinderGeometry(1, 1, 1, 6);
const box = new THREE.BoxGeometry(1, 1, 1);
const cupRing = new THREE.TorusGeometry(.047, .009, 4, 10);
// Six vertices make a shallow fabric sling, retaining a visible centre sag.
// The same panel is transformed into seats and backs for every chair style.
const fabricPanel = new THREE.BufferGeometry();
fabricPanel.setAttribute('position', new THREE.Float32BufferAttribute([
  -.5, -.5, 0, 0, -.5, -.06, .5, -.5, 0,
  -.5, .5, 0, 0, .5, -.06, .5, .5, 0,
], 3));
fabricPanel.setIndex([0, 1, 3, 1, 4, 3, 1, 2, 4, 2, 5, 4]);
fabricPanel.computeVertexNormals();
for (const geometry of [tube, box, cupRing, fabricPanel]) geometry.userData.shared = true;
const materials = new Map();
function material(color, metal = false) {
  const key = `${color}:${metal}`;
  if (!materials.has(key)) {
    const value = new THREE.MeshStandardMaterial({ color, roughness: metal ? .55 : .96,
      metalness: metal ? .3 : 0, side: THREE.DoubleSide, flatShading: true });
    value.userData.shared = true;
    materials.set(key, value);
  }
  return materials.get(key);
}
const up = new THREE.Vector3(0, 1, 0);

export function buildCampChair(rng = Math.random, options = {}) {
  // One historical palette draw remains the entire caller RNG contract.
  const draw = rng();
  const color = COLORS[Math.min(COLORS.length - 1, Math.floor(draw * COLORS.length))];
  const style = CAMP_CHAIR_STYLES.includes(options.style) ? options.style
    : SINGLE_STYLES[Math.floor((draw * 37 % 1) * SINGLE_STYLES.length)];
  const double = style === 'loveseat', low = style === 'low', director = style === 'director';
  const width = double ? 1.1 : .58, depth = low ? .54 : .48;
  const seatY = low ? .25 : director ? .48 : .44;
  const backHeight = low ? .56 : director ? .38 : .49;
  const group = new THREE.Group();
  const fabric = material(color), frame = material(director ? 0x9d9c91 : 0x292f31, true);
  const trim = material(0x24282a);
  function mesh(geometry, mat, x, y, z, sx = 1, sy = 1, sz = 1) {
    const part = new THREE.Mesh(geometry, mat);
    part.position.set(x, y, z); part.scale.set(sx, sy, sz);
    // All parts stay direct children, so the campsite's static batcher can
    // combine different chair styles without changing seat transform anchors.
    group.add(part);
    return part;
  }
  function rod(a, b, radius = .022) {
    const direction = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const length = direction.length();
    const part = mesh(tube, frame, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, radius, length, radius);
    part.quaternion.setFromUnitVectors(up, direction.normalize());
    return part;
  }
  const backZ = -depth / 2 - (low ? .14 : .04);
  for (const side of [-1, 1]) {
    const x = side * (width / 2 + .015);
    rod([x, .035, depth / 2], [x, seatY + .035, -depth / 2]);
    rod([x, .035, -depth / 2], [x, seatY + .035, depth / 2]);
    rod([x, seatY, -depth / 2], [x, seatY + backHeight, backZ]);
    mesh(box, trim, x, .027, depth / 2, .075, .045, .07);
    mesh(box, trim, x, .027, -depth / 2, .075, .045, .07);
    if (!low) {
      const armY = seatY + .17;
      rod([x, seatY, depth * .3], [x, armY, depth * .3], .018);
      mesh(box, director ? trim : fabric, x, armY, 0, .09, .035, depth * .9);
    }
  }
  rod([-width / 2, seatY, depth / 2], [width / 2, seatY, depth / 2], .018);
  rod([-width / 2, seatY + backHeight, backZ], [width / 2, seatY + backHeight, backZ], .018);
  const seatOffsets = double ? [-.27, .27] : [0];
  for (const offset of seatOffsets) {
    const seat = mesh(fabricPanel, fabric, offset, seatY, 0, double ? .51 : width - .03, depth, 1);
    seat.rotation.x = -Math.PI / 2;
    const back = mesh(fabricPanel, fabric, offset, seatY + backHeight / 2, -depth / 2 - (low ? .075 : .02), double ? .51 : width - .03, backHeight, 1);
    back.rotation.x = low ? -.25 : director ? 0 : -.08;
  }
  if (double) {
    rod([0, .035, depth / 2], [0, seatY, -depth / 2]);
    rod([0, .035, -depth / 2], [0, seatY, depth / 2]);
  }
  if (style === 'sling' || double) {
    const cup = mesh(cupRing, trim, width / 2 + .015, seatY + .195, depth * .25);
    cup.rotation.x = Math.PI / 2;
  }
  const footprint = Math.hypot(width / 2 + .065, Math.max(depth / 2 + .04, Math.abs(backZ))) + .01;
  // Claims sit at the bottom of the fabric sling, not the higher frame rail.
  return { group, color, footprint, seatY: seatY - .06, seatHeight: seatY - .06, seatOffsets, style,
    furniture: double ? 'loveseat' : 'chair', loveseat: double };
}
