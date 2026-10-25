# Festival Passport verification, October 25, 2026

[Feature contracts and analytics setup](../../../docs/passport.md) · [OpenSpec change](../../../openspec/changes/festival-passport/README.md)

## Result

The pure store, live hooks and player menu passed the focused tests and the full `npm run check` command. The final full run exited 0; [selected command output](checks.txt) retains test outcomes without the existing Node module-type warnings. The game booted through ready mode-button clicks in Low Just Cruisin' and Mid Festival Run, with no runtime errors in the final inspected console. Local GA is disabled by the existing hostname gate, so analytics payloads/failure behavior are exercised through the real Analytics wrapper in the integration test rather than sending development data to production.

## Behavioral evidence

- `node bin/test-player-stats` covers travel away and back, six permanent stamps, organic smile counters, once-only migration, corrupt/malformed/blocked storage, save retries, seed-qualified stages, relocation followed by driving, settings visit continuity and consumed telemetry checkpoints. Tests assert actual values, including 1,050 m driven for an out-and-back journey whose furthest radius is 525 m.
- `node bin/test-passport-integration` executes the actual main eligibility predicate and paused-render branch, the real challenge observer and bubble pools, the GA whitelist transport and keyboard/touch state. It rejects every ineligible lifecycle state, preserves discovery after an initially rejected stage encounter, counts no births for exhausted pools/invalid types, counts burst births, strips names, coordinates and stage identities, consumes failed transport attempts and suppresses repeated held keys until fresh input.
- Actual keyboard driving on Low yielded separate readings of 20 m from the entrance and 21 m driven, plus raw pickups and a damaging bonk. A settings restart subsequently showed 37 m from the same original entrance and 38 m driven, demonstrating that restart did not redefine spawn as the saved location. An ordinary navigation/reload began a fresh visit while retaining the previous all-time record.
- The final Low smoke test showed a fresh visit with 9 m driven and 14 s active time; the All time tab retained 48 m driven, 47 raw smiles, 1,056 bubbles, three passenger boardings, one bonk and the 37 m record from earlier visits. Bubble Maker remained earned after reload.
- During the real Mid Festival Run, juice, day-cycle position and HUD score remained identical across an extended passport-reading interval: 78%, Late night at 81%, and 31 smiles. [Before/after observation](pause-observation.json) records the exact DOM labels. This checks simulation pause in addition to input suppression.
- Title-card access, the game book button, P/Escape, arrow-key tab selection, Shift-Tab focus wrapping and focus restoration were exercised through the actual browser controls. The focus trap returned from the close button to the selected tab panel, and the accessibility tree exposed only the modal while open.
- The DOM fixture verified a populated passport, unavailable-storage wording and long totals at 390 × 844. Large counts use compact visible formatting with exact accessible values. The real title's five links and the live passport were inspected at 844 × 390. The phone viewport checks use the desktop in-app browser, not a physical touch device.
- `bin/check-importmaps` passed all five pages. `python3 bin/test-perf-server` passed with the additional LAN stylesheet assertion. The preview remains loopback-only in the LAN allowlist.

## Captures

| Capture | Evidence |
| --- | --- |
| [Final game](game-final.jpg) | Final Low live-game passport after actual driving. |
| [Desktop fixture](desktop.jpg) | Final production menu with deterministic populated data. |
| [Low at Noon](game-low-noon.jpg) | Real Just Cruisin' integration with live pickups and emissions. |
| [Mid at Midnight](game-mid-midnight.jpg) | Real Festival Run integration and readable paper styling at night. |
| [Phone landscape](landscape.jpg) | Live modal fits 844 × 390 and scrolls within its panel. |
| [Landscape title](title-landscape.jpg) | All five menu links fit and remain readable. |
| [Long totals](mobile-long.jpg) | Final 390 × 844 compact billion-scale values. |
| [Stamps and save failure](mobile-stamps-storage.jpg) | Scrollable stamp cards and explicit unavailable-storage message. |

The earlier Noon/Midnight captures precede the final short-duration display refinement from minutes to seconds; the final game and fixture captures show the shipped formatting.

## Combined terrain integration

After the isolated feature commit `6038b50`, Astra committed terrain as `4bf38de`. The two were merged in the passport worktree, preserving both suites, all importmap entries, both changelog entries, and both responsibilities of debug teleport: mark passport relocation and ground the cart on the terrain surface. The combined `npm run check` exited 0; [combined command evidence](combined-checks.txt) includes the new terrain regressions and passport cases.

The actual merged `/?mute=1&perf=low&seed=1977&terrain=1` started through the ready Just Cruisin' button and recorded 27 m of real keyboard driving, 11 raw smiles and 155 successful emissions with no runtime errors. [Combined live capture](game-terrain.jpg).

A subsequent `/tp 620 -20` followed by one second of actual keyboard driving showed a physical distance of 1.04 km but kept the exploration record at 44 m and total driven distance at 49 m. The passport displayed its relocation eligibility message, and the console remained clean. The smaller record had grown through legitimate coasting before the command, while the kilometre jump did not become driven distance or an exploration achievement. [Observed text](terrain-relocation.txt) and [capture](terrain-relocation.jpg) preserve that result. This is a passport/terrain compatibility smoke check, not a new claim of terrain release acceptance.

## Limits and cleanup

No physical iOS audio-unlock test, touch hardware test, cross-browser Safari test, GA property configuration or production ingestion claim is made. The feature adds no geometry or shadow casters, and this was a functional UI/lifecycle check rather than device performance measurement. The existing game still simulates hidden tabs; passport observations are gated out during that time. The personal save uses one browser-origin key and does not merge simultaneous game tabs.

Implementation and checks ran in `/private/tmp/zerble-festival-passport` on `codex/festival-passport`, based on `92d3344`, independently of the concurrent uncommitted terrain integration. No standalone headless browser was launched. All created in-app tabs were closed, the temporary viewport override was reset, and the loopback server on 8774 was stopped. A direct `ps -p 41455` check returned exit 1 with no output, confirming that the exact owned server process was gone.

The combined verification also closed its sole created game tab and stopped its temporary server; direct `ps -p 43468` returned exit 1 with no output.

## Wider layout and close-control refinement

Gary requested a cleaner close button and a wider modal that avoids constant scrolling. The panel now grows to 1,080px and, above the 1,000px breakpoint, places a three-column statistics grid beside compact achievement cards. At the default 1280 × 720 viewport, the populated preview measured 644px client height and 644px scroll height, so there was no vertical overflow. The real Low game measured 634px for both. Smaller screens retain the stacked, scrollable layout.

The centered SVG close icon has a measured 44 × 44px target. Opening focuses the dialog, eliminating the automatic double-circle appearance; Tab gives the button its single inset focus outline. Shift-Tab from the initial dialog focus wraps to the statistics panel, and Tab wraps back to the close button. Native click and Escape closing were verified, and the 390 × 844 preview remained readable. The actual game booted through its mode button, and Noon/Midnight checks reported no console errors. `npm run check` exited 0; the focused integration suite and syntax check also passed after the final focus adjustment.

[Wide populated preview](desktop-wide.jpg), [mobile close control](mobile-close.jpg), [live Noon](wide-noon.jpg), and [live Midnight](wide-midnight.jpg) show the revised layout. Earlier captures retain the original narrower design as historical evidence.
