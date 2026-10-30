import {copyPersonHairGeometry} from '../crowdHair.js';
import {addStrideMorphs} from './personLocomotion.js';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const cache=new Map();
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.72});
material.userData.shared=true;
const SHIRTS=[0xe56183,0x36aeb6,0xc89945,0x9473c4];
const SKINS=[0xd7a17b,0x885437,0xbd8158,0xe7bb93];
const BLACK=0x20202b, GOLD=0xd5ac51, SILVER=0xb7b6bb;

export function bakePerformancePart(build){
  const pieces=[];
  const add=(source,color,p=[0,0,0],scale=[1,1,1],rotation=[0,0,0],side=0)=>{
    const g=source.index?source.toNonIndexed():source.clone();source.dispose();
    g.deleteAttribute('uv');g.scale(...scale);
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rotation)));
    g.translate(...p);
    const c=new THREE.Color(color),colors=new Float32Array(g.attributes.position.count*3);
    for(let i=0;i<colors.length;i+=3){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}
    g.setAttribute('strideSide',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(side),1));
    g.setAttribute('color',new THREE.BufferAttribute(colors,3));pieces.push(g);
  };
  const oval=(color,p,s,side=0)=>add(new THREE.SphereGeometry(1,10,7),color,p,s,[0,0,0],side);
  const box=(color,p,s,r,side=0)=>add(new THREE.BoxGeometry(1,1,1),color,p,s,r,side);
  const rod=(color,a,b,r=.025,side=0)=>{
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),d=end.clone().sub(start);
    const g=new THREE.CylinderGeometry(r,r,d.length(),7);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));
    add(g,color,start.add(end).multiplyScalar(.5).toArray(),[1,1,1],[0,0,0],side);
  };
  const tube=(color,points,r=.035)=>add(new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),20,r,6,false),color);
  build({add,oval,box,rod,tube});
  const g=mergeGeometries(pieces,false);pieces.forEach(p=>p.dispose());g.userData.shared=true;
  return g;
}

