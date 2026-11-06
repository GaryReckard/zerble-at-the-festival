import { headingDelta } from './routes.js';
// Pure support selection. Observations never change a mover's accepted layer.
export const TERRAIN_SUPPORT = 'terrain';
export const MAX_LOCAL_SUPPORTS = 64;

const finite = (value, name) => {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
};
const contains = (b, x, z) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
function bounds(value) {
  const b = Object.fromEntries(['minX', 'maxX', 'minZ', 'maxZ'].map(k => [k, finite(value?.[k], k)]));
  if (b.minX >= b.maxX || b.minZ >= b.maxZ) throw new RangeError('Support bounds must have positive area');
  return Object.freeze(b);
}

export function verticalIntervalsOverlap(a, b) {
  for (const interval of [a, b]) {
    finite(interval?.minY, 'minY'); finite(interval?.maxY, 'maxY');
    if (interval.minY > interval.maxY) throw new RangeError('Vertical interval is reversed');
  }
  return a.maxY >= b.minY && b.maxY >= a.minY;
}

export function createSupportWorld({ sampleTerrain, decks = [], deckSource = null, isCurrent = () => true, transitionTolerance = .08, contactTolerance = .02 }) {
  if (typeof sampleTerrain !== 'function') throw new TypeError('A terrain sampler is required');
  if(typeof isCurrent!=='function')throw new TypeError('A support generation guard must be a function');
  if(deckSource&&(typeof deckSource.near!=='function'||typeof deckSource.resolve!=='function'))throw new TypeError('A bounded support source requires near and resolve');
  if (!Array.isArray(decks) || decks.length > MAX_LOCAL_SUPPORTS) throw new RangeError('Too many local support descriptors');
  for (const v of [transitionTolerance, contactTolerance]) {
    finite(v, 'tolerance'); if (v < 0) throw new RangeError('Tolerance cannot be negative');
  }
  const byId = new Map(),normalized=new WeakMap();
  function descriptor(d) {
    if (!d||typeof d.id !== 'string' || !d.id || d.id === TERRAIN_SUPPORT) throw new TypeError('Support ID must be unique');
    if(normalized.has(d))return normalized.get(d);
    if (!Array.isArray(d.approaches) || d.approaches.length > 8) throw new TypeError('At most eight explicit approaches are required');
    const result = Object.freeze({ id: d.id, height: finite(d.height, 'deck height'), bounds: bounds(d.bounds),
      approaches: Object.freeze(d.approaches.map(bounds)) });
    normalized.set(d,result);return result;
  }
  const descriptors = Object.freeze(decks.map(d => {
    const result=descriptor(d);if(byId.has(result.id))throw new TypeError('Support ID must be unique');byId.set(result.id,result);return result;
  }));
  function resolve(id) {
    if(byId.has(id))return byId.get(id);
    const value=deckSource?.resolve(id);
    if(!value)return null;
    const d=descriptor(value);if(d.id!==id)throw new TypeError('Resolved support identity mismatch');return d;
  }
  function nearby(x,z) {
    if(!deckSource)return ordered;
    const values=deckSource.near(x,z);
    if(!Array.isArray(values)||values.length+decks.length>MAX_LOCAL_SUPPORTS)throw new RangeError('Too many local support descriptors');
    const result=[...ordered],ids=new Set(result.map(d=>d.id));
    for(const value of values){const d=descriptor(value);if(ids.has(d.id))throw new TypeError('Duplicate nearby support');ids.add(d.id);const current=resolve(d.id);if(current)result.push(current);}
    return result.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  }
  const scratch = {};
  function ground(x, z, out) {
    out.surfaceClass = 'grass';out.blockedReason=null;
    sampleTerrain(x, z, out);
    finite(out.height, 'terrain height'); finite(out.dx, 'terrain dx'); finite(out.dz, 'terrain dz');
    const length = Math.hypot(out.dx, 1, out.dz);
    out.nx = -out.dx / length; out.ny = 1 / length; out.nz = -out.dz / length; out.grade = Math.hypot(out.dx, out.dz);
    out.valid = true; out.reason = null; out.surfaceId = TERRAIN_SUPPORT; out.geometryId = TERRAIN_SUPPORT;
    out.traversable = out.traversable !== false;
    return out;
  }
  function blocked(out, id, reason) {
    out.valid = false; out.traversable = false; out.reason = reason;out.blockedReason=reason;
    out.surfaceId = id; out.geometryId = null; out.height = null;
    out.dx = out.dz = out.grade = 0; out.nx = out.nz = 0; out.ny = 1;
    return out;
  }
  function deckSample(d, out) {
    out.valid = out.traversable = true; out.reason = null;out.blockedReason=null;
    out.surfaceId = out.geometryId = d.id; out.height = d.height;
    out.dx = out.dz = out.grade = 0; out.nx = out.nz = 0; out.ny = 1;
    out.surfaceClass = 'bridge'; return out;
  }
  function sampleSelected(x, z, surfaceId, out = {}) {
    finite(x, 'x'); finite(z, 'z');
    if(!isCurrent())return blocked(out,surfaceId,'world-changed');
    if (surfaceId === TERRAIN_SUPPORT) return ground(x, z, out);
    const d = resolve(surfaceId);
    if (!d) return blocked(out, surfaceId, 'missing-support');
    if (contains(d.bounds, x, z)) return deckSample(d, out);
    // A wheel can straddle an endpoint, but only where real terrain agrees.
    if (d.approaches.some(g => contains(g, x, z))) {
      ground(x, z, out);
      if (out.traversable && Math.abs(out.height - d.height) <= contactTolerance) {
        out.surfaceId = d.id; return out;
      }
    }
    return blocked(out, d.id, 'closed-edge');
  }
  function propose(x, z, state, out = {}) {
    finite(x, 'x'); finite(z, 'z'); finite(state?.x, 'previous x'); finite(state?.z, 'previous z'); finite(state?.height, 'previous height');
    if(!isCurrent())return blocked(out,state.surfaceId,'world-changed');
    if (state.surfaceId !== TERRAIN_SUPPORT) {
      const d = resolve(state.surfaceId);
      if (!d) return blocked(out, state.surfaceId, 'missing-support');
      if (contains(d.bounds, x, z)) return deckSample(d, out);
      const exit = d.approaches.some(g => contains(g, state.x, state.z) && contains(g, x, z));
      if (exit) {
        ground(x, z, out);
        if (out.traversable && Math.abs(out.height - d.height) <= contactTolerance) return out;
      }
      return blocked(out, d.id, 'closed-edge');
    }
    // Stable ID order makes overlapping approach candidates independent of input order.
    for (const d of nearby(x,z)) {
      if (!contains(d.bounds, x, z) || Math.abs(state.height - d.height) > transitionTolerance) continue;
      if (!d.approaches.some(g => contains(g, state.x, state.z) && contains(g, x, z))) continue;
      ground(state.x, state.z, scratch);
      if (scratch.traversable && Math.abs(scratch.height - d.height) <= contactTolerance) return deckSample(d, out);
    }
    return ground(x, z, out);
  }
  const ordered = [...descriptors].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return Object.freeze({ descriptors, sampleSelected, propose });
}

