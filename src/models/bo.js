import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// +Z faces forward. Seated origin is the cushion; standing origin is the ground.
const templates = new Map();
const colors = {skin: 0xe7ad8a, hair: 0x35291f, strand: 0x584332, shirt: 0xff751b,
    black: 0x171821, shoe: 0x303337, navy: 0x171b43, pink: 0xd92c91, gold: 0xffab24};
const material = new THREE.MeshStandardMaterial({vertexColors: true, roughness: .88});
material.userData.shared = true;

function geometryFor(seated) {
    const pieces = [];
    const hip = seated ? 0 : .79;
    const add = (geometry, color, p = [0,0,0], scale = [1,1,1], quaternion) => {
        const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
        geometry.dispose();
        g.deleteAttribute('uv');
        const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...p),
            quaternion || new THREE.Quaternion(), new THREE.Vector3(...scale));
        g.applyMatrix4(matrix);
        const c = new THREE.Color(color), values = new Float32Array(g.attributes.position.count * 3);
        for (let i = 0; i < values.length; i += 3) { values[i] = c.r; values[i+1] = c.g; values[i+2] = c.b; }
        g.setAttribute('color', new THREE.BufferAttribute(values, 3)); pieces.push(g);
    };
    const oval = (color, p, scale) => add(new THREE.SphereGeometry(1, 12, 8), color, p, scale);
    const limb = (color, a, b, radius) => {
        const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b), d = bv.clone().sub(av);
        add(new THREE.CylinderGeometry(radius * .88, radius, d.length(), 8), color,
            av.add(bv).multiplyScalar(.5).toArray(), [1,1,1],
            new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), d.normalize()));
    };
    const polygon = (points, color, z) => {
        const shape = new THREE.Shape(points.map(([x,y]) => new THREE.Vector2(x,y)));
        add(new THREE.ShapeGeometry(shape), color, [0,hip,z]);
    };
    oval(colors.black, [0,hip+.035,0], [.20,.10,.12]);
    for (const side of [-1,1]) {
        const x = side * .105;
        const knee = seated ? [x,hip+.025,.57] : [x, .43,.015];
        const ankle = seated ? [x,hip-.34,.72] : [x,.10,0];
        limb(colors.black,[x,hip,0],knee,.075);
        limb(colors.black,knee,ankle,.06);
        oval(colors.shoe,[x,ankle[1]-.035,ankle[2]+.055],[.075,.055,.14]);
    }
    add(new THREE.CylinderGeometry(.215,.16,.48,12),colors.shirt,[0,hip+.30,0],[1,1,.60]);
    oval(colors.skin,[0,hip+.57,0],[.075,.10,.07]);
    oval(colors.skin,[0,hip+.77,.01],[.145,.205,.132]);
    for (const side of [-1,1]) {
        oval(colors.skin,[side*.14,hip+.76,.005],[.035,.062,.035]);
        const shoulder = [side*.21,hip+.48,0];
        const elbow = seated ? [side*.24,hip+.24,.17] : [side*.255,hip+.23,.01];
        const hand = seated ? [side*.23,hip+.39,.425] : [side*.27,hip-.015,.04];
        limb(colors.shirt,shoulder,[side*.235,hip+.355,seated?.085:0],.092);
        limb(colors.skin,[side*.235,hip+.355,seated?.085:0],elbow,.056);
        limb(colors.skin,elbow,hand,.048);
        oval(colors.skin,hand,[.048,.065,.045]);
    }
    // Chest silhouette uses real geometry so it stays crisp without a texture.
    polygon([[-.155,.395],[-.115,.35],[-.065,.35],[-.035,.405],[-.025,.365],
        [.025,.365],[.035,.405],[.065,.35],[.115,.35],[.155,.395],
        [.145,.295],[.105,.32],[.085,.27],[.055,.29],[0,.235],
        [-.055,.29],[-.085,.27],[-.105,.32],[-.145,.295]],colors.black,.133);
    // Straight hair curtain, with a center part and long locks framing the face.
    oval(colors.hair,[0,hip+.64,-.095],[.18,.31,.085]);
    for (const side of [-1,1]) {
        oval(colors.hair,[side*.143,hip+.62,.025],[.061,.30,.074]);
        oval(colors.hair,[side*.08,hip+.93,0],[.10,.052,.13]);
        limb(colors.strand,[side*.17,hip+.82,.079],[side*.16,hip+.355,.083],.009);
        limb(colors.strand,[side*.13,hip+.90,-.166],[side*.14,hip+.39,-.16],.008);
        oval(0xfff5e9,[side*.06,hip+.80,.132],[.033,.016,.011]);
        oval(0x403423,[side*.059,hip+.80,.142],[.010,.011,.004]);
        limb(colors.hair,[side*.025,hip+.836,.133],[side*.09,hip+.839,.119],.008);
    }
    oval(colors.skin,[0,hip+.748,.143],[.023,.043,.032]);
    polygon([[-.060,.70],[-.038,.674],[0,.665],[.038,.674],[.060,.70],[0,.684]],0x663d32,.139);
    polygon([[-.046,.696],[0,.686],[.046,.696],[.029,.683],[0,.677],[-.029,.683]],0xfff3db,.141);

    // Soft patchwork crown and drooping brim, with broad mismatched panels.
    const palette = [colors.pink, colors.navy, colors.gold, colors.pink, colors.navy, colors.pink];
    const rings = [[0,.18,0],[.15,.175,-.025],[.30,.215,-.06],[.43,.195,-.025]];
    const point = (angle, ring) => [Math.cos(angle)*ring[1]+ring[2],hip+.955+ring[0],Math.sin(angle)*ring[1]*.91];
    const triangle = (a,b,c,color) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position',new THREE.Float32BufferAttribute([...a,...b,...c],3));
        g.computeVertexNormals(); add(g,color);
    };
    for (let row=0;row<3;row++) for(let i=0;i<24;i++) {
        const a=i*Math.PI/12,b=(i+1)*Math.PI/12;
        const p=point(a,rings[row]),q=point(b,rings[row]),r=point(b,rings[row+1]),s=point(a,rings[row+1]);
        const color=palette[(Math.floor(i/4)+(row===1?1:0))%palette.length];
        triangle(p,r,q,color); triangle(p,s,r,color);
    }
    for(let i=0;i<24;i++){
        const a=i*Math.PI/12,b=(i+1)*Math.PI/12;
        triangle([-.025,hip+1.385,0],point(b,rings[3]),point(a,rings[3]),palette[Math.floor(i/4)%6]);
        const inner=t=>[Math.cos(t)*.16,hip+.96,Math.sin(t)*.15];
        const outer=t=>[Math.cos(t)*.33,hip+.92+.045*Math.sin(t*3+.6),Math.sin(t)*.29];
        const p=inner(a),q=inner(b),r=outer(b),s=outer(a),color=palette[Math.floor(i/4)%6];
        triangle(p,q,r,color);triangle(p,r,s,color);
        triangle(r,q,p,color);triangle(s,r,p,color);
    }
    const merged = mergeGeometries(pieces,false);
    pieces.forEach(g=>g.dispose()); merged.userData.shared=true;
    merged.computeBoundingBox(); merged.computeBoundingSphere();
    return merged;
}

export function buildBo({seated = false} = {}) {
    if (!templates.has(seated)) templates.set(seated,geometryFor(seated));
    const root = new THREE.Group(); root.name = seated ? 'Bo seated' : 'Bo';
    const mesh = new THREE.Mesh(templates.get(seated),material);
    mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh);
    return root;
}

export function seatBoInWagon(wagon, mount) {
    const bo = buildBo({seated:true});
    bo.position.set(...mount.position);
    bo.position.y += .04;
    bo.scale.setScalar(.55);
    wagon.add(bo);
    return bo;
}
