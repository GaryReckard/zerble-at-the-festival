// The cart remains arcade-controlled. Approximate its share of a prop impact
// without applying the person-hit reverse kick, position jump or immunity.
// This effective mass is a feel parameter, not a simulated cart rigid body.
const CART_EFFECTIVE_MASS = 250;

export function applyPropFeedback(cart, hit) {
  if (!Number.isFinite(hit.mass) || hit.mass <= 0 ||
      !Number.isFinite(hit.approachSpeed) || hit.approachSpeed <= 0) return 0;
  const speed = Math.abs(cart.speed);
  if (!Number.isFinite(speed) || speed === 0) return 0;
  const loss = Math.min(speed, hit.approachSpeed) * hit.mass / (CART_EFFECTIVE_MASS + hit.mass);
  cart.speed = Math.sign(cart.speed) * (speed - loss);
  return loss;
}
