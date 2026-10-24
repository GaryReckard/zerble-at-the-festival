// Pure camp recipes shared by the model and cluster builders. All distances
// are native model units except footprint and neighborhood coordinates (metres).
export const CAMP_ARCHETYPES = Object.freeze([
  'light-travelers', 'family-base', 'canvas-lodge', 'social-lounge',
]);

const SIZES = Object.freeze({
  small: { radius: 4, footprint: 14, compact: 10, tentRadius: 2.7, count: 1 },
  medium: { radius: 6, footprint: 18, compact: 13, tentRadius: 3.8, count: 2 },
  large: { radius: 8, footprint: 22, compact: 16, tentRadius: 5.1, count: 3 },
});

function random(seed, salt) {
  let state = ((Number(seed) || 0) ^ salt) >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function planCampRecipe(size = 'medium', options = {}) {
  const cfg = SIZES[size] || SIZES.medium;
  const role = ['host', 'satellite'].includes(options.role) ? options.role : 'standalone';
  const rng = random(options.seed, 0x43414d50);
  const aliases = { backpacker: 'light-travelers', family: 'family-base', woodland: 'canvas-lodge', communal: 'social-lounge' };
  const requested = aliases[options.archetype] || options.archetype;
  const archetype = CAMP_ARCHETYPES.includes(requested) ? requested
    : CAMP_ARCHETYPES[Math.floor(rng() * CAMP_ARCHETYPES.length)];
  const compact = role === 'satellite';
  const tightSleeping=compact && size==='small' && options.tightSleeping===true;
  let tentFamilies;
  if (archetype === 'family-base') {
    tentFamilies = size === 'small' ? ['cabin'] : size === 'large' ? ['multiroom', 'dome'] : ['multiroom'];
  } else if (archetype === 'canvas-lodge') {
    tentFamilies = size === 'large' ? ['octagon', 'ridge'] : ['octagon'];
  } else if (archetype === 'social-lounge') {
    tentFamilies = size === 'large' ? ['cabin', 'dome'] : ['cabin'];
  } else {
    tentFamilies = Array.from({ length: cfg.count }, () => rng() < .55 ? 'ridge' : 'dome');
  }
  return {
    archetype, role, tentFamilies, sharedFront: compact, chairLimit:tightSleeping?0:undefined,
    fire: role === 'host' || (!compact && archetype !== 'light-travelers'),
    kitchen: role === 'host' || (!compact && archetype !== 'light-travelers'),
    canopyLimit: compact || (archetype === 'light-travelers' && role !== 'host') ? 0 : size === 'large' ? 2 : 1,
    screenLimit: compact ? 0 : size === 'small' ? 1 : 2,
    torchLimit: compact ? 0 : size === 'large' ? 4 : size === 'medium' ? 3 : 2,
    footprint: tightSleeping ? 7 : compact ? cfg.compact : cfg.footprint,
    layoutRadius: tightSleeping ? 1.3 : compact ? cfg.tentRadius : cfg.radius,
    tentRadius: tightSleeping ? 1.3 : compact ? cfg.tentRadius : cfg.radius * .9 + .5,
    tentArcStep: compact ? (size === 'medium' ? 1.25 : .95) : (size === 'medium' ? .95 : .85),
  };
}

// A shared household has one hearth/kitchen and smaller sleeping pitches.
// Empty reservations deliberately overlap within this household. Each builder
// must validate actual transformed furniture and door approaches before adding
// a candidate; these circles still reserve the whole household against outsiders.
export function planCampNeighborhood(target = 12, options = {}) {
  const envelope = Number.isFinite(options.envelope) ? Math.max(0, options.envelope) : 60;
  const phase = Number.isFinite(options.phase) ? options.phase : 0;
  const rng = random(options.seed, 0x4e454947);
  const busy = target >= 12;
  const count = busy ? 6 : Math.min(5, Math.max(4, Math.ceil(target / 2)));
  const compact = options.density !== 'roomy';
  const hostSize = compact ? 'small' : 'medium';
  const hostRecipe = planCampRecipe(hostSize, { role: 'host', archetype: 'social-lounge', seed: options.seed });
  if (hostRecipe.footprint > envelope) return [];
  const pitches = [{ x: 0, z: 0, size: hostSize, footprint: hostRecipe.footprint,
    facing: phase, role: 'host', archetype: hostRecipe.archetype, recipe: hostRecipe,
    sharedEnvelope: true }];
  // Two uneven fans share the host's side clearings, while its front remains
  // an approach. Wide angle/radius variation avoids concentric campsite rings.
  const fans = count === 4 ? [-2.55, -.95, .85, 2.4]
    : count === 5 ? [-2.65, -1.55, -.65, 1.05, 2.5]
    : [-2.7, -1.7, -.7, .85, 1.8, 2.75];
  const frontAngle = Math.PI / 2 - phase;
  const fanLean = (rng() - .5) * .24;
  for (let i = 0; i < count; i++) {
    const size = busy && i % 3 !== 0 ? 'medium' : 'small';
    const archetype = CAMP_ARCHETYPES[(i + Math.floor(rng() * 2)) % CAMP_ARCHETYPES.length];
    const recipe = planCampRecipe(size, { role: 'satellite', archetype, seed: Math.floor(rng() * 0x100000000) });
    const minimum = (compact ? 16.5 : 24) + (size === 'medium' ? 1.5 : 0);
    const maximum = envelope - recipe.footprint - .1;
    if (minimum > maximum) continue;
    for (let attempt = 0; attempt < 24; attempt++) {
      const angle = frontAngle + fans[i] + fanLean + (rng() - .5) * .3;
      const radius = minimum + rng() * Math.min(compact ? 4.5 : 6, maximum - minimum);
      const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
      if (pitches.slice(1).some(p => Math.hypot(x - p.x, z - p.z) < (recipe.footprint + p.footprint) * .48 + 1.2)) continue;
      const ux = x / radius, uz = z / radius;
      const side = Math.sin(fans[i]) > 0 ? -1 : 1;
      const sideReach = compact ? 5.5 : 8;
      const access = { width: 2,
        from: { x: x - ux * recipe.layoutRadius * 1.3, z: z - uz * recipe.layoutRadius * 1.3 },
        to: { x: Math.cos(phase) * side * sideReach, z: -Math.sin(phase) * side * sideReach } };
      // Outward alternatives let the real geometry validator resolve a large
      // shelter or chair collision without dropping the household member.
      const alternatives = [0, 1.5, 3, 4.5].filter(offset => radius + offset <= maximum).map(offset => ({
        x: x + ux * offset, z: z + uz * offset, facing: Math.atan2(-x, -z),
      }));
      pitches.push({ x, z, size, footprint: recipe.footprint, facing: Math.atan2(-x, -z),
        role: 'satellite', archetype, recipe, access, alternatives, sharedEnvelope: true });
      break;
    }
  }
  return pitches;
}
