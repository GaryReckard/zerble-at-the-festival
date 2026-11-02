// Occupied admission is downstream of raw terrain/reservations and external
// roads. No final-terrain module or runtime registry is imported here.
import { shapesClearOfRoads } from './roads.js';
import { getSessionSeed } from '../rng.js';
import { worldgenEpoch } from './constants.js';
import { landscapeVersion,landscapeCandidatesInBounds } from './landscapeCandidates.js';
import { createFormCamping,freezeLandscapePlan } from '../landscape/campingPlan.js';
import { placeDistrictPlan } from '../landscape/placePlan.js';
import { validateRouteSteps,routeClearsSolids } from '../landscape/routes.js';
import { segmentIntersectsBounds } from '../landscape/geometry.js';
const receipts=new WeakMap();
const key=()=>`${getSessionSeed()}:${worldgenEpoch()}:${landscapeVersion()}`;
const failure=(reason,rejected=[])=>({valid:false,reason,rejected,plan:null,receipt:null});
const compact=points=>points.filter((p,i)=>!i||Math.hypot(p.x-points[i-1].x,p.z-points[i-1].z)>.01);
function closeTo(a,b,distance=12){const length=Math.hypot(b.x-a.x,b.z-a.z)||1;return {x:a.x+(b.x-a.x)*Math.min(1,distance/length),z:a.z+(b.z-a.z)*Math.min(1,distance/length)};}
function clearReservations(points,reservations){
  for(let i=1;i<points.length;i++)if(reservations.some(b=>segmentIntersectsBounds(points[i-1],points[i],b,5.5)))return false;
  return true;
}
function* nearestAnchors(roads,entry) {
  const best=[],seen=new Map();let scanned=0;
  for(const road of roads)for(let i=1;i<road.points.length;i++) {
    if(++scanned>4096)return {valid:false,reason:'road-work-limit'};
    if(scanned%16===0)yield;
    const a=road.points[i-1],b=road.points[i],dx=b.x-a.x,dz=b.z-a.z,lengthSq=dx*dx+dz*dz;
    const edgeId=road.edgeId||`${a.x},${a.z}:${b.x},${b.z}`,id=`${edgeId}:${i}`,signature=`${a.x},${a.z}:${b.x},${b.z}:${road.surfaceId||'terrain'}:${road.width||7}`;
    if(seen.has(id)){if(seen.get(id)!==signature)return {valid:false,reason:'conflicting-road-record'};continue;}
    seen.set(id,signature);
    if(!lengthSq)continue;
    const t=Math.max(0,Math.min(1,((entry.x-a.x)*dx+(entry.z-a.z)*dz)/lengthSq)),point={x:a.x+t*dx,z:a.z+t*dz};
    const distanceSq=(point.x-entry.x)**2+(point.z-entry.z)**2;
    if(distanceSq<=600*600) {
      const anchor={id,edgeId,point,a,b,distanceSq,surfaceId:road.surfaceId||'terrain',width:road.width||7};
      const sameEdge=best.findIndex(p=>p.edgeId===edgeId);
      if(sameEdge>=0){const prior=best[sameEdge];if(distanceSq>prior.distanceSq||distanceSq===prior.distanceSq&&id>=prior.id)continue;best.splice(sameEdge,1);}
      const index=best.findIndex(p=>distanceSq<p.distanceSq || distanceSq===p.distanceSq&&anchor.id<p.id);
      if(index<0)best.push(anchor);else best.splice(index,0,anchor);
      if(best.length>2)best.pop();
    }
  }
  return {valid:true,anchors:best};
}
export function districtAdmissionRecord(receipt,plan,surface) {
  const record=receipt&&receipts.get(receipt);
  return record&&record.plan===plan&&record.surface===surface&&record.key===record.getKey()?record:null;
}
export function createLandscapeAdmission(candidate,{surface,roads=[],obstacles=[],shapes=[],reservations=[],getKey=key}={}) {
  if(typeof getKey!=='function'||!candidate||!surface?.supportWorld||typeof surface.sampleTerrain!=='function'||!Array.isArray(roads)||roads.length>4096||!Array.isArray(obstacles)||obstacles.length>2048||!Array.isArray(shapes)||shapes.length>4096||!Array.isArray(reservations)||reservations.length>16)throw new TypeError('Invalid bounded landscape admission context');
  if(roads.some(r=>!Array.isArray(r.points)||r.points.length>256||r.points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.z))))throw new TypeError('Invalid external road geometry');
  const captured=getKey(),rejected=[];let done=false,result=null;
  function* admit() {
    if(candidate.version!==landscapeVersion()||candidate.worldSeed!==getSessionSeed())return failure('world-changed');
    if(candidate.kind!=='mountain-top')return failure('wilderness-form');
    const anchors=yield* nearestAnchors(roads,candidate.ports[0]);
    if(!anchors.valid)return failure(anchors.reason,rejected);
    if(!anchors.anchors.length)return failure('no-road-within-600m',rejected);
    let plan=null;
    for(let attempt=0;attempt<3;attempt++) {
      const local=createFormCamping(candidate.plan,{attempt});yield;
      if(local.valid){plan=placeDistrictPlan(candidate,local);break;}
      rejected.push({id:`camp-arrangement:${attempt}`,reason:local.reason});
    }
    if(!plan)return failure('no-complete-camp-arrangement',rejected);
    const checks=[['main-road',plan.mainRoad,{}],['wooded-trail',plan.narrowPath,{halfWidth:2.8,maxGrade:.3}],
      ['full-drive',plan.route,{maxGrade:.3}],...plan.accessPaths.map((p,i)=>[`camp-lane:${i}`,p,{}]),['visitor',plan.visitorRoute,{}]];
    let route=null;
    for(const [id,points,options] of checks) {
      const report=yield* validateRouteSteps(surface.supportWorld,points,options);
      if(!report.valid)return failure(`district:${id}:${report.reason}`,rejected);
      if(id==='full-drive')route=report;
    }
    // Validate whole occupied envelopes on final native triangles, rather than
    // trusting an attractive center whose outer tents land on a steep shoulder.
    const probe={};
    for(const camp of plan.camps) {
      const count=Math.ceil(camp.clearance);
      const shelf=plan.shelves.find(s=>s.id===camp.shelf);
      surface.sampleTerrain(camp.x,camp.z,probe);
      if(!shelf||Math.abs(probe.height-shelf.height)>1.5)return failure(`occupation-height:${camp.id}`,rejected);
      for(let iz=0;iz<=count;iz++)for(let ix=0;ix<=count;ix++) {
        const x=-camp.clearance+ix*camp.clearance*2/count,z=-camp.clearance+iz*camp.clearance*2/count;
        surface.sampleTerrain(camp.x+x,camp.z+z,probe);
        if(!probe.traversable||probe.grade>.2)return failure(`occupation:${camp.id}`,rejected);
      }
      yield;
    }
    const solids=[...obstacles,...plan.camps.map(p=>({position:p,radius:p.recipe.footprint}))];
    const entry=plan.ports[0];
    for(const anchor of anchors.anchors) {
      const p=anchor.point;
      const alternatives=[['direct',[p,entry]],['east-west-first',[p,{x:entry.x,z:p.z},entry]],['north-south-first',[p,{x:p.x,z:entry.z},entry]]];
      for(const [name,rawPoints] of alternatives) {
        const id=`${anchor.id}:${name}`,points=compact(rawPoints);
        if(points.length<2)continue;
        if(!clearReservations(points,reservations)||!routeClearsSolids(points,solids)||!shapesClearOfRoads(shapes,[{points}],4.5)){rejected.push({id,reason:'protected-envelope'});continue;}
        const report=yield* validateRouteSteps(surface.supportWorld,points,{surfaceId:anchor.surfaceId});
        if(!report.valid||report.endSurfaceId!=='terrain'){rejected.push({id,reason:report.reason||'support-port'});continue;}
        const entryJoin=[closeTo(entry,points.at(-2)),entry,closeTo(entry,plan.mainRoad[1])];
        const roadJoins=[anchor.a,anchor.b].map(source=>['external-road-join',[closeTo(p,source),p,closeTo(p,points[1])]]);
        let rejectedJoin=null;
        for(const [joinId,join] of [['district-join',entryJoin],...roadJoins]) {
          const joinReport=yield* validateRouteSteps(surface.supportWorld,compact(join),{surfaceId:joinId==='district-join'?'terrain':anchor.surfaceId});
          if(!joinReport.valid){rejectedJoin=`${joinId}:${joinReport.reason}`;break;}
        }
        if(rejectedJoin){rejected.push({id,reason:rejectedJoin});continue;}
        const bounds={minX:Math.min(plan.bounds.minX,...points.map(p=>p.x-5.5)),maxX:Math.max(plan.bounds.maxX,...points.map(p=>p.x+5.5)),
          minZ:Math.min(plan.bounds.minZ,...points.map(p=>p.z-5.5)),maxZ:Math.max(plan.bounds.maxZ,...points.map(p=>p.z+5.5))};
        const completed=freezeLandscapePlan({...plan,terrainBounds:plan.bounds,bounds,connection:{id,points,edgeId:anchor.edgeId,width:Math.min(9,anchor.width),surfaceId:anchor.surfaceId,report}});
        const receipt=Object.freeze({ownerId:candidate.id});
        receipts.set(receipt,Object.freeze({plan:completed,surface,key:captured,getKey,route:Object.freeze(route),connection:report}));
        return {valid:true,reason:null,plan:completed,receipt,rejected};
      }
    }
    return failure('no-feasible-connection',rejected);
  }
  const iterator=admit();
  return Object.freeze({
    get done(){return done;},get result(){return result;},
    step({maxSteps=64,deadline=performance.now()+1.5}={}) {
      if(!Number.isInteger(maxSteps)||maxSteps<1||maxSteps>128||typeof deadline!=='number'||Number.isNaN(deadline))throw new RangeError('Invalid admission work limit');
      if(!done&&getKey()!==captured){iterator.return();done=true;result=failure('world-changed');}
      let steps=0;
      try {while(!done&&steps<maxSteps&&performance.now()<deadline){const item=iterator.next();steps++;done=item.done;if(done)result=item.value;}}
      catch(error){done=true;result=failure('admission-error');throw error;}
      return {done,result,steps};
    },
    cancel(){if(!done){iterator.return();done=true;result=failure('cancelled');}}
  });
}

