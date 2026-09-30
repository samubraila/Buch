// TXT, eingefügter Text und HTML-Dateien
import { sanitize, parseMarkup } from './sanitize.js';
import { escapeHtml } from '../util.js';

// Kodierung erkennen: UTF-8 / UTF-16 / Windows-1251 (Kyrillisch) / Windows-1252
export function decodeText(buf) {
  const b = new Uint8Array(buf);
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(buf);
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(buf);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    const sample = b.slice(0, 5000);
    let hi = 0;
    for (const x of sample) if (x >= 0xc0) hi++;
    // viele Bytes im Bereich 0xC0–0xFF -> sehr wahrscheinlich Kyrillisch
    return new TextDecoder(hi > sample.length * 0.2 ? 'windows-1251' : 'windows-1252').decode(buf);
  }
}

const CHAPTER_RE = /^(chapter|kapitel|глава|часть|part|teil|book|buch|книга|capitolul|chapitre|capítulo|capitolo|rozdział|розділ|prolog(ue)?|epilog(ue)?|пролог|эпилог|vorwort|nachwort|предисловие)\b[\s\dIVXLCDM.:–—-]*.{0,60}$|^[IVXLCDM]{1,7}\.?$|^\d{1,3}\.?$|^\*\s*\*\s*\*$/i;

// Project-Gutenberg-Vor- und Nachspann (Lizenztext) entfernen
export function stripGutenberg(text) {
  let t = text.replace(/\r\n?/g, '\n');
  const start = t.search(/\*{3}\s*START OF (THE|THIS) PROJECT GUTENBERG[^\n]*\n/i);
  if (start >= 0) t = t.slice(t.indexOf('\n', start) + 1);
  else {
    const old = t.search(/\*END\*THE SMALL PRINT[^\n]*\n/i);
    if (old >= 0) t = t.slice(t.indexOf('\n', old) + 1);
  }
  const end = t.search(/\*{3}\s*END OF (THE|THIS) PROJECT GUTENBERG|End of (the )?Project Gutenberg'?s?\s/i);
  if (end > 0) t = t.slice(0, end);
  // Einleitungsabsatz wie "Produced by ..." am Anfang entfernen (nur bis zur nächsten Leerzeile)
  const lead = t.trimStart();
  if (/^(Produced by|This e-?book was produced by|E-text prepared by|Transcribed from)/i.test(lead)) {
    const blank = lead.search(/\n[ \t]*\n/);
    if (blank > 0 && blank < 1500) t = lead.slice(blank);
  }
  return t;
}

export function textToBook(raw, name = 'Text') {
  const text = stripGutenberg(raw).replace(/\r\n?/g, '\n').replace(/ /g, ' ').trim();
  const hasBlankLines = /\n\s*\n/.test(text);
  let paras;
  if (hasBlankLines) {
    paras = text.split(/\n\s*\n+/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim());
  } else {
    paras = text.split('\n').map((p) => p.trim());
  }
  // Silbentrennung am Zeilenende reparieren ("Bei-\nspiel")
  paras = paras.map((p) => p.replace(/(\p{L})-\s+(\p{Ll})/gu, '$1$2')).filter(Boolean);

  const chapters = [];
  let cur = { title: '', parts: [] };
  const flush = () => {
    if (cur.parts.length) chapters.push(cur);
    cur = { title: '', parts: [] };
  };
  for (const p of paras) {
    const isHead = p.length < 80 && CHAPTER_RE.test(p);
    const tooBig = cur.parts.reduce((n, x) => n + x.length, 0) > 40000;
    if ((isHead && cur.parts.length > 0) || tooBig) flush();
    if (isHead) {
      cur.title = p;
      cur.parts.push(`<h2>${escapeHtml(p)}</h2>`);
    } else {
      cur.parts.push(`<p>${escapeHtml(p)}</p>`);
    }
  }
  flush();

  let title = name.replace(/\.(txt|text|md)$/i, '');
  // Erste kurze Zeile vor dem ersten Kapitel = Buchtitel
  if (chapters.length > 1 && chapters[0].parts.length === 1 && !chapters[0].title && paras[0].length < 80) {
    title = paras[0].toLowerCase().replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase());
    if (paras[0] !== paras[0].toUpperCase()) title = paras[0];
    chapters.shift();
  }
  return {
    title,
    author: '',
    lang: '',
    cover: null,
    chapters: chapters.map((c, i) => ({ title: c.title || (chapters.length > 1 ? `Teil ${i + 1}` : title), html: c.parts.join('\n'), path: 'txt' })),
    toc: [],
    images: {},
  };
}

export async function parseTxt(file) {
  return textToBook(decodeText(await file.arrayBuffer()), file.name);
}

export async function parseHtml(file) {
  const doc = parseMarkup(decodeText(await file.arrayBuffer()), 'text/html');
  const title = doc.title || file.name.replace(/\.x?html?$/i, '');
  const lang = doc.documentElement.getAttribute('lang') || '';
  const html = sanitize(doc.body, {
    resolveImg: () => null,
    resolveHref: (h) => (/^https?:/i.test(h) ? h : h.startsWith('#') ? h : null),
  });
  // An <h1>/<h2> in Kapitel aufteilen
  const box = document.createElement('div');
  box.innerHTML = html;
  const chapters = [];
  let cur = { title: '', nodes: [] };
  for (const n of [...box.childNodes]) {
    if (n.nodeType === 1 && /^H[12]$/.test(n.nodeName) && cur.nodes.some((x) => x.textContent.trim())) {
      chapters.push(cur);
      cur = { title: '', nodes: [] };
    }
    if (n.nodeType === 1 && /^H[12]$/.test(n.nodeName) && !cur.title) cur.title = n.textContent.trim();
    cur.nodes.push(n);
  }
  chapters.push(cur);
  return {
    title,
    author: doc.querySelector('meta[name="author"]')?.content || '',
    lang,
    cover: null,
    chapters: chapters.map((c, i) => {
      const d = document.createElement('div');
      c.nodes.forEach((n) => d.append(n));
      return { title: c.title || `Teil ${i + 1}`, html: d.innerHTML, path: 'html' };
    }),
    toc: [],
    images: {},
  };
}
