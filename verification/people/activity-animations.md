# Activity animation verification, October 28, 2026

The checkpoint requested before these fixes is `651c99f`, following the prerequisite
`25d1061`. This report describes the subsequent working-tree changes. Nothing was
pushed or deployed.

## Implemented motion and ownership

[Person motion](../../src/personMotion.js) shares the original frisbee shoulder/elbow
targets with the standalone model and the current Crowd renderer. The current
[frisbee activity](../../src/people/frisbeeActivity.js) faces partners, blends poses
using accepted deltas and attaches held discs to the actual body-transformed hand,
including the first visible frame. Its [session](../../src/people/frisbeeSession.js)
validates the reserved place before acquiring either person. Interruption releases
both arm poses synchronously, settles the disc and rejects stale arm/hand authority.

[Crowd](../../src/crowd.js) keeps each original body, complete appearance, personality
record and collider. Jointed arms occupy the existing shared instanced mesh, with
rest-space clothing/skin attributes and matching position/normal and sun-depth
transforms. The extra depth material is Crowd-owned and explicitly disposed. All
ordinary Crowd adults share this geometry; dancers also use its elbow pose, while
seated occupants, instrument players, photographers and protected render owners keep
their appropriate pose handling. Specialist populations retain their existing rigs.
This does not enable activities for additional populations.

The [hula activity](../../src/people/hulaActivity.js) restores the original 0.27m
hoop offset under a revolving waist pivot. Its [session](../../src/people/hulaSession.js)
uses one accepted phase for lean, bob and hoop wobble/revolution, and pauses that
phase while interrupted. The legacy model uses the same motion sampler. Hoopers
raise their ordinary arms and retain their existing clothes, hair and skin.

## Tests and browser evidence

`node bin/test-person-motion` verifies analytical hand endpoints, original throw/catch
targets, hula phase values, storage reuse, finite/range/delta validation, hidden-body
exclusion, replacement/stale claims and appearance/position continuity. The frisbee
manager test covers first-frame hand attachment and paired arm revocation. Session
tests cover invalid or throwing initial place validation and cleanup, in addition to
the checkpoint's interruption/resource tests. Actor-clock and seated-contact harnesses
were updated with the new production dependencies; their existing assertions remain.

The final `npm run check` passes, with output in
`/private/tmp/zerble-activity-animations-final.log`. The five-page importmap check
reports 154 modules, strict OpenSpec validation passes and `git diff --check` is clean.

The native [frisbee fixture](frisbee-cycle.html) passes hand attachment, both players'
arm poses, flight, paired interruption, synchronous arm release, stale write rejection
and safe reacquisition. Its independent native Object3D shoulder/elbow chain agrees
with the CPU hand calculation for windup, release and catch. Mid rendering also
compiles and exercises the sun-depth shader. Low and Mid were inspected at noon and
midnight, with no new captured native console warnings or errors. The first shadow
probe caught a missing newline before a GLSL include; the final fresh-tab probe is
clean. Saved [browser results](2026-10-28/browser-results.json) retain the acceptance
text and captured logs.

The native [hula fixture](hula-cycle.html) passes visible offset revolution,
body/pivot phase agreement, one collider and the complete charging-cart/honk,
interruption, fresh-claim resumption, completion and departure cycle. Its bounded
five-second replay lets a person inspect actual movement. The native
[dance fixture](dance-cycle.html) also verifies articulated elbows after the original
person returns to the dance floor, along with identity and appearance continuity.

Controlled running-game [hula](hula-live-game.html), [frisbee](frisbee-live-game.html)
and [dance](dance-live-game.html) cycles pass. The paired fixture now fixes seed 1234
and verifies that the original pair remains the session's pair before accepting
flight; an earlier uncontrolled run observed flight without both original arm
bindings, so that weaker observation is not accepted as proof. A separate direct
Mid game boot passes a ready Just Cruisin' mode click and keyboard Space honk with
no captured warnings/errors. The muted start gesture does not establish audible
physical-iPhone unlock behavior. The iframe fixtures retain the independently
reproduced browser MutationObserver error described in the
[checkpoint report](temporary-activities.md); their saved logs are not represented
as clean application consoles.

## Render cost and captures

The native hula fixture compares the actual old capsule geometry with the new
merged arm geometry: **312 → 240 triangles per Crowd person**, with the same single
arm draw and no additional shadow casters. Rest poses bypass joint trigonometry in
the shader. Pose storage is allocated when borrowing the arms and reused on writes;
there are no per-person Object3D arm rigs or per-frame joint allocations in Crowd.
These structural and isolated measurements support extending the shared geometry
to ordinary adults, but do not claim measured phone or whole-game FPS gains.

| Current isolated scene, shadows excluded from these counters | Draws | Triangles |
| --- | ---: | ---: |
| One Crowd person | 8 | 1,220 |
| Same person and hoop | 9 | 1,508 |
| Two fixed-appearance people, no drinks | 9 | 2,290 |
| Same pair and disc | 11 | 2,506 |

The paired scene now fixes clothing and omits drinks for inspection, so its totals
must not be treated as a matched comparison with the checkpoint's random appearance
scene. The direct arm-geometry comparison is matched. Native counters exclude the
additional Mid shadow-verification render, which runs afterward.

Saved captures: [hula Mid noon](2026-10-28/hula-mid-noon.png),
[hula Mid midnight](2026-10-28/hula-mid-midnight.png),
[hula Low midnight](2026-10-28/hula-low-midnight.png),
[frisbee Mid windup](2026-10-28/frisbee-mid-noon.png),
[frisbee Mid catch at midnight](2026-10-28/frisbee-mid-midnight.png),
[frisbee Low release](2026-10-28/frisbee-low-release.png) and
[direct Mid game boot](2026-10-28/game-mid-gesture.png).

## Limits and resource cleanup

Matched whole-game GPU/CPU timing, extended streaming and physical iPhone/Safari
observation remain the existing acceptance follow-ups in [ROADMAP](../../ROADMAP.md).
Native joint/collider/resource proofs and controlled game cycles do not substitute
for those device measurements. Frame/scoring order, existing random streams,
independent nightness and synchronous audio initialization were not moved.

Owned in-app test tabs are closed and their pagehide teardown disposes fixtures,
renderers and bounded replay timers. No standalone browser or headless WebGL worker
was launched. The prior server PID 3465 no longer existed when checked, so this run
started its own no-cache server, stopped PID 52699 after verification and confirmed
that exact PID had exited. The in-app tab inventory is empty. Both the completed
2:32am wakeup and the unused 7:32am fallback wakeup were removed.
