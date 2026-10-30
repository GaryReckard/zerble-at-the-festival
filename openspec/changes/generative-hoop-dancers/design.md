## Context

The live game constructs HulaActivity (src/main.js:661), whose slots own hoops while Crowd owns participants (src/people/hulaActivity.js:12-35). HulaSession supplies a body sample (src/people/hulaSession.js:11), while Crowd currently applies fixed raised hula arms (src/crowd.js:1805). The shared arm shader has shoulder X/Z rotations and one elbow bend per arm (src/personMotion.js:99-118), so arbitrary wrist targets cannot be assumed reachable.

## Goals / Non-Goals

**Goals:** Preserve classic hooping, add continuously composed flow performances, make contact convincing, support replay, make variety perceptible and keep verification cheap. Cover body/hand orbits, isolations, transfers, supported rolls, tosses, multiple hoops and a bounded partner exchange through explicit delivery stages.

**Non-Goals:** General rigid-body hoop simulation, arbitrary dance generation, full-body motion capture, new music scheduling or a universal character rig rewrite. “Infinitely creative” describes the intended experience, not an unlimited validated trick library.

## Decisions

### A relationship score rather than a trick playlist

Proposed pure modules under src/people/hoop/: vocabulary.js, composer.js and sampler.js. Each primitive declares entry/exit contact, handedness, plane, height, angular phase, duration in beats, compatible successors and clearance envelope. Its sampler emits hoop pose/spin, body offsets and both arm poses into caller-owned storage. These are proposed names, not existing modules.

The composer compiles one complete, bounded score for the existing 18–25-second session before performance starts (src/people/hulaActivity.js:33). Choose from validated phrase families with an entrance, development, flourish and resolution, retaining a bounded history across scores. Use a motif, its answer, a variation and a resolution so the dancer has recognizable intent. Profiles weight smooth isolations, lively reversals or aerial flourishes. Add an energy arc and breathing moments; forbid repeated flourishes from becoming noise. Initial proposed caps are 32 score segments and 16 candidate checks per segment, including fallback selection; the total compilation budget is therefore at most 512 checks. Exhaustion selects a validated neutral bridge within the remaining capacity or declines the flow performance safely. These are design limits to measure, not benchmark results. Render-time sampling does not search for movements.

Transformations are constrained by the primitive: changing handedness, tilt or speed must preserve reach, contact and clearance. No arbitrary axis interpolation through the torso. Each validated transition is a movement with its own geometry and timing.

### One state, several readers

The session owns style, the compiled score, seed and accepted performance time. Crowd and HulaActivity read the same cached sample; sampling never consumes RNG or advances state. Freeze, slow motion and normal stepping use the accepted actor clock, not wall time or independent accumulators. Pure score replay stores seed, profile, compiler/vocabulary version and accepted score descriptors. Encounter replay additionally records obstruction decisions, interruption/reentry and other environmental branches at their accepted times; a seed alone cannot reproduce an altered crowd or registry. Direct analytic seek scans at most 32 segments in an isolated preview and never rewinds live claims, global clocks or cooldowns. Keep only the bounded current score/event record and explicitly exported replays, with an initial cap of 256 event records per active session. If this cap is exhausted, end the flow safely and mark the export incomplete with an explicit overflow error; never silently drop events and promise exact replay. These caps are proposed implementation bounds, not measured performance claims.

Compose using an independent, freshly salted RNG stream derived from an injected activity root seed, stable slot identity and monotonically increasing flow-session generation. Record those inputs at start and avoid incidental registry IDs or private mutable Crowd indices. Preserve existing activity selection and world-generation draw ordering. Profiles and choices cannot consume the classic path's random draws.

### Publish one complete sample before the person pose

Crowd calls its matrix publisher synchronously from writeActivityPose (src/crowd.js:2331-2341), so define this order: advance accepted flow time, resolve crossed contact boundaries, populate the complete session-owned sample, publish the person's pose, then render every hoop from the same sample version. Entry, finish and reentry follow this barrier too. Include session generation and sample version so a previous slot occupant or interrupted epoch cannot be read as current.

Crowd reuses _activityBodyPose scratch across participants (src/crowd.js:1609). Every provider writes an explicit classic/flow discriminator and resets optional counts and fields; absence of a property is never the style test. Renderers copy what they need and never retain this shared scratch object. Test alternating flow → classic → inactive → flow in the same buffer, including slot recycling and zero-delta steps.

### Solve contact in the actual rig's coordinates

Define one performer-local frame with documented body lean, heading, scale and terrain transforms. Match CPU forward kinematics to shader order for both hands before attempting inverse kinematics. The current arm degrees of freedom are the supported workspace; validate sampled targets and reject incompatible paths instead of stretching limbs or hiding errors with clamping.

