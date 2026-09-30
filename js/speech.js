// Aussprache: Gerätestimmen (Web Speech API) oder Online-Stimme (Google), plus Aufnahmen
import { settings } from './settings.js';

const synth = 'speechSynthesis' in self ? self.speechSynthesis : null;
let voices = [];
const voiceListeners = new Set();

function loadVoices() {
  if (!synth) return;
  voices = synth.getVoices();
  for (const fn of voiceListeners) fn(voices);
}
if (synth) {
  loadVoices();
  synth.addEventListener?.('voiceschanged', loadVoices);
}

export function onVoices(fn) {
  voiceListeners.add(fn);
  if (voices.length) fn(voices);
  return () => voiceListeners.delete(fn);
}

export function speechLang(lang) {
  const l = (lang || 'en').toLowerCase();
  if (l.startsWith('en')) return settings.enAccent || 'en-US';
  const map = { de: 'de-DE', ru: 'ru-RU', uk: 'uk-UA', fr: 'fr-FR', es: 'es-ES', it: 'it-IT', pt: 'pt-PT', pl: 'pl-PL', nl: 'nl-NL',
    ro: 'ro-RO', tr: 'tr-TR', cs: 'cs-CZ', sv: 'sv-SE', fi: 'fi-FI', hu: 'hu-HU', el: 'el-GR', bg: 'bg-BG', ja: 'ja-JP', zh: 'zh-CN', ko: 'ko-KR', ar: 'ar-SA' };
  return map[l.split('-')[0]] || l;
}

export function voicesFor(lang) {
  const base = lang.split('-')[0].toLowerCase();
  return voices.filter((v) => v.lang.toLowerCase().replace('_', '-').split('-')[0] === base);
}

function scoreVoice(v, full) {
  let s = 0;
  const vl = v.lang.replace('_', '-').toLowerCase();
  if (vl === full.toLowerCase()) s += 10;
  if (/natural|neural|online|premium|enhanced|wavenet/i.test(v.name)) s += 6;
  if (/google/i.test(v.name)) s += 4;
  if (/siri/i.test(v.name)) s += 5;
  if (/samantha|daniel|anna|karen|serena|moira|milena|yuri/i.test(v.name)) s += 2;
  if (/compact|eloquence|espeak|robot/i.test(v.name)) s -= 6;
  if (v.default) s += 1;
  return s;
}

export function bestVoice(full) {
  const base = full.split('-')[0];
  const chosen = settings.voices?.[base];
  if (chosen) {
    const v = voices.find((x) => x.voiceURI === chosen);
    if (v) return v;
  }
  const list = voicesFor(full);
  if (!list.length) return null;
  return [...list].sort((a, b) => scoreVoice(b, full) - scoreVoice(a, full))[0];
}

// Gibt es eine gute Gerätestimme? (sonst lieber Online-Stimme im Auto-Modus)
function hasGoodDeviceVoice(full) {
  const v = bestVoice(full);
  return !!v && scoreVoice(v, full) >= 10;
}

let audioEl;
let currentUtter;
let pendingAudio = null; // resolve-Funktion der laufenden Audio-Wiedergabe
let gen = 0;             // steigt bei jedem neuen speak()/stop()

export function stop() {
  gen++;
  synth?.cancel();
  if (audioEl) {
    audioEl.onended = audioEl.onerror = null;
    audioEl.pause();
    audioEl.removeAttribute('src');
  }
  if (pendingAudio) { const r = pendingAudio; pendingAudio = null; r(); }
}

function playUrl(url, rate = 1) {
  return new Promise((resolve, reject) => {
    audioEl ||= new Audio();
    audioEl.pause();
    pendingAudio = resolve;
    const done = (fn) => (arg) => { pendingAudio = null; audioEl.onended = audioEl.onerror = null; fn(arg); };
    audioEl.onended = done(resolve);
    audioEl.onerror = done(() => reject(new Error('Audio konnte nicht geladen werden')));
    audioEl.src = url;
    audioEl.playbackRate = rate;
    audioEl.play().catch(done(reject));
  });
}

// Online-Stimme (Google): klingt natürlich, braucht Internet, max. ~200 Zeichen
function onlineUrl(text, full) {
  const tl = full.startsWith('en-GB') ? 'en-GB' : full.split('-')[0] === 'zh' ? 'zh-CN' : full.split('-')[0];
  return `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(text.slice(0, 200))}`;
}

// Lange Texte an Satzzeichen / Leerzeichen in Stücke <= max teilen
function chunkText(text, max) {
  const out = [];
  let rest = text.trim();
  while (rest.length > max) {
    const slice = rest.slice(0, max);
    let cut = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '), slice.lastIndexOf('; '));
    if (cut < max * 0.4) cut = Math.max(slice.lastIndexOf(', '), slice.lastIndexOf(' – '));
    if (cut < max * 0.4) cut = slice.lastIndexOf(' ');
    if (cut <= 0) cut = max - 1;
    out.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) out.push(rest);
  return out;
}

function speakDevice(text, full, rate, onBoundary) {
  return new Promise((resolve, reject) => {
    if (!synth) return reject(new Error('Keine Sprachausgabe auf diesem Gerät'));
    const u = new SpeechSynthesisUtterance(text);
    u.lang = full;
    const v = bestVoice(full);
    if (v) u.voice = v;
    u.rate = rate;
    u.onend = () => resolve();
    u.onerror = (e) => (e.error === 'interrupted' || e.error === 'canceled' ? resolve() : reject(new Error(e.error)));
    if (onBoundary) u.onboundary = onBoundary;
    currentUtter = u; // Referenz halten (Chrome-Bug: sonst kein onend)
    synth.speak(u);
  });
}

/**
 * Text aussprechen.
 * @param {string} text
 * @param {string} lang  z. B. 'en', 'de', 'en-GB'
 * @param {object} o  { slow, rate, mode }
 */
export async function speak(text, lang, o = {}) {
  stop();
  const my = gen;
  const full = lang.includes('-') ? lang : speechLang(lang);
  const rate = o.rate ?? (o.slow ? 0.6 : settings.rate);
  const mode = o.mode || settings.speechMode;
  const useOnline = mode === 'online' || (mode === 'auto' && !hasGoodDeviceVoice(full) && navigator.onLine !== false);
  if (useOnline) {
    try {
      for (const part of chunkText(text, 190)) {
        await playUrl(onlineUrl(part, full), o.slow ? 0.7 : Math.min(1.5, Math.max(0.5, rate)));
        if (my !== gen) return;
      }
      return;
    } catch {
      /* auf Gerätestimme zurückfallen */
    }
    if (my !== gen) return; // inzwischen gestoppt oder neues Wort
  }
  if (synth && synth.paused) synth.resume();
  return speakDevice(text, full, rate, o.onBoundary);
}

// Echte Aufnahme (z. B. von dictionaryapi.dev)
export function playRecording(url, slow) {
  stop();
  return playUrl(url, slow ? 0.75 : 1);
}

export function isSpeaking() {
  return !!(synth?.speaking || (audioEl && !audioEl.paused));
}

export const hasSynth = !!synth;
export { currentUtter };
