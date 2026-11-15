// The all-time record of delivered passengers. Small, versioned and
// storage-tolerant: a missing or corrupt record reads as an empty log, and a
// storage failure never interrupts play. Bubble upgrades read the totals.
const KEY = 'zerble.questLog';
const VERSION = 1;
const RECENT = 20;
const count = (v) => (Number.isSafeInteger(v) && v > 0 ? v : 0);

function empty() { return { v: VERSION, total: 0, smiles: 0, byType: {}, byKind: {}, recent: [] }; }

export function createQuestLog(storage = null, now = () => Date.now()) {
  let state = empty(), storageOK = !!storage;
  try {
    const parsed = JSON.parse(storage?.getItem(KEY) || 'null');
    if (parsed && parsed.v === VERSION) {
      state.total = count(parsed.total); state.smiles = count(parsed.smiles);
      for (const field of ['byType', 'byKind']) for (const [k, v] of Object.entries(parsed[field] || {})) if (count(v)) state[field][String(k).slice(0, 32)] = count(v);
      if (Array.isArray(parsed.recent)) state.recent = parsed.recent.filter((r) => r && typeof r.kind === 'string').slice(0, RECENT)
        .map((r) => ({ kind: r.kind.slice(0, 32), type: String(r.type).slice(0, 16), label: String(r.label || '').slice(0, 60), reward: count(r.reward), at: count(r.at) }));
    }
  } catch { state = empty(); storageOK = false; }
  const save = () => { try { if (storage) { storage.setItem(KEY, JSON.stringify(state)); storageOK = true; } } catch { storageOK = false; /* private mode or full: keep playing */ } };
  return {
    record({ type, kind, label, reward }) {
      state.total++; state.smiles += count(reward);
      state.byType[type] = (state.byType[type] || 0) + 1;
      state.byKind[kind] = (state.byKind[kind] || 0) + 1;
      state.recent.unshift({ kind, type, label: String(label || ''), reward: count(reward), at: now() });
      state.recent.length = Math.min(state.recent.length, RECENT);
      save();
      return state.total;
    },
    get storageOK() { return storageOK; },
    get total() { return state.total; },
    countOf(type) { return state.byType[type] || 0; },
    snapshot() { return { total: state.total, smiles: state.smiles, byType: { ...state.byType }, byKind: { ...state.byKind }, recent: state.recent.map((r) => ({ ...r })) }; },
    reset() { state = empty(); save(); },
  };
}
