// Run in the local game after __dbg.start(); identical before/after workload.
export async function particleProbe() {
  const THREE = await import('three');
  const { Smiles } = await import('../../../src/smiles.js');
  const { Bubbles } = await import('../../../src/bubbles.js');
  const { renderer } = window.__dbg.game;
  window.__dbg.debug.pause(true);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 4, 12);
  camera.lookAt(0, 2, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 3));
  const smiles = new Smiles();
  scene.add(smiles.group);
  const origin = new THREE.Vector3();
  const target = { position: new THREE.Vector3(1000, 0, 0) };
  const npc = { pos: new THREE.Vector3(-1000, 0, 0) };
  const geometries = [];
  const targetBefore = renderer.getRenderTarget();
  renderer.setRenderTarget(null);
  const haloGeometries = new Set(), haloMaterials = new Set();
  for (let cycle = 0; cycle < 6; cycle++) {
    for (let i = 0; i < 20; i++) {
      smiles.spawn(origin);
      smiles.spawnLost(origin, npc);
    }
    for (const smile of smiles.active) {
      haloGeometries.add(smile.halo.geometry);
      haloMaterials.add(smile.halo.material);
    }
    renderer.render(scene, camera);
    smiles.update(15, target, () => { throw new Error('Unexpected collection'); });
    renderer.render(scene, camera);
    if (smiles.active.length || smiles.group.children.length) throw new Error('Smile did not expire');
    geometries.push(renderer.info.memory.geometries);
  }
  scene.remove(smiles.group);
  const bubbles = new Bubbles();
  bubbles.setCheapMaterial(true);
  scene.add(bubbles.mesh);
  const cart = { speed: 0, nozzleWorld: new THREE.Vector3(0, 2, 0), forwardWorld: new THREE.Vector3(0, 0, 1) };
  const bubbleSamples = [];
  bubbles.juice = 0;
  for (const live of [2, 20, bubbles.particles.length]) {
    for (const p of bubbles.particles) p.alive = false;
    for (let i = 0; i < live; i++) {
      const p = bubbles.particles[i];
      p.alive = true; p.popping = false; p.age = 0;
      p.pos.set((i % 10 - 5) * 0.2, 2, 0);
    }
    bubbles.update(0, cart);
    renderer.render(scene, camera);
    bubbleSamples.push({ live, submitted: bubbles.mesh.count, draws: renderer.info.render.calls, triangles: renderer.info.render.triangles });
  }
  const result = {
    userAgent: navigator.userAgent,
    gpu: renderer.getContext().getParameter(renderer.getContext().getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL),
    tier: new URLSearchParams(location.search).get('perf'),
    haloGeometries: haloGeometries.size, haloMaterials: haloMaterials.size,
    geometriesAfterEachExpiredBatch: geometries,
    geometryGrowthAfterWarmup: geometries.at(-1) - geometries[0],
    bubbleSamples,
  };
  // The baseline needs explicit cleanup because detached halos have no owner cleanup.
  if (smiles.dispose) smiles.dispose();
  else {
    for (const g of [smiles._geo, smiles._faceGeo, smiles._minusGeo, ...haloGeometries]) g.dispose();
    for (const m of [smiles._mat, smiles._lostMat, smiles._faceMat, smiles._minusMat, ...haloMaterials]) m.dispose();
  }
  bubbles.mesh.dispose(); bubbles.mesh.geometry.dispose();
  bubbles._cheapMat.dispose(); bubbles._fancyMat.dispose();
  renderer.setRenderTarget(targetBefore);
  window.__dbg.debug.pause(false);
  return result;
}

export async function checkBubbleBounds() {
  const THREE = await import('three');
  const { Bubbles } = await import('../../../src/bubbles.js');
  const bubbles = new Bubbles();
  bubbles.juice = 0;
  for (let i = 0; i < 2; i++) {
    const p = bubbles.particles[i];
    p.alive = true;
    p.pos.set(i * 0.1, 2, 100);
  }
  bubbles.update(0, { speed: 0 });
  const legacy = new THREE.InstancedMesh(bubbles.mesh.geometry, bubbles.mesh.material, bubbles.particles.length);
  legacy.instanceMatrix.copy(bubbles.mesh.instanceMatrix);
  legacy.computeBoundingSphere();
  if (!legacy.boundingSphere.equals(bubbles.mesh.boundingSphere)) throw new Error('Transparency sorting sphere changed');
  if (bubbles.mesh.count !== 2) throw new Error('Dead tail still submitted');
  const initial = bubbles.mesh.boundingSphere.clone();
  bubbles.particles[1].pos.z = 200;
  bubbles.update(0, { speed: 0 });
  if (!initial.equals(bubbles.mesh.boundingSphere)) throw new Error('Legacy cached sorting sphere changed');
  legacy.dispose(); bubbles.mesh.dispose(); bubbles.mesh.geometry.dispose();
  bubbles._fancyMat.dispose(); bubbles._cheapMat.dispose();
  return 'PASS: real Three.js full-pool sorting bounds unchanged with trimmed submissions';
}

export async function travelProbe() {
  const dbg = window.__dbg;
  const samples = [];
  for (const [x, z] of [[300, -641], [1043, -31], [1789, -1594], [300, -641]]) {
    dbg.teleport(x, z);
    let previous = '', stable = 0;
    for (let i = 0; i < 40; i++) {
      await new Promise(resolve => setTimeout(resolve, 250));
      const s = dbg.debug.perfSnapshot();
      const key = `${s.reg}:${s.cgN}`;
      stable = key === previous ? stable + 1 : 0;
      previous = key;
      if (stable >= 8) break;
      if (i === 39) throw new Error('Streaming did not settle');
    }
    const reg = dbg.game.registry;
    for (const [key, ids] of reg._byChunk) {
      const expected = [...reg.entries.values()].filter(e => e.chunkKey === key).map(e => e.id);
      if (JSON.stringify(expected) !== JSON.stringify([...ids])) throw new Error('Chunk index diverged');
    }
    const expected = [...reg.entries.values()].filter(e => e.attractor).map(e => e.id);
    if (JSON.stringify(expected) !== JSON.stringify([...reg._attractors.keys()])) throw new Error('Attractor index diverged');
    samples.push(dbg.debug.perfSnapshot());
  }
  return samples.map(({ x, z, reg, cgN, npc, geo, tex, prog, fps }) => ({ x, z, reg, cgN, npc, geo, tex, prog, fps }));
}
