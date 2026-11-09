(() => {
  const g=window.__game,debug=window.__debug,factory=window.__structuralPresentation;
  if(!g||!debug||typeof factory!=='function')throw Error('Game/debug/actual createChildPresentation export unavailable');
  if(window.__renderProbe)throw Error('Rendering probe already installed');
  const initial={paused:debug.isPaused(),mode:g.chaseCam.mode,t:g.getTimeOfDay().t};
  let context=null,adapters=[],flags=[],variant='baseline',mechanism=null,finished=false;
  const events=[];
  const equal=(a,b)=>a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
  const check=(condition,message)=>{if(!condition)throw Error(message);};
  const pose=n=>[...n.position.toArray(),...n.quaternion.toArray(),...n.scale.toArray(),...n.matrix.elements,...n.matrixWorld.elements];
  const camera=()=>[...g.camera.matrix.elements,...g.camera.matrixWorld.elements,...g.camera.matrixWorldInverse.elements,...g.camera.projectionMatrix.elements,...g.camera.projectionMatrixInverse.elements,g.camera.layers.mask];
  const fingerprint=value=>{let hash=2166136261;for(const char of JSON.stringify(value)){hash=Math.imul(hash^char.charCodeAt(0),16777619);}return (hash>>>0).toString(16);};
  const registry=()=>JSON.stringify([...g.registry.entries].map(([id,e])=>[id,e.kind,e.position?.x,e.position?.y,e.position?.z,e.footprint,e.chunkKey,e.collider&&Object.fromEntries(Object.entries(e.collider).filter(([,v])=>v===null||['number','string','boolean'].includes(typeof v)))]));
  function render(){check(debug.isPaused(),'Simulation is not frozen');g.composer.render();check(g.renderer.__sceneInfo,'Scene-only renderer counters unavailable');}
  function eligible(n){
    if(n.isInstancedMesh)return 'instanced';if(n.isSkinnedMesh)return 'skinned';if(n.customDepthMaterial||n.customDistanceMaterial)return 'custom-shadow';
    if(Array.isArray(n.material))return 'material-array';if(!n.material||!n.geometry)return 'missing-resource';if(n.material.transparent)return 'transparent';
    if(Object.values(n.geometry.morphAttributes).some(a=>a.length))return 'morph';return null;
  }
  function counts(){let currentMeshes=0;g.scene.traverse(n=>{if(n.isMesh)currentMeshes++;});return {geometryObjects:g.renderer.info.memory.geometries,textures:g.renderer.info.memory.textures,programs:g.renderer.info.programs?.length??null,originalMeshes:context?.originalMeshes??0,selectedVendorMeshes:context?.vendorMeshes.length??0,selectedStaticMeshes:context?.staticMeshes.length??0,currentMeshes,adapterGroups:adapters.length,batchMeshes:adapters.reduce((n,a)=>n+a.group.children.length,0),submittedInstances:adapters.reduce((n,a)=>n+a.group.children.reduce((m,v)=>m+v.count,0),0),sourceLayersZero:context?.vendorMeshes.filter(n=>n.layers.mask===0).length??0};}
  function verify(){
    if(!context)return;
    check(debug.isPaused(),'Pause changed during comparison');check(registry()===context.registry,'Registry fingerprint changed');check(equal(camera(),context.camera),'Camera matrices changed');
    for(const r of context.records){check(r.node.parent===r.parent,`Reparented source ${r.node.uuid}`);check(equal(pose(r.node),r.pose),`Source pose/matrix changed ${r.node.uuid}`);check(r.node.visible===r.visible,`Source visibility changed ${r.node.uuid}`);
      const expected=variant==='candidate'&&mechanism==='vendor-instances'&&context.vendorSet.has(r.node)?0:r.layers;
      check(r.node.layers.mask===expected,`Source layer mismatch ${r.node.uuid}`);if(r.node.isMesh){check(r.node.geometry===r.geometry&&r.node.material===r.material,`Source resource changed ${r.node.uuid}`);check(r.node.castShadow===r.cast&&r.node.receiveShadow===r.receive&&r.node.renderOrder===r.order&&r.node.frustumCulled===r.culled,`Source render state changed ${r.node.uuid}`);}const frozen=variant==='candidate'&&mechanism==='static-flags'&&context.staticSet.has(r.node);check(r.node.matrixAutoUpdate===(frozen?false:r.auto)&&r.node.matrixWorldAutoUpdate===(frozen?false:r.world),`Source transform flags changed ${r.node.uuid}`);}
    const broken=adapters.filter(a=>a.disposed);if(broken.length)events.push({kind:'disposed-fallback',reasons:broken.map(a=>a.fallbackReason)});check(!broken.length,'Adapter disposed into fallback: '+broken.map(a=>a.fallbackReason).join(','));
  }
  function restoreVariant(){
    const cleanupErrors=[];
    for(const adapter of adapters){try{adapter.dispose();check(adapter.disposed,'Adapter disposal flag false');check(adapter.group.parent===null,'Disposed adapter still attached');}catch(e){cleanupErrors.push(String(e));}}
    adapters=[];
    for(const r of flags){r.node.matrixAutoUpdate=r.auto;r.node.matrixWorldAutoUpdate=r.world;r.node.matrixWorldNeedsUpdate=r.needs;}
    flags=[];variant='baseline';
    if(context){try{check(g.scene.onBeforeRender===context.onBeforeRender,'Scene render observer not restored');verify();check(counts().currentMeshes===context.originalMeshes,'Source mesh count not restored');}catch(e){cleanupErrors.push(String(e));}}
    if(cleanupErrors.length)throw Error('Variant cleanup failed: '+cleanupErrors.join('; '));
  }
  function setVariant(next){
    check(context,'No case prepared');if(variant===next)return counts();restoreVariant();
    if(next==='candidate'){
      if(mechanism==='vendor-instances'){
        const started=performance.now();
        try{for(const [cell,nodes]of context.cells){
          const descriptor=Object.getOwnPropertyDescriptor(g.scene,'traverse');
          try{g.scene.traverse=callback=>{for(const node of nodes)callback(node);};const adapter=factory({scene:g.scene,source:g.scene,seed:2404796662});adapters.push(adapter);check(!adapter.disposed,`Initial adapter fallback ${cell}: ${adapter.fallbackReason}`);}
          finally{if(descriptor)Object.defineProperty(g.scene,'traverse',descriptor);else delete g.scene.traverse;}
        }}catch(error){events.push({kind:'construction-error',error:String(error)});restoreVariant();throw error;}
        context.constructions.push({ms:performance.now()-started,groups:adapters.length});
      }else if(mechanism==='static-flags'){
        flags=context.staticMeshes.map(node=>({node,auto:node.matrixAutoUpdate,world:node.matrixWorldAutoUpdate,needs:node.matrixWorldNeedsUpdate}));
        for(const {node}of flags){node.matrixAutoUpdate=false;node.matrixWorldAutoUpdate=false;}
      }else throw Error('Unknown rendering mechanism');
      variant='candidate';
    }
    render();verify();return counts();
  }
  function beginCase(kind){
    if(context)restoreVariant();context=null;mechanism=kind;variant='baseline';check(debug.isPaused(),'Freeze before beginning a case');
    render();const nodes=[];g.scene.traverse(n=>nodes.push(n));const booths=nodes.filter(n=>n.userData.evening?.vendor),vendorMeshes=[],staticMeshes=[],cells=new Map(),skips={};
    const skip=reason=>skips[reason]=(skips[reason]||0)+1;
    for(const booth of booths){
      const vendor=booth.userData.evening.vendor,cell=`${Math.floor(booth.matrixWorld.elements[12]/80)},${Math.floor(booth.matrixWorld.elements[14]/80)}`;
      vendor.traverse(n=>{if(!n.isMesh)return;const reason=eligible(n);if(reason){skip('vendor-'+reason);return;}vendorMeshes.push(n);if(!cells.has(cell))cells.set(cell,[]);cells.get(cell).push(n);});
      for(const n of booth.children){if(!n.isMesh)continue;const reason=eligible(n);if(reason){skip('static-'+reason);continue;}staticMeshes.push(n);}
    }
    context={records:nodes.map(node=>({node,parent:node.parent,pose:pose(node),visible:node.visible,layers:node.layers.mask,geometry:node.geometry,material:node.material,cast:node.castShadow,receive:node.receiveShadow,order:node.renderOrder,culled:node.frustumCulled,auto:node.matrixAutoUpdate,world:node.matrixWorldAutoUpdate})),vendorMeshes,vendorSet:new Set(vendorMeshes),staticMeshes,staticSet:new Set(staticMeshes),cells,skips,registry:registry(),camera:camera(),onBeforeRender:g.scene.onBeforeRender,originalMeshes:nodes.filter(n=>n.isMesh).length,constructions:[]};
    check(kind==='vendor-instances'?vendorMeshes.length:staticMeshes.length,'No eligible records for '+kind);
    return {originalNodes:context.records.length,originalWorldMatrixFingerprint:fingerprint(context.records.map(r=>[r.node.uuid,r.pose])),cameraFingerprint:fingerprint(context.camera),registryFingerprint:fingerprint(context.registry),predictedBuckets:[...cells].reduce((total,[,records])=>total+new Set(records.map(n=>[n.geometry.id,n.material.id,n.castShadow,n.receiveShadow,n.renderOrder,n.layers.mask].join('/'))).size,0),mechanism:kind,booths:booths.length,cells:cells.size,skips,counts:counts(),cameraMode:g.chaseCam.mode,t:g.getTimeOfDay().t,registryEntries:g.registry.entries.size};
  }
  function matrixAudit(){
    check(mechanism==='static-flags','Prepare static case before audit');const audit={};
    function instrument(){const counters={updateMatrix:0,worldMultiply:0},saved=[];
      for(const node of context.staticMeshes)for(const [object,key,label]of [[node,'updateMatrix','updateMatrix'],[node.matrixWorld,'multiplyMatrices','worldMultiply']]){
        const descriptor=Object.getOwnPropertyDescriptor(object,key),original=object[key];object[key]=function(...args){counters[label]++;return original.apply(this,args);};saved.push({object,key,descriptor});}
      try{render();}finally{for(const {object,key,descriptor}of saved){if(descriptor)Object.defineProperty(object,key,descriptor);else delete object[key];}}return counters;
    }
    setVariant('baseline');audit.baseline=instrument();verify();setVariant('candidate');audit.flags=instrument();verify();
    const node=context.staticMeshes[0],parent=node.parent,position=parent.position.clone(),oldWorld=node.matrixWorld.elements.slice(),oldParentMatrix=parent.matrix.elements.slice(),oldParentWorld=parent.matrixWorld.elements.slice(),oldNeeds=parent.matrixWorldNeedsUpdate;
    try{
      parent.position.x+=.125;g.scene.updateMatrixWorld(true);
      audit.parentMutation={worldChanged:!equal(oldWorld,node.matrixWorld.elements),forcePropagatedDespiteWorldAutoUpdateFalse:!equal(oldWorld,node.matrixWorld.elements),positionDelta:.125};
      check(audit.parentMutation.worldChanged,'Pinned r160 forced parent update failed to reach static child');
      // Explicit publication is tested rather than assuming child world flags suppress force.
      node.updateMatrix();node.updateWorldMatrix(true,false);audit.parentMutation.explicitRepublishFinite=node.matrixWorld.elements.every(Number.isFinite);
    }finally{
      parent.position.copy(position);parent.matrix.fromArray(oldParentMatrix);parent.matrixWorld.fromArray(oldParentWorld);parent.matrixWorldNeedsUpdate=oldNeeds;
      g.scene.updateMatrixWorld(true);node.updateMatrix();node.updateWorldMatrix(true,false);restoreVariant();render();verify();
    }
    audit.parentMutation.exactRevert=true;audit.interpretation='Pinned r160 parent force still recomputes child world matrices; flags avoid local composition only. No world-multiply skipping is claimed.';return audit;
  }
  async function block(next,frames=24){
    check(Number.isInteger(frames)&&frames>=1&&frames<=60,'Frame block must be bounded');setVariant(next);for(let i=0;i<4;i++)render();verify();
    const samples=[];let previous=null;
    for(let i=0;i<frames;i++){
      const stamp=await new Promise(resolve=>requestAnimationFrame(resolve));const start=performance.now();render();const workMs=performance.now()-start,info=g.renderer.__sceneInfo;
      samples.push({frame:i,rafTimestamp:stamp,wallMs:previous===null?null:stamp-previous,workMs,calls:info.calls,triangles:info.triangles});previous=stamp;
    }
    verify();return {variant:next,samples,counts:counts(),fallbacks:adapters.map(a=>({disposed:a.disposed,reason:a.fallbackReason})),constructions:context.constructions.slice()};
  }
  function finish(){
    if(finished)return {restored:true,events};let error;
    try{if(context)restoreVariant();}catch(e){error=String(e);}finally{debug.pause(initial.paused);finished=true;}
    if(error)throw Error(error);return {restored:true,paused:debug.isPaused(),events};
  }
  window.__renderProbe={endCase:()=>{restoreVariant();context=null;mechanism=null;return {restored:true};},beginCase,matrixAudit,setVariant,block,verify:()=>{verify();return counts();},restoreVariant,finish,events};
  return {installed:true,initial};
})()
