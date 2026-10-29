#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createServer, preview } from 'vite';
import { readFile, unlink } from 'node:fs/promises';
import { pages } from '../vite.config.mjs';

// Optional local integration check (also run in CI). Every owned server closes
// in finally, and every request has a deadline. Build dist before running.
for (const production of [false, true]) {
  const basePath = production ? '/zerble-at-the-festival/' : '/';
  const options = { base: basePath, logLevel: 'silent',
    server: { port: 0 }, preview: { port: 0 } };
  const server = production ? await preview(options) : await createServer(options);
  const name = `toolchain-http-${process.pid}`;
  try {
    if (!production) await server.listen();
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    const base = origin + basePath;
    const get = async url => {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      assert.equal(response.status, 200, url);
      return response;
    };
    for (const page of pages) {
      const html = await (await get(base + page)).text();
      for (const tag of html.matchAll(/<(?:script|link|img)\b[^>]*>/g)) {
        const resource = /(?:src|href)="([^"]+)"/.exec(tag[0])?.[1];
        if (!resource || /^(?:https?:|data:|#)/.test(resource)) continue;
        await get(new URL(resource, base + page));
      }
    }
    const manifest = await (await get(base + 'site.webmanifest')).json();
    for (const icon of manifest.icons) await get(new URL(icon.src, base));
    await get(base + 'assets/music/manifest.json');
    await get(base + 'assets/title-screen/bubble.webp');
    const capture = await fetch(`${origin}/__capture/${name}`, {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: '{"integration":true}', signal: AbortSignal.timeout(10000),
    });
    assert.equal(capture.status, 200);
    assert.deepEqual(JSON.parse(await readFile(`.claude/captures/${name}.json`, 'utf8')), { integration: true });
    const denied = await fetch(`${origin}/__capture/${name}`, {
      method: 'POST', headers: { Origin: 'https://example.com' }, body: '{}', signal: AbortSignal.timeout(10000),
    });
    assert.equal(denied.status, 403);
    const privatePath = await fetch(base + '.claude/serve_nocache.py', { signal: AbortSignal.timeout(10000) });
    assert.ok([403, 404].includes(privatePath.status));
    console.log(`PASS ${production ? 'production project subpath' : 'development'}: six pages, linked assets, manifest icons, stable runtime assets, capture writes and denied private/cross-origin access.`);
  } finally {
    if (production) await new Promise((resolve, reject) => {
      server.httpServer.close(error => error ? reject(error) : resolve());
      server.httpServer.closeAllConnections();
    });
    else await server.close();
    await unlink(`.claude/captures/${name}.json`).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}
