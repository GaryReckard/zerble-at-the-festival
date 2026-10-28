export function updateStagePerformers(t) {
  for (let i = 0; i < stagePerformers.length; i++) {
    const p = stagePerformers[i];
    if (p.group.userData.animate) {
      p.group.userData.animate(t + p.phase);
      continue;
    }
    const phase = t * 3 + p.phase;
    p.group.position.y = p.baseY + Math.abs(Math.sin(phase)) * 0.08;
    p.group.rotation.z = Math.sin(phase * 0.5) * 0.05;
    p.group.rotation.y = p.baseYaw + Math.sin(phase * 0.3) * 0.15;
  }
}
