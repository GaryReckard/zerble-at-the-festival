// Parking belongs to the driving session, not a held key or a render/physics
// substep. Both motion paths consume the same adapted input once per frame.
export function createDrivingControls() {
  let parked = false, armed = false, source = null, lastX = null, lastZ = null, lastReset = null;
  const output = { throttle: 0, steer: 0, boost: false, slow: false, brake: false,
    steeringDirection(speed) { return source?.steeringDirection?.(speed) ?? (speed < 0 ? -1 : 1); } };
  function reset() { parked = armed = false; lastX = lastZ = lastReset = null; }
  function update(input, cart, toggle = false) {
    source = input;
    const raw = input.throttle || 0, neutral = Math.abs(raw) <= .05;
    const p = cart.position, velocity = cart.velocity, epoch = cart.drivingResetEpoch || 0;
    if (lastReset !== null && epoch !== lastReset) reset();
    lastReset = epoch;
    // Teleports/restarts must not carry a parking latch to a new driving pose.
    if (p && lastX !== null && Math.hypot(p.x - lastX, p.z - lastZ) > 10) reset();
    if (p) { lastX = p.x; lastZ = p.z; }
    const speed = cart.physicsDriven && velocity ? Math.hypot(velocity.x, velocity.y, velocity.z) : Math.abs(cart.speed || 0);
    const supported = cart.physicsDriven ? !!cart.grounded && (cart.vehicleUp?.y ?? 1) > .65 : !cart.airborne;
    const canPark = supported && speed < .5;
    let rejected = false;
    if (toggle) {
      if (parked) { parked = false; armed = false; }
      else if (canPark) { parked = true; armed = neutral; }
      else rejected = true;
    } else if (parked) {
      if (neutral) armed = true;
      else if (armed && !input.brake) { parked = false; armed = false; }
    }
    output.brake = !!input.brake || parked;
    output.throttle = output.brake ? 0 : raw;
    output.steer = input.steer || 0;
    output.slow = !!input.slow;
    output.boost = !output.brake && !!input.boost;
    cart.parkingBrake = parked;
    cart.brakeActive = output.brake;
    return { input: output, parked, canPark, rejected };
  }
  return { update, reset, get parked() { return parked; } };
}
