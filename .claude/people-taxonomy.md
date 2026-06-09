# The people of Zerble — NPC/figure taxonomy (E2)

> **Why this exists.** Gary's hunch (2026-06-07): "the various people classes each have
> their OWN logic — I've seen changes to one not transfer to others." **Confirmed.** There
> is exactly ONE shared ambient crowd pool; everything else is a separate bespoke system
> with its own model, update loop, and state machine. This doc maps what's shared vs what's
> independent so future behavior/placement work knows what a change will (and won't) touch.
> Every claim is cited `file:line` (verified 2026-06-09 via a codebase sweep).

## The one-sentence answer

**Editing `src/crowd.js` only changes the ambient festival-goers (the throng around stages,
along roads, in the grounds). It does NOT change the puppet parade, brass band, kid gaggles,
wooks, hula-hoopers, drum-circle drummers/dancers, on-stage bands, or Lurleen** — each of
those is its own class with its own model + per-frame update + state. There is no shared
"NPC base class"; the only real code reuse is the `buildSimpleNPC` *body model* (below).

## 1. The shared ambient crowd — `src/crowd.js`

The single pooled, instanced crowd. One `Crowd` class (`crowd.js:103`), a free-list of
`MAX_NPCS = PERF.crowdMax` slots (`crowd.js:30`), drawn as 7 InstancedMeshes
(`_buildInstanced`, `crowd.js:122`). One per-frame `update()` (`crowd.js:554`) ticks every
NPC through one `_updateNpc()` state machine (`crowd.js:611`).

- **No character sub-classes** — variety is per-NPC *personality* (curiosity / skittish /
  social / energy / dance, `crowd.js:342`) + a shirt-color variant (plain vs tie-dye,
  `crowd.js:42`). Same model, same state machine for all.
- **States** (one switch, `crowd.js:769`): idle, walking, watching, approaching, fleeing,
  boarding/riding/disembarking, hammock_riding, seeking/using/exiting_potty, cheering.
- **Crowd-only behaviors** (nothing else has these): boarding Zerble as a passenger
  (`crowd.js:740`), hammock lounging (`crowd.js:775`), porta-potty visits (`crowd.js:672`),
  the smile/frown charm ramp (`crowd.js:1064`).
- **Who spawns into it:** the stage audience (`buildStage` in chunks.js), the v2 ambient
  crowd (`spawnAmbientCrowd`, heart-influence-scaled), generic chunk fill.

## 2. The bespoke systems — each independent (in `src/obstacles.js` unless noted)

| System | Class / loc | Model | Per-frame update | What's distinct |
|---|---|---|---|---|
| **Puppet parade** | `PuppetParade` `obstacles.js:93` | `buildPuppet` `models/puppet.js:7` (floating creature + a `buildSimpleNPC` handler) | `update()` `obstacles.js:166` | Marches a fixed recycled path; honk-scatter dodge |
| **Brass band** | `BrassBand` `obstacles.js:204` | `buildBandMember` + `buildParasolMarshal` (both wrap `buildSimpleNPC`) | `update()` `obstacles.js:305` | 7-member second-line formation; carries its own spatial music |
| **Kid gaggles** | `KidGaggle` `obstacles.js:361` | `buildKid` `models/kid.js:19` (own geometry) | `update()` `obstacles.js:462` | ~40-50 kids; chase bubbles; **own smile economy** (`KID_SMILE_RANGE`, duplicated from crowd) |
| **Wooks** | `Wooks` `obstacles.js:724` | `buildWook` `models/wook.js:8` (own tie-dye shader) | `update()` `obstacles.js:790` | Orbit an anchor; approach a parked Zerble = the **trip trigger** |
| **Hula-hoopers** | `HulaHoopers` `obstacles.js:995` | `buildHulaHooper` `models/hulaHooper.js` | `update()` `obstacles.js:1008` | Pool that re-anchors to POI attractors (stages/drum/firepits); glowing hoop |
| **Drum-circle figures** | `populateDrumCircle` `forests.js:452` | `tribalFigures.js` (buildFireDancer/HandDrummer/Firekeeper/Spotter) | ticked via `forestDrumCircles[]` in `main.js` (~`:782`) | Seated drummers + orbiting dancers + firekeeper; `wakeThreshold` nightness-gated |
| **Stage performers** | `stagePerformers[]` `chunks.js:49` | `buildBandMember` `models/bandMember.js` (non-instanced) | `updateStagePerformers(t)` `chunks.js:112`, called `main.js:~747` | The band ON each stage; light bob/sway |
| **Lurleen** | `Lurleen` `lurleen.js:79` | bespoke pink golf-cart build `lurleen.js:178+` | `update()` `lurleen.js:691` | The love interest; wander/aware/following state machine; re-home leash |

Each row above has its **own update call** (no shared tick) and its **own model geometry**
(except the `buildSimpleNPC` body reuse, below). A change to one row's movement, count,
spawn rule, or animation does **not** propagate to any other row or to the crowd pool.

## 3. The model-pool landscape (the one real reuse)

- **`buildSimpleNPC(shirt, skin, opts)` (`models/puppet.js:191`)** + its shared geometry
  pool (`_LEG_GEO`/`_TORSO_GEO`/`_HEAD_GEO`/… `puppet.js:183`) is reused as the *body* for:
  the puppet handler, brass-band members, the parasol marshal, and on-stage performers.
  So a tweak to `buildSimpleNPC` DOES ripple to those four (but not their behavior).
- **Bespoke geometry (no reuse):** the ambient crowd's instanced meshes (`crowd.js`),
  `kid.js`, `wook.js`, `hulaHooper.js`, `tribalFigures.js`, the puppet *creature* body
  (`puppet.js`), and Lurleen's cart (`lurleen.js`).
- **Duplicated logic to watch:** the smile/happiness ramp exists in BOTH `crowd.js:1064`
  AND `KidGaggle` (`obstacles.js:~577`) — change one and the other won't follow.

## 4. Practical implications for future work

- **"Make people walk along roads" / crowd density / crowd behavior** → `crowd.js` only.
  Won't change kids, wooks, parades, bands, drummers, stage acts, or Lurleen.
- **"Tie tent count to people"** (D2) used the *crowd* count model (`heartInfluence`), so it
  tracks the ambient crowd — not the bespoke gaggles/bands.
- **Adding a new seated-at-X behavior** (e.g. C2 picnic-table seating) → most naturally a new
  `crowd.js` state (joins the idle/watching/seated family), since only the crowd pool has the
  state-machine + pooling for it. The bespoke systems would each need their own copy.
- **A new "kind of person"** is a decision: a crowd *personality/state* (cheap, pooled,
  shares the model) vs a *bespoke system* in `obstacles.js` (own model + loop + state, like
  kids/wooks). Prefer the crowd pool unless the figure needs a distinct model or movement.
