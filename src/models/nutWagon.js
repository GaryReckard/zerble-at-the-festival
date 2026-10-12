import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// +Z is forward; -X is the passenger side. Mount coordinates are model-local,
// with seated mounts at cushion height so a future rider controller owns poses.
// Mercedes-Benz public archive, S 123 D 30 (oid=5380), stock European body.
// Homemade bumpers/accessories and the exact donor trim are photo estimates.
export const NUT_WAGON_DIMENSIONS = Object.freeze({length: 4.725, width: 1.786, height: 1.470, wheelbase: 2.795});
const bodyScale = [1.786 / 2.09, 1.470 / 2.038, 4.725 / 5.04];
const modelPosition = p => p.map((v, i) => v * bodyScale[i]);
export const NUT_WAGON_MOUNTS = Object.freeze([
    {name: 'driver', position: [0.48, 0.77, 0.45], facing: 0, pose: 'seated'},
    {name: 'front_passenger', position: [-0.48, 0.77, 0.45], facing: 0, pose: 'seated'},
    {name: 'rear_left', position: [0.48, 0.77, -0.55], facing: 0, pose: 'seated'},
    {name: 'rear_right', position: [-0.48, 0.77, -0.55], facing: 0, pose: 'seated'},
    {name: 'roof_left', position: [0.38, 2.11, -1.49], facing: 0, pose: 'seated'},
    {name: 'roof_right', position: [-0.38, 2.11, -1.49], facing: 0, pose: 'seated'},
    {name: 'cargo_left', position: [0.42, 0.83, -1.91], facing: Math.PI, pose: 'seated'},
    {name: 'cargo_right', position: [-0.42, 0.83, -1.91], facing: Math.PI, pose: 'seated'},
    {name: 'platform', position: [-0.30, 0.47, 3.02], facing: 0, pose: 'standing'},
].map(m => Object.freeze({...m, position: Object.freeze(modelPosition(m.position))})));

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
    // A crowned bonnet falls toward a raked nose instead of a rectangular slab.
    const nose = new THREE.Group(); root.add(nose);
    box(nose, green, 0, .91, 1.72, 1.70, .58, 1.33, true);
    const hood = new THREE.Mesh(new THREE.PlaneGeometry(1.94, 1.34, 8, 4), painted);
    hood.rotation.x = -Math.PI / 2; hood.position.set(0, 1.207, 1.72); nose.add(hood);
    box(root, green, 0, 1.88, -.84, 1.75, .12, 2.78, true);
    plane(root, painted, 1.68, 1.30, 0, 1.945, -.14, -Math.PI / 2);
    for (const x of [-.98, .98]) {
        const outline = new THREE.Shape();
        outline.moveTo(.93, .53); outline.lineTo(.93, 1.20);
        outline.lineTo(2.39, 1.20); outline.lineTo(2.39, .53);
        outline.absarc(1.49, .437, .50, Math.asin(.093 / .50), Math.PI - Math.asin(.093 / .50), false);
        outline.lineTo(.93, .53);
        const fender = new THREE.Mesh(new THREE.ExtrudeGeometry(outline, {depth: .09, bevelEnabled: false, curveSegments: 12}), green);
        fender.rotation.y = -Math.PI / 2; fender.position.x = x + .045;
        fender.castShadow = true; nose.add(fender);
        const rearOutline = new THREE.Shape();
        rearOutline.moveTo(-2.39, .53); rearOutline.lineTo(-2.39, 1.18);
        rearOutline.lineTo(-1.03, 1.28); rearOutline.lineTo(-1.03, .53);
        rearOutline.absarc(-1.49, .437, .50, Math.asin(.093 / .50), Math.PI - Math.asin(.093 / .50), false);
        rearOutline.lineTo(-2.39, .53);
        const quarter = new THREE.Mesh(new THREE.ExtrudeGeometry(rearOutline, {depth: .13, bevelEnabled: false, curveSegments: 12}), green);
        quarter.rotation.y = -Math.PI / 2; quarter.position.x = x + .065;
        quarter.castShadow = true; root.add(quarter);
        box(root, green, x, .62, -.1, .10, .14, 2.65);
        beam(root, pink, [x, .56, 1.24], [x, .56, -1.02], .034);
        beam(root, green, [x, 1.15, 1.0], [x * .88, 1.88, .55], .055);
        beam(root, green, [x, .65, -.2], [x * .88, 1.85, -.2], .055);
        beam(root, green, [x, .68, -1.36], [x * .88, 1.84, -.94], .055);
        beam(root, metal, [x, 1.21, -1.16], [x, 1.21, -2.33], .018);
        beam(root, metal, [x, 1.21, -1.16], [x * .88, 1.82, -.94], .018);
        beam(root, metal, [x * .88, 1.82, -.94], [x * .80, 1.82, -2.17], .018);
        beam(root, green, [x, 1.12, -2.36], [x * .80, 1.87, -2.20], .052);
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
    for (const x of [-.48, .48]) for (const z of [.4]) {
        box(root, black, x, .72, z, .69, .16, .67);
        const seatBack = box(root, black, x, 1.02, z - .3, .69, .62, .13); seatBack.rotation.x = -.10;
    }
    box(root, black, 0, .73, -.68, 1.56, .16, .68);
    box(root, black, 0, 1.02, -.98, 1.56, .58, .12);
    for (const x of [-.48, .48]) box(root, black, x, 1.39, .1, .34, .27, .12);
    const cargoBench = new THREE.Group(); cargoBench.name = 'cargo_bench'; root.add(cargoBench);
    box(cargoBench, black, 0, .75, -1.91, 1.42, .16, .60);
    box(cargoBench, black, 0, 1.01, -1.60, 1.42, .55, .12);
    for (const x of [-.55, .55]) box(cargoBench, metal, x, .66, -1.91, .07, .12, .45);
    const steering = new THREE.Mesh(new THREE.TorusGeometry(.19, .023, 6, 16), black);
    steering.position.set(.48, 1.12, .7); steering.rotation.x = -.55; root.add(steering);
    for (const x of [-.53, .53]) beam(root, metal, [x, 1.94, -1.12], [x, 2.04, -2.01], .027);
    box(root, tan, 0, 2.055, -1.53, 1.47, .16, .69, true);
    const roofBack = box(root, tan, 0, 2.43, -1.87, 1.47, .70, .16, true); roofBack.rotation.x = -.12;
    for (const x of [-.72, .72]) beam(root, metal, [x, 2.02, -1.84], [x, 2.51, -1.95], .027);
    box(nose, metal, 0, .98, 2.41, 1.0, .57, .08);
    for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 3; j++) box(nose, [red, yellow, green][j], (j - 1) * .30, .745 + i * .047, 2.461, .29, .024, .015);
    }
    beam(nose, metal, [0, .72, 2.48], [0, 1.25, 2.48], .013);
    for (const x of [-.73, .73]) {
        box(nose, black, x, 1.0, 2.415, .43, .42, .08);
        box(nose, lens, x, 1.0, 2.465, .33, .33, .025);
        box(nose, orange, x * 1.27, 1, 2.44, .13, .36, .07);
        box(nose, pink, x * 1.27, 1.21, 2.44, .16, .038, .09);
        for (let i = 0; i < 6; i++) box(nose, metal, x - .14 + i * .057, 1, 2.481, .006, .30, .003);
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
    plane(nose, badgeMaterial, .35, .09, .28, 1.24, 2.465);
    for (let i = 0; i < 9; i++) {
        beam(root, trim, [-.63 + i * .16, 2.15, -1.82], [-.63 + i * .16, 2.66, -1.89], .006);
    }
    const hatch = new THREE.Group(); hatch.name = 'hatch'; hatch.position.set(0, 1.87, -2.21); root.add(hatch);
    box(hatch, green, 0, -.61, 0, 1.85, 1.24, .075);
    plane(hatch, stickers, 1.65, .85, 0, -.51, .043);
    const outside = plane(hatch, stickers, 1.65, .85, 0, -.51, -.043); outside.rotation.y = Math.PI;
    const supports = new THREE.Group(); supports.name = 'hatch_supports'; root.add(supports);
    for (const x of [-.88, .88]) {
        beam(supports, pink, [x, .87, -2.39], [x, 2.32, -3.08], .048);
        for (let i = 0; i < 15; i++) {
            const y = .87 + i * .096, z = -2.39 - i * .046;
            beam(supports, [yellow, green, orange, metal][i % 4], [x, y, z], [x, y + .045, z - .022], .051);
        }
    }
    const rearLabel = material(0xffffff, {map: texture((c, w, h) => {
        c.fillStyle = '#dc5687'; c.fillRect(0, 0, w, h); c.fillStyle = '#d5dbd3'; c.font = 'bold 40px sans-serif'; c.fillText('L O V E', 25, 46);
    }, 256, 64)});
    const label = plane(root, rearLabel, .83, .17, 0, .51, -2.527); label.rotation.y = Math.PI;
    for (const x of [-.99, .99]) {
        const stickerPanel = plane(root, stickers, .70, .29, x, 1.06, -1.86); stickerPanel.rotation.y = Math.sign(x) * Math.PI / 2;
    }
    const rope = material(0xff762f, {emissive: 0xff4510, emissiveIntensity: .12});
    rope.userData.nutWagonLight = true;
    const bulbMats = [0xffdc78, 0xf3508c, 0x62daca, 0x8277ff].map(color => {
        const m = material(color, {emissive: color, emissiveIntensity: .12});
        m.userData.nutWagonLight = true;
        return m;
    });
    const lightString = (parent, points, colors, spacing = .13) => {
        for (let i = 1; i < points.length; i++) {
            const a = new THREE.Vector3(...points[i - 1]), b = new THREE.Vector3(...points[i]);
            beam(parent, trim, points[i - 1], points[i], .009);
            const count = Math.ceil(a.distanceTo(b) / spacing);
            for (let j = 0; j < count; j++) {
                const bulb = new THREE.Mesh(new THREE.SphereGeometry(.024, 6, 4), colors[(i + j) % colors.length]);
                bulb.position.copy(a).lerp(b, j / count); parent.add(bulb);
            }
        }
    };
    lightString(root, [[-.78, 1.85, -2.25], [-.94, 1.2, -2.42], [-.9, .62, -2.56], [-.77, .55, -2.56], [.77, .55, -2.56], [.9, .62, -2.56], [.94, 1.2, -2.42], [.78, 1.85, -2.25]], [rope]);
    lightString(hatch, [[-.84, -.05, .06], [-.88, -1.18, .06], [.88, -1.18, .06], [.84, -.05, .06]], [rope]);
    lightString(root, [[-.76, 1.79, -2.23], [0, 1.71, -2.23], [.76, 1.79, -2.23]], bulbMats, .15);
    for (const x of [-.87, .87]) lightString(root, [[x, 2.03, -2.0], [x, 2.03, .3]], bulbMats, .18);
    for (const child of [...nose.children]) {
        child.updateMatrix(); child.geometry.applyMatrix4(child.matrix);
        const positions = child.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
            const front = THREE.MathUtils.clamp((z - 1.05) / 1.35, 0, 1);
            // Face top sits behind its base; bonnet shoulders roll down at the edges.
            positions.setXYZ(i, x * (1 - .035 * front),
                y - .105 * front * THREE.MathUtils.clamp((y - .55) / .65, 0, 1)
                  - .035 * Math.pow(Math.abs(x), 4) * Math.max(0, (y - 1.05) / .16),
                z - .20 * Math.max(0, y - .65) * front);
        }
        child.geometry.computeVertexNormals();
        child.position.set(0, 0, 0); child.rotation.set(0, 0, 0); root.add(child);
    }
    root.remove(nose);
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
    // Bake physical proportions into buffers, keeping root/mount coordinates in metres.
    root.traverse(node => {
        node.position.multiply(new THREE.Vector3(...bodyScale));
        if (node.isMesh) node.geometry.scale(...bodyScale);
    });
    for (const wheel of root.children.filter(c => c.name.startsWith('wheel_'))) {
        wheel.position.z = Math.sign(wheel.position.z) * NUT_WAGON_DIMENSIONS.wheelbase / 2;
        wheel.position.y = .315;
        wheel.position.x = Math.sign(wheel.position.x) * (wheel.name.endsWith('front') ? .744 : .7265);
        // Correct tyre diameter independently so proportion changes never squash wheels.
        for (const mesh of wheel.children) mesh.geometry.scale(1, .315 / (.39 * bodyScale[1]), .315 / (.39 * bodyScale[2]));
    }
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
    const lights = new Set();
    root.traverse(node => { if (node.material?.userData.nutWagonLight) lights.add(node.material); });
    root.userData.lightMaterials = [...lights];
    return root;
}

export function setNutWagonNightness(root, nightness) {
    const intensity = .12 + Math.max(0, Math.min(1, nightness)) * 3.2;
    for (const material of root.userData.lightMaterials) material.emissiveIntensity = intensity;
}
