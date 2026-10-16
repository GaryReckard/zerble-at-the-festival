# Gate B: Heart upgrade in the game

The Heart slice is ready for Gary's playtest. On a clean profile, the actual Lurleen proximity one-shot earns Heart, starts the four-second burst immediately, keeps the original found toast for its full 3.5 seconds, then shows the upgrade toast. Earned Heart persists and joins the normal bubble stream after reload. The menu is available on the title card, beside Settings in the game, and through `U`.

## Sequence

| Moment | Evidence |
| --- | --- |
| Clean profile and title entry at 375×812 | [Phone title](title-phone.png), [fresh menu with ten locked cards](fresh-menu-low.png) |
| Real Lurleen trigger, before the 3.5-second found toast ends | [Found toast and Heart burst](heart-real-trigger-phone.png). In the same browser evaluation, earned IDs changed from `[]` to `["heart"]`, Lurleen entered `aware`, and the burst had 3.77 seconds left. No debug unlock was used for this capture. |
| Upgrade toast after the found toast | [High-tier upgrade toast](upgrade-toast-high.png). The browser read `New bubble upgrade: Heart Bubbles! 💗` after the 3.5-second delay. |
| Later stream | [Low](heart-stream-low.png) and [High](heart-stream-high.png) chase views. The live renderer reported 22 Heart instances on Low and 21 on High in these samples. |
| Earned menu | [Low](heart-menu-low.png), [High](heart-menu-high.png), and [375×812 phone](heart-menu-phone.png). The heading reads `1 of 10 found · Bubble charm +4%`; the unread dot clears on opening. |
| In-game phone control | [Low-tier phone HUD](game-phone-low.png) with the upgrades button next to Settings. |

## Functional checks

- Low and High both displayed the title and entered the world through the real Start button with zero browser page errors. The menu also had zero axe WCAG A/AA violations on Low; axe could not decide color contrast against the translucent gradient. The lowest text alpha yields an approximately 4.96:1 contrast against the lightest panel color, and the phone capture was inspected manually. The in-game button and earned switch measure at least 44×44 CSS pixels, and the menu scrolls at 375×812.
- In Just Cruisin', the GA4 stub saw exactly one `bubble_unlocked` event with `type: heart`, `mode: cruisin`, `unlocked_count: 1`, and `time_in_run_s: 22`. Festival Run recorded exactly one with the same type and count, `mode: festival`, and `time_in_run_s: 21`. Opening the menu recorded one `upgrades_menu_open` event. Disabling Heart recorded `feature_used { feature: upgrade_toggle }` and persisted `disabled: ["heart"]`; re-enabling and reloading preserved Heart without another achievement event. In a separate fresh profile, the unread dot survived a reload and cleared from both the button and storage when the title menu opened.
- The Festival Run remained active while Heart bubbles streamed. A three-second sample held score at 62 and vibe at 0 with 21 specials alive; juice followed its ordinary drain from 2.8597 to 2.8379. The special emitter has no separate juice deduction. As specified in the plan, specials can still make nearby people smile through the normal bubble path; the separate charm multiplier is reserved for Checkpoint 5.
- With 27 Heart instances alive on Low at phone width, the game's pre-postprocessing scene counter reported 790 draws and 369,143 triangles with `specialRoot.visible = false`, then 792 draws and 387,147 triangles when restored. The unchanged world was sampled within one second. The raw `renderer.info.render` fields reported `1` because postprocessing overwrites them, so the comparison uses `renderer.__sceneInfo`.
- The unlock sound schedules four rising notes through the shared SFX bus. `bin/test-upgrade-sound` checks the note order, envelopes, routing and pre-init guard; the existing mute test checks the downstream session mute. The muted browser pass did not audition speaker output.
- All new `__dbg` hooks ran in a separate Low-tier session: `upgrades`, `unlock('heart')`, `relock('heart')`, `relock('all')`, `forceSpecial('heart'|null)`, `unlockBurst('heart')`, `lifetimeSmiles(999)`, and `challenges`. The debug unlock produced zero `bubble_unlocked` GA4 events. A U keydown opened the dialog, and U closed it again while focus was inside.
- [Full `npm run check` output](npm-run-check.txt) passed after the slice changes.

## Reproduce

Use `http://127.0.0.1:8765/?perf=low&mute=1` or `?perf=high&mute=1`. Start the game, find Lurleen, and open Bubble Upgrades from the heart button. On localhost, `__dbg.game.lurleen.position` and `__dbg.teleport(x, z)` make the real proximity trigger easy to reach. `__dbg.unlock('heart')` is a separate visual drill and reports mode `debug`, so it sends no achievement to GA4.

Gary approved this slice as Gate B on 2026-10-15. The other ten unlock triggers are implemented and documented in the [Gate C review packet](../checkpoint-4/GATE-C.md); the actual crowd charm gain follows Gate C approval.
