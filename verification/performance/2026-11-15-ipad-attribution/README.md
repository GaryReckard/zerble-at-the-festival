# iPad attribution preparation, November 15

**TL/DR:** Capture instrumentation, report support, launcher controls and documentation corrections are implemented. A real Low capture verifies the data path, while ordinary Mid gameplay still boots. A subsequent reserved-Mac window passed the declared descriptive observer-overhead check and froze publication thresholds, while retaining a 72.9 ms target miss. The physical-iPad session remains open; no performance improvement is claimed. See the [desktop-window report](desktop-window/README.md).

## Source and scope

The checkout fast-forwarded to `558c9f3`, including the [full council decision](../../../openspec/changes/ipad-performance-strategy/deliberations/001-next-levers/results.md), with existing local Lantern Night changes restored through Git autostash. A separate pre-integration backup lives at `/private/tmp/zerble-before-report-integration-20261115.tar.gz`. This report describes a dirty working tree, not an isolated clean commit or a deployed release.

The implementation follows the [change contract](../../../openspec/changes/ipad-performance-strategy/specs/capture-attribution/spec.md) and [design](../../../openspec/changes/ipad-performance-strategy/design.md). The new [frame helper](../../../src/frameAttribution.js) sums exclusive sections, the [horizon helper](../../../src/horizonCapture.js) observes successful publication, and [environment metadata](../../../src/captureEnvironment.js) preserves unknown manual fields. Existing physics, population, quality and horizon defaults are retained. The [four-run procedure](../../../docs/performance-playtests.md#four-run-ipad-attribution-session) fixes Low tier, seed and route, while labeling physics-off as legacy driving.

## Functional evidence

The managed in-app browser used a native ready Just Cruisin' click, muted audio and seed `2404796662`. A Low baseline parked capture completed and displayed `PERF · SAVED ✓`. Its [raw report](functional-low-capture.json), [formatted output](functional-low-report.txt) and [derived validation](functional-validation.json) retain 3,624 detailed frames across 62 phase/rung groups. Every group has exactly `sum(sectionMs) == workSumMs`, with zero partition error, 3,632 physics steps, one observed horizon publication and no captured errors. This checks integration and serialization; it does not measure incremental instrumentation overhead.

Manual environment fields remained unknown except for the explicit `DesktopFunctionalSmoke` label. The title cadence estimate is included and explicitly does not identify hardware refresh rate. The [horizon field notes](horizon-notes.md) distinguish attachment latency from first-request latency, atomic units from yielding preparation calls, and actual publication from planning.

The [legacy November 8 report](legacy-report.txt) was regenerated from the retained physical-iPad baseline using the updated reader. No new timing fields are invented for that old capture.

## Low-tier composition census

The free-driving game used Low baseline, the same seed and the Noon preset. The in-game `/tp` command placed the cart at the three November 8 route anchors; the third cart position settled about 2.2 metres from the requested coordinate because collisions remained active. These are stationary composition observations rather than a matched driving replay. Requested and successfully published horizon cells agreed in all three snapshots, with publication counts advancing from one to three.

| Anchor requested | Actual submitted draws | Pre-frustum visible meshes | Horizon mesh submissions before frustum | Horizon instances |
| --- | ---: | ---: | ---: | ---: |
| -230.3, -691.8 | 1,133 | 3,250 | 7 | 828 |
| -378, -628 | 731 | 3,690 | 7 | 836 |
| -429, -585 | 898 | 4,149 | 7 | 832 |

[Summary](census-summary.json), [first snapshot](census-anchor-1.json), [second snapshot](census-anchor-2.json), [third snapshot](census-anchor-3.json). Each snapshot retains geometry/material groups and the named horizon share. Ancestor-hidden meshes, invisible materials, empty instance pools and zero draw ranges are excluded. Scene-graph composition is pre-frustum and cannot be divided by actual renderer calls to claim an exact owner percentage. This confirms that the old 80-draw HUD guide does not match these scenes, but does not establish a replacement budget or a bottleneck.

The census exposed an existing debug relocation bug: the overlay moved only the visual cart, allowing the physics owner to restore its previous pose. Successful command and landmark relocations now notify physics and player statistics, while rejected support destinations do neither. The [teleport regression](../../../bin/test-debug-teleports) exercises both outcomes, and the retained live census coordinates verify that relocation persists.

## Browser checks and cleanup

Low with detailed capture and ordinary Mid without capture both booted through their native ready title buttons, continued into the world, and passed console inspection. The Mid [console error list](mid-console-errors.json) is empty; Low captured errors are empty in the raw report. Noon and Midnight evidence is retained for both tiers: [Low Noon](low-noon.jpg), [Low Midnight](low-midnight.jpg), [Mid Noon](mid-noon.jpg), [Mid Midnight](mid-midnight.jpg). Desktop muted clicks do not establish physical-iOS audio unlock.

All task-created managed browser tabs were closed. No standalone browser, software WebGL daemon or headless GPU worker was launched. The user-requested Vite server remains running at `http://127.0.0.1:8765/`; an earlier task-owned server that stalled after the Git/config reload was stopped and replaced, and the replacement returned HTTP 200.

The first immutable snapshot attempt failed because `menu-preview.html` imported a script under `verification/`, outside the snapshot source inventory. The preview entry now lives at `src/menuPreview.js`, keeping runtime modules inside the normal source inventory. The failed snapshot and build log remain under `.claude/captures/performance-lab/snapshots/88d2185fd6d46c79829de9c4c20f4df73ecbfa54f090c4759d55d01e1eeb1d67/`.

## Verification and remaining gates

The [check log](check.log) and [build log](build.log) record the passing final full suite and production build. The relocated menu preview also passed its focused UI/toolchain tests and a live Settings boot with no console errors. The [prepared immutable snapshot](prepared-snapshot.json) built successfully after that move; it records source/build hashes and the dirty checkout identity, and does not satisfy the clean-session freeze gate. Focused tests cover exclusive nested timing and disposal, previous-callback attribution, frozen module namespaces, exactly one existing matrix traversal, bounded phase/rung reporting, scalar physics reads, byte-identical horizon pools/roads, metadata validation, launcher defaults and invalid inputs, draw census filtering, and legacy report parsing.

The [reserved-Mac follow-up](desktop-window/README.md) completes the four-run descriptive overhead check and freezes sampled publication thresholds before a separate detailed check. It retains a 72.9 ms duration-target miss, and applies to the pre-landing-fix snapshot. Semantic owner attribution, the final clean device-build freeze and physical-iPad acceptance remain open. The [performance-lab skill](../../../.agents/skills/performance-lab/SKILL.md) requires another explicit reservation for any future timed session outside the granted window.

After those foundation gates, use the four-run physical-iPad session: Auto, locked baseline, Auto repeat and horizon off. Retain model, power, heat and interruption context, then choose a separate optimization only from that evidence. The [task ledger](../../../openspec/changes/ipad-performance-strategy/tasks.md) remains the acceptance source.
