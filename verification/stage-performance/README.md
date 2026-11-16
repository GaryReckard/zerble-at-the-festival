# Stage performance refresh, November 16, 2026

The refresh keeps the low-poly festival style while giving stages a practical backline, musicians actions tied to their own music, more varied synthesized arrangements and audience-dependent applause. The implementation was developed from main `55d7a68` on `codex/stage-performance`.

## Inspect it

Run the normal development server and open `/sandbox.html?entity=stage_main&style=funk&mute=1`. **Play this band** starts the real muted audio transport. The genre selector changes both the score and the roster, **Inspect musician** frames a player, and **Hold pose** freezes only the visual. **Between songs** follows the audio-clock song-end path; **Rest / stop music** tears down the source. Select an empty, small or full **Stage audience** to compare zero, four and 24 actual Crowd actors, then use **Applaud audience**. See the [workshop guide](../../DEBUGGING.md#stage-performance-workshop).

The [capture gallery](gallery.html) includes before/after stages, instrument close-ups, nighttime views, the DJ and the real game. Captures use the managed in-app browser, without standalone Chromium or software-WebGL workers. All URLs used session mute, and no persisted volume setting was changed.

## Browser observations

- The main and side stages rendered at Noon and Midnight on Low; the covered folk stage rendered at both presets on Mid. Guitar, drum kit, trombone and keyboard close-ups showed separate articulated playing contacts. The DJ booth switched to dance music and nighttime presentation on Low.
- The workshop began with pending audio and resting musicians before the gesture. Play, song gaps, style changes, and a refresh retaining `style=funk` worked. No second band remained when switching the selected style.
- A small audience reported four participants, 1.9 seconds and 35% intensity; a full audience reported 24 participants, 3.1 seconds and 86% intensity at the song ending. Another small tent audience reported four participants and 2.1 seconds. Individual durations vary deterministically with their actor and event. The empty audience disabled manual applause and supplied no listening crowd to the song-end bridge.
- The real game passed its native ready-mode click and world boot on Low, followed by a live Stage landmark teleport. The tent band, engineer and ordinary festival crowd rendered in the streamed world. Console inspection returned no warnings or errors after sandbox checks and the live game visit.

These are browser behavior and raster observations. They are not a physical iPad/iPhone test, an iOS audio-unlock acceptance result, an FPS benchmark, or a listening review. The music was verified through muted transport and numerical audio events; Gary’s audible judgment of musical quality remains necessary.

## Render counts and memory

The first before/after comparisons used the original full-stage camera and empty audience. The legacy sandbox used random costume variants; the refreshed preview uses seed 1977, so triangle differences include costume and roster changes. These are descriptive native render-counter readings, not calibrated route measurements.

| Low sandbox | Before draws / triangles | After draws / triangles |
| --- | ---: | ---: |
| Main stage, jam | 54 / 24,485 | 40 / 21,361 |
| Side stage, brass | 37 / 14,735 | 23 / 11,949 |

The [baseline readouts](baseline-render-counts.json) also record the old covered stage. Its new folk/Mid and lower-camera captures are deliberately not presented as a matched comparison. The final workshop camera looks under the roof rather than down onto it.

The [layout regression](../../bin/test-stage-layout) measures static main-stage meshes from 24 to 10 and side-stage meshes from 20 to six, with existing caster counts retained at five and two. The [performer regression](../../bin/test-stage-performers) measures four draws and one caster per player, up to 3,372 triangles across 44 pooled role/costume templates, with 11.92 MiB of shared CPU attributes/indices including motion targets. That CPU total is not a GPU-memory measurement. The initial main-stage browser texture counter rose from five to 19 after motion-target textures were uploaded, while geometry and render calls fell. No device-performance improvement is claimed from those tradeoffs.

## Regression coverage

`npm run check` includes the new stage suites and all existing game regressions. The initial full run caught an outdated assumption that a merged parade body must contain stationary upper-body vertices. The new musician deliberately separates those meshes; the corrected regression still checks every leg/normal against an independent rigid rotation and verifies every torso, arm and instrument vertex remains unchanged by walking. The remaining check chain passed, followed by a complete `npm run check` rerun with exit status 0. The final seat-boundary change then passed its new production venue test and both audience regressions, and `npm run build` passed with the existing Vite chunk-size warning.

- [Audio](../../bin/test-stage-performance-audio): eight complete genre scores, phrase/harmonic variation, seeded identity, actual pitch cues, suspend/resume, late timers, monophonic retriggers, audience-scaled applause and bounded teardown.
- [Musicians](../../bin/test-stage-performers), [layout](../../bin/test-stage-layout) and [shared band](../../bin/test-stage-band): instrument contact, role rosters, pooling, dimensions, fixed RNG consumption, per-frame cue sharing and explicit rests.
- [Venue ownership](../../bin/test-stage-venue-ownership): 68 designated listening spots across three actual rotated/scaled hubs, matching band/audio source coordinates and genre rosters, and registry/music/performer cleanup on disposal.
- [Audience](../../bin/test-stage-audience-reactions): actual Crowd matrices, clap hand contact, seated ownership, staggered gestures, rotated floors, interrupted/recycled actors and stage removal. [Preview](../../bin/test-stage-audience-preview) additionally checks the real builders, recessed tent source and preset/audio cleanup.
- [Healing Arts motion](../../bin/test-healing-arts-motion) and [streaming sampler](../../bin/test-healing-arts-sampler): real DJ note cues, platter contacts, idle/gap behavior, night transitions and unload. Existing parade locomotion and hair checks also passed.

## Limits

Music remains synthesized, and hand positions are a stylized mapping of the actual played pitch rather than fingering for every real instrument. Lead singers use the melodic cue without synthesizing lyrics. Healing Arts follows its own night track but does not receive the stage-front applause population added to regular and covered stages. No new shadow casters or geometry per animation frame were added. Physical-device frame cost and subjective listening have not been accepted by these desktop checks.


## Follow-up: stage walking and sustained phrases

Gary’s listening pass accepted the musical refresh and requested stage movement and occasional longer notes. Singers now use a handheld mic and a front-stage walk/pause corridor; guitar and bass make smaller, delayed movements. Drums, keys, engineers and musicians on the riser remain stationary. New held phrase endings last 1.85 beats in folk, 2.4 in jam/brass, and 1.3 every second phrase in funk; other attacks and percussion remain crisp. The lead avoids retriggering until its held note has finished, and the cue buffer includes the third beat of that note.

`bin/test-stage-roaming` samples actual posed geometry across main/side stages, two scales and five styles for 36 seconds, checking feet, deck edges, downstage equipment clearance and other players, plus stop/suspension/held placement and route agreement at 30/60/120 Hz. The audio suite checks both brief and held notes, no early retrigger of the new sustains, and visible pitch through the third beat. No new render meshes, shadow casters or audio voices were introduced; the singer’s removed stand reduces geometry. A Low main-stage browser readout showed 40 draws / 21,009 triangles and 24 textures after uploading stride and microphone morphs, compared with 40 / 21,361 and 19 textures for the previous main-stage implementation. This is a resource tradeoff, not a device timing result.

Browser Noon and Midnight captures show the handheld singer and the stage position readout changing from centre to both sides; hold and stop kept the current position. See [Noon](singer-roaming-noon-low.jpg) and [Midnight](singer-roaming-midnight-low.jpg). The complete `npm run check` chain passed, followed by the expanded roaming clearance/cadence test and production build. The audio test remains muted; Gary’s next listening pass can judge how the selected sustained phrases feel.


## Follow-up: musical lighting, Healing Arts and marching brass

Genre-specific lighting now follows the same accepted-frame music sample as the band: warm, narrow folk washes; rhythmic funk/brass accents; wider dance/dub fans in larger sections. Musical gaps retain quiet, static lamps, while daytime and Reduced Motion hide the shafts. A conservative camera bound and an 80 m game cutoff cull decorative beams. The existing six-point/six-spot context pool is unchanged, and the stage selector still caps active carriers at six. No new real lights, shadow casters, textures or post-process passes were added. Each fan uses shared RGBA vertex-color cone geometry and a shared additive Basic material, with venue-owned instance buffers.

The workshop’s **Beam fans** checkbox permits a direct comparison while **Hold pose** freezes the actual cue. Native in-app browser readings for the same dance-band pose and camera were:

| Tier | Fans off | Fans on | Added geometry |
| --- | ---: | ---: | ---: |
| Low | 40 draws / 20,717 triangles | 41 / 20,765 | one draw / 48 triangles, three rays |
| Mid | 40 draws / 20,717 triangles | 41 / 20,813 | one draw / 96 triangles, six rays |

This establishes the submitted geometry cost, not GPU milliseconds or a physical-device FPS result. Translucent rays still have a fill cost. They are not a reason to increase the real-light pool or bloom. The before/after captures are [Low off](lights-dance-low-off.jpg), [Low on](lights-dance-low-on.jpg) and [Mid on](lights-dance-mid-on.jpg). [Calm mode](lights-calm-low.jpg) removes the fan, and [folk Midnight](lights-folk-midnight-low.jpg) / [Noon](lights-folk-noon-low.jpg) show its warmer treatment and day gate.

Healing Arts uses its own actual night-track cue for the DJ and lights, with a two-ray Low or four-ray Mid/High overhead fan. Its production population preview completed the real changeover from 20 yoga participants to 20 dancers, with departures/arrivals occurring normally. Dance/dub selection and Calm lighting worked without changing volume preferences. See [the whole venue](lights-healing-party-mid.jpg) and [the dance floor](lights-healing-party-eye-mid.jpg). The crowd’s established choreography and ownership remain the existing Healing Arts activity; this pass adds the music-following DJ and night lighting, not a new audience applause controller there.

The marching band now has a sixteen-bar second-line call/answer, drum-break, shout and turnaround score. Trumpets and lower horns use separate sounding pitches, tuba and snare follow their own lanes, and the marshal accents the music while route/collider motion remains unchanged. The production `brass_population` sandbox unlocked through **Play marching band**, showed real cue activity, cleared the four lanes during a honk sidestep, and returned to the ongoing tune afterward. **Dispose formation** reported zero marchers and reduced the scene to two background draws / 48 triangles. [Noon](marching-band-noon-low.jpg), [sidestep](marching-band-scatter-low.jpg), [Midnight](marching-band-midnight-low.jpg).

The complete `npm run check` chain and production build passed. The new [lighting test](../../bin/test-stage-lighting) verifies genre/calm/day/gap/distance behavior, tier instance counts, actual camera-frustum rejection, unchanged real-light carriers and repeated disposal. [Venue integration](../../bin/test-stage-venue-ownership) verifies one transport sample shared by lights and musicians, matching live owners and cleanup, and the six-carrier cap with nine carriers loaded together. Existing marching/audio suites verify bounded six-source synthesis, muted/suspended states, held/counter notes, pre-unlock cancellation, moving distance fade, 400 exact route/RNG frames and 640 gait frames.

All inspection URLs used `mute=1`, and no browser warning/error was reported in the inspected sandbox paths. The native ready-mode game start, night covered-stage landmark visit and subsequent Healing Arts teleport all passed with no inspected console warnings/errors. The latter started real nighttime arrivals after streaming to the new venue. See [the streamed covered stage](lights-game-tent-low.jpg). These numerical/visual checks do not replace an audible assessment of the new marching arrangement or iOS physical-device audio/frame-time acceptance.
