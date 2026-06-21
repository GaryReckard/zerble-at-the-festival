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
  REACT_K: 0.8,    // extra look-ahead per m/s of cart speed
  REACT_MAX: 24,   // cap — stays under the crowd's flee-exit range so a fresh dodge can't insta-exit
  CORRIDOR: 3.5,   // half-width (m) of the "you're in my lane" band (cart is ~2.6 wide)
  LOCK: 0.5,       // s a dodge commits before re-evaluating
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
