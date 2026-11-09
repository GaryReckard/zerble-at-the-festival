# Structural optimization investigation, November 7

**TL/DR:** The three tested directions have not earned a production rewrite.
Ground-support reuse passed exercised exactness but showed no stable timing
advantage, registry publication offered a small controlled saving with an adverse
all-mover case, and shopkeeper batching reduced draws without materially reducing
render work. Two real council deliberations and the independent factual audit support
stopping with no selected rewrite; no runtime optimization is claimed by this bundle.

## Scope and identity

Gary authorized brainstorming, analysis and disposable experiments for larger
restructuring, followed by exhaustive planning of one worthwhile candidate or
stopping if none justified the work. This is an investigation, not production
implementation. The [OpenSpec front door](../../../openspec/changes/structural-performance-redesign/README.md)
and [checklist](../../../openspec/changes/structural-performance-redesign/tasks.md)
track the conditional decision.

The [baseline manifest](source-manifest.json) identifies app
`00d10db620720b429a5ab93e6973495324b8d2e0c33e7b98ea6d22dedf64b708`,
which includes the prior uncommitted November 6 terrain work. The latest
[working-source check](working-source-check.json) found all 303 inventoried
application/harness inputs unchanged. Diagnostic source exposure was confined to
a [disposable copied build](render-build-provenance.json). No production file
was changed by this goal.

## What was investigated

| Direction | Evidence | Current result |
| --- | --- | --- |
| Reuse exact native ground/support calculations | [Support feasibility](support-probe-report.md), actual sampled trace, strict synthetic/replay oracle, cold/warm alternating timing | 595 synthetic scenarios and 11,358 captured sparse requests agreed on exercised results/poses. Cold costs rose; warm timing offered no stable advantage. Do not advance this certificate. |
| Explicit spatial registry publication | [Registry feasibility](registry-probe-report.md), ordered query/geometry oracle and full publication/maintenance timings | 16,948 exercised comparisons passed. About .134 ms/frame saved with three declared movers in Node, but about .140 ms added with all 2,937 publishing. Static ownership and live benefit remain unproved. Do not select this prototype. |
| Static booth transform flags | [Rendering discriminator](render-probe-report.md), pinned r160 arithmetic audit and frozen hardware renders | Local composition fell but all selected world multiplications remained. No protected view reached the predeclared 1 ms nomination saving. |
| Spatial shopkeeper part submission | [Rendering discriminator](render-probe-report.md), all three cameras at Noon/Midnight, Low/High, 4,608 measured renders total across both mechanisms | Draws fell by 63–151 High and 63–128 Low, while median work changes were small and mixed. No protected view reached the nomination saving. Do not advance this rig-retaining mechanism. |
| Other structural mechanisms | [Candidate inventory](candidate-inventory.md), [source maps](render-actor-source-map.md) and [finite residual triage](residual-cost-triage.md) | Adult spatial publication, child solving/compact poses and streaming/ground tails have specific missing attribution. Their possible benefit is not disproved; no replacement is selected from global totals or loop caps. |

## Measurement boundaries

The fresh [High driving](high-route-all-functions.json),
[Low driving](low-route-all-functions.json) and
[High parked](high-parked-all-functions.json) profiles establish sampled
attribution only. Inclusive totals overlap and cannot be summed or treated as
saved frame time. Topology inventories are unculled eligibility leads, not actual
saved draws. The initial support trace filled during settling and is preserved
separately; [the revised trace](support-request-trace.json) spans the route with
bounded sparse sampling.

Support and registry timings are controlled Node fixtures. The rendering study
uses frozen poses and manual composer renders, retains all source rigs and
records cold construction separately. Its engineering nomination filter is not
the lab's calibrated ordinary-frame policy. Neither the profiles nor these
fixtures establish sustained driving improvements, GPU completion timing, Auto
quality, long-run memory retention, older iPad performance or iOS audio unlock.
No optimization advances from a count reduction alone.

## Decision and audit trail

- [First real council](../../../openspec/changes/structural-performance-redesign/deliberations/001-options/results.md): option analysis and experiment ordering.
- [Second selection council](../../../openspec/changes/structural-performance-redesign/deliberations/002-selection/results.md): unanimous independent recommendation and mediated decision to stop with no selected rewrite.
- [Final factual audit](final-fact-check.md) and [completion audit](completion-audit.md): independent arithmetic/source checks and original goal coverage.
- [Adversarial selection audit](selection-adversary.md): limits of each result and the distinction between a conditional plan and a production recommendation.
- [Residual-cost triage](residual-cost-triage.md) and [exact extracted rows](residual-cost-triage.json): remaining mechanisms and their missing evidence.
- [Rendering policy](render-discriminator-policy.md), [raw High](high-render-raw.json), [raw Low](low-render-raw.json), [summary](render-summary.json), [byte-identical summary regeneration](render-regeneration-check.json) and [image checks](render-image-checks.json).

## Ownership and reproducibility

The [quiet-window grant](grant.json) records Gary's explicit reservation until
return. The accepted performance-lab supervisor owned each disposable hardware
Chrome profile, local server, control-worker deadline and cleanup. All seven
capture ownership records reported successful cleanup. An independent exact-PID
and birth-identity audit found all 148 recorded owned identities gone and no
remaining lab lease: [cleanup receipt](capture-cleanup-2.json). User browser
sessions and existing servers were preserved. The exact task-owned keep-awake process was also stopped and verified absent:
[keeper cleanup](keeper-cleanup.json).

The saved diagnostic directories remain under ignored local lab storage; selected
raw/input/ownership artifacts are promoted here. The diagnostic scripts are
task-specific evidence, not newly supported performance-lab commands. Rendering
summary reproduction from the fixed saved capture roster is:

```sh
python3 verification/performance/2026-11-07-structural-options/analyze-render-probe.py
```

Fresh browser runs require a newly applicable reserved-Mac grant and current
capability receipts. Do not run the experiment scripts as an ordinary test suite
or overwrite failed attempts to manufacture a favorable conclusion.
