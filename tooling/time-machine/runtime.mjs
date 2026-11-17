import * as memoryIDB from 'fake-indexeddb';
import { startArchiveAnalytics, analyticsURL } from './analytics.mjs';

// A fresh instance belongs to one document/worker, never to an origin or tab.
export function memoryStorage() {
  const values = new Map();
  const methods = {
    getItem: key => values.get(String(key)) ?? null,
    setItem: (key, value) => { values.set(String(key), String(value)); },
    removeItem: key => { values.delete(String(key)); },
    clear: () => values.clear(),
    key: index => [...values.keys()][Number(index) >>> 0] ?? null,
  };
  return new Proxy(Object.create(null), {
    get: (_, key) => key === 'length' ? values.size : key === Symbol.toStringTag ? 'Storage' :
      Object.hasOwn(methods, key) ? methods[key] : values.get(String(key)),
    set: (_, key, value) => { values.set(String(key), String(value)); return true; },
    deleteProperty: (_, key) => { values.delete(String(key)); return true; },
    ownKeys: () => [...values.keys()],
    has: (_, key) => values.has(String(key)) || Object.hasOwn(methods, key) || key === 'length',
    getOwnPropertyDescriptor: (_, key) => values.has(String(key))
      ? { configurable: true, enumerable: true, writable: true, value: values.get(String(key)) } : undefined,
    defineProperty: (_, key, desc) => {
      if (!('value' in desc)) return false;
      values.set(String(key), String(desc.value)); return true;
    },
  });
}

export function installArchivePolicy(scope = globalThis) {
  if (scope.__zerbleArchive?.ready) return;
  const lock = (object, key, value) => Object.defineProperty(object, key,
    { value, configurable: false, writable: false });
  const unsupported = () => { throw new DOMException('Unavailable in an archived session', 'NotSupportedError'); };
  const host = scope.location?.hostname;
  if (host && host !== 'game-archive.zerble.net' && host !== 'localhost' && host !== '127.0.0.1' && host !== '[::1]') {
    throw new Error('Open this snapshot at game-archive.zerble.net. Archived play is disabled on this hostname.');
  }
  lock(scope, 'localStorage', memoryStorage());
  lock(scope, 'sessionStorage', memoryStorage());
  lock(scope, 'indexedDB', new memoryIDB.IDBFactory());
  for (const [name, value] of Object.entries(memoryIDB)) {
    if (name.startsWith('IDB')) lock(scope, name, value);
  }
  lock(scope, 'caches', undefined);
  lock(scope, 'SharedWorker', undefined);
  // Analytics cookies, like game state, belong only to this document. Google
  // sees one play session, without reading/writing cookies on zerble.net.
  if (scope.document) {
    const cookies = new Map();
    Object.defineProperty(scope.document, 'cookie', { configurable: false,
      get: () => [...cookies].map(([key,value]) => `${key}=${value}`).join('; '),
      set(value) {
        const [pair] = String(value).split(';'), at = pair.indexOf('=');
        if (at < 0) return;
        const key = pair.slice(0,at).trim();
        if (/max-age\s*=\s*0(?:;|$)/i.test(value)) cookies.delete(key);
        else cookies.set(key, pair.slice(at+1));
      },
    });
  }
  const analytics = startArchiveAnalytics(scope, scope.__ZERBLE_ARCHIVE_CONTEXT__);

  const allowed = new Set([scope.location?.origin, 'https://esm.sh']);
  function permitted(input, method = 'GET') {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, scope.location?.href);
    return analytics && analyticsURL(url, scope.location?.href) ||
      /^(GET|HEAD)$/i.test(method) && (allowed.has(url.origin) || url.protocol === 'data:' || url.protocol === 'blob:');
  }
  if (scope.fetch) {
    const fetch = scope.fetch.bind(scope);
    lock(scope, 'fetch', (input, options) => permitted(input, options?.method || input?.method || 'GET')
      ? fetch(input, options) : Promise.reject(new TypeError('Archive network policy blocked this request')));
  }
  if (scope.XMLHttpRequest) {
    const open = scope.XMLHttpRequest.prototype.open;
    lock(scope.XMLHttpRequest.prototype, 'open', function(method, url, ...rest) {
      if (!permitted(url, method)) throw new DOMException('Archive network policy blocked this request', 'SecurityError');
      return open.call(this, method, url, ...rest);
    });
  }
  for (const name of ['WebSocket', 'EventSource']) if (name in scope) lock(scope, name, undefined);
  // The earliest games predate the mute URL option. Keep archive verification
  // silent without changing their normal audio path or saved volume settings.
  if (scope.location && new URL(scope.location.href).searchParams.get('mute') === '1') {
    for (const name of ['AudioContext', 'webkitAudioContext']) {
      const Native = scope[name];
      if (!Native) continue;
      lock(scope, name, class extends Native {
        constructor(...args) {
          super(...args);
          const destination = this.destination, silent = this.createGain();
          silent.gain.value = 0; silent.connect(destination);
          Object.defineProperty(this, 'destination', { value: silent });
        }
      });
    }
    if (scope.HTMLMediaElement) {
      const play = scope.HTMLMediaElement.prototype.play;
      lock(scope.HTMLMediaElement.prototype, 'play', function(...args) { this.muted = true; return play.apply(this, args); });
    }
  }
  if (scope.navigator) {
    const beacon = scope.navigator.sendBeacon?.bind(scope.navigator);
    lock(scope.navigator, 'sendBeacon', (url, body) => !!(analytics && beacon && analyticsURL(url, scope.location.href) && beacon(url, body)));
    lock(scope.navigator, 'serviceWorker', undefined);
    if (scope.navigator.storage) {
      lock(scope.navigator.storage, 'getDirectory', unsupported);
      lock(scope.navigator.storage, 'persist', async () => false);
    }
  }
  if (scope.document) {
    // A restored bfcache document must not revive a previous play's memory.
    scope.addEventListener('pageshow', event => { if (event.persisted) scope.location.reload(); });
    scope.document.addEventListener('DOMContentLoaded', () => {
      if (scope.__ZERBLE_ARCHIVE_CONTEXT__?.game_channel === 'timeline') return;
      const note = scope.document.createElement('aside');
      note.id = 'archive-session-note';
      note.innerHTML = '<a href="../">← Time Machine</a><span>Archived game · Reloading starts fresh</span><button type="button" aria-label="Hide archive notice">×</button>';
      note.querySelector('button').addEventListener('click', () => note.remove());
      scope.document.body.append(note);
      // These controls require a persistent setting + reload. Live controls work normally.
      const disableRestart = () => {
        for (const element of scope.document.querySelectorAll('.settings-restart .settings-apply, #set-quality button, #set-quality input, #set-context, #set-fancy')) {
          element.disabled = true; element.title = 'Restart settings are unavailable in fresh archive sessions.';
        }
        for (const text of scope.document.querySelectorAll('.settings-restart-text')) {
          const message = 'Archived sessions start fresh on reload; restart settings are unavailable.';
          if (text.textContent !== message) text.textContent = message;
        }
      };
      disableRestart();
      new MutationObserver(disableRestart).observe(scope.document.body, { childList: true, subtree: true });
      scope.document.addEventListener('click', event => {
        const button = event.target.closest?.('#start-btn, #mode-cruisin, #mode-festival');
        if (button && !button.disabled) scope.gtag('event', 'archive_play');
      }, { capture: true });
    }, { once: true });
  }
  lock(scope, '__zerbleArchive', Object.freeze({ ready: true, storage: 'memory', network: 'assets-and-versioned-analytics' }));
}
