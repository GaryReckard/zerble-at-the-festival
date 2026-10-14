# Stage and road clearance, October 14, 2026

Seed 932033385 reports at (353.72,-112.55) and (473.56,122.51) reproduced roads crossing the nearest side-stage audience areas. The former placement checked only the stage center against roads and used perimeter samples only for water. Approach-road bearings did not account for the complete curved road or audience rectangle.

The planner now tests the deck circle and oriented audience rectangle against road polyline segments, expanded by the rendered road half-width plus one metre. Segment clipping catches crossings with both endpoints outside the floor. Candidate positions are quantized before testing; the deterministic search consumes no layout RNG and moves dependent stage content together. It searches up to 122m rather than 52m; if no road-safe anchor exists, it omits that hub's festival composition rather than using a road-overlapping fallback. The prior least-wet fallback remains only among road-safe candidates.

The reported stages move from (369,-103) to (340,-111) and from (456,131) to (491,130). Both retain their kind, scale, direction and identity. Existing seeded festival layouts can therefore change. Roads themselves do not change.

`node bin/test-stage-road-clearance` checks both old locations as failing controls, 3,194 independent audience-grid probes, 288 stage clearances across five seeds, rotated and through-crossing geometry cases, and query-order determinism. It is included in `npm run check`, which passed in full. The far-field seed 9876 fixture now expects the verified 194 visible roof candidates instead of 200; its independent demand-versus-kept equality checks remain unchanged.

`check.html?mute=1` builds both real hubs and checks registered light poles. `poles.json` records four poles each, with nearest-road distances of 17.42m and 20m respectively. Poles beyond the protected floor also have an independent endpoint guard. The two hub builds measured 47.4ms and 23.3ms in this local check, not a whole-world performance benchmark.

Muted hub previews were inspected at Noon and Midnight; the hub viewer does not draw roads, so geometric checks supply the road-clearance evidence. The full game booted seed 932033385 through the title button without captured console warnings/errors. The two screenshots document the retained stage compositions.
