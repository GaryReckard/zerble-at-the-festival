import * as THREE from 'three';
import {Crowd} from '../../crowd.js';
import {registry} from '../../registry.js';
import {mulberry32} from '../../rng.js';
import {terrainHeight} from '../../worldgen/terrain.js';
import {PeopleRuntime} from '../runtime.js';
import {HulaActivity} from '../hulaActivity.js';
import {sampleHoopHand} from './score.js';

const DEFAULTS=Object.freeze({seed:1977,profile:'lyrical',hoops:1,scale:1,heading:0,mode:'solo',duration:22});
const PROFILES=new Set(['lyrical','playful','aerial']);
const MARKER_COLORS=[0x42e4ef,0x42e4ef,0xffdf65,0xffdf65];

function optionsFor(previous,input){
  const options={...previous,...input};
  if(!Number.isSafeInteger(options.seed)||options.seed<0||options.seed>0xffffffff)throw new RangeError('Workshop seed must be an unsigned 32-bit integer.');
  if(!PROFILES.has(options.profile))throw new TypeError('Unknown hoop performer profile.');
  if(options.hoops!==1&&options.hoops!==2)throw new RangeError('Workshop supports one or two hoops.');
  if(!Number.isFinite(options.scale)||options.scale<.5||options.scale>2)throw new RangeError('Workshop scale must be between 0.5 and 2.');
  if(!Number.isFinite(options.heading))throw new TypeError('Workshop heading must be finite.');
  if(!['baseline','solo','partner'].includes(options.mode))throw new TypeError('Workshop mode must be baseline, solo or partner.');
  if(!Number.isFinite(options.duration)||options.duration<4||options.duration>60)throw new RangeError('Workshop duration must be between 4 and 60 seconds.');
  return options;
}

