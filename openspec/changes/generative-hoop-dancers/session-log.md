---
change: generative-hoop-dancers
status: in_progress
current_task: "7.1 (physical iPhone/Safari acceptance)"
blocked_by: null
open_questions: 0
started: 2026-10-29
last_updated: 2026-10-30
ref: null
---

## Key Decisions

### D1: Preserve classic hooping and add a compositional activity style
Gary explicitly requested keeping current hoopers. Build on Crowd-owned identities and HulaSession claims rather than reviving the standalone population in the live game.

### D2: Plan before implementation
The initial branch phase contained planning only. A real council deliberation is required before implementation because this touches deterministic composition, activity lifecycle and performance. The creative consultation is input, not a substitute for that gate.

### D3: Compile the complete session score before playback
The council resolved the online-composer alternative in favor of a bounded whole-session score, with the minimal production adapter included in the workshop milestone. Preserve the full movement/multiple-hoop/partner scope and test its readability at normal game-camera distance.

## Assumptions

| Assumption | Confidence | Status | Resolution |
| --- | --- | --- | --- |
| Local beat phrasing is sufficient for the first release; stage audio synchronization is optional | Medium | Proposed default | Keep audio initialization and scheduling outside this change |

## Dangling Threads

- Physical iPhone/Safari contact, support and GPU acceptance remains open; desktop refinement checks are complete.

## Work Log

### 2026-10-29 -- Live integration differs from the older model
**Event:** discovery
**What:** main.js constructs HulaActivity; its participants remain Crowd-owned. The standalone HulaHoopers/model path remains useful as a classic sandbox comparison, not the new live integration point. OpenSpec config still contains historical importmap/no-build guidance; current AGENTS.md and the sandbox checklist establish Vite and normal imports as authoritative. The referenced openspec/templates memory files are absent, so these files use the documented field/section contracts.
**Refs:** src/main.js:661; src/people/hulaActivity.js:12; src/crowd.js:1609; AGENTS.md; .claude/rules/sandbox-and-testing.md.

### 2026-10-29 -- Creative consultation strengthens the score
**Event:** decision
**What:** The invited prodigy recommended evolving a returning motif, reserving a hoop-sweep envelope and designing a bounded multi-hoop output shape from the start. Incorporated those recommendations, including the explicit rig-coordinate proof before vocabulary expansion. This was a creative consultation, not the required multi-person council deliberation.
**Refs:** design.md, Decisions; tasks.md, groups 2 and 3.

### 2026-10-29 -- Council review and plan reconciliation complete
**Event:** phase-change
**What:** Three independent reviewers and the Mediator returned Proceed with mitigations. Integrated the complete-sample-before-publication rule, explicit discriminator/reset/version, public presentation transform, 32-segment/16-candidate limits, 256-event replay cap, monotonic participation with separate score epochs, owned clearance, non-stealing/reentrant-safe paired authority, and live-game Lambert verification. The planning gate is complete; no runtime implementation or visual acceptance has been performed.
**Refs:** deliberations/001-initial/results.md; design.md; specs/hoop-choreography/spec.md; Task 1.1 (council risk review) completed in tasks.md; next is Task 2.1 (production flow workshop and minimal adapter).

### 2026-10-29 -- Astra owns contact math; physics work remains separate
**Event:** decision
**What:** Gary authorized implementation and requested Astra where useful, noting concurrent prop-physics work. Assigned Astra the pure contact/score engine and independent shader parity tests; production activity, Crowd pose publication and isolated verification remain this change's scope. No changes to coolers/chairs, collision engine or prop dynamics are required. Reentrant entry/completion and same-segment reentry clearance tests exposed and fixed authority/visibility issues before live acceptance.
**Refs:** src/people/hoop/score.js; bin/test-hoop-score; bin/test-hoop-flow-session; src/people/hulaSession.js; src/people/hulaActivity.js.

### 2026-10-29 -- Facing corrected and dance scope made explicit
**Event:** decision
**What:** Gary identified the arms reaching behind the face/feet. Verified Crowd forward as local negative Z, corrected the full choreography frame and added source/geometry-facing regressions. Chrome inspection and facing-noon.png confirm the corrected front-side reach. Gary then requested fluid body movement and emphasized leg motion, turning and traveling; added score-driven body/step/head fields, anchored claim-checked travel and exact shoe support rather than cosmetic arm-only motion.
**Refs:** src/crowd.js:239-245,275-277; src/people/hoop/score.js; src/people/hoop/feet.js; bin/test-hoop-workshop; verification/hoops/facing-noon.png.

