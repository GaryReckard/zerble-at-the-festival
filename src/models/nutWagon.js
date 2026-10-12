import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// +Z is forward; -X is the passenger side. Mount coordinates are model-local,
// with seated mounts at cushion height so a future rider controller owns poses.
export const NUT_WAGON_MOUNTS = Object.freeze([
    {name: 'driver', position: [0.48, 0.77, 0.45], facing: 0, pose: 'seated'},
    {name: 'front_passenger', position: [-0.48, 0.77, 0.45], facing: 0, pose: 'seated'},
    {name: 'rear_left', position: [0.48, 0.77, -0.55], facing: 0, pose: 'seated'},
    {name: 'rear_right', position: [-0.48, 0.77, -0.55], facing: 0, pose: 'seated'},
    {name: 'roof_left', position: [0.38, 2.11, -1.13], facing: 0, pose: 'seated'},
    {name: 'roof_right', position: [-0.38, 2.11, -1.13], facing: 0, pose: 'seated'},
    {name: 'cargo_left', position: [0.42, 0.64, -2.02], facing: Math.PI, pose: 'seated'},
    {name: 'cargo_right', position: [-0.42, 0.64, -2.02], facing: Math.PI, pose: 'seated'},
    {name: 'platform', position: [-0.30, 0.47, 3.02], facing: 0, pose: 'standing'},
].map(m => Object.freeze({...m, position: Object.freeze(m.position)})));

let template;
function texture(paint, width = 512, height = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    paint(canvas.getContext('2d'), width, height);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.userData.shared = true;
    return map;
}

