# Design and investigation

## Verified starting points

- `src/people/hoopers.js` owns eight separate handles, models, collider records and registry footprints; its roaming callback passes only `frame.zerble.position`.
- `src/people/frisbees.js` owns paired player handles and each disc; its roaming callback likewise passes only the position. Disc states are held, flying and landed.
- `src/crowd.js` returns early for externally claimed people in `_updateNpc`, before its trajectory test. Its honk handler removes an active claim, so a claim cannot presently resume after a reaction.
- `src/people/activityClaims.js` provides exclusive, generation-safe authority with synchronous reservation preparation and resource cleanup on release; it has no suspension operation.
- `src/healingArtsActivity.js` owns place slots and claims, hides the ordinary binding for rigs, and releases participants on fleeing. Its existing sampler runs in the late-activities slot.
- `src/main.js` advances adults before scoring and roaming afterward. Existing activity update order and scoring barriers must remain explicit.

## Authority and resumption decision

A revoked claim remains permanently invalid. A pending activity session can retain a separately owned reservation, or release and reacquire one, but it must validate the person incarnation, place, resources, safety and any partner before obtaining a fresh claim. The wait is bounded and failure cancels the session. Reaction must revoke activity writes before movement, including later writes in the same frame, and must respect protected occupants and blocked exits. Exact APIs and departure geometry remain to be established by the production-backed hula fixture.

Prefer the person's ordinary body with an activity-owned prop so appearance stays intact. Any replacement must represent the complete appearance and preserve one body and collider. Frisbee must acquire both people transactionally and stop throws and pursuit together while resolving held, flying and landed discs. Healing Arts dance keeps its late sampling and independent nightness. Reuse existing steering calculations and isolate new random decisions from existing streams. See the [deliberation](deliberations/001-activity-contract/results.md).

## Scoped animation follow-up, October 28

Use the original Crowd body and appearance pools throughout. One shared instanced
arm geometry has shoulder and elbow tags, and per-person pose attributes deform
positions and normals in the visible material and positions in the sun-depth
material. Ordinary rest poses take a shader fast path. Crowd owns the geometry,
material, publication and hand transform; a current activity claim can request only
validated relaxed/catch/throw poses. Revocation clears the pose synchronously, and
restored or replacement activities cannot reuse the old claim. The disc attaches
to the same shoulder/elbow calculation, transformed by the actual body matrix.
No extra person bodies, colliders, per-person joint objects or draw calls are added.
The original model and Crowd use the same target sampler, with accepted-delta
smoothing. Shared articulation applies to ordinary Crowd adults and dancers;
specialist populations retain their existing model ownership and eligibility.

Hula uses the original 0.27m offset hoop under its rotating waist pivot, with the
original lean, bob and wobble formulas shared by the legacy model and current
activity. One accepted session phase drives the body and hoop, and it pauses during
interruption. The ordinary body keeps its outfit and raises its arms above the hoop.
These are render extensions to the existing contracts, not another ownership rewrite.

The production-backed fixtures first assert hand attachment, joint revocation and
hoop revolution, then verify true native matrix composition and full activity cycles.
Isolated geometry comparisons and Low/Mid noon/midnight captures establish the cost
boundary; physical-device and matched whole-game timing remain separate evidence.
