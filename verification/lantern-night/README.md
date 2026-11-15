# Lantern Night title and menus

The supplied Lantern Night direction is implemented in the existing game UI. The title, help, settings, passport, upgrades, leaderboard/results, HUD launchers, map overlay and portrait message share the indigo, cream and lantern-button treatment. The real game systems still own audio, scores, discovery, progress and map rendering.

## Design source and implementation

The source was Gary’s `Documents/Zerble Festival Title & Menu.zip`, containing `design_handoff_zerble_lantern_night/README.md`, tokens and clickable HTML references. Archive SHA-256: `924c573b0af6f80e35cb3cfbcf00b5514a7be09eccd0f68d1dda75cd7e847fa1`. Gary requested implementation on November 14, 2026, which authorized the supplied layout changes, including the hanging navigation, labeled launchers, shared help sheet, inline map confirmation, gameplay upgrades drawer and “Lit” memory wording. No prototype runtime, simulated world or prototype storage/scoring logic was shipped into the game.

The [skin](../../lantern-ui.css) defines the palette, self-hosted Caprasimo/Outfit fonts, buttons, outlines, fixed sheet headers/footers, scrolling bodies and compact landscape layout. The existing title art is retained, and the obsolete wooden-plank CSS was removed from [styles.css](../../styles.css). Font licenses live beside the font files in [assets/fonts](../../assets/fonts/).

[menuUi.js](../../src/menuUi.js) owns focus containment/return, Escape and shortcut handling for help, settings, scores and upgrades. It runs after target handlers so tab/radio arrow navigation works, excludes negative-tabindex controls from the focus loop. The map owns no menu keyboard guard, so new driving keys continue to reach gameplay. Passport retains its existing inert-background and gameplay-pause lifecycle in [passportMenu.js](../../src/passportMenu.js).

[Settings](../../src/settings.js) retains the actual effect, volume and persistence APIs. Restart notices identify pending items, including saved light changes when reopening. Map reset still requires an explicit confirmation and only calls the current map’s existing reset method. The [HUD](../../src/hud.js) keeps the synchronous trusted-gesture start callback and the existing replay/reload behavior. Result dismissal cannot bypass its actions. [Upgrades](../../src/upgradesMenu.js) keeps hidden discoveries, earned/enabled state and charm rules, while adding the progress bar, labeled switches and unread marker on both entry points.

The [map view](../../src/festivalMap/view.js) retains its worker, discovery, cache and real Canvas geography. After review, its expanded view is again a full-screen translucent driving overlay beneath HUD/touch controls. The logical viewport follows the full-screen canvas, with a small indigo zoom/close toolbar and a single selected-destination label. The destination list is clipped for keyboard/screen-reader access rather than displayed as a wall of pills; a focused keyboard destination alone becomes visible. Compact cream outlines and the touch minimap position below the launchers are retained.

## Verification

The latest [extended title scene and original bubble plume](title-extension/README.md) adds four generated scenery margins around the original subjects, with tablet/ultrawide framing, restored original bubble paths behind Zerble, and shared production/preview initialization. Its [gallery](title-extension/gallery.html) supersedes earlier title captures below.

November 15 follow-up: the map's opaque sheet, destination-pill wall and modal keyboard guard were removed after gameplay review. The [input check](map-input-followup.txt) now tests newly pressed throttle/steering through a focused map control as well as the original held-stick behavior. The [transition check](map-transition-followup.txt) asserts transparent full-screen bounds, original geography opacity, passive dimming and clipped destination controls. The smile counter uses plain Outfit tabular digits without glow, and the title logo's desktop maximum increases from 360px to 720px while retaining the compact landscape height limit. The full [follow-up checks](followup-check.log) and [production build](followup-build.log) pass. A native one-second W press with the live map open moved the cart from (630.0, 224.0) to (640.5, 226.1), while M and Escape closed normally. Live Low captures cover Noon, Midnight and compact landscape; the final [console error capture](followup-console-errors.json) is empty. The [follow-up contact sheet](followup-contact-sheet.jpg) shows these revisions. Earlier gallery captures retain the initial proposal for comparison.

Follow-up: the original independently timed sky/mountain/festival drift and foreground sway were restored after the title review. [Live DOM observations](title-motion.json) show changing transforms and all four animations disabled by Reduced motion; restoring the preference resumes them. A native ready-mode click started the real game and paused every hidden title layer, with no error entries in the observed console. The [updated title capture](screenshots/title-motion-restored.jpg) records the composition; a still image cannot demonstrate motion. The existing contain fit and original artwork dimensions are unchanged.

