# Working on Zerble at the Festival

This is the shared instruction file for agents. `CLAUDE.md` points here;
`AGENTS.override.md`, when present, adds local environment constraints and must
not be committed. Start with the [documentation index](docs/README.md), then
read only the references relevant to the task.

## Project and documentation

Zerble is a browser game using plain ES modules, Vite, pinned Three.js,
and synthesized Web Audio. The [live GitHub Pages deployment](https://garyreckard.github.io/zerble-at-the-festival/)
has real players; analytics calls go through `src/analytics.js`.

| Need | Authoritative reference |
| --- | --- |
| Player premise, controls and copy | [README.md](README.md) |
| Local setup, debug APIs and verification | [DEBUGGING.md](DEBUGGING.md) |
| How systems fit together | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Capability requirements | [openspec/specs/README.md](openspec/specs/README.md) |
| Pending work and acceptance | [ROADMAP.md](ROADMAP.md) |
| Shipped behavior and rationale | [CHANGELOG.md](CHANGELOG.md) |
| Measured results and limitations | [verification/README.md](verification/README.md) |

Specs express the intended contracts; source and current verification establish
what the implementation does. Some specs were traced in June 2026 and are not
proof that later features are covered. Recheck cited source lines before edits.
Historical scratch notes and plans are context, not additional current policy.

## Run and verify

Run commands from the repository root:

```sh
npm ci
npm run dev
npm run check
npm run build
```

Reuse an existing suitable server and stop servers you start when finished.
Vite reloads game modules after edits; `npm run preview` serves the production
build. Use the browser tools available in the session; old `preview_*` names
in reports do not require installing a particular integration.

**Build the verification surface before the feature.** Choose the smallest
surface that exercises the change:

| Surface | Use |
| --- | --- |
| `sandbox.html?entity=<name>&mute=1` | One model or effect, orbit camera, time-of-day presets and SFX |
| `hub-sandbox.html?seed=<s>&hub=<n>&mute=1` | One complete festival hub through the real cluster builders |
| `map-sandbox.html?mute=1` | Pure 2D procedural layout; its generator also feeds the live game |
| `/?mute=1` | Streaming, collision, crowd and full-game integration |

Read [DEBUGGING.md](DEBUGGING.md) before verification. `window.__dbg` is the
local game control surface: `help()`, `start()`, `teleport(x,z)`, `tod(t)`,
`fillSeats()`, `camLock(...)`, and `camUnlock()`. Its `game` and `debug` members
expose the live references and interactive overlay API. Use these rather than
stubbing input or fighting the chase camera.

For code changes, run `npm run check` and `npm run build`, then verify the
affected browser path.
Always smoke-test the real game: title card, a ready mode-plank click, world
boot, then console inspection after it runs. A sandbox pass cannot establish
integration correctness. A scripted `__dbg.start()` bypasses the gesture and
cannot verify iOS audio unlock. Documentation-only changes need link and
command checks rather than a game boot.

For visual changes, capture Noon and Midnight. Check Low when touching
materials, shaders or boot order; inspect draw/triangle counters for added
geometry and compare against a measured baseline. HUD budgets are guides, not
proof of device performance. For device captures use the
[performance playbook](docs/performance-playtests.md).

## Browser and audio safety

Always append `mute=1` to agent game and sandbox URLs, including reloads.
Only unmute for an audio test and restore mute afterward. Use the session mute
control, never persist zeroes in the player's volume sliders.

Close test tabs to stop their loops. Standalone automation owns its processes:
unique named sessions, bounded commands, teardown in `finally`, and exact-PID
cleanup checks. Do not run concurrent headless WebGL systems or kill unrelated
processes. Follow [browser verification and cleanup](docs/browser-verification.md)
and any stricter local override. Do not treat software-rendered FPS as a device
measurement.

## Constraints that must survive edits

1. **Keep the toolchain minimal.** Use `npm run dev`, `npm run check`,
   `npm run build`, and `npm run preview`. Imports discover source modules;
   there are no HTML module inventories. Read
   [.claude/rules/no-build.md](.claude/rules/no-build.md) for build/deploy policy.
2. **Patch Three.js through `src/threeShim.js`.** ES module namespaces are
   frozen; assigning `THREE.X = Y` after import breaks spec-strict runtimes,
   including mobile Safari.
3. **Keep iOS audio initialization synchronous with the start gesture.** No
   `await`, timer or other async hop before `Sound.init()`. Retain the sync
   resume, one-sample buffer and silent WAV unlock stages.
4. **Preserve deterministic RNG streams.** Fresh randomness needs a fresh salt;
   do not reorder existing draws or change hash inputs as incidental cleanup.
5. **Respect world ownership.** Chunks unload by `chunkKey`, forests own their
   blocks, and lakes deliberately omit `chunkKey` so their colliders survive a
   host chunk unloading. Registry mutations are not transactional.
6. **Do not dispose shared resources.** Pooled geometry/materials carry
   `userData.shared = true`; disposal must honor it. See
   [.claude/rules/perf-pooling.md](.claude/rules/perf-pooling.md).
7. **Flag instance writes.** Set `instanceMatrix.needsUpdate = true` after
   writing InstancedMesh transforms.
8. **Keep the global nightness contract.** Systems independently poll
   `getTimeOfDay().nightness`; do not centralize this as incidental cleanup.
9. **Respect tier policy.** Low disables shadows and uses the shim's Lambert
   fallback; Mid/High use Standard materials and allow shadows. Add shadow
   casters deliberately. Read [.claude/rules/performance.md](.claude/rules/performance.md)
   before graphics/performance work, and load the relevant installed Three.js
   skill. Measure allocation cost separately from steady-state cost.

## Models and code conventions

Models live in `src/models/`, return a Group anchored at `(0,0,0)`, and expose
animation hooks for the central updater. Carts carrying physics/state remain
in `src/`. Prefer instancing and shared pools before per-instance allocation.
Registry entries carry `kind`, `position`, `footprint`, and optional collider,
attractor and chunk ownership; see `src/registry.js` for the current contract.
Comments should explain a non-obvious reason, constraint or workaround.

Before adding a model, read
[the sandbox checklist](.claude/rules/sandbox-and-testing.md). Update the module imports,
sandbox selector and `loadEntity()` case, plus hit-kind/music
mapping when applicable. An uninspectable model is unfinished work.

Keep player copy warm and festival-focused, including “Bring the bubbles,
collect the smiles.” Do not advertise Trip mechanics, the hidden debug menu,
URL overrides or other Easter eggs in the README or title card.

## Changes and commits

Every user-visible gameplay, performance or development-workflow change must
update [CHANGELOG.md](CHANGELOG.md) in the same commit, under the actual date.
Trim shipped work from [ROADMAP.md](ROADMAP.md), retaining unresolved follow-ups.
Documentation-only edits and internal changes without observable effects can
skip the changelog. Read
[the commit rules](.claude/rules/changelog-and-roadmap.md) before committing.
Check the working directory, branch and status before Git mutations; preserve
other people's edits and follow local destructive-command safeguards.

## Optional planning and review workflows

Capability specs under `openspec/specs/` are always available as reference.
The change workflow is intent-gated: do not load `openspec/changes/` on an
unrelated task. Enter it when the user names an `/opsx:*` command, change
artifact, or asks to plan a change; then read
[.claude/rules/openspec.md](.claude/rules/openspec.md). Existing standalone feature
handoffs remain discoverable through the [documentation index](docs/README.md).

Use an explicitly requested council or smart-review workflow through its
installed skill, not by imitating multiple reviewers in one response.
The council's project rules are in [openspec/council/charter.md](openspec/council/charter.md).
A real `/deliberate` uses parallel council specialists followed by a mediator;
`/smart-review` uses review specialists and persists a review summary. The
charter selects scrutiny; a deliberation gate needs a real result or recorded
skip. Refer to the active change for output locations.

Expand shorthand on first use and retain a readable tag afterward. For example,
“Task 2.3 (vendor-row planning)” rather than a bare task number; identify the
containing change or deliberation when needed. Keep the audit trail in
CHANGELOG, ROADMAP, verification and Git; this project has no Jira workflow.
