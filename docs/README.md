# Contributor documentation

Start with [the player README](../README.md) for the game, or
[the debugging quick start](../DEBUGGING.md#quick-start) to work on it locally.
Commands in these guides assume the repository root.

## Where information belongs

| Question | Read or update |
| --- | --- |
| How do I play? | [README](../README.md), kept free of debug features and Easter egg spoilers |
| What must an agent follow? | [AGENTS](../AGENTS.md), with a local `AGENTS.override.md` when present; Claude's entry point imports it |
| How do I run, inspect and verify a change? | [DEBUGGING](../DEBUGGING.md) |
| How do the systems fit together? | [ARCHITECTURE](../ARCHITECTURE.md) |
| What must a capability guarantee? | [Capability specs](../openspec/specs/README.md) |
| What remains to do or approve? | [ROADMAP](../ROADMAP.md) |
| What shipped, and why? | [CHANGELOG](../CHANGELOG.md) |
| What did we actually measure? | [Verification index](../verification/README.md), followed by the dated report |

The architecture explains implementation, while specs express intended
contracts. Neither a historical plan nor an old source-line citation proves
current behavior; check the source and relevant tests when they disagree.
Keep unresolved acceptance separate from shipped implementation.

## Task guides

- [Performance playtests](performance-playtests.md): guided phone/desktop
  capture, quality comparisons, shader probes and registry measurements.
- [Layout verification](layout-verification.md): plan versus built truth,
  snapshots, normalization and layout linting.
- [Browser verification and cleanup](browser-verification.md): process
  ownership, local safety restrictions and the software WebGL fallback.
- [New-model checklist](../.claude/rules/sandbox-and-testing.md): sandbox wiring
  and integration checks.
- [Worldgen module guide](../src/worldgen/README.md): the pure layout generator.
- [Leaderboard operations](../workers/leaderboard/README.md): Worker setup,
  diagnostics, deployment and request tracing.

## Plans and backlog

The [roadmap](../ROADMAP.md) is the pending-work index. Longer records preserve
original decisions and evidence, including shipped portions; they are not
parallel roadmaps or automatic implementation requests.

| Record | Scope and status source |
| --- | --- |
| [Festival Run acceptance](backlog/festival-run.md) | Tuning, leaderboard operations, device checks and unresolved human decisions |
| [Gameplay designs](backlog/gameplay.md) | Passenger quests, activities, juice economy and prop physics |
| [Festival layout](backlog/festival-layout.md) | Original plan/build diagnosis, delivered slices and remaining acceptance |
| [Festival research](backlog/festival-research.md) | Dated validation questions and design leads |
| [Trip effects](backlog/trip-effects.md) | Tier policy, effect designs and shipped harness history |
| [Performance](backlog/performance.md) | Measured work, rejected approaches, paused slices and parked ideas |
| [Bubble Upgrades plan](../BUBBLE-UPGRADES-PLAN.md) | Feature decisions and execution record; [handoff](../verification/bubble-upgrades/HANDOFF.md) for acceptance status |
| [Lantern parade plan](../PUPPET-PARADE-PLAN.md) | Original handoff; [verification](../verification/puppet-parade/README.md) for delivered behavior and limits |
| [June improvement plan](../PLAN.md) | Historical survey, not a current prioritized queue |
| [Festival elevation proposal, October 24](../verification/terrain/2026-10-24-proposal.md) | Astra’s terrain directions, surface dependencies and staged proof plan; no terrain implementation |
| [OpenSpec](../openspec/specs/README.md) | Capability baseline; enter the change workflow only for an explicit planning/change task |

Keep existing feature plans at their stable paths so old conversations and
review records remain useful. Do not silently turn an old unchecked box into a
new requirement or mark a device check passed from desktop evidence.

## Maintaining the docs

Update the authoritative document rather than copying a procedure into several
entry points. Link to detailed reports instead of adding captures and benchmark
narratives to setup instructions. Keep report limitations beside measurements,
trim completed roadmap items, and preserve decisions and parked ideas in their
linked records. Historical reports and changelog entries retain their original
context unless correcting a factual error.

For a documentation-only change, check relative links, heading anchors, and
commands against the actual files/scripts, then run `git diff --check`. A game
boot is required when runtime code changes, not when reorganizing prose.
