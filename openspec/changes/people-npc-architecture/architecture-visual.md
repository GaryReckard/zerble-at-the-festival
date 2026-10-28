# Festival people, before and after

**TL;DR:** The characters retain their different brains and bodies, while the
connections between owners become explicit. A population owns a person's lifetime,
an activity can temporarily borrow movement, and the place or vehicle owns its
resources. Registration makes supported participation discoverable without making
every person eligible for every behavior.

The before view is anchored to immutable revision
`9eaf2e5d73419f7c926c11ab06882f007b2bf1e4`, with file/line evidence in the
[before ledger](coverage-ledger.md). The after view describes the working
implementation, with [all 17 families and executable evidence](acceptance.md),
[exact dependency slots](dependency-slots.md) and the
[population/venue eligibility matrix](extension-guide.md#population-eligibility-matrix).

## Before: connections depended on the particular family

```mermaid
flowchart TD
  M[Main frame and input callbacks]
  C[Crowd: pooled adults and instance matrices]
  O[obstacles.js: six separate population classes]
  K[Children / Wooks / Puppet parade / Brass band / Hoopers / Frisbee pairs]
  R[Photographers and monk members: Crowd identities]
  A[Inline Crowd activities: bathroom, market, hammock, picnic, camp, boarding]
  E[External Healing Arts and camp music; monk group intent]
  V[One-wheel riders / Nut wagon and driver / Lurleen]
  P[Chunks and places: stage performers / Sugar Shack cooks / vendor keepers]
  H[Healing Arts model computes trajectories as well as display]
  B[Birds: independent ambient owner]
  X[Main assembles ordered collisions and scoring]
  M --> C
  M --> O --> K
  C --> R
  C --> A
  E -->|private person and renderer access| C
  H -->|sampled movement copied back| E
  M --> V
  V -->|raw Crowd records and seats| C
  M --> P
  M --> B
  C --> X
  K --> X
  V -->|registry bodies| X
```

The shared ownership idea already existed in places, but there was no consistent
boundary for it. For example, a monk or photographer was already a Crowd person,
while a child belonged to an unrelated obstacle class. Main had to know the
individual update, reaction and collision paths, and some borrowers reached into
Crowd's renderer. This diagram does not claim the former game had no owners.

## After: common connections, specialized owners

```mermaid
flowchart TD
  M[Main owns frame order and composition]
  D[PeopleRuntime: named slots, supported capabilities, inspection]
  C[Crowd owns adult storage, identity, ordinary motion and instanced publication]
  K[Independent owners: children / wooks / parade / brass / hoopers / frisbees]
  R[Photographers and monk groups reuse Crowd handles]
  V[One-wheel riders and Lurleen expose person queries; vehicle physics stays owned]
  Q[Copied nearby views and lifetime-validated selected-hit callbacks]
  I[Person handle: registration lifetime plus slot generation]
  A[Current activity claim: one authorized movement writer]
  P[Place or vehicle owns reservations, transforms and lifetime]
  F[Population validates pose and binding; model displays it]
  E[Healing Arts activity owns trajectory and prior-sample cache]
  L[Place-owned stage performers / cooks / vendor keepers]
  B[Birds remain with the ambient owner]
  M -->|explicit dependency barriers| D
  D --> C
  D --> K
  D --> V
  C --> I
  K --> I
  V --> I
  R --> I
  D --> Q
  I -->|explicit eligibility and compatible commands| A
  A -->|prepare, validate and release| P
  A -->|claim-checked writes| F
  E --> A
  C --> F
  K --> F
  D -->|borrowed display routes, no person identity| L
  M --> B
```

The activity arrow is a capability boundary, not a statement that every registered
family implements adult activities. One-wheel/Lurleen facets are query-only,
children retain their own behavior, and decorative people acquire no interactive
lifetime merely because they look human. The wagon driver remains the same Crowd
person when the vehicle releases him.

## What happens when a person visits a place

```mermaid
flowchart LR
  S[Local selector chooses an eligible handle]
  T[Prepare person claim and tentative place reservation]
  C[Commit: revoke previous writer, release it, activate visit]
  U[Approach / participate / exit through validated commands]
  R[Release resources and restore ordinary binding]
  S --> T --> C --> U --> R
  T -->|failure| O[Keep the previous activity intact]
  U -->|person removal, interruption or place unload| R
```

For a stage, the adapter can supply audience destinations or reserved standing
spots. For a potty, it supplies a live stall, door and safe exit. For a food truck,
a new service adapter supplies its counter and queue rather than treating a truck
collider as a vendor. Healing Arts supplies rig slots and motion constraints, while
the wagon supplies moving seats. The behavior reads these contracts instead of
switching over every combination of NPC family and venue. The executable
[two-population, two-place, two-binding proof](../../../verification/people/extension.html)
demonstrates this connection without changing live eligibility.

## What stayed deliberately separate

| Responsibility | Before | After |
| --- | --- | --- |
| Lifetime and removal policy | Crowd pool, independent global populations, chunk places and vehicles | Same policies, with validated handles and ordered cleanup |
| Movement | Family logic and several private cross-owner writers | Family logic or a current validated activity; vehicle physics stays vehicle-owned |
| Rendering | Adult instancing and specialized model rigs | Same render strategies, with explicit borrowing/restoration |
| Interactions and collisions | Main enumerated families and retained raw targets | Declared ordered providers, copied views and selected-hit callbacks |
| Frame order | Carefully interleaved family calls, collection, streaming and scoring | Named dispatch at those same barriers, including adult-before-collection and child-after-collection |
| Places and resources | World/vehicle-owned resources with inconsistent borrowing seams | Resource ownership stays local; reservations and release validate exact lifetimes |
| Animation clocks | A mixture of wall time and supplied delta | Accepted gameplay time for actors, with profiling/audio/streaming clocks separate |

The measured topology is unchanged under matched Low/Mid initial conditions.
There is measurable CPU validation cost, and muted Mac tests do not establish
physical iOS audio or phone performance; see [the evidence and limits](acceptance.md).
