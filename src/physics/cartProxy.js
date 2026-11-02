import { CartTrajectory } from './cartTrajectory.js';

const RESET_REASONS = new Set(['teleport', 'rescue', 'restart', 'tier-change', 'legacy-correction', 'dropped-time']);

// Couples accepted controller poses to an already admitted kinematic body.
// The caller owns the clock, controller, body lifetime and overlap query.
export class CartProxy {
  constructor({ adapter, id, pose, isClear }) {
    if (typeof isClear !== 'function') throw new TypeError('Cart proxy needs a clearance query');
    const body = adapter.readBody(id);
    if (body?.type !== 'kinematic') throw new TypeError('Cart proxy requires an admitted kinematic body');
    this.adapter = adapter;
    this.id = id;
    this.isClear = isClear;
    this.trajectory = new CartTrajectory(pose);
    this.ghost = false;
    this.pendingClearance = !body.enabled;
    this.resets = 0;
    this.lastReset = null;
  }

  accept(time, duration, pose, { ghost = this.ghost, resetReason = null } = {}) {
    if (typeof ghost !== 'boolean') throw new TypeError('Ghost mode must be boolean');
    if (resetReason !== null && !RESET_REASONS.has(resetReason)) throw new RangeError('Unknown cart reset reason');
    const transition = ghost !== this.ghost;
    const discontinuous = transition || resetReason !== null;
    // Validate before mutating either the bridge or the engine.
    this.trajectory.beginFrame(time, duration, pose, { discontinuous });
    this.ghost = ghost;
    if (discontinuous) {
      this.adapter.setBodyEnabled(this.id, false);
      this.adapter.setPose(this.id, this.trajectory.end);
      this.adapter.setVelocity(this.id);
      this.pendingClearance = true;
      this.resets++;
      this.lastReset = resetReason || (ghost ? 'ghost-enter' : 'ghost-exit');
    }
  }

  beforeStep(time) {
    const pose = this.trajectory.sample(time);
    if (this.ghost || this.pendingClearance) {
      // A disabled body does not consume a kinematic target. Move it directly
      // and clear the old target so reenabling cannot replay ghost travel.
      this.adapter.setPose(this.id, pose);
      this.adapter.setVelocity(this.id);
      if (!this.ghost && this.isClear(pose) === true) {
        this.adapter.setBodyEnabled(this.id, true);
        this.pendingClearance = false;
      }
    } else {
      this.adapter.setKinematicTarget(this.id, pose);
    }
  }

  state() {
    return { ghost: this.ghost, pendingClearance: this.pendingClearance,
      resets: this.resets, lastReset: this.lastReset };
  }
}
