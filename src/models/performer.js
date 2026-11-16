import {copyPersonHairGeometry} from '../crowdHair.js';
import {performerContacts,stickTips,samplePerformerPose} from '../performerMotion.js';
import {hash2} from '../rng.js';
import {sampleStageRoaming} from '../stageRoaming.js';
import {addStrideMorphs} from './personLocomotion.js';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const cache=new Map();
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.72});
material.userData.shared=true;
const SHIRTS=[0xe56183,0x36aeb6,0xc89945,0x9473c4];
const SKINS=[0xd7a17b,0x885437,0xbd8158,0xe7bb93];
const BLACK=0x20202b, GOLD=0xd5ac51, SILVER=0xb7b6bb;

export function bakePerformancePart(build,{compact=false}={}){
  const pieces=[];let partTag=0;
  const add=(source,color,p=[0,0,0],scale=[1,1,1],rotation=[0,0,0],side=0)=>{
    // Keep primitive indices on articulated templates: each animated vertex
    // carries multiple complete poses, so expanding triangles wastes uploads.
    const g=!compact && source.index?source.toNonIndexed():source.clone();source.dispose();
    if(compact&&!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));
    g.deleteAttribute('uv');g.scale(...scale);
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rotation)));
    g.translate(...p);
    const c=new THREE.Color(color),colors=new Float32Array(g.attributes.position.count*3);
    for(let i=0;i<colors.length;i+=3){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}
    g.setAttribute('strideSide',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(side||partTag),1));
    g.setAttribute('color',new THREE.BufferAttribute(colors,3));pieces.push(g);
  };
  const oval=(color,p,s,side=0)=>add(new THREE.SphereGeometry(1,compact?8:10,compact?5:7),color,p,s,[0,0,0],side);
  const box=(color,p,s,r,side=0)=>add(new THREE.BoxGeometry(1,1,1),color,p,s,r,side);
  const rod=(color,a,b,r=.025,side=0)=>{
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),d=end.clone().sub(start);
    const g=new THREE.CylinderGeometry(r,r,d.length(),7);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));
    add(g,color,start.add(end).multiplyScalar(.5).toArray(),[1,1,1],[0,0,0],side);
  };
  const tube=(color,points,r=.035,side=0)=>add(new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),20,r,6,false),color,[0,0,0],[1,1,1],[0,0,0],side);
  build({add,oval,box,rod,tube,tag:value=>{partTag=value;}});
  const g=mergeGeometries(pieces,false);pieces.forEach(p=>p.dispose());g.userData.shared=true;
  return g;
}

