import {getSessionSeed,mulberry32} from '../rng.js';
import {worldgenEpoch} from './constants.js';
import {FESTIVAL_TUNING as T,MODEL_DIMS as M} from './tuning.js';
import {festivalPlan,welcomeFoodCourt,MAX_POI_REACH} from './festival.js';
import {heartsInBounds} from './hearts.js';

const same=(a,b)=>a?.x===b?.x&&a?.z===b?.z&&a?.clusterSeed===b?.clusterSeed;
const before=(a,b)=>(a.clusterSeed>>>0)<(b.clusterSeed>>>0)||
 ((a.clusterSeed>>>0)===(b.clusterSeed>>>0)&&(a.x<b.x||a.x===b.x&&a.z<b.z));
export function courtRollsSugarShack(court){
 const rng=mulberry32((court.clusterSeed>>>0)||0x1A2B3C);
 rng(); // The first build draw selects the stall count.
 return rng()<T.FOOD_COURT_SHACK_PROB;
}
let gate='',decisions=new Map();
// Resolve potential vendors from seeded plans, never whichever chunks happen
// to be loaded. Comparing higher-ranked candidates directly bounds the search;
// a candidate may yield even if its winner later has no safe physical slot.
export function sugarShackCourtEligible(court){
 const next=`${getSessionSeed()}:${worldgenEpoch()}`;
 if(next!==gate){gate=next;decisions.clear();}
 const key=`${court.x}:${court.z}:${court.clusterSeed}`;
 if(decisions.has(key))return decisions.get(key);
 const welcome=welcomeFoodCourt();
 const radius=T.FOOD_COURT_SHACK_MIN_SPACING+2*(T.FOOD_COURT_RING_MULT*M.FOOD_TRUCK_SCALE+T.FOOD_COURT_SHACK_RING_PAD);
 const close=other=>(court.x-other.x)**2+(court.z-other.z)**2<radius*radius;
 let keep=same(court,welcome);
 if(!keep&&courtRollsSugarShack(court)){
  keep=true;
  if(welcome&&close(welcome))keep=false;
  else{
   const reach=radius+MAX_POI_REACH;
   outer:for(const heart of heartsInBounds(court.x-reach,court.z-reach,court.x+reach,court.z+reach)){
    for(const other of festivalPlan(heart)){
     if(other.kind==='food_court'&&!same(other,court)&&close(other)&&before(other,court)&&courtRollsSugarShack(other)){
      keep=false;break outer;
     }
    }
   }
  }
 }
 if(decisions.size>=256)decisions.delete(decisions.keys().next().value);
 decisions.set(key,keep);return keep;
}
