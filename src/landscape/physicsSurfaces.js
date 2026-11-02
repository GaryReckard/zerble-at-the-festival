import {buildHeightGrid,segmentIntersectsBounds} from './geometry.js';
import {terrainVertexHeight,terrainGenerationKey} from '../worldgen/terrain.js';
const intersects=(a,b)=>a.minX<=b.maxX&&a.maxX>=b.minX&&a.minZ<=b.maxZ&&a.maxZ>=b.minZ;
// This adapts an existing physics owner's engine. It owns only its fixed
// surfaces and leases, so it cannot replace the prop controller or its clock.
export class LandscapePhysicsSurfaces {
  constructor(runtime,adapter,{origin={x:0,z:0},tileSize=80,maxTiles=32,maxTracked=64,maxCreates=4}={}){
    if(!runtime?.owners||!adapter?.addBody||!adapter?.readBody||!adapter?.removeBody||![origin.x,origin.z].every(Number.isFinite)||tileSize!==80||!Number.isInteger(maxTiles)||maxTiles<4||maxTiles>128||!Number.isInteger(maxTracked)||maxTracked<1||maxTracked>128||!Number.isInteger(maxCreates)||maxCreates<1||maxCreates>16)throw new TypeError('Invalid landscape physics ownership limits');
    Object.assign(this,{runtime,adapter,tileSize,maxTiles,maxTracked,maxCreates});this.origin=Object.freeze({x:Math.round(origin.x/10)*10,z:Math.round(origin.z/10)*10});
    this.key=terrainGenerationKey();this.fixed=new Map();this.tracked=new Map();this.disposed=false;this.metrics={created:0,removed:0,largestCreateMs:0};
  }
  toPhysics(p){return {x:p.x-this.origin.x,y:p.y,z:p.z-this.origin.z};}
  toWorld(p){return {x:p.x+this.origin.x,y:p.y,z:p.z+this.origin.z};}
  _current(){return !this.disposed&&!this.runtime.disposed&&terrainGenerationKey()===this.key;}
  _requirements(body,radius,delta=0){
    const p=this.toWorld(body.pose.position),v=body.linearVelocity,next={x:p.x+v.x*delta,z:p.z+v.z*delta},pad=radius+2;
    if(Math.max(Math.abs(p.x-this.origin.x),Math.abs(p.z-this.origin.z),Math.abs(next.x-this.origin.x),Math.abs(next.z-this.origin.z))>2048)return {error:'origin-range'};
    const bounds={minX:Math.min(p.x,next.x)-pad,maxX:Math.max(p.x,next.x)+pad,minZ:Math.min(p.z,next.z)-pad,maxZ:Math.max(p.z,next.z)+pad},requirements=[];
    const columns=Math.floor(bounds.maxX/80)-Math.floor(bounds.minX/80)+1,rows=Math.floor(bounds.maxZ/80)-Math.floor(bounds.minZ/80)+1;
    if(columns*rows>this.maxTiles)return {error:'terrain-capacity'};
    for(let z=Math.floor(bounds.minZ/80);z<=Math.floor(bounds.maxZ/80);z++)for(let x=Math.floor(bounds.minX/80);x<=Math.floor(bounds.maxX/80);x++)requirements.push({id:`landscape-physics:${this.key}:tile:${x},${z}`,kind:'terrain',x,z});
    for(const record of this.runtime.owners.values())if(record.water&&intersects(record.candidate.bridge.bounds,bounds))requirements.push({id:`landscape-physics:${record.candidate.bridge.id}`,kind:'deck',record});
    return {requirements,p,next,bounds};
  }
  _create(requirement){
    const begin=performance.now();let spec;
    if(requirement.kind==='terrain'){
      const minX=requirement.x*80-this.origin.x,minZ=requirement.z*80-this.origin.z,data=buildHeightGrid((x,z)=>terrainVertexHeight(x+this.origin.x,z+this.origin.z),{minX,maxX:minX+80,minZ,maxZ:minZ+80});
      // Keep mesh coordinates close to the engine origin rather than feeding
      // enormous festival coordinates into single-precision physics buffers.
      spec={id:requirement.id,type:'fixed',colliders:[{shape:'trimesh',vertices:data.positions,indices:data.indices,friction:.7}]};
    }else{
      const bridge=requirement.record.candidate.bridge,b=bridge.bounds;
      spec={id:requirement.id,type:'fixed',pose:{position:this.toPhysics({x:(b.minX+b.maxX)/2,y:bridge.height-.14,z:(b.minZ+b.maxZ)/2})},colliders:[{shape:'cuboid',halfExtents:{x:(b.maxX-b.minX)/2,y:.14,z:(b.maxZ-b.minZ)/2},friction:.7}]};
    }
    const result=this.adapter.addBody(spec);this.metrics.largestCreateMs=Math.max(this.metrics.largestCreateMs,performance.now()-begin);
    if(!result.ok)return result;
    this.fixed.set(requirement.id,requirement);this.metrics.created++;return {ok:true};
  }
  _lease(record,data){
    const needed=new Set(data.requirements.map(r=>r.id));
    record.fixed=needed;
    const owners=new Map();
    for(const r of this.runtime.owners.values()){
      if(r.water&&intersects(r.candidate.bridge.bounds,data.bounds))owners.set(`${r.candidate.id}:water`,r.water);
      if(r.district&&intersects(r.candidate.bounds,data.bounds))owners.set(r.candidate.id,r.district);
    }
    for(const [id,release]of record.owners)if(!owners.has(id)){release();record.owners.delete(id);}
    for(const [id,owner]of owners)if(!record.owners.has(id))record.owners.set(id,owner.pin(record.id));
  }
  _prune(){
    const needed=new Set();for(const record of this.tracked.values())for(const id of record.fixed)needed.add(id);
    for(const id of this.fixed.keys())if(!needed.has(id)){this.adapter.removeBody(id);this.fixed.delete(id);this.metrics.removed++;}
  }
  prepare({delta=1/60,deadline=Infinity,maxCreates=this.maxCreates}={}){
    if(!this._current())return {ok:false,reason:'world-changed'};
    if(!Number.isFinite(delta)||delta<0||delta>.1||typeof deadline!=='number'||Number.isNaN(deadline)||!Number.isInteger(maxCreates)||maxCreates<1||maxCreates>16)throw new RangeError('Invalid physical support work limits');
    const plans=[],requirements=new Map();
    for(const record of this.tracked.values()){
      const body=this.adapter.readBody(record.id);if(!body)return {ok:false,reason:'missing-body',id:record.id};
      if(body.generation!==record.generation)return {ok:false,reason:'body-replaced',id:record.id};
      const data=this._requirements(body,record.radius,delta);
      if(data.error)return {ok:false,reason:data.error,id:record.id};
      if(data.requirements.length>this.maxTiles)return {ok:false,reason:'terrain-capacity',id:record.id};
      // A prop may cross a bridge in either vertical direction. Both the real
      // bed and deck remain present; physics chooses actual solid contact.
      for(const candidate of this.runtime.access.query(data.bounds,{request:false})){
        const bridge=candidate.candidate.bridge;
        if(bridge&&segmentIntersectsBounds(data.p,data.next,bridge.bounds,record.radius)&&!this.runtime.owners.get(candidate.candidate.id)?.water)return {ok:false,reason:'support-not-resident',ownerId:candidate.candidate.id};
      }
      for(const r of data.requirements)requirements.set(r.id,r);plans.push({record,data});
    }
    if(requirements.size>this.maxTiles)return {ok:false,reason:'terrain-capacity'};
    // Reserve the complete desired set and its owners before incremental
    // allocation. Partial preparation survives the next frame, and occupied
    // owners cannot disappear while the caller waits to advance physics.
    for(const {record,data}of plans)this._lease(record,data);
    this._prune();
    let created=0;
    for(const r of requirements.values())if(!this.fixed.has(r.id)){
      if(created>=maxCreates||performance.now()>=deadline)return {ok:false,reason:'preparing',created};
      const result=this._create(r);if(!result.ok)return {...result,created};created++;
    }
    this._prune();return {ok:true,created};
  }
  step(delta,options={}){
    const result=this.prepare({...options,delta});
    if(!result.ok)return {...result,stepped:false};
    this.adapter.step(delta);return {...result,stepped:true};
  }
  track(id,{radius=1}={}){
    if(!this._current())return {ok:false,reason:'world-changed'};
    if(typeof id!=='string'||!id||!Number.isFinite(radius)||radius<=0||radius>12)throw new TypeError('Invalid physical prop lease');
    if(this.tracked.has(id))return {ok:false,reason:'duplicate-prop'};
    if(this.tracked.size>=this.maxTracked)return {ok:false,reason:'prop-capacity'};
    const body=this.adapter.readBody(id);if(!body||body.type!=='dynamic')return {ok:false,reason:'invalid-prop'};
    const p=this.toWorld(body.pose.position);if(Math.abs(p.x-this.origin.x)>2048||Math.abs(p.z-this.origin.z)>2048)return {ok:false,reason:'origin-range'};
    this.tracked.set(id,{id,generation:body.generation,radius,fixed:new Set(),owners:new Map()});
    const ready=this.prepare({delta:0,maxCreates:16});
    if(!ready.ok&&ready.reason!=='preparing'){this.release(id);return ready;}
    return {ok:true,ready:ready.ok};
  }
  release(id,{removeBody=false}={}){
    const record=this.tracked.get(id);if(!record)return false;
    if(removeBody)this.adapter.removeBody(id);
    for(const release of record.owners.values())release();this.tracked.delete(id);this._prune();return true;
  }
  counts(){return {disposed:this.disposed,tracked:this.tracked.size,fixed:this.fixed.size,ownerLeases:[...this.tracked.values()].reduce((n,r)=>n+r.owners.size,0),...this.metrics};}
  dispose({removeTracked=false}={}){
    if(this.disposed)return true;
    if(this.tracked.size&&!removeTracked)return false;
    for(const id of [...this.tracked.keys()])this.release(id,{removeBody:removeTracked});this._prune();this.disposed=true;return true;
  }
}
