# Expanded commands and woodland placement follow-up

October 24, 2026. This wakeup preserves the existing uncommitted campsite, music and command work. No commit or deployment was performed.

## Implementation

[The DOM-free command grammar](../../../src/debugCommands.js) now defines twenty commands, including help and teleport. It owns command descriptions, per-command syntax, bounds, validation and contextual completion. [The adapter and prompt](../../../src/debug.js) connect it to actual game actions, while [the main hook](../../../src/main.js) exposes the existing chase-camera controller. All four no-build importmaps include the module.

The expanded surface covers time presets, pause/resume/step, invincibility and collision outlines, NPC status/freeze/resume/cheer, bubble juice, collectible smiles, heading/stop, coordinates/seed/status, nearby-camp/NPC/audio/world inspection, chase/top-down cameras, performance recording and session mute. The [debugging reference](../../../DEBUGGING.md#expanded-slash-commands-october-24) records exact syntax and limits.

Argument validation completes before dispatch. Step requests are bounded to 120 frames and replace old pending work; resume clears that queue. Smile requests are bounded to 100 and create pickups rather than awarding score. Juice input has a debug limit of 100 reserve meters, without changing gameplay capacity. Readiness checks prevent mutations before a mode starts. Prototype names are rejected as destinations. No command evaluates JavaScript.

Completion handles command names, arguments such as `/time m`, and nested values such as `/camera top 2`, retaining descriptions, keyboard selection, click/Tab completion, history and caret-token replacement. Result output scrolls independently so long help or camp inspection remains usable. Scene counters use the established pre-postprocessing `renderer.__sceneInfo`; reading raw renderer counters would incorrectly show only the final fullscreen pass.

## Focused checks

| Check | What it exercises |
| --- | --- |
| `bin/test-debug-commands` | Twenty-command schema dispatch, numeric and count/frame bounds, extra-argument rejection before mutation, readiness, error feedback, safe target names and nested completion |
| `bin/test-debug-actions` | Actual adapter functions with game-shaped fixtures: coherent step/pause queue, time/heading/juice changes, protected crowd behavior, correct scene counters, camera transforms, camp claims and session mute |
| `bin/test-debug-teleports` | Existing multi-category teleport itineraries, wrapping/reset/seed/singleton cases, command parsing, input isolation, prefix/case/caret completion |
| `bin/test-camp-registry` and `bin/test-campsite-layout` | Guarded lake-envelope exception, actual lake/camp geometry fixture, exact-water preflight authorization, preserved shoreline/venue rejection and existing layout coverage |

The full `npm run check` passed; [saved output](checks.log) records the broader regression scope. The routine Node package-type warnings remain existing tooling output; no package/module toolchain change was introduced.

## Live browser evidence

A muted seed-1977 game was started through its ready Just Cruisin' plank in Low and High. The browser exercised time presets, pause and one-frame stepping, NPC freeze/resume/cheer, invincibility, collision outlines, juice/smile helpers, heading and location, camera switching, performance recording, session-mute inspection and existing teleport cycling. `/juice 999` was rejected, and a subsequent `/juice` retained the previous value of 5. Cheer while NPCs were frozen reported the required resume instead of changing them. Status displayed true scene draw/triangle counters rather than the fullscreen pass's 1/1 counts.

- [Noon status/top-down view](noon.jpg) shows the actual paused camp view and live state output.
- [Midnight preset discovery](midnight.jpg) shows the command prompt's contextual time arguments after a single simulation step.
- [High-tier NPC argument discovery](npc-completion-high.jpg) shows nested command suggestions alongside actual camp inspection.
- Nested `/camera top 2` completion offered `240`, and the live camp inspection exposed actual registered household IDs and independent chair/bed claims. Claims are not asserted to equal visual occupancy because approaching actors also reserve them.

Console inspection reported no warnings/errors. The tests stayed muted. The owned game tab was closed, no standalone browser was launched, and no server was stopped. A sandboxed localhost probe could not see Gary's existing server; an attempted server start failed because the host port was already occupied, so this wakeup never acquired server ownership.

## Missing lakeside campground

The follow-up reproduced a real seed-1977 missing district: its host at approximately `(308,-298)` is 164.973m from a lake whose rough registered envelope radius is 162.926m. The host footprint overlapped that rough circle although its center and sixteen perimeter samples were on dry land. [Camp preflight](../../../src/campRegistry.js) rejected the host, which correctly suppressed all its satellites, leaving an empty destination.

[Production placement](../../../src/chunks.js) now supplies `waterChecked: true` only after its exact center/perimeter checks pass. The broad reservation check may then skip only a non-collider lake envelope. Previews and unchecked callers retain their old protection, while actual shoreline colliders and other venues still reject conflicts. Tests cover dry, wet-center, wet-rim, preview, shoreline and unrelated-venue cases, including the real camp builder and lake fixture.

The formerly empty district `woodland:1,-2` now contained **six actual registered camps** in the Low browser inspection, including one hearth and four chair claims. [The restored group](restored-camp-low.jpg) shows its real top-down placement. High also completed the ready boot and repeated teleport sequence, and inspection confirmed six built camps in this district, without console errors.

## Limits and related planning

This is desktop correctness evidence, not physical-phone performance approval or an audible music evaluation. Pause freezes rendering as well as simulation, so a camera/time change made while paused becomes visible on the next step or resume. Performance recording uses the existing local recorder, with no command that uploads or deploys data.

Astra separately completed [the terrain proposal](../../terrain/2026-10-24-proposal.md), which recommends rolling country and level plateau destinations before rare mountain routes, through one shared deterministic surface contract. It is a proposal with source citations and future acceptance gates, not terrain implementation or a passed terrain experiment. Both one-time wakeups are paused after handling.
