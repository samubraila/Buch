// Übersetzung mit mehreren Diensten und Cache.
// Reihenfolge: Google (kostenlos, sehr gut) -> MyMemory -> Chrome-Offline-Übersetzer
import { cacheGet, cacheSet } from './db.js';
import { fetchWithTimeout, sentenceSegments, detectLang } from './util.js';

const blockedUntil = {}; // Dienst -> Zeitstempel, wenn Limit erreicht

function isBlocked(name) {
  return (blockedUntil[name] || 0) > Date.now();
}
function block(name, minutes = 10) {
  blockedUntil[name] = Date.now() + minutes * 60000;
}

// ---------- Google ----------
async function google(q, sl, tl, withDict) {
  const params = new URLSearchParams({ client: 'gtx', sl: sl || 'auto', tl, hl: 'de', dj: '1', ie: 'UTF-8', oe: 'UTF-8' });
  const dts = withDict ? ['t', 'bd', 'rm'] : ['t'];
  const url = 'https://translate.googleapis.com/translate_a/single?' + params + dts.map((d) => '&dt=' + d).join('') + '&q=' + encodeURIComponent(q);
  const res = await fetchWithTimeout(url, {}, 7000);
  if (res.status === 429 || res.status === 403) { block('google'); throw new Error('google-limit'); }
  if (!res.ok) throw new Error('google ' + res.status);
  const j = await res.json();
  const text = (j.sentences || []).map((s) => s.trans || '').join('');
  const translit = (j.sentences || []).find((s) => s.translit)?.translit || '';
  const alts = (j.dict || []).map((d) => ({
    pos: d.pos,
    terms: (d.entry || d.terms?.map((w) => ({ word: w })) || []).slice(0, 7).map((e) => ({
      word: e.word,
      back: (e.reverse_translation || []).slice(0, 3),
    })),
  })).filter((d) => d.terms.length);
  if (!text) throw new Error('google leer');
  return { text, alts, translit, detected: j.src || sl, provider: 'Google' };
}

// ---------- MyMemory ----------
async function mymemory(q, sl, tl) {
  const src = sl && sl !== 'auto' ? sl : detectLang(q);
  if (src === tl) throw new Error('gleiche Sprache');
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=${src}|${tl}`;
  const res = await fetchWithTimeout(url, {}, 8000);
  if (!res.ok) throw new Error('mymemory ' + res.status);
  const j = await res.json();
  if (j.quotaFinished || j.responseStatus === 429) { block('mymemory', 60); throw new Error('mymemory-limit'); }
  if (String(j.responseStatus) !== '200') throw new Error('mymemory ' + j.responseDetails);
  let text = j.responseData?.translatedText || '';
  if (/^[A-ZА-ЯЁ\s\W]+$/.test(text) && text.length > 3 && q !== q.toUpperCase()) text = text.toLowerCase();
  const seen = new Set([text.toLowerCase()]);
  const terms = [];
  for (const m of j.matches || []) {
    const t = (m.translation || '').trim();
    if (!t || seen.has(t.toLowerCase()) || t.length > 60) continue;
    seen.add(t.toLowerCase());
    terms.push({ word: t, back: [] });
  }
  return { text, alts: terms.length ? [{ pos: '', terms: terms.slice(0, 5) }] : [], translit: '', detected: src, provider: 'MyMemory' };
}

// ---------- Chrome On-Device (Translator API) ----------
const deviceTranslators = new Map();
export function deviceSupported() {
  return 'Translator' in self;
}
export async function deviceAvailability(sl, tl) {
  if (!deviceSupported()) return 'unavailable';
  try { return await self.Translator.availability({ sourceLanguage: sl, targetLanguage: tl }); }
  catch { return 'unavailable'; }
}
// Muss aus einem Klick aufgerufen werden, wenn ein Download nötig ist
export async function prepareDevice(sl, tl, onProgress) {
  const key = sl + '>' + tl;
  if (deviceTranslators.has(key)) return deviceTranslators.get(key);
  const t = await self.Translator.create({
    sourceLanguage: sl,
    targetLanguage: tl,
    monitor(m) {
      m.addEventListener('downloadprogress', (e) => onProgress?.(e.loaded));
    },
  });
  deviceTranslators.set(key, t);
  return t;
}
async function device(q, sl, tl) {
  const src = sl && sl !== 'auto' ? sl : detectLang(q);
  if ((await deviceAvailability(src, tl)) !== 'available') throw new Error('device nicht verfügbar');
  const t = await prepareDevice(src, tl);
  const text = await t.translate(q);
  return { text, alts: [], translit: '', detected: src, provider: 'Offline (Chrome)' };
}

// ---------- öffentliche API ----------

async function runChain(q, sl, tl, withDict) {
  const errors = [];
  const chain = [];
  if (navigator.onLine !== false) {
    if (!isBlocked('google')) chain.push(() => google(q, sl, tl, withDict));
    if (!isBlocked('mymemory') && q.length <= 480) chain.push(() => mymemory(q, sl, tl));
  }
  chain.push(() => device(q, sl, tl));
  if (navigator.onLine === false) {
    // falls onLine falsch meldet, trotzdem online versuchen
    chain.push(() => google(q, sl, tl, withDict));
  }
  for (const fn of chain) {
    try { return await fn(); }
    catch (e) { errors.push(e.message); }
  }
  throw new Error(navigator.onLine === false
    ? 'Keine Internetverbindung – Übersetzung nicht möglich.'
    : 'Übersetzung gerade nicht erreichbar. Bitte später erneut versuchen.');
}

/** Einzelnes Wort (mit Wörterbuch-Alternativen) */
export async function translateWord(word, sl, tl) {
  const key = `w|${sl}|${tl}|${word.toLowerCase()}`;
  const cached = await cacheGet(key);
  if (cached) return { ...cached, cached: true };
  const r = await runChain(word, sl, tl, true);
  cacheSet(key, r);
  return r;
}

/** Längerer Text (Satz, Absatz) – wird bei Bedarf in Stücke geteilt */
export async function translateText(text, sl, tl) {
  const clean = text.replace(/\s+/g, ' ').trim();
  const key = `t|${sl}|${tl}|${clean.slice(0, 500)}|${clean.length}`;
  const cached = await cacheGet(key);
  if (cached) return { ...cached, cached: true };

  const chunks = [];
  let cur = '';
  for (const { segment } of sentenceSegments(clean, sl)) {
    if ((cur + segment).length > 450 && cur) { chunks.push(cur); cur = ''; }
    cur += segment;
  }
  if (cur) chunks.push(cur);

  const results = [];
  for (const c of chunks) results.push(await runChain(c.trim(), sl, tl, false));
  const r = {
    text: results.map((x) => x.text).join(' '),
    alts: [],
    detected: results[0]?.detected,
    provider: [...new Set(results.map((x) => x.provider))].join(', '),
  };
  cacheSet(key, r);
  return r;
}
