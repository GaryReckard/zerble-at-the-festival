## Auditor's Position

### Priority Sequence

1. Fix verification coverage for the proposed module topology before creating `src/people/`. The existing import checker cannot discover that directory (`bin/check-importmaps:24-29`), although the design introduces it (`design.md:58-60`).
2. Capture execution order, collision order, lifetime transitions, and production-backed fixtures before extraction. Current crowd updates nest camp jobs and parties before individual people (`src/crowd.js:910-917`), while collision assembly deliberately preserves first-hit ordering (`src/main.js:1514-1539`).
3. Land registration and identity with per-slice behavioral acceptance, then focused controllers, activity/render boundaries, and final orchestration consolidation. This matches the staged migration in `design.md:104-124` without requiring a universal person storage model.
4. Make new contract suites part of the routine check command and apply changelog discipline on each observable slice, rather than relying on the final documentation task.

### Quality Deficiencies Found

- **Nested module discovery is missing from the verification foundation**: `design.md:58-60` proposes `src/people/runtime.js` and `personHandle.js`, but `bin/check-importmaps:24-29` lists only direct `src/*.js`, `src/worldgen/*.js`, and `src/models/*.js`; `bin/check-importmaps:61-69` also only validates stale paths for `worldgen/`. Therefore the current checker can pass while an entire new people subtree lacks cache-busted mappings. **Severity: High.** Add recursive discovery or explicit people-directory support and a regression test that deliberately omits a nested module from each required page. Preserve the authoritative five-page rule in `.claude/rules/no-build.md:17-36`; older charter/protocol counts are stale. Define page coverage deliberately because the current map-sandbox role requires only worldgen and RNG (`bin/check-importmaps:31-37`, `bin/check-importmaps:61`).

- **Controller replacement is absent from the safe-handle acceptance**: `design.md:87-98` defines `{ controllerKey, slot, generation }` and increments generation on slot reuse, while `tasks.md:22-25` tests duplicate keys, pooled reuse, and disposal. It does not define what happens when an entire controller is disposed and a replacement registers under the same key with reset slot generations. This is a prospective identity collision, not an observed bug. **Severity: Medium.** Either forbid key reuse for the runtime lifetime or include a controller incarnation token; test that an old handle and activity release cannot resolve into a replacement controller. Keep this as one explicit identity rule rather than inventing a broad identity service.

- **The checklist can defer release documentation until the end**: `tasks.md:7-11` specifies per-slice checks but omits per-slice CHANGELOG/ROADMAP discipline; those updates appear in the final acceptance section under Task 7.5 (acceptance documentation). The mixed workshop and common inspection are observable developer workflow changes (`tasks.md:17`, `tasks.md:26`). **Severity: Medium.** Add an explicit same-commit rule to the per-slice preamble, with internal-only exceptions, because `.claude/rules/changelog-and-roadmap.md:8-11` prohibits batching entries across commits.

- **The new verification contract lacks an explicit routine-suite integration task**: Tasks 1.2 (baseline characterization) and 7.1 (controller contract acceptance) require executable tests, but do not state that the mandatory people suites join `npm run check` (`tasks.md:16`, acceptance section). That command currently enumerates individual executables in `package.json`, so merely adding new files will not include them. **Severity: Medium.** Require the foundation to wire the contract suites into the normal command, while keeping bounded browser integration separately invoked. Preserve focused existing tests rather than replacing them with a second simulated behavior implementation.

### Mechanical Assertions

These statuses assess whether the written plan establishes a sufficient contract; they are not runtime implementation results. No source or browser checks were needed for this markdown audit.

| Check | Status | Notes |
| --- | --- | --- |
| Importmap in BOTH html files | FAIL | Both named pages and the current five-page rule are mentioned, but the proposed nested source root is invisible to the checker (`bin/check-importmaps:24-29`). Add the prerequisite above. |
| Sandbox entry complete | PASS | No new production visual model is proposed (`design.md`, Non-goals). Production mixed fixtures precede extraction (`tasks.md:17`); retain selector, loadEntity, animation, and hit/music mappings when moving existing imports under Task 3.6 (obstacle consumer migration). A genuinely new model must follow `.claude/rules/sandbox-and-testing.md`, Required when you add a new model. |
| userData.shared tagging | PASS | Task 2.4 (idempotent cleanup) explicitly verifies shared-resource survival (`tasks.md:25`), and the proposed cleanup spec forbids shared disposal. Preserve both valid ownership patterns from `.claude/rules/perf-pooling.md`, including instance-owned private resources. Existing one-wheel teardown checks shared flags separately from InstancedMesh disposal (`src/oneWheels.js:111-123`). |
| castShadow discipline | PASS | Task 4.1 (crowd render facade) retains shadows and batch shape. Keep existing shadow-policy checks and do not treat historical caster counts as new measurements; `.claude/rules/perf-pooling.md`, Don't reflexively castShadow. |
| InstancedMesh needsUpdate | PASS | Task 4.1 explicitly preserves dirty uploads; existing uploads include body, hair, camera, flash, and drink pools (`src/crowd.js:953-968`). Acceptance must retain accessory pools as well as the primary body mesh. |
| Determinism (fresh salt) | PASS | The per-slice preamble preserves draw order (`tasks.md:10-11`), and the critical evaluation explicitly preserves legacy unseeded streams rather than silently reseeding children (`src/obstacles.js:403-427`). New randomness still follows `openspec/specs/determinism/spec.md`, Salt discipline preserves existing worlds. |
| CHANGELOG/ROADMAP in commit | FAIL | The proposal acknowledges observable implementation entries, but executable task ordering permits final batching. Add the same-commit preamble and retain documentation-only exceptions. |

### Scope Completeness and Convention Assessment

The scope is appropriately broader than freeze and covers all six obstacle families, vehicle adapters, monks, activity handoffs, and place-owned performers (`tasks.md`, sections 3 through 6). Keeping registry spatial ownership separate from person lifetime agrees with the registry's fixed membership/live-position model (`src/registry.js:25-30`) and Crowd's explicitly distance-based lifetime (`src/crowd.js:912-915`). Collision acceptance must retain the existing hidden/activity/rider exclusions as well as source order (`src/main.js:1523-1538`).

The preferred thin runtime and adapter approach is mechanically credible because it preserves current storage, instancing, and distinct group behavior instead of forcing every inhabitant into Crowd. The public contract should remain the documented one-page integration protocol (`design.md:79-83`); use comments for ownership constraints and non-obvious ordering, rather than narrating registrations. No extra generic event bus, resource transaction engine, or behavior tree is justified by this migration's stated requirements (`critical-evaluation.md`, Decisions before council).

### Verdict

- **Verdict**: Proceed with mitigations
- **Key Concern**: The proposed nested module structure defeats the current importmap verification guard, so passing the documented checks would not establish wiring completeness.
- **Recommendation**: Keep the preferred architecture and its staged migration, add nested-module checker coverage before extraction, close controller-replacement identity semantics, and make test-command integration and same-commit documentation explicit prerequisites.
