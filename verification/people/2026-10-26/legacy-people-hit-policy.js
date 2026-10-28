// Frozen scoring-phase consequences before Task 2.19.
function registerPeopleHit(hit) {
  if (!RunState.active || RunState.over) return false;
  let toasted = false;
  if (lurleen.isFollowing || lurleen.state === 'aware') {
    if (lurleen.scareOff()) {
      HUD.toast(HUD.withName('Lurleen saw that. 💔', '{name}! Lurleen saw that. 💔', 0.5), 2400);
      toasted = true;
    }
  }
  if (hit.npc) crowd.frownAt(hit.npc);
  // Ordering: the whistle/ejection (rarer, more urgent) may overwrite the
  // heartbreak — that priority is intentional.
  return applyVibeStrike(VIBE.hitStrike) || toasted;
}
