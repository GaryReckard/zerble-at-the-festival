// Read once before title startup; ordinary play has no lab state or scheduler.
import {mulberry32} from '../rng.js';
export const PERFORMANCE_LAB = typeof location!=='undefined' &&
  /^(localhost|127\.0\.0\.1)$/.test(location.hostname) &&
  new URLSearchParams(location.search).get('performanceLab')==='1';

// Guided device runs require a human start gesture, but no remote driver.
export const DEVICE_AUTOPILOT = typeof location!=='undefined' && (()=>{
  if(PERFORMANCE_LAB)return false;
  const p=new URLSearchParams(location.search);
  return p.get('perfCapture')==='1'&&p.get('perfScenario')==='drive'&&p.get('perfAutopilot')==='road-follow-v1';
})();

// Private construction stream, never a replacement for global Math.random.
// Fresh diagnostic salt "PLCH" is independent of the production world streams.
export const childConstructionSeed=seed=>(seed^0x504c4348)>>>0;
export const childConstructionRandom=seed=>mulberry32(childConstructionSeed(seed));

// A population experiment, never a shipping quality policy. Keep alternate
// original groups rather than respacing four groups or reseeding the world.
export const DEVICE_CHILD_COHORT = DEVICE_AUTOPILOT &&
  new URLSearchParams(location.search).get('perfKids')==='half-v1' ? 'half-v1' : 'full-v1';
