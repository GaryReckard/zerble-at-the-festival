# Risk gate: bounded controls and braking

Checked RNG, render/threeShim/material policy, world boot/module ordering,
world lifecycle/disposal, geometry/shadows/postprocessing, iOS audio unlock and
HTML inventories: none changes; the new pure control owner does not alter the
buildWorld chain. User-approved interaction rules and the existing single
contact-impulse controller make the implementation choice bounded, with native
slope/air/interruption tests covering its specific numerical risks; no competing
physics controller or population changes are introduced. Proceed without a council.
