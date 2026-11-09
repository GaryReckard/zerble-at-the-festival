// Execute the actual world.js resampling/color code with pinned Three geometry.
// This needs neither a DOM nor a WebGL renderer and does not mutate world.js.
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {hash2} from '../../../src/rng.js';
import {SCENARIOS} from '../../../src/performanceLab/scenarios.js';

const source=readFileSync(new URL('../../../src/world.js',import.meta.url),'utf8');
function functionBody(name){
  const start=source.indexOf(`function ${name}(`);
  if(start<0)throw Error(`Missing production function ${name}`);
  const body=source.indexOf('{',start);let depth=1,end=body+1;
  while(depth&&end<source.length){if(source[end]==='{')depth++;if(source[end]==='}')depth--;end++;}
  if(depth)throw Error(`Unclosed production function ${name}`);
  return source.slice(start,end);
}
const declarations=source.slice(source.indexOf('const GROUND_GREEN ='),source.indexOf('let chunkManager ='));
const functions=['resampleGroundSurface','smoothstep','worldNoise','writeGroundColor'].map(functionBody).join('\n');
export const productionSourceSha256=createHash('sha256').update(source).digest('hex');
export function createGroundFixture(terrain){
  const factory=new Function('THREE','hash2','terrainHeight','terrainEnabled',
    `${declarations}\n${functions}\nreturn {resample:resampleGroundSurface,size:GROUND_SIZE,segments:GROUND_SEG,snap:GROUND_SNAP};`);
  const bound=factory(THREE,hash2,terrain.terrainHeight,terrain.terrainEnabled);
  const geometry=new THREE.PlaneGeometry(bound.size,bound.size,bound.segments,bound.segments);
  geometry.rotateX(-Math.PI/2);
  geometry.setAttribute('color',new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count*3),3));
  const texture=new THREE.Texture(),material=new THREE.MeshBasicMaterial({map:texture});
  const mesh=new THREE.Mesh(geometry,material);
  return {...bound,mesh,
    update(x,z){mesh.position.set(x,0,z);bound.resample(mesh,x,z);mesh.updateMatrixWorld(true);},
    dispose(){geometry.dispose();material.dispose();texture.dispose();},
  };
}
export function recordedScenarioCenters(snap=40){
  const centers=[];
  for(const path of SCENARIOS['streaming-drive-v1'].paths)for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i],steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2));
    for(let j=0;j<=steps;j++){
      const p=[Math.round((a[0]+(b[0]-a[0])*j/steps)/snap)*snap,Math.round((a[1]+(b[1]-a[1])*j/steps)/snap)*snap];
      const last=centers.at(-1);if(!last||last[0]!==p[0]||last[1]!==p[1])centers.push(p);
    }
  }
  return centers;
}