Use a contact ring coordinate, not just the hoop center. Hand trajectories meet a particular point on the rim. Represent hoop plane/orientation separately from material spin so an isolation can hold its silhouette while colored tape rotates. Preserve quaternion sign continuity and unwrapped spin phase.

Body orbits use the existing offset/contact principle; hand orbits and isolations use reachable hand/rim constraints. Passes have a brief two-hand contact window and one authoritative owner. Rolls follow authored support curves with contact checks. Flight uses a closed-form arc with a catch pose planned before launch. At release and catch, match position and velocity as well as orientation and spin; a single missed render frame must not skip the state transition.

Expose the final presentation transform through a shared pure contract or claim-validated copy, including body bob/lean and existing reaction precedence (src/crowd.js:1628-1634,1730-1737); do not read Crowd private matrices or NPC records. Preserve normal/depth/shadow articulation parity if shared arm code changes.

Keep the prop under one stable root and calculate poses in that frame instead of repeatedly reparenting it. Body lean must be applied consistently to contacts and rendering; otherwise an apparently correct local hand target will miss the hoop in world space.

### Dance and contact share the same score

Flow uses `travelX`, `travelZ`, `turn`, body lean and coordinated head movement.
The initial stride-only implementation established facing and shared contact
publication; the grounded refinement adds analytic stance/swing foot plans and
flow-only two-segment leg articulation. Each planted foot has a fixed session
position and orientation until its declared lift, and its swing follows a smooth
trajectory into the next contact. Root compression gives the knees room to flex.
Foot targets and orientations are inverse-transformed into the actual body frame,
with terrain sampled at each foot rather than inferred from the root alone.
Waist and flow are two modes of the same Crowd performer. Both share articulated
body publication, while waist mode keeps its periodic orbit and adds gentle raised-arm
expression, planted knee movement and head motion. Ordinary locomotion and seated
poses keep their current paths, and partner poses retain their existing contact score.

The score owns stance changes, directional waist pulses, anticipation and recovery
on the accepted clock. Steps remain seekable without integrating history. Waist
pulses follow the declared contact cycle. Isolations retain a session-fixed hoop
while the body moves, and tosses retain an inertial ballistic path while the
performer prepares, steps and recovers. Hand targets are solved after the body
transform is known, and infeasible environmental adjustments end safely instead
of stretching limbs. The pose cache remains complete before Crowd publication.

The renderer consumes the same foot targets for visible geometry, normals and
depth. The actual shoe geometry must remain fixed horizontally during planted
intervals and clear the ground during swings, including heading/scale fixtures.
Head, eyes, hair and mouth share their pivoted transform. Crowd's actual forward
is local negative Z, as derived from face and shoe geometry. Frame compensation
must preserve that convention throughout the arm/hoop solution.

### Additive activity integration

Extend HulaSession with a style/score provider whose default is classic. Keep claims, place validity, cooldown, interruption and completion ownership in the current session. Both waist and flow modes publish finite arms, head and foot fields under an explicit articulated-body capability; legacy nonarticulated providers retain the raised-arm fallback. Hoops remain owned and disposed by HulaActivity.

Reserve a conservative performance envelope for each score, including overhead and lateral hoop sweeps, rather than relying on the existing .45 building check and 2.2 participant separation (src/people/hulaActivity.js:31,66). Shrink only parameter ranges already validated as safe; otherwise choose another phrase or decline the slot. HulaActivity owns a bounded envelope/corridor reservation store keyed by owner token and session generation. Release reservations on cancellation, completion, teardown and partial acquisition. These reservations coordinate performers; they do not create hard hoop colliders or exclude ordinary bystanders. Recheck dynamic obstruction at score boundaries and stop safely when the envelope is lost, recording any resulting branch.

Start with a configurable subset of existing slots using flow, retaining classic slots within the current cap of eight (src/people/hulaActivity.js:9). Set the final mix after side-by-side review. Use separate seeded style selection so existing selection draws remain untouched. Different flow clearance or occupancy can change later participation, so do not promise an identical encounter history after flow is enabled.

On honk/dodge, hide all activity hoops and invalidate contacts immediately, including flight. On safe reacquisition, start a short reachable entrance rather than snapping a caught hoop back into a previous flight. Preserve classic elapsed exactly. For flow, keep a monotonic active-participation timer separate from score-local time and score epoch; entrance time counts toward the existing duration, while interrupted waiting retains the existing timeout. A restart only uses remaining active time and ends safely if that time cannot accommodate a valid entrance and resolution. Repeated interruptions therefore cannot grant unlimited performance time. Person loss, place loss and disposal release claims and reservations exactly once. Added hoop resources use explicit owner lifetimes and shared-resource tags when pooled.

### Variety beyond one hoop

