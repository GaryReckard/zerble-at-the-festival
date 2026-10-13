# Nut Wagon adversarial review

Requested by Gary after implementation commit `1798328`. Reviewer: gpt-6-sol, medium reasoning, read-only sub-agent. Follow-up scope: the clearance and recovery diff committed with this record.

## Findings and resolution

1. **P2: clearance missed the platform and shoreline corners.** The old 3.4 m cardinal checks accepted a prop five metres ahead despite platform overlap. `src/nutWagonRoute.js` now checks rotated body/platform rectangles against circles and samples their covered area for water. `bin/test-nut-wagon` covers the reported prop, rotated platform, hatch and shoreline cases.
2. **P2: blocked routes could remain cruising indefinitely.** The moving-time counter did not advance while stopped. `src/nutWagon.js` now tracks blocked time separately and parks after eight seconds before reversing direction. `system.html` verifies the parked state and recovery direction.
3. **P2 follow-up: a U-turn could deadlock in a narrow corridor.** Backtracking now preserves route-tangent heading and uses reverse gear, including signed wheel rotation. `system.html` verifies backward movement without rotating into a roadside obstacle.

## Verification

The same reviewer confirmed the recovery fix, ran `node bin/test-nut-wagon`, and reported no further concrete issue in the follow-up diff. The reviewer did not use a browser. Parent-agent controller checks pass 25 assertions on both Low and Standard, saved in `system-low.json` and `system-standard.json`. The parent also booted the muted live game after the fixes. See `GAMEPLAY.md` for broader validation and the whole-scene performance limitation.
