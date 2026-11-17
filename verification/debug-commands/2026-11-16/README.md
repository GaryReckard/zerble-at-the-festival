# Quest and exploration command verification

## Scope

The shared teleport catalog, new facility/vendor locators, expanded passenger
commands, encounter summoning and read-only diagnostics. The reference is
[DEBUGGING.md](../../../DEBUGGING.md#quest-and-exploration-command-expansion-november-16).

## Automated evidence

- `node bin/test-debug-commands`: valid dispatch and contextual completion;
  malformed kinds, selectors and arity rejected before calling an action;
  party requests exclude individual facilities and special offer paths.
- `node bin/test-debug-actions`: production adapters translate one-based
  selectors, map potty/summit aliases, expose diagnostic snapshots and report
  summon failure. Production main helpers select the correct hailer/request,
  admit the approach heading through the surface binding, and preserve position,
  heading, physics and exploration state on rejected jumps. Status numbers match
  current array ordering.
- `node bin/test-debug-teleports`: the actual menu rendering expression and
  command map contain the same unique destination kinds, aliases and scope labels;
  both generator catalogs are filtered correctly. New loaded facilities cycle,
  disappear on unload, face the target and reject collider-blocked approaches.
  Vendor rows retain the existing itinerary and selected-surface safeguards.
- `npm run check`: passed (exit 0); the final focused command tests were rerun
  after tightening hailer selectors to the production limit of two.
- `npm run build`: passed, with the existing large-chunk warning.

## Browser evidence

Used the existing local Vite server in a temporary in-app browser tab, with
`/?seed=4&x=57&z=-107&perf=low&mute=1`. Started with the actual ready Just
Cruisin' plank, opened the slash prompt using the keyboard and entered commands
through its input. No console evaluation or forced input stubs were used.

Observed results:

| Action | Result |
| --- | --- |
| `/inspect physics`, `/inspect map`, `/inspect upgrades` | Returned the corresponding live production snapshots |
| `/tp cornhole` | Arrived beside the loaded court at approximately (95, -122) |
| `/tp hammock`, `/tp potty`, `/tp beach`, `/tp vendors` | Returned live arrivals at approximately (52, -70), (73, -11), (262, 620), (320, 644) |
| `/summon wagon`, `/summon rider` | Both reported successful nearby production encounters |
| `/quest give drum_circle` | Created a real request with a visible passenger compass card |
| `/quest give food_court`, then `/quest go 2` | Selected the second request, arrived at its food court and subsequently displayed the ordinary ride completion/reward |
| `/quest hail`, `/quest approach 1`, `/quest pickup 1` | Created a beach hailer, reported the 35 m driving approach, then parked beside that hailer |
| `/quest status` | Included one-based request numbers, cart state and real nearby facilities |
| `/quest party` without monks riding | Reported the unmet riding prerequisite |
| Backtick picker → Cornhole → Go | Moved to the same court and displayed its arrival feedback |

Inspected the final picker at Noon and Midnight on Low. The longer scope labels
initially displaced Go outside the panel; `min-width:0` on the flex select fixes
it, and the final screenshot inspection confirmed both controls were visible.
The picker also has an accessible Teleport destination label. The final console
inspection contained no warnings or errors. The temporary tab was closed; no
standalone browser or development server was started.

## Published-host adapter verification

Release review found that the original adapter depended on the local-only
`window.__dbg` object. The command actions now live in a bounded production hook
shared with the local console, while capture, unlock and general automation
helpers stay behind the existing host guard. The adapter test runs without a
`window` global and exercises the same selectors and read-only snapshots.

Opened `http://release.localhost:8765/?seed=4&x=57&z=-107&perf=low&mute=1`,
whose hostname does not satisfy the local automation guard. After a real ready
mode-plank click, all three new inspect commands returned production snapshots,
`/quest hail` created a real drum-circle hailer, pickup and approach worked, and
both summon commands succeeded. Quest give/go and party commands reported their
normal no-rider/no-active-request/not-riding prerequisites rather than missing
helpers. Console inspection contained no warnings or errors; the tab was closed.
Focused debug tests, passenger-quest tests, live-driving tests and the build passed.

## Boundaries

The full monk-party boarding/delivery flow was not repeated in the browser;
this change tests its command adapter and preserves the existing production
helper. A forced beach request near the beach correctly reported no destination
in the permitted distance band. Summoning retains capacity and route constraints,
and loaded-only teleport searches do not promise a facility elsewhere in the
infinite world. This was desktop command verification, not phone, audio-unlock
or performance acceptance.
