    // --- charm logic --- (frownTimer is ticked + handled in the unhappy block above)
    if (
      npc.smileTimeCooldown <= 0 &&
      (npc.lastSmilePos === null || zerble.position.distanceTo(npc.lastSmilePos) > SMILE_RESET_DIST) &&
      dToZerble < SMILE_RANGE
    ) {
      const fwd = zerble.forwardWorld;
      const ndx = npc.pos.x - zerble.position.x;
      const ndz = npc.pos.z - zerble.position.z;
      const ndlen = Math.hypot(ndx, ndz) || 1;
      const dot = (ndx / ndlen) * fwd.x + (ndz / ndlen) * fwd.z;
      const inView = dot > cosCone && npc.state !== 'fleeing';
      const closeness = 1 - dToZerble / SMILE_RANGE;
      const aim = inView ? (dot - cosCone) / (1 - cosCone) : 0;

      if (this.bubblesEmpty) {
        // Dry cart → disappointment. Eye contact builds displeasure; at
        // threshold the NPC frowns and a smile is lost (onFrown). Slower to
        // build than a smile so it's a real "uh oh, I'm out" beat, not instant.
        // NOTE the frown's job is mode-dependent at the onFrown dispatch below:
        // Just Cruisin' keeps the dry-tank smile tax; Festival Run turns it
        // into vibe-meter feedback (strike in main.js's handler, tax suppressed
        // while sputtering), and frownRateMult ramps the build rate by day.
        npc.happiness = Math.max(0, npc.happiness - dt * 0.5);
        if (inView) npc.displeasure += 1.4 * this.frownRateMult * closeness * (0.55 + 0.45 * aim) * dt;
        else npc.displeasure = Math.max(0, npc.displeasure - dt * 0.25);
        if (npc.displeasure >= FROWN_THRESHOLD) {
          npc.displeasure = 0;
          npc.frownTimer = FROWN_DURATION;
          npc.smileTimeCooldown = 0;            // clear any leftover happy bounce/smile — they're not happy
          npc.lastSmilePos = zerble.position.clone();
          this.smiles.spawnLost(zerble.position, npc.personHandle, this.peopleView);   // reddish "lost smile" flies out to them
          if (this.onFrown) this.onFrown(npc.personHandle);
        }
      } else {
        npc.displeasure = Math.max(0, npc.displeasure - dt * 0.6);
        let gain = 0;
        if (inView) gain += 1.4 * closeness * (0.4 + 0.6 * aim);
        for (const bp of bubblePositions) {
          const bd = Math.hypot(bp.x - npc.pos.x, bp.z - npc.pos.z);
          if (bd < BUBBLE_RANGE) {
            gain += 1.0 * (1 - bd / BUBBLE_RANGE);
            break;
          }
        }
        // Curious & approaching NPCs charm faster (they're really looking)
        if (npc.state === 'approaching' || npc.state === 'watching') gain *= 1.2;
        // Fleeing NPCs don't smile
        if (npc.state === 'fleeing') gain = 0;

        if (gain > 0) npc.happiness += gain * dt;

        if (npc.happiness >= HAPPINESS_THRESHOLD) {
          npc.happiness = 0;
          npc.smileTimeCooldown = SMILE_TIME_COOLDOWN;
          npc.lastSmilePos = zerble.position.clone();
          this.smiles.spawn(npc.pos);
        }
      }
    } else {
      npc.happiness = Math.max(0, npc.happiness - dt * 0.2);
      npc.displeasure = Math.max(0, npc.displeasure - dt * 0.4);
    }
