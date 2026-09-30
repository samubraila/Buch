// Service Worker: App offline verfügbar machen
const VERSION = 'lesewelt-v1';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/db.js',
  'js/util.js',
  'js/settings.js',
  'js/ui.js',
  'js/library.js',
  'js/importer.js',
  'js/samples.js',
  'js/reader.js',
  'js/popup.js',
  'js/translate.js',
  'js/dict.js',
  'js/speech.js',
  'js/vocab.js',
  'js/vocabStore.js',
  'js/settingsView.js',
  'js/parsers/sanitize.js',
  'js/parsers/epub.js',
  'js/parsers/fb2.js',
  'js/parsers/text.js',
  'js/parsers/pdf.js',
  'vendor/jszip.min.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== 'lesewelt-fonts').map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Schriften: Cache zuerst (ändern sich nie)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open('lesewelt-fonts').then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') c.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // Eigene Dateien: aus dem Netz (aktuell), sonst Cache – im Hintergrund aktualisieren
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.open(VERSION).then(async (c) => {
        const cached = await c.match(req, { ignoreSearch: true });
        const network = fetch(req).then((res) => {
          if (res.ok) c.put(req, res.clone());
          return res;
        }).catch(() => null);
        if (cached) {
          e.waitUntil(network);
          return cached;
        }
        const res = await network;
        return res || (req.mode === 'navigate' ? c.match('index.html') : new Response('', { status: 504 }));
      }),
    );
  }
  // Übersetzungs-APIs etc. laufen direkt übers Netz (Ergebnisse speichert die App selbst).
});
