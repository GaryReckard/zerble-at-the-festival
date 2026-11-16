# Empty bubble-juice feedback

Verified on Gary’s Mac on 2026-11-16 using the native in-app browser and the existing loopback Vite server. This is desktop functional/visual evidence, not an iPhone audio-unlock or device-performance acceptance claim.

## Behavior

The production HUD replaces the drained bar with an outlined jug and **OUT OF JUICE**, including an accessible refill instruction. Depletion starts two 650 ms attention pulses, then the amber edge remains steady. A fresh bubble-blast press may repeat the visual and dry sound after a 2.5-second cooldown; a held action, repeated keydown, or cooldown expiry alone cannot trigger another warning. `src/juiceFeedback.js` owns that policy without timers or allocations per frame.

The production cart uses one 24-segment, unlit status ring around the machine’s opening, cyan with juice and amber when empty. The dry wand stops, briefly tries to turn during the cough, and resumes normally after refill. Reduced Motion leaves the dry wheel still and suppresses the HUD pulse. No extra real light or shadow caster is added. The existing Festival Run continuous warning chug was removed; its countdown, limp mode, rescue and expiry rules remain. The countdown uses a small badge below the meter so it cannot collide with the empty label or the damage gauge.

The sound is the existing synthesized double cough with a quiet final relay click. All three oscillator voices have scheduled stops within 420 ms, and initialization remains inside the synchronous user gesture. The existing refill sound remains in use.

## Reproduce

- `/menu-preview.html?screen=juice&mute=1`: actual production DOM/HUD, Empty, Low, Refill, held action, countdown and Calm controls. **Hear dry cue** briefly unmutes only the session and remutes after 600 ms without changing volume preferences.
- `/sandbox.html?entity=zerble&perf=low&mute=1` or `perf=mid`: Empty machine, Refill machine, Empty-juice sputter, Noon and Midnight. Use `1` for the rear machine view.
- `/?perf=low&mute=1` or `perf=mid`: click a ready title plank, open the `/` command prompt, run `/juice 0`, close the prompt, then hold/release `G` and try again after 2.5 seconds. `/juice 1` restores juice. Festival Run keeps its countdown badge and clears it on refill.

## Evidence

- `node bin/test-juice-feedback`: real cart update, empty/refill indicator and wand behavior, calm dry retry, fresh/held/rapid action policy, resumed empty tank and bounded audio scheduling.
- `node bin/test-game-juice`: existing depletion-edge, effect pooling and accessibility checks.
- `npm run check` and `npm run build`: both passed for this change.
- Native ready-plank game boots on Low (Cruisin’) and Mid (Festival Run), depletion and refill through the debug UI, a deliberate `G` press switching the attention class, and no captured browser console errors.
- Production HUD fixture at 844×390: explicit label and countdown badge clear of the damage gauge. Portrait 390×844 correctly shows the existing landscape rotation prompt. Calm mode computes `animation-name: none`; normal mode reports two animation iterations.
- Production machine at Noon and Midnight on Low and Mid: amber dry ring and stalled wand; cyan ring/turning wand after refill. Sandbox counters are 243 draws / 29,989 triangles dry and 244 / 30,001 full, because refilling also restores the existing liquid mesh. The new ring itself is one mesh draw and 48 indexed triangles, with no shadow casting; these are geometry/counter checks, not device frame-time measurements.

## Captures

- [Real game, empty tank](game-low-empty.jpg)
- [Landscape HUD with countdown](hud-landscape-empty.jpg)
- [Low at noon](machine-low-noon.jpg) and [midnight](machine-low-midnight.jpg)
- [Mid at noon](machine-mid-noon.jpg) and [midnight](machine-mid-midnight.jpg)
- [Mid refilled](machine-mid-refilled.jpg)

## Limits and cleanup

Audio scheduling and browser initialization were checked, but the subjective sound mix still benefits from Gary listening. Physical iOS audio behavior and touch driving were not tested. No headless browser was launched, temporary browser tabs were closed and the temporary viewport was reset; the pre-existing user development server remains running.
