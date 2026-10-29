#!/usr/bin/env node
import assert from 'node:assert/strict';
import { build } from 'vite';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { captureMiddleware, MAX_CAPTURE_BYTES } from '../tooling/capture.mjs';
import config, { pages } from '../vite.config.mjs';

const temporary = await mkdtemp(join(tmpdir(), 'zerble-toolchain-'));
try {
  const result = await build({ ...config, configFile: false, logLevel: 'silent',
    build: { ...config.build, write: false, sourcemap: false } });
  const output = result.output;
  const chunks = new Map(output.filter(item => item.type === 'chunk').map(item => [item.fileName, item]));
  for (const page of pages) {
    const html = output.find(item => item.fileName === page)?.source;
    assert.ok(html, `Missing built page: ${page}`);
    assert.doesNotMatch(html, /importmap|const (mods|models|wg) =/);
    for (const [, script] of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
      if (script.startsWith('http')) continue;
      assert.ok(chunks.has(script.replace(/^\.\//, '')), `${page}: missing ${script}`);
    }
    if (html.includes('rel="manifest"')) assert.match(html, /href="\.\/site.webmanifest"/);
  }
  const map = [...chunks.values()].find(chunk => chunk.facadeModuleId?.endsWith('/map-sandbox.html'));
  const visited = new Set();
  function walk(chunk) {
    if (visited.has(chunk.fileName)) return;
    visited.add(chunk.fileName);
    assert.ok(!Object.keys(chunk.modules).some(id => id.includes('/three/')), '2D map pulled in Three.js');
    for (const dependency of chunk.imports) walk(chunks.get(dependency));
  }
  assert.ok(map); walk(map);
  assert.ok([...chunks.values()].some(chunk => Object.keys(chunk.modules).some(id => id.endsWith('/src/threeShim.js'))));

  // A newly imported file needs no registry; a missing export must fail the
  // build before agents spend time launching a browser.
  await writeFile(join(temporary, 'new-module.js'), 'export const answer = 42;');
  await writeFile(join(temporary, 'entry.js'), "import {answer} from './new-module.js'; console.log(answer);");
  const fixture = { configFile: false, root: temporary, logLevel: 'silent',
    build: { write: false, rollupOptions: { input: join(temporary, 'entry.js') } } };
  await build(fixture);
  await writeFile(join(temporary, 'new-module.js'), 'export const other = 42;');
  await assert.rejects(() => build(fixture), /answer/);

  const capture = captureMiddleware(temporary);
  async function request({ path = '/__capture/test', method = 'POST', body = '{}', address = '127.0.0.1', headers = {} } = {}) {
    const req = Readable.from([Buffer.from(body)]);
    Object.assign(req, { url: path, method, headers: { host: 'localhost:8765', ...headers }, socket: { remoteAddress: address } });
    const res = { statusCode: 0, end(body) { this.body = body; this.writableEnded = true; } };
    await capture(req, res, () => { res.statusCode = 404; });
    return res;
  }
  assert.equal((await request()).statusCode, 200);
  assert.equal(await readFile(join(temporary, '.claude/captures/test.json'), 'utf8'), '{}');
  assert.equal((await request({ address: '192.168.1.2' })).statusCode, 403);
  assert.equal((await request({ headers: { origin: 'https://example.com' } })).statusCode, 403);
  assert.equal((await request({ headers: { origin: 'http://localhost:8765' } })).statusCode, 200);
  assert.equal((await request({ method: 'GET' })).statusCode, 405);
  assert.equal((await request({ body: '' })).statusCode, 413);
  assert.equal((await request({ headers: { 'content-length': MAX_CAPTURE_BYTES + 1 } })).statusCode, 413);
  assert.equal((await request({ path: '/__capture/bad.name' })).statusCode, 400);
  assert.equal((await request({ path: '/__capture/%2e%2e%2fsecret' })).statusCode, 400);
  assert.equal((await request({ path: '/index.html' })).statusCode, 404);

  // Execute the actual bundled shim in isolation, rather than checking source
  // strings, to catch alias recursion and preserve the entity-viewer exception.
  const shimResult = await build({ ...config, configFile: false, plugins: [], logLevel: 'silent',
    build: { write: false, minify: false, rollupOptions: {
      input: resolve('src/threeShim.js'), preserveEntrySignatures: 'strict' } } });
  const shimCode = shimResult.output.find(item => item.type === 'chunk').code;
  await mkdir(join(temporary, 'shim'));
  globalThis.window = { innerWidth: 1280, innerHeight: 800 };
  for (const [tier, pathname, expected] of [
    ['low', '/index.html', 'MeshLambertMaterial'],
    ['low', '/sandbox.html', 'MeshStandardMaterial'],
    ['low', '/hub-sandbox.html', 'MeshLambertMaterial'],
    ['low', '/terrain-sandbox.html', 'MeshLambertMaterial'],
    ['mid', '/index.html', 'MeshStandardMaterial'],
  ]) {
    globalThis.location = { search: `?perf=${tier}`, pathname };
    const file = join(temporary, 'shim', `${tier}-${pathname.slice(1)}.mjs`);
    await writeFile(file, shimCode);
    // Each fixture is deliberately a fresh module graph.
    delete globalThis.window.__THREE__;
    const three = await import(file);
    assert.equal(new three.MeshStandardMaterial().type, expected, `${tier} ${pathname}`);
  }
  delete globalThis.location;
  delete globalThis.window;
  console.log('PASS build: six entries, 2D isolation, automatic module discovery, missing-export failure, real Three.js aliases/material tiers, capture writes and access boundaries.');
} finally {
  await rm(temporary, { recursive: true, force: true });
}
