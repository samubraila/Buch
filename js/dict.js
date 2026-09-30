// Wörterbuch: Lautschrift + echte Aussprache-Aufnahmen (Englisch) und Bedeutungen (Wiktionary)
import { cacheGet, cacheSet } from './db.js';
import { fetchWithTimeout } from './util.js';

// Englisch: dictionaryapi.dev -> IPA, Audio-Aufnahmen (US/UK), Bedeutungen
export async function englishEntry(word) {
  const w = word.toLowerCase();
  const key = 'en|' + w;
  const cached = await cacheGet(key);
  if (cached !== undefined) return cached;
  try {
    const res = await fetchWithTimeout('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(w), {}, 5000);
    if (res.status === 404) { cacheSet(key, null); return null; }
    if (!res.ok) return null;
    const data = await res.json();
    const phon = data.flatMap((e) => e.phonetics || []);
    const ipaUS = phon.find((p) => p.text && /-us\.mp3$/.test(p.audio || ''))?.text;
    const ipa = ipaUS || data.find((e) => e.phonetic)?.phonetic || phon.find((p) => p.text)?.text || '';
    const audio = {
      us: phon.find((p) => /-us\.mp3$/.test(p.audio || ''))?.audio || '',
      uk: phon.find((p) => /-uk\.mp3$/.test(p.audio || ''))?.audio || '',
      any: phon.find((p) => p.audio)?.audio || '',
    };
    const meanings = data.flatMap((e) => e.meanings || []).map((m) => ({
      pos: m.partOfSpeech,
      defs: (m.definitions || []).slice(0, 3).map((d) => ({ def: d.definition, ex: d.example || '' })),
    }));
    const r = { ipa, audio, meanings };
    cacheSet(key, r);
    return r;
  } catch {
    return null;
  }
}

function stripHtml(s) {
  const d = new DOMParser().parseFromString(`<body>${s}</body>`, 'text/html');
  return d.body.textContent.replace(/\s+/g, ' ').trim();
}

// Wiktionary (englische Ausgabe): Bedeutungen für viele Sprachen (de, en, fr, ...)
export async function wiktionary(word, lang) {
  const key = `wk|${lang}|${word}`;
  const cached = await cacheGet(key);
  if (cached !== undefined) return cached;
  const tryWord = async (w) => {
    const res = await fetchWithTimeout('https://en.wiktionary.org/api/rest_v1/page/definition/' + encodeURIComponent(w), {}, 5000);
    if (!res.ok) return null;
    const j = await res.json();
    const entries = j[lang];
    if (!entries?.length) return null;
    return entries.slice(0, 3).map((e) => ({
      pos: e.partOfSpeech,
      defs: (e.definitions || []).map((d) => ({
        def: stripHtml(d.definition || ''),
        ex: stripHtml(d.parsedExamples?.[0]?.example || d.examples?.[0] || ''),
      })).filter((d) => d.def).slice(0, 3),
    })).filter((e) => e.defs.length);
  };
  try {
    let r = await tryWord(word);
    if (!r && word !== word.toLowerCase()) r = await tryWord(word.toLowerCase());
    // Deutsch: Nomen werden großgeschrieben
    if (!r && lang === 'de') r = await tryWord(word[0].toUpperCase() + word.slice(1).toLowerCase());
    cacheSet(key, r || null);
    return r || null;
  } catch {
    return null;
  }
}
