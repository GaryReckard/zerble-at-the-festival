# Code Review Summary

## Review Metadata

- Diff Scope: custom, `558c9f3...2277934` (`origin/passenger-quests` at fetch), followed by combined-source fix validation.
- Reviewed Files: 50 branch files, plus explicit current-source integration checks and the user-requested documentation sweep.
- OpenSpec Change: `openspec/changes/passenger-quests`.
- Specialists Used: review-gameplay, review-rendering, review-audio, review-performance, review-sandbox, review-docs. Reviews ran in bounded waves because the session supports three child slots.

## Intent Match

The feature supplies visible hails, optional rider destinations, a shared monk-party request, urgent and admitted-mountaintop variants, compass/map guidance, smile rewards and quest-earned bubbles. The integration also completes the unfinished player-facing Ride log through the production Festival Passport while preserving Lantern Night, cornhole, landing forgiveness and capture tooling. See the current [verification report](../../../../../verification/passenger-quests/README.md).

## Findings

The sibling specialist reports preserve original branch line numbers and reproductions. All confirmed findings were addressed before integration:

- [P1][high][review-gameplay] `src/quests/runtime.js` arrival ignored failed physical exit, awarded completion and changed a seated urgent rider to a pedestrian. Fixed by an engine preparation gate, grounded/dry safe-disembarkation retry, and a seated/claimed guard in the potty handoff. Production-runtime/crowd regression covers the rejected and accepted exits.
- [P2][high][review-gameplay] `src/crowd.js` hailing selected activity-owned people, including cornhole participants. Candidate selection, ongoing availability, wave and pickup now respect claims/reservations, with production-method regressions.
- [P2][high][review-rendering] `src/models/questBubble.js` entrance spring and urgent tint ignored reduced motion; compass CSS missed the in-game preference. Fixed and covered by execution of the actual presentation classes.
- [P2][high][review-sandbox] `src/questHud.js` Space leaked to driving input. The button stops propagation while retaining native default activation and click selection, with event regression and live button exercise.
- [P2/P3][high][review-docs] Five stale contracts/workflow findings were corrected: 30%/first-boarder offer rules, nonexistent `onRideEnd`, overstated lifecycle evidence, unsafe alternate browser recipe, sprite capacity/ownership and stale remote/task status. Current rules state 8% walk-ups without a guarantee, polling departures, five allocated sprites and the authoritative browser cleanup guide.

Audio and performance source reviews: **No actionable issues.** No iOS unlock regression, seeded-world RNG change, shared-resource disposal regression or new unbounded hot loop was found in the reviewed diff. This is a source-review conclusion, not device acceptance.

## Verification Gap

The full combined check suite, production build, focused quest/presentation/command tests and whitespace checks pass. Managed in-app Browser checks used ready native title clicks, muted URLs and explicit Low/Mid/High boots, without captured console warnings/errors. Live hailing, ordinary and urgent delivery, Ride log history, compact keyboard layout, storage failure, empty state, and Noon/Midnight icon sandbox were exercised. The initial delivery run used Auto because `tier=low` is not a valid override; explicit `perf=low` was subsequently checked.

Physical phone/iPad, cues by ear, live summit guidance, full urgent door/flee animation, hailer readability over 30–75 m and reward/economy judgment remain acceptance work, recorded in tasks and ROADMAP. No new calibrated timing or device-performance claim is made. The user's expired desktop measurement reservation was not reused.

## Suggested Commit/PR Description + CHANGELOG entry

Integrate passenger hails, destinations, group and urgent rides with the current festival UI and activities. Complete the Passport Ride log, commit rewards only after a safe physical exit, prevent activity-owned pickup conflicts, and fix reduced-motion and keyboard presentation. Update the capability contract, handoff and docs to match the actual runtime and preserve outstanding device acceptance. Validation: combined check/build, focused regressions, managed-browser real-game and sandbox smoke checks.

The November 15 CHANGELOG contains the merged feature entries, Ride log addition and review fixes alongside the preserved local work.

## Verdict

**Approve.** The confirmed defects are fixed and the combined implementation passes the recorded functional checks. Remaining device/subjective acceptance is explicit and does not become a desktop performance guarantee.
