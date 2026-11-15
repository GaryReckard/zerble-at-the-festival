// Opt-in synchronous attribution. Wrappers are installed only for detailed
// captures; ordinary gameplay keeps the original methods and reads no clocks.
export const FRAME_SECTIONS = Object.freeze(['physics','people','registry','scans','collisions','bubbles','camera','lights','adaptive','hud','world','render','matrices','other']);

export function createFrameAttribution(now = () => performance.now()) {
  const parts = Object.fromEntries(FRAME_SECTIONS.map(key => [key, 0]));
  const calls = Object.fromEntries(FRAME_SECTIONS.map(key => [key, 0]));
  const restorers = [];
  let active = null, last = 0, recording = false, reads = 0;
  const clock = () => { reads++; return now(); };
  const enter = key => {
    const time = clock(), previous = active;
    parts[active] += Math.max(0, time - last);
    active = key; last = time; calls[key]++;
    return previous;
  };
  const leave = previous => {
    const time = clock();
    parts[active] += Math.max(0, time - last);
    active = previous; last = time;
  };
  return {
    parts, calls,
    begin(start) {
      if (recording) throw new Error('A capture frame is already recording');
      for (const key of FRAME_SECTIONS) { parts[key] = 0; calls[key] = 0; }
      active = 'other'; last = start; reads = 0; recording = true;
    },
    enter(key) { return recording ? enter(key) : null; },
    leave(previous) { if (recording) leave(previous); },
    finish(end) {
      if (recording) parts[active] += Math.max(0, end - last);
      recording = false; active = null;
    },
    watch(owner, method, key) {
      if (!FRAME_SECTIONS.includes(key) || typeof owner?.[method] !== 'function') throw new TypeError('Invalid capture timing hook');
      const original = owner[method], own = Object.hasOwn(owner, method);
      function measured() {
        if (!recording) return original.apply(this, arguments);
        const previous = enter(key);
        try { return original.apply(this, arguments); }
        finally { if (recording) leave(previous); }
      }
      owner[method] = measured;
      restorers.push(() => { if (owner[method] === measured) { if (own) owner[method] = original; else delete owner[method]; } });
    },
    dispose() { recording = false; for (const restore of restorers.splice(0).reverse()) restore(); },
    get clockReads() { return reads; },
  };
}
