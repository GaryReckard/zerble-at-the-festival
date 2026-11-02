import {createDistrictVisibility} from './districtVisibility.js';
import * as THREE from 'three';
import { registry as worldRegistry,Registry } from '../registry.js';
import { mulberry32 } from '../rng.js';
import { buildCampsiteSteps, buildChiminea, updateCampsiteProps } from '../models/campsite.js';
import { registerCampsite, canPlaceCampsite } from '../campRegistry.js';
import { buildWorldgenDrumCircleSteps, forestDrumCircles, forestDrumMusic } from '../forests.js';
import { updateLeafDrumCircle } from '../models/leafDrumCircle.js';
import { updateTribalFigures } from '../models/tribalFigures.js';
import { describeForestTree, buildForestInstanced,worldPerches,worldCrown } from '../models/tree.js';
import { disposeSceneResources } from '../sceneResources.js';
import { Sound } from '../sound.js';
import { validateRoute, routeClearsSolids } from './routes.js';
import { mountainDistrictPlan } from './districtPlan.js';
import { districtAdmissionRecord } from '../worldgen/landscape.js';
import { landscapeToWorld } from '../worldgen/landscapeCandidates.js';
import { createSupportBinding } from './support.js';
import { register as registerContextLight,unregister as unregisterContextLight } from '../contextLights.js';

const activeOwners = new Set();
export function buildMountainDistrict(scene, fixture, options={}) {
  const steps=buildMountainDistrictSteps(scene,fixture,options);let step;do{step=steps.next();}while(!step.done);return step.value;
}

