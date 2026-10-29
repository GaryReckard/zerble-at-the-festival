## 1. Verification surface and pure contracts

- [x] 1.1 Build the lightweight map harness and discovery/projection regression fixtures before live integration.
- [x] 1.2 Implement sparse discovery, safe persistence transactions/reset fencing, and bounded local residency with tests.

## 2. Geography and rendering

- [x] 2.1 Implement bounded worker geography queries, cached drawing, fog clipping, and zoom cancellation.
- [x] 2.2 Implement compact/expanded live rendering, selection/boundary pins, accessible controls, reduced motion, and lifecycle states.

## 3. Live game integration

- [x] 3.1 Integrate actual discovered landmarks, nearby characters/pickups, explicit mission marker API, and settings persistence.
- [x] 3.2 Separate map/music actions across keyboard/touch and preserve driving through expansion, zoom, and close.

## 4. Verification and documentation

- [x] 4.1 Run meaningful regression tests, npm check/build, and real-game title/start/console smoke checks on Low/Medium/High.
- [x] 4.2 Capture Noon/Midnight and exercise mobile driving, repeated map transitions, zoom, storage recovery, and worker/cache diagnostics; record measured limits honestly.
- [x] 4.3 Update controls, architecture/debugging, CHANGELOG, ROADMAP and change acceptance records.

- [ ] 4.4 Complete representative-phone performance/physical touch, controlled total-frame comparisons, prolonged traversal/cache recycling, and confirmed BFCache/visibility restoration acceptance.