function template(instrument,variant){
  const skin=SKINS[variant],shirt=SHIRTS[variant],drum=instrument==='drum'||instrument==='march_drum';
  const strings=instrument==='guitar'||instrument==='bass';
  const body=bakePerformancePart(({add,oval,box,rod})=>{
    for(const sx of [-1,1]){
      if(instrument==='drum'){
        rod(BLACK,[sx*.13,.78,.04],[sx*.22,.55,-.3],.105);
        rod(BLACK,[sx*.22,.55,-.3],[sx*.22,.13,-.42],.09);
      }else{
        rod(BLACK,[sx*.13,.8,0],[sx*.19,.13,sx*.055],.095,sx);
      }
      oval(0x111117,[sx*(instrument==='drum'?.22:.19),.07,instrument==='drum'?-.46:-.07],[.11,.075,.22],instrument==='drum'?0:sx);
      box(0xc4b6a4,[sx*(instrument==='drum'?.22:.19),.025,instrument==='drum'?-.47:-.08],[.21,.035,.33],undefined,instrument==='drum'?0:sx);
    }
    add(new THREE.CylinderGeometry(.27,.20,.62,10),shirt,[0,1.09,0],[1,1,.65]);
    box(BLACK,[0,.8,0],[.4,.055,.29]);
    box(GOLD,[0,.8,-.155],[.08,.06,.014]);
    for(const sx of [-1,1]){
      box(0x282332,[sx*.145,1.15,-.158],[.11,.45,.025],[0,0,-sx*.08]);
      oval(skin,[sx*.18,1.69,0],[.035,.06,.035]);
    }
    oval(skin,[0,1.41,0],[.08,.13,.08]);
    oval(skin,[0,1.68,0],[.18,.225,.17]);
    add(copyPersonHairGeometry(variant%2===0?'close':'long',[.18,.225,.17],[0,1.68,0]),0x302520);
    oval(skin,[0,1.665,-.169],[.032,.045,.038]);
    for(const x of [-.065,.065]){
      oval(0xffffff,[x,1.713,-.151],[.038,.027,.022]);
      oval(0x211c1c,[x,1.71,-.171],[.016,.017,.012]);
      box(0x302520,[x,1.757,-.153],[.07,.018,.016],[0,0,x*1.3]);
    }
    box(0x61352d,[0,1.603,-.155],[.075,.017,.012]);
    // A brim and contrasting hatband make each silhouette legible from the dancefloor.
    if(variant%2===0){
      add(new THREE.CylinderGeometry(.24,.25,.035,12),BLACK,[0,1.88,0],[1,1,.86]);
      add(new THREE.CylinderGeometry(.145,.17,.19,10),shirt,[0,1.985,0],[1,1,.86]);
      add(new THREE.CylinderGeometry(.174,.177,.045,10),GOLD,[0,1.915,0],[1,1,.86]);
    }else{
      box(GOLD,[0,1.825,-.1],[.32,.05,.18]);
    }
    if(strings)rod(0x6e4637,[-.20,1.4,.01],[.26,.87,-.36],.033);
  });
  let hands=strings?[[-.62,1.29,-.42],[.12,1.02,-.48]]
    :drum?[[-.36,1.20,-.48],[.36,1.18,-.5]]
    :instrument==='lead_vocal'?[[-.03,1.55,-.43],[.55,1.22,-.22]]
    :instrument==='sound'?[[-.30,1.20,-.57],[.30,1.20,-.57]]
    :instrument==='sax'?[[-.04,1.25,-.37],[.25,1.02,-.46]]
    :[[-.10,1.45,-.5],[.19,1.42,-.64]];
  const arms=hands.map((hand,i)=>bakePerformancePart(({rod,oval})=>{
    const sx=i?1:-1,shoulder=[sx*.27,1.34,0];
    const local=p=>p.map((n,j)=>n-shoulder[j]);
    const elbow=[sx*.40,strings?1.02:1.15,-.17];
    rod(shirt,[0,0,0],local(elbow),.076);
    rod(skin,local(elbow),local(hand),.058);
    oval(skin,local(hand),[.065,.07,.055]);
    if(drum)rod(0xe7c38b,local(hand),local([hand[0]*1.2,1.02,-.93]),.013);
  }));
  const gear=bakePerformancePart(({add,oval,box,rod,tube})=>{
    if(instrument==='sound'){
      // Headphones, with no microphone stand between the engineer and desk.
      tube(BLACK,[[-.20,1.69,0],[-.20,1.90,0],[0,1.97,0],[.20,1.90,0],[.20,1.69,0]],.025);
      for(const x of [-.20,.20])box(BLACK,[x,1.69,0],[.07,.15,.13]);
    }else if(strings){
      const bass=instrument==='bass',color=bass?0x265c76:[0xb65131,0x287475,0xd5a24d,0x86465a][variant];
      const shape=new THREE.Shape();
      shape.moveTo(-.18,.30);shape.bezierCurveTo(-.50,.27,-.47,-.35,-.13,-.37);
      shape.bezierCurveTo(.18,-.45,.47,-.17,.25,.06);
      shape.bezierCurveTo(.08,.22,.34,.39,.13,.43);shape.lineTo(-.18,.30);
      add(new THREE.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:false,curveSegments:7}),color,[.14,1.02,-.44],[bass?1.04:.92,bass?1.1:.92,1],[0,0,-.35]);
      rod(0x63452f,[-.02,1.14,-.40],[-1.0,1.60,-.40],bass?.057:.05);
      box(0xd0a467,[-1.05,1.625,-.40],[.23,.12,.075],[0,0,-.44]);
      box(0xe4dbc5,[.12,1.07,-.459],[.21,.25,.017],[0,0,-.35]);
      for(let j=0;j<2;j++)box(BLACK,[.10+j*.08,1.02-j*.08,-.48],[.12,.04,.018],[0,0,-.35]);
      for(let j=0;j<6;j++){
        const x=-.25-j*.11,y=1.24+j*.052;
        rod(SILVER,[x-.025,y-.037,-.46],[x+.025,y+.037,-.46],.006);
      }
      for(const side of [-1,1])for(let j=0;j<3;j++)oval(SILVER,[-1.12+j*.055,1.62+side*.085,-.40],[.022,.023,.022]);
    }else if(instrument==='march_drum'){
      add(new THREE.CylinderGeometry(.35,.35,.28,14),shirt,[0,.93,-.48]);
      add(new THREE.CylinderGeometry(.36,.36,.028,14),SILVER,[0,1.08,-.48]);
      add(new THREE.CylinderGeometry(.33,.33,.018,14),0xeee4cc,[0,1.10,-.48]);
      for(const x of [-.15,.15])rod(BLACK,[x,1.38,-.06],[x,.94,-.35],.024);
    }else if(drum){
      add(new THREE.CylinderGeometry(.49,.49,.48,16),shirt,[0,.53,-.8],[1,1,1],[Math.PI/2,0,0]);
      add(new THREE.CylinderGeometry(.46,.46,.025,16),0xe8dfca,[0,.53,-1.052],[1,1,1],[Math.PI/2,0,0]);
      add(new THREE.TorusGeometry(.47,.022,5,18),SILVER,[0,.53,-1.07]);
      oval(BLACK,[.15,.38,-1.07],[.10,.10,.009]);
      for(const [x,y,z,r]of [[-.43,1.0,-.58,.26],[.37,1.0,-.62,.25],[.69,.62,-.48,.29]]){
        add(new THREE.CylinderGeometry(r,r,.28,12),shirt,[x,y,z]);
        add(new THREE.CylinderGeometry(r*.94,r*.94,.018,12),0xd8d8d2,[x,y+.15,z]);
        rod(SILVER,[x,.04,z],[x,y,z],.025);
      }
      for(const [x,y,z]of [[-.73,1.38,-.65],[.76,1.5,-.84]]){
        rod(SILVER,[x,.02,z],[x,y,z],.016);
        add(new THREE.ConeGeometry(.35,.045,16),GOLD,[x,y,z]);
        for(let j=0;j<3;j++)rod(SILVER,[x,.22,z],[x+Math.cos(j*2.094)*.25,.03,z+Math.sin(j*2.094)*.25],.013);
      }
      add(new THREE.CylinderGeometry(.22,.22,.075,12),BLACK,[0,.7,.17]);
      rod(SILVER,[0,.05,.17],[0,.7,.17],.035);
    }else if(instrument==='sax'){
      tube(GOLD,[[0,1.64,-.21],[.02,1.52,-.35],[.16,1.10,-.40],[.35,.87,-.48],[.45,1.02,-.63]],.055);
      add(new THREE.CylinderGeometry(.16,.055,.27,12,1,true),GOLD,[.45,1.10,-.64],[1,1,1],[-.4,0,0]);
      for(let i=0;i<5;i++)oval(SILVER,[.13+i*.027,1.37-i*.075,-.46],[.04,.018,.018]);
      rod(BLACK,[-.12,1.42,-.04],[.13,1.1,-.32],.018);
    }else if(instrument==='tuba'){
      add(new THREE.TorusGeometry(.40,.075,7,18),GOLD,[-.05,1.12,-.25]);
      tube(GOLD,[[.32,1.18,-.25],[.37,1.63,-.16],[-.1,1.9,-.1],[-.4,1.97,-.05]],.08);
      add(new THREE.CylinderGeometry(.34,.08,.46,12,1,true),GOLD,[-.4,2.12,-.05]);
      for(let i=0;i<3;i++)rod(SILVER,[-.13+i*.1,1.22,-.35],[-.13+i*.1,1.48,-.35],.025);
    }else if(instrument==='trumpet'||instrument==='trombone'){
      const trom=instrument==='trombone',end=trom?-1.36:-.95;
      tube(GOLD,[[0,1.62,-.18],[0,1.56,-.4],[.17,1.47,end],[.17,1.59,end-.12]],.035);
      add(new THREE.CylinderGeometry(.17,.038,.30,12,1,true),GOLD,[.17,1.59,end-.25],[1,1,1],[-Math.PI/2,0,0]);
      for(let i=0;i<3;i++)rod(SILVER,[-.04,1.46,-.44-i*.08],[-.04,1.63,-.44-i*.08],.015);
      if(trom)tube(GOLD,[[-.10,1.46,-.4],[-.10,1.46,-1.56],[.08,1.46,-1.56],[.08,1.46,-.4]],.023);
    }else{
      rod(BLACK,[0,.05,-.43],[0,1.53,-.43],.018);
      for(let j=0;j<3;j++)rod(BLACK,[0,.20,-.43],[Math.cos(j*2.094)*.22,.03,-.43+Math.sin(j*2.094)*.22],.015);
      rod(SILVER,[0,1.52,-.43],[0,1.67,-.46],.025);
      oval(0x4c4c54,[0,1.69,-.465],[.058,.072,.057]);
      tube(BLACK,[[0,1.52,-.43],[.06,.75,-.47],[.12,.03,-.40],[.55,.025,.2]],.008);
    }
  });
  for(const g of [...arms,gear])g.deleteAttribute('strideSide');
  if(instrument==='drum')body.deleteAttribute('strideSide');
  return {body,arms,gear};
}

