import {landscapeTileSupport,landscapePhysicsGround} from './physicsTiles.js';
import { LandscapePhysicsSurfaces } from './physicsSurfaces.js';
import { LandscapePlanner } from './planner.js';
import { LandscapeAccessIndex } from './accessIndex.js';
import { createSupportWorld,createSupportBinding } from './support.js';
import { createMountainDistrictBuild } from './districtBuild.js';
import { buildLandscapeWaterOwner,warmLandscapeResources } from './waterOwner.js';
import { sampleTerrain,terrainVertexHeight,terrainGenerationKey } from '../worldgen/terrain.js';
import {installLandscapePolicy} from '../worldgen/landscapePolicy.js';
import { registry } from '../registry.js';
import { rectangleFootprint } from './routes.js';
const box=(p,r)=>({minX:p.x-r,maxX:p.x+r,minZ:p.z-r,maxZ:p.z+r});
const distance=(p,b)=>Math.hypot(Math.max(b.minX-p.x,0,p.x-b.maxX),Math.max(b.minZ-p.z,0,p.z-b.maxZ));
const contains=(b,p)=>p.x>=b.minX&&p.x<=b.maxX&&p.z>=b.minZ&&p.z<=b.maxZ;

// Canonical planning outlives render residency. Every dependent chunk waits for
// complete access reservations; every occupied surface retains its render owner.
export class LandscapeRuntime {
  constructor(scene,{crowd=null,planner=null,loadRadius=650,unloadRadius=950,maxOwners=16,externallyAnimatedDrum=true}={}) {
    if(!scene?.add||!Number.isFinite(loadRadius)||loadRadius<100||!Number.isFinite(unloadRadius)||unloadRadius<=loadRadius||!Number.isInteger(maxOwners)||maxOwners<1||maxOwners>32)throw new TypeError('Invalid landscape residency limits');
    Object.assign(this,{scene,crowd,loadRadius,unloadRadius,maxOwners,externallyAnimatedDrum});
    this.key=terrainGenerationKey();this.disposed=false;this.owners=new Map();this.borrowers=new Map();this.waiters=new Set();this.failures=new Map();this.metrics={waterCpuMs:0,largestWaterMs:0,buildCpuMs:0,largestBuildStepMs:0,largestBuildPhase:null,largestWaterPhase:null};
    this.planner=planner||new LandscapePlanner({renderGeometry:true,onChange:()=>this._notify()});
    if(planner){const previous=planner.onChange;planner.onChange=()=>{previous?.();this._notify();};}
    this.access=new LandscapeAccessIndex(this.planner);
    const deckSource={near:(x,z)=>[...this.owners.values()].filter(r=>r.water&&distance({x,z},r.candidate.bridge.bounds)<12).map(r=>r.candidate.bridge),resolve:id=>{for(const r of this.owners.values())if(r.water&&r.candidate.bridge.id===id)return r.candidate.bridge;return null;}};
    this.supportWorld=createSupportWorld({sampleTerrain,deckSource,isCurrent:()=>!this.disposed&&terrainGenerationKey()===this.key});
    if(crowd)crowd.surfaceWorld=this.supportWorld;
    warmLandscapeResources();
  }
  installPolicy(){
    this.releasePolicy=installLandscapePolicy({clearance:(x,z,radius,actors)=>this.access.clearance(x,z,radius,{actors}),nearestRoad:(x,z,legacy)=>this.access.nearestRoad(x,z,legacy)});
  }
  _notify(){for(const check of [...this.waiters])check();}
  prepare(bounds){
    if(this.disposed)return Promise.reject(new Error('Landscape runtime disposed'));
    return new Promise((resolve,reject)=>{
      const check=()=>{
        if(this.disposed||terrainGenerationKey()!==this.key){this.waiters.delete(check);reject(new Error('Landscape world changed'));return;}
        const records=this.access.query(bounds),failure=records.find(r=>r.state.status==='unavailable');
        if(failure){this.waiters.delete(check);reject(new Error(`Landscape planning unavailable: ${failure.state.reason}`));}
        else if(records.every(r=>['ready','rejected'].includes(r.state.status))){this.waiters.delete(check);resolve();}
      };this.waiters.add(check);check();
    });
  }
  bindVehicle(vehicle,{footprint=rectangleFootprint(1.9,2.8)}={}) {
    const binding=createSupportBinding(this.supportWorld,{x:vehicle.position.x,z:vehicle.position.z,heading:vehicle.heading||0},{footprint,allowSteepTerrain:true});
    vehicle.surfaceBinding=binding;vehicle.surfaceSampler=binding.sample;vehicle.colliderHeight=4.1;vehicle.groundOnSurface?.();return binding;
  }
  physicsGround(x,z,y,out){return landscapePhysicsGround(this,x,z,y,out);}
  physicsSupport(bounds,origin){return landscapeTileSupport(this,bounds,origin);}
  attachPhysics(adapter,options={}){
    if(this.disposed)throw new Error('Landscape runtime disposed');
    if(this.physics&&!this.physics.disposed)throw new Error('Landscape physics already attached');
    return this.physics=new LandscapePhysicsSurfaces(this,adapter,options);
  }
  _retain(movers){
    const wanted=new Map();
    for(const mover of movers){
      if(mover.active===false)continue;
      const binding=mover.surfaceBinding,position=mover.position||mover.pos;if(!position)continue;
      const selected=binding?.snapshot().surfaceId;
      for(const record of this.owners.values()){
        if(record.water&&selected===record.candidate.bridge.id)wanted.set(`${record.candidate.id}:water`,{owner:record.water,movers:new Set([...(wanted.get(`${record.candidate.id}:water`)?.movers||[]),mover])});
        const home=record.district?.residents.some(r=>r.npc===mover)?record.candidate.id:mover.chunkKey||mover._chunkKey;
        if(record.district&&home!==record.candidate.id&&contains(record.candidate.bounds,position))wanted.set(record.candidate.id,{owner:record.district,movers:new Set([...(wanted.get(record.candidate.id)?.movers||[]),mover])});
      }
    }
    for(const [id,lease]of this.borrowers)if(!wanted.has(id)){lease.release();this.borrowers.delete(id);}
    for(const [id,entry]of wanted)if(!this.borrowers.has(id))this.borrowers.set(id,{release:entry.owner.pin(entry.movers)});
  }
  update(player,{deadline=performance.now()+1.5,time=0,nightness=0,dt=0,movers=[]}={}) {
    if(this.disposed)return;
    if(terrainGenerationKey()!==this.key){this.dispose();return;}
    const position=player.position||player;
    this._retain([player,...movers,...this.crowd?.npcs||[]]);
    for(const [id,record]of this.owners)if(distance(position,record.bounds)>this.unloadRadius){
      record.job?.cancel();record.job=null;
      if(record.district&&!record.district.dispose())continue;
      record.district=null;
      if(record.water&&!record.water.dispose())continue;
      this.owners.delete(id);
    }
    const nearby=this.access.query(box(position,this.loadRadius)).filter(r=>r.candidate.kind==='mountain-top'&&distance(position,this.access.boundsFor(r.candidate,r.state))<=this.loadRadius).sort((a,b)=>distance(position,this.access.boundsFor(a.candidate,a.state))-distance(position,this.access.boundsFor(b.candidate,b.state)));
    for(const {candidate,state}of nearby){
      if(performance.now()>=deadline)break;
      if(!['ready','rejected'].includes(state.status)||this.failures.has(candidate.id))continue;
      let record=this.owners.get(candidate.id);
      if(!record){
        if(this.owners.size>=this.maxOwners)break;
        if(!state.render){this.failures.set(candidate.id,'missing-render-data');continue;}
        const begin=performance.now();
        const water=buildLandscapeWaterOwner(this.scene,{stream:candidate.stream,bridge:candidate.bridge,vertexHeight:terrainVertexHeight,registry,...state.render});
        const elapsed=performance.now()-begin;this.metrics.waterCpuMs+=elapsed;if(elapsed>this.metrics.largestWaterMs){this.metrics.largestWaterMs=elapsed;this.metrics.largestWaterPhase=Object.entries(water.allocation).filter(([name])=>name!=='total').sort((a,b)=>b[1]-a[1])[0]?.[0]||null;}
        record={candidate,state,bounds:this.access.boundsFor(candidate,state),water,district:null,job:null};this.owners.set(candidate.id,record);
        // A bridge becomes selectable only after its actual owner is present.
        if(performance.now()>=deadline)break;
      }
      if(state.status==='ready'&&!record.district){
        record.job ||= createMountainDistrictBuild(this.scene,state.surface,{plan:state.plan,admission:state.receipt,crowd:this.crowd,movementWorld:this.supportWorld,externallyAnimatedDrum:this.externallyAnimatedDrum,cullDetail:true});
        record.job.step({maxSteps:32,deadline});
        const stepStats=record.job.stats();if(stepStats.largestStepMs>this.metrics.largestBuildStepMs){this.metrics.largestBuildStepMs=stepStats.largestStepMs;this.metrics.largestBuildPhase=stepStats.largestPhase;}
        if(record.job.done){
          const stats=record.job.stats();this.metrics.buildCpuMs+=stats.cpuMs;this.metrics.largestBuildStepMs=Math.max(this.metrics.largestBuildStepMs,stats.largestStepMs);
          if(record.job.result.valid)record.district=record.job.result.owner;else this.failures.set(candidate.id,record.job.result.message||record.job.result.reason);
          record.job=null;
        }
      }
    }
    for(const record of this.owners.values())record.district?.update(time,nightness,dt,player.position?player:null);
  }
  stats(){return {disposed:this.disposed,owners:this.owners.size,districts:[...this.owners.values()].filter(r=>r.district).length,building:[...this.owners.values()].filter(r=>r.job).length,borrowed:this.borrowers.size,failures:[...this.failures],planner:this.planner.stats(),...this.metrics};}
  dispose(){
    if(this.physics&&!this.physics.dispose())return false;
    if(!this.disposed){this.disposed=true;this.releasePolicy?.();this.planner.dispose();this._notify();}
    let complete=true;
    for(const [id,record]of this.owners){record.job?.cancel();record.job=null;if(record.district&&!record.district.dispose()){complete=false;continue;}record.district=null;if(record.water&&!record.water.dispose()){complete=false;continue;}this.owners.delete(id);}
    return complete;
  }
  shutdown(){
    this.physics?.dispose({removeTracked:true});
    this.releaseMovers();
    for(const record of this.owners.values())for(const resident of record.district?.residents||[])if(this.crowd?.npcs.includes(resident.npc))this.crowd.removeNpc(resident.npc);
    return this.dispose();
  }
  releaseMovers(){for(const lease of this.borrowers.values())lease.release();this.borrowers.clear();}
}
