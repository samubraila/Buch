// Wandelt beliebiges (X)HTML aus Büchern in sauberes, sicheres HTML um.
// Nur erlaubte Tags/Attribute bleiben, Skripte und Styles fliegen raus.

const KEEP = new Set([
  'p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'em', 'i', 'strong', 'b', 'u', 's', 'sub', 'sup', 'small',
  'blockquote', 'q', 'cite', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'br', 'hr', 'img', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'pre', 'code', 'a', 'abbr', 'del', 'ins', 'mark',
]);
const TO_DIV = new Set(['section', 'article', 'aside', 'header', 'footer', 'nav', 'main', 'center', 'body', 'hgroup']);
const TO_SPAN = { big: 'span', tt: 'code', font: 'span', var: 'em', dfn: 'em', kbd: 'code', samp: 'code' };
const DROP = new Set(['script', 'style', 'link', 'meta', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'select',
  'textarea', 'noscript', 'title', 'head', 'audio', 'video', 'canvas', 'math', 'template', 'frame', 'frameset']);
const BLOCKS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'hr', 'figure', 'figcaption', 'table', 'pre', 'section', 'article', 'aside', 'header', 'footer', 'nav', 'center', 'img']);

const outDoc = document.implementation.createHTMLDocument('');

/**
 * @param {Node} root  – Quell-Knoten (z. B. body eines XHTML-Dokuments)
 * @param {object} opt
 *   resolveImg(src) -> key | null   (Bild-Schlüssel für data-img)
 *   resolveHref(href) -> string | null
 */
export function sanitize(root, opt = {}) {
  const container = outDoc.createElement('div');
  for (const child of [...root.childNodes]) {
    const n = convert(child, opt);
    if (n) container.append(n);
  }
  cleanup(container);
  return container.innerHTML;
}

function localName(node) {
  return (node.localName || node.nodeName || '').toLowerCase().replace(/^.*:/, '');
}

function convert(node, opt) {
  if (node.nodeType === 3) return outDoc.createTextNode(node.data);
  if (node.nodeType !== 1) return null;
  let tag = localName(node);
  if (DROP.has(tag)) return null;
  // Project-Gutenberg-Kopf und -Lizenz (EPUB) weglassen
  const idAttr = node.getAttribute?.('id') || '';
  if (/^pg-(header|footer)$/.test(idAttr) || /\bpg-boilerplate\b/.test(node.getAttribute?.('class') || '')) return null;

  // SVG mit Bild (typisch für EPUB-Cover) -> <img>
  if (tag === 'svg') {
    const im = node.querySelector?.('image');
    if (!im) return null;
    const src = im.getAttribute('xlink:href') || im.getAttributeNS?.('http://www.w3.org/1999/xlink', 'href') || im.getAttribute('href');
    return makeImg(src, '', opt);
  }
  if (tag === 'img' || tag === 'image') {
    const src = node.getAttribute('src') || node.getAttribute('xlink:href') || node.getAttribute('l:href') || node.getAttribute('href');
    return makeImg(src, node.getAttribute('alt') || '', opt);
  }

  let cls = '';
  if (tag === 'center') cls = 'c';
  const style = node.getAttribute?.('style') || '';
  const align = node.getAttribute?.('align') || '';
  if (/text-align\s*:\s*center/i.test(style) || align === 'center') cls = 'c';
  else if (/text-align\s*:\s*right/i.test(style) || align === 'right') cls = 'r';

  if (TO_DIV.has(tag)) tag = 'div';
  else if (TO_SPAN[tag]) tag = TO_SPAN[tag];
  else if (!KEEP.has(tag)) {
    // unbekanntes Tag: Inhalt behalten
    const frag = outDoc.createDocumentFragment();
    for (const c of [...node.childNodes]) {
      const n = convert(c, opt);
      if (n) frag.append(n);
    }
    return frag;
  }

  // <div> ohne Block-Kinder, aber mit Text -> <p>
  if (tag === 'div' && !hasBlockChild(node) && node.textContent.trim()) tag = 'p';

  const out = outDoc.createElement(tag);
  if (cls) out.className = cls;
  const id = node.getAttribute?.('id');
  if (id) out.id = id;

  if (tag === 'a') {
    const href = node.getAttribute('href') || node.getAttribute('l:href') ||
      node.getAttributeNS?.('http://www.w3.org/1999/xlink', 'href');
    if (href) {
      const r = opt.resolveHref ? opt.resolveHref(href) : href;
      if (r) out.dataset.href = r;
    }
    const type = node.getAttribute('type') || node.getAttribute('epub:type') ||
      node.getAttributeNS?.('http://www.idpf.org/2007/ops', 'type');
    if (type && /note/i.test(type)) out.className = 'note';
  }
  if (tag === 'td' || tag === 'th') {
    for (const a of ['colspan', 'rowspan']) if (node.getAttribute(a)) out.setAttribute(a, node.getAttribute(a));
  }
  if (tag === 'ol' && node.getAttribute('start')) out.setAttribute('start', node.getAttribute('start'));

  for (const c of [...node.childNodes]) {
    const n = convert(c, opt);
    if (n) out.append(n);
  }
  return out;
}

function makeImg(src, alt, opt) {
  if (!src) return null;
  const key = opt.resolveImg ? opt.resolveImg(src) : null;
  if (!key) return null;
  const img = outDoc.createElement('img');
  img.dataset.img = key;
  img.alt = alt;
  img.loading = 'lazy';
  return img;
}

function hasBlockChild(node) {
  for (const c of node.children || []) {
    if (BLOCKS.has(localName(c)) || localName(c) === 'svg') return true;
  }
  return false;
}

function cleanup(root) {
  // leere Absätze entfernen (auch solche, die nur aus <br> bestehen)
  for (const p of root.querySelectorAll('p, div')) {
    if (!p.textContent.trim() && !p.querySelector('img, hr')) p.remove();
  }
  // wirklich leere Spans entfernen (Leerzeichen-Spans bleiben, sonst kleben Wörter zusammen)
  for (const s of root.querySelectorAll('span')) {
    if (s.textContent === '' && !s.querySelector('img')) s.remove();
  }
}

// Hilfsfunktion: XHTML/HTML-String zu Dokument
export function parseMarkup(text, type = 'application/xhtml+xml') {
  const parser = new DOMParser();
  let doc = parser.parseFromString(text, type);
  if (type !== 'text/html' && doc.getElementsByTagName('parsererror').length) {
    doc = parser.parseFromString(text, 'text/html');
  }
  return doc;
}
