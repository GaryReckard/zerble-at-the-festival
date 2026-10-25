## ADDED Requirements

### Requirement: Shared terrain inspection before integration

The map SHALL display bounded elevation/slope inspection, contours or equivalent readable height bands, pads, road grades and lake levels from the same surface used by the live game. The driving harness SHALL offer that shared world surface alongside its authored proof, with matching baseline motor/boost settings and contact/grade readouts. Macro map views MUST bound expensive detail planning and remain responsive through cold open, pan, zoom and seed changes.

#### Scenario: Map to driving comparison
- **WHEN** identical seed coordinates are inspected in the map, shared-surface driving harness and live game
- **THEN** heights and descriptor anchors agree, and zoomed-out map rendering does not generate thousands of off-scale detailed festival plans.
