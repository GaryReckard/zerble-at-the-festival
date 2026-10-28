# People dependency slots

Main remains the frame owner, and `PeopleRuntime` only executes a named slot when
main reaches that barrier. Registration compiles stable lists; it creates no RAF,
timer, visibility listener or automatic catch-up. Supported names follow the frame
order below, but that list is not an autonomous loop.

| Slot | Registered participants | Required surrounding work |
| --- | --- | --- |
| `vehicles` | Nut wagon, then one-wheel riders | Preserve the existing worldgen/freeze gate, then rebuild the registry spatial index. Physics and colliders remain vehicle-owned. |
| `adults` | Crowd | Crowd retains camp sessions, monk group intent, individuals and packed render publication in that order. Smile collection and score coalescing follow this slot. |
| `formations` | Puppet parade, then brass band | Runs after collection/scoring and before children. |
| `children` | Independent child population | Child smile emission remains after the collection barrier. |
| `roaming` | Wooks, hoopers, frisbee pairs | Runs before the independent bird controller and Trip proximity update. |
| `relationship` | Lurleen's person facet forwards to her vehicle | Relationship physics stays after birds/Trip and before its HUD/audio observers. |
| `place-performers` | Place-owned stage/tent performers | Uses explicit gameplay time; place rigs gain no interactive identities. |
| `late-activities` | Healing Arts world places | Retains update-before-sample, prior-sample borrowing and the existing near/night sampling gate. Stage lighting remains afterward. |
| `place-cooks` | Place-owned cook patrols | Remains after stage lighting and before the late population/seat trace. |
| `star-love` | Eligible Crowd people | Runs only under the original active-star/freeze gate and remains before contact resolution. Competing activity claims stay protected. |

The named routes are composed in [main.js](../../../src/main.js), with population
registration in [people/](../../../src/people/) and rider registration in
[oneWheels.js](../../../src/oneWheels.js). The runtime imports no concrete family.
Camp sessions, monk intent and adult render publication are documented internal
Crowd barriers, rather than empty global placeholder slots or duplicate traversals.

Honk, parked honk and cheer are supported capabilities invoked at their existing
input/audio callbacks. Collision candidates retain world-registry-first order,
then parade, brass, children, wooks, hoopers, frisbees and adults. Nearby queries
use explicit population/candidate filters; adding a provider does not implicitly
make it eligible for another controller's behavior. A person identity alone grants
neither movement authority nor a collider, seat or activity capability.

`/inspect people` and `__dbg.people()` expose current slots, capabilities and copied
inspection details, including display-only counts and vehicle facets. The actual
inspector caught a missing rider schedule during this migration, and its regression
now requires one dispatched update plus real position advancement. See
[verification](implementation-verification.md) and the
[coverage ledger](coverage-ledger.md).
