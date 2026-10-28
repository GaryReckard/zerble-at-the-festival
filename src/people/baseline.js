// Bounded opt-in measurements driven by accepted game frames, with no scheduler.
// Method probes affect CPU cost; compare only against the same instrumented setup.
export function withBaselineRandom(factory,seed,enabled=false) {
  if(!enabled)return factory();
  // Explicit comparison-only construction stream. Never retain the override
  // across an update, promise or exception, and never alter normal launches.
  const previous=Math.random;let state=seed>>>0;
  Math.random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/2**32;};
  try{return factory();}finally{Math.random=previous;}
}

export function captureRenderInventory(scene,roots={}) {
  const labels=new WeakMap(),buckets={},geometries=new Set(),materials=new Set(),textures=new Set();
  for(const [label,value] of Object.entries(roots))for(const root of Array.isArray(value)?value:[value])if(root)labels.set(root,label);
  const visit=(node,label='world',visible=true)=>{
    label=labels.get(node)??label;visible=visible&&node.visible!==false;
    if(node.isMesh){
      const b=buckets[label]??={meshes:0,instances:0,potentialDraws:0,potentialTriangles:0,shadowDraws:0,visibleMeshes:0,materialTypes:{}};
      const count=node.isInstancedMesh?node.count:1,geometry=node.geometry;
      const list=Array.isArray(node.material)?node.material:[node.material];
      const draws=count>0?(Array.isArray(node.material)?geometry?.groups?.length||1:1):0;
      b.meshes++;b.instances+=count;b.potentialDraws+=draws;
      b.potentialTriangles+=(geometry?.index?.count??geometry?.attributes?.position?.count??0)/3*count;
      if(node.castShadow)b.shadowDraws+=draws;if(visible&&count>0)b.visibleMeshes++;
      if(geometry)geometries.add(geometry);
      for(const material of list)if(material){
        materials.add(material);b.materialTypes[material.type]=(b.materialTypes[material.type]??0)+1;
        for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
        for(const uniform of Object.values(material.uniforms??{}))if(uniform?.value?.isTexture)textures.add(uniform.value);
      }
    }
    for(const child of node.children??[])visit(child,label,visible);
  };
  visit(scene);
  return {scope:'Scene topology and potential submissions, independent of frustum/history; not GPU memory or measured draws.',buckets,
    resources:{geometries:geometries.size,materials:materials.size,materialTextures:textures.size}};
}

export class PeopleBaseline {
  constructor({warmup=120, samples=180, now=()=>performance.now()}={}) {
    if(!Number.isInteger(warmup)||warmup<0||!Number.isInteger(samples)||samples<1||samples>600)throw new RangeError('Invalid baseline window.');
    this.warmup=warmup;this.samples=samples;this.now=now;
    this.frames=[];this.restores=[];this.operations={};this.active=false;this.accepted=0;
  }
  start(metadata) {
    if(this.active)throw new Error('Baseline already active.');
    this.frames=[];this.operations={};this.accepted=0;this.metadata=metadata;
    this.active=true;this.lastStart=null;
  }
  watch(object,key,label=key) {
    if(!this.active)throw new Error('Start baseline before installing probes.');
    const original=object[key],descriptor=Object.getOwnPropertyDescriptor(object,key),owner=this;
    if(typeof original!=='function')throw new TypeError('Baseline probe needs a method.');
    function wrapped(...args) {
      const started=owner.now();
      try{return original.apply(this,args);}
      finally{if(owner.active&&owner.accepted>=owner.warmup){
        const cost=owner.now()-started;
        const totals=owner.operations[label]??={calls:0,totalMs:0,maxMs:0};
        totals.calls++;totals.totalMs+=cost;totals.maxMs=Math.max(totals.maxMs,cost);
        if(owner.current)owner.current.counts[label]=(owner.current.counts[label]??0)+1;
      }}
    }
    object[key]=wrapped;
    this.restores.push(()=>{if(object[key]===wrapped){if(descriptor)Object.defineProperty(object,key,descriptor);else delete object[key];}});
  }
  begin() {
    if(!this.active)return;
    const started=this.now();
    this.current={workMs:0,wallMs:this.lastStart===null?null:started-this.lastStart,counts:{}};
    this.started=started;this.lastStart=started;
  }
  count(name,value) {if(this.active&&this.current)this.current.counts[name]=(this.current.counts[name]??0)+value;}
  end(snapshot) {
    if(!this.active||!this.current)return false;
    this.current.workMs=this.now()-this.started;
    if(this.accepted>=this.warmup)this.frames.push({...this.current,...snapshot()});
    this.current=null;this.accepted++;
    if(this.frames.length===this.samples){this.stop();return true;}
    return false;
  }
  stop() {
    this.active=false;this.current=null;
    for(const restore of this.restores.splice(0).reverse())restore();
  }
  report() {
    const distribution=key=>{
      const values=this.frames.map(f=>f[key]).filter(Number.isFinite).sort((a,b)=>a-b);
      return values.length?{n:values.length,min:values[0],p50:values[Math.ceil(values.length*.5)-1],p95:values[Math.ceil(values.length*.95)-1],max:values.at(-1)}:null;
    };
    return JSON.parse(JSON.stringify({version:1,scope:'Instrumented CPU baseline; not a device FPS claim.',metadata:this.metadata,
      warmup:this.warmup,complete:this.frames.length===this.samples,workMs:distribution('workMs'),wallMs:distribution('wallMs'),operations:this.operations,frames:this.frames}));
  }
}
