## Pragmatist's Position

### Critical Path

The compatibility proof precedes bulk history preparation: compile one pre-Vite snapshot and one recent snapshot, boot each through its real start control, and prove that reload produces fresh storage without touching native sentinel data. The publishing implementation then consumes the same qualified builder. Timeline styling and DNS preparation can proceed independently, but neither establishes historical playability.

### Priority Sequence

1. Establish two-version compatibility and storage/network checks. Retain each historical entry's title/start flow, because current boot imports main dynamically and handles its own recovery (`src/boot.js:10-15`). Run the current map store against two independent in-memory factories so native transaction expectations are exercised instead of only testing fake-indexeddb in isolation (`src/festivalMap/storage.js:9-35`).
2. Publish an atomic two-version archive, then verify a second publication preserves both URLs. Serialize all writers to the archive site independently of source refs; the existing live workflow's per-ref lock is scoped to its current single-main publishing behavior (`.github/workflows/pages.yml:12-14,33-40`).
3. Add all curated milestones through that same builder and publisher. Record source SHA, declared dependency versions and adapter/tool revision in each manifest; reject dependency mismatches rather than silently substituting current packages. Current resolution deliberately binds a pinned Three.js and shim (`ARCHITECTURE.md:17-18`), which should remain explicit for archives too.
4. Finish the borrowed timeline UI, live link, DNS documentation and public-hostname acceptance. Timeline order changes must either reload the page or reinitialize the cart because it captures the final card once while attaching its track (`/Users/garyreckard/Sites/zerble.net/assets/js/timeline-cart.js:570-584`).

### Delivery Assessment

The memory-only decision removes the expensive persistence bridge, and reusing the real map storage against a fresh factory provides more value than inventing a second map implementation. Keep the archive policy and builder independently callable so fixture tests, local publication, and Actions all exercise the same behavior (`openspec/changes/time-machine/design.md:13-18`).

Do not let timeline polish block the first compatibility result. The existing road is ordinary CSS and the cart inserts itself into a `.timeline`, so there is no reason to port the whole zerble.net site or couple game boot to its site scripts (`/Users/garyreckard/Sites/zerble.net/assets/css/styles.css:322-335`; `/Users/garyreckard/Sites/zerble.net/assets/js/timeline-cart.js:570-578`).

Treat DNS and physical iOS acceptance as explicit external gates rather than claiming full release success from local builds. The current task record already separates public DNS/HTTPS from implementation (`openspec/changes/time-machine/tasks.md:23-24`). Keep browser verification bounded and sequential; the project's process rules make uncontrolled bulk WebGL checks an unacceptable shortcut (`docs/browser-verification.md:15-25`).

### Deferred / Park on ROADMAP

No required user capability should be deferred. Persistent archive saves, a separate origin per snapshot, screenshot generation for every chapter, and automatic prose generation are not needed to fulfill the approved design. They should not become prerequisites or follow-on commitments unless Gary asks for them. The approved scope already selects reviewed metadata, one archive hostname and fresh sessions (`openspec/changes/time-machine/design.md:7-18`).

### Incremental Delivery Plan

- **Slice 1:** An early and recent snapshot plus a minimal generated index, verified locally before publication. Exercise title readiness, real start click, session storage, map write/reset, reload freshness, blocked leaderboard traffic and unchanged native sentinel data.
- **Slice 2:** All curated snapshots, road timeline, tags and manual publishing, using the already exercised pipeline. Publish a second version set without replacing existing immutable paths, then check deep links and current-game linkage. Both slices remain part of this delivery; the split controls verification order rather than reducing scope.

### Verdict

- **Verdict:** Proceed with mitigations.
- **Key Concern:** A successful bundle is not evidence that historical entry behavior and in-memory storage work together.
- **Recommendation:** Make the two-version proof the reusable acceptance surface rather than repeatedly debugging twelve versions through bespoke steps.
