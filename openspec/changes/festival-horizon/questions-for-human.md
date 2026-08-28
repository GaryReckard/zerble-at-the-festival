---
change: festival-horizon
open: 0
answered: 1
last_question: "Q1 (2026-08-27)"
last_answer: "Q1 (2026-08-28)"
---

# Questions for Human: Festival Horizon

> **AGENT DIRECTIVE:** Check this file when resuming work. If `open > 0`, present
> each unanswered question to the user before starting new work.

## Open Questions

(none)

## Answered Questions

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
- **Answer (2026-08-28):** **Yes.** Gary pulled the branch on his Mac, drove
  with `?farField=1`, and signed off: "ok, looks good! Please promote to on by
  default! push, merge to main, and push that too!" That real-device drive is
  the D11 look at planning cold-step feel + worst-frame the GPU-less box
  couldn't provide. **Action:** -> Task 5.5 executed (DEFAULT_FAR_FIELD =
  true, `?farField=0` retained as the A/B control, gates re-run), -> Task 6.2
  CHANGELOG entry + ROADMAP narrowing landed, branch merged to main and
  pushed per Gary's explicit instruction.
