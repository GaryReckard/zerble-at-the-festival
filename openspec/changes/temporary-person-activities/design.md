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