function template(instrument,variant){
  const skin=SKINS[variant],shirt=SHIRTS[variant],drum=instrument==='drum'||instrument==='march_drum';
  const strings=instrument==='guitar'||instrument==='bass';
  const part=build=>bakePerformancePart(build,{compact:true});
  const legs=part(({oval,box,rod})=>{
    for(const sx of [-1,1]){
      if(instrument==='drum'){
        rod(BLACK,[sx*.13,.78,.04],[sx*.22,.55,-.3],.105);
        rod(BLACK,[sx*.22,.55,-.3],[sx*.22,.13,-.42],.09);
      }else{
        const hip=[sx*.13,.8,0],knee=[sx*.17,.47,-.035+sx*.045],heel=[sx*.19,.13,sx*.055];
        rod(BLACK,hip,knee,.105,sx);rod(0x302e3c,knee,heel,.087,sx);
      }
      oval(0x111117,[sx*(instrument==='drum'?.22:.19),.07,instrument==='drum'?-.46:-.07],[.11,.075,.22],instrument==='drum'?(sx===1?3:0):sx);
      box(0xc4b6a4,[sx*(instrument==='drum'?.22:.19),.025,instrument==='drum'?-.47:-.08],[.21,.035,.33],undefined,instrument==='drum'?(sx===1?3:0):sx);
    }
  });
  const body=part(({add,oval,box,rod,tube,tag})=>{
    add(new THREE.CylinderGeometry(.27,.20,.62,10),shirt,[0,1.09,0],[1,1,.65]);
    for(const x of [-.18,.18])oval(shirt,[x,1.31,0],[.113,.105,.136]);
    box(BLACK,[0,.8,0],[.4,.055,.29]);
    box(GOLD,[0,.8,-.155],[.08,.06,.014]);
    for(const sx of [-1,1])box(0x282332,[sx*.145,1.15,-.158],[.11,.45,.025],[0,0,-sx*.08]);
    oval(skin,[0,1.41,0],[.08,.13,.08]);
    tag(4);
    for(const x of [-.18,.18])oval(skin,[x,1.69,0],[.035,.06,.035]);
    oval(skin,[0,1.68,0],[.18,.225,.17]);
    add(copyPersonHairGeometry(['close','long','bun','braids'][variant],[.18,.225,.17],[0,1.68,0]),0x302520);
    oval(skin,[0,1.665,-.169],[.032,.045,.038]);
    for(const x of [-.065,.065]){
      oval(0xffffff,[x,1.713,-.151],[.038,.027,.022]);
      oval(0x211c1c,[x,1.71,-.171],[.016,.017,.012]);
      box(0x302520,[x,1.757,-.153],[.07,.018,.016],[0,0,x*1.3]);
    }
    box(0x61352d,[0,1.603,-.155],[.075,.017,.012]);
    // A brim and contrasting hatband make each silhouette legible from the dancefloor.
    if(drum){
      add(new THREE.CylinderGeometry(.181,.184,.048,12),shirt,[0,1.775,0],[1,1,.92]);
      box(shirt,[.178,1.71,.028],[.045,.16,.046],[.16,0,.22]);
    }else if(variant%2===0){
      add(new THREE.CylinderGeometry(.24,.25,.035,12),BLACK,[0,1.88,0],[1,1,.86]);
      add(new THREE.CylinderGeometry(.145,.17,.19,10),shirt,[0,1.985,0],[1,1,.86]);
      add(new THREE.CylinderGeometry(.174,.177,.045,10),GOLD,[0,1.915,0],[1,1,.86]);
    }else{
      box(GOLD,[0,1.825,-.1],[.32,.05,.18]);
    }
    if(instrument==='sound'){
      // Headphones turn with the engineer’s head.
      tube(BLACK,[[-.20,1.69,0],[-.20,1.90,0],[0,1.97,0],[.20,1.90,0],[.20,1.69,0]],.025);
      for(const x of [-.20,.20])box(BLACK,[x,1.69,0],[.07,.15,.13]);
    }
    if(instrument==='bass'||instrument==='sax'){
      for(const x of [-.071,.071])box(BLACK,[x,1.714,-.167],[.117,.057,.025],[0,0,x*.30]);
      rod(GOLD,[-.02,1.724,-.181],[.02,1.724,-.181],.009);
    }
    tag(0);
    if(instrument==='lead_vocal'){
      // A long scarf frames the microphone without covering the face.
      add(new THREE.CylinderGeometry(.115,.13,.065,9),GOLD,[0,1.416,0]);
      box(GOLD,[.082,1.22,-.186],[.067,.35,.025],[0,0,.17]);
      box(0xe9c278,[.126,1.29,-.163],[.063,.23,.023],[0,0,.30]);
    }else if(['tuba','trumpet','trombone'].includes(instrument)){
      // Brass line's double-breasted uniform, picked out beneath the horn.
      for(const x of [-.067,.067])for(const y of [1.09,1.20,1.30])
        box(GOLD,[x,y,-.158],[.027,.027,.022]);
    }
    // Small outfit differences survive distance: lapels, a kerchief or a pocket.
    if(variant===0||variant===3){
      for(const sign of [-1,1])box(GOLD,[sign*.085,1.32,-.157],[.155,.034,.03],[0,0,sign*.75]);
    }else{
      box(0xe6c4a6,[-.15,1.22,-.164],[.085,.087,.018],[0,0,.04]);
      box(shirt,[-.15,1.24,-.178],[.09,.022,.014]);
    }
    if(strings)rod(0x6e4637,[-.20,1.4,.01],[.26,.87,-.36],.033);
  });
  // Rotate the head about the actual embouchure on wind instruments, so a
  // breathing player cannot leave their mouthpiece as they turn toward the band.
  const wind=['sax','tuba','trombone','trumpet'].includes(instrument);
  const pivot=new THREE.Vector3(0,wind?1.61:1.47,wind?-.18:0);
  const headAt=rotation=>new THREE.Matrix4().makeTranslation(...pivot.toArray()).multiply(rotation)
    .multiply(new THREE.Matrix4().makeTranslation(-pivot.x,-pivot.y,-pivot.z));
  morphBetween(body,[
    transformTagged(body,4,headAt(new THREE.Matrix4().makeRotationY(wind?.075:.36))),
    transformTagged(body,4,headAt(new THREE.Matrix4().makeRotationX(wind?.06:.13))),
  ]);
  const contacts=performerContacts[instrument]||performerContacts.lead_vocal;
  const armsAt=(left,right,leftReach=0,rightReach=0)=>part(({rod,oval})=>{
    for(let i=0;i<2;i++){
      const sign=i?1:-1, pose=i?right:left;
      const hand=new THREE.Vector3(...contacts[i][pose]);
      hand.x+=i?rightReach:leftReach;
      const shoulder=new THREE.Vector3(sign*.233,1.331,-.012);
      // Find the elbow on the intersection circle of the two arm segments.
      // Projecting the elbow pole preserves a downward/outward natural bend.
      const axis=hand.clone().sub(shoulder),reach=axis.length();axis.normalize();
      const pole=new THREE.Vector3(sign*.67,-1,.2);
      pole.addScaledVector(axis,-axis.dot(pole)).normalize();
      const length=Math.max(.33,reach*.509);
      const elbow=shoulder.clone().lerp(hand,.5).addScaledVector(pole,Math.sqrt(length**2-(reach*.5)**2));
      const sleeve=shoulder.clone().lerp(elbow,.72);
      rod(skin,sleeve.toArray(),elbow.toArray(),.063);
      rod(shirt,shoulder.toArray(),sleeve.toArray(),.086);
      rod(skin,elbow.toArray(),hand.toArray(),.052);
      oval(skin,hand.toArray(),[.059,.048,.051]);
      rod(variant%2?GOLD:BLACK,elbow.clone().lerp(hand,.75).toArray(),elbow.clone().lerp(hand,.84).toArray(),.057);
      const [x,y,z]=hand.toArray();
      if(instrument==='keys'){
        // The wrist floats above the keyboard; fingertips make the key contact.
        for(const dx of [-.032,0,.032])rod(skin,[x+dx,y-.004,z-.023],[x+dx,y-.052,z-.087],.012);
      }else if(instrument==='trumpet'&&i===1){
        for(const dz of [-.08,0,.08])rod(skin,[x,y,z+dz*.50],[x-.076,y-.041,z+dz],.012);
      }else if(instrument==='tuba'&&i===1){
        for(const dx of [-.10,0,.10])rod(skin,[x-.045+dx*.33,y-.006,z],[x-.15+dx,y-.045,z],.013);
      }else if(strings){
        if(i===0)rod(skin,[x+.025,y+.022,z],[x+.04,y+.054,z+.042],.025);
        else if(instrument==='guitar')rod(0xe7cd89,[x,y-.008,z],[x-.036,y-.045,z],.017);
        else rod(skin,[x,y,z],[x-.038,y-.046,z+.012],.017);
      }
      if(drum)rod(0xe7c38b,hand.toArray(),stickTips[instrument][i][pose],.014);
    }
  });
  const arms=armsAt(0,0);
  const armPoses=[armsAt(1,0),armsAt(0,1)];
  // Horizontal key selection is independent of the finger's downstroke.
  if(instrument==='keys')armPoses.push(armsAt(0,0,.33,0),armsAt(0,0,0,.33));
  morphBetween(arms,armPoses);
  const gear=part(({add,oval,box,rod,tube})=>{
    if(instrument==='keys'){
      box(BLACK,[0,1.035,-.52],[1.22,.115,.39]);
      for(let k=0;k<20;k++){
        const x=-.536+k*.055;
        box(0xf1e6d1,[x,1.099,-.49],[.052,.019,.21]);
        if(k%7!==2 && k%7!==6 && k<19)box(BLACK,[x+.027,1.117,-.55],[.030,.029,.115]);
      }
      for(const sign of [-1,1]){
        rod(SILVER,[sign*.46,.06,-.52],[-sign*.40,.99,-.52],.027);
        box(BLACK,[sign*.46,.035,-.52],[.10,.045,.39]);
      }
    }else if(instrument==='sound'){
      box(BLACK,[.20,.88,.10],[.085,.13,.085]);
      rod(BLACK,[.21,.94,.10],[.21,1.02,.10],.009);
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
      for(let j=0;j<(bass?4:6);j++){
        const dy=(j-(bass?1.5:2.5))*.014;
        rod(0xbfb9a7,[.20,1.035+dy,-.477],[-1.07,1.63+dy,-.454],.0038);
      }
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
      box(BLACK,[.22,.036,-.48],[.13,.038,.22]);
      rod(SILVER,[.22,.10,-.48],[.22,.42,-.445],.014,2);
      oval(0xddd6ca,[.22,.42,-.445],[.043,.065,.043],2);
      add(new THREE.CylinderGeometry(.22,.22,.075,12),BLACK,[0,.7,.17]);
      rod(SILVER,[0,.05,.17],[0,.7,.17],.035);
    }else if(instrument==='sax'){
      tube(GOLD,[[0,1.64,-.21],[.02,1.52,-.35],[.16,1.10,-.40],[.35,.87,-.48],[.45,1.02,-.63]],.055);
      add(new THREE.CylinderGeometry(.16,.055,.27,12,1,true),GOLD,[.45,1.10,-.64],[1,1,1],[-.4,0,0]);
      for(let i=0;i<5;i++)oval(SILVER,[.13+i*.027,1.37-i*.075,-.46],[.04,.018,.018]);
      rod(BLACK,[-.12,1.42,-.04],[.13,1.1,-.32],.018);
    }else if(instrument==='tuba'){
      tube(GOLD,[[0,1.61,-.175],[.02,1.60,-.32],[.13,1.48,-.34],[.17,1.22,-.29]],.024);
      add(new THREE.TorusGeometry(.40,.075,7,18),GOLD,[-.05,1.12,-.25]);
      tube(GOLD,[[.32,1.18,-.25],[.37,1.63,-.16],[-.1,1.9,-.1],[-.4,1.97,-.05]],.08);
      add(new THREE.CylinderGeometry(.34,.08,.46,12,1,true),GOLD,[-.4,2.12,-.05]);
      for(let i=0;i<3;i++){
        rod(SILVER,[-.13+i*.1,1.22,-.35],[-.13+i*.1,1.48,-.35],.025);
        add(new THREE.CylinderGeometry(.036,.036,.012,7),0xe7dec4,[-.13+i*.1,1.484,-.35]);
      }
    }else if(instrument==='trumpet'||instrument==='trombone'){
      const trom=instrument==='trombone',end=trom?-1.36:-.95;
      tube(GOLD,[[0,1.62,-.18],[0,1.56,-.4],[.17,1.47,end],[.17,1.59,end-.12]],.035);
      add(new THREE.CylinderGeometry(.17,.038,.30,12,1,true),GOLD,[.17,1.59,end-.25],[1,1,1],[-Math.PI/2,0,0]);
      if(!trom)for(let i=0;i<3;i++){
        rod(SILVER,[-.04,1.46,-.44-i*.08],[-.04,1.63,-.44-i*.08],.015);
        add(new THREE.CylinderGeometry(.024,.024,.012,7),0xe7dec4,[-.04,1.632,-.44-i*.08]);
      }
      if(trom)tube(GOLD,[[-.10,1.46,-.43],[-.10,1.46,-1.08],[.08,1.46,-1.08],[.08,1.46,-.43]],.023,1);
      if(trom)rod(SILVER,[-.10,1.46,-.45],[.08,1.46,-.45],.021,1);
    }else{
      // A handheld wireless mic lets the singer leave the centre mark.
      rod(SILVER,[-.04,1.49,-.41],[-.015,1.61,-.29],.025,1);
      oval(0x4c4c54,[-.008,1.625,-.27],[.058,.072,.057],1);
    }
  });
  if(instrument==='lead_vocal'){
    morphTagged(gear,1,new THREE.Matrix4().makeTranslation(.02,.06,.04));
  }else if(instrument==='trombone'){
    morphTagged(gear,1,new THREE.Matrix4().makeTranslation(0,0,-.36));
  }else if(instrument==='drum'){
    const hinge=(y,z,angle)=>new THREE.Matrix4().makeTranslation(0,y,z)
      .multiply(new THREE.Matrix4().makeRotationX(angle))
      .multiply(new THREE.Matrix4().makeTranslation(0,-y,-z));
    morphTagged(gear,2,hinge(.10,-.48,-.24));
    morphTagged(legs,3,hinge(.03,-.625,-.14));
  }
  for(const g of [body,arms,gear])g.deleteAttribute('strideSide');
  return {body,legs,arms,gear};
}