// One binding per mover. Its bound sampler is safe for prospective wheel/camera reads.
export function createSupportBinding(world, initial, { footprint = [], sweepStep = .5, turnStep = .04, maxSweepSteps = 128, allowSteepTerrain = false } = {}) {
  if (!Array.isArray(footprint) || footprint.length > 512) throw new RangeError('Invalid support footprint');
  for (const v of [sweepStep, turnStep]) if (finite(v, 'sweep step') <= 0) throw new RangeError('Sweep step must be positive');
  if (!Number.isInteger(maxSweepSteps) || maxSweepSteps < 1 || maxSweepSteps > 1024) throw new RangeError('Invalid sweep limit');
  // Grade limits still protect route/placement admission. Vehicle support only
  // refuses actual missing ground, water and closed deck edges.
  const drivingSample=p=>{if(allowSteepTerrain&&p.valid&&p.geometryId===TERRAIN_SUPPORT&&p.blockedReason==='grade'){p.traversable=true;p.blockedReason=null;}return p;};
  const contacts = footprint.map(p => Object.freeze({ x: finite(p.x, 'contact x'), z: finite(p.z, 'contact z') }));
  const state = { x: 0, z: 0, height: 0, heading: 0, surfaceId: TERRAIN_SUPPORT };
  const acceptedPlane={dx:0,dz:0};
  const scratch = {}, contact = {}, trial = {};
  const copyState = (to, from) => { to.x = from.x; to.z = from.z; to.height = from.height; to.heading = from.heading; to.surfaceId = from.surfaceId; };
  function footprintValid(x, z, heading, id) {
    const c = Math.cos(heading), s = Math.sin(heading);
    for (const p of contacts) {
      world.sampleSelected(x + p.x * c + p.z * s, z - p.x * s + p.z * c, id, contact);
      drivingSample(contact);
      if (!contact.valid || !contact.traversable) return false;
    }
    return true;
  }
  function propose(x, z, out = {}, heading = state.heading) {
    finite(x, 'x'); finite(z, 'z'); finite(heading, 'heading');
    const delta = headingDelta(state.heading, heading);
    const steps = Math.max(1, Math.ceil(Math.hypot(x - state.x, z - state.z) / sweepStep), Math.ceil(Math.abs(delta) / turnStep));
    if (steps > maxSweepSteps) {
      Object.assign(out, { valid: false, traversable: false, reason: 'sweep-limit', surfaceId: state.surfaceId, height: state.height, heading }); return out;
    }
    copyState(trial, state);
    for (let i = 1; i <= steps; i++) {
      const px = state.x + (x - state.x) * i / steps, pz = state.z + (z - state.z) * i / steps;
      const ph = state.heading + delta * i / steps;
      drivingSample(world.propose(px, pz, trial, out));
      if (!out.valid || !out.traversable) return out;
      if (!footprintValid(px, pz, ph, out.surfaceId)) {
        out.valid = false; out.traversable = false; out.reason = 'unsupported-footprint'; return out;
      }
      trial.x = px; trial.z = pz; trial.height = out.height; trial.surfaceId = out.surfaceId;
    }
    out.heading = heading; return out;
  }
  function reset({ x, z, surfaceId = TERRAIN_SUPPORT, heading = 0 }) {
    finite(heading, 'heading');
    drivingSample(world.sampleSelected(x, z, surfaceId, scratch));
    if (!scratch.valid || !scratch.traversable || !footprintValid(x, z, heading, surfaceId)) throw new RangeError(`Cannot acquire support: ${scratch.reason || 'unsupported-footprint'}`);
    state.x = x; state.z = z; state.height = scratch.height; state.surfaceId = surfaceId; state.heading = heading;
    acceptedPlane.dx=scratch.dx;acceptedPlane.dz=scratch.dz;
  }
  function accept(x,z,proposal,heading){
    state.x=x;state.z=z;state.height=proposal.height;state.surfaceId=proposal.surfaceId;state.heading=heading;
    acceptedPlane.dx=proposal.dx;acceptedPlane.dz=proposal.dz;
  }
  function commit(x, z, proposal, heading = proposal.heading ?? state.heading) {
    finite(x, 'x'); finite(z, 'z');
    if (!proposal?.valid || !proposal.traversable) throw new RangeError('Cannot commit blocked support');
    propose(x, z, scratch, heading);
    if (!scratch.valid || scratch.surfaceId !== proposal.surfaceId || scratch.height !== proposal.height) throw new RangeError('Stale support proposal');
    accept(x,z,scratch,heading);
  }
  function move(x,z,out={},heading=state.heading){
    // Proposal and acceptance are synchronous here, with no external mutation
    // window. Keep commit's revalidation for callers that hold a proposal.
    const proposal=propose(x,z,out,heading);
    if(proposal.valid&&proposal.traversable)accept(x,z,proposal,heading);
    return proposal;
  }
  function relocate(pose) {
    try { reset(pose); return true; } catch (error) { if (error instanceof RangeError) return false; throw error; }
  }
  reset(initial);
  return Object.freeze({ reset, relocate, commit, move, allowSteepTerrain, world,
    fork: pose => createSupportBinding(world, pose, { footprint: contacts, sweepStep, turnStep, maxSweepSteps, allowSteepTerrain }),
    sample: (x, z, out = {}) => {
      drivingSample(world.sampleSelected(x,z,state.surfaceId,out));
      if(!out.valid&&['world-changed','missing-support'].includes(out.reason)){
        // Keep the accepted render pose while movement remains explicitly
        // blocked. A disappearing deck/world never becomes a fall to Y=0.
        out.height=state.height+acceptedPlane.dx*(x-state.x)+acceptedPlane.dz*(z-state.z);out.dx=acceptedPlane.dx;out.dz=acceptedPlane.dz;
      }
      return out;
    },
    propose,
    snapshot: () => ({ ...state }) });
}
