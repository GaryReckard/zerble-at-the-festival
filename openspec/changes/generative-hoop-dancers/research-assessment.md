# Assessment of the supplied hoop movement research

**TL/DR:** Use the report to guide the dancer's weight, travel, turns and preparation, but do not treat its trick descriptions as motion specifications. The current implementation already provides substantial traveling steps and coordinated turns. The next useful refinements are explicit stance-foot phases, dancing around a fixed world-space isolation, and body preparation/recovery around an independently planned toss. These extend the existing phrase instead of adding an unverified trick catalogue. The implementation basis is the [body sampler](../../../src/people/hoop/score.js#L320), [standing leg shader](../../../src/personMotion.js#L124), and [current isolation/flight settlement](../../../src/people/hoop/score.js#L327).

## Evidence and limits

The input is Gary's locally supplied [preserved research report](research/01-user-report.md). Its reference list supplies names and “2026” labels but no direct URLs, publication evidence or video timestamps; those labels are not verified dates and are not adopted here. Its proposed phrases are suggestions, not recorded demonstrations of continuous contact or workable transitions. See the supplied report's lines 58–69 and 87–96.

This assessment read the text of three primary or provider-published pages. It did **not** watch their embedded videos, so it makes no claims about observed foot contacts, timing, camera frames or timestamps:

