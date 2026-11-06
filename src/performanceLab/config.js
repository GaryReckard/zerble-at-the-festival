// Read once before title startup; ordinary play has no lab state or scheduler.
import {mulberry32} from '../rng.js';
export const PERFORMANCE_LAB = typeof location!=='undefined' &&
  /^(localhost|127\.0\.0\.1)$/.test(location.hostname) &&
  new URLSearchParams(location.search).get('performanceLab')==='1';

// Private construction stream, never a replacement for global Math.random.
// Fresh diagnostic salt "PLCH" is independent of the production world streams.
export const childConstructionSeed=seed=>(seed^0x504c4348)>>>0;
export const childConstructionRandom=seed=>mulberry32(childConstructionSeed(seed));
