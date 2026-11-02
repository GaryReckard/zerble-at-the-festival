// Pure assembly accounting. The caller owns engine/render mutations and rolls
// back this reservation if activation fails; this module owns no scheduler.
export const ADMISSION_DIMENSIONS = Object.freeze(['bodies', 'colliders', 'joints', 'renderSlots', 'events']);
const empty = () => Object.fromEntries(ADMISSION_DIMENSIONS.map(dimension => [dimension, 0]));
const own = (value, name) => Object.prototype.hasOwnProperty.call(value, name);

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new TypeError(`${name} must be a resource-count object`);
  }
  return value;
}

function integer(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${name} must be a nonnegative safe integer`);
  return value;
}

function quantities(value, name, required = false) {
  object(value, name);
  for (const dimension of Reflect.ownKeys(value)) {
    if (!ADMISSION_DIMENSIONS.includes(dimension)) throw new TypeError(`Unknown ${name} dimension: ${String(dimension)}`);
  }
  const result = empty();
  for (const dimension of ADMISSION_DIMENSIONS) {
    if (required && !own(value, dimension)) throw new TypeError(`Missing ${name}.${dimension}`);
    if (own(value, dimension)) result[dimension] = integer(value[dimension], `${name}.${dimension}`);
  }
  return result;
}

function sections(value) {
  object(value, 'assembly');
  for (const key of Reflect.ownKeys(value)) {
    if (!['resident', 'release'].includes(key)) throw new TypeError(`Unknown assembly section: ${String(key)}`);
  }
  return {
    resident: own(value, 'resident') ? quantities(value.resident, 'resident') : undefined,
    release: own(value, 'release') ? quantities(value.release, 'release') : undefined,
  };
}

export class AdmissionBudget {
  #capacities;
  #maxRecords;
  #records = new Map();
  #resident = empty();
  #reserved = empty();
  #generation = 0;

  constructor({ capacities, maxRecords = 64 } = {}) {
    this.#capacities = quantities(capacities, 'capacities', true);
    this.#maxRecords = integer(maxRecords, 'maxRecords');
  }

  #resolve(token) {
    if (!token || typeof token.key !== 'string' || !Number.isSafeInteger(token.generation)) return null;
    const entry = this.#records.get(token.key);
    return entry?.generation === token.generation ? entry : null;
  }

  #fits(resident, release, previous) {
    for (const dimension of ADMISSION_DIMENSIONS) {
      // Subtract first so even MAX_SAFE_INTEGER capacities cannot overflow
      // while adding the proposed resident and reserved resource counts.
      const available = this.#capacities[dimension]
        - (this.#resident[dimension] - (previous?.resident[dimension] ?? 0))
        - (this.#reserved[dimension] - (previous?.release[dimension] ?? 0));
      if (resident[dimension] > available || release[dimension] > available - resident[dimension]) return dimension;
    }
    return null;
  }

  #replace(entry, resident, release) {
    for (const dimension of ADMISSION_DIMENSIONS) {
      this.#resident[dimension] = this.#resident[dimension] - entry.resident[dimension] + resident[dimension];
      this.#reserved[dimension] = this.#reserved[dimension] - entry.release[dimension] + release[dimension];
    }
    entry.resident = resident; entry.release = release;
  }

  reserve(key, value = {}) {
    if (typeof key !== 'string' || !key) throw new TypeError('Assembly key must be a nonempty string');
    const parsed = sections(value), resident = parsed.resident ?? empty(), release = parsed.release ?? empty();
    if (this.#records.has(key)) return { ok: false, reason: 'duplicate-key' };
    if (this.#records.size === this.#maxRecords) return { ok: false, reason: 'record-capacity' };
    const dimension = this.#fits(resident, release);
    if (dimension) return { ok: false, reason: 'capacity', dimension };
    if (this.#generation === Number.MAX_SAFE_INTEGER) return { ok: false, reason: 'generation-exhausted' };
    const generation = ++this.#generation;
    const entry = { generation, resident: empty(), release: empty() };
    this.#replace(entry, resident, release); this.#records.set(key, entry);
    return { ok: true, token: { key, generation } };
  }

  // Provided sections replace that section in full; omitted sections keep
  // their current counts. Consumed release resources are already resident.
  update(token, value = {}) {
    const parsed = sections(value), entry = this.#resolve(token);
    if (!entry) return { ok: false, reason: 'stale-token' };
    const resident = parsed.resident ?? { ...entry.resident }, release = parsed.release ?? { ...entry.release };
    const dimension = this.#fits(resident, release, entry);
    if (dimension) return { ok: false, reason: 'capacity', dimension };
    this.#replace(entry, resident, release);
    return { ok: true };
  }

  consume(token, value) {
    const cost = quantities(value, 'cost'), entry = this.#resolve(token);
    if (!entry) return { ok: false, reason: 'stale-token' };
    for (const dimension of ADMISSION_DIMENSIONS) {
      if (cost[dimension] > entry.release[dimension]) return { ok: false, reason: 'insufficient-reservation', dimension };
    }
    const resident = empty(), release = empty();
    for (const dimension of ADMISSION_DIMENSIONS) {
      resident[dimension] = entry.resident[dimension] + cost[dimension];
      release[dimension] = entry.release[dimension] - cost[dimension];
    }
    this.#replace(entry, resident, release);
    return { ok: true };
  }

  releaseResident(token, value) {
    const cost = quantities(value, 'cost'), entry = this.#resolve(token);
    if (!entry) return { ok: false, reason: 'stale-token' };
    for (const dimension of ADMISSION_DIMENSIONS) {
      if (cost[dimension] > entry.resident[dimension]) return { ok: false, reason: 'insufficient-resident', dimension };
    }
    const resident = empty();
    for (const dimension of ADMISSION_DIMENSIONS) resident[dimension] = entry.resident[dimension] - cost[dimension];
    this.#replace(entry, resident, { ...entry.release });
    return { ok: true };
  }

  release(token) {
    const entry = this.#resolve(token);
    if (!entry) return { ok: false, reason: 'stale-token' };
    this.#replace(entry, empty(), empty()); this.#records.delete(token.key);
    return { ok: true };
  }

  read(token) {
    const entry = this.#resolve(token);
    return entry ? { token: { key: token.key, generation: entry.generation }, resident: { ...entry.resident }, release: { ...entry.release } } : null;
  }

  report() {
    const available = empty();
    for (const dimension of ADMISSION_DIMENSIONS) available[dimension] = this.#capacities[dimension] - this.#resident[dimension] - this.#reserved[dimension];
    return { capacities: { ...this.#capacities }, resident: { ...this.#resident }, reserved: { ...this.#reserved }, available,
      records: this.#records.size, maxRecords: this.#maxRecords };
  }
}
