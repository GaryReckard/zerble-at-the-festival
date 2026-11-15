import * as THREE from 'three';

export const CORNHOLE_BOARD = Object.freeze({ width: .7, length: 1.3,
  frontHeight: .07, backHeight: .30, thickness: .035, holeRadius: .095, holeZ: -.40 });
const shared = resource => { resource.userData.shared = true; return resource; };
const wood = shared(new THREE.MeshStandardMaterial({ color: 0xd3ad76, roughness: .88 }));
const colors = [0x398f8e, 0xbb5350].map(color => shared(new THREE.MeshStandardMaterial({ color, roughness: .9 })));
const box = shared(new THREE.BoxGeometry(1, 1, 1));
let deck;
function deckGeometry() {
  if (deck) return deck;
  const b = CORNHOLE_BOARD, shape = new THREE.Shape();
  shape.moveTo(-b.width / 2, -b.length / 2);
  shape.lineTo(b.width / 2, -b.length / 2); shape.lineTo(b.width / 2, b.length / 2);
  shape.lineTo(-b.width / 2, b.length / 2); shape.closePath();
  const hole = new THREE.Path(); hole.absarc(0, -b.holeZ, b.holeRadius, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  deck = new THREE.ExtrudeGeometry(shape, { depth: b.thickness, bevelEnabled: false, curveSegments: 12, steps: 1 });
  // Shape Y becomes minus world Z; preserve the hole through the actual deck.
  deck.rotateX(-Math.PI / 2);
  const p = deck.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) - b.thickness + (b.frontHeight + b.backHeight) / 2 - p.getZ(i) * (b.backHeight - b.frontHeight) / b.length);
  deck.computeVertexNormals(); shared(deck);
  return deck;
}
function block(parent, material, x, y, z, width, height, depth) {
  const mesh = new THREE.Mesh(box, material); mesh.position.set(x, y, z); mesh.scale.set(width, height, depth);
  mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

export function buildCornholeGame({ seed = 1 } = {}) {
  const game = new THREE.Group(); game.name = 'CornholeGame';
  const b = CORNHOLE_BOARD, boards = [], bags = [];
  for (let i = 0; i < 2; i++) {
    const group = new THREE.Group(); group.name = `CornholeBoard${i}`;
    group.position.z = i === 0 ? -4.2 : 4.2; group.rotation.y = i * Math.PI;
    const top = new THREE.Mesh(deckGeometry(), wood); top.receiveShadow = true; group.add(top);
    for (const side of [-1, 1]) {
      block(group, colors[i], side * .30, .13, -.50, .045, .26, .055);
      const stripe = block(group, colors[i], side * .31, .187, 0, .035, .005, 1.29);
      stripe.rotation.x = Math.atan((b.backHeight - b.frontHeight) / b.length);
    }
    game.add(group); boards.push({ ...b, group, position: group.position, yaw: group.rotation.y });
  }
  for (let i = 0; i < 8; i++) {
    const bag = block(game, colors[i % 2], 0, 0, 0, .14, .045, .14);
    bag.name = `CornholeBag${i}`; bags.push(bag);
  }
  const resetBags = () => {
    for (let i = 0; i < bags.length; i++) {
      const bag = bags[i], side = -1;
      bag.position.set(.55 + (i % 2) * .17, .025 + Math.floor(i / 4) * .05, side * (4.15 + Math.floor(i / 2) % 2 * .17));
      bag.rotation.set(0, ((seed >>> 0) % 31 + i * 7) * .13, 0); bag.visible = true;
    }
  };
  game.userData.cornhole = { boards, bags, resetBags }; resetBags();
  return game;
}
