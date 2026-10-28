// Only the proven common eligibility and reset rules live here. Population
// gains, fleeing/empty-tank policy and emission barriers stay with their owner.
export function movedSinceSmile(person,playerPosition,resetDistance) {
  return person.lastSmilePos===null||playerPosition.distanceTo(person.lastSmilePos)>resetDistance;
}

export function canSmile(person,playerPosition,distance,range,resetDistance) {
  return person.smileTimeCooldown<=0&&movedSinceSmile(person,playerPosition,resetDistance)&&distance<range;
}

export function resetSmile(person,playerPosition,cooldown) {
  person.happiness=0;
  person.smileTimeCooldown=cooldown;
  person.lastSmilePos=playerPosition.clone();
}
