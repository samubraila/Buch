// Bücher importieren und in IndexedDB speichern
import * as db from './db.js';
import { uid, detectLang, normLang, downscaleImage } from './util.js';
import { textToBook } from './parsers/text.js';

export const ACCEPT = '.epub,.fb2,.zip,.txt,.text,.md,.html,.htm,.xhtml,.pdf';

function kind(file) {
  const n = file.name.toLowerCase();
  if (n.endsWith('.epub') || file.type === 'application/epub+zip') return 'epub';
  if (n.endsWith('.fb2') || n.endsWith('.fb2.zip')) return 'fb2';
  if (n.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf';
  if (/\.(x?html?)$/.test(n)) return 'html';
  if (/\.(txt|text|md)$/.test(n) || file.type.startsWith('text/')) return 'txt';
  if (n.endsWith('.zip')) return 'fb2';
  return null;
}

async function parse(file, onProgress) {
  switch (kind(file)) {
    case 'epub': return (await import('./parsers/epub.js')).parseEpub(file, onProgress);
    case 'fb2': return (await import('./parsers/fb2.js')).parseFb2(file);
    case 'pdf': return (await import('./parsers/pdf.js')).parsePdf(file, onProgress);
    case 'html': return (await import('./parsers/text.js')).parseHtml(file);
    case 'txt': return (await import('./parsers/text.js')).parseTxt(file);
    default: throw new Error(`Format nicht unterstützt: ${file.name}`);
  }
}

// Sehr lange Kapitel in Teile schneiden (flüssigeres Blättern auf dem Handy)
const MAX_CHARS = 90000;
function splitHtml(html) {
  if (html.length <= MAX_CHARS) return [html];
  const box = document.createElement('div');
  box.innerHTML = html;
  let root = box;
  while (root.children.length === 1 && root.firstElementChild.children.length > 1 && root.firstElementChild.nodeName === 'DIV') {
    root = root.firstElementChild;
  }
  const parts = [];
  let cur = [];
  let size = 0;
  for (const n of [...root.childNodes]) {
    const s = n.nodeType === 1 ? n.outerHTML : n.textContent;
    if (size + s.length > MAX_CHARS / 2 && size > 0 && n.nodeType === 1) {
      parts.push(cur.join(''));
      cur = [];
      size = 0;
    }
    cur.push(n.nodeType === 1 ? s : s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])));
    size += s.length;
  }
  if (cur.length) parts.push(cur.join(''));
  return parts.length ? parts : [html];
}

function plainText(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ');
}

export async function saveParsed(parsed, { format, fileKey, name } = {}) {
  const src = parsed.chapters.filter((c) => c.html && c.html.trim());
  if (!src.length) throw new Error('Keine lesbaren Inhalte gefunden');

  const parts = [];
  src.forEach((c, orig) => {
    splitHtml(c.html).forEach((html, k) => parts.push({ title: c.title, html, path: c.path, orig, piece: k }));
  });

  // Inhaltsverzeichnis auf Kapitel-Indizes abbilden
  let toc = [];
  for (const t of parsed.toc || []) {
    const orig = t.ch != null ? t.ch : src.findIndex((c) => c.path === t.path);
    if (orig < 0) continue;
    const cands = parts.map((p, i) => [p, i]).filter(([p]) => p.orig === orig);
    if (!cands.length) continue;
    let hit = cands[0][1];
    if (t.frag) {
      const found = cands.find(([p]) => p.html.includes(`id="${t.frag}"`));
      if (found) hit = found[1];
    }
    toc.push({ title: t.title || parts[hit].title || `Kapitel ${hit + 1}`, ch: hit, frag: t.frag || '', depth: t.depth || 0 });
  }
  if (!toc.length) {
    toc = parts.map((p, i) => ({ title: p.title || `Kapitel ${i + 1}`, ch: i, frag: '', depth: 0 })).filter((_, i) => parts[i].piece === 0);
  }

  const chapters = parts.map((p, i) => {
    const t = p.title || toc.filter((x) => x.ch <= i).at(-1)?.title || `Kapitel ${i + 1}`;
    return { title: p.piece > 0 ? `${t} (${p.piece + 1})` : t, chars: plainText(p.html).length };
  });

  const sample = parts.slice(0, 6).map((p) => plainText(p.html)).join(' ').slice(0, 20000);
  const lang = normLang(parsed.lang) || detectLang(sample);

  const id = uid();
  const cover = parsed.cover ? await downscaleImage(parsed.cover) : null;
  const book = {
    id,
    title: (parsed.title || name || 'Ohne Titel').trim(),
    author: (parsed.author || '').trim(),
    lang,
    format,
    fileKey,
    cover,
    chapters,
    toc,
    totalChars: chapters.reduce((n, c) => n + c.chars, 0),
    addedAt: Date.now(),
    lastRead: 0,
    pos: { ch: 0, blk: 0, pct: 0 },
  };
  await db.put('contents', { id, chapters: parts.map((p) => ({ html: p.html, path: p.path })), images: parsed.images || {} });
  await db.put('books', book);
  db.requestPersist();
  return book;
}

export async function importFile(file, onProgress = () => {}) {
  const fileKey = `${file.name}|${file.size}`;
  const existing = (await db.getAll('books')).find((b) => b.fileKey === fileKey);
  if (existing) return { book: existing, existed: true };
  const parsed = await parse(file, onProgress);
  const book = await saveParsed(parsed, { format: kind(file), fileKey, name: file.name });
  return { book, existed: false };
}

export async function importText(text, title) {
  const parsed = textToBook(text, title || 'Eingefügter Text');
  if (title) parsed.title = title;
  return saveParsed(parsed, { format: 'txt', fileKey: 'paste|' + Date.now() });
}

/**
 * Buch aus dem Internet laden (Katalog "Entdecken").
 * @param {object} o { url, key, title, author, lang, name, onProgress }
 */
export async function importFromUrl({ url, key, title, author, lang, name, onProgress = () => {} }) {
  const fileKey = 'url|' + (key || url);
  const existing = (await db.getAll('books')).find((b) => b.fileKey === fileKey);
  if (existing) return { book: existing, existed: true };

  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new Error('Download fehlgeschlagen – bitte Internetverbindung prüfen.');
  }
  if (!res.ok) throw new Error(`Download fehlgeschlagen (${res.status})`);
  const total = Number(res.headers.get('content-length')) || 0;
  const chunks = [];
  let loaded = 0;
  if (res.body?.getReader) {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      onProgress(total ? Math.min(0.95, (loaded / total) * 0.9) : 0.3, loaded);
    }
  } else {
    chunks.push(new Uint8Array(await res.arrayBuffer()));
  }
  const file = new File(chunks, name, { type: res.headers.get('content-type') || '' });
  const parsed = await parse(file, (p) => onProgress(0.9 + p * 0.1, loaded));
  if (title) parsed.title = title;
  if (author) parsed.author = author;
  if (lang) parsed.lang = lang;
  const book = await saveParsed(parsed, { format: kind(file), fileKey, name });
  return { book, existed: false };
}

export async function deleteBook(id) {
  await db.del('books', id);
  await db.del('contents', id);
  try {
    for (const m of await db.getAllByIndex('marks', 'bookId', id)) await db.del('marks', m.id);
  } catch { /* ignorieren */ }
}
