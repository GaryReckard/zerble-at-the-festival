import * as THREE from 'three';
import {buildOneWheelRider,updateOneWheelRider} from './models/oneWheelRider.js';
import {OneWheelMotion,ONE_WHEEL_TUNING as T,riderYieldReason} from './oneWheelMotion.js';
import {wagonRoutes,sampleWagonRoute} from './nutWagonRoute.js';
import {registry} from './registry.js';
import {nearestHeart} from './worldgen/hearts.js';
import {approachRoadsOf} from './worldgen/roads.js';
import {lakeAt} from './worldgen/water.js';
import {worldHash,mulberry32} from './rng.js';

const SALT=0x0A1E771;
const WATER_OFFSETS=[[0,0],...[0,1,2,3,4,5,6,7].map(i=>[Math.sin(i*Math.PI/4)*.95,Math.cos(i*Math.PI/4)*.95])];

export class OneWheels {
  constructor(scene,crowd,{procedural=true,isWater=lakeAt}={}) {
    this.scene=scene;this.crowd=crowd;this.procedural=procedural;this.isWater=isWater;
    this.riders=[];this.visited=new Set();this.checkTimer=0;this.time=0;
    this.frustum=new THREE.Frustum();this.matrix=new THREE.Matrix4();
    this.sphere=new THREE.Sphere(new THREE.Vector3(),2);this.sample={};
    this.disposed=false;
  }
  clearAt(x,z,ignore=null) {
    for(const [dx,dz] of WATER_OFFSETS)if(this.isWater(x+dx,z+dz))return false;
    let clear=true;
    registry.collidersNear(x,z,T.radius,e=>{
      if(e===ignore)return;
      if(Math.hypot(x-e.position.x,z-e.position.z)<e.collider.radius+T.radius+.1)clear=false;
    });
    return clear;
  }
  trySpawn(player,camera=null,force=false) {
    if(this.disposed||this.riders.length>=T.maxRiders)return false;
    const {heart}=nearestHeart(player.x,player.z);if(!heart)return false;
    const seed=worldHash(heart.cx,heart.cz,SALT)>>>0;
    const cellX=Math.floor(player.x/T.encounterCell),cellZ=Math.floor(player.z/T.encounterCell);
    const key=`${cellX},${cellZ}`;
    if(!force){
      if(this.visited.has(key))return false;
      if((worldHash(cellX,cellZ,SALT+1)>>>0)/4294967296>=T.encounterChance){this.remember(key);return false;}
    }
    const routes=wagonRoutes(approachRoadsOf(heart).map(r=>r.oriented),player,
      (x,z)=>this.clearAt(x,z),T.spawnMax+15);
    if(camera)this.frustum.setFromProjectionMatrix(this.matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    const choices=[];
    for(const route of routes)for(let d=3;d<route.length-3;d+=7){
      sampleWagonRoute(route,d,this.sample);
      const distance=Math.hypot(this.sample.x-player.x,this.sample.z-player.z);
      if(distance<(force?12:T.spawnMin)||distance>T.spawnMax)continue;
      this.sphere.center.set(this.sample.x,1.2,this.sample.z);
      if(!force&&camera&&this.frustum.intersectsSphere(this.sphere))continue;
      if(riderYieldReason(this.sample.x,this.sample.z,this.sample.heading,0,player,this.crowd.npcs))continue;
      choices.push({route,d,distance});
    }
    if(!choices.length)return false;
    choices.sort((a,b)=>a.distance-b.distance);
    const rng=mulberry32(seed^(worldHash(cellX,cellZ,SALT+2)>>>0));
    const chosen=force?choices[0]:choices[Math.floor(rng()*choices.length)];
    const rider=this.spawnOnRoute(chosen.route,chosen.d,seed,rng()<.5?1:-1);
    if(rider)this.remember(key);return Boolean(rider);
  }
  remember(key){this.visited.add(key);if(this.visited.size>256)this.visited.delete(this.visited.values().next().value);}
  spawnOnRoute(route,distance=0,seed=771,direction=1) {
    if(this.disposed||this.riders.length>=T.maxRiders)return null;
    const motion=new OneWheelMotion(route,distance,direction);
    if(!this.clearAt(motion.x,motion.z))return null;
    const group=buildOneWheelRider({rng:mulberry32(seed)});
    const position=new THREE.Vector3(motion.x,0,motion.z);
    group.position.copy(position);group.rotation.y=motion.heading;this.scene.add(group);
    const entry={kind:'one_wheel',position,footprint:T.radius,collider:{radius:T.radius,damage:2}};
    const rider={group,motion,entry,id:registry.add(entry),animation:{},seed};
    // Reuse closures and options in the steady-state update.
    rider.environment={clear:(x,z)=>{
      if(!this.clearAt(x,z,entry))return false;
      if(this.player&&Math.hypot(x-this.player.x,z-this.player.z)<2.4)return false;
      for(const npc of this.crowd.npcs){
        if(npc.state==='riding'||npc.state==='hammock_riding'||npc.state==='table_seated')continue;
        if(Math.hypot(x-npc.pos.x,z-npc.pos.z)<1.25)return false;
      }
      return true;
    },
      yieldAhead:(x,z,heading,speed)=>riderYieldReason(x,z,heading,speed,this.player,this.crowd.npcs),
      gathering:(x,z)=>{
        let count=0;
        for(const n of this.crowd.npcs)if(n.state!=='riding'&&Math.hypot(n.pos.x-x,n.pos.z-z)<10)count++;
        return count>=4;
      }};
    this.riders.push(rider);return rider;
  }
  update(dt,player,nightness,camera=null) {
    if(this.disposed)return;
    this.player=player;this.time+=Math.min(dt,.25);this.checkTimer-=dt;
    if(this.procedural&&this.checkTimer<=0){this.checkTimer=5;this.trySpawn(player,camera);}
    for(let i=this.riders.length-1;i>=0;i--){
      const rider=this.riders[i],m=rider.motion;
      if(Math.hypot(m.x-player.x,m.z-player.z)>T.despawnDistance){this.remove(rider);continue;}
      const oldX=m.x,oldZ=m.z;
      m.update(dt,rider.environment);
      rider.entry.position.set(m.x,0,m.z);rider.group.position.copy(rider.entry.position);
      rider.group.rotation.y=m.heading;
      const a=rider.animation;
      a.speed=dt>0?Math.hypot(m.x-oldX,m.z-oldZ)/dt:0;
      a.acceleration=m.acceleration;a.turnRate=m.turnRate;a.nightness=nightness;a.time=this.time;
      updateOneWheelRider(rider.group,dt,a);
    }
  }
  onHit(entry){
    const rider=this.riders.find(r=>r.entry===entry);if(!rider)return;
    rider.motion.speed=0;rider.motion.pause=3;rider.motion.state='paused';
  }
  remove(rider) {
    const index=this.riders.indexOf(rider);if(index<0)return;
    registry.remove(rider.id);rider.group.removeFromParent();
    rider.group.traverse(o=>{
      if(o.isMesh){
        if(!o.geometry?.userData?.shared)o.geometry?.dispose();
        for(const m of Array.isArray(o.material)?o.material:[o.material])if(!m?.userData?.shared)m?.dispose?.();
        if(o.isInstancedMesh)o.dispose();
      }
    });
    this.riders.splice(index,1);
  }
  dispose(){for(const rider of [...this.riders])this.remove(rider);this.disposed=true;}
  status(){return this.riders.map(r=>({state:r.motion.state,reason:r.motion.waitReason,
    speed:r.motion.speed,position:r.entry.position.toArray(),routeDistance:r.motion.distance,seed:r.seed}));}
}
