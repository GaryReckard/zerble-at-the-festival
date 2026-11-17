## Context

The live game deploys dist through GitHub Actions. Historical versions span raw ES modules and Vite. The zerble.net timeline supplies a dashed road, alternating cards and a scroll-following SVG cart.

## Goals / Non-Goals

Goals: preserve playable historical gameplay, curate dated milestones, isolate the live origin, keep archives ephemeral, and publish tags/manual commits without executing historical scripts.

Non-goals: migrating live saves, durable archive progress, modifying zerble.net, and publishing private repository documents or sandboxes.

## Decisions

- Use two Pages repositories and custom hostnames. The archive root is its timeline. Build/publish archives independently, with one serialized writer to the archive branch.
- Extract only index.html, source modules, CSS and public assets from a resolved commit. Reject symlinks, path traversal, unknown executable entry patterns and unsupported external modules. Use pinned current dependencies and aliases preserving historical threeShim when present.
- Remove historical importmap/tag injectors, retain title/boot recovery scripts, and install a synchronous classic policy before every historical executable script. Disable originally enabled start buttons until the historical module has loaded. Build with Vite without loading historical configuration or lifecycle scripts.
- Replace localStorage, sessionStorage and cookies with page-local memory, IndexedDB with a new fake-indexeddb factory, and disable CacheStorage, service worker registration and persistent filesystem access. Reload on bfcache restore. Block leaderboard traffic and network writes except the explicitly authorized Analytics collection endpoint. Attach game_version/game_channel before GA configuration and to all historical events; preserve the original start gesture's synchronous audio chain.
- Render a static timeline from reviewed milestone metadata and published manifests. Identify immutable snapshot directories by full source SHA; date labels are presentation metadata. Re-publishing identical output is idempotent; different content at the same URL is rejected.
- Store all archive output in one Pages repository. The source repository owns a reusable trusted publishing workflow, while the archive repository runs it using its own token. The archive workflow fetches tools from a reviewed source ref and does not expose deploy credentials to historical code. Generated snapshots never contain a second unprotected HTML entry.

## Risks / Trade-offs

- Historical compatibility differs: build and run early/recent representatives before bulk publication; record qualification limits honestly.
- In-memory IndexedDB approximates native behavior: test map transactions/reset and two isolated factories. Every reload creates a fresh factory.
- Old network code could submit scores: replace its tag injector with trusted versioned analytics, enforce a restrictive connect policy and block leaderboard endpoints before boot.
- Existing game timing, RNG, shaders, geometry and audio gesture code remain historical. No new render costs are added to live gameplay.
- Archive repository files are public; allowlist extraction and build output only. Serialized publishing always reads the latest archive tree and preserves existing versions.

## Migration Plan

No live save transfer was requested. Configure Pages hostnames before asking Gary for CNAME records, then enforce HTTPS once certificates are ready. Maintain a working GitHub Pages fallback until DNS resolves.

## Open Questions

None; public DNS/HTTPS and physical iOS validation remain external installation/acceptance steps.
