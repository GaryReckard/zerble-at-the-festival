const finite = (value, name) => {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return Object.is(value, -0) ? '0' : String(value);
};

const text = (value, name) => {
  if (typeof value !== 'string' || value.length === 0)
    throw new TypeError(`${name} must be a non-empty string`);
  return value;
};

function field(value) {
  return `${value.length}:${value}`;
}

// Stable procedural identity. Length-prefixed fields avoid ambiguity without
// relying on runtime insertion IDs or a collision-prone short hash.
export function createPhysicalPropKey({ worldSeed, worldgenEpoch, originOwner, origin, localKey }) {
  if (!Number.isSafeInteger(worldSeed) || worldSeed < 0)
    throw new TypeError('worldSeed must be a non-negative safe integer');
  if (!Number.isSafeInteger(worldgenEpoch) || worldgenEpoch < 0)
    throw new TypeError('worldgenEpoch must be a non-negative safe integer');
  const owner = text(originOwner, 'originOwner');
  const slot = text(localKey, 'localKey');
  if (!origin || typeof origin !== 'object') throw new TypeError('origin is required');
  const coords = [finite(origin.x, 'origin.x'), finite(origin.y, 'origin.y'), finite(origin.z, 'origin.z')];
  return `camp-prop-v1:${[
    String(worldSeed), String(worldgenEpoch), owner, ...coords, slot,
  ].map(field).join('')}`;
}