- `npm run check` passed. The complete output is in [check.log](check.log). Final focused menu, boot and settings checks are in [menu-tests.log](menu-tests.log); the [menu regression](../../bin/test-menu-ui) covers focus wrap/return, inactive tabs, confirmation cancellation, result dismissal, modified shortcuts, delayed-focus disposal and retained map driving input.
- `npm run build` passed, including the registered renderer-free `menu-preview.html` entry. [Build log](build.log) and the final [toolchain check](toolchain.log) cover output wiring, module/export resolution, 2D isolation and real Three.js aliases. The full suite passed before the final preview registration, which was then checked with the focused toolchain/build tests.
- The [server tests](server-tests.log) cover the narrow LAN asset boundary. `lantern-ui.css` is allowed while the contributor menu fixture stays outside the LAN page allowlist. Fonts remain under the already permitted assets directory.
- The real Low game was entered through the ready Just Cruisin’ button, with `mute=1`. Noon and Midnight captures show the actual world beneath the new HUD and menus. The [live console error capture](live-console-errors.json) is empty. No material, world-generation, scoring or audio-unlock logic was changed.
- The live Passport held identical score, juice and day-cycle HUD values while open, then restored focus to its book launcher on P. [Pause observation](passport-pause.json). The U shortcut likewise closed the live upgrades drawer and restored its launcher.
- At 1280×720 and 844×390, production menu fixtures exercised fixed close/actions, scrollable content, keyboard and touch help, earned/off and locked upgrades, unread clearing, results that stay open on Escape, view-only leaderboard, loading and retry. The restart notice appeared after selecting Low and disappeared when Auto was restored. Escape canceled map-reset confirmation before closing Settings. Tab from the last active settings control wrapped to Close, and closing restored the title launcher.
- A retired entrance animation was removed because its temporary transform re-anchored fixed navigation and the help sheet. The final [title layout observation](title-layout.json) records the stable 844×390 viewport, no page animation, top navigation position and cleared unread state.
- The real Reduced motion switch suppressed the mode-button transition, then was restored to its initial off value. [DOM observation](reduced-motion.json). The portrait CSS was captured at 390×844. The official memory-only Passport fixture supplied unavailable-storage styling.
- The map workshop’s [transition check](map-transition-result.txt) passed 73 animation frames, including reversals, backing retention and canvas/frame agreement. The [input check](map-input-result.txt) passed held-stick preservation, release, music/map separation and Space isolation.

All screenshots are in [the gallery](gallery.html), which separates the latest revisions from the initial proposal. The new compact title is a production UI fixture, and the other follow-up images show the real game. In the original capture set, files with `game-`, `title-` or `passport-midnight` show the real game; other files show production DOM with sample fixture data or the map workshop. Fixtures are labeled and are not gameplay acceptance evidence. Some captures preceded the fixture’s move from its temporary nested URL to the registered `menu-preview.html` entry; the production components are the same.

## Reproduce

Start `npm run dev` from the repository root and append `mute=1` to every game/fixture URL.

- `/menu-preview.html?screen=settings&mute=1`
- `/menu-preview.html?screen=passport&blocked=1&mute=1`
- `/menu-preview.html?screen=upgrades&locked=1&mute=1`
- `/menu-preview.html?screen=results&empty=1&mute=1`
- `/menu-preview.html?screen=loading&mute=1` or `screen=failed`
- `/menu-preview.html?new=1&mute=1` for the unread title marker.
- `/passport-preview.html?case=long&mute=1` for large counts, or `case=blocked` for saving unavailable.
- `/festival-map-preview.html?mute=1` for the real map transition and input checks.

The menu fixture imports current index markup and the production menu modules, with memory-only passport/upgrade progress and no WebGL. Settings still uses its real preferences; restore any values changed during inspection. Sample result actions do not submit a run. Live game startup, audio and clocks must be checked through `/`, not inferred from the fixture. The normal preview build also includes the fixture.

## Limits and cleanup

These are desktop-browser layout and integration checks, not a physical iPhone/iPad, Safari audio-unlock, VoiceOver or performance acceptance run. The start callback still initializes audio synchronously, but captures remained muted. No FPS improvement is claimed, and the world’s existing draw/triangle budget indicators are not a result of this DOM redesign.

The working game and fixture tabs were closed, viewport overrides were reset, and the task-owned development server was stopped. No standalone headless WebGL browser was launched, no map history or progress was reset, and no fake score was saved/submitted. Ordinary real-game smoke testing accumulated a small amount of normal local progress. Unread test state was cleared by reading Upgrades, while quality and reduced-motion test choices were restored.
