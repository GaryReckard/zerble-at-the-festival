// Pure local progression. Callers decide whether a gameplay observation is eligible.
export const PASSPORT_KEY = 'zerble.passport';
const COUNTERS = ['distance', 'smiles', 'bubbles', 'bonks', 'passengers', 'activeSeconds', 'stages'];
const EVENT_COUNTERS = new Set(['smiles', 'bubbles', 'bonks', 'passengers']);
export const PASSPORT_STAMPS = Object.freeze([
  { id: 'wanderer', name: 'Wanderer', icon: '↗', hint: 'Venture 500 m from the entrance in one visit.' },
  { id: 'there_and_back', name: 'There and Back', icon: '⌂', hint: 'Reach 500 m away, then return within 25 m of the entrance.' },
  { id: 'stage_hopper', name: 'Stage Hopper', icon: '♫', hint: 'Visit three different stages in one visit.' },
  { id: 'night_owl', name: 'Night Owl', icon: '☾', hint: 'Visit a stage after dark.' },
  { id: 'smile_spreader', name: 'Smile Spreader', icon: '☺', hint: 'Collect 1,000 smiles across your visits.' },
  { id: 'bubble_maker', name: 'Bubble Maker', icon: '○', hint: 'Blow 1,000 bubbles across your visits.' },
].map(Object.freeze));
const stampIds = new Set(PASSPORT_STAMPS.map(s => s.id));
const number = n => Number.isFinite(n) && n >= 0 ? Math.min(n, Number.MAX_SAFE_INTEGER) : 0;
const counters = source => Object.fromEntries(COUNTERS.map(k => [k,
  ['distance', 'activeSeconds'].includes(k) ? number(source?.[k]) : Math.floor(number(source?.[k]))]));
const coordinates = (x, z) => Number.isFinite(x) && Number.isFinite(z) && Math.abs(x) <= 1e7 && Math.abs(z) <= 1e7;
const point = p => coordinates(p?.x, p?.z);
const stageKey = key => typeof key === 'string' && /^-?\d+:-?\d+,-?\d+$/.test(key);
const stageSet = keys => new Set(Array.isArray(keys) ? keys.filter(stageKey) : []);
const round = n => Math.round(n * 1000) / 1000;

