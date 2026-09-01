// Shared pedestrian steering — used by BOTH the crowd (crowd.js, instanced
// NPCs) and the kid gaggles (obstacles.js, individually-modelled). The two
// systems render and spawn differently, but the *behaviour math* is the same;
// keeping it here means a tweak ("dodge a bit earlier", "honk hits harder")
// lands for everyone at once instead of needing a copy per system.
//
// Pure math: no THREE objects, no per-call allocation (direction helpers write
// into a caller-owned `out`). Coordinate convention throughout: `toAgent*` is
// the vector FROM the cart TO the pedestrian (agent.pos - cart.pos), NOT
// normalized; `fwd*` is the cart's unit heading (zerble.forwardWorld).

export const DODGE = {
  MIN_SPEED: 4,    // m/s; below this the cart's cruising to interact — nobody scatters
  REACT_BASE: 5,   // look-ahead (m) at the speed floor
  REACT_K: 1.0,    // extra look-ahead per m/s of cart speed
  REACT_MAX: 24,   // cap — stays under the crowd's flee-exit range so a fresh dodge can't insta-exit
  CORRIDOR: 3.5,   // half-width (m) of the "you're in my lane" band (cart is ~2.6 wide)
  LOCK: 0.5,       // s a dodge commits before re-evaluating
  // Lane-dodge flee speed scales with the cart's speed, like honks do. At
  // full tilt the polite 1x scramble (~2.1 m/s for a low-energy NPC) couldn't
  // clear the corridor before an 18 m/s cart covered the look-ahead — which
  // is why fleeing contact used to be zero-damage. Hits count now ("a hit is
  // a hit"), so the dodge itself has to be winnable: 1.8x at speed makes a
  // clean line through a crowd achievable, and honks (up to 2x) still help.
  URGENCY_MIN: 1.0,
  URGENCY_MAX: 1.8,
};

// Is the agent in the lane of a cart travelling at `speed` along `(fwdX,fwdZ)`?
// Judged by a velocity-scaled CORRIDOR (not a cone): the agent must be ahead
// along the actual travel direction (forward * sign(speed) — so reversing
// doesn't scatter people in front), within a speed-scaled look-ahead, and
// inside the corridor half-width of the heading ray. Returns a boolean.
export function laneDodgeTest(toAgentX, toAgentZ, fwdX, fwdZ, speed) {
  const spd = Math.abs(speed);
  if (spd <= DODGE.MIN_SPEED) return false;
  const reactDist = Math.min(DODGE.REACT_BASE + DODGE.REACT_K * spd, DODGE.REACT_MAX);
  const vDir = speed >= 0 ? 1 : -1;
  const dirX = fwdX * vDir, dirZ = fwdZ * vDir;
  const along = toAgentX * dirX + toAgentZ * dirZ;      // metres ahead along travel
  if (along <= 0.6 || along >= reactDist) return false;
  const perpX = toAgentX - along * dirX;
  const perpZ = toAgentZ - along * dirZ;
  return (perpX * perpX + perpZ * perpZ) < (DODGE.CORRIDOR * DODGE.CORRIDOR);
}

// Unit "step out of the lane" direction: perpendicular to the cart's heading,
// toward whichever side of the line of travel the agent is already on (the
// perpendicular component of the cart->agent vector). When the agent is dead
// centre on the centreline there's no side to pick, so `parityFallback` (a
// stable per-agent bool, e.g. idx & 1) chooses left/right deterministically.
// Uses heading, not travel direction — the perpendicular axis is the same line
// for forward and reverse, so sign doesn't matter here. Writes into `out`.
export function laneDodgeDir(toAgentX, toAgentZ, fwdX, fwdZ, parityFallback, out) {
  const len = Math.hypot(toAgentX, toAgentZ) || 1;
  const ux = toAgentX / len, uz = toAgentZ / len;
  const along = ux * fwdX + uz * fwdZ;
  let latX = ux - along * fwdX;
  let latZ = uz - along * fwdZ;
  let latLen = Math.hypot(latX, latZ);
  if (latLen < 1e-3) {
    // +90° of a unit heading is (fwdZ, -fwdX), already unit length.
    const side = parityFallback ? 1 : -1;
    latX = fwdZ * side;
    latZ = -fwdX * side;
    latLen = 1;
  }
  out.x = latX / latLen;
  out.z = latZ / latLen;
  return out;
}

// Flee urgency for a passive lane-dodge, scaled by cart speed (same 0..1 ramp
// as honkScatterParams). Shared by the crowd and the kid gaggles.
export function laneDodgeUrgency(speed) {
  const t = Math.min(Math.abs(speed) / HONK.SPEED_REF, 1);
  return DODGE.URGENCY_MIN + t * (DODGE.URGENCY_MAX - DODGE.URGENCY_MIN);
}

export const HONK = {
  SPEED_REF: 18,     // = MAX_SPEED; normalizes cart speed to 0..1 for the scaling
  FRONT_MIN: 11,     // forward-scatter reach (m) when parked
  FRONT_MAX: 20,     // forward-scatter reach (m) at full tilt
  BEHIND: 6,         // loud-flinch reach behind (speed-independent)
  URGENCY_MIN: 1.0,  // parked/slow honk: normal (polite) flee speed
  URGENCY_MAX: 2.0,  // full-tilt honk: ~2x flee speed (urgent scramble)
};

// Speed-scaled honk scatter parameters. A honk scatters harder + further the
// faster the cart is moving. `t` is the 0..1 speed ramp; `urgency` multiplies
// the agent's flee speed; `frontRange`/`behindRange` are scatter reaches (m).
export function honkScatterParams(speed) {
  const t = Math.min(Math.abs(speed) / HONK.SPEED_REF, 1);
  return {
    t,
    frontRange: HONK.FRONT_MIN + t * (HONK.FRONT_MAX - HONK.FRONT_MIN),
    behindRange: HONK.BEHIND,
    urgency: HONK.URGENCY_MIN + t * (HONK.URGENCY_MAX - HONK.URGENCY_MIN),
  };
}

// ---------- Cart steering direction (mobile-jitter fix, 2026-09-01) ----------
// Which way the steering input rotates the cart. Reverse must steer like
// reverse, so the sign follows the driver's THROTTLE INTENT rather than
// leftover velocity — that's what makes a reverse->forward switch re-orient
// instantly instead of feeling inverted while the cart is still drifting back.
//
// The subtlety that bit mobile: throttle is DISCRETE on a keyboard (-1/0/+1)
// but ANALOGUE on the touch stick, and touch.js applies its deadzone to the
// stick vector's MAGNITUDE, not per axis. So a hard sideways push — a pure
// turn — clears the deadzone on x while leaving y as a small value jittering
// across zero. A bare `Math.sign(throttle)` then flipped the direction every
// few frames and visibly INVERTED the steering mid-turn. Keyboard never showed
// it (|throttle| is always 1), which is exactly why it read as mobile-only
// weirdness (Gary 2026-09-01). Requiring real throttle intent fixes it with no
// new state and no change to the keyboard feel.
export const DIR_INTENT = 0.25;   // |throttle| that counts as a deliberate direction

export function steerDirFor(throttle, speed) {
  if (Math.abs(throttle) >= DIR_INTENT) return Math.sign(throttle);
  return Math.sign(speed) || 1;
}
