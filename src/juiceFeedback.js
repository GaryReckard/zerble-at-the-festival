// Remind only on a fresh bubble-action press, never on a held key or a timer.
export class DryJuiceReminder {
  constructor(juice = 1) {
    this.empty = juice <= 0.02;
    this.held = false;
    this.cooldown = 0;
  }
  update(dt, juice, pressed) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    const empty = juice <= 0.02;
    const depleted = empty && !this.empty;
    const remind = empty && !depleted && pressed && !this.held && this.cooldown <= 0;
    if (depleted || remind) this.cooldown = 2.5;
    if (!empty) this.cooldown = 0;
    this.empty = empty;
    this.held = pressed;
    return remind;
  }
}
