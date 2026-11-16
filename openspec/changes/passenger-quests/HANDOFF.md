# Handoff: passenger quests

Read this file, then [README.md](README.md) and [tasks.md](tasks.md). Current source and the verification record take precedence over the original design.

## Where it stands

Updated 2026-11-15 during integration with current main. The feature branch was pushed; the reviewed feature is integrated with Lantern Night, cornhole and the capture tooling in local main. Check the actual branch and working tree before Git operations; this integration has not been pushed.

Implemented: the quest engine, hailing, rider and monk-party requests, urgent porta-potty and mountaintop variants, bubbles, compass, map pins, sounds, analytics, four quest-earned bubble types, road guidance and the browser-local ride log. The Festival Passport now has a Ride log tab showing total lifts, reward smiles sent out and the latest 20 deliveries. Desktop browser checks cover live history, keyboard tabs, empty/populated records, saving-unavailable feedback and compact landscape.

Remaining work is recorded in tasks.md:

- Task 11.6 (hailer visibility): judge the bubble and wave from the chase camera on a real GPU.
- Tasks 10.1 to 10.3 (hardware, economy and tier acceptance): real GPU and phone play, audio by ear, reward judgment, with Low/Mid/High desktop boots complete.
- Task 7.3 (live mountaintop request): exercise a request to an admitted district.
- Task 6.3 (urgent visual acceptance): watch the rider reach a potty after success and flee after failure.

Node v24.10.0 was verified in the integration checkout on 2026-11-15. The original branch report used Node 22; that historical observation remains in its verification report.

## Workflow

Follow [AGENTS.md](../../../AGENTS.md), the current user’s integration instructions and the actual Git state. Do not treat earlier branch-only instructions as a prohibition on the authorized integration. Preserve other agents’ edits and the independent iPad performance work.

Every game-visible commit carries its CHANGELOG entry under the real date. Run the required checks/build and real-game smoke path, tick tasks only to the extent established, then run `bin/readme-sync passenger-quests`. Keep physical-device acceptance separate from desktop or software-rendered evidence.

`crowd.onBoard(handle, { party })` passes a person handle, never the private NPC record. Solo departures are detected by polling `riderInfo`; there is no `crowd.onRideEnd` callback.

## Verification entry points

```sh
node bin/test-passenger-quests
npm run dev
```

Use an available managed browser, including the in-app Browser, or Gary’s real Chrome for ordinary visual checks. Follow [browser verification and cleanup](../../../docs/browser-verification.md) and any stricter local override. Standalone automation requires a bounded command, recorded process ownership and exact-PID cleanup checks; closing in `finally` alone is insufficient. Software WebGL is a fallback for a failed normal WebGL context, not device-performance evidence. Stop any server you start when finished.

Open `/?mute=1`, click a ready mode plank, and inspect the console after world boot. `__dbg.hail()` and `__dbg.hailGo()` exercise pickup; `__dbg.giveQuest()`, `__dbg.quests()` and `__dbg.questGo()` exercise delivery. Force `'urgent'` or `'summit'` with `giveQuest(kind)`. `__dbg.summonNutWagon()` brings the monks; once they ride, `__dbg.monkQuest()` forces a shared request. The full command reference is in [DEBUGGING.md](../../../DEBUGGING.md). For the ride log, use the actual Passport button or `P`, then select Ride log.

## Known limits

See [the verification record](../../../verification/passenger-quests/README.md) for measurements and unverified paths. A plan can describe a venue that its builder omitted, so examine built destinations during playtesting. `HUD.toast` holds one message, and closely seated riders can crowd the bubbles. Phones use landscape; a desktop phone-sized viewport does not replace a physical phone or iPad test.

## Follow-up under review

The November 15 follow-up integrates `dd1516c` with current main in an isolated checkout, fixes the repeated review findings, and makes hammock/porta-potty requests interchangeable. Main and the active player session stay untouched until the tested update is applied. See reviews/002-follow-up-audit and the forthcoming integration evidence. Capture exclusion covers offers, hails and searches, not all presentation allocation or empty frame updates. The unresolved economy question is audit finding 5 (hailing economy), not finding 4.
