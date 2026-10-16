# Gate C: ten bubble looks

All eleven upgrade types now unlock through their intended game paths. The ten new looks are ready for Gary's grouped visual approval before the charm and leaderboard work begins. These captures use the Low tier with the sandbox's normal Noon and Midnight lighting. Each stream was placed at the sandbox's 12 m horizontal, 6.5 m high chase-camera distance.

## Full lineup

[Noon lineup](lineup-noon-low.png) · [Midnight lineup](lineup-midnight-low.png). The row runs Heart, Music, Ember, Firefly, Rainbow, Sparkler, Lantern, Smile, Confetti, Mushroom, Brass between two ordinary bubbles.

## Group 1: Music, Ember, Firefly, Rainbow

| Type | Noon shell | Midnight shell | Noon chase stream | Midnight chase stream |
| --- | --- | --- | --- | --- |
| Music | [Still](music-still-noon-low.png) | [Still](music-still-midnight-low.png) | [Stream](music-stream-noon-low.png) | [Stream](music-stream-midnight-low.png) |
| Ember | [Still](ember-still-noon-low.png) | [Still](ember-still-midnight-low.png) | [Stream](ember-stream-noon-low.png) | [Stream](ember-stream-midnight-low.png) |
| Firefly | [Still](firefly-still-noon-low.png) | [Still](firefly-still-midnight-low.png) | [Stream](firefly-stream-noon-low.png) | [Stream](firefly-stream-midnight-low.png) |
| Rainbow | [Still](rainbow-still-noon-low.png) | [Still](rainbow-still-midnight-low.png) | [Stream](rainbow-stream-noon-low.png) | [Stream](rainbow-stream-midnight-low.png) |

