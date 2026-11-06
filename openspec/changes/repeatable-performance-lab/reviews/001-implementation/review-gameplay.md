## Scope

- Reviewed: the custom `repeatable-performance-lab` implementation in `src/main.js` (lab hooks and child construction only), `src/input.js`, `src/people/children.js`, `src/performanceLab/config.js`, `src/physics/liveWorld.js` (lab clock only), `src/analytics.js`, `src/leaderboard.js`, `tooling/performance_lab/supervisor.py`, `tooling/performance_lab/worker.mjs`, `tooling/performance_lab/capability.py`, `tooling/performance_lab/snapshot.py`, `bin/perf-lab`, and the assigned input/capability/cleanup/runner/supervisor/transport/integrity/children-ownership tests.
- Notes: no browser was launched, no source was edited, and no Git mutation or expensive test was run. The real acceptance evidence was inspected as context. Unrelated pre-existing driving/wake/scene-probe changes were excluded. Statistical validity and hot-loop measurement remain the performance reviewer's responsibility.
- Ordinary child construction retains the original random-call order through its default dependency, while the diagnostic stream uses a distinct salt and leaves live behavior random. The new hook does not insert an asynchronous hop into the title gesture's audio initialization.

## Findings

- [P1][high] `bin/perf-lab:37` — Bind the declared harness identity to the host code actually executed.
  - Why: the run copies `manifest['harness']` from the selected snapshot, but `tooling/performance_lab/supervisor.py:140` executes `worker.mjs` beside the **live checkout's** supervisor, and the Python controller/supervisor are also imported from the live checkout. `tooling/performance_lab/snapshot.py:32-37` verifies only the copied snapshot and its build, never those executing host files. Editing the host worker/controller after creating a snapshot, then renewing the backend probes where necessary, therefore allows the old snapshot to run with its old harness label under different actual host instrumentation. A saved calibration and later run can appear compatible despite the changed collector. The recorded 48-run trial froze its source, so this is a future-run enforcement gap rather than evidence that its measurements are invalid.
  - Fix: before each launch and at completion, verify the actual running CLI/tooling source inventory against the selected snapshot's host-file hashes, refusing drift, or execute the host side from that immutable snapshot. Add a regression proving a live host-file change cannot produce a run labelled with an unchanged snapshot harness identity.
  - Duplicate-of: none.

- [P2][high] `src/input.js:32` — Suppress repeat events from keys first pressed during diagnostic ownership.
  - Why: diagnostic keydowns are discarded without tracking their held status. On release, `clear()` only adds keys from the ordinary `held` set to `untilRelease`, which is empty for keys first pressed during the run. A still-held key's next auto-repeat is then accepted as normal input. A small Node reproduction using the existing event-mock setup produced `Input.throttle === 0` immediately after release and `Input.throttle === 1` on a subsequent `keydown('w', repeat:true)`, without a keyup or new press. This can unexpectedly move the cart or trigger an edge action after emergency abort, contrary to the physical-control restoration scenario in the delta spec. The existing test covers keys held before acquisition, but not this case.
  - Fix: track normalized keys pressed while diagnostics own input in the release-suppression set, and clear that suppression on keyup even while diagnostics are active. Add a case where W is first pressed during capture, ownership ends while it remains held, repeats stay suppressed, and a fresh keyup/keydown restores ordinary driving.
  - Duplicate-of: none.

## Post-fix re-review

Both findings above are **resolved** in the focused correction scope.

- Host provenance: `tooling/performance_lab/snapshot.py:32-49` now checks the manifest's host CLI/tooling files against the actual live host root and rejects missing inventory or differing bytes. The existing pre/post boundaries in `bin/perf-lab:36,65` and `tooling/performance_lab/experiment.py:10,20,22` therefore enforce this before and after launches. The integrity regression changes an independent live host while leaving its snapshot intact, and the CLI regression proves accepted backend receipts cannot bypass refusal before acquiring a lease or launching a browser. The parent's separate `checks/post-trial-source-reconciliation.json` establishes that all 301 inventoried files, including the ten host files, actually matched the accepted trial before this hardening was applied.
- Input restoration: `src/input.js:32,48-52` now adds diagnostic keydowns to release suppression and consumes keyups during ownership. `bin/test-performance-lab-input:17-23` covers the reproduced first-pressed-during-capture W repeat, verifies that neither throttle nor a W edge leaks, and verifies that keyup followed by a genuine press restores input.

Independently reran `python3 bin/test-performance-lab-integrity`, `python3 bin/test-performance-lab-runner` and `node bin/test-performance-lab-input`; all passed, without opening a browser. No source edits were made by this reviewer. The parent owns the subsequent new-source smoke matrix and overall verification bookkeeping.

**Remaining findings in the correction scope: No actionable issues.**