// The inspector owns a bounded preview world but advances the real adult and
// roaming barriers. Seeking changes its isolated score, never live-world time.
export class HoopWorkshop {
  constructor(options={}){
    this.group=new THREE.Group();this.group.name='HoopWorkshop';
    this.group.userData.cleanup=()=>this.dispose();
    this.options=optionsFor(DEFAULTS,options);this.paused=false;this.disposed=false;this.nightness=0;this.frames=0;
    this.runtime=null;this.people=null;this.activity=null;this.world=null;this.entry=null;this.placeId=null;this.persons=[];this.session=null;
    this.markersVisible=true;this.contactError=0;this.contactCount=0;this._view={};this._status={};this._pairStatus={};
    this._presentation=new THREE.Matrix4();this._q=new THREE.Quaternion();this._inverseQ=new THREE.Quaternion();
    this._localHand=new THREE.Vector3();this._worldHand=new THREE.Vector3();this._rim=new THREE.Vector3();this._delta=new THREE.Vector3();
    this.markerRoot=new THREE.Group();this.markerRoot.name='HoopContactMarkers';this.group.add(this.markerRoot);
    this.markerGeometry=new THREE.SphereGeometry(.04,8,6);
    this.markerMaterials=MARKER_COLORS.map(color=>new THREE.MeshBasicMaterial({color,depthTest:false}));
    this.markers=this.markerMaterials.map((material,i)=>{const marker=new THREE.Mesh(this.markerGeometry,material);marker.name=i<2?'Actual rendered hand':'Nearest point on hoop';marker.renderOrder=20;marker.visible=false;this.markerRoot.add(marker);return marker;});
    this.envelopeGeometry=new THREE.RingGeometry(.99,1,64);
    this.envelopeMaterial=new THREE.MeshBasicMaterial({color:0x977abe,side:THREE.DoubleSide,depthWrite:false});
    this.envelope=new THREE.Mesh(this.envelopeGeometry,this.envelopeMaterial);this.envelope.rotation.x=-Math.PI/2;this.envelope.position.y=.018;this.markerRoot.add(this.envelope);
    try{this.restart();}catch(error){try{this.dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Hoop workshop setup and cleanup failed.');}throw error;}
  }

  restart(input={}){
    if(this.disposed)return false;
    const options=optionsFor(this.options,input);
    this._releaseWorld();this.options=options;this.frames=0;this.contactError=0;this.paused=false;
    const rng=mulberry32(options.seed),spawnRng=()=>Math.min(.5,rng());
    try{
      this.world=new THREE.Group();this.world.name='HoopWorkshopProductionWorld';this.group.add(this.world);
      this.runtime=new PeopleRuntime();
      this.people=new Crowd({spawn(){},spawnLost(){}},{runtime:this.runtime});this.world.add(this.people.group);
      this.activity=new HulaActivity({people:this.people,runtime:this.runtime,rootSeed:options.seed,autoRecruit:false,flow:true});this.world.add(this.activity.group);
      this.cart={position:new THREE.Vector3(0,0,40),forwardWorld:new THREE.Vector3(0,0,1),speed:0,seatSlots:[],idleTime:0};
      this.frame={zerble:this.cart,bubbles:null,nightness:this.nightness,npcsFrozen:false};
      this.placeId=registry.add({kind:'stage_front',position:new THREE.Vector3(),footprint:0,attractor:{radius:12,weight:1}});
      this.entry=registry.entries.get(this.placeId);
      const classicX=options.mode==='partner'?-(4.5*options.scale+2):-3;
      const classic=this.people.spawnPerson({pos:new THREE.Vector3(classicX,terrainHeight(classicX,0),0),rng:spawnRng,allowPhotographer:false,scale:options.scale});
      if(!classic)throw new Error('Workshop could not create the classic comparison.');this.persons.push(classic);
      if(!this.activity.startPerformance({slot:0,person:classic,entry:this.entry,x:classicX,z:0,style:'classic',duration:options.duration}))throw new Error('Classic workshop admission failed.');
      const count=options.mode==='partner'?2:1;
      for(let i=0;i<count;i++){
        const pairOffset=Math.max(1.3,1.8*options.scale);
        const offset=i===0?-pairOffset:pairOffset;
        const x=options.mode==='partner'?offset*Math.cos(options.heading):2.5;
        const z=options.mode==='partner'?-offset*Math.sin(options.heading):0;
        const person=this.people.spawnPerson({pos:new THREE.Vector3(x,terrainHeight(x,z),z),rng:spawnRng,allowPhotographer:false,scale:options.scale});
        if(!person)throw new Error('Workshop could not create its flow performer.');this.persons.push(person);
        if(options.mode!=='partner'&&!this.activity.startPerformance({slot:1,person,entry:this.entry,x,z,style:options.mode==='baseline'?'classic':'flow',profile:options.profile,hoops:options.hoops,duration:options.duration,seed:options.seed}))throw new Error('Flow workshop admission failed.');
      }
      if(options.mode==='partner'){
        const pair=this.activity.startPair({slots:[6,7],persons:this.persons.slice(1),entry:this.entry});
        if(!pair)throw new Error('Partner workshop admission failed.');
        this.session=typeof pair==='object'?pair:this.activity.pairSession;
        if(!this.session)throw new Error('Partner workshop requires the activity pair-session inspection boundary.');
      }else this.session=this.activity.slots[1].session;
      for(const slot of this.activity.slots){
        const session=slot.session;
        if(session.person&&session.claim&&this.people.readPerson(session.person,this._view))this.people.writeActivityPose(session.claim,this._view.x,this._view.y,this._view.z,options.heading);
      }
      this.step(0);
      return true;
    }catch(error){try{this._releaseWorld();}catch(cleanup){throw new AggregateError([error,cleanup],'Hoop workshop restart and cleanup failed.');}throw error;}
  }

  update(dt,nightness=this.nightness){
    if(this.disposed)return;
    this.nightness=Math.max(0,Math.min(1,nightness));
    if(!this.paused)this.step(dt,this.nightness);
    else if(this.activity){this.activity.material.emissiveIntensity=.05+2.5*this.nightness;this._updateMarkers();}
  }

  step(dt=1/60,nightness=this.nightness){
    if(this.disposed||!this.runtime)return false;
    if(!Number.isFinite(dt)||dt<0||dt>.05)throw new RangeError('Workshop steps require an accepted delta between 0 and 0.05.');
    this.nightness=Math.max(0,Math.min(1,nightness));this.frame.nightness=this.nightness;
    registry.rebuildSpatialIndex();this.runtime.beginFrame(dt);
    this.runtime.run('adults',this.frame);this.runtime.run('roaming',this.frame);
    this.frames++;this._updateMarkers();return true;
  }

  togglePause(){if(this.disposed)return false;this.paused=!this.paused;return this.paused;}

  seek(time){
    if(this.options.mode==='baseline')return false;
    if(this.options.mode==='partner')throw new Error('Partner replay restarts the isolated encounter; seeking an active paired claim is not supported.');
    if(this.disposed||!this.session?.seekFlow)return false;
    if(!Number.isFinite(time)||time<0||time>this.options.duration)throw new RangeError('Seek time must be inside this performance.');
    this.paused=true;
    const sought=this.session.seekFlow(time);
    if(sought){this.activity.update(0,this.frame);this._updateMarkers();}
    return sought;
  }

  interrupt(){
    if(this.disposed||!this.people)return false;
    const person=this.persons[1];if(!this.people.readPerson(person,this._view))return false;
    const honker={position:new THREE.Vector3(this._view.x,this._view.y,this._view.z-2),forwardWorld:new THREE.Vector3(0,0,1),speed:0};
    this.people.applyHonk(honker);this._updateMarkers();return true;
  }

  removePlace(){
    if(this.placeId===null)return false;
    registry.remove(this.placeId);this.placeId=null;
    if(!this.disposed&&this.activity)this.activity.update(0,this.frame);
    this._updateMarkers();return true;
  }

  removePerson(){
    if(this.disposed||!this.people||!this.persons[1])return false;
    const removed=this.people.removePerson(this.persons[1]);this._updateMarkers();return removed;
  }

  toggleMarkers(){this.markersVisible=!this.markersVisible;this.markerRoot.visible=this.markersVisible;return this.markersVisible;}

  _updateMarkers(){
    for(const marker of this.markers)marker.visible=false;
    this.envelope.visible=false;this.contactError=0;this.contactCount=0;
    const session=this.session,sample=session?.style==='flow'?session.flowSample:session?.classicSample;
    if(!this.disposed&&this.options.mode==='partner'){this._updatePairMarkers();return;}
    if(this.disposed||!sample||session.phase!=='hooping'||!session.claim||!this.people.readActivityPresentation(session.claim,this._presentation))return;
    const score=session.score??session.flowScore;
    if(score?.envelope&&this.people.readPerson(session.person,this._view)){
      const radius=score.envelope.radius*this._view.scale;
      this.envelope.position.set(this._view.x,this._view.y+.018,this._view.z);this.envelope.scale.setScalar(radius);this.envelope.visible=true;
    }
    for(let side=0;side<2;side++){
      const handName=side===0?'right':'left';
      sampleHoopHand(sample.arms,handName,this._localHand);
      this._worldHand.copy(this._localHand).applyMatrix4(this._presentation);
      this.markers[side].position.copy(this._worldHand);
      for(let i=0;i<sample.hoopCount;i++){
        const hoop=sample.hoops[i];
        if(hoop.contact!==handName&&hoop.contact!=='both')continue;
        this._q.set(hoop.qx,hoop.qy,hoop.qz,hoop.qw);
        this._inverseQ.copy(this._q).invert();
        this._delta.set(this._localHand.x-hoop.x,this._localHand.y-hoop.y,this._localHand.z-hoop.z).applyQuaternion(this._inverseQ);
        const angle=Math.atan2(this._delta.y,this._delta.x),radius=hoop.radius??.58;
        this._rim.set(Math.cos(angle)*radius,Math.sin(angle)*radius,0).applyQuaternion(this._q);
        this._rim.x+=hoop.x;this._rim.y+=hoop.y;this._rim.z+=hoop.z;this._rim.applyMatrix4(this._presentation);
        const error=this._rim.distanceTo(this._worldHand);this.contactError=Math.max(this.contactError,error);this.contactCount++;
        this.markers[side+2].position.copy(this._rim);this.markers[side+2].visible=true;this.markers[side].visible=true;
        this.markerMaterials[side+2].color.setHex(error>.02?0xff4c69:0xffdf65);
        break;
      }
    }
  }

  _updatePairMarkers(){
    const pair=this.session;
    if(!pair||pair.phase!=='playing'||!pair.hoop.visible)return;
    const hoop=pair.hoop;
    for(let side=0;side<2;side++){
      const handName=side===0?'right':'left';
      if(hoop.contact!==handName||!this.people.readActivityPresentation(pair.claims[side],this._presentation))continue;
      sampleHoopHand(pair.samples[side].arms,handName,this._localHand);
      this._worldHand.copy(this._localHand).applyMatrix4(this._presentation);
      this._q.set(hoop.qx,hoop.qy,hoop.qz,hoop.qw);this._inverseQ.copy(this._q).invert();
      this._delta.set(this._worldHand.x-hoop.x,this._worldHand.y-hoop.y,this._worldHand.z-hoop.z).applyQuaternion(this._inverseQ);
      const angle=Math.atan2(this._delta.y,this._delta.x),radius=hoop.radius??.58;
      this._rim.set(Math.cos(angle)*radius,Math.sin(angle)*radius,0).applyQuaternion(this._q);
      this._rim.x+=hoop.x;this._rim.y+=hoop.y;this._rim.z+=hoop.z;
      const error=this._rim.distanceTo(this._worldHand);this.contactError=Math.max(this.contactError,error);this.contactCount++;
      this.markers[side].position.copy(this._worldHand);this.markers[side+2].position.copy(this._rim);
      this.markers[side].visible=this.markers[side+2].visible=true;
      this.markerMaterials[side+2].color.setHex(error>.02?0xff4c69:0xffdf65);
    }
  }

  inspect(out={}){
    const session=this.session,sample=session?.style==='flow'?session.flowSample:session?.classicSample;
    out.seed=this.options.seed;out.profile=this.options.profile;out.mode=this.options.mode;out.scale=this.options.scale;out.heading=this.options.heading;
    out.time=sample?.time??session?.elapsed??0;out.duration=this.options.duration;out.segment=sample?.segment??(this.options.mode==='partner'?'partner-exchange':null);out.motif=sample?.motif??(this.options.mode==='partner'?'exchange-and-answer':null);
    out.style=session?.style??(this.options.mode==='partner'?'flow':'classic');out.phase=this.disposed?'disposed':session?.phase??'idle';out.version=sample?.version??session?.version??0;
    out.hoops=(session?.style==='classic'?undefined:sample?.hoopCount)??(session?.hoop?.visible||session?.style==='classic'&&session.phase==='hooping'?1:0);out.contactError=this.contactError;out.contactCount=this.contactCount;out.active=!!session&&session.phase!=='idle'&&!this.disposed;
    out.hoopSupport=sample?.hoopCount?sample.hoops[0].contact:(session?.style==='classic'&&session.phase==='hooping'?'waist':null);
    out.kind=sample?.kind??(this.options.mode==='partner'?'partner-exchange':null);
    out.rootY=sample?.rootY??0;out.inertialContacts=sample?.inertialContacts??false;
    out.stance=sample?.feet?(sample.feet.left.planted?(sample.feet.right.planted?'both feet':'left foot'):(sample.feet.right.planted?'right foot':'swing')):null;
    out.leftPlant=sample?.feet?.left.plantId??null;out.rightPlant=sample?.feet?.right.plantId??null;
    out.groundValid=session?.flowGroundValid??true;
    const tossParameters=session?.score?.profile==='aerial'&&session.score.hoops===1?session.score.parameters:null;
    out.tossRise=tossParameters?.tossRise??null;out.tossDuration=tossParameters?.tossDuration??null;
    out.disposed=this.disposed;out.paused=this.paused;out.frames=this.frames;out.markers=this.markersVisible;
    out.population=this.people?.populationSize??0;out.placeLive=this.placeId!==null&&registry.entries.has(this.placeId);
    out.score=session?.score??session?.flowScore??null;out.draws=0;out.triangles=0;
    if(this.world)this.world.traverse(object=>{
      if(!object.isMesh||!object.visible||!object.geometry)return;
      for(let parent=object.parent;parent&&parent!==this.world;parent=parent.parent)if(!parent.visible)return;
      const count=object.isInstancedMesh?object.count:1;if(!count)return;
      out.draws++;out.triangles+=((object.geometry.index?.count??object.geometry.attributes.position?.count??0)/3)*count;
    });
    return out;
  }

  exportReplay(){
    return {workshop:{...this.options},performance:this.session?.exportReplay?.()??null};
  }

  _releaseWorld(){
    const errors=[],release=fn=>{try{fn();}catch(error){errors.push(error);}};
    const activity=this.activity,people=this.people,runtime=this.runtime,world=this.world,placeId=this.placeId;
    this.activity=null;this.people=null;this.runtime=null;this.world=null;this.placeId=null;this.entry=null;this.session=null;this.persons.length=0;
    if(activity)release(()=>activity.dispose());
    if(people)release(()=>people.dispose());
    if(runtime)release(()=>runtime.dispose());
    if(placeId!==null)release(()=>registry.remove(placeId));
    if(world){world.removeFromParent();world.clear();}
    for(const marker of this.markers)marker.visible=false;this.envelope.visible=false;
    if(errors.length)throw new AggregateError(errors,'Hoop workshop world cleanup failed.');
  }

  dispose(){
    if(this.disposed)return;
    this.disposed=true;this.paused=true;
    const errors=[],release=fn=>{try{fn();}catch(error){errors.push(error);}};
    release(()=>this._releaseWorld());
    release(()=>this.markerGeometry.dispose());for(const material of this.markerMaterials)release(()=>material.dispose());
    release(()=>this.envelopeGeometry.dispose());release(()=>this.envelopeMaterial.dispose());
    this.markerRoot.clear();this.group.clear();this.group.removeFromParent();
    if(errors.length)throw new AggregateError(errors,'Hoop workshop cleanup failed.');
  }
}
