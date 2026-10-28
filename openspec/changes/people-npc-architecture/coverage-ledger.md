# People ownership and integration ledger

This is the implementation baseline for Task 1.1 (coverage and ownership ledger),
inspected on 2026-10-26 before migrating person authority. Entries describe existing
code, not the desired final architecture. Source line references are anchored to
baseline Git revision `9eaf2e5d73419f7c926c11ab06882f007b2bf1e4`; later
characterization hooks shift working-tree line numbers. A missing common cleanup contract is
recorded as migration work rather than assumed to exist.

## Population and display ownership

| Family | Lifetime and removal policy | Movement and rendering authority | Spatial/interaction publication | Evidence |
| --- | --- | --- | --- | --- |
| Ordinary adults | Crowd storage; distance sweep, with party/rider exemptions; explicit remove path also exists | Crowd's per-person state machine writes positions and instance matrices | Main appends nearby crowd wrappers after roaming groups; honk/cheer/hit APIs on Crowd | `src/crowd.js:577`, `src/crowd.js:808`, `src/crowd.js:910`, `src/crowd.js:2721`, `src/main.js:1532` |
| Photographer adults | Same Crowd identity and lifetime, with salted role state | Photographer state advances inside Crowd; camera/flash share pooled render publication | Same adult collision source, with protected reaction eligibility | `src/crowd.js:1035`, `src/crowd.js:953`, `src/photographer.js` |
| Children | Global KidGaggle; distant meshes relocate with their existing state | Gaggle update owns chasing, separation, smiles, grounding, child model animation and collider copies | Persistent `kids.colliders`; direct honk scatter | `src/obstacles.js:389`, `src/obstacles.js:463`, `src/obstacles.js:495`, `src/obstacles.js:780` |
| Wooks | Global Wooks; controller recycles its own meshes | Controller owns movement, approach/special-mode policy, animation and passive-collider state | Persistent colliders; direct parked-honk scatter; passive approach modifies damage | `src/obstacles.js:855`, `src/obstacles.js:898`, `src/obstacles.js:921`, `src/obstacles.js:1044` |
| Puppet parade | Global formation and placed/recycled route | Parade loop and honk offsets; articulated carrier/puppet rigs | Carrier collision array; direct scatter | `src/obstacles.js:108`, `src/obstacles.js:158`, `src/obstacles.js:170`, `src/obstacles.js:188` |
| Brass band | Global formation and route | Band loop, group scatter, member animation | Persistent colliders plus a moving spatial music handle | `src/obstacles.js:231`, `src/obstacles.js:280`, `src/obstacles.js:305`, `src/obstacles.js:332`, `src/obstacles.js:377` |
| Hoopers | Global pool; attractor validity/distance controls recycling | Hooper update, model tick, small drift | Collider array and registered footprint facets tied to the controller | `src/obstacles.js:1127`, `src/obstacles.js:1140`, `src/obstacles.js:1190`, `src/obstacles.js:1302` |
| Frisbee pairs | Global pair controller | Pair/player/disc behavior and model pose | Pair collision array supplied directly to main | `src/obstacles.js:1344`, `src/obstacles.js:1366`, `src/obstacles.js:1403` |
| Monk party | Members remain Crowd people; party decides collective removal and calls Crowd removal | Party supplies destination/boarding policy and avatars; Crowd ticks members and delegates avatar rendering | Same adult identity/collision source; party owns seat coordination | `src/monks.js:39`, `src/monks.js:57`, `src/monks.js:115`, `src/monks.js:168`, `src/crowd.js:1591` |
| One-wheel riders | OneWheels creates/removes riders and owns exclusive-resource teardown | OneWheelMotion plus rider model; controller handles hit pause | One live registry entry per rider, already included in registry collision queries; crowd-only filters in environment | `src/oneWheels.js:64`, `src/oneWheels.js:70`, `src/oneWheels.js:73`, `src/oneWheels.js:90`, `src/oneWheels.js:111` |
| Nut wagon and driver | Vehicle controller owns route, registry IDs and music; driver is spawned through Crowd | Wagon updates seat/body transforms before crowd; riders use owning vehicle's seat interface | Existing registry bodies, seat reservations and spatial music; despawn releases riders | `src/nutWagon.js:62`, `src/nutWagon.js:81`, `src/nutWagon.js:104`, `src/nutWagon.js:127`, `src/nutWagon.js:216` |
| Lurleen | Separate persistent cart/relationship controller | Lurleen owns physics, state and model | Existing cart collision/relationship/audio integration; retain physics owner | `src/lurleen.js:72`, `src/lurleen.js:654`, `src/main.js:1229` |
| Healing Arts participants | Crowd owns interactive identities; tent activity borrows them | Activity moves entering/leaving people; model currently computes dance trajectories subsequently copied into Crowd positions; tent owns articulated display rig | Existing adult collision exclusions for hidden visitors; tent owns music | `src/healingArtsActivity.js:21`, `src/healingArtsActivity.js:124`, `src/models/healingArts.js:193`, `src/models/healingArts.js:267`, `src/chunks.js:68` |
| Stage performers | Place/chunk lifetime | Place-owned model animation from stage performer update | Display entries tagged with chunk key, not duplicate interactive people | `src/chunks.js:61`, `src/chunks.js:114`, `src/chunks.js:596`, `src/chunks.js:3151` |
| Sugar Shack cooks | Shack/chunk owns model and patrol entry | Cook update currently lives in the model module, with local-space waypoint movement | Chunk tags and sweeps cook update entries | `src/models/sugarShack.js:55`, `src/models/sugarShack.js:62`, `src/models/sugarShack.js:1017`, `src/chunks.js:611` |
| Vendor keepers | Vendor tent/chunk owns articulated keeper | Tent update handles keeper pose and open/sleep policy; customer activity is separately Crowd-owned | Vendor registry metadata and chunk-owned update list | `src/models/tent.js:219`, `src/models/tent.js:698`, `src/chunks.js:64`, `src/chunks.js:614`, `src/crowd.js:2251` |
| Birds | Ambient flock ownership, outside the people domain | Birds controller owns flock/perching behavior | Retain existing ambient update; do not create person identities | `src/main.js:544`, `src/main.js:1225`, `src/birds.js` |

