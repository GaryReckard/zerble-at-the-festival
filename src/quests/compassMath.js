// Pure helpers for the quest compass strip, kept apart from the DOM so Node
// tests cover the bearing convention.
import { QUEST } from './catalog.js';

// Signed angle (radians) from the cart's nose to the destination, positive
// CLOCKWISE as seen from above, which is also clockwise on screen for the
// chase camera. Zerble's forward is (-sin h, -cos h), so a larger heading
// turns the cart toward -X (screen left); hence the sign flip.
export function relativeBearing(player, target) {
  const toward = Math.atan2(-(target.x - player.x), -(target.z - player.z));
  let rel = toward - (player.heading || 0);
  rel = ((rel + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return -rel;
}

export function formatDistance(metres) {
  if (metres < 95) return `${Math.max(5, Math.round(metres / 5) * 5)} m`;
  if (metres < 1000) return `${Math.round(metres / 10) * 10} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

export function formatClock(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// What a chip shows, quantized so the DOM is only touched when it changes.
export function chipState(quest, player) {
  const target = quest.arrivalTarget || quest;
  const distance = quest.arrivalTarget ? Math.hypot(target.x - player.x, target.z - player.z) : quest.dist;
  const inside = distance <= target.radius;
  const facility = quest.kind === 'hammock' || quest.kind === 'porta_potty';
  const missing = facility && inside && !quest.arrivalTarget;
  const blocked = inside && quest.arrivalBlocked === 'unsafe_exit';
  const fast = inside && Math.abs(player.speed || 0) >= QUEST.ARRIVE_SPEED;
  return {
    id: quest.id, icon: quest.icon, label: quest.kind === 'hammock' ? 'Any hammock' : quest.kind === 'porta_potty' ? 'Any porta-potty' : quest.short,
    help: quest.kind === 'hammock' ? 'Any hammock works' : quest.kind === 'porta_potty' ? 'Any porta-potty works' : 'This destination',
    urgent: quest.type === 'urgent',
    angle: Math.round(relativeBearing(player, quest.arrivalTarget || quest.aim || quest) * 180 / Math.PI / 6) * 6 + 0,   // + 0 folds -0 into 0
    text: blocked ? 'Pull over nearby' : missing ? (quest.kind === 'hammock' ? 'Find a hammock' : 'Find a potty') : fast ? 'Slow down!' : inside ? 'Stop here!' : formatDistance(Math.max(0, distance - target.radius)),
    clock: quest.type === 'urgent' ? formatClock(quest.timeLeft) : '',
    warm: Math.round(quest.warmth * 10) / 10,
    inside, missed: quest.missed,
  };
}