export function buildPerformer(instrument,rng=Math.random,{locomotion=false}={}){
  const variant=Math.min(3,Math.floor(rng()*4)),key=instrument+':'+variant;
  // Preserve the former guitar body-color draw in the caller’s seeded stream.
  if(instrument==='guitar')rng();
  if(!cache.has(key))cache.set(key,template(instrument,variant));
  const t=cache.get(key),root=new THREE.Group(),body=new THREE.Group();root.add(body);
  root.name='Performer '+instrument;
  const mesh=(geo,parent=body)=>{const m=new THREE.Mesh(geo,material);m.receiveShadow=true;parent.add(m);return m;};
  const bodyGeometry=locomotion?(t.strideBody??=addStrideMorphs(t.body.clone(),.8)):t.body;
  const bodyMesh=mesh(bodyGeometry);bodyMesh.castShadow=true;
  root.userData.strideMesh=bodyMesh;
  const arms=t.arms.map((geo,i)=>{const m=mesh(geo);m.position.set(i?.27:-.27,1.34,0);return m;});
  const gear=mesh(t.gear,instrument==='drum'||instrument==='lead_vocal'?root:body);
  const phase=variant*1.73;
  root.userData.instrument=instrument;
  root.userData.animate=(seconds)=>{
    const t=seconds*3.6+phase;
    body.rotation.z=Math.sin(t*.5)*.025;
    body.rotation.y=Math.sin(t*.25)*.055;
    arms.forEach((a,i)=>{
      a.rotation.x=(instrument==='drum'||instrument==='march_drum')?Math.sin(t*2+i*Math.PI)*.20
        :instrument==='guitar'&&i===1?Math.sin(t*2)*.13
        :instrument==='bass'&&i===1?Math.sin(t)*.055
        :instrument==='lead_vocal'&&i===1?Math.sin(t*.5)*.18:Math.sin(t*.5+i)*.02;
    });
    if(instrument==='sax'||instrument==='trumpet')gear.rotation.x=Math.sin(t*.5)*.025;
  };
  return root;
}