- [HoopLovers: Adding Isolations to Your Hoop Dance Flow](https://hooplovers.tv/adding-isolations-to-your-hoop-dance-flow/) connects a ghosting isolation with other movements, including a side body roll, and explicitly encourages body movement within the combined flow.
- [Hoopsmiles: Pizza Toss](https://www.hoopsmiles.com/pizza-toss) describes a throw originating from waist hooping or a vortex-like movement, followed by a hand or body catch. Its text does not establish all the detailed footwork and plane changes asserted in the supplied report.
- [MoodHoops: Hula Hoop Tricks](https://moodhoops.com/hula-hoop-tricks/) is a manufacturer-curated tutorial index with written instructions and instructor-video links. Its one-handed weave description follows hand grips and hoop positions; its revolving-door step-through is a separate entry involving a leg passing through the hoop. These should not be conflated into one move.

The engineering recommendations below are inferences from those sources and the inspected code, not claims that an instructor prescribed these exact animation curves.

## What the implemented rig can represent

| Mechanic | Present implementation and useful limit |
| --- | --- |
| Traveling, turning and weight shifts | Phrase-specific travel, heading, lean and alternating stride already exist in [score.js:331](../../../src/people/hoop/score.js#L331), and [HulaSession:51](../../../src/people/hulaSession.js#L51) applies travel relative to the captured entrance heading. This is a usable foundation for Gary's request to dance and move about. |
| Foot support | [hoopFootLift:4](../../../src/people/hoop/feet.js#L4) finds the lowest transformed shoe point and corrects root height. It establishes vertical ground support; it contains no constraint that holds a chosen foot at a fixed horizontal world position. Do not equate sole-height correctness with verified planted-foot behavior. |
| Leg articulation | The standing flow path applies opposite X-axis rotations to the two whole legs at their hips in [personMotion.js:124](../../../src/personMotion.js#L124). It does not provide independent dancing knee flexion, ankle articulation or lateral leg swing. The separate picnic-folding path is not an existing dance knee controller. |
| Arms and grips | [armShader:100](../../../src/personMotion.js#L100) provides two shoulder axes and one elbow hinge per arm. It can support tested reachable hand paths, but it has no wrist, finger or forearm-supination control. Detailed underhand/overhand or thumb-trap descriptions therefore require an explicit stylization decision or a rig extension. |
| Torso and head | Flow lean is applied through the common body matrix in [crowd.js:1743](../../../src/crowd.js#L1743), while [crowd.js:1824](../../../src/crowd.js#L1824) adds a coordinated head turn/tilt for the head and facial parts. There is no separate flow spine/hip twist in that body publication path. |
| Body contact, roll and flight | The [waist orbit](../../../src/people/hoop/score.js#L247) and [forearm support curve](../../../src/people/hoop/score.js#L216) specify geometric relationships to the actual model. The [toss](../../../src/people/hoop/score.js#L253) is an analytic airborne arc. These are authored geometric mechanisms, not a simulation of body-applied forces, friction or learned human technique. |

The current root settlement during isolation and all toss phases is an intentional first-validation constraint, as shown by [sampleBody:327](../../../src/people/hoop/score.js#L327) and its [stationary-root assertion](../../../bin/test-hoop-score#L58). It is **not** a claim that real performers must freeze their bodies during those movements. Removing the settlement alone would move the isolation with the dancer and would transform the airborne path with a moving frame.

## Three actionable refinements

### 1. Give traveling phrases explicit stance and swing phases

Keep the existing orbit/answer/return phrase and improve how its steps carry the body's travel. Hooplovers' guidance supports movement through a connected phrase, rather than collecting isolated tricks; this is the useful high-level direction to retain. [Instructor guidance](https://hooplovers.tv/adding-isolations-to-your-hoop-dance-flow/)

Compile a small, deterministic step plan with a selected support foot, a swing interval and a contact-change interval. Couple the travel curve and the existing hip stride to that plan, then constrain the selected sole point in horizontal space during its planted interval. Preserve the current exact sole-height correction. The current [travel/stride curves](../../../src/people/hoop/score.js#L331) and [height-only support function](../../../src/people/hoop/feet.js#L4) make this a specific extension, rather than a request for more generic sway.

Acceptance should measure the selected foot's horizontal drift and vertical support through turns, with declared sliding or pivot intervals, then review the same phrase at normal game-camera distance. If that requires independent knee or ankle motion, extend the [standing leg path](../../../src/personMotion.js#L124) explicitly; do not claim the existing straight-leg swing reproduces crouches or heel lifts. Retain bounded travel and the tested [whole-body continuity](../../../bin/test-hoop-score#L166) and [moving-envelope checks](../../../bin/test-hoop-score#L84).

### 2. Let the dancer move around a fixed world-space isolation

The report's useful isolation idea is the separation between body motion and the apparent hoop anchor. Hooplovers encourages body movement within an isolation flow, while MoodHoops describes the basic isolation around a fixed center. Neither written source supplies a universally required support foot or torso angle. [HoopLovers](https://hooplovers.tv/adding-isolations-to-your-hoop-dance-flow/), [MoodHoops isolation instructions](https://moodhoops.com/hula-hoop-tricks/)

Add one bounded moving-isolation variation. Store a session-space hoop anchor and orientation, evaluate the dancer's travel/turn/lean and sole support, then inverse-transform the fixed rim targets into the current arm frame before solving the arms. The output hoop must receive the corresponding inverse presentation transform, so applying the final person matrix restores the same fixed anchor. Validate the entire proposed body path against the rig's reachable workspace; reduce that body path or choose another validated variation instead of stretching the arm. The relevant current boundaries are [the isolation sampler](../../../src/people/hoop/score.js#L277), [the arm solver](../../../src/people/hoop/score.js#L166), and [session pose publication](../../../src/people/hulaSession.js#L51).

Acceptance should prove stationary world-space center, plane and radius while body travel is nonzero, including heading, actor scale, terrain height and sole correction. Repeat seeking, reader-order and contact-boundary tests. This refines the existing [world-isolation assertion](../../../bin/test-hoop-score#L195) without mistaking a motionless torso for the final artistic requirement.

### 3. Connect toss preparation and recovery to the dance

Keep the present generic aerial toss label. Hoopsmiles' documented pizza-toss origin is waist or vortex-like movement, whereas this implementation releases from an already raised left-hand grip. That is not enough evidence to rename the current motion a pizza toss. [Hoopsmiles description](https://www.hoopsmiles.com/pizza-toss), [current release position](../../../src/people/hoop/score.js#L264)

First add a visible approach step, directional preparation and recovery step around the existing toss, using the current travel/turn/gaze controls. For motion during the airborne interval, plan the hoop in an inertial session/world frame and evaluate the dancer separately; do not merely enable body motion beneath the current locally sampled arc. Precompute a reachable catch using the catch-time presentation matrix, and match world-space position and velocity at release and catch, including motion contributed by the dancer's translation and rotation. The current [analytic arc and hand recovery](../../../src/people/hoop/score.js#L253) and [frozen toss root](../../../src/people/hoop/score.js#L330) identify exactly what needs to change.

Acceptance should preserve the gravity and continuity checks, add moving-catcher reach tests, and verify that footwork communicates preparation and recovery at game distance. A knee-driven crouch or jump is a separate rig task because the current [standing leg shader](../../../src/personMotion.js#L124) has no independent knee control.

## Mechanics and labels not adopted from the report

| Report item | Assessment |
| --- | --- |
| Waist/chest hooping is vertical, while body hooping around chest/shoulders is horizontal | The report contradicts itself within its geometry section, particularly line 49, and also calls waist hooping vertical at line 11. Keep the current explicitly defined [horizontal waist-plane geometry](../../../src/people/hoop/score.js#L237); do not use this contradictory prose to rotate it. |
| A weave is inherently a leg-through-hoop stepping pattern | The report's line 20 is not established by the [MoodHoops one-handed-weave instructions](https://moodhoops.com/hula-hoop-tricks/), which concern grip changes and list step-throughs separately. Verify the specific three-beat variant before adopting that label or its leg mechanics. |
| A right-hand isolation universally loads the left foot, and a pizza toss requires a particular front-foot lift, two-handed scoop or horizontal-to-vertical flight change | These prescriptions appear in report lines 31 and 33, but the reviewed written primary pages do not establish them. Obtain a specific demonstrated variant before adopting its exact stance, grip or plane sequence. [HoopLovers isolation flow](https://hooplovers.tv/adding-isolations-to-your-hoop-dance-flow/), [Hoopsmiles pizza toss](https://www.hoopsmiles.com/pizza-toss) |
| An overhead catch should carry upward momentum | Report line 77 is not a usable general catch constraint. The implemented [ballistic toss](../../../src/people/hoop/score.js#L258) returns with downward velocity, and its recovery matches that direction. Follow the planned trajectory rather than substituting the report's prose. |
| Claimed continuity of the five proposed combinations | The report asserts continuity at lines 60–69 without trajectories or demonstrated timings. The current [bounded compiler](../../../src/people/hoop/score.js#L75) and [contact/clearance tests](../../../bin/test-hoop-score#L52) require each new transition to establish those properties. The report's assurance is not that evidence. |
| Suggested escalators, knee-to-waist lifts, foot lassos and shoulder-driven variants | Those sections prescribe leg, wrist or torso mechanics beyond the controls identified above. Keep them as reference candidates until a specific instructor demonstration is examined and a rig-compatible support path is validated. The current [arm](../../../src/personMotion.js#L100), [standing leg](../../../src/personMotion.js#L124) and [body publication](../../../src/crowd.js#L1743) contracts are the implementation limits. |

This assessment changes no choreography or tests. It identifies the next refinements for review after the current production-path visual checks; numerical feasibility alone does not establish natural-looking dance.