Use a fixed-capacity array of hoop states in the sample contract from the first slice, with one active entry initially. After the single-hoop score passes its gates, add a small set of two-hoop motifs with independent hand occupancy and swept-volume checks. Only use validated split-plane and synchronized patterns; adding hoops cannot multiply unrestricted composition search.

Then add one partner exchange in the workshop and eligible live locations. A distinct pair-session coordinator reserves both people and a clear throw corridor, owns the airborne hoop and transfers the contact role on catch. End solo sessions before attempting pair acquisition; never append a second claim to a live solo session. Both people count against the cap of eight, and the initial prop cap is two hoops per participant, at most 16 activity hoops including the single coordinator-owned exchange prop.

Use the FrisbeeSession paired release/reentrancy pattern as a reference (src/people/frisbeeSession.js:9-36,52-62), but explicitly prevent stealing: ActivityClaims.acquire can replace an old owner (src/people/activityClaims.js:24-29). Stage resources, recheck unclaimed eligibility inside synchronous acquisition preparation for each person, acquire and revalidate both claim incarnations plus resources, and only then mark the pair active. A reentrant callback that revokes the first during the second acquisition triggers full rollback. Cancellation clears authority before invoking external cleanup and attempts every release even if another fails. Failed second-person acquisition rolls back the first claim; interruption of either partner cancels both sides without resurrecting a stale handle. This is a planned delivery stage with explicit tests, not a prerequisite for proving the single-dancer engine.

### Verification is the first deliverable

Add a flow workshop and its minimal opt-in production pose adapter together through the real Crowd/activity path, with classic/flow comparison, seed/profile controls, pause, step, seek, phrase history, contact markers, reach error and clearance display. A debug score inspector explains rejected transitions and exports replay input. Include scale/heading/terrain fixtures, interruption buttons, place loss and repeated disposal/recreation. No separate sandbox-only dancer rig.

First vertical slice: hand orbit → isolation → hand transfer → overhead orbit, with one returning motif and a classic comparison. It must demonstrate continuous contact, two visibly different profiles, a recognizable returning motif and a held moment of stillness at normal game-camera distance before expanding the vocabulary. Define and record numerical contact, boundary-position and velocity tolerances before the first visual acceptance pass. Then add body-orbit entry, rolls, flight/catch, two-hoop motifs and the partner exchange in that order.

## Risks / Trade-offs

- Limited arm workspace: prove reachable paths with the exact current shader and both-hand CPU reference before deciding whether a minimal articulation extension is necessary. Shared changes require frisbee, dance and instrument regression coverage.
- Mechanical variety: measure phrase repetition and transition distribution, then visually review continuity and personality. Many distinct seeds alone do not prove interesting choreography.
- Collision approximations: use conservative swept envelopes and authored contact windows. This is controlled animation, not a physically exact collision solver.
- Frame partition dependence: compile scores at entry and sample absolute score time, testing equivalent accepted-time partitions and crossed boundaries. Separate a recorded interruption event from timing-only replay.
- Performance: preallocate sample buffers, bound score-compilation work at entry/reentry and avoid per-frame geometry/material/vector allocation. Measure allocation separately from steady-state sampling and matched full-game cost.
- Lifecycle/boot/tier policy: retain Crowd ownership and normal module imports, pool carefully, add no lights or shadow casters, and verify Low/Mid/High without changing threeShim or audio initialization. sandbox.html bypasses the Low Lambert swap (src/threeShim.js:48-52), so confirm Lambert material type and successful render in the real Low game, not only in the workshop.

## Migration Plan

Land the workshop with the minimal optional production flow adapter first, then the bounded pure score compiler, then full session/lifecycle integration and vocabulary, and finally opt existing slots into the new style. Classic remains the default and a regression fixture. No worldgen seed migration is intended. If the final opt-in requires altering selection order, stop and make that change explicit rather than claiming deterministic equivalence.

## Open Questions

No human decisions block this draft. Rig reachability, final classic/flow mix and measured cost are implementation acceptance questions owned by the tasks. The [completed council synthesis](deliberations/001-initial/results.md) recommends proceeding with these mitigations; its publication, ownership, clock and replay refinements are incorporated here. Runtime evidence remains outstanding.

### Continuous joins, taller throws and chest rolls

The October 30 refinements address Gary's observed stop-start choreography.
Compatible hand-owned joins use a bounded geometric grip-phase bridge with
matched endpoint derivatives; local hoop speed, not merely moving the entire
body or spinning colored tape, establishes continuity. Incompatible body
support and ballistic phases retain their contact contracts.

Aerial height is an isolated seeded descriptor between 0.65 and 2.4 meters above
release. Launch speed and flight duration derive from gravity; preparation and
recovery adapt to keep both hands reachable. A full chest roll extends the
vocabulary beyond the short forearm roll, using the actual arm/chest support
shape and a receiving-hand gaze. The workshop exposes explicit phase inspection
so naturalness and contact can be judged separately.
