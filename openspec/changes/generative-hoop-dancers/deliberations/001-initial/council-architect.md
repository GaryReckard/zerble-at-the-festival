## Architect's Position

### Priority Sequence

1. Preserve the current activity boundary and make the workshop instantiate the real HulaActivity/HulaSession/Crowd path. HulaActivity is already registered in the roaming slot and owns props; it must not become a second population or acquire its own render loop (src/people/hulaActivity.js:12-35; src/people/runtime.js:1-5).
2. Specify the sampled-pose contract and publication order, then prove both-hand transform agreement. A passing pure hoop sampler is insufficient if Crowd displays another score time or body transform (src/crowd.js:1608-1628,1730-1737; src/people/hulaActivity.js:49-55).
3. Implement a small pure vocabulary/composer with explicit parameter domains, sample ownership, versioned seeds and bounded phrase state. Then integrate optional flow fields without changing the classic default (src/people/hulaSession.js:11,44-47; design.md:15-25).
4. Prove single-person lifecycle behavior and resource cleanup, then add rolls/tosses and validate the live style mix. The existing session already handles revoked claims, current place identity and accepted deltas, so the new score must obey those boundaries rather than replace them (src/people/hulaSession.js:19-59).
5. Add multi-hoop and partner coordination as explicit later change groups with their own ownership/state-machine tests, borrowing the already demonstrated pair-claim pattern rather than building a second generic activity framework (src/people/frisbeeSession.js:9-36,52-62).

### Structural Risks Identified

- **A shared cache alone does not guarantee a shared published frame.** HulaSession increments elapsed and immediately calls writeActivityPose; that call synchronously republishes Crowd matrices, which invoke sampleBodyPose. HulaActivity samples the prop only afterward (src/people/hulaSession.js:44-46; src/crowd.js:2331-2341,1608-1610; src/people/hulaActivity.js:49-55). Define the precise transaction: advance score and resolve boundary events, populate the complete session-owned sample for the new accepted time, then call writeActivityPose, then render props from that same sample version. Sampling before this publication transaction completes could show the body one sample behind the ring. Test publication and prop version equality through the actual production calls, including a boundary and interrupted/reacquired frame.

- **Scratch ownership and optional fields require a complete overwrite contract.** Crowd supplies one reused _activityBodyPose object to whichever activity owns the current person (src/crowd.js:1608-1609). Extending this object with optional flow arms can leak a previous performer's data into a classic performer unless the provider explicitly resets those fields or returns an explicit style discriminator. Keep immutable descriptors and session-owned cached numeric state distinct from caller-owned scratch. Specify that no renderer retains the shared scratch object, all per-sample optional counts/fields are reset, and both hands' output is finite. An alternating flow/classic/flow test is essential, not merely a single-performer test.

- **The final rendered body matrix is part of the contact contract.** Body bob/lean are applied inside Crowd and the matrix is composed before the hula rotation; the hoop currently follows only position, heading and scale (src/crowd.js:1628,1715-1737; src/people/hulaActivity.js:52-55). The proposal correctly recognizes the issue, but implementation needs one public pure transform helper or a claim-validated copied presentation transform. Do not read Crowd's mutable _mat4 or NPC records from the activity. Use the same transform contract for CPU contacts, displayed arms and hoop root, including frown/pose precedence rather than a parallel approximation (src/crowd.js:1629-1634). Preserve existing depth/shadow articulation when common arm code changes (src/crowd.js:448-475).

- **A performance envelope is a new resource contract, not an existing registry reservation.** Current place.reserve reserves one activity slot and validates the attractor's identity; it does not reserve surrounding spatial volume, and canMove checks only a .45 building radius (src/people/hulaActivity.js:25-31). Specify an activity-owned bounded envelope/corridor reservation store, owner token and release policy, with read-only queries to world/people. Avoid adding hard hoop colliders or treating registry mutations as transactional. Participant colliders remain Crowd-owned, as the plan already proposes (src/people/hulaActivity.js:12; src/registry.js:45-54). Clarify that ordinary bystanders are not physically excluded by the reservation; revalidation can change or terminate a phrase but cannot guarantee an empty crowd corridor forever.

- **Partner coordination cannot graft a second claim onto an active solo session.** Each current HulaSession stores exactly one claim/person/reservation and its release callback assumes that ownership (src/people/hulaSession.js:8,20-24,61-75). A partner coordinator must own both claims as one distinct session state, or explicitly end solo sessions before acquiring the pair. The existing FrisbeeSession demonstrates paired acquisition, rollback on failed start and reentrancy guards while releasing a second claim (src/people/frisbeeSession.js:9-36,52-60). Reuse that pattern, keep HulaActivity as resource owner and account for both participants against the existing cap rather than adding an uncounted partner population. This does not require extracting a generic pair-session base class.

- **Visual continuity and exact classic sampling are compatible, but identical participation is not promised.** Adding swept clearance may reject a flow slot that would have admitted classic waist hooping. The plan's intention to preserve participant-selection draws is sound, but should be scoped to preserving RNG/worldgen contracts and classic formulas, not asserting the same future population participation after flow admission changes (src/people/hulaActivity.js:60-70; design.md:41-43,70). Record an explicit stable seed derivation from the activity's injected root seed, slot identity and session generation; do not use incidental registry insertion IDs or mutable Crowd indices as a reproducibility guarantee.

### Architecture and Toolchain Assessment

The proposed pure src/people/hoop modules and activity-owned state are structurally appropriate. This is primarily activity behavior, not a new character model. Keeping geometry builders in src/models/hulaHooper.js, participants in Crowd and resources in HulaActivity preserves the current architecture (src/people/hulaActivity.js:5,12-24; ARCHITECTURE.md:384-395,850-865).

Current AGENTS.md and .claude/rules/no-build.md supersede historical council/config no-build and HTML inventory instructions. Use normal imports, npm run check and npm run build, and register new sandbox selector/case/mappings where applicable. No importmap restoration or parallel build system is appropriate (.claude/rules/no-build.md:1-25; AGENTS.md:103-109).

No change to world/chunk/lake ownership is needed for a Crowd activity. Venue invalidation continues to compare the current registry object, and the activity removes its own props when that resource disappears (src/people/hulaActivity.js:26-29; src/people/hulaSession.js:33). Shared resource ownership must be deliberate: existing activity resources are exclusively disposed by their activity; introducing module-shared pools changes that contract and requires an explicit pool lifetime rather than indiscriminately adding shared tags (src/people/hulaActivity.js:16-21,75-79).

### Required Plan Refinements

- Make same-version publication, caller-scratch reset and optional flow-field validation explicit acceptance cases in the specification and workshop tasks.
- Define the presentation-transform boundary and preserve normal/depth articulation parity without exposing Crowd internals.
- Define envelope ownership, capacity accounting and dynamic-obstruction semantics before partner work.
- Specify pair-session authority and rollback/reentrancy behavior using the existing pair pattern as reference.
- State the seed derivation inputs and distinguish deterministic choreography replay from identical world participation.

### Verdict

- **Verdict**: Proceed with mitigations.
- **Key Concern**: The body and hoop must consume the same complete score sample through the existing synchronous publication path, with exact transform agreement and no shared-scratch leakage.
- **Recommendation**: Incorporate the refinements above before runtime work, then begin with the production-path workshop and single-hoop contact proof. The current module/ownership direction is sound and does not justify replacing the activity architecture.
