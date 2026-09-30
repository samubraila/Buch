// Hörbuch-Player für echte Hörbücher (LibriVox über archive.org)
// – spielt in der ganzen App weiter, Mini-Leiste unten, großer Player als Sheet
// – Sperrbildschirm-Steuerung (Media Session), Tempo, Schlaf-Timer, Position merken
import * as db from './db.js';
import { el, escapeHtml, toast } from './util.js';
import { openSheet } from './ui.js';

const audio = new Audio();
audio.preload = 'auto';
let book = null;       // { id, title, author, cover, tracks: [{ title, url, dur }] }
let index = 0;
let bar = null;
let sheet = null;
let sleep = { until: 0, endOfTrack: false, timer: 0 };
let saveTimer = 0;
const listeners = new Set();

const I = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path d="M6 5v14M18 5l-9 7 9 7z" stroke="currentColor" stroke-width="2" fill="currentColor" stroke-linejoin="round"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M18 5v14M6 5l9 7-9 7z" stroke="currentColor" stroke-width="2" fill="currentColor" stroke-linejoin="round"/></svg>',
  back15: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/><text x="12" y="15.5" text-anchor="middle" font-size="7.5" font-weight="700" fill="currentColor">15</text></svg>',
  fwd30: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v4h-4" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/><text x="12" y="15.5" text-anchor="middle" font-size="7.5" font-weight="700" fill="currentColor">30</text></svg>',
};