// Only a response associated with the current owned worker job can be adopted.
// The transport checks job/fingerprint identity before calling this function.
export function adoptLandscapeAdmission(data,{candidate,surface,key:expectedKey,getKey}) {
  if(getKey()!==expectedKey||data.key!==expectedKey||data.candidateId!==candidate.id)return failure('world-changed');
  if(!data.valid)return failure(data.reason,data.rejected||[]);
  if(data.plan?.id!==candidate.id||data.plan.version!==candidate.version||data.route?.valid!==true||data.plan.connection?.report?.valid!==true)throw new TypeError('Incomplete landscape worker proof');
  const plan=freezeLandscapePlan(data.plan),route=freezeLandscapePlan(data.route),receipt=Object.freeze({ownerId:candidate.id});
  receipts.set(receipt,Object.freeze({plan,surface,key:expectedKey,getKey,route,connection:plan.connection.report}));
  return {valid:true,reason:null,plan,receipt,rejected:data.rejected||[]};
}


// A connection can reach 600m beyond its terrain feature. Querying this fixed
// halo discovers complete owners from a tiny window along an external spur.
export function landscapeAdmissionCandidatesInBounds(bounds) {
  return landscapeCandidatesInBounds({minX:bounds.minX-610,maxX:bounds.maxX+610,minZ:bounds.minZ-610,maxZ:bounds.maxZ+610});
}
