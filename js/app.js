// LeseWelt – Einstieg: Navigation, Routen, Updates, Teilen
import { loadSettings } from './settings.js';
import { dueWords, onVocab } from './vocabStore.js';
import { importFile, importText } from './importer.js';
import { initUpdates, announceUpdate } from './update.js';
import { toast, logError } from './util.js';

const view = document.getElementById('view');
let cleanup = null;
let routeToken = 0;

async function route() {
  const my = ++routeToken;
  const hash = location.hash || '#/library';
  const [, name, ...rest] = hash.split('/');
  const arg = rest[0];
  try { await cleanup?.(); } catch { /* ignorieren */ }
  cleanup = null;
  document.body.dataset.route = name || 'library';
  const navRoute = name === 'train' ? 'vocab' : name === 'stats' ? 'library' : (name || 'library');
  document.querySelectorAll('.app-nav a').forEach((a) => a.setAttribute('aria-current', a.dataset.route === navRoute ? 'page' : 'false'));
  let fn;
  switch (name) {
    case 'read': { const m = await import('./reader.js'); fn = (v) => m.openReader(arg, v, { listen: rest[1] === 'listen' }); break; }
    case 'vocab': fn = (await import('./vocab.js')).openVocab; break;
    case 'train': { const m = await import('./train.js'); fn = (v) => m.openTrain(v, arg); break; }
    case 'discover': { const m = await import('./catalog.js'); fn = (v) => m.openCatalog(v, arg, rest.slice(1).join('/')); break; }
    case 'stats': fn = (await import('./stats.js')).openStats; break;
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

// Text, der aus einer anderen App geteilt wurde (Android: Teilen -> LeseWelt)
async function handleShare() {
  const p = new URLSearchParams(location.search);
  if (!p.has('text') && !p.has('url') && !p.has('title')) return;
  const text = [p.get('text'), p.get('url')].filter(Boolean).join('\n\n').trim();
  const title = (p.get('title') || '').trim();
  history.replaceState(null, '', location.pathname + (location.hash || '#/library'));
  if (text.length < 3) return;
  try {
    const book = await importText(text, title || 'Geteilter Text');
    location.hash = `#/read/${book.id}`;
  } catch (e) {
    toast(e.message, { type: 'error' });
  }
}

async function start() {
  await loadSettings();
  window.addEventListener('hashchange', route);
  await handleShare();
  await route();
  updateBadge();
  onVocab(updateBadge);
  announceUpdate();

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

  initUpdates();
}

// Unerwartete Fehler für 'Hilfe & Diagnose' merken
window.addEventListener('error', (e) => logError('Fehler', e.error || e.message));
window.addEventListener('unhandledrejection', (e) => logError('Fehler (async)', e.reason));

window.addEventListener('offline', () => toast('Offline – bereits übersetzte Wörter funktionieren weiter.'));
window.addEventListener('online', () => toast('Wieder online ✓'));

start();
