# Bubble Upgrades handoff

- Starting commit: `b215b8d08cbfb1928806ac36607e3b000f5ab2ec` (`main`)
- Current phase and model: Phase 2, GPT-6 Sol, high.
- Last completed task: Checkpoint 2.5, special-bubble assertions and `npm run check` wiring. Checkpoint 2.1 through 2.5 are checked in the plan.
- Next task: Checkpoint 2.6, Gary's Gate A visual decision. Renderer iterations and captures are in [the review packet](checkpoint-2/GATE-A.md), but this task stays unchecked until Gary approves the Heart look. Do not start Checkpoint 3 before that approval.
- Open problems: baseline task 0.3 remains unchecked because the four sandbox views were inspected but not saved from the starting tree, and the empty-tank main-game HUD draw/triangle sample is missing. [Baseline notes](baseline/observations.md) explain the gap. The Noon Heart is subtler against grass than at Midnight, so Gary should decide whether that is the right look.
- Files touched for Bubble Upgrades: `BUBBLE-UPGRADES-PLAN.md`, `CHANGELOG.md`, `index.html`, `sandbox.html`, `hub-sandbox.html`, `package.json`, `src/bubbleTypes.js`, `src/bubbleProgress.js`, `src/bubbleChallenges.js`, `src/bubbles.js`, `src/specialBubbles.js`, `bin/node-three-shim.mjs`, `bin/test-bubble-types`, `bin/test-bubble-progress`, `bin/test-bubble-challenges`, `bin/test-special-bubbles`, and `verification/bubble-upgrades/` evidence. The separate kids personal-space sidequest touched `src/obstacles.js`, `bin/test-kid-motion`, and `bin/test-kid-bubble-query`; preserve those edits.
- Latest `npm run check`: exit code 0 on 2026-10-15, with [full output](checkpoint-2/npm-run-check.txt). `git diff --check` also passed. The main game title screen loaded on Low with no page console errors; the special sandbox loaded on Low and High with no page console errors.
- Pending action for Gary: review the [Gate A packet](checkpoint-2/GATE-A.md), then reply `approved` or describe Heart look changes. The incomplete baseline evidence can be addressed separately without treating the present screenshots as a pre-change baseline.

The working tree was clean when this handoff began. This checkpoint was committed
locally, with no push or deployment. A user-owned local development server at `127.0.0.1:8765` was already
running and was left running. The four feature tripwires identified in the
preflight are importmap coverage, the frozen Three.js module namespace and shim
override path, synchronous iOS audio initialization, and the per-tier
draw/triangle budget.
