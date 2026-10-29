import * as THREE from 'three';
import {disposeSceneResources} from './people/sceneResources.js';
import {buildMonk} from './models/monk.js';
import {registry} from './registry.js';
import {lakeAt} from './worldgen/water.js';
import {mulberry32,getSessionSeed} from './rng.js';
import {sampleWagonRoute} from './nutWagonRoute.js';

const AMBIENT = new Set(['idle','walking','watching','approaching']);
const BUSY = new Set(['seeking_potty','entering_potty','using_potty','exiting_potty',
    'surprised_potty','walking_to_table','table_seated','camp_walking','camp_seated','camp_sleeping']);
export class MonkParty {
    constructor(crowd,wagon=null) {
        this.wagon=wagon;this.members=[];this.clock=0;this.nextChoice=0;this._disposed=false;
        this.rng=mulberry32((getSessionSeed()^0x6d6f6e6b)>>>0);
        this.root=new THREE.Group();this.root.name='Monk travelling party';
        this.people=crowd.createPersonGroup(this,this.root);
        this.center=new THREE.Vector3();this.destination=new THREE.Vector3();
        this.vehicle=null;this.boarding=false;this.cooldown=0;this.rideUntil=0;this.seenWagon=null;
        this.tickTimer=0;this.sample={};this.ready=new Set();

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
        if(this.members.length || count<4 || count>6 || this._disposed || this.people.capacity<count)return false;
        const spots=[];
        for(let i=0;i<count;i++){
            const a=i*2.399+.4,r=2.4+(i%3)*.8,x=position.x+Math.cos(a)*r,z=position.z+Math.sin(a)*r;
            if(!this.clearAt(x,z))return false;
            spots.push(new THREE.Vector3(x,0,z));
        }
        try {
        for(let i=0;i<count;i++){
            const handle=this.people.spawn({pos:spots[i],rng:this.rng,allowPhotographer:false});
            if(!handle){this.clear();return false;}
            const profile={scale:.87+this.rng()*.07,energy:.78+this.rng()*.12,
                curiosity:.55,skittish:.15,dance:.15+this.rng()*.15};
            const member={handle,target:spots[i].clone(),offset:spots[i].clone().sub(position),view:{},avatar:null};
            this.members.push(member);
            member.avatar=buildMonk(i);this.root.add(member.avatar);
            if(!this.people.bind(handle,profile,{
                publish:pose=>this.renderMember(member,pose),
                hide:()=>{member.avatar.visible=false;},
                release:()=>{try{disposeSceneResources(member.avatar);}finally{member.avatar.removeFromParent();}},
            })){this.clear();return false;}
        }
        } catch(error){try{this.clear();}catch(cleanup){throw new AggregateError([error,cleanup],'Monk spawn and rollback failed.');}throw error;}
        this.center.copy(position);this.destination.copy(position);this.nextChoice=this.clock+14;
        this.cooldown=this.clock+5;return true;
    }
    refreshMembers() {
        for(const member of this.members)this.people.read(member.handle,member.view);
    }
    allowActivity(handle) {
        this.refreshMembers();
        return this.members.some(m=>m.handle===handle)&&!this.vehicle&&!this.members.some(m=>m.handle!==handle&&BUSY.has(m.view.state));
    }
    reserve(vehicle) {
        this.refreshMembers();
        if(this._disposed||this.vehicle||this.clock<this.cooldown||this.members.length<4
            ||this.members.some(m=>!AMBIENT.has(m.view.state)||m.view.seated||m.view.claimed))return false;
        const stopped=vehicle===this.wagon?vehicle.active&&vehicle.state==='parked':Math.abs(vehicle.speed)<.6&&!this.people.bubblesEmpty;
        if(!stopped||this.members.some(m=>Math.hypot(m.view.x-vehicle.position.x,m.view.z-vehicle.position.z)>14))return false;
        const slots=(vehicle.seatSlots||[]).filter(s=>!s.occupied&&!s.permanent);
        if(slots.length<this.members.length)return false;
        if(vehicle===this.wagon){const rank=s=>s.name==='platform'?0:s.kind==='roof'?1:s.name.startsWith('cargo')?2:3;slots.sort((a,b)=>rank(a)-rank(b));}
        const reservation=this.people.reserve(this.members.map(m=>m.handle),vehicle,slots.slice(0,this.members.length));
        if(!reservation)return false;
        this.reservation=reservation;this.vehicle=vehicle;this.boarding=true;this.ready.clear();this.boardDeadline=this.clock+22;
        if(vehicle===this.wagon)vehicle.stopTimer=Math.max(vehicle.stopTimer,24);
        return true;
    }
    arrive(handle,reservation) {
        if(this._disposed||!this.boarding||reservation!==this.reservation||!this.people.hasSeat(handle,reservation))return false;
        this.ready.add(handle);
        if(this.ready.size!==this.members.length)return false;
        this.boarding=false;this.rideUntil=this.clock+45+this.rng()*25;
        return this.people.completeBoarding(this.reservation,this.vehicle!==this.wagon);
    }
    leave() {
        if(this._disposed||!this.members.length||!this.vehicle)return;
        const base=this.vehicle.position;
        this.center.set(base.x,0,base.z);this.destination.copy(this.center);
        this.people.leave(this.reservation,this.members,this.center);this.reservation=null;
        this.vehicle=null;this.boarding=false;this.ready.clear();this.cooldown=this.clock+65;
        this.nextChoice=this.clock+10;
    }
    update(dt,zerble) {
        if(this._disposed)return;
        this.clock+=dt;this.refreshMembers();
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
        if(this.members.every(m=>(m.view.x-zerble.position.x)**2+(m.view.y-zerble.position.y)**2+(m.view.z-zerble.position.z)**2>245*245)&&!this.vehicle){this.clear();return;}
        if(this.vehicle){
            const stopped=this.vehicle===this.wagon?this.wagon.active&&this.wagon.state==='parked':Math.abs(this.vehicle.speed)<.6;
            if(this.members.some(m=>!this.people.hasSeat(m.handle,this.reservation)) || (this.vehicle===this.wagon&&!this.wagon.active)){
                this.leave();return;
            }
            if(this.boarding&&(!stopped||this.clock>this.boardDeadline)){this.leave();return;}
            if(!this.boarding&&stopped&&(this.clock>=this.rideUntil||(this.vehicle!==this.wagon&&this.people.bubblesEmpty))){
                this.leave();
            }
            return;
        }
        this.tickTimer-=dt;if(this.tickTimer>0)return;this.tickTimer=.5;
        this.center.set(0,0,0);for(const m of this.members){this.center.x+=m.view.x;this.center.y+=m.view.y;this.center.z+=m.view.z;}this.center.divideScalar(this.members.length);
        if(this.reserve(zerble)||this.wagon&&this.reserve(this.wagon))return;
        const busy=this.members.find(m=>BUSY.has(m.view.state));
        const spread=this.members.some(m=>(m.view.x-this.center.x)**2+(m.view.y-this.center.y)**2+(m.view.z-this.center.z)**2>12*12);
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
        for(const member of this.members){
            const view=member.view;
            if(!AMBIENT.has(view.state)||view.claimed)continue;
            const anchor=busy||spread?this.center:this.destination;
            member.target.copy(anchor).add(member.offset);
            member.target.x+=Math.sin(this.clock*.18+member.handle.slot)*.6;
            member.target.z+=Math.cos(this.clock*.15+member.handle.slot)*.6;
            if(!this.clearAt(member.target.x,member.target.z))member.target.set(view.x,view.y,view.z);
            this.people.proposeWalk(member.handle,member.target.x,member.target.y,member.target.z);
        }
    }
    renderMember(member,pose) {
        const g=member.avatar;if(!g)return;
        g.visible=pose.visible;g.position.set(pose.x,pose.y,pose.z);
        g.rotation.set(0,pose.heading,0);g.scale.setScalar(pose.scale);
        g.userData.pose(pose.bob,pose.speed,pose.sitting,pose.pole,pose.stride,pose.arm);
    }
    memberRemoved(handle) {
        const index=this.members.findIndex(m=>m.handle===handle);
        if(index>=0)this.members.splice(index,1);
        this.ready.delete(handle);
    }
    forEachMember(visit) {
        if(this._disposed)return;
        for(const member of this.members)if(this.people.read(member.handle,member.view))visit(member.handle,member.view);
    }
    clear() {
        const members=[...this.members],errors=[];
        for(const member of members)try{this.people.remove(member.handle);}catch(error){errors.push(error);}
        // A spawn may fail before its binding is installed, so those tentative
        // rigs still belong to the group and need the same rollback path.
        for(const member of this.members)if(member.avatar){try{disposeSceneResources(member.avatar);}catch(error){errors.push(error);}member.avatar.removeFromParent();}
        this.people.cancelReservation(this.reservation);
        this.members.length=0;this.vehicle=null;this.reservation=null;this.boarding=false;this.ready.clear();
        if(errors.length)throw new AggregateError(errors,'Monk collective cleanup failed.');
    }
    dispose(){
        if(this._disposed)return;this._disposed=true;this.people.close();
        try{this.clear();}finally{this.people.dispose();}
    }
    status(){this.refreshMembers();return {count:this.members.length,state:this.boarding?'boarding':this.vehicle?'riding':'roaming',
        vehicle:this.vehicle===this.wagon&&this.vehicle?'nut_wagon':this.vehicle?'zerble':null,
        waiting:this.members.some(m=>BUSY.has(m.view.state)),destination:this.destination.toArray()};}
}
