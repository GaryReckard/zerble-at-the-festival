## Why

Add the joy of a hoop dancer inventing a continuous performance while preserving the existing classic waist-hooping behavior. The goal is recognizable technique, musical phrasing and performer personality, rather than a shuffled playlist of tricks.

## What Changes

- Add a flow style alongside classic hooping, using existing Crowd participants and activity ownership.
- Compile complete bounded session scores with entrance, motif development, flourish and resolution from contact relationships: body orbit, hand orbit, isolation, transfer, supported roll and flight/catch.
- Let motifs return with controlled changes in direction, plane, height, tempo and handedness, with compatibility and reachability deciding which combinations are legal.
- Coordinate hoop trajectories, both arms and body motion from one sampled performance state, with safe interruption and deterministic replay.
- Build an inspectable production-path workshop with the minimum opt-in pose adapter before enabling live flow, then include multi-hoop motifs and a bounded two-person exchange as later stages of this same plan.

## Capabilities

### New Capabilities

- `hoop-choreography`: additive flow style, constrained composition, pose/contact agreement, replay, interruption and inspection.

### Modified Capabilities

None. Existing crowd ownership, model and sandbox contracts continue to apply; the new capability adds requirements without replacing classic behavior.

## Impact

Touches crowd activity animation, hoop presentation, sandbox controls and regression coverage. Runtime implementation will require CHANGELOG and ROADMAP updates. Planning alone changes no player behavior and adds no dependency.

Risk signatures: isolated deterministic RNG, activity/resource lifecycle, arm transform compatibility and per-tier CPU/draw/geometry cost. No new shadow casters or lighting system is proposed. Preserve threeShim, synchronous iOS start audio and existing world-generation RNG streams. Ordinary imports follow the current Vite toolchain; historical OpenSpec importmap instructions are superseded by AGENTS.md.

## Scope Check

Pattern: hoop trajectories must agree with their performer's pose throughout an activity.

| Verified location | Scope |
| --- | --- |
| src/main.js:661 | Live HulaActivity construction; retain the controller |
| src/people/hulaActivity.js:12-35,50-55 | Hoop ownership, reservations and rendered pose; add style-aware sampling |
| src/people/hulaSession.js:11-18,26-57 | Pose provider, accepted elapsed time, interruption and claim lifecycle; preserve classic default |
| src/crowd.js:1609-1610,1787-1806 | Current activity body sampling and fixed hula arms; extend only when a flow pose is present |
| src/personMotion.js:58-66,99-118 | CPU hand calculation and shader articulation; share their exact transform contract |
| src/models/hulaHooper.js:61,249 and src/people/hoopers.js:21 | Standalone classic builder/population; retain for compatibility and comparison |
| sandbox.html:2083-2116 | Existing population/classic previews; add a production-path flow workshop |
| bin/test-hula-session, bin/test-hula-activity, bin/test-person-motion | Extend regression evidence rather than substitute preview-only tests |

Frisbee throwing and Healing Arts share arm infrastructure but keep their behavior. They require regression checks if the common arm contract changes, not a choreography migration.

## Council Outcome

The [Tier 3 synthesis](deliberations/001-initial/results.md) recommends proceeding with mitigations, using complete finite session scores rather than online phrase selection. The design and tasks incorporate publication ordering, explicit sample resets, isolated replay with environmental events, bounded restart clocks, owned clearance, non-stealing partner acquisition and real Low-tier game acceptance. The complete vocabulary and later multiple-hoop/partner stages remain in scope; runtime acceptance is not implied by the planning gate.
