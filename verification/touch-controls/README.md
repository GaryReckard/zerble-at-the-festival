# Focused touch controls verification

Verified locally on November 17, 2026. This record covers the focused layout,
floating joystick, compact menu and gentle chase-camera return. The
[bounded Astra review](../../openspec/changes/focused-touch-controls/reviews/astra-plan.md)
preceded implementation. The [change artifacts](../../openspec/changes/focused-touch-controls/README.md)
describe the decisions and acceptance criteria.

## Automated checks

- `bin/test-touch-comfort` passed against the production Touch/Input handlers,
  including floating-stick acquisition outside the old base, simultaneous stick
  and camera movement, pinch ownership, cancellation, viewport-edge anchoring and
  restoration of the base and knob after release.
- `bin/test-touch-camera` passed against the production camera with terrain
  disabled, including held gestures, release grace, frame-rate independence at
  30/60/120 Hz, parked/stopped/reverse vetoes, forward restart grace, mouse and
  keyboard overrides, reset, angle wrapping and alternate views. Zoom is retained.
- `bin/test-passport-integration` passed with touch-menu pause and progress gating.
- `npm run check`, `npm run build` and
  `openspec validate focused-touch-controls --strict` passed. The full check
  includes the existing vehicle braking regressions.

## Browser observations

Used the in-app browser with muted URLs. The renderer-free production-controls
fixture is `menu-preview.html?screen=touch&touch=1&mute=1`. Real game checks used
the localhost-only `touchLayout=1` override, Low and Mid quality, and the actual
enabled mode-selection plank. This override changes layout and does not emulate
native finger events.

- At 844×390 and 568×320, Brake, Honk, Boost, Park, Menu and the compact map fit
  within the viewport. At 568×320 the menu panel was 420×293.5 pixels and all
  actions remained accessible. The compact map remained at the top after resize.
- Settings, Passport and Bubbles returned to the parent menu and its originating
  action when closed. The Bubbles sheet reported that the festival was paused.
  Tab and Shift+Tab wrapped inside the parent menu.
- In the real Low game, opening Settings through Menu and returning preserved
  the observed day-cycle label, juice and smiles values. Resume returned to play.
- The real Mid game switched once from Chase to First-person through the menu.
  The fixture also verified that Camera and Music callbacks survive input clearing.
  The fixture's Music action is a state stub; actual MIDI playback was not tested.
- The real map expanded and its controls remained usable. Low and Mid day/night
  boots showed no browser console errors during these checks.
- At 390×844, the existing rotate-phone guidance appeared while the menu stayed
  paused. Portrait gameplay is not claimed as supported.

| Capture | Evidence |
| --- | --- |
| [Short controls](short-controls.jpg) | Focused controls and compact map at 568×320 |
| [Short menu](short-menu.jpg) | All menu actions fit at 568×320 |
| [Live menu](live-menu.jpg) | Paused menu over the real game |
| [Low daytime](low-daytime.jpg) | Real Low-quality daytime boot |
| [Low midnight](low-midnight.jpg) | Real Low-quality night rendering |
| [Mid daytime](mid-daytime.jpg) | Real Mid-quality daytime boot |
| [Mid midnight](mid-midnight.jpg) | Real Mid-quality night rendering |
| [Portrait guidance](portrait-guidance.jpg) | Existing rotate-phone guidance |

## Limits and cleanup

Physical-phone thumb comfort, accidental touches and the subjective camera return
still require hands-on acceptance. Native gesture ownership and camera behavior
were exercised through the automated production handlers, not physical fingers
in the browser. These checks make no frame-time improvement claim.

The owned browser tab was closed, its viewport override was reset, and the owned
Vite server was stopped. No standalone headless browser was launched. The change
was verified locally and was not committed or deployed as part of this work.

## Edge-spacing refinement, November 17

The touch status rail now meets the top-left safe-area boundary, retaining its
internal padding and a rounded lower-right corner. The resting joystick is 12px
from the left and bottom safe-area boundaries, replacing 28px. Brake is 12px
from the right and bottom safe-area boundaries, replacing 20px; Honk and Boost
move with that group. Button sizes remain unchanged. Park sits 12px above Boost
and its right edge aligns with Brake, with identical geometry for Unpark.

