import { emptyBlock, mergeBlock } from './model.js';
const complete = tx => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = tx.onabort = () => reject(tx.error || new Error('Map storage transaction failed'));
});
const request = req => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
export class EpochChanged extends Error {}
// Read/union/write shares one transaction, including the reset epoch check.
export function createMapStorage(indexedDB = globalThis.indexedDB, name = 'zerble-festival-map') {
  let closed = false;
  const ready = new Promise((resolve, reject) => {
    if (!indexedDB) { reject(new Error('Storage unavailable')); return; }
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('records');
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Map storage blocked'));
    req.onsuccess = () => { const db = req.result; db.onversionchange = () => db.close(); if (closed) db.close(); resolve(db); };
  });
  ready.catch(() => {});
  async function transact(world, operation, key, value, epoch) {
    const db = await ready;
    if (closed) throw new Error('Map storage closed');
    const tx = db.transaction('records', operation === 'read' || operation === 'epoch' ? 'readonly' : 'readwrite');
    const done = complete(tx), store = tx.objectStore('records');
    // Attach a rejection handler before any asynchronous request can abort.
    done.catch(() => {});
    const meta = await request(store.get(`epoch:${world}`)) || 0;
    if (operation === 'epoch') { await done; return meta; }
    if (operation === 'reset') { store.put(meta + 1, `epoch:${world}`); await done; return meta + 1; }
    if (meta !== epoch) { await done; throw new EpochChanged('Discovery was reset in another tab'); }
    const recordKey = `${world}:${meta}:${key}`;
    const old = await request(store.get(recordKey));
    const result = operation === 'write' ? mergeBlock(old, value) : mergeBlock(old, emptyBlock());
    if (operation === 'write') store.put(result, recordKey);
    await done;
    return result;
  }
  return {
    epoch: world => transact(world, 'epoch'),
    read: (world, key, epoch) => transact(world, 'read', key, null, epoch),
    write: (world, key, value, epoch) => transact(world, 'write', key, value, epoch),
    reset: world => transact(world, 'reset'),
    close() { closed = true; ready.then(db => db.close()).catch(() => {}); },
  };
}