Music pulses; Ember carries a warm coal and flecks; Firefly carries a wandering green light; Rainbow moves through the full spectrum. [Music](http://127.0.0.1:8765/sandbox.html?entity=bubbles_special&type=music&view=still&perf=low&mute=1), [Ember](http://127.0.0.1:8765/sandbox.html?entity=bubbles_special&type=ember&view=still&perf=low&mute=1), [Firefly](http://127.0.0.1:8765/sandbox.html?entity=bubbles_special&type=firefly&view=still&perf=low&mute=1), and [Rainbow](http://127.0.0.1:8765/sandbox.html?entity=bubbles_special&type=rainbow&view=still&perf=low&mute=1) can be watched in motion on the running local server.

## Group 2: Sparkler, Lantern, Smile, Confetti

| Type | Noon shell | Midnight shell | Noon chase stream | Midnight chase stream |
| --- | --- | --- | --- | --- |
| Sparkler | [Still](sparkler-still-noon-low.png) | [Still](sparkler-still-midnight-low.png) | [Stream](sparkler-stream-noon-low.png) | [Stream](sparkler-stream-midnight-low.png) |
| Lantern | [Still](lantern-still-noon-low.png) | [Still](lantern-still-midnight-low.png) | [Stream](lantern-stream-noon-low.png) | [Stream](lantern-stream-midnight-low.png) |
| Smile | [Still](smile-still-noon-low.png) | [Still](smile-still-midnight-low.png) | [Stream](smile-stream-noon-low.png) | [Stream](smile-stream-midnight-low.png) |
| Confetti | [Still](confetti-still-noon-low.png) | [Still](confetti-still-midnight-low.png) | [Stream](confetti-stream-noon-low.png) | [Stream](confetti-stream-midnight-low.png) |

Sparkler has a white-gold inner star, and Lantern has a warm paper core. Smile is intentionally steady yellow, while Confetti changes pastel tint per bubble. [Sparkler](http://127.0.0.1:8765/sandbox.html?entity=bubbles_special&type=sparkler&view=still&perf=low&mute=1), [Lantern](http://127.0.0.1:8765/sandbox.html?entity=bubbles_special&type=lantern&view=still&perf=low&mute=1), [Smile](http://127.0.0.1:8765/sandbox.html?entity=bubbles_special&type=smile&view=still&perf=low&mute=1), and [Confetti](http://127.0.0.1:8765/sandbox.html?entity=bubbles_special&type=confetti&view=still&perf=low&mute=1) have live previews.

## Group 3: Mushroom, Brass

| Type | Noon shell | Midnight shell | Noon chase stream | Midnight chase stream |
| --- | --- | --- | --- | --- |
| Mushroom | [Still](mushroom-still-noon-low.png) | [Still](mushroom-still-midnight-low.png) | [Stream](mushroom-stream-noon-low.png) | [Stream](mushroom-stream-midnight-low.png) |
| Brass | [Still](brass-still-noon-low.png) | [Still](brass-still-midnight-low.png) | [Stream](brass-stream-noon-low.png) | [Stream](brass-stream-midnight-low.png) |

Mushroom drifts slowly between purple and green, and Brass sweeps a gold glint across the shell every 1.5 seconds. [These two Brass frames](brass-glint-phase-2-low.png) and [the Midnight still](brass-still-midnight-low.png) show the highlight moving across the same shell. [Mushroom](http://127.0.0.1:8765/sandbox.html?entity=bubbles_special&type=mushroom&view=still&perf=low&mute=1) and [Brass](http://127.0.0.1:8765/sandbox.html?entity=bubbles_special&type=brass&view=still&perf=low&mute=1) have live previews.

## Looks to judge closely

- At the full chase distance, individual bubbles are small. The still views make the Ember, Firefly, Sparkler, and Lantern interiors clear, while the stream views show their practical size. Decide whether the accents are strong enough while driving.
- Rainbow and Mushroom can pass through similar green hues in a still frame. Their moving patterns differ: Rainbow cycles through the full spectrum rapidly, while Mushroom moves between two colors slowly. Compare those two live previews before approving their distinction.
- Music relies on its pulse and Smile on its steady yellow color. They are the weakest static identifiers in the lineup. If they need stronger silhouettes or inner accents, this is the point to change them.

## Game-path verification

| Reward | What happened in the running game |
| --- | --- |
| Music | Three distinct stage-front positions incremented the count to three and unlocked it. Returning to the first did not increment it. |
| Ember | The same bench ring stayed locked at Noon and unlocked at Midnight. |
| Firefly | An inland position stayed locked at Midnight; a real shore marker unlocked it. |
| Rainbow | Eight distinct hub cores were visited through normal steering and throttle after Start. The eighth unlocked it. The direct route took **73.15 seconds and 1,018 m** with destinations known in advance, so player discovery will take longer. [Raw route state](rainbow-drive.json) and [game frame](rainbow-drive-earned-low.png). |
| Sparkler | The armed fireworks director fired its finale, unlocked Sparkler once, and did not repeat the event that night. |
| Lantern | A moving parade collider awarded it. |
| Smile | Debug-added score left lifetime smiles at 995; five pickups through the actual Smile system advanced it to 1,000 and awarded it. |
| Confetti | A day wrap in Just Cruisin' stayed locked. A Festival Run crossing from day one to day two awarded it. |
| Mushroom | Both manual trip modes stayed locked. A real wook approached the parked cart, offered a trip, and acceptance awarded it. The player menu hid the card before earn and showed its earned copy afterward. The active trip set the ×3 spawn context. |
| Brass | A moving band collider awarded it. |

A `window.gtag` stub recorded one `bubble_unlocked` event for each newly earned type, with the correct `type`, `mode`, and `unlocked_count`; the debug and repeat paths sent none in the checks above. The Low-tier game completed the full Rainbow drive with no uncaught browser errors. [Full `npm run check` output](npm-run-check.txt) passed with the bubble and wook edits present.

Gary's decision here is the grouped look approval. Checkpoint 5 begins after Gate C is approved.
