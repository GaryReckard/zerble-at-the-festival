# Council briefing — worldgen-layout-harness (round 001-initial)

## What is being deliberated

The full artifact set of the `worldgen-layout-harness` change, at apply-readiness:

- `openspec/changes/worldgen-layout-harness/proposal.md` — why + capabilities
- `openspec/changes/worldgen-layout-harness/design.md` — decisions D-A..D-H
- `openspec/changes/worldgen-layout-harness/specs/*/spec.md` — 5 capabilities
- `openspec/changes/worldgen-layout-harness/tasks.md` — groups 1–8

Read those four (plus CLAUDE.md and the rules they cite) before opining.

## One-paragraph context

Two playtest rounds found the v2 festival "a jumbled mess." Root cause (ROADMAP
"Festival layout — the plan/build contract refactor"): `festival.js` plans hubs as
points + scalar `KIND_FOOTPRINT` radii while `chunks.js` builders construct
oriented shapes that exceed them; nothing reconciles the two, and no harness
surface can even *see* the built composition — the only layout-bug detector today
is Gary driving around. This change builds the harness FIRST (per the project
doctrine), as the gate for the follow-up `festival-zone-grammar` rewrite: a
layout linter, dry-runnable builder layouts, a `FESTIVAL_TUNING` hoist, a hub
viewer page, map-sandbox true-extent + gallery modes, `__dbg` layout verbs, and a
playtest marker hotkey. The change is **golden-frozen**: both determinism goldens
and the built world must come out byte-identical (verified via a new
`dumpRegistry` layout-snapshot diff, built first — design D-A).

## The risk signatures that triggered this round

1. **Determinism / rng-call ordering (CRITICAL).** Tasks group 3 re-plumbs every
   worldgen builder into pure layout functions that must reproduce the EXACT rng
   draw sequence, including cosmetic draws and conditional draws (design D-C).
   One missed conditional draw = silently different worlds.
2. **Importmap maintenance now spans THREE html files** (index, sandbox, the new
   hub-sandbox) — the most-tripped footgun in the repo gets a third leg.
3. **Disposal safety** — `showFootprints` decals and the hub viewer's
   rebuild-in-place dispose walk (must respect `userData.shared`).
4. **chunks.js exercised outside the game** — `buildHubPreview` runs the builder
   path with a synthetic ctx; the R2 return-shape class of boot crashes moves to
   a new surface.

## Questions the council should pressure-test

- Is the D-A gate (registry snapshot diff at 3 seeds + 2 goldens) actually
  sufficient to prove rng-order preservation, or can a reordering hide (e.g.
  draws that don't affect placement at the sampled seeds)?
- Is the injected `env.waterAt` split (D-C) sound, or does the
  isPointInLake-vs-lakeAt divergence poison the linter's credibility?
- Is one change doing too much (8 task groups)? What's the minimal slice that
  unblocks `festival-zone-grammar`, and should the rest ship as fast-follows?
- Does the linter's rule set actually encode Gary's festival grammar, or are we
  about to gate a rewrite on the wrong invariants?
- Hub viewer through real `buildWorldgenKind` (D-E): right call, or does the
  synthetic-ctx surface create more maintenance than it saves?
- Anything in the harness that should be reusable by the in-game map view /
  future systems and is being built too narrow?

## Constraints (non-negotiable, from CLAUDE.md)

No build step; importmap in every consuming html file; no `THREE.X=Y`; both
goldens frozen for this change; `userData.shared` discipline; `?worldgen=0`
byte-identical; boot the real game before any "done."
