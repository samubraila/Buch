// Allgemeine Hilfsfunktionen

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function uid() {
  return (crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2));
}

export function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function debounce(fn, ms) {
  let t;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.flush = (...a) => { clearTimeout(t); fn(...a); };
  d.cancel = () => clearTimeout(t);
  return d;
}

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return e;
}

// ---------- Sprachen ----------

export const LANGS = ['ru', 'uk', 'de', 'en', 'ro', 'fr', 'es', 'it', 'pt', 'pl', 'nl', 'tr', 'cs', 'bg', 'el', 'sv', 'fi', 'hu', 'ja', 'zh', 'ko', 'ar'];

let displayNames;
export function langName(code) {
  if (!code) return 'Unbekannt';
  try {
    displayNames ||= new Intl.DisplayNames(['de'], { type: 'language' });
    return displayNames.of(code) || code;
  } catch {
    return code;
  }
}

export function normLang(code) {
  if (!code) return '';
  const c = String(code).trim().toLowerCase().replace('_', '-');
  const base = c.split('-')[0];
  const map = { eng: 'en', ger: 'de', deu: 'de', rus: 'ru', fre: 'fr', fra: 'fr', spa: 'es', ita: 'it', rum: 'ro', ron: 'ro', ukr: 'uk', pol: 'pl' };
  return map[base] || (base.length === 2 ? base : '');
}

const STOP = {
  en: ['the', 'and', 'of', 'to', 'a', 'in', 'is', 'it', 'you', 'that', 'he', 'was', 'for', 'on', 'are', 'with', 'as', 'his', 'they', 'be', 'at', 'have', 'this', 'from', 'she', 'her', 'not', 'but', 'what', 'said'],
  de: ['der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich', 'des', 'auf', 'für', 'ist', 'im', 'dem', 'nicht', 'ein', 'eine', 'als', 'auch', 'es', 'an', 'er', 'hat', 'aus', 'bei', 'sie', 'nach', 'wie', 'ich', 'war', 'und'],
  fr: ['le', 'la', 'les', 'de', 'des', 'et', 'est', 'un', 'une', 'du', 'que', 'qui', 'dans', 'pour', 'pas', 'sur', 'au', 'il', 'elle', 'ce', 'avec', 'je', 'vous'],
  es: ['el', 'la', 'de', 'que', 'y', 'en', 'los', 'se', 'del', 'las', 'un', 'por', 'con', 'no', 'una', 'su', 'para', 'es', 'al', 'lo', 'como', 'más'],
  it: ['il', 'di', 'che', 'e', 'la', 'per', 'un', 'in', 'non', 'una', 'sono', 'mi', 'lo', 'ho', 'ma', 'si', 'gli', 'della', 'le', 'con', 'questo'],
  ro: ['și', 'în', 'de', 'la', 'pe', 'cu', 'nu', 'că', 'este', 'un', 'o', 'se', 'să', 'din', 'mai', 'ce', 'care', 'lui', 'fost', 'era', 'am'],
  nl: ['de', 'het', 'een', 'en', 'van', 'ik', 'te', 'dat', 'die', 'in', 'is', 'niet', 'zijn', 'op', 'je', 'met', 'hij', 'was', 'voor'],
  pl: ['i', 'w', 'nie', 'się', 'na', 'jest', 'że', 'do', 'to', 'z', 'jak', 'co', 'tak', 'ale', 'po', 'za', 'od', 'już', 'był'],
  pt: ['o', 'de', 'a', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'é', 'com', 'não', 'uma', 'os', 'no', 'se', 'na', 'por', 'mais', 'você'],
  ru: ['и', 'в', 'не', 'на', 'я', 'что', 'он', 'с', 'как', 'а', 'то', 'все', 'она', 'так', 'его', 'но', 'да', 'ты', 'к', 'у', 'же', 'вы', 'за', 'бы', 'по', 'было', 'это'],
  uk: ['і', 'в', 'не', 'на', 'що', 'я', 'з', 'він', 'як', 'та', 'це', 'до', 'а', 'але', 'так', 'його', 'вона', 'ви', 'був', 'було', 'є', 'її', 'які'],
};

