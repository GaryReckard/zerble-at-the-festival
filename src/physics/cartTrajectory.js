// Reconstruct accepted controller movement at fixed-step boundaries. This owns
// no clock and never reads the interpolated render pose back into simulation.
const axes = ['x', 'y', 'z'];
function copyPose(value) {
  if (!value || !axes.every(axis => Number.isFinite(value.position?.[axis])) ||
      ![...axes, 'w'].every(axis => Number.isFinite(value.rotation?.[axis]))) {
    throw new TypeError('Cart trajectory requires a finite pose');
  }
  const q = value.rotation;
  const length = Math.hypot(q.x, q.y, q.z, q.w);
  if (length < 1e-8) throw new RangeError('Cart rotation cannot be zero');
  return { position: { ...value.position }, rotation: {
    x: q.x / length, y: q.y / length, z: q.z / length, w: q.w / length,
  } };
}
export class CartTrajectory {
  constructor(pose) {
    this.reset(pose);
  }
  reset(pose) {
    const next = copyPose(pose);
    this.start = next;
    this.end = copyPose(next);
    this.time = 0;
    this.duration = 0;
    this.discontinuous = true;
  }
  // time is the accepted frame's start (fixed clock time + its remainder),
  // not performance.now(). Pass discontinuous for rescue/teleport or dropped
  // time. Apply its endpoint with setPose before stepping to avoid a sweep.
  beginFrame(time, duration, pose, { discontinuous = false } = {}) {
    if (!Number.isFinite(time) || time < 0 || !Number.isFinite(duration) || duration < 0) {
      throw new RangeError('Invalid accepted cart interval');
    }
    const next = copyPose(pose);
    if (duration === 0 && !discontinuous) {
      // A paused presentation must not silently move the authoritative cart.
      return false;
    }
    this.start = discontinuous ? copyPose(next) : this.end;
    this.end = next;
    this.time = time;
    this.duration = duration;
    this.discontinuous = discontinuous;
    return true;
  }
  sample(time) {
    if (!Number.isFinite(time)) throw new RangeError('Invalid cart sample time');
    const t = this.duration ? Math.max(0, Math.min(1, (time - this.time) / this.duration)) : 1;
    const position = {};
    for (const axis of axes) position[axis] = this.start.position[axis] + (this.end.position[axis] - this.start.position[axis]) * t;
    const a = this.start.rotation, b = this.end.rotation;
    let dot = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
    const sign = dot < 0 ? -1 : 1;
    dot = Math.min(1, Math.abs(dot));
    const theta = Math.acos(dot), denominator = Math.sin(theta);
    const wa = denominator > 1e-6 ? Math.sin((1 - t) * theta) / denominator : 1 - t;
    const wb = sign * (denominator > 1e-6 ? Math.sin(t * theta) / denominator : t);
    const rotation = {};
    for (const axis of [...axes, 'w']) rotation[axis] = a[axis] * wa + b[axis] * wb;
    return { position, rotation };
  }
}