The global obstacle classes expose group/update/colliders rather than a uniform
dispose contract (`src/obstacles.js:1`). Do not assume a generic scene traversal
releases their external footprints or the band's music; each needs an ownership-aware
adapter and tests before the broad migration is complete.

## Activities and resource ownership

All activities below retain the original Crowd person. Resource lifetime is not
person lifetime, and a group's removal policy does not make it a second storage owner.

| Activity | Decision/movement owner | Resource owner and release path | Evidence |
| --- | --- | --- | --- |
| Vehicle boarding/riding/disembarking | Crowd dispatch; monk party can coordinate all-or-none boarding | Vehicle owns slots; Crowd releases seats; vehicle despawn clears its riders | `src/crowd.js:1879`, `src/crowd.js:1883`, `src/crowd.js:1945`, `src/crowd.js:1985`, `src/monks.js:57`, `src/nutWagon.js:216` |
| Hammock visit | Crowd claim/walk/ride methods | Registered hammock owns place; Crowd owns reservation and release | `src/crowd.js:1998`, `src/crowd.js:2023`, `src/crowd.js:2062`, `src/crowd.js:2100` |
| Picnic seating | Crowd table claim/walk/seated methods | Registered table owns seats; Crowd clears its claimed seat | `src/crowd.js:2356`, `src/crowd.js:2389`, `src/crowd.js:2423`, `src/crowd.js:2443` |
| Bathroom | Crowd selection and seeking/entering/using/exiting states | Registered potty owns stall; Crowd owns claim/release and surprised response | `src/crowd.js:2465`, `src/crowd.js:2484`, `src/crowd.js:2514`, `src/crowd.js:2584`, `src/crowd.js:2618`, `src/crowd.js:2655` |
| Market browsing/purchase | Crowd market activity | Tent owns vendor metadata/frontage; Crowd clears market claim and bag state | `src/crowd.js:2242`, `src/crowd.js:2251`, `src/models/tent.js:219` |
| Camp seating/sleeping | Crowd camp selection and movement | Camp owns seats/beds; Crowd validates registry identity and releases claims | `src/crowd.js:2127`, `src/crowd.js:2141`, `src/crowd.js:2150` |
| Camp music | CampJamActivity scans sessions inside Crowd, then ticks individual jobs | Job owns instrument/seat claims, render attachment and audio session cleanup | `src/crowd.js:916`, `src/crowd.js:1032`, `src/campJamActivity.js:21`, `src/campJamActivity.js:121`, `src/campJamActivity.js:208`, `src/campJamActivity.js:228` |
| Healing Arts | Tent activity adopts/spawns eligible people and borrows movement/render authority | Place owns participant slots/rig; release restores ordinary rendering; chunk unload invokes activity disposal | `src/healingArtsActivity.js:28`, `src/healingArtsActivity.js:40`, `src/healingArtsActivity.js:81`, `src/healingArtsActivity.js:142`, `src/chunks.js:589` |
| Photography and cheers | Crowd role/overlay eligibility | Crowd owns role state and pooled camera/flash, not a new lifetime | `src/crowd.js:780`, `src/crowd.js:1035`, `src/crowd.js:953` |

