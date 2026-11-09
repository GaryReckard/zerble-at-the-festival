// Opt-in attribution only. Top-level sections partition updateWorld; ground
// details are nested inside ground and must not be added to that partition.
export const WORLD_SECTIONS = Object.freeze(['landscape','lakes','chunks','physical','lighting','vendors','farField','backdrop','ground','sun']);
export const GROUND_SECTIONS = Object.freeze(['samples','normals','bounds']);
export function createWorldTimings(now=()=>performance.now()) {
  const parts=Object.fromEntries(WORLD_SECTIONS.map(k=>[k,0]));
  const ground=Object.fromEntries(GROUND_SECTIONS.map(k=>[k,0]));
  let last=0,reads=0;
  return {parts,ground,
    reset(){for(const k of WORLD_SECTIONS)parts[k]=0;for(const k of GROUND_SECTIONS)ground[k]=0;reads=0;},
    begin(start){last=start;},
    mark(key){const time=now();reads++;parts[key]+=Math.max(0,time-last);last=time;},
    stamp(){reads++;return now();},
    nested(key,start){reads++;ground[key]+=Math.max(0,now()-start);},
    get clockReads(){return reads;},
  };
}
