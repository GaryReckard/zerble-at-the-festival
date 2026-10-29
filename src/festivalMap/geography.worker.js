// This worker owns its own pure worldgen module state, never gameplay RNG state.
import { setSeed, queryRegion } from '../worldgen/index.js';
import { treeDensity } from '../worldgen/density.js';
import { CONFIG, bumpWorldgen } from '../worldgen/constants.js';
import { VERSION } from './model.js';
let identity;
self.onmessage = ({data}) => {
  try {
    if (data.type === 'init') {
      if (typeof data.seed !== 'number' || !Number.isFinite(data.seed) || data.mode !== 'v2' || data.version !== VERSION) throw Error('Map world identity mismatch');
      setSeed(data.seed); Object.assign(CONFIG,data.config); bumpWorldgen(); identity=data.identity;
      self.postMessage({type:'ready',identity}); return;
    }
    if (data.identity !== identity) throw Error('Stale map query');
    const {x,z,size,key}=data.tile;
    if (![x,z,size].every(Number.isFinite) || size<256 || size>1024) throw Error('Map query bounds exceeded');
    const started=performance.now(), region=queryRegion({minX:x,minZ:z,maxX:x+size,maxZ:z+size});
    let points=0;
    const roads=region.roads.map(r=>{points+=r.points.length;return {points:r.points,width:r.width||7,surface:r.surface};});
    const lakes=region.lakes.map(l=>{points+=l.outline.length;return {outline:l.outline};});
    if (roads.length>512 || lakes.length>64 || points>16384) throw Error('Map feature budget exceeded');
    const woods=[];
    for(let j=0;j<12;j++)for(let i=0;i<12;i++)woods.push(treeDensity(x+(i+.5)*size/12,z+(j+.5)*size/12));
    const result={type:'tile',identity,id:data.id,key,tile:data.tile,roads,lakes,woods,workerMs:performance.now()-started};
    const bytes=JSON.stringify(result).length;
    if(bytes>512000)throw Error('Map payload budget exceeded');
    self.postMessage({...result,bytes});
  } catch(error) {self.postMessage({type:'error',identity,id:data.id,message:error.message});}
};
