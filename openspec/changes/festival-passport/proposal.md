## Why
Players should carry a memory of their exploration between visits. Gary approved a Festival Passport with personal stats, story-like achievements, and periodic GA4 summaries while another session adds terrain.

## What Changes
- Add browser-local, versioned stats and persistent achievements with This visit / All time views.
- Track planar current/farthest distance from the original entrance, distance driven, raw smiles, real bubble emissions, distinct stages, passenger boardings and damaging bonks.
- Add incremental periodic analytics and milestone events, independent of local persistence.
- Preserve the entrance and visit across an explicit settings restart; exclude teleports and hidden-tab simulation.

## Capabilities
### New Capabilities
- `festival-passport`: local progression, player view and analytics projection.
### Modified Capabilities
None; existing analytics fail-safe behavior is preserved.

## Impact
Progress/UI/analytics, with narrow hooks in main.js, bubbles.js and bubbleChallenges.js. New modules require all five HTML importmaps. No world generation, physics, materials, geometry, audio initialization or shared-resource changes. CHANGELOG required.

## Scope Check
Existing bubbleProgress owns lifetime raw smiles and unlocks; migrate its raw-smile total once without changing ownership of unlocks. ChallengeTracker already detects stage visits; reuse its radius and add a callback. Existing Analytics owns all GA calls; retain it as the sole transport. Existing settings/upgrades overlays establish interaction styles. All five importmaps are in scope, with surgical edits preserving Astra's map work. Leaderboards and terrain are excluded.
