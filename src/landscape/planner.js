import {validLandscapeRenderBuffers} from './renderBuffers.js';
import { CONFIG } from '../worldgen/constants.js';
import { FESTIVAL_TUNING } from '../worldgen/tuning.js';
import { getSessionSeed } from '../rng.js';
import { landscapeVersion } from '../worldgen/landscapeCandidates.js';
import { terrainGenerationKey } from '../worldgen/terrain.js';
import { landscapeTerrainSurface } from '../worldgen/landscapeContext.js';
import { adoptLandscapeAdmission } from '../worldgen/landscape.js';

// Cold surrounding-world planning measured hundreds of milliseconds. It stays
// off the render thread, with bounded residency and explicit worker ownership.
export class LandscapePlanner {
  constructor({workerFactory=()=>new Worker(new URL('./landscape.worker.js',import.meta.url),{type:'module'}),onChange=()=>{},cacheLimit=64,maxPending=8,timeoutMs=15000,maxJobs=64,renderGeometry=false}={}) {
    if([cacheLimit,maxPending,timeoutMs,maxJobs].some(n=>!Number.isSafeInteger(n)||n<1)||cacheLimit>256||maxPending>32||timeoutMs>60000||maxJobs>256)throw new RangeError('Invalid landscape planner limits');
    if(typeof renderGeometry!=='boolean')throw new TypeError('Invalid landscape render mode');
    Object.assign(this,{workerFactory,onChange,cacheLimit,maxPending,timeoutMs,maxJobs,renderGeometry});
    this.cache=new Map();this.pending=new Set();this.queue=[];this.worker=null;this.active=null;this.timer=null;this.jobs=0;this.serial=0;
    this.key=terrainGenerationKey();this.disposed=false;this.error=null;
  }
  _terminate(){clearTimeout(this.timer);this.timer=null;const worker=this.worker;this.worker=null;worker?.terminate();this.jobs=0;}
  _sync(){
    const key=terrainGenerationKey();
    if(key!==this.key){this._terminate();this.active=null;this.queue.length=0;this.pending.clear();this.cache.clear();this.error=null;this.key=key;}
  }
  synchronize(){if(!this.disposed)this._sync();}
  read(candidate){if(this.disposed)return null;this._sync();return this.cache.get(candidate.id)||null;}
  request(candidate){
    if(this.disposed)return {status:'unavailable',reason:'disposed'};
    this._sync();
    if(candidate.version!==landscapeVersion()||candidate.worldSeed!==getSessionSeed())return {status:'unavailable',reason:'world-changed'};
    if(this.cache.has(candidate.id))return this.cache.get(candidate.id);
    if(this.error)return {status:'unavailable',reason:this.error};
    if(this.pending.has(candidate.id))return {status:'pending'};
    if(this.pending.size>=this.maxPending)return {status:'pending',reason:'queue-capacity'};
    this.pending.add(candidate.id);this.queue.push({candidate,id:++this.serial,key:this.key});this._pump();return this.error?{status:'unavailable',reason:this.error}:{status:'pending'};
  }
  _fail(reason){
    this._terminate();this.active=null;this.queue.length=0;this.pending.clear();this.error=reason;this.onChange();
  }
  _pump(){
    if(this.disposed||this.error||this.active||!this.queue.length)return;
    this._sync();if(!this.queue.length)return;
    if(!this.worker){
      try {
        const worker=this.workerFactory();this.worker=worker;
        worker.onmessage=({data})=>{if(this.worker===worker)this._receive(data);};
        worker.onerror=()=>{if(this.worker===worker)this._fail('worker-error');};
        worker.onmessageerror=()=>{if(this.worker===worker)this._fail('worker-message-error');};
      } catch {this._fail('worker-unavailable');return;}
    }
    const item=this.active=this.queue.shift(),c=item.candidate;
    item.fingerprint=JSON.stringify(c);
    this.timer=setTimeout(()=>this._fail('worker-timeout'),this.timeoutMs);
    try {this.worker.postMessage({id:item.id,key:item.key,version:2,seed:getSessionSeed(),candidateId:c.id,cx:c.cx,cz:c.cz,fingerprint:item.fingerprint,config:CONFIG,tuning:FESTIVAL_TUNING,renderGeometry:this.renderGeometry});}
    catch {this._fail('worker-message-error');}
  }
  _receive(data){
    const item=this.active;
    if(!item||data.id!==item.id||data.key!==item.key)return;
    if(terrainGenerationKey()!==item.key){this._sync();this.onChange();return;}
    if(data.type==='error'){this._fail(data.message||'worker-error');return;}
    if(data.type!=='result'||typeof data.valid!=='boolean'){this._fail('worker-proof-error');return;}
    if(data.candidateId!==item.candidate.id||data.fingerprint!==item.fingerprint){this._fail('worker-identity-mismatch');return;}
    clearTimeout(this.timer);this.timer=null;
    let result;
    try {
      const surface=landscapeTerrainSurface();
      if(this.renderGeometry&&(data.render?.ownerId!==item.candidate.id||!validLandscapeRenderBuffers(data.render)))throw new TypeError('Invalid landscape render data');
      result=adoptLandscapeAdmission(data,{candidate:item.candidate,surface,key:item.key,getKey:terrainGenerationKey});
      result={...result,status:result.valid?'ready':'rejected',surface,render:data.render||null,workerMs:data.workerMs,contextMs:data.contextMs};
    } catch {this._fail('worker-proof-error');return;}
    if(this.cache.size>=this.cacheLimit)this.cache.delete(this.cache.keys().next().value);
    this.cache.set(item.candidate.id,result);this.pending.delete(item.candidate.id);this.active=null;
    if(++this.jobs>=this.maxJobs)this._terminate();
    this._pump();this.onChange();
  }
  stats(){let ready=0,rejected=0;for(const r of this.cache.values()){if(r.status==='ready')ready++;else rejected++;}return {disposed:this.disposed,cached:this.cache.size,ready,rejected,pending:this.pending.size,queued:this.queue.length,active:this.active?.candidate.id||null,error:this.error,worker:!!this.worker};}
  dispose(){if(this.disposed)return;this.disposed=true;this._terminate();this.active=null;this.queue.length=0;this.pending.clear();this.cache.clear();}
}