// Einfache Spracherkennung über häufige Wörter
export function detectLang(text) {
  const sample = String(text).slice(0, 20000).toLowerCase();
  const cyr = (sample.match(/[а-яёіїєґ]/g) || []).length;
  const lat = (sample.match(/[a-zäöüßéèàùâêîôûçñăâîșț]/g) || []).length;
  if (/[぀-ヿ]/.test(sample)) return 'ja';
  if (/[一-鿿]/.test(sample) && !/[a-z]/.test(sample.slice(0, 500))) return 'zh';
  if (/[가-힯]/.test(sample)) return 'ko';
  if (/[؀-ۿ]/.test(sample)) return 'ar';
  const words = sample.match(/[\p{L}']+/gu) || [];
  const counts = {};
  const candidates = cyr > lat ? ['ru', 'uk'] : Object.keys(STOP).filter((l) => l !== 'ru' && l !== 'uk');
  const sets = Object.fromEntries(candidates.map((l) => [l, new Set(STOP[l])]));
  for (const w of words.slice(0, 4000)) {
    for (const l of candidates) if (sets[l].has(w)) counts[l] = (counts[l] || 0) + 1;
  }
  if (cyr > lat && /[іїєґ]/.test(sample)) counts.uk = (counts.uk || 0) + 20;
  let best = candidates[0];
  for (const l of candidates) if ((counts[l] || 0) > (counts[best] || 0)) best = l;
  return best || 'en';
}

// ---------- Segmentierung (Wörter / Sätze) ----------

const segCache = new Map();
export function segmenter(lang, granularity) {
  if (!('Segmenter' in Intl)) return null;
  const key = lang + '|' + granularity;
  if (!segCache.has(key)) {
    try { segCache.set(key, new Intl.Segmenter(lang || undefined, { granularity })); }
    catch { segCache.set(key, new Intl.Segmenter(undefined, { granularity })); }
  }
  return segCache.get(key);
}

// Liefert [{segment, index, isWordLike}] für Wörter
export function wordSegments(text, lang) {
  const s = segmenter(lang, 'word');
  if (s) return [...s.segment(text)];
  const out = [];
  const re = /[\p{L}\p{M}\p{N}'’-]+|[^\p{L}\p{M}\p{N}'’-]+/gu;
  let m;
  while ((m = re.exec(text))) out.push({ segment: m[0], index: m.index, isWordLike: /[\p{L}\p{N}]/u.test(m[0]) });
  return out;
}

export function sentenceSegments(text, lang) {
  const s = segmenter(lang, 'sentence');
  if (s) return [...s.segment(text)].map((x) => ({ segment: x.segment, index: x.index }));
  const out = [];
  const re = /[^.!?…]+[.!?…]+["»”’)\]]*\s*|[^.!?…]+$/g;
  let m;
  while ((m = re.exec(text))) out.push({ segment: m[0], index: m.index });
  return out;
}

// Wort bereinigen (Satzzeichen / Anführungszeichen am Rand entfernen)
export function cleanWord(w) {
  return String(w).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

// ---------- Netzwerk ----------

export async function fetchWithTimeout(url, opts = {}, ms = 7000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

// ---------- Anzeige ----------

export function coverColors(title) {
  const h = hashStr(title || '?');
  const hue = h % 360;
  return [`hsl(${hue} 45% 32%)`, `hsl(${(hue + 40) % 360} 50% 22%)`];
}

export function fmtDate(t) {
  if (!t) return '';
  return new Date(t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fmtMinutes(chars) {
  const min = Math.max(1, Math.round(chars / 1000));
  if (min < 60) return `${min} Min.`;
  const h = Math.floor(min / 60);
  return `${h} Std. ${min % 60} Min.`;
}

// Kleines Toast-System
export function toast(msg, { type = 'info', ms = 3200, action } = {}) {
  let box = document.getElementById('toasts');
  if (!box) {
    box = el('div', { id: 'toasts', 'aria-live': 'polite' });
    document.body.append(box);
  }
  const t = el('div', { class: `toast toast-${type}` }, el('span', {}, msg));
  if (action) {
    t.append(el('button', { class: 'toast-btn', onclick: () => { action.fn(); t.remove(); } }, action.label));
  }
  box.append(t);
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => t.remove(), ms + 400);
  return t;
}

export function isMobile() {
  return matchMedia('(max-width: 640px)').matches;
}

export function isTouch() {
  return matchMedia('(pointer: coarse)').matches;
}

// Bild verkleinern (für Cover)
export async function downscaleImage(blob, maxW = 420) {
  try {
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, maxW / bmp.width);
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
  } catch {
    return blob;
  }
}

// ---------- Binärdaten speichern (Safari kann keine Blobs in IndexedDB ablegen) ----------

/** Blob -> { type, data: ArrayBuffer } (in allen Browsern speicherbar) */
export async function blobToStored(blob) {
  if (!blob) return null;
  if (blob.data && !(blob instanceof Blob)) return blob; // schon umgewandelt
  return { type: blob.type || 'application/octet-stream', data: await blob.arrayBuffer() };
}

/** gespeicherte Daten (alt: Blob, neu: {type, data}) -> Blob */
export function storedToBlob(s) {
  if (!s) return null;
  if (s instanceof Blob) return s;
  if (s.data) return new Blob([s.data], { type: s.type || 'application/octet-stream' });
  return null;
}

// ---------- Fehlerprotokoll (für "Diagnose" in den Einstellungen) ----------

export function logError(context, err) {
  const msg = err?.message || String(err);
  console.warn('[LeseWelt]', context, err);
  try {
    const list = JSON.parse(localStorage.getItem('lw-errors') || '[]');
    list.unshift({ t: new Date().toISOString(), context, msg: msg.slice(0, 500), name: err?.name || '' });
    localStorage.setItem('lw-errors', JSON.stringify(list.slice(0, 30)));
  } catch { /* ignorieren */ }
}

export function getErrorLog() {
  try { return JSON.parse(localStorage.getItem('lw-errors') || '[]'); } catch { return []; }
}

export function clearErrorLog() {
  try { localStorage.removeItem('lw-errors'); } catch { /* ignorieren */ }
}

export function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Konnte ' + src + ' nicht laden'));
    document.head.append(s);
  });
}