function transformTagged(base,tag,matrix){
  const target=base.clone(),p=target.attributes.position,n=target.attributes.normal,v=new THREE.Vector3();
  for(let i=0;i<p.count;i++)if(base.attributes.strideSide.getX(i)===tag){
    v.fromBufferAttribute(p,i).applyMatrix4(matrix);p.setXYZ(i,v.x,v.y,v.z);
    v.fromBufferAttribute(n,i).transformDirection(matrix);n.setXYZ(i,v.x,v.y,v.z);
  }
  return target;
}
function morphTagged(base,tag,matrix){
  morphBetween(base,[transformTagged(base,tag,matrix)]);
}

// Bake relative poses once per cached costume. Instances retain only morph weights.
function morphBetween(base,targets){
  for(const key of ['position','normal']){
    const rest=base.attributes[key].array;
    base.morphAttributes[key]=targets.map(g=>{
      const array=g.attributes[key].array;
      for(let j=0;j<array.length;j++)array[j]-=rest[j];
      return new THREE.BufferAttribute(array,3);
    });
  }
  base.morphTargetsRelative=true;targets.forEach(g=>g.dispose());
}

export function buildPerformer(instrument,rng=Math.random,{locomotion=false}={}){
  const roll=rng(),variant=Math.min(3,Math.floor(roll*4)),key=instrument+':'+variant;
  if(instrument==='guitar')rng();
  if(!cache.has(key))cache.set(key,template(instrument,variant));
  const t=cache.get(key),root=new THREE.Group(),spine=new THREE.Group(),upper=new THREE.Group();
  // The moving trunk pivots at the belt; shoes and stationary equipment stay on deck.
  spine.position.y=.8;upper.position.y=-.8;spine.add(upper);root.add(spine);
  root.name='Performer '+instrument;
  const mesh=(label,geo,parent)=>{
    const m=new THREE.Mesh(geo,material);m.name=label;m.receiveShadow=true;parent.add(m);return m;
  };
  const legGeometry=locomotion?(t.strideBody??=addStrideMorphs(t.legs.clone(),.8)):t.legs;
  root.userData.strideMesh=mesh('Planted legs',legGeometry,root);
  const torso=mesh('Performer torso',t.body,upper);torso.castShadow=true;
  const arms=mesh('Articulated arms',t.arms,upper);
  const fixed=['drum','keys','sound'].includes(instrument);
  const gear=mesh('Performance gear',t.gear,fixed&&instrument!=='sound'?root:upper);
  const phase=hash2(Math.floor(roll*4294967296),0x706f7365)/4294967296*Math.PI*2;
  const pose={};
  root.userData.instrument=instrument;
  root.userData.animate=(seconds,performance=null)=>{
    samplePerformerPose(instrument,seconds,performance,phase,pose);
    sampleStageRoaming(root,performance);
    // Keep both drumstick and keyboard contacts exact; the torso alone shifts
    // between the fixed hands and legs when a player is at a stationary rig.
    const moving=fixed?torso:spine;
    moving.rotation.z=pose.lean*(fixed?.35:1);
    moving.rotation.y=pose.turn*(fixed?.75:1);
    moving.rotation.x=pose.breath*(fixed?.6:1);
    torso.morphTargetInfluences[0]=pose.glance;torso.morphTargetInfluences[1]=pose.nod;
    arms.morphTargetInfluences[0]=pose.left;arms.morphTargetInfluences[1]=pose.right;
    if(instrument==='keys'){
      arms.morphTargetInfluences[2]=pose.keyLeft;
      arms.morphTargetInfluences[3]=pose.keyRight;
    }
    if(instrument==='trombone')gear.morphTargetInfluences[0]=pose.right;
    if(instrument==='lead_vocal')gear.morphTargetInfluences[0]=pose.left;
    if(instrument==='sound')gear.rotation.copy(torso.rotation);
    if(instrument==='drum'){
      gear.morphTargetInfluences[0]=pose.kick;
      root.userData.strideMesh.morphTargetInfluences[0]=pose.kick;
    }
  };
  root.userData.animate(0,{playing:false});
  return root;
}
