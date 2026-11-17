## Architect's Position

### Priority Sequence

1. Establish a trusted preparation pipeline separate from live gameplay. Extract public game files and preserve each commit's shim selection; current resolution deliberately routes through the local shim (`ARCHITECTURE.md:17-18`, `vite.config.mjs:20-25`). Historical configurations and package scripts must never run.
2. Install the memory-storage policy synchronously before every historical executable script, then prove a May build and a recent IndexedDB-using build. A module entry alone does not establish this order relative to classic inline scripts.
3. Define immutable output identity and acceptance metadata before bulk publication, then add timeline rendering, tag discovery and one serialized archive publisher.

### Structural Risks Identified

- **Bootstrap ordering:** Current HTML has a classic inline analytics injector at `index.html:8-31`, before its module entry at `index.html:68`. Merely awaiting storage inside an archive module cannot protect earlier inline code. Use an explicitly first, parser-blocking classic bootstrap containing the bundled memory policy, or move all historical execution behind a single ordered entry; assert this ordering on final output.
- **Source hash is not complete build identity:** The design binds URLs only to source SHA while separately evolving adapter code and pinned build dependencies (`design.md`, Decisions). A source SHA alone cannot identify those derived bytes. Include an adapter/build fingerprint in the immutable package identity or a subordinate revision path, and retain both historical source SHA and toolchain revision in its manifest. Otherwise a corrected adapter cannot safely republish a previously archived commit.
- **Storage compatibility is an adapter contract:** The real map store waits on native-shaped transaction completion, reads then unions writes, and rejects stale reset epochs (`src/festivalMap/storage.js:8-35`; `ARCHITECTURE.md:795`). Test those existing operations against a fresh fake factory, including abort/error paths and reset, rather than only testing basic open/put/get. Keep this outside `src/festivalMap/`; do not modify historical map semantics to accommodate the adapter.
- **Publication boundary:** The existing live workflow uploads its entire `dist` (`.github/workflows/pages.yml:29-36`). Archive publication must have its own token scope, checkout, output root and concurrency group. No extraction of `.github`, package scripts, configuration or extra HTML; no copying the repository root. Check the final prepared tree, not just the extraction allowlist.
- **Historical fidelity and qualification:** Current Vite policy supersedes obsolete no-build statements in OpenSpec context (`.claude/rules/no-build.md:3-8`, `ARCHITECTURE.md:17-18`). Rebuilding with today's toolchain is acceptable archive adaptation, but a successful bundle is not a historical gameplay acceptance result. Record source/toolchain/adapter identity and distinguish build, browser boot and physical iOS audio status. Keep the gesture chain unchanged (`AGENTS.md`, constraint 3).
- **No engine lifecycle changes are warranted:** Timeline/cart animation belongs to the archive page and must stop when hidden or removed. Archive compatibility must not alter RNG, tier materials, chunks, forests, lakes or pooled resource ownership. Each historical renderer remains owned by its page lifetime; links should navigate rather than retaining hidden running games.

### Verdict

- **Verdict**: Proceed with mitigations
- **Key Concern**: Storage policy must precede all historical execution, and immutable identity must include the adapter and toolchain as well as source SHA.
- **Recommendation**: Proceed with a versioned archive adapter, first-script ordering assertions, real map-store contract tests and two representative real-game boots before bulk publication. The separate archive origin plus ephemeral state is a clean boundary; no engine refactor is needed.
