// Choosing what a boarding rider asks for. Pure: the caller supplies the
// candidates and the random source, so tests can replay any roll.
import { QUEST, DESTINATIONS } from './catalog.js';

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function candidatesInBand(candidates, origin, min, max) {
  const out = [];
  for (const c of candidates) {
    const d = distance(c, origin);
    if (d >= min && d <= max) out.push({ ...c, dist: d });
  }
  return out;
}

// Closer places are somewhat likelier, so a first quest tends to be short
// while long ones still turn up. `activeKinds` damps repeats so three riders
// rarely all want the same sort of place.
export function pickWeighted(inBand, random = Math.random, activeKinds = []) {
  let total = 0;
  const weights = inBand.map((c) => {
    const info = DESTINATIONS[c.kind];
    const w = (c.weight ?? info?.weight ?? 0) * (activeKinds.includes(c.kind) ? 0.3 : 1) / (c.dist + 80);
    total += w;
    return w;
  });
  if (!(total > 0)) return null;
  let roll = random() * total;
  for (let i = 0; i < inBand.length; i++) {
    roll -= weights[i];
    if (roll <= 0 && weights[i] > 0) return inBand[i];
  }
  return inBand.findLast((c, i) => weights[i] > 0) || null;
}

// Decide the kind of request and its destination, or null for a plain rider.
// Candidates carry { kind, x, z, radius?, weight? }. Potties and summits are
// only ever chosen through their own rolls.
export function planOffer(candidates, origin, { random = Math.random, activeKinds = [], allowUrgent = true, allowSummit = true, force = null } = {}) {
  const potties = candidatesInBand(candidates.filter((c) => c.kind === 'porta_potty'), origin, QUEST.URGENT_MIN, QUEST.URGENT_MAX);
  const summits = candidatesInBand(candidates.filter((c) => c.kind === 'mountaintop'), origin, QUEST.SUMMIT_MIN, QUEST.SUMMIT_MAX);
  const urgent = () => (potties.length ? { type: 'urgent', dest: potties.reduce((a, b) => (a.dist <= b.dist ? a : b)) } : null);
  const summit = () => (summits.length ? { type: 'summit', dest: summits.reduce((a, b) => (a.dist <= b.dist ? a : b)) } : null);
  if (force === 'urgent') return urgent();
  if (force === 'summit') return summit();
  if (!force) {
    if (allowUrgent && potties.length && random() < QUEST.URGENT_CHANCE) return urgent();
    if (allowSummit && summits.length && random() < QUEST.SUMMIT_CHANCE) return summit();
  }
  const ordinary = candidates.filter((c) => c.kind !== 'porta_potty' && c.kind !== 'mountaintop' && (!force || c.kind === force));
  const dest = pickWeighted(candidatesInBand(ordinary, origin, QUEST.MIN_DIST, QUEST.MAX_DIST), random, activeKinds);
  return dest ? { type: 'ride', dest } : null;
}
