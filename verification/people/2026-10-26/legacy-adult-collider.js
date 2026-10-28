// Frozen adult collision candidate shape.
function _npcColWrap(n) {
  let w = _npcColPool[_npcColPoolN];
  if (!w) { w = {}; _npcColPool[_npcColPoolN] = w; }
  _npcColPoolN++;
  w.position = n.pos;          // Vector3; resolveCollision reads .x/.z only
  w.radius = 0.45;
  // A hit is a hit, fleeing or not (Gary, 2026-08-31): the old fleeing→0
  // exemption let a fast cart plow through a scattering crowd for free. The
  // fairness lever moved into the dodge itself — laneDodgeUrgency scales flee
  // speed with cart speed, so people CAN get out of the way of a clean line.
  w.damage = 1;
  w.kind = 'person';
  w.passive = false;
  w.npc = n;
  w.entry = null;       // crowd NPCs carry no registry entry
  return w;
}
