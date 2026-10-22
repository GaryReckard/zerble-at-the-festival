# Healing Arts tent verification

Recorded on 2026-10-22 in the Codex in-app browser on Gary's Mac. These are
local desktop checks, not phone performance or iOS audio acceptance.

## Delivered behavior

The [model](../../src/models/healingArts.js) builds a cream five-peak canopy
with six pointed tie-downs, a roof raised 0.6m from the first draft, a hanging
sign below the fabric, bunting, lights and a DJ booth. Seeded classes contain
7–20 people on loosely placed mats, including peripheral lawn positions.
Standing, warrior, tree and forward-fold poses blend over a repeating sequence.
Night dancers circulate, change heading and carry glowsticks on every third
participant, while a single shadow-free light uses the existing context pool.

The [planner](../../src/worldgen/festival.js) selects at most one candidate hub
per 3×3 macrocell, rejects nearby competing candidates, and checks the full
14m envelope against roads, water and existing neighboring base plans. Its
private salt leaves the previous layout RNG stream untouched. The same planned
clearing excludes trees across chunk boundaries.

The [activity controller](../../src/healingArtsActivity.js) retains real
[Crowd](../../src/crowd.js) members while the model temporarily supplies their
render rig. At rising nightness above 0.18, the class leaves at 0.9-second
intervals. Nearby available regular festivalgoers are assigned arrivals after
nightness exceeds 0.5, walk into the tent, and blend into circulation over four
seconds. A 60-second cooldown prevents the departing class immediately becoming
the incoming dance crowd. Dawn releases dancers, while daytime refills classes.
If the crowd pool is full, available nearby people walk to vacant yoga spots.

[Chunk ownership](../../src/chunks.js) releases visits, animation references and
nighttime music on unload. The open floor has no solid tent-body collider;
only support poles collide. Photographers, parties, riders and occupied
activity visitors are excluded from incoming assignments.

## Reproduce

Use the existing no-cache server on port 8765:

- `sandbox.html?entity=healing_arts&seed=1977&mute=1` previews the 20-person example. Other seeds vary the class size and layout.
- `sandbox.html?entity=healing_arts_activity&mute=1` uses real crowd members; click Noon, then Midnight. Its status line shows yoga, leaving, arriving and dancing counts plus the total population.
- `/?seed=1234&perf=low&mute=1` or `perf=high`: wait for the ready title card and click Just Cruisin'. Open the backtick panel, expand Teleport, select Healing Arts tent, then Go. The planned tent is near `(534,15)`. Stats include live visit counts.

## Automated results

`npm run check` passed, including the two new tests. The full output is in
[check.txt](check.txt).

[Placement and activity tests](../../bin/test-healing-arts) cover five seeds:
53 tents across 573 sampled hubs, road/water/neighbor clearance, one-per-region
selection, inter-tent spacing, query-order/seed-reset determinism and tree
clearings. They also cover night music attachment/detachment, chunk disposal,
staggered real-NPC changeover, retained appearance, no duplicate population,
dawn, interrupted arrivals, preserved fleeing and walking separation.

[Motion tests](../../bin/test-healing-arts-motion) exercise the shipped updater
with render writes stubbed. Across 30 dense 20-person configurations and 400
times each, the maximum center radius was 7.2000003m, minimum person-center
separation 0.9809m and minimum pole-center distance 0.7972m. The nominal 1.3m
separation is a soft solver target, not a rigid collision guarantee. Managed
yoga homes, hidden rig parts/mats/glowsticks, dance glowsticks and continuous
arrival also pass. [Recorded motion results](motion.txt).

Astra reviewed the model, controller, crowd hooks and chunk integration. Three
findings were fixed and tested: interrupted arrivals retain their actual
position, release preserves fleeing, and walkers avoid the visible alternate
rigs. The final review found no further blocking issue.

## Browser observations and captures

The isolated model loaded at Noon and Midnight under both Low and High URL
tiers, with no captured warning/error messages. The final 20-person scene
reported 34 draws / 18,480 triangles at Noon and 46 draws / 22,548 at Midnight,
with 7 geometries / 4 textures. For comparison, the earlier nine-person draft
reported 33 draws / 13,256 triangles at Noon before the moving crowd, glowsticks
and lighting changes. These are whole sandbox counters, not an empty-scene
subtraction or device FPS claim; viewport and visibility affect them.

| Capture | Purpose |
| --- | --- |
| [Noon](noon.jpg) | Final loose class, peripheral mats and pointed canopy |
| [Midnight](midnight.jpg) | Circulating dancers, glowsticks and DJ lighting |
| [Midnight side](midnight-side.jpg) | Side opening and hanging sign clearance |
| [Low Noon](noon-low.jpg), [Low Midnight](midnight-low.jpg) | Low-material rendering |
| [Game Noon Low](game-noon-low.jpg) | Real streamed tent and daytime participants |
| [Game Midnight Low](game-midnight-low.jpg), [Game Midnight High](game-midnight-high.jpg) | Real game integration at night |

Both Low and High game paths were started with actual mode-plank clicks,
teleported through the real debug picker, and inspected after generation.
The Low game progressed from seven dancers with two more arriving to all nine
slots dancing, with zero yoga participants or remaining class departures; the
crowd count remained 97. [Saved live stats](game-night-counts.txt). The real-crowd sandbox also
showed staggered departures and incoming dancers without console errors.
All agent URLs remained muted, so musical scheduling and the collision-sound
button were exercised without claiming an audible mix or iOS unlock test.

Test tabs were closed; no standalone browser process or local server was
started. The pre-existing local server was left running.