Current precedence is observable: festival visits bypass ordinary Crowd logic;
market, camp music, and camp routines precede photography and the rest of ordinary
selection (`src/crowd.js:991-1048`). Preserve this ordering when replacing writes
with explicit claims, rather than introducing a universal priority table.

## Frame and collision barriers

| Existing order | Source and dependency |
| --- | --- |
| Player drive and honk handling, then bubbles | `src/main.js:1020`, `src/main.js:1041`, `src/main.js:1128`; honks currently dispatch immediately |
| Wagon, one-wheels, spatial sync, Crowd | `src/main.js:1193-1196`; Crowd nests distant removal, camp sessions, parties, individuals and render publication (`src/crowd.js:910-988`) |
| Smile aging/collection/coalesced score, then score tick | `src/main.js:1200-1215`; adult emissions can participate in this frame's collection |
| Parade, band, children, wooks, hoopers, frisbees, birds, Lurleen | `src/main.js:1219-1229`; child emission follows the collection barrier |
| Stage/Healing Arts/light/cook updates | `src/main.js:1241-1244`; Healing Arts consumes the prior model sample before near/night-transition sampling (`src/chunks.js:68-74`) |
| World streaming and vendor updates | `src/main.js:1494`, `src/world.js:114-128`; unloading can invalidate borrowed resources after earlier people updates |
| Star update/love, then collisions | `src/main.js:1500-1508`; same-frame star pickup suppresses contacts |
| Audio listener and final render | `src/main.js:1599`, `src/main.js:1627`; late binding writes must reach this submission |

Collision candidates are registry-local first, then parade, band, children, wooks,
hoopers, frisbees, then eligible nearby adults. Riders, boarders, disembarkers,
sleepers, and hidden activity participants are excluded from that adult pass
(`src/main.js:1514-1539`). Resolution returns the first hit and dispatches existing
kind-specific reactions (`src/main.js:1860-1905`); provider migration must preserve
candidate order, filtering, passive state, damage classification, and single publication.

## External references, audio, and removal boundaries

- Lost smiles retain and later read a raw person record (`src/smiles.js:81-93`,
  `src/smiles.js:125-128`); migrate live tracking and last-valid-position fallback.
- One-wheel clearance/yield/gathering reads Crowd directly with distinct filters
  (`src/oneWheels.js:73-87`); a general people view must preserve those filters.
- Main's hit resolver, scoring/passport paths, debug hooks, and command inspection
  retain Crowd/NPC access (`src/main.js:1532`, `src/main.js:1648`,
  `src/main.js:1842`, `src/main.js:1976`, `src/debug.js:481`).
- Healing Arts, camp music, and monks invoke private render writes
  (`src/healingArtsActivity.js:50`, `src/campJamActivity.js:154`, `src/monks.js:49`).
- Firework and song callbacks send immediate cheers (`src/main.js:435`,
  `src/main.js:446`); the band's music handle moves with its leader
  (`src/obstacles.js:305`, `src/obstacles.js:377`); vehicle/tent/job owners retain
  their respective music handles (`src/nutWagon.js:216`, `src/chunks.js:76`,
  `src/campJamActivity.js:228`).
- Distance sweep and explicit Crowd removal are separate release paths
  (`src/crowd.js:808`, `src/crowd.js:2721`); chunk disposal currently traverses meshes
  before releasing Healing Arts (`src/chunks.js:572-595`). Their ordered-release
  migration must stop claims before callbacks and preserve shared-resource exclusions.

This ledger establishes the current ownership coverage. Executable mixed fixtures,
frame-event traces, and comparable Low/Mid performance baselines remain separate
unfinished tasks; this inventory is not a runtime acceptance claim.


## Current migration evidence

The tables above remain the immutable before-state inventory. Current accepted slices
are Crowd lifetime/claims and public Healing Arts ownership (`src/crowd.js`,
`src/healingArtsActivity.js`, `src/people/healingArtsMotion.js`), and independently
registered children (`src/people/children.js`). The child slot remains after smile
collection, reuses existing collider wrappers and preserves relocation identity.
The [extension guide](extension-guide.md) and `verification/people/extension.html`
prove one behavior over two storage/resource types without adding a live gameplay
policy. [Dated evidence](../../../verification/people/2026-10-26/README.md#accepted-healing-arts-children-and-extension-slices)
records the executed contracts and acceptance limits. All other rows remain migration
and final-acceptance work until their own checklist entries close.
