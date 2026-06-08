<!--
  This template backs the `deliberation` gate. Use it ONE of two ways:

  (A) SKIP — for a genuinely low-risk change, save this file as
      `deliberations/000-skipped.md` and fill in the "Skip Rationale" section
      below. Delete the "Deliberation Index" section.

  (B) DELIBERATE — for a risky change, run `/deliberate`, store the council
      outputs under `deliberations/NNN-<slug>/`, and use this file (saved as
      `deliberations/000-index.md`) as the index. Delete the "Skip Rationale" section.

  Zerble risk signatures that REQUIRE a real deliberation: determinism (rng.js
  salts / hash2 inputs / seed-call ordering); render pipeline / threeShim.js /
  material-tier swaps; boot-order or module-load changes; world lifecycle
  (chunk/forest/lake load-unload, disposal, userData.shared, lake-omits-chunkKey);
  perf-budget-affecting geometry/draw/shadow changes; iOS audio init path;
  importmap changes (must land in BOTH html files); high ambiguity. When in doubt,
  deliberate.
-->

# Deliberation — <!-- change name -->

## Skip Rationale

**Decision:** Skipped — this change is low-risk.

**Signatures checked (none matched):** <!-- e.g. no determinism/rng change, no threeShim/material-tier touch, no boot-order shift, no chunk/lake/forest lifecycle or disposal change, no perf-budget geometry add, no iOS audio path, no importmap change, single-file edit, no broad blast radius -->

**Why deliberation is unnecessary:** <!-- 1-3 sentences -->

## Deliberation Index

<!-- If you ran /deliberate, list the runs here. Each run is a `deliberations/NNN-slug/`
folder (slug is descriptive — e.g. `001-initial`, `002-festival-layout`) containing:
`briefing.md`, one `council-<persona>.md` per selected persona, and `results.md` — the
mediator's synthesis, which is the file to cite. Example:
- `001-<slug>/` — what this round decided (synthesis: `001-<slug>/results.md`)
- `002-<slug>/` — e.g. adversarial review of the plan (synthesis: `002-<slug>/results.md`)
Summarize the headline outcome in a line or two so README.md can cite it.
-->