The 12px interactive margin is a design starting point, not a measured universal
thumb-reach optimum. It keeps some space beyond the hardware/system safe area;
the read-only status rail does not require that touch margin. Apple's
[handheld-game guidance](https://developer.apple.com/videos/play/meet-with-apple/243/)
distinguishes safe areas from comfortable control margins. Physical-device
comfort and system-edge gesture interference still need hands-on acceptance.

Browser checks covered the combined production fixture at 568×320 and a real
Low game at 844×390, started using the enabled mode plank. The fixture's Park
and Unpark bounds both measured x492, y80, width64, height48. Brake's right
edge matched Park at x556; the status rail began at x0, y0, and the resting
stick began at x12 with 12px bottom clearance. These desktop checks have zero
device safe-area insets and do not establish physical notched-phone behavior.

The real game's status rail also began at x0, y0, and its Park/Unpark and Brake
right edges matched at x832. Noon and Midnight command captures showed the
controls over the real scene, with no captured console errors. The owned tab
was closed, the viewport reset and the temporary server stopped.

- [Short landscape with Unpark](edge-short-unpark.jpg)
- [Real game at daytime](edge-daytime.jpg)
- [Real game at midnight](edge-midnight.jpg)

`npm run check`, `npm run build` and `git diff --check` passed after this
refinement. The implementation remains local and uncommitted.

## Compact passenger sidebar, November 17

Touch layouts now place the destination cards and the shared toast/dialogue slot
in `#passenger-sidebar`, flush with the left safe area and 8px beneath the
measured status rail. The column is 164–232px wide, depending on viewport width,
and ends 12px above the resting joystick. The heading and persistent help are
hidden on touch; each destination button retains its full accessible label and
tracking callback. The desktop wrapper uses `display: contents` and preserves
the existing centered presentation.

Destination cards scroll in their own area when several requests or long names
exceed the available height. Dialogue/messages wrap and scroll in a separate
area capped at half the column height. Expired messages leave no layout space.
This includes the shared warning toast slot, preserving the existing warning
priority and expiry rules.

Extended the renderer-free production fixture:

```text
menu-preview.html?screen=rides&touch=1&single=1&mute=1
menu-preview.html?screen=rides&touch=1&long=1&mute=1
```

The fixture now includes the production input, menu, map, parking control and
compass together. `single=1` shows one request; `long=1` exercises three requests,
a long destination name and a long hailing message. These are synthetic fixture
requests, not live quest acceptance.

Observed in the in-app browser:

- At 568×320, the sidebar occupied x0, y48, width164, height108; its bottom was
  y156 and the resting joystick began at y168. The three-card list scrolled, and
  selecting the long third card invoked the fixture's real compass callback.
  Its full accessible label remained available. The long message also had
  scrollable overflow without extending into the joystick.
- At 844×390, the sidebar occupied x0, y54, width232, height172; its bottom was
  y226 and the resting joystick began at y238. A single card and dialogue fit
  without scrolling.
- Without the touch flag, the fixture retained its centered cards, heading/help
  and toast beneath the cards. The wrapper's computed display was `contents`.
- A real Low game started from the ready mode plank. Supported `/quest give`
  commands created side-stage and main-stage requests; the actual passenger
  dialogue appeared in the same sidebar. Clicking a real destination remained
  available. Captures used `/time noon` and `/time midnight`; no console errors
  were captured. Desktop viewport forcing does not prove physical touch feel.
- The production `QuestCompass` regression exercises wrapped status-rail height,
  resize measurement, no frame-loop geometry reads and observer/offset cleanup.

Captures: [short landscape](sidebar-short.jpg),
[real daytime cards and dialogue](sidebar-daytime.jpg),
[real midnight](sidebar-midnight.jpg).

The owned tab was closed, viewport reset and temporary Vite server stopped.
This section records local verification before the authorized release; earlier
uncommitted-status notes describe the preceding checkpoints.

The final `npm run check`, `npm run build`, `npm run test:toolchain:http`, strict
validation of both control changes, README status checks and local documentation
link checks passed before committing. HTTP checks exercised development and
production project-subpath serving and closed their owned servers.
