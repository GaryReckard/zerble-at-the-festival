# Prepared seated-person handoff

October 30, 2026. This connects the camp reservation and activity boundaries;
live occupied-chair admission and visible falls are not enabled by this change.

## Contract

Crowd exposes `readPersonSupport` and `preparePersonSupportTransfer`, selecting
only the current seated camp or camp-music activity. Grouped, photographer,
vehicle-seat, hidden and non-seated people remain excluded. The caller does not
need raw NPC records or the activity's private reservation map.

`prepareCampSlotTransfer` keeps the original valid reservation during incoming
activity preparation. If preparation fails, its cleanup removes only the
tentative transfer, preserving the old claim and occupied seat. When the old
activity releases successfully, a temporary hold keeps that same seat occupied
until `commit(newClaim)` validates the new person's current claim and target
entry. Late cleanup of the old token cannot free the hold or replacement.

The transfer must be prepared inside `claimActivity`'s synchronous `prepare`
callback and committed immediately after successful acquisition. The target
registry entry must already exist and contain the exact same seat object in
`campSeats`; this does not create or move registry entries. The original claim
cannot commit its own replacement. The support lease is owned by the new
activity's cleanup stack and can also release its seat explicitly when falling.

If the target disappears after old-claim revocation, commit returns false and
the new activity remains responsible for the person. Its prepared fallback must
choose a valid dismount/fall path before relinquishing movement; this resource
API does not invent an exit or put an actor into a newly occupied chair.

## Verification

`bin/test-camp-support-transfer` executes the production Crowd/CampActivity
methods with real person handles, activity claims and seat resources. It checks
two independent seated loveseat occupants, failed preparation, uninterrupted
seat exclusivity, origin unload, stale original cleanup, protected eligibility,
person removal, target loss, expired preparation and idempotent release.

The same test composes the handoff with actual Rapier supported loads. Zero
load capacity preserves the original sitter and reservation; successful load
acquisition transfers the seat, survives origin removal and releases the seat
and its 70 kg contribution together. The fixture supplies a replacement entry,
so this is not proof of live registry/chunk adoption or reserved fall capacity.

`bin/test-camp-music-ownership` adds a real seated-musician activity handoff.
Failed preparation leaves the music owner intact; successful replacement removes
its instrument once, and later ensemble/origin cleanup cannot free the new
support. Existing 1,400-frame music baseline comparisons remain in the test.
Rendering/model/audio endpoints are recording fixtures, not GPU or sound tests.

The production build at `/tmp/zerble-seat-transfer-20261030` was smoke-tested in
Chrome through the ready Just Cruisin' button, with physics, mute, Low and seed
1977. This checks ordinary game compatibility, not visible occupied reactions.
No graphics changed, so a new Noon/Midnight visual comparison is not claimed.
The world ran with five active props and 19 bodies; console warnings/errors were
empty. Chrome tab 380986132 closed and the temporary port-8766 preview exited
130. The user cooler preview on port 8767 was not replaced. The focused tests,
full `npm run check` and production build all exited 0; the full check included
the combined real-engine load/claim and musician handoff cases.

## Next integration

Use these public methods while preparing occupied furniture admission, alongside
the supported-load API and reserved release-body capacity. Publish the moving
seat pose through the current reaction claim, then implement stability/bracing,
continuous fall release, collision separation and clear stand-up recovery.
Task 5.2 (Supported load and bracing) and Task 3.5 (World-owner adapters) remain
incomplete until the full live ownership and streaming paths are exercised.
