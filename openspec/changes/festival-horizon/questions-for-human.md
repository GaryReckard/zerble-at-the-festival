---
change: festival-horizon
open: 1
answered: 0
last_question: "Q1 (2026-08-27)"
last_answer: null
---

# Questions for Human: Festival Horizon

> **AGENT DIRECTIVE:** Check this file when resuming work. If `open > 0`, present
> each unanswered question to the user before starting new work.

## Open Questions

### Q1: Promotion sign-off — flip the far-field horizon on by default?

- **Date:** 2026-08-27
- **Context:** Every gate that can be measured on this machine passed (see
  `verification/gates-flag-on.md`): the horizon costs at most 6 scene draws and
  3.7k/~6.6k/~7.8k marginal triangles on low/mid/high (caps: +5k/+10k/+10k),
  determinism and registry truth are byte-identical off vs on, resources
  plateau over long travel exactly like the flag-off game, and every boot
  combination has a clean console. Per D11, ALL tiers' promotion gates re-keyed
  to marginal-delta + no-regression + **your explicit sign-off**, because the
  flag-off game already exceeds every absolute HUD budget.
- **Question:** Do you sign off on enabling the horizon by default (keeping
  `?farField=0` as the A/B control)? Two numbers could not be judged on this
  GPU-less box and are worth one real-device look first: the per-frame
  planning cold-step (measured 7.6–42ms under SwiftShader vs the 2ms tier
  gate — likely fine on real hardware but unproven) and worst-frame impact.
  A quick phone/laptop drive with `?farField=1` (and the `?perfCapture=1` LAN
  flow if you want numbers) would settle both.
- **Impact:** Yes → task 5.5 flips the default, 5.1–5.4 re-run, ROADMAP bullet
  closes. No / not yet → the experiment stays behind `?farField=1` and the
  ROADMAP bullet stays narrowed to "promotion pending."


## Answered Questions
