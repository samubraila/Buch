// PDF: Text mit pdf.js herausziehen und zu Absätzen zusammensetzen
import { escapeHtml } from '../util.js';

let pdfjs;
async function loadPdfJs() {
  if (!pdfjs) {
    pdfjs = await import('../../vendor/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('../../vendor/pdf.worker.min.mjs', import.meta.url).href;
  }
  return pdfjs;
}

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

// Zeilen einer Seite zusammenbauen
function pageLines(content) {
  const lines = [];
  let cur = null;
  for (const it of content.items) {
    if (!('str' in it)) continue;
    const y = it.transform[5];
    const x = it.transform[4];
    const h = Math.abs(it.transform[3]) || it.height || 10;
    if (!cur || Math.abs(cur.y - y) > h * 0.5) {
      if (cur) lines.push(cur);
      cur = { y, x, h, text: it.str };
    } else {
      const needsSpace = cur.text && !/\s$/.test(cur.text) && it.str && !/^\s/.test(it.str);
      cur.text += (needsSpace && x - (cur.endX || x) > h * 0.15 ? ' ' : '') + it.str;
    }
    cur.endX = x + (it.width || 0);
    if (it.hasEOL) { lines.push(cur); cur = null; }
  }
  if (cur) lines.push(cur);
  return lines.map((l) => ({ ...l, text: l.text.replace(/\s+/g, ' ').trim() })).filter((l) => l.text);
}

export async function parsePdf(file, onProgress = () => {}) {
  const lib = await loadPdfJs();
  const doc = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
  const info = (await doc.getMetadata().catch(() => null))?.info || {};

  // Kapitel über das PDF-Inhaltsverzeichnis (Outline), wenn vorhanden
  const starts = [];
  try {
    const outline = await doc.getOutline();
    for (const o of outline || []) {
      let dest = o.dest;
      if (typeof dest === 'string') dest = await doc.getDestination(dest);
      if (Array.isArray(dest) && dest[0]) {
        const idx = await doc.getPageIndex(dest[0]);
        starts.push({ page: idx, title: o.title });
      }
    }
  } catch { /* keine Outline */ }
  starts.sort((a, b) => a.page - b.page);

  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    onProgress(i / doc.numPages);
    const page = await doc.getPage(i);
    pages.push(pageLines(await page.getTextContent()));
    page.cleanup();
  }

  // Seiten zu Absätzen
  const pageParas = pages.map((lines) => {
    const gaps = [];
    for (let i = 1; i < lines.length; i++) gaps.push(Math.abs(lines[i - 1].y - lines[i].y));
    const gap = median(gaps) || 14;
    const lens = lines.map((l) => l.text.length);
    const typical = median(lens);
    const minX = Math.min(...lines.map((l) => l.x));
    const paras = [];
    let cur = '';
    lines.forEach((l, i) => {
      if (/^\d{1,4}$/.test(l.text)) return; // Seitenzahl
      const prev = lines[i - 1];
      const bigGap = prev && Math.abs(prev.y - l.y) > gap * 1.45;
      const indent = l.x - minX > 8 && prev && prev.x - minX < 4;
      const prevShort = prev && prev.text.length < typical * 0.75 && /[.!?:»"”…]$/.test(prev.text);
      if (cur && (bigGap || indent || prevShort)) { paras.push(cur); cur = ''; }
      if (cur.endsWith('-') && /^\p{Ll}/u.test(l.text)) cur = cur.slice(0, -1) + l.text;
      else cur += (cur ? ' ' : '') + l.text;
    });
    if (cur) paras.push(cur);
    return paras;
  });

  const title = info.Title?.trim() || file.name.replace(/\.pdf$/i, '');
  const chapters = [];
  const makeChapter = (from, to, t) => {
    const html = pageParas.slice(from, to).flat().map((p) => `<p>${escapeHtml(p)}</p>`).join('\n');
    if (html) chapters.push({ title: t, html, path: 'pdf' });
  };
  if (starts.length >= 2) {
    if (starts[0].page > 0) makeChapter(0, starts[0].page, 'Anfang');
    starts.forEach((s, i) => makeChapter(s.page, starts[i + 1]?.page ?? pages.length, s.title));
  } else {
    const step = 10;
    for (let p = 0; p < pages.length; p += step) {
      makeChapter(p, p + step, pages.length > step ? `Seiten ${p + 1}–${Math.min(p + step, pages.length)}` : title);
    }
  }
  if (!chapters.length) throw new Error('Diese PDF enthält keinen lesbaren Text (vermutlich eingescannt).');
  return { title, author: info.Author || '', lang: '', cover: null, chapters, toc: [], images: {} };
}
