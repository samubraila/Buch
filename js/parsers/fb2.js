// FictionBook 2 (.fb2 / .fb2.zip)
import { sanitize } from './sanitize.js';
import { loadJSZip } from './epub.js';

function decodeXml(buf) {
  const head = new TextDecoder('ascii').decode(buf.slice(0, 200));
  const enc = (head.match(/encoding=["']([^"']+)["']/i)?.[1] || 'utf-8').toLowerCase();
  try {
    return new TextDecoder(enc).decode(buf);
  } catch {
    return new TextDecoder('utf-8').decode(buf);
  }
}

const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
const kids = (el, name) => [...(el?.children || [])].filter((c) => c.localName === name);

export async function parseFb2(file) {
  let buf = await file.arrayBuffer();
  if (/\.zip$/i.test(file.name)) {
    const JSZip = await loadJSZip();
    const zip = await JSZip.loadAsync(buf);
    const entry = Object.values(zip.files).find((f) => /\.fb2$/i.test(f.name));
    if (!entry) throw new Error('Keine .fb2-Datei im ZIP gefunden');
    buf = await entry.async('arraybuffer');
  }
  const xml = new DOMParser().parseFromString(decodeXml(buf), 'application/xml');
  if (xml.getElementsByTagName('parsererror').length && !xml.getElementsByTagName('body').length) {
    throw new Error('FB2-Datei ist beschädigt');
  }

  const ti = xml.getElementsByTagName('title-info')[0];
  const title = txt(ti?.getElementsByTagName('book-title')[0]);
  const author = [...(ti?.getElementsByTagName('author') || [])].map((a) =>
    [txt(a.getElementsByTagName('first-name')[0]), txt(a.getElementsByTagName('middle-name')[0]), txt(a.getElementsByTagName('last-name')[0])]
      .filter(Boolean).join(' ') || txt(a.getElementsByTagName('nickname')[0])).filter(Boolean).join(', ');
  const lang = txt(ti?.getElementsByTagName('lang')[0]);

  // Binärdaten (Bilder)
  const images = {};
  const byId = {};
  let n = 0;
  for (const b of xml.getElementsByTagName('binary')) {
    try {
      const bin = atob(b.textContent.replace(/\s+/g, ''));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const key = 'i' + n++;
      images[key] = new Blob([bytes], { type: b.getAttribute('content-type') || 'image/jpeg' });
      byId[b.getAttribute('id')] = key;
    } catch { /* kaputtes Bild ignorieren */ }
  }
  const hrefOf = (el) => el.getAttribute('l:href') || el.getAttribute('xlink:href') ||
    el.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || el.getAttribute('href') || '';

  let cover = null;
  const coverImg = ti?.getElementsByTagName('coverpage')[0]?.getElementsByTagName('image')[0];
  if (coverImg) cover = images[byId[hrefOf(coverImg).replace('#', '')]] || null;

  // FB2-Elemente in HTML umwandeln
  const out = document.implementation.createHTMLDocument('');
  let secCounter = 0;
  const toc = [];
  let chapterIndexForToc = 0;

  function conv(node, depth) {
    if (node.nodeType === 3) return out.createTextNode(node.data);
    if (node.nodeType !== 1) return null;
    const name = node.localName;
    const map = {
      p: 'p', emphasis: 'em', strong: 'strong', strikethrough: 's', sub: 'sub', sup: 'sup', code: 'code',
      epigraph: 'blockquote', cite: 'blockquote', poem: 'div', stanza: 'div', v: 'p', 'text-author': 'p',
      subtitle: 'h4', table: 'table', tr: 'tr', td: 'td', th: 'th', a: 'a', section: 'div', annotation: 'div',
    };
    if (name === 'title') {
      const h = out.createElement(depth <= 1 ? 'h2' : 'h3');
      h.textContent = kids(node, 'p').map(txt).join(' · ') || txt(node);
      return h;
    }
    if (name === 'empty-line') return out.createElement('br');
    if (name === 'image') {
      const key = byId[hrefOf(node).replace('#', '')];
      if (!key) return null;
      const img = out.createElement('img');
      img.setAttribute('src', key);
      return img;
    }
    const tag = map[name] || 'span';
    const e = out.createElement(tag);
    if (name === 'poem' || name === 'stanza') e.className = name;
    if (name === 'epigraph') e.className = 'epigraph';
    if (name === 'text-author') e.className = 'r';
    if (name === 'a') {
      e.setAttribute('href', hrefOf(node));
      if (node.getAttribute('type') === 'note') e.setAttribute('type', 'note');
    }
    const id = node.getAttribute('id');
    if (id) e.id = id;
    if (name === 'section') {
      const t = kids(node, 'title')[0];
      if (depth >= 1 && t) {
        if (!e.id) e.id = 's-' + ++secCounter;
        toc.push({ title: txt(t), chIndex: chapterIndexForToc, frag: e.id, depth });
      }
    }
    for (const c of node.childNodes) {
      const r = conv(c, name === 'section' ? depth + 1 : depth);
      if (r) e.append(r);
    }
    return e;
  }

  const chapters = [];
  const bodies = [...xml.getElementsByTagName('body')];
  for (const body of bodies) {
    const isNotes = /notes|comments/i.test(body.getAttribute('name') || '');
    const sections = kids(body, 'section');
    const groups = isNotes || !sections.length ? [body] : sections;
    // Titel/Epigraph des Hauptteils vor den Kapiteln
    if (!isNotes && sections.length) {
      const intro = [...body.children].filter((c) => c.localName !== 'section');
      if (intro.some((c) => txt(c))) {
        const wrap = out.createElement('div');
        intro.forEach((c) => { const r = conv(c, 0); if (r) wrap.append(r); });
        chapters.push({ title: title || 'Anfang', html: sanitize(wrap, { resolveImg: (k) => k, resolveHref: (h) => h }), path: 'intro' });
      }
    }
    for (const sec of groups) {
      chapterIndexForToc = chapters.length;
      const wrap = out.createElement('div');
      const r = conv(sec, sec === body ? 0 : 1);
      if (r) wrap.append(r);
      const html = sanitize(wrap, { resolveImg: (k) => k, resolveHref: (h) => h });
      if (!html.trim()) continue;
      const t = isNotes ? 'Anmerkungen' : txt(kids(sec, 'title')[0]) || `Kapitel ${chapters.length + 1}`;
      chapters.push({ title: t, html, path: 'fb2' });
    }
  }

  // TOC: Kapitel + Unterabschnitte
  const fullToc = [];
  chapters.forEach((c, i) => {
    fullToc.push({ title: c.title, ch: i, frag: '', depth: 0 });
    for (const t of toc.filter((x) => x.chIndex === i && x.depth >= 2)) fullToc.push({ title: t.title, ch: i, frag: t.frag, depth: t.depth - 1 });
  });

  return { title, author, lang, cover, chapters, toc: fullToc, images };
}
