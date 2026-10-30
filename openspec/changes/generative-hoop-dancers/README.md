# Add expressive, composing hoop dancers

> **Status:** <!--STATUS:LINE-->in progress · 32/33 tasks (96%)<!--/STATUS:LINE-->

## TL;DR

Treat regular waist hooping and choreographed flow as two modes of the same performer, with a flow style whose performers compose continuous routines from a small vocabulary of contact relationships. Each dancer develops a recognizable motif, changes it and returns to it, coordinating the hoop, hands and body throughout the phrase. The implementation now includes contact-aware single-hoop phrases, traveling dance steps and turns, supported rolls, toss/catch, separated two-hoop patterns and a bounded partner exchange. The initial desktop implementation passed its contracts, browser/tier boot and streaming checks. The refinement adds planted feet, waist groove, moving isolations and dance around tosses, with shared articulation in regular waist mode. Variable-height throws, continuous momentum between tricks and a full supported chest roll now pass desktop validation; physical-device checks remain open.

## The Problem

A new routine should feel inventive and intentional while remaining believable at the hands and hoop. The live game already lends Crowd participants to hoop activities, so this addition needs to respect that ownership and preserve the familiar waist routine. See the [verified scope](proposal.md#scope-check).

## Proposed Fix

Build a production-path workshop with the minimum flow-pose adapter first, then compile complete seeded session scores and sample them through the same person-and-hoop presentation contract. Prove a hand orbit flowing into an isolation, a hand transfer and an overhead return, then extend the same engine to body orbits, rolls, tosses, two-hoop patterns and a bounded partner exchange. The [design](design.md) explains the contact system, performer profiles, timing and delivery stages.

## Progress

<!--STATUS:AUTO-->
**in progress** — 32/33 tasks complete (96%) · current: 7.1 (physical iPhone/Safari acceptance)

_Last updated: 2026-10-30_

| Group | Progress |
|---|---|
| 1. Planning risk gate | 1/1 ✅ |
| 2. Production-path workshop and rig proof | 3/3 ✅ |
| 3. Pure score and first complete phrase | 4/4 ✅ |
| 4. Activity integration and complete single-hoop vocabulary | 6/6 ✅ |
| 5. Multiple hoops and partner composition | 3/3 ✅ |
| 6. Acceptance and documentation | 5/5 ✅ |
| 7. Device acceptance and research refinement | 1/2 |
| 8. Grounded choreography refinement | 9/9 ✅ |
<!--/STATUS:AUTO-->

## Key Decisions

- Share an articulated performer between regular waist mode and choreographed flow, retaining current Crowd ownership and the familiar waist orbit.
- Give the performer score-driven traveling steps, leg strides, torso turns, weight shifts and coordinated head movement, with exact shoe support under body lean.
- Compile a complete performance with an entrance, evolving motif, flourish and resolution, preserving meaningful variation across encounters.
- Make hands and hoop read one sampled performance state, and validate against the actual rendered arm transforms.
- Reserve a conservative performance envelope and bound the number of hoops, candidate transitions and participants.
- Use an isolated random stream and accepted actor time so performances can be reproduced and inspected.

## Risks & Watch-outs

The current arm rig has a limited workspace, so the first technical proof must establish reachable contact paths and coordinate agreement. See [source evidence and mitigations](design.md#context). The [completed council review](deliberations/001-initial/results.md) recommends proceeding with safeguards for synchronous pose publication, scratch-buffer reuse, replay, interruption timing and partner authority. Its publication, ownership, clock and replay obligations are implemented and covered by the recorded desktop checks. Device acceptance remains separate. The [tasks](tasks.md) retain all verification work, including tier costs and game integration.

## Where Things Live

- [Proposal and source scope](proposal.md)
- [Technical design](design.md)
- [Research brief for technique and dance mechanics](research-brief.md)
- [Implementation and acceptance checklist](tasks.md)
- [Measured verification, captures and limits](../../../verification/hoops/README.md)
- [First supplied research report](research/01-user-report.md)
- [First evidence assessment](research-assessment.md)
- [Second supplied research report](research/02-hoop-dance-animation-research.md)
- [Second assessment and combined refinement priorities](research-assessment-02.md)
- [Capability requirements](specs/hoop-choreography/spec.md)
- [Council synthesis and risk register](deliberations/001-initial/results.md)
- [Decisions and discoveries](session-log.md)
- [Human question queue](questions-for-human.md)

No human decision is currently blocking the first implementation milestone.
