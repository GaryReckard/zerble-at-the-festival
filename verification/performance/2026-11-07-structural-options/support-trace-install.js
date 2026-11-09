(() => {
  const game = window.__game, rows = [], bindings = new WeakMap(), enrolled = [];
  const counts = { calls: 0, moves: 0, proposals: 0, successful: 0, geometricUpperBound: 0, omittedRows: 0 };
  let bindingId = 0, finished = false, lastFrame = -1, phase = 'ready';
  const phases = {};
  const fields = ['height','dx','dz','nx','ny','nz','grade','valid','traversable','reason','blockedReason','surfaceId','geometryId','surfaceClass','heading'];
  function insideTriangle(point, radius) {
    const ix = Math.floor(point.x / 10) * 10, iz = Math.floor(point.z / 10) * 10;
    const u = point.x - ix, v = point.z - iz, lower = u + v <= 10;
    const margin = lower ? Math.min(u, v, (10-u-v)/Math.SQRT2) : Math.min(10-u,10-v,(u+v-10)/Math.SQRT2);
    return margin > radius + 1e-6 ? `${ix},${iz},${lower}` : null;
  }
  function enroll(actor, family, radius) {
    const original = actor?.surfaceBinding;
    if (!original || bindings.has(original)) return;
    const id = ++bindingId;
    const wrapped = { ...original };
    for (const method of ['move','propose']) {
      wrapped[method] = function(x,z,out,heading) {
        const before = original.snapshot();
        const target = { x, z, heading: heading === undefined ? before.heading : heading };
        const result = original[method](x,z,out,heading);
        const frame = game.renderer.info.render.frame;
        if (frame !== lastFrame) { lastFrame = frame; phase = window.__performanceLab.status().state; }
        const phaseCounts = phases[phase] || (phases[phase] = {calls:0,successful:0,geometricUpperBound:0});
        phaseCounts.calls++; counts.calls++; counts[method === 'move' ? 'moves' : 'proposals']++;
        if (result.valid && result.traversable) {
          counts.successful++; phaseCounts.successful++;
          const a = insideTriangle(before,radius), b = insideTriangle(target,radius);
          if (before.surfaceId === 'terrain' && result.surfaceId === 'terrain' && a && a === b) {counts.geometricUpperBound++;phaseCounts.geometricUpperBound++;}
        }
        if (counts.calls % 128 === 0) {
          if (rows.length < 20000) {
            const copied = {};
            for (const key of fields) if (Object.prototype.hasOwnProperty.call(result,key)) copied[key] = result[key];
            const status = window.__performanceLab.status();
            const row = { family,radius,method,bindingId:id,phase:status.state,elapsed:status.elapsed,before,target,result:copied,after:original.snapshot(),negativeZeros:[] };
            for (const section of ['before','target','result','after']) for (const [key,value] of Object.entries(row[section])) {
              if (Object.is(value,-0)) row.negativeZeros.push(`${section}.${key}`);
            }
            rows.push(row);
          } else counts.omittedRows++;
        }
        return result;
      };
    }
    const proxy = Object.freeze(wrapped);
    bindings.set(original,proxy); bindings.set(proxy,proxy);
    actor.surfaceBinding = proxy;
    enrolled.push({ actor,original,proxy });
  }
  const crowdUpdate = game.crowd._updateNpc;
  const wrappedCrowd = function(npc,...args) { enroll(npc,'adult',.35); return crowdUpdate.call(this,npc,...args); };
  game.crowd._updateNpc = wrappedCrowd;
  const kidUpdate = game.kids.update;
  const wrappedKids = function(...args) { for (const kid of this.kids) enroll(kid,'child',.4); return kidUpdate.apply(this,args); };
  game.kids.update = wrappedKids;
  for (const npc of game.crowd.npcs) if (npc) enroll(npc,'adult',.35);
  for (const kid of game.kids.kids) enroll(kid,'child',.4);
  window.__supportProbe = {
    finish() {
      if (!finished) {
        if (game.crowd._updateNpc === wrappedCrowd) game.crowd._updateNpc = crowdUpdate;
        if (game.kids.update === wrappedKids) game.kids.update = kidUpdate;
        for (const {actor,original,proxy} of enrolled) if (actor.surfaceBinding === proxy) actor.surfaceBinding = original;
        finished = true;
      }
      return { counts,phases,rows,bindings:bindingId,restored:finished,
        scope:'Original methods always execute; every128th observed request copied, max20000. Geometric counts ignore water/deck/current-world exclusions and are only upper bounds. Initial calls made during new-binding acquisition can be unobserved. Includes settling and measuring; phase counters are sampled once per rendered frame and may straddle a phase boundary by one frame. Not a timing comparison.' };
    }
  };
})()
