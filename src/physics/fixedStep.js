// Consumes accepted gameplay time; owns no wall clock or scheduler.
export class FixedStepClock {
  constructor({ step = 1 / 60, maxSteps = 5 } = {}) {
    if (!Number.isFinite(step) || step <= 0 || !Number.isInteger(maxSteps) || maxSteps < 1) {
      throw new RangeError('Invalid fixed-step configuration');
    }
    Object.assign(this, { step, maxSteps, remainder: 0, time: 0, dropped: 0, steps: 0 });
  }
  advance(delta, tick) {
    if (!Number.isFinite(delta) || delta < 0) throw new RangeError('Invalid accepted delta');
    const accepted = Math.min(delta, this.step * this.maxSteps);
    this.dropped += delta - accepted;
    this.remainder += accepted;
    let count = 0;
    while (this.remainder + 1e-12 >= this.step && count < this.maxSteps) {
      tick(this.step, this.time + this.step);
      this.time += this.step;
      this.remainder = Math.max(0, this.remainder - this.step);
      this.steps++; count++;
    }
    return count;
  }
  singleStep(tick) {
    tick(this.step, this.time + this.step);
    this.time += this.step; this.steps++; this.remainder = 0;
  }
  reset() { this.remainder = this.time = this.dropped = this.steps = 0; }
  get alpha() { return this.remainder / this.step; }
}