### 2026-10-29 -- Desktop implementation and first research assessment complete
**Event:** phase-change
**What:** Completed the single/twin/partner vocabulary, moving body/leg/head publication, lifecycle tests, workshop controls, full-game Low/Mid/High boot and streaming roundtrip. Recorded matched CPU fixtures and Noon/Midnight captures, with GPU/device limits explicitly separate. Preserved Gary's first report and assessed its mechanics against primary source prose; the next proposed refinements are planted-foot phases, moving isolation and toss preparation/recovery. The report lacks linked demonstrations and contains conflicting hoop-plane descriptions, so those specifics were not adopted as motion specifications. Physical iPhone/Safari acceptance remains open.
**Refs:** verification/hoops/README.md; research/01-user-report.md; research-assessment.md; tasks.md.

### 2026-10-29 -- Second report received and compared
**Event:** discovery
**What:** Preserved the second report and inspected its prose, reference library and 134 embedded equation images. Verified source prose supports directional waist pulses and connected isolation flow. The report adds useful references, but coordinate reversal, ambiguous isolation frames, incompatible toss timing, insufficient center-only twin clearance and frame-count recovery need correction. YouTube retrieval failed, so its timestamped observations remain unverified. Both requested research reports are now received and assessed; the synthesis prioritizes planted steps/hip groove, moving isolation and dance around inertial flight.
**Refs:** research/02-hoop-dance-animation-research.md; research-assessment-02.md; tasks.md.

### 2026-10-29 -- Grounded choreography refinement authorized
**Event:** decision
**What:** Gary explicitly requested planted steps, waist groove, moving isolations and dance around tosses. Extend the current change with bounded analytic foot contacts and flow-only knee/ankle articulation. Preserve the same accepted clock and cached publication, while expressing fixed illusions and flight in the session frame and inverse-solving local contacts. The supplied close-up hoop map informs silhouettes; the suspended aerial-hoop sheet describes a separate apparatus and does not expand this handheld-dance implementation into hanging acrobatics.
**Refs:** tasks.md, group 8; research-assessment-02.md; design.md.

### 2026-10-29 -- Waist and flow are modes of one performer
**Event:** decision
**What:** Gary asked to extend arms, legs and head movement to the regular waist hooper, then clarified waist hooping and composed flow as two modes of the same performer. Keep the existing style discriminator, participant identity, clocks and prop ownership; share articulated body-pose publication across both modes. The waist mode retains continuous waist hooping rather than borrowing the flow trick score. This explicitly supersedes the earlier requirement to preserve the classic pose formulas exactly.
**Refs:** tasks.md, Task 8.6 (shared waist-mode expression); design.md.

### 2026-10-29 -- Variable aerial height
**Event:** decision
**What:** Gary requested random toss heights and a substantially higher maximum. Choose height once from the isolated score seed, derive speed/flight time from gravity, and serialize that choice for replay. This extends the previously shallow aerial toss without frame-dependent randomness.
**Refs:** tasks.md, group 8; src/people/hoop/score.js.

### 2026-10-29 -- Carry momentum between tricks
**Event:** decision
**What:** Gary observed that the hoop pauses between tricks and lacks flow. The sampler eases each phrase through a quintic curve with zero endpoint speed. Ordinary joins must carry motion while purposeful isolation accents retain stillness, with contact and continuity tests remaining mandatory.
**Refs:** src/people/hoop/score.js, single(); tasks.md, group 8.

### 2026-10-30 -- Full chest roll
**Event:** decision
**What:** Gary described and welcomed a full hand-to-hand roll across outstretched arms and the upper chest/neck area. Implement a chest roll distinct from the existing short forearm roll, proving surface contact and clearing the large stylized head. The Howcast chest-roll tutorial supports continuous arm/chest contact into the receiving hand.
**Refs:** https://howcast.com/videos/512743-hula-hoop-across-the-chest-roll-hula-hooping/; tasks.md, group 8.

### 2026-10-30 -- Grounded refinement verified
**Event:** verification
**What:** Version 6 passes the full check suite and production build, including chest roll/catch geometry and continuous joins. Final real Low game boots through the ready mode button without captured console warnings/errors. Matched CPU benchmark and Noon/Midnight captures are retained. Physical iPhone/Safari remains pending.
**Refs:** verification/hoops/grounded-choreography.md; verification/hoops/grounded-cpu-benchmark.json.
