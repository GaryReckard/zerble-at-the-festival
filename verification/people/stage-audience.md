# Stage audience and site corrections, October 28, 2026

These changes follow the committed activity animation checkpoint `3e6d4af` and
retain the earlier uncommitted shoulder-anchor and hoop-finish corrections.
They extend the existing Crowd claims, venue reservations, place-performer
updates and shared furniture batching rather than adding another people owner.

## Behavior and ownership

- Hoopers require more than six metres of cart clearance before recruitment and
  2.2 metres between participants. An interruptible hula claim within five metres
  of the cart is revoked even at zero speed. The existing physical-exit gate,
  lane prediction, safe-resume checks and activity cancellation still apply.
  Sources: `src/people/hulaActivity.js`, `src/people/hulaSession.js`, and
  `Crowd._interruptActivityForCart` in `src/crowd.js`.
- The Healing Arts rig and ordinary stage dancers share
  `sampleHealingDancePoint` in `src/personMotion.js`. Crowd retargets those authored
  directions to its fixed shoulders and limb lengths, including independently
  bending left elbows. Stationary, music-inclined people dance; walking and
  fleeing states retain their normal movement poses. The original person's
  clothes, hair, skin, body and collider remain authoritative.
- `placeStageChairRows` in `src/chunks.js` lays out short groups of one to five
  chairs at varied rear-audience depths, loosely facing the stage center with aisles and explicit road/water clearance. Existing seeded draws
  choose among sling, director, low and loveseat styles without shifting later
  world draws. The campsite batcher retains shared buffers/materials and uploads
  every instance transform. Each physical seat has a world-owned `campSeats`
  slot; `CampActivity` admits every fifth behavior slot to stage seating and
  releases the seat after its dwell, interruption, person removal or unload.
  Stage-chair visitors remain seated at night rather than inheriting campsite
  bedtime or being treated as sleeping occupants.
- Stage blankets explicitly opt into four independent `tableSeats` reservations with a
  `cross-legged` pose. Other lawn blankets do not automatically become seating
  venues. `PicnicActivity` owns the existing approach, dwell and release flow;
  Crowd folds its existing pants and shoes, retaining their appearance and one
  collider. Claims reject stale writes, and release clears the folded-leg flag.
  Blankets clear chairs, other blankets and road shoulders.
- The covered stage has a raised, supported console whose controls inherit its
  slope, facing a headphone-wearing engineer on the platform. The attendant
  uses the existing place-performer lifecycle, including chunk cleanup, and
  does not publish a second interactive identity or collider. The former roaming
  spawn remains in the audience, preserving its RNG draws. The platform's kind
  is `soundboard`, with a matching toast and collision sound routing in
  `src/main.js` and `src/sound.js`.

## Exact road report

Reported seed `3248888364`, cart position `(176.19, -674.37)`, heading `21.407`,
time of day `0.707`. The [running-game inspection fixture](road-patch.html?mute=1)
reproduced the black polygon on the road ahead of the cart. Disabling road
shadow reception did not remove it, no downward detailed-road triangles were
found, and hiding only `farField:road` removed the patch immediately.

The distant road sampled terrain at its endpoints, but its triangle interiors
bridged terrain creases and rose through the detailed road. Both surfaces now
use `drapeTerrainTriangles` in `src/worldgen/terrain.js`, which was extracted from
the existing detailed-road clipper. Their lifts remain 0.03 and 0.06 metres.
`FarField._writeRoads` retains its preallocated buffers, nearest-first ordering,
whole-polyline overflow policy and one road draw, then recomputes bounds from the
committed clipped vertices. Clipping uses more of the fixed capacity, so distant
polylines can be omitted earlier when terrain is enabled; capacities do not grow.

The regression exercises actual road segments from the reported seed, retains
visible geometry, and checks 630 triangle-interior samples against the real
terrain. It also checks strict underlay separation, deterministic rewrites and
hard capacity limits. [Before](2026-10-28/road-before.png) and
[after, underlay enabled](2026-10-28/road-after.png).

## Reproducible verification

Run a local no-cache server from the repository root, then open the links below:

```sh
python3 .claude/serve_nocache.py 8765
npm run check
bin/check-importmaps
```

| Surface | Observed result |
| --- | --- |
| [Production audience fixture](stage-audience.html?mute=1&perf=low) | Separated rows, all four chair styles, real chair reservation and occupant, production blanket and cross-legged occupant, stage dance arms; Low and Mid, Noon and Midnight pass |
| [Soundboard fixture](soundboard.html?mute=1&perf=low) | Controls attached to desk, correct engineer height/side/heading, stationary attendance; Low and Mid, Noon and Midnight pass |
| [Soundboard sandbox](../../sandbox.html?entity=soundboard&mute=1&perf=low) | New selector and deep link load the actual tent builder, close camera and `Hit it (soundboard)` routing |
| [Parked-cart live cycle](parked-hula-live-game.html?mute=1) | Ordinary person → hooping → parked-cart interruption → stale claim rejected → safe resume → completion and walking departure; identity and appearance retained |
| [Live soundboard collision](soundboard-live-game.html?mute=1) | Actual covered-stage builder and raised attendant; driving into its collider displays `Easy around the soundboard!` |
| [Dance interruption](dance-cycle.html?mute=1&perf=low) | Original person and appearance, immediate claim revocation, safe reacquisition and articulated elbows pass |
| [Frisbee cycle](frisbee-cycle.html?mute=1&perf=low) | Original pair, held-hand attachment, flying-disc interruption, both stale claims rejected, safe reacquisition and native hand transforms pass |
| [Shoulder attachment](arm-attachments.html?mute=1&perf=mid) | 162 native shoulder checks across nine poses, three scales and three headings pass |