export function* buildMountainDistrictSteps(scene, fixture, { plan = mountainDistrictPlan(), crowd = null, failAfter = null, admission = null, movementWorld = fixture.supportWorld, externallyAnimatedDrum = false, cullDetail = false } = {}) {
  if (activeOwners.has(plan.id)) throw new Error(`District owner already active: ${plan.id}`);
  const record=admission?districtAdmissionRecord(admission,plan,fixture):null;
  if(admission&&!record)throw new Error('District admission is stale or belongs to another plan/surface');
  const route=record?.route||validateRoute(fixture.supportWorld,plan.route,{maxGrade:.3});
  if(!route.valid)throw new Error(`District access rejected: ${route.reason}`);
  if(!record)for(const path of [plan.mainRoad,...plan.accessPaths,plan.visitorRoute]) {
    const access=validateRoute(fixture.supportWorld,path);
    if(!access.valid)throw new Error(`District lane rejected: ${access.reason}`);
  }
  const started = performance.now(), root = new THREE.Group(), camps = [], residents = [], meadowAnimatables = [], pins = new Set(), stages=[],staging=new Registry(),deferredLights=new Set();
  const registry={
    add:entry=>staging.add(entry),byChunk:key=>published?worldRegistry.byChunk(key):staging.byChunk(key),
    entries:{get:id=>staging.entries.get(id)||worldRegistry.entries.get(id)},
    byKind:{get:kind=>({*[Symbol.iterator](){yield* worldRegistry.byKind.get(kind)||[];yield* staging.byKind.get(kind)||[];}})},
    removeChunk:key=>{staging.removeChunk(key);worldRegistry.removeChunk(key);},
    footprintsNear(...args){worldRegistry.footprintsNear(...args);staging.footprintsNear(...args);},
    collidersNear(...args){worldRegistry.collidersNear(...args);staging.collidersNear(...args);},
    generationFootprintsNear(...args){worldRegistry.generationFootprintsNear(...args);staging.generationFootprintsNear(...args);},
    generationCollidersNear(...args){worldRegistry.generationCollidersNear(...args);staging.generationCollidersNear(...args);}
  };
  const deferLights=group=>group.traverse(n=>{if(n.isLight){unregisterContextLight(n);n.visible=false;deferredLights.add(n);}});
  function* consume(iterator){let step;try{do{step=iterator.next();if(!step.done){if(step.value?.group)deferLights(step.value.group);yield step.value;}}while(!step.done);return step.value;}finally{if(!step?.done)iterator.return();}}
  root.name = plan.id;
  let disposed = false, published = false, complete = false, drum = null, meadowFire = null, largestBuildMs = 0;
  const recordStage=(kind,begin)=>{const ms=performance.now()-begin;stages.push(Object.freeze({kind,ms}));largestBuildMs=Math.max(largestBuildMs,ms);};
  const heightAt = (x, z) => fixture.sampleTerrain(x, z, {}).height;
  function clearHooks() {
    for (let i = forestDrumCircles.length - 1; i >= 0; i--) if (forestDrumCircles[i].chunkKey === plan.id) forestDrumCircles.splice(i, 1);
    for (let i = forestDrumMusic.length - 1; i >= 0; i--) if (forestDrumMusic[i].chunkKey === plan.id) {
      const item = forestDrumMusic.splice(i, 1)[0]; Sound.detachStageMusic(item.handle);
    }
  }
  function dispose() {
    if (disposed) return true;
    if (pins.size || residents.some(r => crowd?.npcs.includes(r.npc) && ['riding','boarding','disembarking'].includes(r.npc.state))) return false;
    disposed = true; activeOwners.delete(plan.id);
    const errors = [], release = fn => { try { fn(); } catch (e) { errors.push(e); } };
    // Borrowers release while their places and rigs still exist.
    for (const { npc } of residents) if (crowd?.npcs.includes(npc)) release(() => crowd.removeNpc(npc));
    release(() => crowd?.unloadChunk(plan.id));
    residents.length = 0;
    release(clearHooks);for(const light of deferredLights)unregisterContextLight(light);deferredLights.clear(); release(() => registry.removeChunk(plan.id));
    release(() => root.removeFromParent()); release(() => disposeSceneResources(root));
    if (errors.length) throw new AggregateError(errors, 'Mountain district cleanup failed');
    return true;
  }
  activeOwners.add(plan.id);
  try {
    yield {phase:'district-root',group:root};
    for (let i = 0; i < plan.camps.length; i++) {
      const pitch = plan.camps[i], begin = performance.now();
      const camp = yield* consume(buildCampsiteSteps(mulberry32((plan.seed ^ (i + 1) * 0x6D2B79F5) >>> 0), pitch.size, { plan: pitch.recipe }));
      // Attach before registration so rollback owns even a partly registered camp.
      root.add(camp.group); camp.group.position.set(pitch.x, heightAt(pitch.x, pitch.z), pitch.z);
      camp.group.rotation.y = -(camp.entranceYaw || 0) + pitch.facing;
      if (!canPlaceCampsite(registry, camp, plan.id)) throw new Error(`District pitch obstructed: ${pitch.id}`);
      registerCampsite(registry, camp, { chunkKey: plan.id, campNeighborhood: plan.id, heightAt, attractor: { radius: 4, weight: .5 } });
      camps.push(camp); recordStage(`camp:${pitch.role}`,begin);
      if (failAfter === i + 1) throw new Error('Injected district build failure');
      yield {phase:'camp-registration',group:camp.group};
    }
    if(plan.clearing.drum!==false) {
      const begin=performance.now();
      drum=yield* consume(buildWorldgenDrumCircleSteps({group:root,key:plan.id,rng:mulberry32(plan.seed^0x4452554D),heightAt,registry,deferPublication:true},plan.clearing.x,plan.clearing.z,plan.clearing.facing));
      recordStage('drum-and-crew',begin);
    }
    if(plan.meadowFire) {
    const begin=performance.now();
    meadowFire=buildChiminea(mulberry32(plan.seed^0x46495245),{style:'firepit'});
    meadowAnimatables.push(meadowFire);
    meadowFire.group.scale.setScalar(2.5);
    meadowFire.group.position.set(plan.meadowFire.x,heightAt(plan.meadowFire.x,plan.meadowFire.z),plan.meadowFire.z);root.add(meadowFire.group);
    const pad=new THREE.Mesh(new THREE.CylinderGeometry(3,3,.08,20),new THREE.MeshStandardMaterial({color:0xaaa79d,roughness:1}));
    pad.position.copy(meadowFire.group.position);pad.position.y+=.04;root.add(pad);
    registry.add({kind:'firepit',position:meadowFire.group.position.clone(),footprint:2,collider:{radius:1.6,damage:9,minY:0,maxY:2},chunkKey:plan.id});
    recordStage('meadow-fire',begin);deferLights(meadowFire.group);yield {phase:'meadow-fire',group:meadowFire.group};
    }
    const woodlandBins=[];
    const treesBegin=performance.now();
    const trees = [], rng = mulberry32(plan.seed ^ 0x54524545);
    const protectedPaths=[plan.mainRoad,...plan.accessPaths,plan.narrowPath];
    function addTree(x,z) {
      if (Math.hypot(x-plan.clearing.x,z-plan.clearing.z)<27 || plan.camps.some(p=>Math.hypot(x-p.x,z-p.z)<p.recipe.footprint+2)) return;
      if (protectedPaths.some(path=>!routeClearsSolids(path,[{position:{x,z},radius:2}],6))) return;
      const d=describeForestTree(rng),y=heightAt(x,z);
      trees.push({d,x,y,z,rotY:rng()*Math.PI*2});
      registry.add({kind:'tree',position:new THREE.Vector3(x,y,z),footprint:d.trunk.rBot,perches:worldPerches(d,x,z,y),crown:worldCrown(d,x,z,y),
        collider:{radius:d.trunk.rBot,damage:1,minY:0,maxY:d.trunk.h},chunkKey:plan.id});
    }
    const woodland=plan.woodland,frame=plan.frame;
    for(let z=woodland.bounds.minZ;z<=woodland.bounds.maxZ;z+=woodland.step) for(let x=woodland.bounds.minX;x<=woodland.bounds.maxX;x+=woodland.step) {
      const p=landscapeToWorld(frame,x+(rng()-.5)*5,z+(rng()-.5)*4);addTree(p.x,p.z);
      yield {phase:'woodland-description'};
    }
    for(const shelf of plan.treeShelves||plan.shelves) for(let z=shelf.minZ;z<=shelf.maxZ;z+=28) for(const x of [shelf.minX-15,shelf.maxX+45]) {
      const p=landscapeToWorld(frame,x,z);addTree(p.x,p.z);
    }
    if(cullDetail){
      const bins=new Map();
      for(const tree of trees){const cx=Math.floor(tree.x/80),cz=Math.floor(tree.z/80),key=`${cx},${cz}`;if(!bins.has(key))bins.set(key,{x:cx*80+40,z:cz*80+40,trees:[]});bins.get(key).trees.push(tree);}
      for(const bin of bins.values()){
        const group=new THREE.Group();group.name='mountaintop-woodland-bin';root.add(group);
        for(const mesh of buildForestInstanced(bin.trees)){mesh.castShadow=false;group.add(mesh);}
        woodlandBins.push({x:bin.x,z:bin.z,group,trees:bin.trees});yield {phase:'woodland-bin',group};
      }
    }else for (const mesh of buildForestInstanced(trees)) { mesh.castShadow = false; root.add(mesh); }
    recordStage('woodland',treesBegin);
    const visibility=cullDetail?createDistrictVisibility(root,camps,woodlandBins,drum):null;
    yield {phase:'visibility',group:root};
    const finishBegin=performance.now();
    root.updateMatrixWorld(true);
    for (const entry of registry.byChunk(plan.id)) if (entry.collider) {
      if (entry.kind==='tree') continue;
      entry.collider = { ...entry.collider, minY: -.5, maxY: entry.kind === 'camp_tent' ? 6 : entry.kind === 'camp_canopy' ? 5 : 2 };
    }
    const colliders = [...registry.byChunk(plan.id)].filter(e => e.collider).map(e => ({ entry: e, position: e.position,
      radius: e.collider.radius, damage: e.collider.damage, kind: e.kind, minY: e.position.y + e.collider.minY, maxY: e.position.y + e.collider.maxY }));
    for (const path of [plan.mainRoad,plan.route,...plan.accessPaths])
      if (!routeClearsSolids(path,colliders)) throw new Error('District lane obstructed by a built prop');
    // Staged registry entries never enter live broadphase queries. Recheck
    // surrounding occupancy, then transfer the same entry/seat references.
    for(const camp of camps)if(!canPlaceCampsite(worldRegistry,camp,plan.id))throw new Error('District changed while staged');
    const publishedEntries=[...staging.byChunk(plan.id)],publishedIds=new Map();
    for(const entry of publishedEntries){const oldId=entry.id;staging.remove(oldId);publishedIds.set(oldId,worldRegistry.add(entry));}
    // Physics descriptors refer to the camp's registry identity. Publication
    // allocates live IDs, while seat/collider object references remain shared.
    const descriptors=new Set(publishedEntries.flatMap(entry=>[...(entry.physicalProps||[]),...(entry.physicalChairs||[]),...(entry.physicalProp?[entry.physicalProp]:[])]));
    for(const descriptor of descriptors){const id=publishedIds.get(descriptor.originRegistryId);if(id!==undefined)descriptor.originRegistryId=id;}
    scene.add(root);published=true;
    for(const light of deferredLights)if(light!==drum?.dc.fireLight)registerContextLight(light);
    drum?.activate();
    recordStage('publication',finishBegin);complete=true;
    return Object.freeze({ id: plan.id, root, camps, drum, meadowFire, residents, plan, route,
      allocationMs: performance.now() - started, largestBuildMs,stages:Object.freeze(stages),
      colliders,visibility,
      get disposed() { return disposed; },
      pin(dependency) { if (disposed || !published || dependency == null) throw new Error('Cannot pin district'); const token = { dependency }; pins.add(token); return () => pins.delete(token); },
      update(time, nightness, dt = 0, player = null) {
        if (disposed) return;
        if(player&&visibility)visibility.update(player.position);
        updateCampsiteProps(time,nightness,meadowAnimatables,nightness>.5?.8:.25);
        for (const camp of camps) updateCampsiteProps(time, nightness, camp.animatables, nightness > .5 ? .8 : .25);
        if(drum&&!externallyAnimatedDrum){updateLeafDrumCircle(time,nightness,drum.dc);updateTribalFigures(time,nightness,drum.figures);}
        if (crowd && player) {
          for (let i = residents.length - 1; i >= 0; i--) if (!crowd.npcs.includes(residents[i].npc)) residents.splice(i,1);
          if (!residents.some(r=>r.camp===-1)) {
            const start=plan.visitorRoute[0],rng=mulberry32(plan.seed^0x56495349);
            const npc=crowd.spawn({pos:new THREE.Vector3(start.x,heightAt(start.x,start.z),start.z),chunkKey:plan.id,rng,allowPhotographer:false});
            if (npc) {
              crowd.bindSurface(npc.personHandle,createSupportBinding(movementWorld,start,
                {footprint:[{x:-.35,z:0},{x:.35,z:0},{x:0,z:-.35},{x:0,z:.35}]}));
              crowd.walkCorridor(npc.personHandle,plan.visitorRoute);residents.push({npc,camp:-1});
            }
          }
          for (let i = 0; i < plan.camps.length; i++) {
            const pitch = plan.camps[i];
            if (pitch.role === 'satellite') continue;
            if (Math.hypot(player.position.x-pitch.x,player.position.z-pitch.z)>120) continue;
            for (let slot = residents.filter(r=>r.camp===i).length; slot < 1; slot++) {
              const rng = mulberry32((plan.seed ^ (i+1)*0x50454F50 ^ slot)>>>0);
              const x=pitch.x, z=pitch.z+15;
              const npc=crowd.spawn({pos:new THREE.Vector3(x,heightAt(x,z),z),chunkKey:plan.id,rng,allowPhotographer:false});
              if (!npc) break;
              crowd.bindSurface(npc.personHandle,createSupportBinding(movementWorld,{x,z},
                {footprint:[{x:-.35,z:0},{x:.35,z:0},{x:0,z:-.35},{x:0,z:.35}]}));
              residents.push({npc,camp:i});
            }
          }
        }
      },
      dispose });
  } catch (error) {
    try { dispose(); } catch (cleanupError) { throw new AggregateError([error, cleanupError], 'District construction and rollback failed'); }
    throw error;
  } finally {if(!complete)dispose();}
}
