# Development, build and deployment

The filename is retained so existing documentation links keep working. Gary
approved replacing the no-build workflow on October 29, 2026 to reduce agent
bookkeeping and catch module wiring failures before browser verification.

## Commands

Use Node.js 24 and `npm ci`, then `npm run dev` for local development.
Run `npm run check` and `npm run build` before completing code changes.
`npm run preview` serves the generated `dist/` on the same loopback port, 8765;
stop the development server first or pass `-- --port <port>`.

## Module maintenance

Ordinary imports discover dependencies. Do not add module inventories or
importmaps to HTML. The build covers the game, entity, hub, terrain and map
sandboxes, plus the Passport preview. New entry pages belong in
`vite.config.mjs`; new source modules only need their normal imports.

## Three.js

Three.js stays pinned to 0.160.0 in package.json and package-lock.json.
The exact `three` Vite alias resolves to `src/threeShim.js`; `three-actual`
resolves to the real library and `three/addons/` to matching addons. The shim
preserves the entity sandbox's raw Standard materials, while the game, hub
and terrain retain the Low-tier Lambert fallback. Never bypass this alias
as incidental cleanup. Upgrade Three.js separately and verify mobile behavior.

## Deployment and captures

GitHub Actions checks pull requests and checks/builds/deploys pushes to `main`.
Only `dist/` is published, and generated output is not committed. GitHub Pages
must use the GitHub Actions publishing source. JavaScript edits trigger full
reloads instead of replacing live game state.

Vite development and preview retain loopback capture uploads. Guided desktop
and phone playtests retain the Python server, which builds before serving
`dist/` and preserves token-protected LAN uploads and QR codes.
See [the toolchain guide](../../docs/toolchain.md) for details and verification.
