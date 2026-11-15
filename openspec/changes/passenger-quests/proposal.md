# Proposal: passenger quests

## Why

ROADMAP "Gameplay verbs" queues passenger quests, the "Gotta GO!" porta-potty variant, monk group rides and "Take me to the mountaintop". The design in `.claude/passenger-quests-design.md` is complete, Festival Run reserved `Scoring.award` and the festival map reserved `setObjectives` for it. Gary asked on 2026-11-15 for the whole stack.

## What changes

- Riders boarding Zerble sometimes carry a destination quest with a thought bubble.
- A compass strip, map pins, bubble brightness, humming and toasts guide the player.
- Arrival ends the ride with a celebration and a smile burst; stalling ends it politely with no reward.
- Variants: timed porta-potty run, mountaintop request, monk party shared destination.
- New debug commands, a sandbox entity for the bubble, Node tests, and documentation.

## Out of scope

Kids requesting rides, tokens, streaks, tip jar, new world content, any change to seeded world generation.

## Impact

`src/quests/*` (new), `src/models/questBubble.js` (new), `src/questHud.js` (new), `src/crowd.js`, `src/main.js`, `src/sound.js`, `src/settings.js`, `src/analytics.js`, `index.html`, `sandbox.html`, `package.json`, docs.
