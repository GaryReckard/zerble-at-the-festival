// A tiny seamless canopy data tile, baked once, shared by all four ridge layers
// in a single material. Rounded crowns and dark inter-crown gaps provide the
// forest read that broad vertex colors alone cannot carry at driving distance.
import * as THREE from 'three';
import {mulberry32,hash2} from './rng.js';
export const CANOPY_SIZE=128;
export const CANOPY_TILE_METERS=40;

export function buildRidgeCanopy() {
  const size=CANOPY_SIZE,rgba=new Uint8Array(size*size*4),height=new Float32Array(size*size);
  height.fill(-1);
  const rng=mulberry32(0x43414e50),cells=10,step=size/cells;
  const stamp=(cx,cy,r,lift,tint,phase)=>{
    for(let py=Math.floor(cy-r*1.2);py<=Math.ceil(cy+r*1.2);py++)for(let px=Math.floor(cx-r*1.2);px<=Math.ceil(cx+r*1.2);px++){
      const nx=(px-cx)/r,ny=(py-cy)/r;
      const edge=1+.10*Math.sin(px*1.1+phase)*Math.sin(py*.9+phase*.7);
      const r2=(nx*nx+ny*ny)/(edge*edge);
      if(r2>=1)continue;
      const nz=Math.sqrt(1-r2),h=(.12+nz)*lift;
      const tx=(px+size)%size,ty=(py+size)%size,p=ty*size+tx,k=p*4;
      if(h<=height[p])continue;
      height[p]=h;
      const grain=(hash2(tx,ty)&255)/255;
      const leaves=(hash2(Math.floor(px/2),Math.floor(py/2))&255)/255;
      const lit=Math.max(0,-nx*.43-ny*.52+nz*.74);
      // Broken leaf clusters rather than smooth, dark-outlined spheres.
      const shade=.26+.58*lit+(grain-.5)*.15+(leaves-.5)*.18;
      rgba[k]=Math.round(Math.max(0,Math.min(1,shade))*255);
      rgba[k+1]=Math.round(tint*255);
      rgba[k+2]=Math.round(nz*255);
      rgba[k+3]=Math.round(Math.min(1,h/1.35)*255);
    }
  };
  for(let y=0;y<cells;y++)for(let x=0;x<cells;x++){
    const cx=(x+.05+rng()*.9)*step,cy=(y+.05+rng()*.9)*step;
    const r=step*(.44+rng()*.50),lift=.65+rng()*.65,tint=.12+rng()*.85,phase=rng()*6.28;
    stamp(cx,cy,r,lift,tint,phase);
    // Offset lobes overlap the main crown; variable size and species tint
    // break the regular cell layout without a runtime procedural shader.
    for(let lobe=0;lobe<3;lobe++){
      const a=rng()*Math.PI*2;
      stamp(cx+Math.cos(a)*r*.60,cy+Math.sin(a)*r*.60,r*(.45+rng()*.25),lift*.83,tint,phase+lobe);
    }
  }
  const texture=new THREE.DataTexture(rgba,size,size,THREE.RGBAFormat);
  texture.name='Ridge canopy crowns';
  // Numeric shade/tint/height data, not an sRGB photograph.
  texture.colorSpace=THREE.NoColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
  texture.generateMipmaps=true;texture.anisotropy=2;texture.needsUpdate=true;
  return texture;
}
