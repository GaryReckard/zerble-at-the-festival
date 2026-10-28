// Two renderer-owned, lazy shared tiles. World-space UVs use one repeat per 4m.
// Integer hashes are independent of every gameplay/world generation RNG stream.
import * as THREE from 'three';
const materials = new Map();
const SIZE = 256;
function hash(x,z) {
  let n = Math.imul(x+413,374761393)^Math.imul(z+719,668265263);
  n = Math.imul(n^(n>>>13),1274126177);
  return ((n^(n>>>16))>>>0)/4294967296;
}
function noise(x,z,period) {
  const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz;
  const sx=fx*fx*(3-2*fx),sz=fz*fz*(3-2*fz);
  const a=hash(ix%period,iz%period),b=hash((ix+1)%period,iz%period);
  const c=hash(ix%period,(iz+1)%period),d=hash((ix+1)%period,(iz+1)%period);
  return (a+(b-a)*sx)*(1-sz)+(c+(d-c)*sx)*sz;
}
export function roadMaterial(surface='dirt') {
  surface=surface==='asphalt'?'asphalt':'dirt';
  if(materials.has(surface))return materials.get(surface);
  const paved=surface==='asphalt',data=new Uint8Array(SIZE*SIZE*4);
  const base=paved?[91,94,96]:[184,149,112];
  for(let z=0;z<SIZE;z++)for(let x=0;x<SIZE;x++) {
    const broad=noise(x/32,z/32,8)-.5,small=noise(x/8,z/8,32)-.5;
    const grain=hash(x,z)-.5;
    const variation=broad*(paved?10:27)+small*(paved?9:14)+grain*(paved?24:17);
    const o=(z*SIZE+x)*4;
    for(let c=0;c<3;c++)data[o+c]=Math.max(0,Math.min(255,base[c]+variation));
    data[o+3]=255;
  }
  const map=new THREE.DataTexture(data,SIZE,SIZE,THREE.RGBAFormat);
  map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;
  map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;
  map.generateMipmaps=true;map.needsUpdate=true;map.userData.shared=true;
  const material=new THREE.MeshStandardMaterial({color:0xffffff,map,roughness:1,metalness:0,
    polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,depthWrite:true});
  material.userData.shared=true;material.userData.roadSurface=surface;materials.set(surface,material);return material;
}
