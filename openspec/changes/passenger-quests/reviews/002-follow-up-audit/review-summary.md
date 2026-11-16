# Code Review Summary

## Review Metadata

- Diff Scope: custom `2277934..dd1516c`, exactly two new passenger-quests commits; followed by compatibility review against main `2a07268` and verification of the isolated fixes.
- Reviewed Files: 25 files in the pushed delta, plus authorized facility behavior and integration changes.
- OpenSpec Change: `openspec/changes/passenger-quests`.
- Specialists Used: review-gameplay, review-sandbox, review-performance, review-docs. Three concurrent specialist slots required the docs specialist to run in a second wave. No audio or model implementation changed in the pushed delta.

## Intent Match

The new commits improve hailer approach, capacity reservations, run/capture shutdown, warning priority, distance bands and compass guidance. The review also incorporates Gary’s playtest correction: generic hammock and porta-potty needs should accept any matching facility, while named destinations remain specific. Main’s earlier safe-arrival, activity ownership, reduced-motion, keyboard and Passport changes remain intact.

## Findings

The sibling reports preserve source citations and executable reproductions against `dd1516c`. These are addressed in the combined follow-up:

- [P1][high][review-gameplay] `src/crowd.js:2267`: the new airborne/submerged refusal reaches the old unchecked arrival path, paying rewards and leaving an urgent rider logically idle while retaining a seat. The combined source preserves main’s successful-disembarkation preparation/commit contract and seated-person potty guard. This is a new interaction with a defect already repaired on main, not a claim that the pushed commits deleted main’s changes.
- [P2][high][review-gameplay] `src/quests/runtime.js:175`: newly wired shutdown leaves monk quest holds set. An explicit owner method releases the hold without forcing an unsafe exit, and shutdown disables offers before notifications, with reentrant and repeated-call coverage.
- [P2][high][review-gameplay] `src/crowd.js:2269`: the new 45-second cooldown was bypassed by hailing and hail boarding. Candidate, availability and pickup checks now enforce it.
- [P2][high][review-sandbox] `src/quests/presentation.js:94`: a stale hidden-map objective suppresses later summit tracking. Objective replacement now immediately reconciles removed selections while preserving valid player targets.
- [P2][high][review-docs] `CHANGELOG.md:9`: capture exclusion claimed no quest work although construction and empty presentation updates remain. The documentation now states the narrower dynamic-work guarantee.
- [P2][high][review-docs] `CHANGELOG.md:9`: the universal 60 m minimum did not apply to urgent trips. Edge minima are now described as ordinary 60 m, urgent 45 m and summit 160 m, with separate centre maxima.
- [P3][high][review-docs] `HANDOFF.md:12`: the economy follow-up pointed at audit finding 4 rather than finding 5. The pointer is corrected.

Performance specialist: **No actionable issues.** Capture stop behavior passed a deterministic throwing-spy probe; no calibrated timing was run or claimed.

## Authorized follow-up behavior

Any built hammock or porta-potty can satisfy its matching request after the speed and safe-exit gates. Decorative tree hammock metadata is chunk-owned, zero-footprint, without collider, seating or RNG changes. Other destination kinds retain their target. Alternate stops retain the offered urgent deadline and cannot increase the suggestion’s distance bonus. The HUD explicitly names interchangeable facilities and explains missing facilities, slowing down and blocked safe exits. Matching scans only relevant live kind indexes, at bounded cadence while moving and before actual slow arrivals.

## Verification Gap

The raw branch and combined full check suites and production builds pass. Production-method regressions cover safe exits, matching facilities, wrong kinds, unloaded facilities, strict named targets, deadlines/rewards, cooldowns, party ownership and hidden-map selection. Native Low game runs cover a different tree hammock on the reported seed, an urgent delivery and an actual drive/brake/honk hailer pickup. Low Noon/Midnight captures and console checks pass. Compact fixture bounds at 844×390 and 568×320 preserve touch controls and 44-pixel targets.

The original marker does not record its active rider target or velocity, so it cannot conclusively identify which arrival gate blocked that historical run. The reconstruction and source confirm the underlying specificity/registration mismatch, and the new behavior is verified independently. No physical phone, audio-by-ear, measured full-speed approach, live summit or economy-rate acceptance is implied. The active player game has not been reloaded by these tests.

## Suggested Commit/PR Description + CHANGELOG entry

Merge the reviewed passenger follow-up while preserving current main’s UI and ownership fixes. Let generic hammock and porta-potty requests accept any built matching stop, expose decorative hammock drop-offs without placement changes, and clarify passenger guidance. Repair cooldown, shutdown and map-selection edge cases, with production-method regressions and native approach/delivery evidence. November 15 CHANGELOG entries cover the behavior and explicit measurement limits.

## Verdict

**Approve**, for the tested combined implementation. The raw pushed tip required the above fixes before integration. Applying the prepared update to the active dev checkout remains a separate step because Vite reloads running games when JavaScript changes.
