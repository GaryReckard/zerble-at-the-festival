const STORAGE_KEY = 'zerble.bubbleUpgrades';
const VERSION = 1;
const SMILE_SAVE_INTERVAL_MS = 10_000;

function emptyState() {
  return { v: VERSION, earned: Object.create(null), disabled: new Set(), lifetimeSmiles: 0 };
}

function nonNegativeInt(value) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function parseState(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return emptyState();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.v !== VERSION) return emptyState();
    const state = emptyState();
    if (parsed.earned && typeof parsed.earned === 'object' && !Array.isArray(parsed.earned)) {
      for (const [id, record] of Object.entries(parsed.earned)) {
        if (!id || !record || typeof record !== 'object' || Array.isArray(record)) continue;
        state.earned[id] = {
          at: typeof record.at === 'string' ? record.at : '',
          mode: typeof record.mode === 'string' ? record.mode : 'cruisin',
        };
      }
    }
    if (Array.isArray(parsed.disabled)) {
      for (const id of parsed.disabled) if (typeof id === 'string' && state.earned[id]) state.disabled.add(id);
    }
    state.lifetimeSmiles = nonNegativeInt(parsed.lifetimeSmiles);
    return state;
  } catch {
    return emptyState();
  }
}

export function createBubbleProgress(storage, opts = {}) {
  const adapter = storage && typeof storage.get === 'function' && typeof storage.set === 'function'
    ? storage
    : { get: () => null, set: () => {} };
  const now = typeof opts.now === 'function' ? opts.now : () => Date.now();
  let state;
  try { state = parseState(adapter.get(STORAGE_KEY)); } catch { state = emptyState(); }
  let lastSmileSaveAt = now();
  const listeners = new Set();

  function serialize() {
    const earned = {};
    for (const [id, record] of Object.entries(state.earned)) earned[id] = { at: record.at, mode: record.mode };
    return JSON.stringify({
      v: VERSION,
      earned,
      disabled: Array.from(state.disabled),
      lifetimeSmiles: state.lifetimeSmiles,
    });
  }

  function save() {
    try { adapter.set(STORAGE_KEY, serialize()); return true; } catch { return false; }
  }

  return {
    unlock(id, mode = 'cruisin') {
      if (typeof id !== 'string' || !id) return false;
      if (state.earned[id]) return false;
      const record = { id, mode: typeof mode === 'string' ? mode : 'cruisin', at: new Date(now()).toISOString() };
      state.earned[id] = { at: record.at, mode: record.mode };
      state.disabled.delete(id);
      save();
      for (const listener of listeners) {
        try { listener(record); } catch { /* a subscriber cannot undo the unlock */ }
      }
      return true;
    },
    setEnabled(id, on) {
      if (!state.earned[id]) return false;
      const enabled = !!on;
      if (enabled) state.disabled.delete(id);
      else state.disabled.add(id);
      save();
      return true;
    },
    onUnlock(callback) {
      if (typeof callback !== 'function') return () => {};
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    earnedIds() { return Object.keys(state.earned); },
    enabledIds() { return Object.keys(state.earned).filter((id) => !state.disabled.has(id)); },
    isEarned(id) { return !!state.earned[id]; },
    isEnabled(id) { return !!state.earned[id] && !state.disabled.has(id); },
    earnedCount() { return Object.keys(state.earned).length; },
    get lifetimeSmiles() { return state.lifetimeSmiles; },
    addLifetimeSmiles(amount) {
      const n = nonNegativeInt(amount);
      if (!n) return state.lifetimeSmiles;
      state.lifetimeSmiles += n;
      const timestamp = now();
      if (timestamp - lastSmileSaveAt >= SMILE_SAVE_INTERVAL_MS) {
        save();
        lastSmileSaveAt = timestamp;
      }
      return state.lifetimeSmiles;
    },
    flush() {
      const saved = save();
      lastSmileSaveAt = now();
      return saved;
    },
    reset() {
      state = emptyState();
      lastSmileSaveAt = now();
      save();
    },
    relock(id) {
      if (!state.earned[id]) return false;
      delete state.earned[id];
      state.disabled.delete(id);
      save();
      return true;
    },
    setLifetimeSmiles(value) {
      state.lifetimeSmiles = nonNegativeInt(value);
      save();
      lastSmileSaveAt = now();
      return state.lifetimeSmiles;
    },
  };
}

export { STORAGE_KEY as BUBBLE_PROGRESS_KEY };
