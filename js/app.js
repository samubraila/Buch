// LeseWelt – Einstieg: Navigation, Routen, Service Worker
import { loadSettings } from './settings.js';
import { dueWords, onVocab } from './vocabStore.js';
import { importFile } from './importer.js';
import { toast } from './util.js';

const view = document.getElementById('view');
let cleanup = null;
let routeToken = 0;

async function route() {
  const my = ++routeToken;
  const hash = location.hash || '#/library';
  const [, name, arg] = hash.split('/');
  try { await cleanup?.(); } catch { /* ignorieren */ }
  cleanup = null;
  document.body.dataset.route = name || 'library';
  document.querySelectorAll('.app-nav a').forEach((a) => a.setAttribute('aria-current', a.dataset.route === name ? 'page' : 'false'));
  let fn;
  switch (name) {
    case 'read': fn = (await import('./reader.js')).openReader.bind(null, arg); break;
    case 'vocab': fn = (await import('./vocab.js')).openVocab; break;
    case 'train': fn = (await import('./vocab.js')).openTrain; break;
    case 'settings': fn = (await import('./settingsView.js')).openSettings; break;
    default: fn = (await import('./library.js')).openLibrary;
  }
  if (my !== routeToken) return;
  const c = await fn(view);
  if (my !== routeToken) { c?.(); return; }
  cleanup = c;
  if (name !== 'read') window.scrollTo(0, 0);
}

async function updateBadge() {
  const n = (await dueWords()).length;
  const b = document.querySelector('[data-badge="vocab"]');
  if (b) { b.textContent = n > 99 ? '99+' : String(n); b.hidden = !n; }
}

async function start() {
  await loadSettings();
  window.addEventListener('hashchange', route);
  await route();
  updateBadge();
  onVocab(updateBadge);

  // Dateien, die mit "Öffnen mit …" an die installierte App übergeben werden
  if ('launchQueue' in window) {
    window.launchQueue.setConsumer(async (params) => {
      for (const h of params.files || []) {
        try {
          const { book } = await importFile(await h.getFile());
          location.hash = `#/read/${book.id}`;
        } catch (e) { toast(e.message, { type: 'error' }); }
      }
    });
  }

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw?.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            toast('Neue Version verfügbar', { ms: 10000, action: { label: 'Neu laden', fn: () => location.reload() } });
          }
        });
      });
    }).catch(() => { /* ohne Offline-Modus weiter */ });
  }
}

window.addEventListener('offline', () => toast('Offline – bereits übersetzte Wörter funktionieren weiter.'));
window.addEventListener('online', () => toast('Wieder online ✓'));

start();