function createTemplate() {
    const root = new THREE.Group();
    const material = (color, extras = {}) => {
        const m = new THREE.MeshStandardMaterial({color, roughness: 0.78, ...extras});
        m.userData.shared = true;
        return m;
    };
    const green = material(0x329b32), pink = material(0xef528c);
    const black = material(0x25282a), metal = material(0x999c91, {metalness: 0.45});
    const tan = material(0x98784c), trim = material(0x45443b);
    const glass = material(0x56777b, {transparent: true, opacity: 0.33, depthWrite: false, side: THREE.DoubleSide});
    const yellow = material(0xf5c52a), orange = material(0xec772a), red = material(0xb93629);
    const lens = material(0xe0dbc0, {roughness: 0.35});
    const paintMap = texture((c, w, h) => {
        c.fillStyle = '#e44929'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#efca26'; c.beginPath(); c.moveTo(w * .29, 0);
        for (let y = 0; y <= h; y += 32) c.lineTo(w * (.30 + (y % 64 ? .10 : -.02)), y);
        c.lineTo(w, h); c.lineTo(w, 0); c.fill();
        c.fillStyle = '#31962e'; c.beginPath(); c.moveTo(w, 0); c.lineTo(w * .73, 0);
        for (let y = 0; y < h; y += 64) c.bezierCurveTo(w * .58, y + 20, w * .88, y + 42, w * .73, y + 64);
        c.lineTo(w, h); c.fill();
        for (let i = 0; i < 60; i++) {
            c.fillStyle = i % 3 ? '#807c5555' : '#ecdf9c55';
            c.fillRect((i * 137) % w, (i * 83) % h, 3 + i % 12, 1 + i % 4);
        }
        c.font = '14px serif';
        ['learn', 'wonder', 'explore', 'flower'].forEach((t, i) => {
            c.fillStyle = '#e4e0cb'; c.fillRect(210 + i % 2 * 18, 100 + i * 30, 65, 19);
            c.fillStyle = '#37382b'; c.fillText(t, 215 + i % 2 * 18, 114 + i * 30);
        });
    });
    const painted = material(0xffffff, {map: paintMap});
    const stickers = material(0xffffff, {side: THREE.DoubleSide, map: texture((c, w, h) => {
        c.fillStyle = '#3b4540'; c.fillRect(0, 0, w, h);
        const colors = ['#ecd330', '#e7dcca', '#d66a83', '#91c7b4', '#bd8649'];
        for (let i = 0; i < 26; i++) {
            const x = 12 + (i * 151) % 445, y = 12 + (i * 71) % 195;
            c.save(); c.translate(x, y); c.rotate(Math.sin(i * 6) * .14);
            c.fillStyle = colors[i % colors.length];
            c.fillRect(0, 0, 40 + i % 4 * 7, 20 + i % 3 * 8);
            c.fillStyle = '#35382d'; c.font = 'bold 10px sans-serif';
            c.fillText(['LEAF', 'LOVE', 'meh.', 'BE KIND', 'NUTS'][i % 5], 3, 14); c.restore();
        }
        for (const x of [335, 420]) {
            c.fillStyle = '#edce30'; c.beginPath(); c.arc(x, 175, 28, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#343a2b'; c.beginPath(); c.arc(x - 9, 168, 3, 0, 7); c.arc(x + 9, 168, 3, 0, 7); c.fill();
            c.strokeStyle = '#343a2b'; c.lineWidth = 3; c.beginPath(); c.arc(x, 176, 15, .15, Math.PI - .15); c.stroke();
        }
    }, 512, 256)});
    const meshFloor = material(0x77766e, {side: THREE.DoubleSide, alphaTest: .5, map: texture((c) => {
        c.strokeStyle = '#b0aaa0'; c.lineWidth = 5;
        c.beginPath(); c.moveTo(0, 16); c.lineTo(16, 0); c.lineTo(32, 16); c.lineTo(16, 32); c.closePath(); c.stroke();
    }, 32, 32)});
    meshFloor.map.wrapS = meshFloor.map.wrapT = THREE.RepeatWrapping;
    meshFloor.map.repeat.set(14, 13);
    const box = (parent, mat, x, y, z, w, h, d, shadow = false) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
    };
    const beam = (parent, mat, a, b, radius = .025) => {
        const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
        const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, start.distanceTo(end), 8), mat);
        m.position.copy(start).add(end).multiplyScalar(.5);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
        parent.add(m); return m;
    };
    const plane = (parent, mat, w, h, x, y, z, rx = 0) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.x = rx; parent.add(m); return m;
    };
    box(root, black, 0, .48, 0, 1.84, .22, 4.7, true);
    box(root, trim, 0, .63, -.64, 1.78, .09, 3.28);
    box(root, green, 0, .91, 1.66, 1.70, .58, 1.45, true);
    plane(root, painted, 1.94, 1.46, 0, 1.207, 1.66, -Math.PI / 2);
    box(root, green, 0, 1.88, -.64, 1.87, .12, 3.18, true);
    plane(root, painted, 1.80, 1.7, 0, 1.945, .03, -Math.PI / 2);
    for (const x of [-.98, .98]) {
        const outline = new THREE.Shape();
        outline.moveTo(.93, .53); outline.lineTo(.93, 1.20);
        outline.lineTo(2.39, 1.20); outline.lineTo(2.39, .53);
        outline.absarc(1.55, .39, .45, Math.asin(.14 / .45), Math.PI - Math.asin(.14 / .45), false);
        outline.lineTo(.93, .53);
        const fender = new THREE.Mesh(new THREE.ExtrudeGeometry(outline, {depth: .09, bevelEnabled: false, curveSegments: 12}), green);
        fender.rotation.y = -Math.PI / 2; fender.position.x = x + .045;
        fender.castShadow = true; root.add(fender);
        box(root, green, x, .99, -1.82, .13, .64, 1.10, true);
        box(root, green, x, .62, -.1, .10, .14, 2.65);
        beam(root, pink, [x, .56, 1.24], [x, .56, -2.32], .034);
        beam(root, green, [x, 1.15, 1.0], [x * .92, 1.88, .56], .055);
        beam(root, green, [x, .65, -.2], [x * .94, 1.85, -.2], .055);
        beam(root, green, [x, 1.17, -1.25], [x * .94, 1.84, -1.25], .047);
        beam(root, green, [x, 1.12, -2.36], [x * .92, 1.87, -2.20], .052);
        beam(root, metal, [x * .9, 2.015, .3], [x * .9, 2.015, -1.98], .023);
        for (const z of [.3, -1.9]) beam(root, metal, [x * .9, 1.94, z], [x * .9, 2.015, z], .025);
        for (const z of [1.55, -1.55]) {
            // Each wheel is independently addressable; shared buffers survive unloads.
            const wheel = new THREE.Group(); wheel.name = `wheel_${x < 0 ? 'right' : 'left'}_${z > 0 ? 'front' : 'rear'}`;
            wheel.position.set(x, .39, z); root.add(wheel);
            const tire = new THREE.Mesh(new THREE.CylinderGeometry(.39, .39, .23, 20), black); tire.rotation.z = Math.PI / 2; wheel.add(tire);
            const hub = new THREE.Mesh(new THREE.CylinderGeometry(.26, .26, .245, 16), metal); hub.rotation.z = Math.PI / 2; wheel.add(hub);
            for (let i = 0; i < 8; i++) {
                const angle = i * Math.PI / 4;
                box(wheel, trim, Math.sign(x) * .125, Math.cos(angle) * .19, Math.sin(angle) * .19, .008, .07, .045);
            }
        }
    }
    const windshield = plane(root, glass, 1.76, .86, 0, 1.52, .80, -.53);
    windshield.name = 'windshield';
    beam(root, black, [-.85, 1.15, 1.035], [.85, 1.15, 1.035], .025);
    box(root, black, 0, 1.09, .88, 1.77, .12, .24);
    for (const x of [-.48, .48]) for (const z of [.4, -.65]) {
        box(root, tan, x, .72, z, .69, .16, .67);
        const seatBack = box(root, tan, x, 1.02, z - .3, .69, .62, .13); seatBack.rotation.x = -.10;
    }
    const steering = new THREE.Mesh(new THREE.TorusGeometry(.19, .023, 6, 16), black);
    steering.position.set(.48, 1.12, .7); steering.rotation.x = -.55; root.add(steering);
    for (const x of [-.53, .53]) beam(root, metal, [x, 1.94, -.76], [x, 2.04, -1.65], .027);
    box(root, tan, 0, 2.055, -1.17, 1.47, .16, .69, true);
    const roofBack = box(root, tan, 0, 2.43, -1.51, 1.47, .70, .16, true); roofBack.rotation.x = -.12;
    for (const x of [-.72, .72]) beam(root, metal, [x, 2.02, -1.48], [x, 2.51, -1.59], .027);
    box(root, metal, 0, .98, 2.41, 1.0, .57, .08);
    for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 3; j++) box(root, [red, yellow, green][j], (j - 1) * .30, .745 + i * .047, 2.461, .29, .024, .015);
    }
    beam(root, metal, [0, .72, 2.48], [0, 1.25, 2.48], .013);
    for (const x of [-.73, .73]) {
        box(root, black, x, 1.0, 2.415, .43, .42, .08);
        box(root, lens, x, 1.0, 2.465, .33, .33, .025);
        box(root, orange, x * 1.27, 1, 2.44, .13, .36, .07);
        box(root, pink, x * 1.27, 1.21, 2.44, .16, .038, .09);
        for (let i = 0; i < 6; i++) box(root, metal, x - .14 + i * .057, 1, 2.481, .006, .30, .003);
    }
    box(root, pink, 0, .59, 2.43, 1.92, .16, .12);
    box(root, pink, 0, .51, -2.46, 2.02, .16, .12);
    for (const x of [-.91, .91]) for (let i = 0; i < 4; i++) box(root, [red, orange, lens, red][i], x, .80 + i * .115, -2.424, .20, .10, .06);
    for (let i = 0; i < 14; i++) {
        const strip = box(root, green, -.91 + i * .14, .32 + Math.sin(i * 5) * .025, 2.38, .125, .31, .02);
        strip.rotation.z = Math.sin(i) * .1;
    }
    const platform = new THREE.Group(); platform.name = 'front_platform'; root.add(platform);
    plane(platform, meshFloor, 1.23, 1.25, -.64, .46, 2.99, -Math.PI / 2);
    for (const x of [-1.27, -.01]) beam(platform, pink, [x, .46, 2.37], [x, .46, 3.48], .055);
    beam(platform, pink, [-1.27, .46, 3.48], [-.01, .46, 3.48], .06);
    for (const x of [-1.14, -.14]) beam(platform, metal, [x, .42, 3.45], [x, .43, 1.95], .025);
    beam(root, black, [-.64, .44, 2.96], [-.71, 4.28, 2.98], .037);
    for (const y of [.67, 1.0, 3.99]) beam(root, pink, [-.64 - (y-.44)*.018, y, 2.97], [-.64 - (y-.44)*.018, y + .20, 2.97], .042);
    const badgeMaterial = material(0xffffff, {map: texture((c, w, h) => {
        c.fillStyle = '#aaa99b'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#292f2b'; c.font = 'bold 26px monospace'; c.fillText('TURBO', 14, 30);
    }, 128, 48)});
    plane(root, badgeMaterial, .35, .09, .28, 1.24, 2.465);
    for (let i = 0; i < 9; i++) {
        beam(root, trim, [-.63 + i * .16, 2.15, -1.46], [-.63 + i * .16, 2.66, -1.53], .006);
    }
    const hatch = new THREE.Group(); hatch.name = 'hatch'; hatch.position.set(0, 1.87, -2.21); root.add(hatch);
    box(hatch, green, 0, -.61, 0, 1.85, 1.24, .075);
    plane(hatch, stickers, 1.65, .85, 0, -.51, .043);
    const outside = plane(hatch, stickers, 1.65, .85, 0, -.51, -.043); outside.rotation.y = Math.PI;
    const supports = new THREE.Group(); supports.name = 'hatch_supports'; root.add(supports);
    for (const x of [-.88, .88]) {
        beam(supports, pink, [x, .87, -2.39], [x, 2.32, -3.23], .048);
        for (let i = 0; i < 15; i++) {
            const y = .87 + i * .096, z = -2.39 - i * .056;
            beam(supports, [yellow, green, orange, metal][i % 4], [x, y, z], [x, y + .045, z - .026], .051);
        }
    }
    const rearLabel = material(0xffffff, {map: texture((c, w, h) => {
        c.fillStyle = '#d5d1ba'; c.fillRect(0, 0, w, h); c.fillStyle = '#292d27'; c.font = '34px serif'; c.fillText('following Corn', 7, 43);
    }, 256, 64)});
    const label = plane(root, rearLabel, .83, .17, 0, .51, -2.527); label.rotation.y = Math.PI;
    for (const x of [-.99, .99]) {
        const stickerPanel = plane(root, stickers, .70, .29, x, 1.06, -1.86); stickerPanel.rotation.y = Math.sign(x) * Math.PI / 2;
    }
    // Static pieces share a small number of material batches; wheels and hatch
    // retain separate local transforms for later movement without rebuilding.
    const batch = parent => {
        const buckets = new Map();
        for (const child of [...parent.children]) {
            if (!child.isMesh) { batch(child); continue; }
            child.updateMatrix();
            const key = `${child.material.uuid}:${child.castShadow}`;
            if (!buckets.has(key)) buckets.set(key, {mat: child.material, shadow: child.castShadow, geometries: []});
            const baked = child.geometry.clone().applyMatrix4(child.matrix);
            if (!baked.index) baked.setIndex(Array.from({length: baked.attributes.position.count}, (_, i) => i));
            buckets.get(key).geometries.push(baked);
            child.geometry.dispose(); parent.remove(child);
        }
        for (const {mat, shadow, geometries} of buckets.values()) {
            const geometry = mergeGeometries(geometries, false);
            geometries.forEach(g => g.dispose()); geometry.userData.shared = true;
            const mesh = new THREE.Mesh(geometry, mat); mesh.castShadow = shadow; mesh.receiveShadow = true; parent.add(mesh);
        }
    };
    batch(root);
    return root;
}

export function buildNutWagon({hatchOpen = true} = {}) {
    if (!template) template = createTemplate();
    const root = template.clone(true);
    root.name = 'nut_wagon';
    const hatch = root.getObjectByName('hatch');
    hatch.rotation.x = hatchOpen ? 1.95 : 0;
    root.getObjectByName('hatch_supports').visible = hatchOpen;
    root.userData.riderMounts = NUT_WAGON_MOUNTS.map(m => ({...m, position: [...m.position]}));
    root.userData.hatch = hatch;
    root.userData.wheels = root.children.filter(c => c.name.startsWith('wheel_'));
    return root;
}
