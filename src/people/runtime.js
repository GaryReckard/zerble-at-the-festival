// A directory and ordered dispatcher at main's existing dependency barriers.
// It owns neither simulation storage nor a RAF/timer/visibility scheduler.
export const PEOPLE_SLOTS = Object.freeze([
  'vehicles', 'adults', 'formations', 'children', 'roaming', 'relationship',
  'place-performers', 'late-activities', 'place-cooks', 'star-love',
]);

export class PeopleRuntime {
  constructor({slots=PEOPLE_SLOTS}={}) {
    if(!Array.isArray(slots)||!slots.length||new Set(slots).size!==slots.length||slots.some(s=>typeof s!=='string'||!s))throw new TypeError('People slots must be unique names.');
    this.slots=Object.freeze([...slots]);
    this.records=new Map();this.tokens=new WeakMap();
    this.scheduled=new Map(slots.map(slot=>[slot,Object.freeze([])]));
    this.capabilities=new Map();this.runningSlots=new Set();this.executed=new Map();
    this.disposed=false;this.frame=0;this.dt=0;this.time=0;
  }

  register({key,controller,schedule=[],capabilities={},capabilityOrder={}}) {
    if(this.disposed)throw new Error('People runtime is disposed.');
    if(typeof key!=='string'||!key||this.records.has(key))throw new TypeError('People controller key must be unique.');
    if(!controller||typeof controller.inspect!=='function'||typeof controller.dispose!=='function')throw new TypeError('People controller requires inspect and dispose.');
    if(!Array.isArray(schedule)||schedule.some(s=>!s||!this.scheduled.has(s.slot)||typeof s.run!=='function')||new Set(schedule.map(s=>s.slot)).size!==schedule.length)throw new TypeError('Invalid people schedule.');
    if(!capabilities||typeof capabilities!=='object'||Array.isArray(capabilities)||Object.values(capabilities).some(fn=>typeof fn!=='function'))throw new TypeError('Capabilities must be method references.');
    if(!capabilityOrder||typeof capabilityOrder!=='object'||Array.isArray(capabilityOrder)||Object.entries(capabilityOrder).some(([name,order])=>!Object.hasOwn(capabilities,name)||!Number.isFinite(order)))throw new TypeError('Invalid capability order.');
    const token=Object.freeze({});
    const record={key,controller,token,active:true,schedule:schedule.map(s=>({...s})),capabilities:{...capabilities},capabilityOrder:{...capabilityOrder}};
    this.records.set(key,record);this.tokens.set(token,record);this.compile();
    return token;
  }

  // Lists change only with registration, never during a frame/query traversal.
  compile() {
    for(const slot of this.slots)this.scheduled.set(slot,Object.freeze([...this.records.values()].flatMap(record=>record.schedule.filter(s=>s.slot===slot).map(s=>({record,run:s.run})))));
    this.capabilities.clear();
    for(const record of this.records.values())for(const [name,run] of Object.entries(record.capabilities)) {
      if(!this.capabilities.has(name))this.capabilities.set(name,[]);
      this.capabilities.get(name).push({record,run,order:record.capabilityOrder[name]??0});
    }
    for(const [key,list] of this.capabilities)this.capabilities.set(key,Object.freeze(list.sort((a,b)=>a.order-b.order)));
  }

  isRegistered(token) {return !!token&&typeof token==='object'&&!this.disposed&&!!this.tokens.get(token)?.active;}

  beginFrame(dt) {
    if(this.disposed)return false;
    if(this.runningSlots.size)throw new Error('Cannot replace an executing people frame.');
    if(!Number.isFinite(dt)||dt<0||dt>.05)throw new RangeError('People runtime requires accepted delta.');
    this.dt=dt;this.time+=dt;this.frame++;return true;
  }

  run(slot,context) {
    if(this.disposed)return 0;
    const list=this.scheduled.get(slot);
    if(!list)throw new Error('Unknown people slot: '+slot);
    if(!this.frame)throw new Error('Begin an accepted frame before dispatch.');
    if(this.executed.get(slot)===this.frame)throw new Error('People slot already executed: '+slot);
    this.executed.set(slot,this.frame);this.runningSlots.add(slot);
    let count=0;
    try {for(const {record,run} of list)if(record.active){run.call(record.controller,this.dt,context);count++;}}
    finally {this.runningSlots.delete(slot);}
    return count;
  }

  dispatch(capability,...args) {
    if(this.disposed)return 0;
    const list=this.capabilities.get(capability);
    if(!list)return 0;
    let count=0;
    for(const {record,run} of list)if(record.active){run.apply(record.controller,args);count++;}
    return count;
  }

  readPerson(handle,out) {
    const record=handle&&this.tokens.get(handle.ownerToken);
    return !!record?.active&&!this.disposed&&!!record.controller.readPerson?.(handle,out);
  }

  // Providers retain their storage/locality rules. Selection is explicit so a
  // new population does not silently change an existing vehicle's behavior.
  forEachPersonNear(x,z,radius,visit,{populations=null,filter=null,scratch={}}={}) {
    if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(radius)||radius<0||typeof visit!=='function'||(filter!==null&&typeof filter!=='function')||(populations!==null&&!(populations instanceof Set)))throw new TypeError('Invalid nearby-person query.');
    if(this.disposed)return 0;
    let stopped=false,count=0;
    const selected=(handle,view,distance)=>{
      if(stopped)return false;
      if(filter&&!filter(handle,view,distance))return;
      count++;if(visit(handle,view,distance)===false){stopped=true;return false;}
    };
    for(const {record,run} of this.capabilities.get('nearby')??[]) {
      if(stopped)break;
      if(record.active&&(!populations||populations.has(record.key)))run.call(record.controller,x,z,radius,selected,scratch);
    }
    return count;
  }

  inspect(out=[]) {
    out.length=0;
    for(const record of this.records.values())if(record.active) {
      const details={};record.controller.inspect(details);
      out.push({key:record.key,slots:record.schedule.map(s=>s.slot),capabilities:Object.keys(record.capabilities),capabilityOrder:{...record.capabilityOrder},details});
    }
    return out;
  }

  unregister(token,reason='removed') {
    const record=token&&typeof token==='object'?this.tokens.get(token):null;
    if(!record?.active)return false;
    record.active=false;this.tokens.delete(token);this.records.delete(record.key);this.compile();
    record.controller.dispose(reason);return true;
  }

  dispose(reason='runtime-disposed') {
    if(this.disposed)return;
    this.disposed=true;
    const records=[...this.records.values()];
    for(const record of records){record.active=false;this.tokens.delete(record.token);}
    this.records.clear();this.compile();
    const errors=[];
    for(const record of records)try{record.controller.dispose(reason);}catch(error){errors.push(error);}
    if(errors.length)throw new AggregateError(errors,'People controller cleanup failed.');
  }
}
