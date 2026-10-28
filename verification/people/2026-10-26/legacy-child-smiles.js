      if (smiles && zerble && !fleeing) {
        const dxZ = k.position.x - zerble.position.x;
        const dzZ = k.position.z - zerble.position.z;
        const dToZerble = Math.hypot(dxZ, dzZ);
        const moved = k.userData.lastSmilePos === null
          || zerble.position.distanceTo(k.userData.lastSmilePos) > KID_SMILE_RESET_DIST;
        if (
          k.userData.smileTimeCooldown <= 0
          && moved
          && dToZerble < KID_SMILE_RANGE
        ) {
          let gain = 0;
          // Proximity to Zerble — linear falloff over SMILE_RANGE
          gain += KID_PROXIMITY_GAIN * (1 - dToZerble / KID_SMILE_RANGE);
          // Nearest bubble bonus: if any live bubble is within
          // KID_BUBBLE_GAIN_RANGE, add proportional gain. Caps even if
          // multiple bubbles are nearby — kids are excited about bubbles,
          // not exponentially.
          // The chase search covers the smaller happiness range before movement.
          if (chaseD < KID_BUBBLE_GAIN_RANGE) {
            gain += KID_BUBBLE_GAIN * (1 - chaseD / KID_BUBBLE_GAIN_RANGE);
          }
          k.userData.happiness += gain * dt;
          if (k.userData.happiness >= KID_HAPPINESS_THRESHOLD) {
            k.userData.happiness = 0;
            k.userData.smileTimeCooldown = KID_SMILE_TIME_COOLDOWN;
            k.userData.lastSmilePos = zerble.position.clone();
            smiles.spawn(k.position);
          }
        } else {
          // Out of range / on cooldown — decay happiness slowly
          k.userData.happiness = Math.max(0, k.userData.happiness - dt * 0.2);
        }
      }
