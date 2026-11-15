#!/usr/bin/env node
// Reproduce clearance admission under two real initial streaming orders.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {setSessionSeed} from '../../src/rng.js';
globalThis.window={addEventListener(){},innerWidth:1280,innerHeight:720,__perfProfile:'low'};
globalThis.document={addEventListener(){},createElement:()=>({getContext:()=>new Proxy({measureText:()=>({width:100}),
  createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})},
  {get:(o,k)=>k in o?o[k]:()=>{}})})};
const {buildHubPreview,disposeChunkByKey}=await import('../../src/chunks.js');
const {Crowd}=await import('../../src/crowd.js');
const {registry}=await import('../../src/registry.js');
const {heartInCell}=await import('../../src/worldgen/hearts.js');
const {setTerrainEnabled}=await import('../../src/worldgen/terrain.js');
const {setLandscapeVersion,landscapeCandidateInCell}=await import('../../src/worldgen/landscapeCandidates.js');
const {LandscapeRuntime}=await import('../../src/landscape/runtime.js');
const {LandscapePlanner}=await import('../../src/landscape/planner.js');
const {computeLandscapeTask}=await import('../../src/worldgen/landscapeTask.js');
const {CONFIG}=await import('../../src/worldgen/constants.js');
const {FESTIVAL_TUNING}=await import('../../src/worldgen/tuning.js');
setLandscapeVersion(2);setTerrainEnabled(true);
// Prime the in-process worker's settings before runtime captures its epoch.
setSessionSeed(11);
const prime=landscapeCandidateInCell(0,0);
computeLandscapeTask({id:0,key:'prime',version:2,seed:11,candidateId:prime.id,cx:0,cz:0,
  fingerprint:JSON.stringify(prime),config:structuredClone(CONFIG),tuning:structuredClone(FESTIVAL_TUNING)});
const workerFactory=()=>({postMessage(data){queueMicrotask(()=>this.onmessage?.({data:computeLandscapeTask(data)}));},terminate(){}});

const {ChunkManager}=await import('../../src/chunks.js');
const observations=[];
for(const position of [{x:57,z:-107},{x:105,z:-126}]) {
 setSessionSeed(4);const scene=new THREE.Scene(),crowd=new Crowd({spawn(){},spawnLost(){}});
 const planner=new LandscapePlanner({workerFactory}),runtime=new LandscapeRuntime(scene,{planner});
 const manager=new ChunkManager(scene,crowd,{readyForChunk:b=>runtime.access.ready(b)});
 try {
  await runtime.prepare({minX:-400,minZ:-500,maxX:500,maxZ:600});runtime.installPolicy();
  manager.update(position,Infinity);
  const games=[...registry.entries.values()].filter(e=>e.kind==='cornhole_game').map(e=>({x:e.position.x,z:e.position.z,source:e.sourceKey,chunk:e.chunkKey}));
  const nearbyTrees=[...registry.entries.values()].filter(e=>e.kind==='forest_tree'&&Math.hypot(e.position.x-87.220032,e.position.z+125.976899)<9).map(e=>({x:e.position.x,z:e.position.z,radius:e.footprint,chunk:e.chunkKey}));
  observations.push({seed:4,position,loaded:manager.loaded.size,courts:games,nearbyTrees});
  assert.equal(games.length,position.x===57?1:0,'occupied clearing is declined rather than forced');
 } finally {
  for(const [key,chunk] of manager.loaded)manager._unload(key,chunk);crowd.dispose();runtime.dispose();
 }
 assert.equal(registry.entries.size,0,'streaming probe tears down every entry');
}
console.log(JSON.stringify(observations,null,2));
