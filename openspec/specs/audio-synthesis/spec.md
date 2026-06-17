# Capability: audio-synthesis

> **Source:** `src/sound.js` (~3650 lines of Web Audio — bus graph, iOS unlock,
> engines, SFX, drum circles, stage songform, nature bed), `src/midiPlayer.js` (the
> M-key MIDI player). Spatial position is fed from `camera`; the song-end cheer signal
> drives `crowd-ai`; the trip envelope is `special-modes`; nightness comes from
> `lighting-and-time-of-day`. Everything is synthesized — no audio files ship.

All sound is synthesized in Web Audio. A small bus graph balances engine/SFX, stage
music, MIDI, and a nature bed, each with its own trip wet/dry chain, all under a master
gain. The whole context must unlock synchronously inside the start gesture or iOS ships
silent.

## ADDED Requirements

### Requirement: Synchronous iOS audio unlock inside the start gesture

`Sound.init()` SHALL run synchronously inside the title-card start gesture with NO
`await`/`setTimeout`/async hop before it, performing a three-stage unlock: (A) resume
the `AudioContext` first, before touching any other node; (B) play a 1-sample silent
WebAudio buffer source; (C) play a real silent `HTMLAudioElement` to promote the page.
`Sound.resume()` (`sound.js:566`) SHALL be wired to visibilitychange / pageshow /
pointerdown / touchstart (handlers in `main.js:624-634`) to recover from iOS suspending
the context (`sound.js:219-321`,
`ARCHITECTURE.md:274`).

#### Scenario: Mobile ships with sound

- **WHEN** the player taps start on iOS Safari
- **THEN** `Sound.init()` runs synchronously and the context unlocks via all three
  stages, so audio plays rather than sticking suspended

#### Scenario: Backgrounding then returning recovers audio

- **WHEN** the tab is backgrounded and refocused
- **THEN** a resume handler fires and the context resumes

### Requirement: Balanced bus graph under a master gain

Audio SHALL route through named buses into `masterGain`: `sfxBus` (engine, collisions,
honks), `musicBus` (stage music, via a duck gain), `midiGain` (the MIDI player), and
`natureBus` (the nature bed) — each with its own trip wet/dry chain. Per-bus volumes
SHALL persist in `localStorage` (`zerble.vol.music/sfx/midi/nature`) and restore at
init (`sound.js:18-20,114,189,321-438`).

#### Scenario: Music and MIDI have independent volume

- **WHEN** the player lowers the MIDI fader
- **THEN** `midiGain` drops while `musicBus` stage music is unaffected

### Requirement: Two distinct cart engines, Lurleen spatialized

`createEngine` SHALL synthesize the cart engine from detuned sawtooth oscillators
(gas-engine buzz) plus LPF-filtered noise (rumble), with speed scaling gain/pitch/a
putt-putt LFO and boost adding a harmonic tier, fading to silence at zero speed.
Zerble's engine SHALL be mono on `sfxBus` driven by `Sound.setEngineSpeed`. **Lurleen**
SHALL run a second instance with a brighter/cleaner profile, wrapped in an equalpower
`PannerNode` driven to her world position by `Sound.setLurleenEngine(speed, x, z)`, and
since she has no throttle her rev SHALL derive from her acceleration (`sound.js:130,457`,
`ARCHITECTURE.md:264`).

#### Scenario: Lurleen's motor pans with her position

- **WHEN** Lurleen drives past the player
- **THEN** her brighter engine pans + attenuates with distance via her PannerNode

### Requirement: Per-kind collision and honk SFX

Collisions SHALL fire per-`kind` one-shot synth hits (drums for stages, metallic
clangs for trucks/lampposts, nasal boops for kids/puppets, brass for the band, wood
knocks for the arch, a "duuude" drone for wooks). Honks SHALL synthesize a bicycle bell
or a clown horn (`sound.js:9`, `ARCHITECTURE.md:265-266`).

#### Scenario: Hitting a truck clangs

- **WHEN** the cart damages a `truck`-kind collider
- **THEN** the metallic-clang truck SFX plays once

### Requirement: Nightness-gated drum circles with distance lowpass

Each drum circle SHALL run a per-circle music scheduler whose voice density gates on
the global `nightness` (more voices at night). The **forest** drum circle additionally
SHALL have its lowpass cutoff set every frame from the player's distance to the circle
perimeter — wide open inside the circle, muffled by trees as you leave; the plain stage
`drum` style leaves this lowpass a no-op stub (`sound.js:180-186`, the forest lowpass at
`main.js:836-846`, `ARCHITECTURE.md:267`).

#### Scenario: Drums open up as you enter the circle

- **WHEN** the player drives into a forest drum circle
- **THEN** the lowpass opens and more voices are audible than from outside

### Requirement: Stage music songform with cheer gap

The melodic stage genres (`jam`, `brass`, `dance`, `world`, `dub`) SHALL run through
one shared `runStageSong` engine: a finite arc of named sections (intro → verse/build →
chorus/drop → bridge/break → outro) with per-section voice sets and intensity, a
per-song tempo + key (re-rolled within the genre's range, never repeating the last key),
dynamics-coupled rests, and lead-timbre drift. At the outro it SHALL enter a ~4.5s
**cheer gap**, fire `onSongEnd` (positional applause swell + the registered
`crowd.cheerNear` callback), then start a fresh song. `drum`/`forest_drum`/`second_line`
SHALL stay continuous (no songform). Each stage's genre SHALL be seeded
(origin 0,0 stays `jam`), with distance-ridden master gain cross-fades between stages
(`sound.js`, `ARCHITECTURE.md:268-269`).

#### Scenario: A song ends, the crowd cheers, a new song starts

- **WHEN** a stage song reaches its outro
- **THEN** it opens a cheer gap, fires `onSongEnd` (applause + `crowd.cheerNear`), then
  starts a fresh song in a new key

### Requirement: MIDI player with GM routing and trip-coupled FX

`midiPlayer.js` (the M-key player) SHALL route each parsed track to a synth pool by GM
program/percussion category (drum kit / bass / lead / pad), through an effect chain
(vibrato → autofilter → ping-pong delay → reverb + a parallel long reverb → an inline
AudioWorklet granular node → `midiGain`). The trip envelope SHALL swell the long reverb
+ granular at the climax. Tracks SHALL be individually mutable (`getTracks` /
`setTrackMute`) (`midiPlayer.js`, `ARCHITECTURE.md:270`).

#### Scenario: A track can be muted live

- **WHEN** `setTrackMute(i, true)` is called during playback
- **THEN** that track's voices go silent while the rest continue

### Requirement: Positional nature bed

The nature bed SHALL play birdsong (positional, time-of-day-gated), crickets + frogs
(panned toward the nearest forest/lake), and a deep-night owl, all through `natureBus`
with its own trip chain and volume fader. The Web Audio `AudioListener` SHALL be fed the
camera position + forward each frame for spatial pan (`sound.js:189-201`,
`ARCHITECTURE.md:271-272`).

#### Scenario: Crickets pan toward the forest

- **WHEN** the player is near a forest at night
- **THEN** cricket/frog voices pan toward it and the owl is audible
