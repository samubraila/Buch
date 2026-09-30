// Automatische Updates: Service Worker registrieren, regelmäßig nach neuen Versionen fragen,
// neue Version aktivieren, sobald es den Leser nicht stört.
import { BUILD } from './version.js';
import { CHANGELOG, APP_VERSION } from './changelog.js';
import { el, toast } from './util.js';
import { openSheet } from './ui.js';

let registration = null;
let pendingReload = false;
let banner = null;

const CHECK_EVERY = 30 * 60 * 1000;

function isBusy() {
  const r = location.hash;
  return r.startsWith('#/read') || r.startsWith('#/train') || !!document.querySelector('dialog[open]');
}

function applyUpdate() {
  pendingReload = false;
  location.reload();
}

function showBanner() {
  if (banner) return;
  banner = el('button', { class: 'update-banner', onclick: applyUpdate },
    el('span', {}, '✨ Update bereit'), el('strong', {}, 'Jetzt aktualisieren'));
  document.body.append(banner);
}

function onNewVersionActive() {
  if (isBusy()) {
    pendingReload = true;
    showBanner();
  } else {
    applyUpdate();
  }
}

export async function checkForUpdate({ manual = false } = {}) {
  if (!registration) {
    if (manual) toast('Updates sind nur in der Online-Version (https) verfügbar.');
    return false;
  }
  try {
    await registration.update();
    const found = !!(registration.installing || registration.waiting);
    if (manual) toast(found ? 'Neue Version wird geladen …' : `Du hast die neueste Version (${BUILD}) ✓`, { type: found ? 'info' : 'success' });
    return found;
  } catch {
    if (manual) toast('Keine Verbindung – später erneut versuchen.', { type: 'error' });
    return false;
  }
}

export async function initUpdates() {
  const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
  if (!('serviceWorker' in navigator) || !secure) return;

  const hadController = !!navigator.serviceWorker.controller;
  try {
    // updateViaCache: 'none' -> sw.js wird nie aus dem HTTP-Cache genommen
    registration = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
  } catch {
    return;
  }

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Beim allerersten Start übernimmt der SW nur die Kontrolle -> kein Neuladen nötig
    if (!hadController || reloading) return;
    reloading = true;
    onNewVersionActive();
  });

  // Nach Updates fragen: beim Start, beim Zurückkehren in die App, regelmäßig
  checkForUpdate();
  setInterval(() => checkForUpdate(), CHECK_EVERY);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
  window.addEventListener('online', () => checkForUpdate());

  // Wartendes Update aktivieren, sobald der Nutzer den Leser verlässt
  window.addEventListener('hashchange', () => {
    if (pendingReload && !isBusy()) applyUpdate();
  });
}

// ---------- "Was ist neu" ----------

export function showChangelog() {
  const body = el('div', { class: 'changelog' },
    el('p', { class: 'muted' }, `Installierte Version: ${APP_VERSION} (${BUILD})`),
    ...CHANGELOG.map((c) => el('section', {},
      el('h3', {}, `Version ${c.version}`, el('span', { class: 'muted' }, ` · ${c.date}`)),
      el('ul', {}, ...c.items.map((i) => el('li', {}, i))))));
  openSheet({ title: 'Was ist neu', body });
}

// Nach einem Update einmal "Aktualisiert" anzeigen
export function announceUpdate() {
  let last = null;
  try {
    last = localStorage.getItem('lw-build');
    localStorage.setItem('lw-build', BUILD);
  } catch { /* ignorieren */ }
  if (last && last !== BUILD && BUILD !== 'lokal') {
    toast(`Aktualisiert auf Version ${APP_VERSION} ✓`, { type: 'success', ms: 8000, action: { label: 'Was ist neu?', fn: showChangelog } });
  }
}
