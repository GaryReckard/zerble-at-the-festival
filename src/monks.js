import * as THREE from 'three';
import {buildMonk} from './models/monk.js';
import {registry} from './registry.js';
import {lakeAt} from './worldgen/water.js';
import {mulberry32,getSessionSeed} from './rng.js';
import {sampleWagonRoute} from './nutWagonRoute.js';

const AMBIENT = new Set(['idle','walking','watching','approaching']);
const BUSY = new Set(['seeking_potty','entering_potty','using_potty','exiting_potty',
    'surprised_potty','walking_to_table','table_seated']);
export class MonkParty {
    constructor(crowd,wagon=null) {
        this.crowd=crowd;this.wagon=wagon;this.members=[];this.clock=0;this.nextChoice=0;
        this.rng=mulberry32((getSessionSeed()^0x6d6f6e6b)>>>0);
        this.root=new THREE.Group();this.root.name='Monk travelling party';crowd.group.add(this.root);
        this.center=new THREE.Vector3();this.destination=new THREE.Vector3();
        this.vehicle=null;this.boarding=false;this.cooldown=0;this.rideUntil=0;this.seenWagon=null;
        this.tickTimer=0;this.sample={};this.ready=new Set();
        crowd.parties.add(this);
    }
    clearAt(x,z) {
        if(lakeAt(x,z))return false;
        let clear=true;
        registry.collidersNear(x,z,.5,e=>{
            if(Math.hypot(x-e.position.x,z-e.position.z)<e.collider.radius+.45)clear=false;
        });
        return clear;
    }
    spawn(position,count=4+Math.floor(this.rng()*3)) {
        if(this.members.length || count<4 || count>6 || this.crowd.free.length<count)return false;
        const spots=[];
        for(let i=0;i<count;i++){
            const a=i*2.399+.4,r=2.4+(i%3)*.8,x=position.x+Math.cos(a)*r,z=position.z+Math.sin(a)*r;
            if(!this.clearAt(x,z))return false;
            spots.push(new THREE.Vector3(x,0,z));
        }
        for(let i=0;i<count;i++){
            const npc=this.crowd.spawn({pos:spots[i],rng:this.rng,allowPhotographer:false});
            if(!npc){this.clear();return false;}
            if(npc.groupId){
                const old=this.crowd.groups.get(npc.groupId);
                if(old){old.members=old.members.filter(id=>id!==npc.idx);if(!old.members.length)this.crowd.groups.delete(npc.groupId);}
            }
            npc.groupId=null;npc.party=this;npc.scale=.87+this.rng()*.07;npc.energy=.78+this.rng()*.12;
            npc.curiosity=.55;npc.skittish=.15;npc.dance=.15+this.rng()*.15;
            npc.partyTarget=spots[i].clone();npc.partyOffset=spots[i].clone().sub(position);
            npc.avatar=buildMonk(i);this.root.add(npc.avatar);this.members.push(npc);
            this.crowd._writeMatrices(npc);
        }
        this.center.copy(position);this.destination.copy(position);this.nextChoice=this.clock+14;
        this.cooldown=this.clock+5;return true;
    }
    allowActivity(npc) {
        return !this.vehicle && !this.members.some(n=>n!==npc&&BUSY.has(n.state));
    }
    reserve(vehicle) {
        if(this.vehicle || this.clock<this.cooldown || this.members.length<4
            || this.members.some(n=>!AMBIENT.has(n.state)||n.seatSlot))return false;
        const stopped=vehicle===this.wagon?vehicle.active&&vehicle.state==='parked':Math.abs(vehicle.speed)<.6&&!this.crowd.bubblesEmpty;
        if(!stopped || this.members.some(n=>Math.hypot(n.pos.x-vehicle.position.x,n.pos.z-vehicle.position.z)>14))return false;
        // The shared outing favors the open-air places seen in the reference photo.
        const slots=(vehicle.seatSlots||[]).filter(s=>!s.occupied&&!s.permanent);
        if(slots.length<this.members.length)return false;
        if(vehicle===this.wagon) {
            const rank=s=>s.name==='platform'?0:s.kind==='roof'?1:s.name.startsWith('cargo')?2:3;
            slots.sort((a,b)=>rank(a)-rank(b));
        }
        this.vehicle=vehicle;this.boarding=true;this.ready.clear();this.boardDeadline=this.clock+22;
        this.members.forEach((n,i)=>{
            n.seatSlot=slots[i];slots[i].occupied=true;n.state='boarding';n.stateTimer=22;n.rideTimer=Infinity;
        });
        if(vehicle===this.wagon)vehicle.stopTimer=Math.max(vehicle.stopTimer,24);
        return true;
    }
    arrive(npc) {
        this.ready.add(npc);
        if(this.ready.size!==this.members.length)return false;
        this.boarding=false;this.rideUntil=this.clock+45+this.rng()*25;
        for(const n of this.members){
            n.state='riding';n.rideTimer=Infinity;
            if(this.vehicle!==this.wagon)this.crowd.onBoard?.(n);
        }
        return true;
    }
    leave() {
        if(!this.members.length)return;
        const base=this.vehicle?.position||this.center;
        this.center.set(base.x,0,base.z);this.destination.copy(this.center);
        for(const n of this.members){
            if(n.seatSlot)n.seatSlot.occupied=false;
            n.seatSlot=null;n.seatY=undefined;n.rideTimer=undefined;
            n.target.copy(this.center).add(n.partyOffset);
            n.state='walking';n.stateTimer=12;
        }
        this.vehicle=null;this.boarding=false;this.ready.clear();this.cooldown=this.clock+65;
        this.nextChoice=this.clock+10;
    }
    update(dt,zerble) {
        this.clock+=dt;
        if(!this.members.length){
            if(this.wagon?.active&&this.seenWagon!==this.wagon.root){
                this.tickTimer-=dt;
                if(this.tickTimer<=0){
                    this.tickTimer=4;
                    const yaw=this.wagon.root.rotation.y;
                    for(const side of [1,-1]) {
                        const pos=new THREE.Vector3(this.wagon.position.x+Math.cos(yaw)*9*side,0,this.wagon.position.z-Math.sin(yaw)*9*side);
                        if(this.spawn(pos)){this.seenWagon=this.wagon.root;break;}
                    }
                }
            }
            return;
        }
        if(this.members.every(n=>n.pos.distanceToSquared(zerble.position)>245*245)&&!this.vehicle){this.clear();return;}
        if(this.vehicle){
            const stopped=this.vehicle===this.wagon?this.wagon.active&&this.wagon.state==='parked':Math.abs(this.vehicle.speed)<.6;
            if(this.members.some(n=>!n.seatSlot) || (this.vehicle===this.wagon&&!this.wagon.active)){
                this.leave();return;
            }
            if(this.boarding&&(!stopped||this.clock>this.boardDeadline)){this.leave();return;}
            if(!this.boarding&&stopped&&(this.clock>=this.rideUntil||(this.vehicle!==this.wagon&&this.crowd.bubblesEmpty))){
                this.leave();
            }
            return;
        }
        this.tickTimer-=dt;if(this.tickTimer>0)return;this.tickTimer=.5;
        this.center.set(0,0,0);for(const n of this.members)this.center.add(n.pos);this.center.divideScalar(this.members.length);
        if(this.reserve(zerble)||this.wagon&&this.reserve(this.wagon))return;
        const busy=this.members.find(n=>BUSY.has(n.state));
        const spread=this.members.some(n=>n.pos.distanceToSquared(this.center)>12*12);
        if(!busy&&!spread&&this.clock>=this.nextChoice){
            this.nextChoice=this.clock+25+this.rng()*20;
            const places=[...registry.attractors()].filter(a=>['food_truck','picnic_table','stage_front','porta_potty'].includes(a.kind)
                &&Math.hypot(a.position.x-this.center.x,a.position.z-this.center.z)<35);
            if(places.length&&this.rng()<.65){
                const a=places[Math.floor(this.rng()*places.length)];
                this.destination.set(a.position.x+5,0,a.position.z+3);
            }else if(this.wagon?.route){
                const d=Math.max(6,Math.min(this.wagon.route.length-6,this.wagon.distance+(this.rng()-.5)*36));
                sampleWagonRoute(this.wagon.route,d,this.sample);
                this.destination.set(this.sample.x+Math.cos(this.sample.heading)*7,0,this.sample.z-Math.sin(this.sample.heading)*7);
            }else this.destination.copy(this.center).add(new THREE.Vector3((this.rng()-.5)*16,0,(this.rng()-.5)*16));
            if(!this.clearAt(this.destination.x,this.destination.z))this.destination.copy(this.center);
        }
        for(const n of this.members){
            if(!AMBIENT.has(n.state))continue;
            const anchor=busy||spread?this.center:this.destination;
            n.partyTarget.copy(anchor).add(n.partyOffset);
            n.partyTarget.x+=Math.sin(this.clock*.18+n.idx)*.6;
            n.partyTarget.z+=Math.cos(this.clock*.15+n.idx)*.6;
            if(!this.clearAt(n.partyTarget.x,n.partyTarget.z))n.partyTarget.copy(n.pos);
            if(n.pos.distanceToSquared(n.partyTarget)>2.2*2.2){n.target.copy(n.partyTarget);n.state='walking';n.stateTimer=30;}
            else if(n.state==='walking'){n.state='idle';n.stateTimer=3;}
        }
    }
    renderNpc(npc) {
        const g=npc.avatar;if(!g)return;
        g.visible=npc.state!=='using_potty';
        const riding=npc.state==='riding',sitting=(riding&&npc.seatSlot?.kind!=='standing')||npc.state==='table_seated'||npc.pottySitting;
        g.position.set(npc.pos.x,(sitting&&npc.seatY!=null?npc.seatY-.62*npc.scale:riding&&npc.seatY!=null?npc.seatY-(npc.seatSlot?.vehicle?0:1.05):0),npc.pos.z);
        g.rotation.set(0,npc.yaw,0);g.scale.setScalar(npc.scale);
        const speed=riding?0:Math.hypot(npc.vel.x,npc.vel.z);
        g.userData.pose(npc.bob,speed,!!sitting,riding&&npc.seatSlot?.name==='platform');
    }
    clear() {
        for(const n of [...this.members]){n.avatar?.removeFromParent();this.crowd.removeNpc(n);}
        this.members.length=0;this.vehicle=null;this.boarding=false;this.ready.clear();
    }
    dispose(){this.clear();this.root.removeFromParent();this.crowd.parties.delete(this);}
    status(){return {count:this.members.length,state:this.boarding?'boarding':this.vehicle?'riding':'roaming',
        vehicle:this.vehicle===this.wagon&&this.vehicle?'nut_wagon':this.vehicle?'zerble':null,
        waiting:this.members.some(n=>BUSY.has(n.state)),destination:this.destination.toArray()};}
}