export function fmtTime(s) {
  if (!isFinite(s)) return '0:00';
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

export function current() {
  return book ? { book, index, playing: !audio.paused } : null;
}

export function onPlayer(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  for (const fn of listeners) fn(current());
  updateBar();
  updateSheet();
}

// ---------- Position merken ----------
async function savePos() {
  if (!book) return;
  try {
    await db.kvSet('ab:' + book.id, { index, time: audio.currentTime, at: Date.now() });
    const recent = (await db.kvGet('audiobooks', [])).filter((b) => b.id !== book.id);
    recent.unshift({ id: book.id, title: book.title, author: book.author, cover: book.cover, index, total: book.tracks.length, at: Date.now() });
    await db.kvSet('audiobooks', recent.slice(0, 12));
  } catch { /* ignorieren */ }
}

export async function recentAudiobooks() {
  return db.kvGet('audiobooks', []);
}

// ---------- Laden & Abspielen ----------
function loadTrack(i, time = 0, autoplay = true) {
  index = Math.max(0, Math.min(book.tracks.length - 1, i));
  const t = book.tracks[index];
  audio.src = t.url;
  audio.playbackRate = rate;
  const seek = () => {
    if (time > 0) { try { audio.currentTime = time; } catch { /* ignorieren */ } }
    audio.removeEventListener('loadedmetadata', seek);
  };
  audio.addEventListener('loadedmetadata', seek);
  setMediaSession();
  if (autoplay) audio.play().catch(() => emit());
  emit();
}

let rate = 1;
export function setRate(r) {
  rate = r;
  audio.playbackRate = r;
  try { localStorage.setItem('lw-ab-rate', String(r)); } catch { /* ignorieren */ }
  emit();
}
try { rate = Number(localStorage.getItem('lw-ab-rate')) || 1; } catch { /* ignorieren */ }

/** Hörbuch starten (setzt an gespeicherter Position fort) */
export async function playBook(b, { track = null } = {}) {
  if (book && book.id === b.id && track == null) {
    if (audio.paused) audio.play().catch(() => {});
    openPlayer();
    return;
  }
  savePos();
  book = b;
  const saved = await db.kvGet('ab:' + b.id, null);
  if (track != null) loadTrack(track, 0);
  else if (saved) loadTrack(saved.index, Math.max(0, saved.time - 3));
  else loadTrack(0, 0);
  openPlayer();
}

export function toggle() {
  if (!book) return;
  if (audio.paused) audio.play().catch(() => toast('Wiedergabe nicht möglich', { type: 'error' }));
  else audio.pause();
}
export function skip(sec) {
  if (!book) return;
  audio.currentTime = Math.max(0, Math.min((audio.duration || 0) - 0.5, audio.currentTime + sec));
}
export function nextTrack() { if (book && index < book.tracks.length - 1) loadTrack(index + 1); }
export function prevTrack() {
  if (!book) return;
  if (audio.currentTime > 5 || index === 0) audio.currentTime = 0;
  else loadTrack(index - 1);
}
export function stopPlayer() {
  savePos();
  audio.pause();
  audio.removeAttribute('src');
  book = null;
  clearSleep();
  if ('mediaSession' in navigator) navigator.mediaSession.metadata = null;
  sheet?.close();
  emit();
}

// ---------- Schlaf-Timer ----------
function clearSleep() {
  clearTimeout(sleep.timer);
  sleep = { until: 0, endOfTrack: false, timer: 0 };
}
export function setSleep(min) {
  clearSleep();
  if (min === 'track') sleep.endOfTrack = true;
  else if (min > 0) {
    sleep.until = Date.now() + min * 60000;
    sleep.timer = setTimeout(() => {
      audio.pause();
      clearSleep();
      toast('🌙 Schlaf-Timer: Wiedergabe angehalten');
      emit();
    }, min * 60000);
  }
  emit();
}
function sleepLabel() {
  if (sleep.endOfTrack) return 'Kapitelende';
  if (sleep.until) return `${Math.max(1, Math.round((sleep.until - Date.now()) / 60000))} Min.`;
  return 'Aus';
}

// ---------- Ereignisse ----------
audio.addEventListener('play', emit);
audio.addEventListener('pause', () => { savePos(); emit(); });
audio.addEventListener('ended', () => {
  if (sleep.endOfTrack) { clearSleep(); toast('🌙 Schlaf-Timer: Kapitel beendet'); emit(); return; }
  if (book && index < book.tracks.length - 1) loadTrack(index + 1);
  else { savePos(); emit(); if (book) toast('Hörbuch beendet 🎉'); }
});
audio.addEventListener('timeupdate', () => {
  updateProgress();
  if (Date.now() - saveTimer > 5000) { saveTimer = Date.now(); savePos(); }
  if ('mediaSession' in navigator && navigator.mediaSession.setPositionState && isFinite(audio.duration)) {
    try { navigator.mediaSession.setPositionState({ duration: audio.duration, playbackRate: audio.playbackRate, position: Math.min(audio.currentTime, audio.duration) }); } catch { /* ignorieren */ }
  }
});
audio.addEventListener('error', () => {
  if (book) toast('Kapitel konnte nicht geladen werden – Internet prüfen.', { type: 'error' });
  emit();
});

function setMediaSession() {
  if (!('mediaSession' in navigator) || !book) return;
  const t = book.tracks[index];
  navigator.mediaSession.metadata = new MediaMetadata({
    title: t.title,
    artist: book.author,
    album: book.title,
    artwork: book.cover ? [{ src: book.cover, sizes: '180x180', type: 'image/jpeg' }] : [],
  });
  const ms = navigator.mediaSession;
  const set = (a, f) => { try { ms.setActionHandler(a, f); } catch { /* nicht unterstützt */ } };
  set('play', () => audio.play());
  set('pause', () => audio.pause());
  set('previoustrack', prevTrack);
  set('nexttrack', nextTrack);
  set('seekbackward', (d) => skip(-(d.seekOffset || 15)));
  set('seekforward', (d) => skip(d.seekOffset || 30));
  set('seekto', (d) => { if (d.seekTime != null) audio.currentTime = d.seekTime; });
}

// ---------- Mini-Leiste ----------
function ensureBar() {
  if (bar) return bar;
  bar = el('div', { class: 'ab-bar', hidden: true });
  bar.innerHTML = `
    <button class="ab-open" data-act="open" aria-label="Player öffnen">
      <img class="ab-cover" alt="">
      <span class="ab-text"><strong data-slot="title"></strong><span data-slot="track"></span></span>
    </button>
    <button class="icon-btn" data-act="toggle" aria-label="Abspielen/Pause"></button>
    <button class="icon-btn" data-act="close" aria-label="Player schließen">${I.close}</button>
    <div class="ab-bar-progress"><span></span></div>`;
  bar.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'open') openPlayer();
    if (act === 'toggle') toggle();
    if (act === 'close') stopPlayer();
  });
  document.body.append(bar);
  return bar;
}

