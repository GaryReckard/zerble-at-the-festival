# Ordinary-person reaction authority

October 30, 2026. Internal foundation only; no new visible fall is enabled.

`Crowd.canClaimPersonReaction` and `Crowd.claimPersonReaction` provide a public,
guarded entry into the existing activity-claim lifecycle. Ordinary unclaimed
adults retain their incoming position, velocity and state until the reaction
publishes a pose. Existing activity, seated, riding, hidden, grouped,
photographer and camp-instrument presentations are excluded. Occupied support
will need a separate prepared transfer rather than weakening these exclusions.

`node bin/test-person-reactions` executes the production Crowd methods with
real `PersonHandles` and `ActivityClaims` and recording rendering boundaries.
It covers eligibility, repeated claim rejection, synchronous resource rollback,
eligibility changing during preparation, person removal during preparation,
retired handle reuse, newer activity protection and cleanup exactly once.
The existing resume policy deliberately preserves fleeing; a first test
incorrectly expected every released reaction to resume walking and was corrected
to match that policy. These tests do not verify rendered falling motion.

The production build was generated in `/tmp/zerble-reaction-boundary-20261030`.
`npm run check` and `npm run build -- --outDir /tmp/zerble-reaction-boundary-20261030`
both exited 0, as did the expanded focused reaction test. The reaction test is
included in both the full check and `test:physics` scripts.
Chrome tab 380986087 loaded the real game with physics enabled, mute, Low and
seed 1977, then started through the ready Just Cruisin' button. The title closed,
the world ran with two active props and 17 bodies, and console warnings/errors
were empty. This proves boot compatibility, not live reaction activation or
phone performance. No graphics were changed, so no new Noon/Midnight comparison
is claimed. The test tab closed and temporary port-8766 preview exited 130.

The user cooler preview on port 8767 remains separate and running. Next work
is supported seat/load ownership followed by continuous release, landing and
clear stand-up recovery. The existing closed-cooler and empty-object scoring
checkpoints remain the current playable behavior.
