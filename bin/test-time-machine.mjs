#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { IDBFactory } from 'fake-indexeddb';
import { memoryStorage, installArchivePolicy } from '../tooling/time-machine/runtime.mjs';
import { prepareHTML, publicFiles, resolveCommit } from '../tooling/time-machine/build.mjs';
import { createMapStorage, EpochChanged } from '../src/festivalMap/storage.js';
import { emptyBlock } from '../src/festivalMap/model.js';
import { versionedTag, analyticsURL } from '../tooling/time-machine/analytics.mjs';

const storage = memoryStorage();
storage.setItem('name', 'Zerble'); storage.upgrade = 7;
assert.equal(storage.getItem('upgrade'), '7');
assert.equal(storage.length, 2); assert.deepEqual(Object.keys(storage), ['name', 'upgrade']);
delete storage.name; assert.equal(storage.getItem('name'), null);
storage.setItem('__proto__', 'safe'); assert.equal(storage.getItem('__proto__'), 'safe');
storage.clear(); assert.equal(storage.length, 0); assert.equal(storage.key(0), null);
assert.equal(memoryStorage().getItem('upgrade'), null);

const native = { localStorage: memoryStorage(), indexedDB: new IDBFactory() };
native.localStorage.setItem('live-save', 'untouched');
const requests = [];
function realm() {
  return { location: { hostname: 'localhost', origin: 'http://localhost', href: 'http://localhost/snapshot/' },
    localStorage: native.localStorage, sessionStorage: native.localStorage, indexedDB: native.indexedDB,
    navigator: { storage: {} }, fetch: async (...args) => { requests.push(args); return 'asset'; } };
}
const one = realm(), two = realm(); installArchivePolicy(one); installArchivePolicy(two);
assert.equal(one.localStorage.getItem('live-save'), null);
one.localStorage.setItem('live-save', 'archive'); one.sessionStorage.setItem('resume', 'archive');
assert.equal(native.localStorage.getItem('live-save'), 'untouched');
assert.equal(two.localStorage.getItem('live-save'), null);
assert.equal(two.sessionStorage.getItem('resume'), null);
assert.notEqual(one.indexedDB, native.indexedDB); assert.notEqual(one.indexedDB, two.indexedDB);
assert.throws(() => { one.localStorage = native.localStorage; }, TypeError);
assert.equal(await one.fetch('./assets/music.mid'), 'asset');
await assert.rejects(one.fetch('https://zerble-leaderboard.garbonzo-net.workers.dev/board'));
await assert.rejects(one.fetch('./score', { method: 'POST' }));
await assert.rejects(one.fetch(new Request('http://localhost/score', { method: 'POST' })));
assert.equal(requests.length, 1); assert.equal(one.navigator.sendBeacon('/score', 'data'), false);
assert.equal(one.navigator.serviceWorker, undefined); assert.equal(one.caches, undefined);
assert.throws(() => installArchivePolicy({ location: { hostname: 'game.zerble.net' } }), /disabled/);
assert.throws(() => installArchivePolicy({ location: { hostname: 'garyreckard.github.io' } }), /disabled/);

// Exercise the real map's atomic merge/reset/stale-write contract, not a mock API.
const a = createMapStorage(one.indexedDB), b = createMapStorage(one.indexedDB), fresh = createMapStorage(two.indexedDB);
try {
  const epoch = await a.epoch('festival'), x = emptyBlock(), y = emptyBlock();
  x.bits[0] = 1; y.bits[0] = 128;
  await Promise.all([a.write('festival', '0,0', x, epoch), b.write('festival', '0,0', y, epoch)]);
  assert.equal((await a.read('festival', '0,0', epoch)).bits[0], 129);
  assert.equal((await fresh.read('festival', '0,0', 0)).bits[0], 0);
  const next = await a.reset('festival'); assert.equal(next, epoch + 1);
  await assert.rejects(b.write('festival', '0,0', x, epoch), EpochChanged);
  assert.equal((await a.read('festival', '0,0', next)).bits[0], 0);
  assert.deepEqual(await native.indexedDB.databases(), []);
} finally { a.close(); b.close(); fresh.close(); }

const fixture = '<html><head><script>window.gtag("config");</script><script type="importmap">{}</script><script>const mods=[];document.createElement("script");</script></head><body><script>localStorage.setItem("early", "yes");</script></body></html>';
const prepared = prepareHTML(fixture, 'POLICY();');
assert.ok(prepared.html.indexOf('POLICY();') < prepared.html.indexOf('localStorage.setItem'));
assert.ok(prepared.html.indexOf('charset="utf-8"') < 1024);
assert.doesNotMatch(prepared.html, /gtag\("config"\)|type="importmap"/);
assert.match(prepared.html, /if\(globalThis.__zerbleArchive\?\.ready\)/);
assert.equal(prepared.entry, './src/main.js');
assert.throws(() => prepareHTML('<head></head><script src="https://example.com/unknown.js"></script>', ''), /Unsupported/);
assert.throws(() => resolveCommit('--all'), /commit hash/);
assert.throws(() => resolveCommit('main~1'), /commit hash/);
const tree = '100644 blob abc\tindex.html\0' + '100644 blob abc\tsrc/main.js\0' + '100644 blob abc\t.env\0' + '100644 blob abc\tdocs/private.md\0';
assert.deepEqual(publicFiles(tree), ['index.html','src/main.js']);
assert.throws(() => publicFiles('120000 blob abc\tassets/key.png\0'), /non-regular/);
assert.throws(() => publicFiles('120000 blob abc\tindex.html\0'), /non-regular/);
const analytics = versionedTag({ game_version:'abc123',game_channel:'archive' });
analytics.gtag('event','game_start',{game_version:'wrong',smiles:1});
assert.deepEqual(analytics.layer[0][2],{game_version:'abc123',game_channel:'archive',smiles:1});
assert.equal(analyticsURL('https://region1.google-analytics.com/g/collect'),true);
assert.equal(analyticsURL('https://google-analytics.com.evil.example/g/collect'),false);
assert.equal(analyticsURL('https://www.google-analytics.com/other'),false);
console.log('Time Machine: memory storage, native-save protection, real map transactions, network policy, first-script ordering and extraction checks passed.');