function updateBar() {
  const b = ensureBar();
  if (!book) { b.hidden = true; document.body.classList.remove('has-ab'); return; }
  b.hidden = false;
  document.body.classList.add('has-ab');
  b.querySelector('.ab-cover').src = book.cover || 'icons/icon-192.png';
  b.querySelector('[data-slot="title"]').textContent = book.title;
  b.querySelector('[data-slot="track"]').textContent = `${index + 1}/${book.tracks.length} · ${book.tracks[index]?.title || ''}`;
  b.querySelector('[data-act="toggle"]').innerHTML = audio.paused ? I.play : I.pause;
}

function updateProgress() {
  const frac = audio.duration ? audio.currentTime / audio.duration : 0;
  if (bar) bar.querySelector('.ab-bar-progress span').style.width = frac * 100 + '%';
  if (sheet?.open) {
    const r = sheet.querySelector('[data-slot="seek"]');
    if (r && document.activeElement !== r) r.value = Math.round(frac * 1000);
    sheet.querySelector('[data-slot="cur"]').textContent = fmtTime(audio.currentTime);
    sheet.querySelector('[data-slot="dur"]').textContent = fmtTime(audio.duration);
  }
}

// ---------- Großer Player ----------
export function openPlayer() {
  if (!book) return;
  if (sheet?.open) { updateSheet(); return; }
  const body = el('div', { class: 'ab-player' });
  body.innerHTML = `
    <div class="ab-head">
      <img class="ab-big-cover" alt="" src="${escapeHtml(book.cover || 'icons/icon-512.png')}">
      <div><strong class="ab-title">${escapeHtml(book.title)}</strong><span class="muted">${escapeHtml(book.author || '')}</span>
      <span class="ab-track" data-slot="tracktitle"></span></div>
    </div>
    <input type="range" min="0" max="1000" value="0" class="range" data-slot="seek" aria-label="Position im Kapitel">
    <div class="ab-times"><span data-slot="cur">0:00</span><span data-slot="dur">0:00</span></div>
    <div class="ab-controls">
      <button class="icon-btn" data-act="prev" aria-label="Vorheriges Kapitel">${I.prev}</button>
      <button class="icon-btn" data-act="back" aria-label="15 Sekunden zurück">${I.back15}</button>
      <button class="icon-btn big" data-act="toggle" aria-label="Abspielen/Pause"></button>
      <button class="icon-btn" data-act="fwd" aria-label="30 Sekunden vor">${I.fwd30}</button>
      <button class="icon-btn" data-act="next" aria-label="Nächstes Kapitel">${I.next}</button>
    </div>
    <div class="ab-options">
      <label class="ab-opt">Tempo <select class="select" data-act="rate">${[0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2].map((r) => `<option value="${r}">${r}×</option>`).join('')}</select></label>
      <label class="ab-opt">🌙 Schlaf-Timer <select class="select" data-act="sleep">
        <option value="0">Aus</option><option value="15">15 Min.</option><option value="30">30 Min.</option><option value="45">45 Min.</option><option value="60">60 Min.</option><option value="track">Kapitelende</option>
      </select></label>
    </div>
    <div class="ab-sleep muted small" data-slot="sleep"></div>
    <h3 class="ab-list-title">Kapitel</h3>
    <ol class="ab-tracks" data-slot="tracks"></ol>`;
  sheet = openSheet({ title: 'Hörbuch', body, className: 'ab-sheet', onClose: () => { sheet = null; } });
  body.querySelector('[data-slot="tracks"]').innerHTML = book.tracks.map((t, i) =>
    `<li><button data-track="${i}"><span>${escapeHtml(t.title)}</span><small>${t.dur ? fmtTime(t.dur) : ''}</small></button></li>`).join('');
  body.addEventListener('click', (e) => {
    const tr = e.target.closest('[data-track]');
    if (tr) { loadTrack(Number(tr.dataset.track)); return; }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'toggle') toggle();
    if (act === 'prev') prevTrack();
    if (act === 'next') nextTrack();
    if (act === 'back') skip(-15);
    if (act === 'fwd') skip(30);
  });
  body.addEventListener('change', (e) => {
    const act = e.target.dataset.act;
    if (act === 'rate') setRate(Number(e.target.value));
    if (act === 'sleep') setSleep(e.target.value === 'track' ? 'track' : Number(e.target.value));
  });
  const seek = body.querySelector('[data-slot="seek"]');
  seek.addEventListener('change', () => { if (audio.duration) audio.currentTime = (seek.value / 1000) * audio.duration; seek.blur(); });
  updateSheet();
  updateProgress();
}

