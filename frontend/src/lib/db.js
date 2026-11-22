// IndexedDB storage for offline-first operation (via the tiny `idb` wrapper).
// Stores: outbox (queued requests/SOS), media (recorded blobs), cache (last API responses), meta (auth, sync state).
import { openDB } from 'idb'

const dbPromise = openDB('disasterlink', 1, {
  upgrade(db) {
    const outbox = db.createObjectStore('outbox', { keyPath: 'client_id' })
    outbox.createIndex('status', 'status')
    const media = db.createObjectStore('media', { keyPath: 'client_id' })
    media.createIndex('owner', 'owner_client_id')
    db.createObjectStore('cache', { keyPath: 'key' })
    db.createObjectStore('meta', { keyPath: 'key' })
  },
})

export const uuid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  }))

export async function outboxAll() { return (await dbPromise).getAll('outbox') }
export async function outboxGet(id) { return (await dbPromise).get('outbox', id) }
export async function outboxPut(item) { return (await dbPromise).put('outbox', item) }
export async function outboxDelete(id) { return (await dbPromise).delete('outbox', id) }

export async function mediaAll() { return (await dbPromise).getAll('media') }
export async function mediaPut(item) { return (await dbPromise).put('media', item) }
export async function mediaByOwner(ownerClientId) {
  return (await dbPromise).getAllFromIndex('media', 'owner', ownerClientId)
}
export async function mediaDelete(id) { return (await dbPromise).delete('media', id) }

export async function cacheSet(key, data) { return (await dbPromise).put('cache', { key, data, saved_at: new Date().toISOString() }) }
export async function cacheGet(key) { return (await dbPromise).get('cache', key) }
export async function cacheAll() { return (await dbPromise).getAll('cache') }
export async function cacheClear() { return (await dbPromise).clear('cache') }

export async function metaGet(key) { const r = await (await dbPromise).get('meta', key); return r ? r.value : undefined }
export async function metaSet(key, value) { return (await dbPromise).put('meta', { key, value }) }
export async function metaDel(key) { return (await dbPromise).delete('meta', key) }

export async function deviceId() {
  let id = await metaGet('device_id')
  if (!id) { id = uuid(); await metaSet('device_id', id) }
  return id
}
