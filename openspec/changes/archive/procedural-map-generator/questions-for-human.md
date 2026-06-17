---
change: procedural-map-generator
open: 2
answered: 2
last_question: Q4
last_answer: Q1+Q4 (2026-06-06)
---

# Questions for Human: Procedural Map Generator

> **AGENT DIRECTIVE:** Check this file when resuming work. If `open > 0`, present
> each unanswered question to the user before starting new work.

## Open Questions
<!-- Newest first. Move to Answered when resolved. Each has a default so work isn't blocked. -->

### Q3: Is the in-game map view a near-term follow-up?
**Date:** 2026-06-06
**Context:** The generator is architected as a single source of truth so a future map
view can reuse it. Deliberation CG5.7 adds a continuous heart-influence scalar to the
tuple as cheap insurance for this.
**Question:** Is the in-game map view a real near-term follow-up, or someday-maybe?
**Impact:** Whether to note it prominently on ROADMAP; how hard to hold the
render-agnostic line.
**Default (proceeding under):** Keep the generator map-view-ready (carry the influence
scalar); don't build the UI. Park on ROADMAP.

### Q2: Footpath density — "midway" or denser web?
**Date:** 2026-06-06
**Context:** The fine road tier (collectors/footpaths) is parked to a follow-up per
the deliberation (CG5.3) — arterials alone prove the road-hierarchy concept.
**Question:** When footpaths land, which feel — sparse "midway with frontage" or a
denser organic web?
**Impact:** Tuning of the deferred footpath tier; not needed for this change.
**Default (proceeding under):** Lean sparser; revisit when footpaths are built.

## Answered Questions
<!-- Newest first. -->

### Q4: Rivers + mega-heart in this change's scope? — ANSWERED 2026-06-06
**Answer:** **Cut both** (per the council recommendation). Rivers/bridges and the
mega-heart 2×2 are cut from THIS implementation, kept in the spec as the target, and
deferred to the 3D-integration follow-up. River-shaped contract fields
(`onRiver`/`bridge`/`noBuild`) remain as always-false stubs (contract stays stable).
**Action:** -> tasks.md CG5.1 (rivers cut), CG5.2 (mega cut); minor/major ranks only.

### Q1: Heart spacing / rarity target? — ANSWERED 2026-06-06
**Answer:** **Build the tuner** — start with a medium default (~major heart every
20–30s of driving at boost ≈ 28 m/s) and decide by eye at the §3.4 / GATE-1 macro
view. The zoom-out view is the acceptance instrument.
**Action:** -> tasks.md CG1.7 (constants surface), CG2 GATE 1 (tune by eye, capture
chosen constants in session-log).