export function createPlayerStats(storage = {}, { legacySmiles = 0, now = () => Date.now(), onStamp = () => {} } = {}) {
  let saved;
  let storageOK = true;
  try { saved = JSON.parse(storage.get?.(PASSPORT_KEY) || 'null'); } catch { storageOK = false; }
  const valid = saved?.v === 1 && saved?.migrated === true && saved?.totals && typeof saved.totals === 'object';
  const totals = counters(valid ? saved.totals : null);
  if (!valid) totals.smiles = Math.floor(number(legacySmiles));
  const stages = stageSet(valid ? saved.stageKeys : null);
  totals.stages = stages.size;
  let farthest = valid ? number(saved.farthest) : 0;
  const stamps = Object.create(null);
  if (valid && saved.stamps && typeof saved.stamps === 'object') {
    for (const [id, at] of Object.entries(saved.stamps)) {
      if (stampIds.has(id) && typeof at === 'string' && Number.isFinite(Date.parse(at))) stamps[id] = at;
    }
  }
  let visit = counters(), visitStages = new Set(), origin = null, last = null;
  let currentDistance = 0, visitFarthest = 0, explorationEligible = true, started = false;
  let seed = 0, mode = 'cruisin', visitId = '', pending = counters(), reportAge = 0, saveAge = 0;

  function flush() {
    try {
      if (typeof storage.set !== 'function') throw new Error('Storage unavailable');
      storage.set(PASSPORT_KEY, JSON.stringify({ v: 1, migrated: true, totals, farthest, stageKeys: [...stages], stamps }));
      storageOK = true;
    } catch { storageOK = false; }
    return storageOK;
  }
  // Migration and its marker share one save; a failed write is never re-imported in memory.
  if (!valid) flush();

  function add(key, n) {
    n = number(n);
    visit[key] += n; totals[key] += n; pending[key] += n;
  }
  function earn(id) {
    if (stamps[id]) return;
    stamps[id] = new Date(now()).toISOString();
    flush();
    try { onStamp(id); } catch { /* observers cannot undo an achievement */ }
  }

  return {
    start({ entrance, position = entrance, worldSeed = 0, gameMode = 'cruisin', id = String(now()), resume = null } = {}) {
      if (!point(entrance) || !point(position)) return false;
      seed = Number.isInteger(worldSeed) ? worldSeed : 0;
      mode = gameMode === 'festival' ? 'festival' : 'cruisin';
      const restore = resume?.v === 1 && resume.seed === seed && point(resume.origin) && resume.visit && typeof resume.visit === 'object';
      const proposedId = restore ? resume.id : id;
      visitId = typeof proposedId === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(proposedId) ? proposedId : String(now());
      origin = { ...(restore ? resume.origin : entrance) };
      visit = counters(restore ? resume.visit : null);
      visitStages = stageSet(restore ? resume.stageKeys : null);
      visit.stages = visitStages.size;
      visitFarthest = restore ? number(resume.farthest) : 0;
      explorationEligible = restore ? resume.explorationEligible === true : Math.hypot(position.x - origin.x, position.z - origin.z) < 2;
      currentDistance = Math.hypot(position.x - origin.x, position.z - origin.z);
      last = { x: position.x, z: position.z };
      pending = counters(); reportAge = 0; saveAge = 0; started = true;
      return true;
    },
    move(dt, fromX, fromZ, toX, toZ) {
      if (!started || !Number.isFinite(dt) || dt <= 0 || dt > 1 || !coordinates(fromX, fromZ) || !coordinates(toX, toZ)) return;
      if (last && Math.hypot(fromX - last.x, fromZ - last.z) > 2) explorationEligible = false;
      const distance = Math.hypot(toX - fromX, toZ - fromZ);
      // Also reject a relocation performed inside a future physics implementation.
      if (distance > 100 * dt + 1) explorationEligible = false;
      else add('distance', distance);
      last.x = toX; last.z = toZ;
      currentDistance = Math.hypot(toX - origin.x, toZ - origin.z);
      if (explorationEligible) {
        visitFarthest = Math.max(visitFarthest, currentDistance);
        farthest = Math.max(farthest, visitFarthest);
        if (visitFarthest >= 500) earn('wanderer');
        if (visitFarthest >= 500 && currentDistance <= 25) earn('there_and_back');
      }
      add('activeSeconds', dt);
      reportAge += dt; saveAge += dt;
      if (saveAge >= 10) { saveAge = 0; flush(); }
    },
    record(key, count = 1) {
      if (!started || !EVENT_COUNTERS.has(key) || !Number.isFinite(count) || count <= 0) return;
      count = Math.floor(count);
      if (!count) return;
      add(key, count);
      if (key === 'smiles' && totals.smiles >= 1000) earn('smile_spreader');
      if (key === 'bubbles' && totals.bubbles >= 1000) earn('bubble_maker');
    },
    stage(x, z, nightness = 0) {
      if (!started || !explorationEligible || !coordinates(x, z)) return;
      const key = `${seed}:${Math.round(x)},${Math.round(z)}`;
      if (!visitStages.has(key)) { visitStages.add(key); visit.stages++; pending.stages++; }
      if (!stages.has(key)) { stages.add(key); totals.stages++; }
      if (visit.stages >= 3) earn('stage_hopper');
      if (nightness > 0.5) earn('night_owl');
    },
    relocate() { if (started) explorationEligible = false; },
    takeReport(reason = 'interval') {
      if (!started || (reason === 'interval' && reportAge < 60)) return null;
      if (!COUNTERS.some(k => pending[k] > 0)) return null;
      const report = {
        mode, reason, visit_id: visitId, active_s_delta: round(pending.activeSeconds), distance_m_delta: round(pending.distance),
        smiles_delta: pending.smiles, bubbles_delta: pending.bubbles, bonks_delta: pending.bonks,
        passengers_delta: pending.passengers, stages_delta: pending.stages,
        current_distance_m: round(currentDistance), max_distance_m: round(visitFarthest),
        exploration_eligible: explorationEligible,
      };
      pending = counters(); reportAge = 0;
      return report;
    },
    snapshot() {
      return { started, mode, visitId, visit: { ...visit, farthest: visitFarthest, currentDistance },
        allTime: { ...totals, farthest }, stamps: { ...stamps }, storageOK, explorationEligible };
    },
    serializeVisit() {
      return started ? { v: 1, seed, id: visitId, origin: { ...origin }, visit: { ...visit }, farthest: visitFarthest,
        explorationEligible, stageKeys: [...visitStages] } : null;
    },
    flush,
  };
}
