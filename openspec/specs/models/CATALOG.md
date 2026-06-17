# Model catalog (reference)

Per-model inventory of `src/models/`. Derived from the file list, `ARCHITECTURE.md`,
and the sandbox `ENTITY_HIT_KIND` map (`sandbox.html:825`). Collision **kind** is the
registry kind a placed instance uses (drives the hit SFX and the sandbox "Hit it"
button); blank = no collider / decorative. This is a reference companion, not a
normative spec — see `spec.md` for the model contract.

## Festival structures

| File | Builds | Collision kind |
|---|---|---|
| `stage.js` | Main / side performance stage with light show + beams | `stage` |
| `tentStage.js` | Tented stage variant | `stage` |
| `tent.js` | Craft/vendor tents (booths); pooled static decor (perf P1 merge) | `tent` |
| `foodTruck.js` | Food trucks; shared body geometries + color-keyed material cache | `truck` |
| `sugarShack.js` | Sugar Shack — string-bulb lights, work spots; pooled `SHACK_MATS`/`STRING_BULB_GEO`/`SUPPLY_CAN_GEO` | — |
| `entranceArch.js` | Festival entrance arch (threshold over the spawn road) | `arch` |
| `leafBanner.js` | Hanging LEAF-style banner | — |
| `portaPotty.js` | Porta-potty bank | `porta_potty` |
| `picnicTable.js` | A-frame picnic table (NPCs sit at them) | `tent` (wood thunk) |
| `bubbleVendor.js` | Welfare-station bubble vendor | — |
| `bubbleJug.js` | Scattered bubble-soap jugs | — |

## People (NPC humanoids)

| File | Builds | Collision kind |
|---|---|---|
| `puppet.js` | Giant parade puppet; also exports `buildSimpleNPC` — the base humanoid for band/kids/crowd | `puppet` |
| `bandMember.js` | Brass-band members (trumpet/tuba/sax/drum/trombone) | `brass` |
| `kid.js` | Festival kid (gaggle member) | `kid` |
| `wook.js` | The wook (trip-offer NPC; passive proximity collider) | `wook` |
| `performer.js` | Stage performer/dancer (animated) | — |
| `parasolMarshal.js` | Parasol marshal | — |
| `frisbeePlayer.js` | Frisbee-throwing reveler (drifts) | — |
| `hulaHooper.js` | Hula-hooper (drifts) | — |
| `tribalFigures.js` | Drum-circle dancers / drummers / firekeeper (animated) | — |

## Camping / forest

| File | Builds | Collision kind |
|---|---|---|
| `campsite.js` | Tents, camp chairs, firepit (chiminea), tiki torch, tapestries; `matFor()` color cache + pools | `tent` / `firepit` |
| `leafDrumCircle.js` | LEAF drum circle — stone firepit + log benches (instanced) | `firepit` |
| `hammock.js` | Posted hammock (ridable) | — |
| `tree.js` | Forest trees (pine/oak/birch/random); pooled trunk/crown geo + materials | `forest_tree` |
| `shrub.js` | Low-poly shrub/bush — woodland undergrowth + seam hedges | — |

## Lake / ambient

| File | Builds | Collision kind |
|---|---|---|
| `canoe.js` | Lakeside canoe | `lake_edge` |
| `bird.js` | Bird model for the flock (see `ambient-backdrop`) | — |
| `heart.js` | Pink heart particle — exports `sharedHeartGeometry`/`createHeartGeometry` (used by Lurleen + feedback) | — |

> Pooled-resource owners to model new work on: `sugarShack.js`, `campsite.js`,
> `puppet.js`, `foodTruck.js`, `tree.js` — each tags `userData.shared = true` on its
> module-scope geometry/materials (see `perf-pooling.md`).
