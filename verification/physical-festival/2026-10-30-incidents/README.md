# Bounded prop incident attribution

October 30, 2026. This checkpoint establishes causal history for moving props;
indirect person reactions and scoring are still unfinished.

## Implemented contracts

[The incident ledger](../../../src/physics/incidents.js) retains the originating
prop, original instigator, simulation timestamp, hop count and affected target
identities. Defaults are 32 incident records, 64 body references, 32 targets per
incident, four hops and five simulation seconds. Capacity exhaustion rejects new
optional attribution rather than evicting live history. Expiration removes body
references and target histories together. A recycled body/person must supply a
new generation-qualified identity.

Repeated target claims are deduplicated across all props sharing the incident;
different people remain independently claimable. Shorter causal paths reduce hop
count without refreshing age. A newer deliberate incident wins over older history.
No scoring policy lives inside the ledger.

[The contact relay](../../../src/physics/propIncidents.js) uses actual solid
contact events plus pre-solver relative closing velocity above 1.2 m/s. Sensor
events are excluded. Force events must explicitly report Newtons and positive
force, but force magnitude alone never qualifies a resting contact. A bounded,
sorted graph removes event-array order from multi-hop propagation. The live world
captures incoming prop motion before each accepted step, starts attribution at
meaningful cart contacts and relays it after draining that step's events.
Existing contact separation/cooldown gates prevent sustained cart contact from
restarting an incident every frame. Retired props and world disposal remove history.

## Verified evidence

`npm run check` and `npm run build` passed. The final additional shortest-path
regression passed with `node bin/test-physics-incidents`.

- `bin/test-physics-incidents` checks age/hop/capacity limits, per-person
  deduplication, recycled generations, renewed primary incidents, conflicting
  sources, copied snapshots, 500 expiration cycles, reversed event ordering,
  shorter paths, sensor exclusion and resting forces. A real Rapier three-body
  collision chain carries the original instigator to the third body at hop two.
  The analytic engine fixture uses balls, not rendered furniture.
- `bin/test-physics-live-world` now checks real cart-to-chair attribution at
  30/60/120 Hz, including generation-qualified source identity, no ghost-mode
  attribution and zero incident records after world disposal. Existing furniture,
  person and scoring checks remain in the full suite.
- Real Chrome Low-tier game, seed 1977, initial `x=-883&z=-312.7&heading=1.57`,
  mute on. Started via Just Cruisin', selected Stage cooler encounter, then Coast
  forward and W. At simulation time 32.50 the rendered diagnostics showed one
  incident attached to two props: the cooler at hop zero and a loveseat at hop
  one, both with instigator `zerble`, incident ID 1, start 32.0333333333328 and
  expiration 37.0333333333328. This paragraph transcribes the observed tool output;
  the first-contact JSON was not saved before expiration.
- The saved [expiration snapshot](expired.json) shows zero incidents/body
  references at time 59.0833. A later staging action selected another cooler;
  its [new-contact snapshot](renewed.json) shows fresh incident ID 2 at hop zero.
  That later snapshot proves a new incident after expiration, not a repeated
  impact on the identical cooler. Console warnings/errors: none.

The test tab and temporary preview server were closed. The existing user playtest
server remains on the pedestrian-fall build while phone feedback is pending.

## Remaining work

Task 4.3 (Bounded incident provenance) remains unchecked: target deduplication is
proven at the ledger level, but chair-to-person delivery, multiple real victims
and indirect consequence integration are not yet complete. The current prop
relay measures center-to-center translational closing speed; rotation-only contacts
need contact-point motion evidence before coverage can be claimed. No new indirect
smile penalty or physical person response is enabled by this checkpoint.

Incident limits are provisional until device measurements. This adds bounded
per-step bookkeeping but no new rendering geometry; no performance acceptance is
inferred from successful boot or regression results.
