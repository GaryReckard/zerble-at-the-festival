import {copyPersonHairGeometry} from '../crowdHair.js';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const cache = new Map();
const mat = new THREE.MeshStandardMaterial({vertexColors:true, roughness:.92});
mat.userData.shared = true;
function part(build) {
    const pieces = [];
    const add = (source, color, p=[0,0,0], scale=[1,1,1]) => {
        const g = source.index ? source.toNonIndexed() : source.clone(); source.dispose();
        g.deleteAttribute('uv'); g.scale(...scale); g.translate(...p);
        const c=new THREE.Color(color), data=new Float32Array(g.attributes.position.count*3);
        for(let i=0;i<data.length;i+=3){data[i]=c.r;data[i+1]=c.g;data[i+2]=c.b;}
        g.setAttribute('color',new THREE.BufferAttribute(data,3));pieces.push(g);
    };
    const oval=(c,p,s)=>add(new THREE.SphereGeometry(1,10,7),c,p,s);
    const box=(c,p,s)=>add(new THREE.BoxGeometry(1,1,1),c,p,s);
    build({add,oval,box});
    const g=mergeGeometries(pieces,false);pieces.forEach(p=>p.dispose());g.userData.shared=true;
    return g;
}
function template(variant) {
    const skin=[0xc48a61,0xb47750,0xd29b70][variant%3];
    const robe=[0x801c30,0x991e28,0x6b1a2d][variant%3], gold=[0xffb320,0xf6a321,0xfcc333][variant%3];
    const body=part(({add,oval,box})=>{
        add(new THREE.CylinderGeometry(.225,.17,.55,10),robe,[0,.98,0],[1,1,.65]);
        oval(skin,[0,1.31,0],[.075,.095,.075]);
        oval(skin,[0,1.52,0],[.148,.19,.135]);
        add(copyPersonHairGeometry('close',[.148,.19,.135],[0,1.52,0]),0x312823);
        for(const side of [-1,1]){
            oval(skin,[side*.15,1.52,0],[.027,.05,.03]);
            oval(0x241b18,[side*.055,1.545,-.124],[.013,.013,.008]);
        }
        oval(skin,[0,1.505,-.139],[.025,.032,.025]);
        box(0x603b2d,[0,1.448,-.124],[.057,.008,.007]);
        // Cloth crosses one shoulder, with an uneven hanging edge like the reference.
        const shape=new THREE.Shape([[-.21,1.24],[-.05,1.27],[.15,.80],[.10,.69],[-.20,.73]].map(p=>new THREE.Vector2(...p)));
        const cloth=new THREE.ShapeGeometry(shape);cloth.rotateY(Math.PI);
        add(cloth,gold,[0,0,-.159]);
        box(gold,[.155,1.25,0],[.16,.075,.34]);
        for(let i=0;i<3;i++)box(0xde8b18,[.08-i*.055,.82,-.168],[.008,.18,.008]);
    });
    const skirt=part(({add})=>add(new THREE.CylinderGeometry(.18,.255,.59,12),robe,[0,.40,0],[1,1,.77]));
    const seated=part(({box,oval})=>{
        oval(robe,[0,.62,-.17],[.25,.13,.34]);
        box(robe,[0,.36,-.37],[.39,.48,.18]);
        for(const x of [-.115,.115])oval(0x352b27,[x,.105,-.425],[.09,.06,.15]);
    });
    const arm=(wrapped)=>part(({oval,add})=>{
        add(new THREE.CylinderGeometry(.058,.047,.42,8),wrapped?robe:skin,[0,-.19,0]);
        oval(skin,[0,-.42,0],[.052,.07,.046]);
        if(wrapped)add(new THREE.CylinderGeometry(.077,.068,.24,8),gold,[0,-.075,0]);
    });
    const foot=part(({oval})=>oval(0x352b27,[0,-.06,-.055],[.082,.065,.14]));
    return {body,skirt,seated,left:arm(true),right:arm(false),foot};
}
export function buildMonk(variant=0) {
    variant%=3;
    if(!cache.has(variant))cache.set(variant,template(variant));
    const t=cache.get(variant), root=new THREE.Group();root.name='Tibetan monk';
    const mesh=(g)=>{const m=new THREE.Mesh(g,mat);m.receiveShadow=true;root.add(m);return m;};
    const body=mesh(t.body);body.castShadow=true;
    const skirt=mesh(t.skirt), seated=mesh(t.seated);seated.visible=false;
    const arms=[mesh(t.left),mesh(t.right)],feet=[mesh(t.foot),mesh(t.foot)];
    arms.forEach((m,i)=>m.position.set(i?-.21:.21,1.22,0));
    feet.forEach((m,i)=>m.position.set(i?-.105:.105,.12,0));
    root.userData.pose=(phase,speed,sitting=false,pole=false,stride=0,arm=0)=>{
        skirt.visible=!sitting;seated.visible=sitting;
        skirt.rotation.z=sitting?0:stride*.04;
        feet.forEach((m,i)=>{m.visible=!sitting;m.position.z=(i?-1:1)*stride*.24;});
        arms.forEach((m,i)=>{
            m.rotation.x=sitting?.65:pole&&i===0?0:(i?-1:1)*arm;
            m.rotation.z=pole&&i===0?2.5:0;
        });
    };
    return root;
}
