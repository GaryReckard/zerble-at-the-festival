# External physics research: findings and disposition

Reviewed 2026-10-29. This is a planning amendment, not a new council verdict or an implementation result. Coding remains deferred until the hula-hoop work is finished and a clean physics branch is ready.

## TL;DR

Keep the existing architecture: evaluate Rapier first, bound physical activity, retain instanced rendering, use authored person reactions, and reset safely at distance. The reports provide useful experiment ideas, but they do not establish an engine performance winner or justify replacing our character, navigation, or rendering systems. Their strongest contribution is a sharper verification plan. Several recommendations would violate our existing ownership and resource contracts.

## Inputs and confidence

The [source archive](research/README.md) preserves all four reports with hashes. The following names identify reports, not independent experimental results:

| Report | Useful contribution | Limitation |
| --- | --- | --- |
| [Gemini engine report](research/sources/gemini-engine.md) | Broad engine comparison; calls attention to activation/upload spikes and dense contacts | Its worker, upload, packaging and automatic joint-break claims need correction; its capacity eviction policy conflicts with protected support |
| [Gemini interaction report](research/sources/gemini-interactions.md) | Attachment hierarchy, culling bounds, scenario-based lifecycle discussion | Invents a Recast dependency, permits duplicate carried cups, assumes skeletal NPCs, and treats allocation as inevitably leaking |
| [ChatGPT interaction report](research/sources/chatgpt-interactions.md) | Clear graduated reactions and useful end-to-end scenarios | Contains no source URLs; assumes skeleton/IK infrastructure; its short implementation sequence leaves ownership details unresolved |
| [ChatGPT engine report](research/sources/chatgpt-engine.md) | Separates several measurements and recognizes worker trade-offs | Contains no source URLs; makes incorrect or unsupported engine/browser claims and uses inconsistent numeric acceptance targets |

Agreement is useful direction, not four independent confirmations: all reports received the same suggested architecture. None supplies an executed Zerble benchmark, raw timing log, tested device record, or pinned dependency integration. Retain the proposed experiments; discard their numeric performance claims as project evidence.

## Correct the research premise first

The supplied brief incorrectly described the repository as no-build/import-map based. That was our prompt error, not a research discovery. The current [package.json](../../../package.json) pins Three.js 0.160.0 and uses Vite for development/build/preview (lines 4, 8–10, 33 at review). The [shared instructions](../../../AGENTS.md) explicitly state that imports discover modules and there are no HTML module inventories. Investigate the candidate's actual Vite deployment and base-path behavior; do not select its distribution solely to satisfy the obsolete premise.

Likewise, ordinary crowd movement uses steering and registry footprints, and its body parts use instance transforms. See [crowd.js](../../../src/crowd.js), especially the movement description at line 25, avoidance at line 1484, and instance publication at lines 950–965; [registry.js](../../../src/registry.js) describes its avoidance/collision role at lines 1–3. A source search for `recast|AnimationMixer` over `src` and `package.json` returned no matches at review. Recast TileCache and imported skeletal clips are therefore proposals to add systems, not descriptions of existing dependencies. Preserve procedural posing and the people activity contracts.

These references describe the shared checkout at review, not a frozen release. Task 1.1 (Baseline and compatibility) must recheck the completed hoop baseline before implementation.

## Consequential claims checked against primary sources

### Packaging and engine choice