The full `npm run check` suite passes. New gates `bin/test-stage-audience` and
`bin/test-soundboard` run in that suite. They cover 100 seeded row layouts and
unchanged RNG counts, seat clearance and metadata, chair dwell, blanket
contention/lifetime behavior, stale writes, retained appearance, desk control
attachment, engineer placement and soundboard hit routing. Existing exact
campsite, picnic, Healing Arts, claim, frame-trace and scoring gates also pass.
The original Healing Arts point formulas are independently compared over time,
including the DJ variations, in `bin/test-person-motion`.

Saved native result text is in [stage-results.json](2026-10-28/stage-results.json).
Captures include the [parked hula cycle](2026-10-28/parked-hula-live-game.png),
[live soundboard](2026-10-28/soundboard-live-game.png),
[audience Low noon](2026-10-28/audience-low-noon.png),
[Low midnight](2026-10-28/audience-low-midnight.png),
[Mid noon](2026-10-28/audience-mid-noon.png),
[Mid midnight](2026-10-28/audience-mid-midnight.png),
[soundboard Low noon](2026-10-28/soundboard-low-noon.png),
[Low midnight](2026-10-28/soundboard-low-midnight.png),
[Mid noon](2026-10-28/soundboard-mid-noon.png) and
[Mid midnight](2026-10-28/soundboard-mid-midnight.png).

## Cost, limits and cleanup

The audience fixture renders 20 draws / 14,604 triangles, and the complete tent
fixture renders 48 draws / 17,378 triangles. These are fixture counters, not a
phone FPS measurement or a representative whole-world budget. Ordinary Crowd
adults still share one articulated arm draw with 240 triangles per person;
adding a knee ring for the blanket fold adds 24 leg triangles per ordinary
person and no new body draw. The shoulder fixture now measures 9 draws / 1,532
triangles, including its hoop. The two-person frisbee fixture measures 9 draws /
2,338 triangles before its disc and 11 draws / 2,554 with the disc.

Terrain clipping allocates temporary polygons during far-road snapshot rewrites,
not steady frames, while the GPU buffers and road draw count remain bounded.
Physical iPhone performance and iOS audio observation remain separate device
acceptance. This work does not change the synchronous start-gesture audio chain,
scoring/frame barriers, shared-resource disposal or independent nightness polls.
The sound routing checks ran muted and do not claim an audible listening test.

IAB iframe runs logged an unattributed MutationObserver error without a source
URL; the repository has no MutationObserver use. Native shoulder and frisbee
fixtures had no captured console errors. The [direct-game start](2026-10-28/stage-game-low-gesture.png) was checked
separately through the ready Just Cruisin' mode control and a Space honk, with
no captured console warnings or errors. The new [sandbox selector and hit
control](2026-10-28/soundboard-sandbox.png) also ran with a clean console.

All task-owned test tabs and the no-cache server (PID6051) were closed after verification;
`ps -p 6051 -o pid,command` confirmed that exact process was gone.
The user's gallery tab was preserved. No standalone browser processes were
started, and no commit, push or deployment was made for this follow-up batch.

## Organic seating follow-up

Gary's later refinement is implemented: groups occupy several depths across the
rear audience area, with short angled rows, per-chair variation, explicit
chair-to-chair clearance and a bounded lateral footprint. Covered stages keep
the front half clear for dancers. All four styles remain eligible, and the
100-seed characterization retains the original RNG draw count. Stage-facing
headings aim at the stage center rather than sharing a rigid parallel heading.

Each stage blanket now provides four separate positions. Four concurrent
original people can reserve them, a fifth cannot steal one, a vacancy can be
reused, and unload returns every person to ordinary behavior while releasing
all claims. Blanket decoration rotation does not determine the occupants'
heading. The original appearance and singular collider/body remain unchanged.

The production fixture now shows two simultaneous stage-facing sitters, one
chair visitor and three dancers, with 21 draws/15,624 triangles in both Low and
Mid at the fixture's final camera/layout. These supersede the initial fixture's
counts because group orientation, body count and visibility changed; they are
not a measured performance improvement. See [Low Noon](2026-10-28/audience-organic-low-noon.png),
[Low Midnight](2026-10-28/audience-organic-low-midnight.png),
[Mid Noon](2026-10-28/audience-organic-mid-noon.png),
[Mid Midnight](2026-10-28/audience-organic-mid-midnight.png), and the
[two-sitter close-up](2026-10-28/audience-organic-two-sitters.png).

The final full-suite, real-game road/seating integration, source compatibility
and owned-resource cleanup are recorded in the [road follow-up report](../roads/2026-10-28/README.md).
