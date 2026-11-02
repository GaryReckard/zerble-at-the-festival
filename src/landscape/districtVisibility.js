import * as THREE from 'three';
const roofGeometry=new THREE.ConeGeometry(1,1,4),roofMaterial=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,flatShading:true});
const forestMaterial=new THREE.MeshStandardMaterial({color:0x3a6544,roughness:1,flatShading:true});
roofGeometry.userData.shared=roofMaterial.userData.shared=forestMaterial.userData.shared=true;
const palette=[0x608b83,0x667ca4,0xc08c67,0x927d9c,0xa3a17c];
// Proxy positions come from the completed real shelters. Visibility depends on
// this district's own publication and distance, never a neighboring chunk flag.
export function createDistrictVisibility(root,camps,woodlandBins,drum) {
  root.updateMatrixWorld(true);
  const roofs=[],point=new THREE.Vector3(),matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(),color=new THREE.Color();
  for(const camp of camps)for(const tent of camp.tents){
    tent.group.getWorldPosition(point);const p=point.clone();
    roofs.push({camp,x:p.x,y:p.y,z:p.z,yaw:camp.group.rotation.y+tent.yaw});
  }
  const proxy=new THREE.InstancedMesh(roofGeometry,roofMaterial,Math.max(1,roofs.length));proxy.count=0;proxy.castShadow=false;proxy.name='mountaintop-distant-shelters';root.add(proxy);
  const forestProxy=new THREE.InstancedMesh(roofGeometry,forestMaterial,Math.max(1,woodlandBins.length));forestProxy.count=0;forestProxy.castShadow=false;forestProxy.name='mountaintop-distant-woodland';root.add(forestProxy);
  const forestShapes=woodlandBins.map(bin=>{const xs=bin.trees.map(t=>t.x),zs=bin.trees.map(t=>t.z);return {x:(Math.min(...xs)+Math.max(...xs))/2,z:(Math.min(...zs)+Math.max(...zs))/2,y:Math.min(...bin.trees.map(t=>t.y))+10,sx:Math.max(10,(Math.max(...xs)-Math.min(...xs))*.7),sz:Math.max(10,(Math.max(...zs)-Math.min(...zs))*.7)};});
  let previousX=Infinity,previousZ=Infinity;
  function update(position,{detailRadius=220,woodlandRadius=340}={}) {
    if(Math.hypot(position.x-previousX,position.z-previousZ)<4)return;
    previousX=position.x;previousZ=position.z;
    for(const camp of camps)camp.group.visible=Math.hypot(position.x-camp.group.position.x,position.z-camp.group.position.z)<detailRadius;
    let count=0;
    for(let i=0;i<roofs.length;i++){
      const roof=roofs[i];if(roof.camp.group.visible)continue;
      point.set(roof.x,roof.y+1.7,roof.z);rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP,roof.yaw+Math.PI/4);scale.set(3.2,3.4,3.2);matrix.compose(point,rotation,scale);
      proxy.setMatrixAt(count,matrix);color.setHex(palette[i%palette.length]);proxy.setColorAt(count++,color);
    }
    proxy.count=count;proxy.visible=!!count;proxy.instanceMatrix.needsUpdate=true;if(proxy.instanceColor)proxy.instanceColor.needsUpdate=true;proxy.computeBoundingSphere();
    let forestCount=0;
    for(let i=0;i<woodlandBins.length;i++){
      const bin=woodlandBins[i];bin.group.visible=Math.hypot(position.x-bin.x,position.z-bin.z)<woodlandRadius+57;
      if(bin.group.visible)continue;
      const shape=forestShapes[i];point.set(shape.x,shape.y,shape.z);rotation.identity();scale.set(shape.sx,20,shape.sz);matrix.compose(point,rotation,scale);forestProxy.setMatrixAt(forestCount++,matrix);
    }
    forestProxy.count=forestCount;forestProxy.visible=!!forestCount;forestProxy.instanceMatrix.needsUpdate=true;forestProxy.computeBoundingSphere();
    if(drum?.dc?.group)drum.dc.group.visible=Math.hypot(position.x-drum.dc.group.position.x,position.z-drum.dc.group.position.z)<detailRadius;
  }
  return Object.freeze({proxy,forestProxy,roofCount:roofs.length,woodlandBins,update});
}
