# Model delegation and implementation handoffs

## Status and recommendation

Gary approved the allocation direction and explicitly confirmed **planning only**. Finish the hula-hoop work first; start physics later on a clean branch after verifying the intended baseline. No implementation agent, model setting, new branch or coding task is launched by this document.

Use **GPT-6.1 Sol** as the default implementation worker, **GPT-6 Luna** for narrowly specified support, and **Astra** for cross-system contracts, uncertain decisions and production integration. The assignments below are engineering judgments about this plan, not measured comparisons of these models on Zerble.

Official guidance recommends Sol for demanding multi-step agents and Luna for focused lighter work; it also notes that subagents inherit the parent model unless explicitly configured. Specify the model on every future delegated assignment rather than accidentally spawning Astra workers. Sources checked 2026-10-29: [OpenAI subagent guidance](https://learn.chatgpt.com/docs/agent-configuration/subagents) and [model selection](https://learn.chatgpt.com/docs/model-selection).

## Practical model settings

| Role | Recommended model and starting effort | Job |
| --- | --- | --- |
| Design, integration and final judgment | Astra (`gpt-6-astra`), high for cross-system reasoning | Own authority boundaries, frame schedule, release/reset rules, ambiguous failures and release decisions |
| Main implementation worker | GPT-6.1 Sol (`gpt-6.1-sol`), medium; high for intricate rendering/tests | Implement bounded modules against settled contracts and return tested artifacts |
| Narrow support worker | GPT-6 Luna (`gpt-6-luna`), high for scoped coding/checks; low for mechanical formatting | Evidence extraction, fixture data, link/status checks and documentation from verified results |
| Optional visual reviewer | GPT-6.1 Terra (`gpt-6.1-terra`), medium | Compare supplied captures for readability, alignment, clipping and visual consistency; use only when it adds value |

These effort choices are proposed starting points, not settings already applied or a guarantee of cost/quality. Compare completed work including repair/review time, and keep the least expensive setting that meets the acceptance criteria. No quota, pricing or device-performance estimate is implied. Gary remains the final judge of feel and player-facing tuning.

## Split by responsibility, not whole groups

| Area | Astra owns | Delegate after the contract is stable |
| --- | --- | --- |
| Playground and dependency proof | Runtime interface, accepted clocks and boot/audio constraints | Sol builds fixture UI, instrumentation, bounded automation, adapter mechanics and ground proxies; Luna can prepare fixture tables |
| Physical runtime and lifecycle | Fixed-step placement, cart coupling, admission/release reserves, canonical clearance, identity and distance reset | Sol implements render-slot bindings, active batching and independent lifecycle tests |
| Contacts and occupied chairs | Contact authority, causal penalties, support load, claim handoffs, fall/recovery and acceptance | Sol implements specified collision recipes, sound, pose helpers and adversarial fixtures |
| Real campsite | Production integration and policy decisions | Sol runs the defined regression/capture protocol and reports exact evidence |
| Cooler | Physical recipe/attachment contract and lid experiment decision | Sol implements independent model metadata, heavy-body recipe, holder sockets, mechanical geometry partition and acceptance tests |
| Cups | Exclusive transfer, forced release, possession/activity conflicts | Sol reuses beverage visuals, places ambient cups and exercises acceptance; Luna can fill explicit socket fixtures |
| Signs | Connectivity evidence, pure intent invariants and target validation | Sol builds model/labels, placement against the accepted descriptor API, falling behavior and route tests |
| Aftermath | Claim protocol and arbitration with existing activities | Sol implements chair-righting, retrieval and personality routines within the agreed API |
| Release | Capacity choices, integration risk, feel decisions and review disposition | Luna assembles verified evidence/docs; Sol owns execution of tests and technical reproduction |

Astra ownership does not mean personally typing every helper. Once an interface and its negative-path invariants are settled, a bounded implementation subtask can move to Sol. Conversely, a short patch in frame ordering or claim release can still require Astra. Do not assign all tests to Luna: designing tests that can expose the shared wrong assumption is high-judgment work.

## Exact task allocation

Every row references the named task in [tasks.md](tasks.md). “Lead” is accountable for the task; delegation of a bounded component does not transfer that accountability. Astra reviews cross-system changes and final gates, while routine local work receives targeted rather than duplicative review.

| Task | Lead | Review / support |
| --- | --- | --- |
| Task 1.1 (Baseline and compatibility) | Astra | Sol may implement isolated helpers or independent tests after the contract is fixed; Astra accepts the result |
| Task 1.2 (Owned harness lifecycle) | Sol | Astra reviews integration boundaries; Sol supplies tests and evidence, with Luna for mechanical support |
| Task 1.3 (Production fixture shell) | Sol | Astra reviews integration boundaries; Sol supplies tests and evidence, with Luna for mechanical support |
| Task 1.4 (Fixture instrumentation) | Sol | Astra reviews integration boundaries; Sol supplies tests and evidence, with Luna for mechanical support |
| Task 1.5 (Baseline scenes) | Sol | Astra reviews integration boundaries; Sol supplies tests and evidence, with Luna for mechanical support |
| Task 2.1 (Engine loading proof) | Sol | Astra reviews integration boundaries; Sol supplies tests and evidence, with Luna for mechanical support |
| Task 2.2 (Fixed-step clock) | Astra | Sol may implement isolated helpers or independent tests after the contract is fixed; Astra accepts the result |
| Task 2.3 (Ground and static surroundings) | Sol | Astra reviews integration boundaries; Sol supplies tests and evidence, with Luna for mechanical support |
| Task 2.4 (Admission and residency) | Astra | Sol may implement isolated helpers or independent tests after the contract is fixed; Astra accepts the result |
| Task 2.5 (Cart proxy and resets) | Astra | Sol may implement isolated helpers or independent tests after the contract is fixed; Astra accepts the result |
| Task 2.6 (Early device gate) | Sol | Astra reviews integration boundaries; Sol supplies tests and evidence, with Luna for mechanical support |
| Task 3.1 (Stable keys and recipes) | Astra | Sol may implement isolated helpers or independent tests after the contract is fixed; Astra accepts the result |
| Task 3.2 (Chair instance bindings) | Sol | Astra reviews integration boundaries; Sol supplies tests and evidence, with Luna for mechanical support |
| Task 3.3 (Registry synchronization) | Astra | Sol may implement isolated helpers or independent tests after the contract is fixed; Astra accepts the result |
| Task 3.4 (Moving render adoption) | Sol | Astra reviews integration boundaries; Sol supplies tests and evidence, with Luna for mechanical support |
| Task 3.5 (World-owner adapters) | Astra | Sol may implement isolated helpers or independent tests after the contract is fixed; Astra accepts the result |
| Task 3.6 (Distance reset and frontier) | Astra | Sol may implement isolated helpers or independent tests after the contract is fixed; Astra accepts the result |
| Task 3.7 (Lifecycle stress gate) | Sol | Astra reviews integration boundaries; Sol supplies tests and evidence, with Luna for mechanical support |
| Task 4.1 (Chair collision recipes) | Sol | Astra reviews integration boundaries; Sol supplies tests and evidence, with Luna for mechanical support |
| Task 4.2 (Single response owner) | Astra | Sol may implement isolated helpers or independent tests after the contract is fixed; Astra accepts the result |
| Task 4.3 (Bounded incident provenance) | Astra | Sol may implement isolated helpers or independent tests after the contract is fixed; Astra accepts the result |
| Task 4.4 (Contact sound) | Sol | Astra reviews integration boundaries; Sol supplies tests and evidence, with Luna for mechanical support |
| Task 4.5 (Empty-chair feel gate) | Astra | Sol may implement isolated helpers or independent tests after the contract is fixed; Astra accepts the result |
| Task 5.1 (Reaction activity boundary) | Astra | Sol may implement isolated helpers or independent tests after the contract is fixed; Astra accepts the result |
| Task 5.2 (Supported load and bracing) | Astra | Sol may implement isolated helpers or independent tests after the contract is fixed; Astra accepts the result |
| Task 5.3 (Controlled dismount) | Astra | Sol may implement isolated helpers or independent tests after the contract is fixed; Astra accepts the result |
| Task 5.4 (Fall handoff) | Astra | Sol may implement isolated helpers or independent tests after the contract is fixed; Astra accepts the result |
| Task 5.5 (Recovery and repeat impact) | Astra | Sol may implement isolated helpers or independent tests after the contract is fixed; Astra accepts the result |
| Task 5.6 (Loveseat and seat validity) | Sol | Astra reviews integration boundaries; Sol supplies tests and evidence, with Luna for mechanical support |
| Task 5.7 (Occupied-chair gate) | Astra | Sol may implement isolated helpers or independent tests after the contract is fixed; Astra accepts the result |
| Task 6.1 (Production campsite slice) | Astra | Sol may implement isolated helpers or independent tests after the contract is fixed; Astra accepts the result |
| Task 6.2 (Streaming and people integration) | Sol | Astra reviews integration boundaries; Sol supplies tests and evidence, with Luna for mechanical support |
| Task 6.3 (Score and social policy gate) | Astra | Sol may implement isolated helpers or independent tests after the contract is fixed; Astra accepts the result |
| Task 6.4 (Production acceptance) | Sol | Astra reviews integration boundaries; Sol supplies tests and evidence, with Luna for mechanical support |
| Task 7.1 (Independent cooler descriptor) | Sol | Astra reviews integration boundaries; Sol supplies tests and evidence, with Luna for mechanical support |
| Task 7.2 (Heavy closed-cooler behavior) | Sol | Astra reviews integration boundaries; Sol supplies tests and evidence, with Luna for mechanical support |
| Task 7.3 (Cup-well metadata) | Sol | Astra reviews integration boundaries; Sol supplies tests and evidence, with Luna for mechanical support |
| Task 7.4 (Mechanical lid partition) | Sol | Astra reviews integration boundaries; Sol supplies tests and evidence, with Luna for mechanical support |
| Task 7.5 (Lid and contents experiment) | Astra | Sol may implement isolated helpers or independent tests after the contract is fixed; Astra accepts the result |
| Task 7.6 (Cooler acceptance) | Sol | Astra reviews integration boundaries; Sol supplies tests and evidence, with Luna for mechanical support |
| Task 8.1 (Beverage visual reuse) | Sol | Astra reviews integration boundaries; Sol supplies tests and evidence, with Luna for mechanical support |
| Task 8.2 (Possession and exclusive transfer) | Astra | Sol may implement isolated helpers or independent tests after the contract is fixed; Astra accepts the result |
| Task 8.3 (Ambient holder population) | Sol | Astra reviews integration boundaries; Sol supplies tests and evidence, with Luna for mechanical support |
| Task 8.4 (Release and free motion) | Astra | Sol may implement isolated helpers or independent tests after the contract is fixed; Astra accepts the result |
| Task 8.5 (Drink posing and activity conflicts) | Astra | Sol may implement isolated helpers or independent tests after the contract is fixed; Astra accepts the result |
| Task 8.6 (Cup acceptance) | Sol | Astra reviews integration boundaries; Sol supplies tests and evidence, with Luna for mechanical support |
| Task 9.1 (Route evidence survey) | Astra | Sol may implement isolated helpers or independent tests after the contract is fixed; Astra accepts the result |
| Task 9.2 (Pure sign intent planner) | Astra | Sol may implement isolated helpers or independent tests after the contract is fixed; Astra accepts the result |
| Task 9.3 (Next-hop and built-target truth) | Astra | Sol may implement isolated helpers or independent tests after the contract is fixed; Astra accepts the result |
| Task 9.4 (Sign model and placement) | Sol | Astra reviews integration boundaries; Sol supplies tests and evidence, with Luna for mechanical support |
| Task 9.5 (Damage recipe and local retention) | Sol | Astra reviews integration boundaries; Sol supplies tests and evidence, with Luna for mechanical support |
| Task 9.6 (Sign integration gate) | Sol | Astra reviews integration boundaries; Sol supplies tests and evidence, with Luna for mechanical support |
| Task 10.1 (Aftermath claims) | Astra | Sol may implement isolated helpers or independent tests after the contract is fixed; Astra accepts the result |
| Task 10.2 (Chair righting) | Sol | Astra reviews integration boundaries; Sol supplies tests and evidence, with Luna for mechanical support |
| Task 10.3 (Drink retrieval) | Sol | Astra reviews integration boundaries; Sol supplies tests and evidence, with Luna for mechanical support |
| Task 10.4 (Personality and local reactions) | Sol | Astra reviews integration boundaries; Sol supplies tests and evidence, with Luna for mechanical support |
| Task 10.5 (Aftermath acceptance) | Sol | Astra reviews integration boundaries; Sol supplies tests and evidence, with Luna for mechanical support |
| Task 11.1 (Camp variants and stage chairs) | Sol | Astra reviews integration boundaries; Sol supplies tests and evidence, with Luna for mechanical support |
| Task 11.2 (Cross-system regression matrix) | Sol | Astra reviews integration boundaries; Sol supplies tests and evidence, with Luna for mechanical support |
| Task 11.3 (Physical character extension decision) | Astra | Sol may implement isolated helpers or independent tests after the contract is fixed; Astra accepts the result |
| Task 11.4 (Optional expression decisions) | Astra | Sol may implement isolated helpers or independent tests after the contract is fixed; Astra accepts the result |
| Task 11.5 (Final capacity and quality gates) | Astra | Sol may implement isolated helpers or independent tests after the contract is fixed; Astra accepts the result |
| Task 12.1 (Release verification record) | Luna | Use verified command/capture evidence; Sol checks technical accuracy and Astra accepts release claims |
| Task 12.2 (Architecture and developer docs) | Luna | Use verified command/capture evidence; Sol checks technical accuracy and Astra accepts release claims |
| Task 12.3 (Shipped-scope hygiene) | Luna | Use verified command/capture evidence; Sol checks technical accuracy and Astra accepts release claims |
| Task 12.4 (Final verification and specialist review) | Astra | Sol may implement isolated helpers or independent tests after the contract is fixed; Astra accepts the result |

## Work packets and file ownership

Do not hand a worker the whole change and ask it to find something useful. Every assignment supplies the exact task names, source baseline, allowed files, frozen interface, acceptance oracle, commands, failure conditions and return format. Give fresh workers a compact packet with relevant source/specs and decisions; include the current distance-reset amendment. Read narrowly before editing, and explicitly tell workers they are not alone and must preserve others' changes.

| Packet | Owned surface | Files outside its ownership |
| --- | --- | --- |
| Fixture UI and counters | New interaction page/controller and fixture-only tests, after Astra defines adapter hooks | `main.js`, registry, live Crowd behavior; Vite/package edits go through the designated integrator |
| Cooler preparation | Cooler geometry/metadata and cooler-specific tests, with a precisely bounded section if it remains in `campsite.js` | Chair batching, other camp placement, person claims and global physics owner |
| Prop rendering | Proposed render-binding module and render-specific tests | Origin ownership, solver scheduling and person storage |
| Cup visuals / placement | Reusable cup model, explicit socket fixtures and accepted placement adapter | Transfer state machine, hand authority and score policy |
| Sign presentation | New sign model, label resources and render tests against a fixed intent descriptor | Route truth and worldgen semantics |
| Scenario tests | Named regression files and fixtures with a supplied invariant/negative control | Production implementation except a separately assigned fix |
| Evidence/docs | Named report and documentation sections based on exact logs and captures | Runtime code, feature acceptance decisions or invented performance results |

When existing files must be shared, serialize edits or assign one integrator. Never have separate workers concurrently rewrite `main.js`, `crowd.js`, `campsite.js`, `sandbox.html`, `package.json` or the registry. Independent research/tests can proceed while those files have one owner.

The return packet includes changed files, contract assumptions, commands actually run, observed results, limitations and any proposed interface change. An interface change is surfaced before workers propagate it into unrelated modules.

## Execution waves when coding is authorized later

1. **Clean baseline first.** Finish the hula-hoop work, record its intended state in Git, then verify the correct clean base and create/use the agreed physics branch. Do not switch branches over dirty work, reset it or silently bundle it into physics. Task 1.1 (Baseline and compatibility) is the entry gate.
2. **Set contracts and build the playground.** Astra fixes frame/lifetime/reset interfaces while one Sol worker builds the fixture shell against those interfaces and Luna prepares source/scenario inventories. Only non-overlapping files proceed in parallel.
3. **Prove the empty chair.** Astra implements the critical loop and ownership paths; Sol owns bounded rendering/recipes and independent negative tests. One worker runs browser verification at a time. Judge the evidence before expanding.
4. **Complete the occupied-chair campsite.** Astra owns support/fall/recovery and production integration, with Sol on the prescribed test matrix and bounded animation helpers. Prepare cooler metadata separately only when it cannot conflict with camp builder edits.
5. **Expand through contracts.** Sol leads cooler and cup presentation, and later sign presentation; Astra owns possession transfer and route truth. Aftermath routines go to Sol once claim arbitration is settled. Pure route research can proceed without editing the main loop.
6. **Finish and verify.** Sol executes defined regressions; Luna assembles evidence/docs; Astra resolves outstanding contracts, reviews the critical diff and accepts the release gate. Gary reviews the recorded feel choices.

Use at most two implementation workers alongside Astra initially; add a temporary independent reviewer only when a real gate warrants it and slots are available. Keep just one browser verification owner and one standalone WebGL session. More workers editing coupled systems would increase coordination cost.

## Escalation and review policy

Escalate to Astra when a task changes ownership, crosses a frozen interface, alters generation/scoring, requires a new scheduler, fails to reproduce, exposes uncertain teardown, or still fails after two distinct fixes. Return evidence and violated assumptions rather than continuing speculative patches. For simpler failed work, narrow the task or move Luna to Sol before automatically using the most expensive model.

Use negative controls and adversarial inputs chosen independently of the implementation. Sol can provide an independent review of Astra-written code; Astra remains accountable for resolving integration findings. Do not substitute agreement between models for actual tests, visual evidence or device measurements.

## Scope remains planning only

All 66 implementation boxes remain unchecked. This document establishes a delegation policy for later use; it does not launch workers, configure the other hula agent, change default models, commit code or create the future clean branch.
