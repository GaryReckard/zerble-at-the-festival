# Deliberation Briefing: Planned Road Surfaces

## Task
Review the draft road-surfaces change for Gary's request: give roads dirt texture similar to grass, introduce some somewhat wider asphalt/paved roads, and have the choices make sense in the festival map layout. Read proposal.md, design.md, specs/road-surfaces/spec.md and tasks.md in the containing change.

## Context
Repo: /Users/garyreckard/Sites/zerble-at-the-festival. OpenSpec change: openspec/changes/road-surfaces. Relevant sources: src/worldgen/roads.js, hearts.js, festival.js and constants.js; src/chunks.js; src/world.js grass texture; src/farField.js; map-sandbox.html. Read relevant ARCHITECTURE.md worldgen/render sections and applicable AGENTS/overrides.

The working tree contains extensive authorized, verified, uncommitted activity/stage corrections. Preserve them. A road underlay crease bug was just fixed using drapeTerrainTriangles in worldgen/terrain.js; verification/people/stage-audience.md records the exact seed and reproduction. Current task-owned server has been stopped, no standalone browser is running. Stage seating refinements are proceeding separately; this review owns only its markdown output.

## Constraints
No build step or THREE namespace mutation; any new source module must appear in all five importmaps. Preserve graph determinism, seeded call ordering, terrain surface conformity, lake/chunk/shared-resource ownership, scoring/frame barriers, synchronous iOS audio init and independent nightness. Verify Low/Mid, day/night and actual game boot; fixture counters are not device FPS measurements. No commits, push or deploy.

## Your Task
Read the council-protocol skill. Propose your priority sequence and risks from your domain, with verified code references. Review the actual draft without speculating about any other persona. Write a full isolated position with final Verdict, Key Concern and Recommendation to OUTPUT_PATH. Return a brief summary. Markdown only; do not modify game source, other positions, or completed people plans.