function updateSheet() {
  if (!sheet?.open || !book) return;
  sheet.querySelector('[data-act="toggle"]').innerHTML = audio.paused ? I.play : I.pause;
  sheet.querySelector('[data-slot="tracktitle"]').textContent = `Kapitel ${index + 1} von ${book.tracks.length}: ${book.tracks[index]?.title || ''}`;
  sheet.querySelectorAll('[data-track]').forEach((b) => b.classList.toggle('current', Number(b.dataset.track) === index));
  const rs = sheet.querySelector('[data-act="rate"]');
  if (rs) rs.value = String(rate);
  sheet.querySelector('[data-slot="sleep"]').textContent = sleep.until || sleep.endOfTrack ? `Schlaf-Timer: ${sleepLabel()}` : '';
}

// ---------- LibriVox über archive.org ----------
const IA = 'https://archive.org';

function parseDur(v) {
  if (!v) return 0;
  if (String(v).includes(':')) return String(v).split(':').reduce((a, x) => a * 60 + Number(x), 0);
  return Number(v) || 0;
}

export async function loadLibrivox(identifier, fallback = {}) {
  const res = await fetch(`${IA}/metadata/${encodeURIComponent(identifier)}`);
  if (!res.ok) throw new Error('Hörbuch konnte nicht geladen werden');
  const d = await res.json();
  const files = (d.files || []).filter((f) => /\.mp3$/i.test(f.name));
  let mp3 = files.filter((f) => f.format === '64Kbps MP3');
  if (!mp3.length) mp3 = files.filter((f) => f.format === 'VBR MP3');
  if (!mp3.length) mp3 = files;
  const trackNo = (f) => parseInt(String(f.track || '').split('/')[0], 10) || 0;
  mp3.sort((a, b) => trackNo(a) - trackNo(b) || a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (!mp3.length) throw new Error('Keine Audiodateien gefunden');
  const niceTitle = (f, i) => {
    const t = (f.title || '').trim();
    if (t && !/^[\w-]+_\d+$/.test(t) && !/_64kb$/.test(t)) return t;
    return `Kapitel ${i + 1}`;
  };
  const md = d.metadata || {};
  return {
    id: identifier,
    title: fallback.title || String(md.title || identifier).replace(/,? by .*$/i, ''),
    author: fallback.author || [].concat(md.creator || [])[0] || '',
    cover: `${IA}/services/img/${encodeURIComponent(identifier)}`,
    tracks: mp3.map((f, i) => ({
      title: niceTitle(f, i),
      url: `${IA}/download/${encodeURIComponent(identifier)}/${f.name.split('/').map(encodeURIComponent).join('/')}`,
      dur: parseDur(f.length),
    })),
  };
}

// Mini-Leiste im Leser ausblenden (der Leser hat eigene Steuerung)
window.addEventListener('hashchange', () => updateBar());