Rapier's compatibility package embeds WASM but still initializes asynchronously. Jolt also supplies an embedded-WASM compatibility distribution and a single-thread WASM distribution, so Rapier is not uniquely compatible with browser modules, and lack of threading does not require Jolt's asm.js build. Rapier remains our first experiment because that is the existing bounded scope; Jolt remains a credible comparison if the first candidate fails an actual requirement. Neither report demonstrates Jolt or Rapier superiority for our workload. Sources: [Rapier initialization](https://rapier.rs/docs/user_guides/javascript/getting_started_js/) and [Jolt distributions and ownership](https://github.com/jrouwe/JoltPhysics.js).

Do not introduce automatic engine switching by device as a cheap fallback. That would require verifying two contact/lifecycle implementations and tuning two sets of behavior. Prefer measured capacity/quality adjustments within one accepted engine; revisit the dependency if it fails the minimum useful scene. This is an architectural recommendation, not a benchmark result.

### Worker communication

The Gemini engine report's premise that non-shared worker transport necessarily copies every transform is incorrect: transferring an `ArrayBuffer` transfers ownership without copying its contents. Scheduling, buffer ownership and delayed results still need measurement. Shared memory requires a secure, cross-origin-isolated context; blanket statements that iOS cannot use it are not an adequate deployment analysis. Sources: [transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects) and [shared-memory requirements](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer).

Start on the main thread to keep the already-defined contact/publication order simple. Only investigate a worker if attributed measurements justify it. Any comparison must include command-to-visible-result latency, stale-result handling, pending releases, pause/teleport and teardown, not just solver time. This is a proposed decision rule, not a claim that workers are slower.

### Instancing and moving visuals

Moving bodies do not inherently require one standalone draw object per body. Our design already separates simulation from render slots. Compare updates in existing buckets with a bounded active batch pool; include all parts, material/color attributes, slot-to-object mappings and origin-unload adoption.

The claim that `needsUpdate` always uploads the entire matrix buffer is too broad. Three.js supports update ranges, and the project's pinned r160 renderer explicitly handles partial ranges. A swap on the CPU is not proof that total frame cost is constant: uploads, bounds and draw calls remain separate costs. Sources: [BufferAttribute](https://threejs.org/docs/pages/BufferAttribute.html) and [r160 WebGLAttributes implementation](https://raw.githubusercontent.com/mrdoob/three.js/r160/src/renderers/webgl/WebGLAttributes.js). Current chair batching lives in [campsite.js](../../../src/models/campsite.js), `batchCampChairs` at line 1054 at review.

Retain conservative bounds for airborne/adopted objects. Do not dispose shared geometry/materials when releasing a prop; the local [pooling contract](../../../.claude/rules/perf-pooling.md) explicitly forbids that teardown pattern. The reports' generic disposal advice needs this ownership qualification.

### Sleeping, memory and resource retirement

Sleep, render batching, physics residency and safe world reset are different transitions. A sleeping chair may still support another object or be hit again. Removing its body removes attached colliders/joints and wakes affected bodies; a visual instance alone cannot replace that collision support. Rapier exposes per-body removal separately from `world.free()`, which tears down the entire world. Source: [World API](https://rapier.rs/javascript3d/classes/World.html).

Reject the inference that a WASM memory high-water mark alone proves an ongoing leak. The experiment must distinguish retained capacity from growing live allocations, while checking repeated identical cycles and eventual world teardown. Neither report proves that creating/removing bodies necessarily grows memory indefinitely. Likewise, preallocating 500 bodies and parking them below the map is not an established solution: coordinate relocation alone does not define disabled simulation, events or safe reuse. Choose bounded creation/removal or reusable bodies from measured evidence, including complete state reset and stale-handle protection.

Keep the existing admission/reserved-release policy. Do not force-demote a visible moving support just because a new collision arrives. The [design's residency and admission contract](design.md#2-bounded-local-simulation-with-a-fixed-time-step) protects active support and reserves mandatory occupant/cup release capacity before admitting an assembly.

### Contact signals, kinematics and breakage

Collision start/end events are not force measurements. Rapier distinguishes collision events, contact-force events and contact manifolds. A sensor overlap alone is not a measured impact impulse. Use the actual signal required by each response, declare its units, and test resting contact, glancing contact and a real impact separately. Source: [advanced collision detection](https://rapier.rs/docs/user_guides/javascript/advanced_collision_detection/).

Kinematic bodies follow their commanded motion and ignore contact forces. Enabling more collision pairs does not turn the cart into a dynamically blocked body. Preserve one authority for its accepted trajectory and feedback; do not automatically install a new character controller because a report recommends one. Source: [Rapier body types](https://rapier.rs/docs/user_guides/javascript/rigid_body_type/).

The claimed automatic destruction of fixed joints at a configured break force is not established by the JavaScript API inspected here. Treat a sign/latch release as an explicit application transition unless the chosen pinned package demonstrates the needed API. Constraint violation from an unconverged solver is not a reliable authored break event. Sources: [ImpulseJoint API](https://rapier.rs/javascript3d/classes/ImpulseJoint.html) and [joint constraint semantics](https://rapier.rs/docs/user_guides/javascript/joint_constraints/).

### Version-sensitive engine features

Do not repeat the reports' blanket dismissal of cannon-es as having only brute-force broadphase or no triangle-mesh shape. Its source contains [SAPBroadphase](https://github.com/pmndrs/cannon-es/blob/master/src/collision/SAPBroadphase.ts) and [Trimesh](https://github.com/pmndrs/cannon-es/blob/master/src/shapes/Trimesh.ts). Their existence is not proof of support for every shape pair, CCD, or acceptable performance.

Conversely, do not dismiss Rapier soft bodies merely from older knowledge: the JavaScript guide retrieved during review labels itself 0.21 and documents them. This does not prove availability in the Gemini snippet's pinned 0.19.3 package, or justify adding them to Zerble. [Soft-body guide](https://rapier.rs/docs/user_guides/javascript/soft_bodies/). Engine capabilities must be checked against the selected package, not a mixture of current documentation, old CDN packages and Rust APIs.

Rapier's deterministic simulation claim has conditions: the same version, initial values, step count and construction/removal ordering. It does not make browser input timing or our procedural generation automatically deterministic. Preserve the existing independent generation stream and compare gameplay invariants unless exact replay conditions are controlled. [Determinism requirements](https://rapier.rs/docs/user_guides/javascript/determinism/).

## Interaction decisions retained

The [approved distance-reset amendment](deliberations/002-distance-reset.md) and [design](design.md) remain authoritative over contradictory report suggestions:

- Keep one logical object while it is carried or followed; suppress its original spawn until safe retirement. The Gemini interaction report explicitly permits duplication, which contradicts our identity contract.
- Preserve a chair's support until the seated person's claim and pose have transferred coherently. Do not reclaim the entire local pool merely because its origin chunk unloads.
- Let light impacts produce bracing, and stronger impacts produce a controlled exit or fall according to support and available recovery space. Preserve person activity authority instead of introducing a `sitting` flag beside it.
- Keep cups attached cheaply until release, then inherit the support-point velocity, including rotation. A constant upward kick is not the default source of variety.
- Compare a posed cooler lid with a physical hinge after the closed cooler works. Treat latch release explicitly. Signs may flatten through controlled posing or fall physically; neither soft bodies nor automatic repair are prerequisites.
- Preserve nearby aftermath and apply distant reset only after safe dependency teardown. There is no persistent displacement database, and no need to accept duplicate live props to avoid one.

These are existing design commitments reinforced by review, not newly measured findings.

## Experiments to run after the clean-branch gate

Each row strengthens existing tasks rather than adding a separate implementation project. All remain unrun. Numeric frame/capacity limits must be declared from a measured baseline before judging a candidate; the reports' 5/8/10 ms thresholds and 100/500/1,000-body scenes are not accepted budgets.

| Experiment | Evidence and pass/fail rule | Existing task |
| --- | --- | --- |
| Package and API proof | Pin a distribution; record transfer/init cost, deployed base-path behavior and exact event/joint methods. Pass only with working development/production boot, coherent init failure and preserved synchronous audio unlock | Task 2.1 (Engine loading proof) |
| Actual multi-part chair transitions | Test translated/rotated parents, each style/color, repeated slot swaps, airborne bounds and origin unload. Pass with continuous world pose, one visible representation, correct identity/attributes and measured full-frame costs | Task 3.2 (Chair instance bindings), Task 3.4 (Moving render adoption) |
| Contact classification | Separate sensor overlap, sustained rest, gentle brush, off-center impact and fast impact at several render rates. Pass with the intended signal, declared units, one response owner and no repeated drop/penalty from resting contact | Task 4.2 (Single response owner) |
| Capacity and support | Saturate optional capacity, then release both loveseat sitters and attached cups. Pass only with reserved release resources, no lost support, finite motion and no duplicate claim/representation | Task 2.4 (Admission and residency), Task 5.4 (Fall handoff) |
| Repeated resource cycles | Repeat identical activation/adoption/sleep/removal/reset cycles after warmup; track logical counts, JS allocations, engine memory where inspectable and GPU resources separately. Pass with counts returning to declared baselines and a stable bounded high-water envelope; unavailable memory telemetry is a stated gap | Task 3.7 (Lifecycle stress gate) |
| Small encounter on real devices | Compare physics-disabled and enabled copies of the same occupied-chair campsite at matched quality, then normal adaptive quality. Record step/upload/event/total-frame p50/p95/p99 and spikes. Pass against predeclared device budgets with convincing visible motion | Task 2.6 (Early device gate), Task 6.4 (Production acceptance) |
| Full return journey | Chair hits cooler, cup releases, person recovers, origin unloads, player follows cup and returns. Pass with one cup, coherent recovery, deterministic original scenery and correct nearby/distant reset distinction | Task 3.6 (Distance reset and frontier), Task 8.6 (Cup acceptance) |

The Gemini engine snippet is an illustration, not a usable acceptance harness: it raises a promoted cube five units, grows dynamic arrays without an admission/retirement path, omits origin ownership and lacks an integrated NPC/contact test. Do not run or paste it as proof of seamless promotion. Build the already-planned production-backed fixture after coding is authorized.

## What changed in the plan

The engine order, 66-task scope, model delegation and clean-branch deferral remain unchanged. Task descriptions and verification now explicitly require package-version/API evidence, correct contact signals, partial-upload comparisons and separation of memory high-water marks from live ownership counts. No Recast migration, skeletal animation migration, worker subsystem, alternate per-device engine, automatic breakage dependency or arbitrary body budget has been accepted.

The next useful evidence is the small production-backed encounter and its failure tests. Further broad engine surveys would be less valuable than resolving those measured questions once implementation starts.
