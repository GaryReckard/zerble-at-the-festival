# Live cooler lid assembly

October 30, 2026. Opt-in `physics=1` implementation, not final device acceptance.

## Behavior and ownership

Cooler admission now reserves two bodies, six colliders, one revolute joint and
its existing four render parts before hiding the authored source. A hollow
five-box shell replaces the closed collision box, and a separate lid uses the
model's hinge pivot and the adopted named render part. Combined shell/lid mass
matches the former closed box at each uniform world scale. Nonuniformly scaled
coolers are rejected before adoption because a scaled rotating hinge would not
match that visual transform.

The lid starts latched. A qualifying cart hit or a sudden base velocity change
over 1.2 m/s in a fixed step opens its angular limits to 0–1.85 radians. This is
provisional feel tuning. Unlatching allocates no bodies, colliders or joints.
Both shell and lid participate in incoming prop sweeps and share the same
incident identity; cart response uses total assembly mass even for lid contact.
The support envelope includes the complete opening arc. The cooler may close
under gravity while remaining unlatched.

The source can unload and regenerate while the owned lid remains live. Cleanup
removes the lid and joint before releasing the body, render binding and budget.
An unlatched cooler cannot be reclaimed by the untouched-furniture optimization.
Stale lid handles do not delete a newer body reusing the same id. There are no
live loose contents yet; their reservation/transfer work remains next.

## Verification

`node bin/test-physics-cooler` passes real cart impacts at 30/60/120 Hz presentation
rates, with actual lid articulation, no smile damage, retained mass behavior,
no event overflow, source unload, duplicate-free regeneration and zero engine
bodies/colliders/joints after disposal. Existing eight-resident capacity reuse
and terrain-fit cases also pass. Added cases cover full joint capacity rollback,
no-allocation unlatching, invalid scale and stale replacement safety.

The full `npm run check` and production build passed. Targeted debug command,
action and collision-policy tests passed after adding inspection controls.
A real Chrome mode-button start, cooler staging and coast produced two counted
prop impacts, an unlatched live lid, no support suspension, and no console errors.
[First impact diagnostics](first-impact.json) include the real live owner and
engine counts. The final sampled hinge error was approximately 0.09 mm; this
single resting observation is not a bound on transient error.
[Final inspection data](inspected-impact.json), [Low Noon](low-noon.png) and
[Low Midnight](low-midnight.png) verify the inspection controls and settled lid
appearance. The lid had returned closed under gravity but remained unlatched;
these stills do not prove the transient opening animation. No added model
geometry or shadow casters are introduced.

## Limits and next work

The [hard-impact comparison](../2026-10-30-hinge-comparison/README.md) still records
centimetre-scale transient hinge error at stronger fixture impacts. Live
integration deliberately preserves that real solver behavior rather than
concealing it with a render-only correction. Tightening that error, reserving
and rendering loose contents, phone timing and close-up motion acceptance remain
open. The overall physical-festival feature is not complete.

Use **Stage cooler encounter**, wait for **Target: active**, then **Inspect staged
prop** and **Coast forward** in the opt-in panel. **Noon** and **Midnight** change
lighting; **Chase camera** restores normal driving view. These controls do not
appear without the physics query flag.
