// Aussprache üben: Wort ins Mikrofon sprechen, Spracherkennung vergleicht mit dem Zielwort
import { speechLang } from './speech.js';

const Recognition = self.SpeechRecognition || self.webkitSpeechRecognition;
export const canPractice = !!Recognition;

const norm = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N} ]/gu, '').trim();

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

/** Ähnlichkeit 0–100 zwischen Zielwort und Gehörtem */
export function similarity(target, heard) {
  const t = norm(target);
  const h = norm(heard);
  if (!t || !h) return 0;
  if (h === t || h.split(' ').includes(t)) return 100;
  const d = levenshtein(t, h);
  return Math.max(0, Math.round((1 - d / Math.max(t.length, h.length)) * 100));
}

let active = null;

/**
 * Zuhören und bewerten.
 * @returns {Promise<{heard: string, score: number}>}
 */
export function listen(target, lang) {
  if (!Recognition) return Promise.reject(new Error('Spracherkennung wird von diesem Browser nicht unterstützt (Chrome oder Safari verwenden).'));
  active?.abort();
  return new Promise((resolve, reject) => {
    const rec = new Recognition();
    active = rec;
    rec.lang = speechLang(lang);
    rec.interimResults = false;
    rec.maxAlternatives = 5;
    rec.continuous = false;
    let done = false;
    const timer = setTimeout(() => { if (!done) rec.stop(); }, 7000);
    rec.onresult = (e) => {
      done = true;
      clearTimeout(timer);
      const alts = [...e.results[0]].map((a) => a.transcript.trim());
      let best = { heard: alts[0] || '', score: 0 };
      for (const a of alts) {
        const s = similarity(target, a);
        if (s > best.score) best = { heard: a, score: s };
      }
      resolve(best);
    };
    rec.onerror = (e) => {
      done = true;
      clearTimeout(timer);
      const msg = {
        'not-allowed': 'Mikrofon nicht erlaubt – bitte in den Browser-Einstellungen freigeben.',
        'no-speech': 'Nichts gehört – bitte deutlich ins Mikrofon sprechen.',
        'audio-capture': 'Kein Mikrofon gefunden.',
        network: 'Spracherkennung braucht Internet.',
        aborted: 'Abgebrochen',
      }[e.error] || 'Spracherkennung fehlgeschlagen.';
      reject(new Error(msg));
    };
    rec.onend = () => {
      clearTimeout(timer);
      if (!done) reject(new Error('Nichts gehört – bitte nochmal versuchen.'));
      if (active === rec) active = null;
    };
    rec.start();
  });
}

export function feedback(score) {
  if (score >= 90) return { cls: 'good', text: 'Perfekt! ✓' };
  if (score >= 70) return { cls: 'ok', text: 'Fast richtig – nochmal?' };
  return { cls: 'bad', text: 'Noch nicht – hör es dir an und versuch es nochmal.' };
}
