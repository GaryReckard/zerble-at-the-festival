// Disposable measurement scaffolding. This is not a proposed production API.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
register('../../../bin/node-three-shim.mjs', import.meta.url);
const { Registry } = await import('../../../src/registry.js');
const root = new URL('../../../', import.meta.url);
const snapshotPath = new URL('./parked-registry-snapshot.json', import.meta.url);
const snapshot = JSON.parse(readFileSync(snapshotPath));
const clone = value => structuredClone(value);

// Radius histograms cache static maxima without touching the resident Map at a
// frame barrier. Maximum removal walks distinct radius keys, not all entries.
class Radii {
  counts = new Map(); max = 0; keyVisits = 0;
  add(radius) { if (!(radius > 0)) return; this.counts.set(radius, (this.counts.get(radius) ?? 0) + 1); this.max = Math.max(this.max, radius); }
  remove(radius) {
    if (!(radius > 0)) return;
    const n = this.counts.get(radius); assert.ok(n);
    if (n > 1) this.counts.set(radius, n - 1);
    else { this.counts.delete(radius); if (radius === this.max) { this.max = 0; for (const r of this.counts.keys()) { this.keyVisits++; this.max = Math.max(this.max, r); } } }
  }
}
class OwnedScaffold extends Registry {
  moving = new Map(); fixed = new Map(); staticFp = new Radii(); staticCol = new Radii(); staticBig = [];
  generations = new Map(); publicationCount = 0; scanned = 0;
  add(entry) { const id = super.add(entry); this.moving.set(id, entry); this.generations.set(id, 1); return id; }
  certifyStatic(id) {
    const e = this.moving.get(id); assert.ok(e && !this._physical.has(id));
    this.moving.delete(id); const record = { entry: e, footprint: e.footprint, colliderRadius: e.collider?.radius };
    this.fixed.set(id, record);
    if (e.footprint >= 16) { this.staticBig.push(e); this.staticBig.sort((a,b) => a.id-b.id); }
    else this.staticFp.add(e.footprint);
    this.staticCol.add(e.collider?.radius);
  }
  promote(id) {
    const r = this.fixed.get(id); if (!r) return;
    if (r.footprint >= 16) this.staticBig.splice(this.staticBig.indexOf(r.entry), 1); else this.staticFp.remove(r.footprint);
    this.staticCol.remove(r.colliderRadius); this.fixed.delete(id); this.moving.set(id, r.entry);
    // Kernel reconstructs big footprints in insertion-ID order, independent of
    // promotion order, so the facade must expose that same order.
    this.moving = new Map([...this.moving].sort(([a],[b]) => a-b));
  }
  token(id) { assert.ok(this.entries.has(id)); return { id, generation: this.generations.get(id) }; }
  publish(token, patch) {
    if (!token || !this.entries.has(token.id) || token.generation !== this.generations.get(token.id)) return false;
    this.promote(token.id); Object.assign(this.entries.get(token.id), patch); this.publicationCount++; return true;
  }
  remove(id) { if (!this.entries.has(id)) return; this.promote(id); super.remove(id); this.moving.delete(id); this.generations.delete(id); }
  enrollPhysical(id, key) { if (this.entries.has(id)) this.promote(id); return super.enrollPhysical(id, key); }
  rebuildSpatialIndex() {
    const receiver = Object.create(this);
    receiver.entries = this.moving; receiver._bigFp = [];
    this.scanned += this.moving.size;
    Registry.prototype.rebuildSpatialIndex.call(receiver);
    this._bigFp = [...this.staticBig, ...receiver._bigFp].sort((a,b) => a.id-b.id);
    this._maxFp = Math.max(this.staticFp.max, receiver._maxFp);
    this._maxCol = Math.max(this.staticCol.max, receiver._maxCol);
  }
}
function pair(entries = []) {
  const baseline = new Registry(), candidate = new OwnedScaffold(), ids = new Map();
  for (const data of entries) { const a=baseline.add(clone(data)), b=candidate.add(clone(data)); ids.set(a,b); }
  return { baseline,candidate,ids };
}
const prop = (x=1,z=1,extra={}) => ({kind:'fixture',position:{x,y:0,z},footprint:2,collider:{radius:1,damage:1},chunkKey:'fixture',...extra});
let comparisons = 0;
function compare(p, points=[[0,0,3],[32,24,4],[-32,-24,1]]) {
  const {baseline:a,candidate:b,ids}=p;
  assert.equal(b._maxFp,a._maxFp,'exact same query pad at this publication phase'); assert.equal(b._maxCol,a._maxCol);
  assert.deepEqual(b._bigFp.map(e=>e.id),a._bigFp.map(e=>ids.get(e.id)));
  for (const method of ['footprintsNear','collidersNear','generationFootprintsNear','generationCollidersNear']) for (const [x,z,r] of points) {
    const visits = reg => { const out=[]; reg[method](x,z,r,e=>out.push({id:reg===a?ids.get(e.id):e.id,position:e.position,footprint:e.footprint,collider:e.collider})); return out; };
    assert.deepEqual(visits(b),visits(a),`${method} ordered candidates and live/canonical geometry`); comparisons++;
  }
}
function sync(p) { p.baseline.rebuildSpatialIndex();p.candidate.rebuildSpatialIndex();compare(p); }
function correctness() {
  const p=pair([prop(),prop(3,2,{footprint:15.9,collider:{radius:12}}),prop(-8,0,{footprint:16}),prop(0,0,{footprint:0,collider:null})]);
  const a=[...p.ids.keys()],b=[...p.ids.values()];for(const id of b)p.candidate.certifyStatic(id);sync(p);
  for(let tick=0;tick<600;tick++) {
    const i=tick%4,patch={position:{x:(tick%17-8)*8+.1,y:tick%3,z:(tick%13-6)*8+.2},footprint:[0,2,15.9,16,40][tick%5],collider:tick%4?{radius:tick%12+.1,damage:1}:null};
    Object.assign(p.baseline.entries.get(a[i]),clone(patch));assert.ok(p.candidate.publish(p.candidate.token(b[i]),clone(patch)));
    compare(p); // Ordinary publication changes live geometry now, membership at barrier.
    sync(p);
  }
  // Removal keeps conservative pre-barrier maxima, then shrinks exactly.
  const maxA=p.baseline.add(prop(0,0,{footprint:15.99,collider:{radius:100}})),maxB=p.candidate.add(prop(0,0,{footprint:15.99,collider:{radius:100}}));p.ids.set(maxA,maxB);p.candidate.certifyStatic(maxB);compare(p);
  p.baseline.entries.get(maxA).position.x=1000;p.candidate.entries.get(maxB).position.x=1000;
  const stale=p.candidate.token(maxB);p.baseline.remove(maxA);p.candidate.remove(maxB);compare(p);sync(p);assert.equal(p.candidate.publish(stale,{footprint:99}),false);
  // Default legacy entry is discovered without explicit publication.
  const legacyA=p.baseline.add(prop()),legacyB=p.candidate.add(prop());p.ids.set(legacyA,legacyB);
  for(const [reg,id] of [[p.baseline,legacyA],[p.candidate,legacyB]]){reg.entries.get(id).position.x=90;reg.entries.get(id).collider=null;}sync(p);
  for(let cycle=0;cycle<8;cycle++) {p.baseline.removeChunk('revisit');p.candidate.removeChunk('revisit');compare(p);sync(p);for(let j=0;j<6;j++){const data=prop(j*8,cycle*8,{chunkKey:'revisit'});const x=p.baseline.add(clone(data)),y=p.candidate.add(clone(data));p.ids.set(x,y);p.candidate.certifyStatic(y);}compare(p);sync(p);}
  const pa=p.baseline.enrollPhysical(a[0],'physical').token,pb=p.candidate.enrollPhysical(b[0],'physical').token;assert.ok(pa&&pb);
  for(let tick=0;tick<80;tick++){const v={pose:{position:{x:tick%9*8,y:2,z:-tick%7*8}},footprint:[0,2,15.9,16,40][tick%5],colliderRadius:tick%4?tick%11+.1:null};assert.deepEqual(p.candidate.publishPhysical(pb,v),p.baseline.publishPhysical(pa,v));compare(p);sync(p);}
  p.baseline.transferOwner(a[0],'adopted');p.candidate.transferOwner(b[0],'adopted');p.baseline.removeChunk('fixture');p.candidate.removeChunk('fixture');compare(p);sync(p);
  p.baseline.removeChunk('adopted');p.candidate.removeChunk('adopted');assert.equal(p.candidate.publishPhysical(pb,{pose:{position:{x:0,z:0}}}).reason,'stale-token');compare(p);sync(p);
  // Negative control: a hidden writer bypassing ownership invalidates parity.
  const bad=pair([prop()]);const [badA,badB]=[...bad.ids][0];bad.candidate.certifyStatic(badB);bad.baseline.entries.get(badA).position.x=900;bad.candidate.entries.get(badB).position.x=900;bad.baseline.rebuildSpatialIndex();bad.candidate.rebuildSpatialIndex();assert.throws(()=>compare(bad),'unknown static writer must be detectable');
  // Actual snapshot rehydration: kind-based static policy is ONLY a controlled
  // probe assumption; it is not evidence of production immutability.
  const parked=pair(snapshot);for(const [id,e] of parked.candidate.entries)if(e.kind!=='nut_wagon')parked.candidate.certifyStatic(id);
  sync(parked);compare(parked,snapshot.filter((_,i)=>i%97===0).map(e=>[e.position.x,e.position.z,3]));
  return {orderedGeometryComparisons:comparisons,parkedEntries:snapshot.length,assumedStatic:parked.candidate.fixed.size,legacyMovers:parked.candidate.moving.size,negativeUnknownWriterDetected:true};
}
function provenance() {
  const names=['src/registry.js','src/spatialGrid.js','bin/test-registry-maintenance','bin/test-registry-physical','bin/node-three-shim.mjs','verification/performance/2026-11-07-structural-options/parked-registry-snapshot.json','verification/performance/2026-11-07-structural-options/registry-probe.mjs'];
  return {utc:new Date().toISOString(),node:process.version,platform:process.platform,arch:process.arch,sha256:Object.fromEntries(names.map(n=>[n,createHash('sha256').update(readFileSync(new URL(n,root))).digest('hex')]))};
}
function benchmark() {
  const cases = [];
  const trials = 7, frames = 2500, warmup = 200;
  for (const moverCount of [3, 48, 2937]) {
    const maintenance = { baseline: [], candidate: [] }, endToEnd = { baseline: [], candidate: [] };
    const admission = { baseline: [], candidate: [] }, removal = { baseline: [], candidate: [] }, queries = { baseline: [], candidate: [] };
    let eventCounts;
    // 3 is actual nut_wagon count; 48 and 2937 are sensitivity cases, not
    // measured live populations. Replay paths and all arrays are identical.
    const dynamicIndices = moverCount === 3 ? snapshot.flatMap((e,i)=>e.kind==='nut_wagon'?[i]:[]) : snapshot.slice(0,moverCount).map((_,i)=>i);
    for (let trial=0;trial<trials;trial++) for (const name of trial%2 ? ['candidate','baseline'] : ['baseline','candidate']) {
      const start=performance.now(), reg=name==='candidate'?new OwnedScaffold():new Registry(), movers=[];
      const selected=new Set(dynamicIndices);
      for(let i=0;i<snapshot.length;i++){const id=reg.add(clone(snapshot[i]));if(selected.has(i))movers.push(reg.entries.get(id));else if(name==='candidate')reg.certifyStatic(id);}
      admission[name].push(performance.now()-start);
      const patches=movers.map(e=>({position:{...e.position}}));
      const tokens=name==='candidate'?movers.map(e=>reg.token(e.id)):[];
      const advance=()=>{for(let i=0;i<movers.length;i++){const position=patches[i].position;position.x+=.04;position.z+=.02;if(name==='candidate')reg.publish(tokens[i],patches[i]);else Object.assign(movers[i],patches[i]);}};
      const frame=()=>{advance();reg.rebuildSpatialIndex();};
      for(let i=0;i<warmup;i++)frame();
      // Isolate reconciliation, then include publication/mutation overhead.
      let t=performance.now();for(let i=0;i<frames;i++)reg.rebuildSpatialIndex();maintenance[name].push(performance.now()-t);
      t=performance.now();for(let i=0;i<frames;i++)frame();endToEnd[name].push(performance.now()-t);
      // Query timing is a separate controlled workload. No collision solver or
      // crowd AI is simulated, and the output parity gate runs outside timing.
      let checksum=0;t=performance.now();for(let i=0;i<2000;i++){const e=snapshot[i%snapshot.length];reg.footprintsNear(e.position.x,e.position.z,3,v=>{checksum+=v.footprint||0;});reg.collidersNear(e.position.x,e.position.z,3,v=>{checksum+=v.collider?.radius||0;});}queries[name].push({ms:performance.now()-t,checksum});
      if(name==='candidate')eventCounts={resident:snapshot.length,scannedPerBarrier:reg.moving.size,staticEntries:reg.fixed.size,ordinaryPublications:reg.publicationCount};
      t=performance.now();for(const id of [...reg.entries.keys()])reg.remove(id);removal[name].push(performance.now()-t);
      if(name==='candidate')eventCounts.staticRadiusKeyVisitsIncludingTeardown=reg.staticFp.keyVisits+reg.staticCol.keyVisits;
    }
    const med=xs=>[...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)];
    assert.ok(queries.baseline.every((v,i)=>v.checksum===queries.candidate[i].checksum),'timed query checksum differs');
    cases.push({moverCount,trials,frames,warmup,eventCounts,totalMs:{maintenance,endToEnd,admission,removal,queries},medianPerFrameMs:{maintenance:Object.fromEntries(Object.entries(maintenance).map(([k,v])=>[k,med(v)/frames])),endToEnd:Object.fromEntries(Object.entries(endToEnd).map(([k,v])=>[k,med(v)/frames]))}});
  }
  return {cases,limits:'Node CPU microbenchmark on rehydrated positions; no live writer coverage, browser GC/frame cost, real-route gain or device/FPS prediction. Admission includes structuredClone on both paths. Query workload is controlled and independent of production callback volumes.'};
}
const result={provenance:provenance(),correctness:correctness(),timing:process.argv.includes('--bench')?benchmark():'Not run. Timed capture requires parent confirmation that browser captures have finished.'};
if(process.argv.includes('--write'))writeFileSync(new URL('./registry-probe-results.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
