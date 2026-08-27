# Deliberation Briefing: Festival Horizon Initial Plan

## Task

Review the finalized `festival-horizon` OpenSpec proposal, design, specification,
and task plan. Decide whether the bounded, render-only semantic horizon is safe
and sufficiently scoped to implement, and identify any required task or design
changes before application begins.

## Context

- **OpenSpec Change:** `openspec/changes/festival-horizon/`
- **ROADMAP item:** `ROADMAP.md` section “Far-field festival depth / semantic LOD”
- **Subsystems:** render pipeline, world streaming observation, deterministic
  worldgen reads, performance tiers, GPU resource lifecycle, sandbox/debug harness
- **Files expected:** `src/farField.js`, `src/world.js`, `src/perf.js`, `src/main.js`,
  `hub-sandbox.html`, all four HTML importmap source lists, focused test and docs
- **Architecture sections:** world chunks, lakes, worldgen v2 contract, determinism,
  render pipeline, performance tiers, registry ownership
- **Primary artifacts:** `proposal.md`, `design.md`,
  `specs/festival-horizon/spec.md`, and `tasks.md` in the change folder

## Constraints

- No build step; a new source module must be listed in all four HTML cache-buster
  importmap arrays.
- ES module namespaces are frozen. Do not patch `THREE` exports after import;
  materials must work through the existing `threeShim` path.
- The synchronous iOS audio initialization chain must remain untouched.
- Determinism is load-bearing. Do not reorder, re-salt, or consume existing RNG
  calls; fixed-seed full-world output must remain identical.
- `ChunkManager` and `LakeManager` retain authoritative ownership. Lakes omit
  `chunkKey` intentionally, and shared pooled resources must not be disposed.
- Added geometry must stay within a hard 12-draw ceiling, add no lights or shadow
  casters, remain stable across unload/travel, and be tested on low/mid/high.
- Instanced writes require their update flags, and proxy fades must avoid
  transparent sorting.
- The isolated hub sandbox is necessary but insufficient; the full title/start,
  world boot, chunk handoff, console, and cleanup paths must also pass.
- Deliberation writes markdown only. Do not edit game code.

### Your Output

Write your complete Round-1 position to the exact `OUTPUT_PATH` supplied in your
assignment. Return a brief summary containing your Verdict, Key Concern, and three
bullets.

### Your Task (Round 1)

1. Propose your prioritized order of operations for this change.
2. Identify risks and concerns from your own domain, grounded in the artifacts,
   documentation, and code.
3. Give a Verdict: Proceed, Proceed with mitigations, or Block.

You are working in isolation. Do not speculate about other personas and do not
write an “Anticipated Tensions” section.
