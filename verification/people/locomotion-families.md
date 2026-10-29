# Specialist people locomotion, October 29, 2026

TL/DR: The adult gait now has an explicit reusable sampler and specialist adapters,
so children, wooks, moving frisbee players, musicians, the marshal, carriers,
monks and cooks have travel footwork. Hoopers retain their performance while
shuffling, and fire dancers retain their orbit and arm choreography while stepping.
Stationary performers, vendors, seated passengers and vehicle riders keep their
intentional poses.

## Family coverage contract

The [machine-readable inventory](locomotion-families.json) records the current
family policies. `bin/test-person-family-motion`, included in `npm run check`,
checks real native models, publication authority and that every file in
`src/people/` importing a `build…` function from `models/` has a documented
policy. This catches a new model-builder import in that directory; it cannot
automatically identify a humanoid constructed elsewhere or a renderer added
without a builder import. Such additions must extend this inventory and its
native/visual cases.

| Family | Intent and coverage | Verified owner/source |
| --- | --- | --- |
| Crowd adults | Shared distance gait; seated, sleeping, hammock, potty, photos, dance and instrument poses retain priority. | [src/crowd.js:1583](../../src/crowd.js#L1583) |
| Borrowed frisbee participants | Claim-validated travel delta drives Crowd legs; throw/catch arm joints retain priority. | [src/people/frisbeeActivity.js:96](../../src/people/frisbeeActivity.js#L96) |
| Borrowed hula participants | Approach/exit supply accepted travel; stationary hooping retains authored hip and raised-arm pose. | [src/people/hulaActivity.js:38](../../src/people/hulaActivity.js#L38) |
| Children | Travel stride and free arm; right accessory hand protected; bubble waiting is grounded. | [src/people/children.js:458](../../src/people/children.js#L458) |
| Wooks | Distance gait through cached rigid rotation morphs; small travel sway; grounded rest. | [src/people/wooks.js:262](../../src/people/wooks.js#L262) |
| Legacy frisbee players | Leg stride and free left arm; throwing/catching hand retains authored target. | [src/people/frisbees.js:172](../../src/people/frisbees.js#L172) |
| Legacy hoopers | Small foot shuffle when drifting; raised arms and hip/hoop choreography preserved. | [src/people/hoopers.js:105](../../src/people/hoopers.js#L105) |
| Brass band | Distance gait in merged performer body; playing arms and instrument remain authored. | [src/people/brassBand.js:190](../../src/people/brassBand.js#L190) |
| Parasol marshal | Distance gait; left arm free and right parasol hand steady. | [src/models/parasolMarshal.js:136](../../src/models/parasolMarshal.js#L136) |
| Parade carriers | Distance gait under retained carrying/pole animation; absolute setPuppetTime remains a seekable authored preview. | [src/people/puppetParade.js:158](../../src/people/puppetParade.js#L158) |
| Monks | Shared Crowd stride arrives through copied group pose; robe feet step, pole hand and seated pose protected. | [src/monks.js:154](../../src/monks.js#L154) |
| Patrolling Sugar Shack cooks | Distance gait between local waypoints; grounded holding at cooking stations. | [src/models/sugarShack.js:62](../../src/models/sugarShack.js#L62) |
| Drum circle dancers | Seekable authored footwork shares gait shape; orbit, twirl and raised arms remain authored. | [src/models/tribalFigures.js:410](../../src/models/tribalFigures.js#L410) |
| Stage performers and sound engineers | Stationary instrument performance, no travel stride. | [src/models/stage.js:280](../../src/models/stage.js#L280) |
| Healing Arts participants and DJ | Authored stretches/dance and managed Crowd travel; no walking imposed on dance. | [src/models/healingArts.js:191](../../src/models/healingArts.js#L191) |
| Static vendors and proprietors | Stationary counter displays, no walking imposed. | [src/models/tent.js:694](../../src/models/tent.js#L694) |
| Seated and vehicle riders | Vehicle/seat/balance/paddling poses retain ownership; vehicle translation is not a walking stride. | [src/people/vehiclePersonFacet.js:6](../../src/people/vehiclePersonFacet.js#L6) |
| Place display scheduling | Dispatches existing stage/cook display owners, never duplicates people. | [src/people/placeDisplay.js:4](../../src/people/placeDisplay.js#L4) |

The [pure sampler](../../src/personMotion.js) accepts travel inputs independently
of Crowd state. The [model adapter](../../src/models/personLocomotion.js) rotates
existing hip pivots or writes two exact rotation morph weights; it samples actual
horizontal distance using the accepted delta, rejects relocations of 0.5m or more,
and reuses its output. Repeated zero-delta publication preserves the accepted
pose, while an accepted stationary step clears the stride.

Borrowed hula and frisbee actors need explicit travel input because an activity
owns their motion while their ordinary Crowd state remains idle with zero velocity.
The existing validated `writeActivityPose` interface accepts an optional travel
delta, and its normal stationary publication clears travel without releasing the
claim. Release/replacement clears the old claim's motion metadata. The regression
checks include travel, stop, zero delta, blocked hula travel and stale replacement.

## Checks and visual evidence

- The focused family regression passes eight native travel rigs through 640
  moving and zero-delta publications, plus stationary and relocation cases.
  It also checks dancer seeking, cook holding, monk pose publication, activity
  claim replacement, protected child accessories and frisbee throw/catch joints.
- Independent numerical rotation checks cover the merged wook and musician
  position and normal morphs. Shared geometry/material ownership remains pooled.
- The adult GPU fixture passes 29 production checks on Low and Mid, including
  borrowed activity travel, authored catch-arm priority and stopping with the
  same live claim. The original six people still use 16 draws and 7,320 triangles.
- The specialist fixture renders the eight-family lineup on Low (Lambert) and
  Mid (Standard), at Noon and Midnight. Every displayed family has a nonzero
  travel stride after Next stride, and Reset / idle clears every leg stride.
  Both material tiers produced no warning/error console messages in Chrome.
- The extended fixture adds a patrolling cook and an orbiting fire dancer, with
  nonzero footwork and no warning/error console messages. The extension adds
  test subjects to the fixture, rather than geometry to an existing actor.
- Targeted checks pass for shared motion, actor clocks, children, monks, formation
  routes, legacy hoopers/frisbees, hula/frisbee sessions and managers, place displays,
  child motion and terrain movers. `npm run build` passes with the existing
  module-type/bundle-size warnings. The complete suite reaches a known failure in
  `bin/test-wooks-ownership:48`: the legacy snapshot expects the former approach
  distance, while commit `87050e0` deliberately changes it. Gary assigned that
  behavior snapshot to its owning chat; this pass preserves that ownership.
  The complete check command passed with only `test-wooks-ownership` omitted,
  and the final `npm run build` passed. No other checks were omitted.
  The final in-app game smoke passed after clicking the ready Just Cruisin’ plank, with the live
  world running for more than 30 seconds, advancing smiles/time/juice and no
  warning/error console messages. [Game capture](locomotion-families-game.png).

## Measured cost and grounding limits

| Eight-family native fixture | Draws | Triangles | Geometries | Meshes | Existing caster flags |
| --- | ---: | ---: | ---: | ---: | ---: |
| Before, Low | 131 | 41,103 | 110 | 132 | 18 |
| After, Low | 131 | 41,103 | 110 | 132 | 18 |
| After, Mid | 131 | 41,103 | 110 | 132 | 18 |

The baseline was recorded before specialist model edits, using the same model
lineup and camera. Random pre-existing phase offsets differ between reloads, so
captures establish appearance and counters rather than pixel equality.

The adapter adds Groups, numerical tracking state and two morph position/normal
buffers on cached merged walking bodies, with no animation mixers or extra draws,
triangles or shadow casters. One measured wook template has 10,152 vertices and
487,296 bytes of additional morph data; the measured trumpet template has 5,316
vertices and 255,168 bytes. The marching performer owns a cached walking-body
clone, while stationary stage performers keep their original non-morph body.
The cached morph body bounds expand by 0.5m to avoid clipping rotating shoes.
These are allocation/buffer measurements, not proof of unchanged frame time or
phone performance; no complete CPU/GPU timing benchmark was performed.

The native test measures every transformed leg/shoe vertex across 80 moving
frames per travel rig, including their existing sway. Minimum flat-floor Y was
0m for child/frisbee/marshal/carrier/cook, -0.00266m for wooks and -0.00326m for
musicians; hooper soles stayed above 0m. The 5mm regression tolerance acknowledges
the retained stylized sway. Wook and musician hip/toe compensation uses their own
proportions, and the hooper's old approximately 8cm tilt penetration is corrected.
This remains rigid hip animation, not knee simulation, terrain foot IK or a
physical-device acceptance test. Dance/performance/vehicle poses are intentional
exceptions to ordinary grounded-idle walking.

## Reproduction and captures

Use the running Vite server and open
[the family fixture](locomotion-families.html?perf=low&mute=1), select Next stride,
and compare Noon/Midnight. Change `perf=low` to `perf=mid` for Standard materials;
append `extended=1` for cook/dancer examples. The
[adult fixture](locomotion.html?perf=low&mute=1) exercises borrowed pose claims,
and [the live fixture](locomotion-live.html?perf=low&mute=1) starts the real game
through its ready mode plank and reports loaded family motion.

- [Low Noon](locomotion-families-low-noon.png), [Low Midnight](locomotion-families-low-midnight.png)
- [Mid Noon](locomotion-families-mid-noon.png), [Mid Midnight](locomotion-families-mid-midnight.png)
- [Cook/dancer extension](locomotion-families-extended.png)

The Chrome fixture tab was closed after verification. The real-game Chrome
attempt reached the title card, then browser inspection timed out after Gary
accidentally closed the tab; this attempt alone establishes no game-boot pass.
The subsequent in-app Browser smoke test passed and its test tab was closed,
as recorded above.
The replacement loopback Vite server on port 8747 remains running for Gary.
