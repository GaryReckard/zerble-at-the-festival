// One directory per registered population. Raw records stay private to that
// population; only its read-only view is published to other controllers.
// Valid reads replace every common field, even when caller scratch was last
// used for a different population. Missing coordinates stay visibly invalid.
const VIEW_DEFAULTS=Object.freeze({x:NaN,y:NaN,z:NaN,heading:0,bob:0,state:null,
  shirt:null,skin:null,scale:1,grouped:false,photographer:false,claimed:false,hidden:false,vx:0,vz:0,seated:false});

export class PersonHandles {
  constructor({runtime,ownerToken,read}) {
    if(!runtime?.isRegistered(ownerToken)||typeof read!=='function')throw new TypeError('Person directory requires a live registered owner and reader.');
    this.runtime=runtime;this.ownerToken=ownerToken;this.reader=read;
    this.entries=new Map();this.generations=new Map();this.byRecord=new WeakMap();this.closing=false;
    this.view=Object.freeze({isLive:handle=>this.isLive(handle),read:(handle,out)=>this.read(handle,out)});
  }

  create(slot,record) {
    if(this.closing||!this.runtime.isRegistered(this.ownerToken))throw new Error('Person owner is unavailable.');
    if(!Number.isSafeInteger(slot)||slot<0||!record||typeof record!=='object'||this.entries.has(slot)||this.byRecord.has(record))throw new TypeError('Person slot and record must start a new lifetime.');
    const generation=(this.generations.get(slot)??0)+1;
    const handle=Object.freeze({ownerToken:this.ownerToken,slot,generation});
    this.generations.set(slot,generation);this.entries.set(slot,{handle,record,removing:false});this.byRecord.set(record,handle);
    return handle;
  }

  handleFor(record) {return this.byRecord.get(record)??null;}

  // Resource cleanup may validate its retiring lifetime after dispatch stopped.
  // This is not permission to issue movement/binding writes or acquire resources.
  owns(handle) {
    if(!handle||handle.ownerToken!==this.ownerToken)return false;
    return this.entries.get(handle.slot)?.handle===handle;
  }

  isLive(handle) {return !this.closing&&this.runtime.isRegistered(this.ownerToken)&&this.owns(handle)&&!this.entries.get(handle.slot).removing;}

  // Population-internal resolver. Do not put it on a common person view.
  resolve(handle) {return this.isLive(handle)?this.entries.get(handle.slot).record:null;}

  read(handle,out) {
    if(!out||typeof out!=='object')throw new TypeError('Person reads require caller scratch.');
    const record=this.resolve(handle);
    if(!record)return false;
    this.readOwnedRecord(record,out);return true;
  }

  // Population-internal fast path over its own live storage, not a public
  // resolver. Queries use it to avoid duplicate lifetime lookups per candidate.
  readOwnedRecord(record,out) {Object.assign(out,VIEW_DEFAULTS);this.reader(record,out);}

  remove(handle,release=()=>{}) {
    if(!this.owns(handle))return false;
    const entry=this.entries.get(handle.slot);
    if(entry.removing)return false;
    entry.removing=true;
    try {release(entry.record,handle);}
    finally {this.entries.delete(handle.slot);this.byRecord.delete(entry.record);}
    return true;
  }

  dispose(release=()=>{}) {
    if(this.closing)return;
    this.closing=true;
    const entries=[...this.entries.values()],errors=[];
    // No peer can be read or reacquired from the first teardown callback onward.
    for(const entry of entries)entry.removing=true;
    for(const entry of entries) {
      try {release(entry.record,entry.handle);}catch(error){errors.push(error);}
      finally {this.entries.delete(entry.handle.slot);this.byRecord.delete(entry.record);}
    }
    if(errors.length)throw new AggregateError(errors,'Person cleanup failed.');
  }
}
