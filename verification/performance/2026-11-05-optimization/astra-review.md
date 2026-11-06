# Astra consultations

Gary authorized a couple-few Astra consultations. Three read-only Astra Medium
turns were used; they launched no browsers, ran no builds/benchmarks and changed
no files. The root agent implemented and tested the changes.

1. **Experiment selection.** Astra confirmed the immediate adapter
   `propose`/`commit` double sweep and recommended the existing atomic move API.
   It required preserving both child grounding passes, which protect query
   eligibility and final collision/animation publication separately. It
   endorsed testing child instancing after that change, while challenging
   transform duplication, shadow flags, global RNG, bounds and ownership.
2. **Renderer review.** Retaining the original hierarchy and borrowing only
   mesh render layers resolved the proposed detachment problems. Astra caught
   potential-triangle double counting in the diagnostic inventory and requested
   a true partial-construction rollback test, vertex-containment checks,
   explicit instance-shear boundaries and stronger camera-frustum tests.
   All were implemented. Unsupported instance shear now restores ordinary
   rendering before scene projection, and replacement/reinstallation of the
   scene hook after the last owner is covered.
3. **Revised culling review.** Astra found no promotion-blocking defect or
   additional material verification gap in the revised path. It checked active
   camera filtering, offscreen shadow-caster retention, render-state fallback,
   inventory correction and the expanded lifecycle/camera tests. Its conclusion
   explicitly remained conditional on ordinary/diagnostic boot qualification
   and calibrated comparisons, which were the next gates.

The [renderer](../../../src/people/childPresentation.js),
[presentation tests](../../../bin/test-child-presentation),
[atomic grounding tests](../../../bin/test-people-grounding-cost) and
[source-map CPU attribution](diagnostics/baseline-high-cpu-attribution.json)
preserve the implementation and evidence behind these decisions. The review
does not establish physical-iPad performance or replace the saved timing runs.
