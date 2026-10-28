# Review resolutions

The [council synthesis](deliberations/001-architecture/results.md) considered five
independent specialist positions and the separately attributed [Astra review](astra-review.md).
All requested architecture corrections are incorporated into the final design,
specifications, and future checklist. This records planning decisions, not completed
runtime fixes. The reviewed draft remains in `deliberations/001-architecture/input-plan/`.

## Astra's six findings

| Finding | Disposition | Final contract and implementation task |
| --- | --- | --- |
| Activity acquisition, write, replacement, and release semantics | Accepted | Design's activity transition protocol and claim-checked spec scenarios; Task 2.3 (claim lifecycle) and Task 3.1 (ownership acceptance). |
| Controller-incarnation-safe identity | Accepted | Runtime-issued owner token plus slot generation; Task 2.2 (lifetime-safe handles), including replacement of the full runtime and stale callbacks. |
| Healing Arts model supplies authoritative movement | Accepted | Activity-owned sampler/cache with bootstrap, prior-sample reads, and legacy near/night-transition sampling barrier; Task 2.6 (motion extraction) and Task 2.7 (Healing Arts vertical slice). |
| Scheduling dependencies extend beyond people | Accepted | Permanent documented interleaving is allowed; Task 1.4 (complete frame trace), Task 2.25 (dependency slots), and Task 3.2 (observable equivalence). |
| Population registration alone does not prove extension | Accepted | Population/activity/role examples early and at final acceptance; Task 2.9 (early extension proofs), Task 3.5 (final extension proof), and Task 4.1 (contributor contract). |
| Ordered cleanup and borrowed-resource authority | Accepted | Stop participation, revoke claims before callbacks, release borrowers before disposal, and unify both crowd removal paths; Task 2.4 (ordered removal) and Task 3.1 (ownership acceptance). |

## Additional council amendments

| Source | Resolution |
| --- | --- |
| Auditor: nested modules evade current importmap discovery | Task 1.2 (nested-module verification) precedes all source extraction, includes stale entries and negative fixtures for all five required pages, and reconciles map-page scope explicitly. |
| Auditor: routine checks can omit new suites | Task 1.3 (production workshop and routine contracts) wires mandatory non-browser tests into the normal check command. |
| Architect: group removal policy is distinct from freeing person storage | Groups request removal through the population owner; Task 2.13 (monk authority) preserves collective policy, distance exemptions, and rollback. |
| Adversary: external effects retain person references | Task 2.20 (person-query and external-holder migration) follows live handles and retains last-valid target position after removal without retargeting replacements. |
| Adversary: actor clock can become another game loop | Task 2.24 (clock migration) retains the accepted main delta and hidden scheduler, no autonomous loop/catch-up, and converts timestamps/comparisons together. |
| Profiler: interfaces can multiply work or hide cost behind adaptive quality | Stable registration lists, localized providers, operation counters, targeted dirty ranges, zero graphics delta target, and comparable-quality evidence; Task 1.5 (baseline), Task 2.5 (renderer seam), and Task 3.3 (bounded-work acceptance). |
| Auditor and Pragmatist: final documentation can become deferred documentation | The checklist preamble requires evidence and same-commit observable documentation per slice; the final group reconciles what was maintained throughout. |

## Actual disagreements resolved

The Pragmatist favored children first, while Astra favored the harder borrowed-person
slice first. The mediator selected Healing Arts first because its verified reverse
motion dependency must shape the authority contract, followed immediately by children
to challenge adult-specific assumptions. Both must pass before broad rollout.

The draft's fixed final phase list conflicted with characterized smile/scoring and
late-render barriers, so it was replaced with explicit dependency slots. A documented
permanent integration point is not unfinished migration code.

Moving the Healing Arts calculation alone could change far-away behavior and advance
motion one sample. The final plan therefore retains its old sampling cadence as an
explicit activity policy. Current-sample unification would require a separately
characterized intentional behavior change; it is not an unresolved planning question.

## Remaining decisions

No unanswered human question blocks this planning deliverable. Exact API spelling,
baseline capture, and implementation acceptance belong to the unchecked future
tasks. The original request was planning-only; the updated 2026-10-26 scheduled
instructions now permit implementation after planning completion, tracked separately.
