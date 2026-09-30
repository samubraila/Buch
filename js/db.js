// Kleine Promise-Hülle um IndexedDB.
// Stores: books (Metadaten), contents (Kapitel + Bilder), vocab, cache, kv (Einstellungen),
//         marks (Lesezeichen + Markierungen), stats (Lesestatistik pro Tag)

const DB_NAME = 'lesewelt';
const DB_VERSION = 2;
let dbPromise;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('books')) db.createObjectStore('books', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('contents')) db.createObjectStore('contents', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('vocab')) {
        const v = db.createObjectStore('vocab', { keyPath: 'id' });
        v.createIndex('due', 'due');
      }
      if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('marks')) {
        const m = db.createObjectStore('marks', { keyPath: 'id' });
        m.createIndex('bookId', 'bookId');
      }
      if (!db.objectStoreNames.contains('stats')) db.createObjectStore('stats', { keyPath: 'day' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    // andere offene Tabs blockieren das Upgrade nicht dauerhaft
    req.onblocked = () => console.warn('Datenbank-Update wartet auf andere Tabs');
  });
  dbPromise.then((db) => { db.onversionchange = () => { db.close(); location.reload(); }; }).catch(() => {});
  return dbPromise;
}

function wrap(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store(name, mode = 'readonly') {
  const db = await open();
  return db.transaction(name, mode).objectStore(name);
}

export async function get(name, key) {
  return wrap((await store(name)).get(key));
}

export async function getAll(name) {
  return wrap((await store(name)).getAll());
}

export async function getAllByIndex(name, index, value) {
  return wrap((await store(name)).index(index).getAll(value));
}

export async function put(name, value) {
  return wrap((await store(name, 'readwrite')).put(value));
}

export async function del(name, key) {
  return wrap((await store(name, 'readwrite')).delete(key));
}

export async function clear(name) {
  return wrap((await store(name, 'readwrite')).clear());
}

// Einstellungen / kleine Werte
export async function kvGet(key, fallback) {
  try {
    const row = await get('kv', key);
    return row ? row.value : fallback;
  } catch {
    return fallback;
  }
}

export async function kvSet(key, value) {
  return put('kv', { key, value });
}

// Cache mit Ablaufzeit (Standard 60 Tage)
export async function cacheGet(key, maxAgeMs = 60 * 864e5) {
  try {
    const row = await get('cache', key);
    if (row && Date.now() - row.t < maxAgeMs) return row.value;
  } catch { /* ignorieren */ }
  return undefined;
}

export async function cacheSet(key, value) {
  try {
    await put('cache', { key, value, t: Date.now() });
  } catch { /* ignorieren */ }
}

// Persistenten Speicher anfragen, damit der Browser Bücher nicht löscht
export async function requestPersist() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch { /* ignorieren */ }
}
