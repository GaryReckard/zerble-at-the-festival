import * as smilePolicy from '../../src/people/smilePolicy.js';
import * as photographer from '../../src/photographer.js';
import {SeatReservations} from '../../src/people/seatReservations.js';
import {loadGroupParticipation} from './groupParticipation.mjs';
// Production Crowd protocol methods over recording render/resource boundaries.
// Full constructors/GPU transforms are exercised in verification/people/contracts.html.
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {PeopleRuntime} from '../../src/people/runtime.js';
import {PersonHandles} from '../../src/people/personHandle.js';
import {ActivityClaims} from '../../src/people/activityClaims.js';
const source=readFileSync(new URL('../../src/crowd.js',import.meta.url),'utf8');
const motionConstants=source.match(/^const (?:(?:POTTY|CAMP|CAMP_MUSIC|MARKET|PICNIC|HAMMOCK)_STATES|HAMMOCK_OPTIONAL_FIELDS|REST_MOTION_FIELDS)=.*$/gm).join('\n');
const Crowd=runInNewContext([source.match(/^const FROWN_DURATION.*$/m)[0],source.match(/^const ORDINARY_SOCIAL_STATES.*$/m)[0],motionConstants,source.slice(source.indexOf('export class Crowd')).replace('export class Crowd','class Crowd'),';Crowd'].join('\n'),{DESPAWN_R2:100000,...photographer,...smilePolicy,...loadGroupParticipation()});
export class Vector {
 constructor(x=0,y=0,z=0){this.set(x,y,z);}
 set(x,y,z){Object.assign(this,{x,y,z});return this;}
 copy(p){return this.set(p.x,p.y,p.z);}
 clone(){return new Vector(this.x,this.y,this.z);}
}
export function makePeopleCrowd({capacity=60}={}) {
 const crowd=Object.create(Crowd.prototype);
 Object.assign(crowd,{npcs:[],free:[],groups:new Map(),parties:new Set(),_zeroMat:{},_hairDrawCounts:[0],_hairFree:[[]],_drinkFree:[],_photoFree:[],_photographerCount:0,_disposed:false});
 const runtime=new PeopleRuntime();
 const ownerToken=runtime.register({key:'crowd',controller:{inspect(){},dispose(){}}});
 crowd.peopleHandles=new PersonHandles({runtime,ownerToken,read:(npc,out)=>crowd._readPerson(npc,out)});
 crowd.peopleView=crowd.peopleHandles.view;
 crowd.seatReservations=new SeatReservations(crowd.peopleHandles);
 crowd.activityClaims=new ActivityClaims({people:crowd.peopleHandles,eligible:h=>crowd._canAcquireActivity(h),resume:(h,reason,claim)=>crowd._resumeActivityPerson(h,reason,claim),finalize:claim=>crowd._finalizeActivityRelease(claim)});
 crowd.campJams={release(){},exit(){return null;},has(){return false;},dispose(){}};
 for(const name of ['shoppingBag','legs','shoes','body','arms','head','eyes','mouth','drink','camera','flash'])crowd[name+'Mesh']={setMatrixAt(){},instanceMatrix:{}};
 crowd.hairMeshes=[{setMatrixAt(){},instanceMatrix:{}}];
 crowd._writeMatrices=()=>{};
 let next=0;
 crowd.spawn=function({pos,appearanceOverride}){
  if(this._disposed||this.npcs.length>=capacity)return null;
  const idx=this.free.length?this.free.pop():next++;
  const npc={idx,pos:pos.clone(),target:pos.clone(),vel:new Vector(),yaw:0,bob:0,state:'idle',stateTimer:0,appearance:{shirt:3,skin:4,hairStyle:0,...appearanceOverride},hairSlot:idx,drinkSlot:-1,photoSlot:-1};
  npc.personHandle=this.peopleHandles.create(idx,npc);this.npcs.push(npc);return npc;
 };
 return crowd;
}
