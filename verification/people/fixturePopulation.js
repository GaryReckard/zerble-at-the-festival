// Intentionally separate Map storage for the extension contract. This is a
// verification population, not another implementation of adult/child behavior.
import {PersonHandles} from '../../src/people/personHandle.js';
import {ActivityClaims} from '../../src/people/activityClaims.js';
export class FixturePopulation {
  constructor(runtime,{key='extension-fixture'}={}) {
    this.runtime=runtime;this.records=new Map();this.nextSlot=0;this.disposed=false;
    this.ownerToken=runtime.register({key,controller:this});
    this.handles=new PersonHandles({runtime,ownerToken:this.ownerToken,read:(record,out)=>{
      Object.assign(out,record.pose);out.state='walking';out.claimed=this.claims.current.has(record.person);out.hidden=!!record.binding;
    }});
    this.claims=new ActivityClaims({people:this.handles,resume:person=>{const record=this.handles.resolve(person);if(record)record.resumes++;}});
  }
  add({x=0,y=0,z=0,node=null,cleanup=()=>{}}={}) {
    const slot=this.nextSlot++,record={pose:{x,y,z,heading:0},node,cleanup,resumes:0,binding:null};
    const person=this.handles.create(slot,record);record.person=person;this.records.set(slot,record);return person;
  }
  readPerson(person,out){return this.handles.read(person,out);}
  claimActivity(person,options) {
    return this.claims.acquire(person,{...options,release:(claim,reason)=>{
      try {options.release?.(claim,reason);} finally {
        const record=this.records.get(claim.person.slot);
        if(record?.binding===claim){record.binding=null;if(record.node)record.node.visible=true;}
      }
    }});
  }
  writeActivityPose(claim,x,y,z,heading=0) {
    if(!this.claims.canWrite(claim))return false;
    const record=this.handles.resolve(claim.person);Object.assign(record.pose,{x,y,z,heading});
    record.node?.position.set(x,y,z);return true;
  }
  setActivityBinding(claim,hidden) {
    if(!this.claims.canWrite(claim))return false;
    const record=this.handles.resolve(claim.person);record.binding=hidden?claim:null;
    if(record.node)record.node.visible=!hidden;return true;
  }
  endPersonActivity(claim,{reason='ended'}={}){return this.claims.release(claim,reason);}
  removePerson(person) {
    if(!this.handles.isLive(person))return false;
    const record=this.handles.resolve(person);
    this.handles.remove(person,()=>{try{this.claims.removePerson(person);}finally{record.cleanup();this.records.delete(person.slot);}});return true;
  }
  inspect(out){out.population=this.records.size;}
  dispose() {
    if(this.disposed)return;this.disposed=true;
    const errors=[],run=fn=>{try{fn();}catch(error){errors.push(error);}};
    if(this.runtime.isRegistered(this.ownerToken))run(()=>this.runtime.unregister(this.ownerToken));
    run(()=>this.claims.dispose());
    run(()=>this.handles.dispose(record=>{try{record.cleanup();}finally{this.records.delete(record.person.slot);}}));
    if(errors.length)throw new AggregateError(errors,'Fixture population cleanup failed.');
  }
}
