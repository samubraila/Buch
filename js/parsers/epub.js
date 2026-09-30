// EPUB 2/3 einlesen: container.xml -> OPF -> Spine -> Kapitel
import { sanitize, parseMarkup } from './sanitize.js';
import { loadScript } from '../util.js';

export async function loadJSZip() {
  if (!window.JSZip) await loadScript('vendor/jszip.min.js');
  return window.JSZip;
}

function resolvePath(base, rel) {
  if (!rel) return '';
  if (/^[a-z]+:/i.test(rel)) return rel; // absolute URL
  const u = new URL(rel, 'https://book/' + base);
  return decodeURIComponent(u.pathname.slice(1)) + (u.hash || '');
}

function splitHash(p) {
  const i = p.indexOf('#');
  return i < 0 ? [p, ''] : [p.slice(0, i), p.slice(i + 1)];
}

function findFile(zip, path) {
  return zip.file(path) || zip.file(encodeURI(path)) ||
    zip.file(new RegExp('^' + path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i'))[0] || null;
}

function text(el) {
  return (el?.textContent || '').replace(/\s+/g, ' ').trim();
}

export async function parseEpub(file, onProgress = () => {}) {
  const JSZip = await loadJSZip();
  const zip = await JSZip.loadAsync(file);

  const containerXml = await findFile(zip, 'META-INF/container.xml')?.async('text');
  if (!containerXml) throw new Error('Ungültiges EPUB (container.xml fehlt)');
  const container = parseMarkup(containerXml, 'application/xml');
  const opfPath = container.querySelector('rootfile')?.getAttribute('full-path');
  const opfFile = opfPath && findFile(zip, opfPath);
  if (!opfFile) throw new Error('Ungültiges EPUB (OPF fehlt)');
  const opf = parseMarkup(await opfFile.async('text'), 'application/xml');

  const meta = (name) => text(opf.getElementsByTagName('dc:' + name)[0] || opf.getElementsByTagName(name)[0]);
  const title = meta('title');
  const creators = [...opf.getElementsByTagName('dc:creator')].map(text).filter(Boolean);
  const lang = meta('language');

  // Manifest
  const manifest = new Map();
  for (const item of opf.getElementsByTagName('item')) {
    manifest.set(item.getAttribute('id'), {
      href: resolvePath(opfPath, item.getAttribute('href')),
      type: item.getAttribute('media-type') || '',
      props: item.getAttribute('properties') || '',
    });
  }

  // Bilder: lazy aus dem ZIP holen
  const images = {};
  const imgKeys = new Map();
  const pendingImgs = [];
  function imgKey(path) {
    const [p] = splitHash(path);
    if (imgKeys.has(p)) return imgKeys.get(p);
    const f = findFile(zip, p);
    if (!f) return null;
    const key = 'i' + imgKeys.size;
    imgKeys.set(p, key);
    const ext = p.split('.').pop().toLowerCase();
    const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp' }[ext] || 'image/*';
    pendingImgs.push(f.async('arraybuffer').then((buf) => { images[key] = new Blob([buf], { type: mime }); }));
    return key;
  }

  // Cover
  let cover = null;
  const coverMetaId = [...opf.getElementsByTagName('meta')].find((m) => m.getAttribute('name') === 'cover')?.getAttribute('content');
  let coverItem = [...manifest.values()].find((i) => /cover-image/.test(i.props)) || manifest.get(coverMetaId);
  if (!coverItem) coverItem = [...manifest.values()].find((i) => i.type.startsWith('image/') && /cover/i.test(i.href));
  if (coverItem && coverItem.type.startsWith('image/')) {
    const f = findFile(zip, coverItem.href);
    if (f) cover = new Blob([await f.async('arraybuffer')], { type: coverItem.type });
  }

  // Inhaltsverzeichnis
  const toc = [];
  const navItem = [...manifest.values()].find((i) => /\bnav\b/.test(i.props));
  const spineEl = opf.getElementsByTagName('spine')[0];
  const ncxItem = manifest.get(spineEl?.getAttribute('toc')) || [...manifest.values()].find((i) => i.type === 'application/x-dtbncx+xml');
  try {
    if (navItem) {
      const nav = parseMarkup(await findFile(zip, navItem.href).async('text'));
      const navEl = [...nav.getElementsByTagName('nav')].find((n) =>
        /toc/.test(n.getAttribute('epub:type') || n.getAttributeNS('http://www.idpf.org/2007/ops', 'type') || '')) ||
        nav.getElementsByTagName('nav')[0];
      const walk = (ol, depth) => {
        for (const li of ol?.children || []) {
          if (li.localName !== 'li') continue;
          const a = [...li.children].find((c) => c.localName === 'a' || c.localName === 'span');
          const href = a?.getAttribute('href');
          if (a && href) {
            const [path, frag] = splitHash(resolvePath(navItem.href, href));
            toc.push({ title: text(a), path, frag, depth });
          }
          const sub = [...li.children].find((c) => c.localName === 'ol');
          if (sub) walk(sub, depth + 1);
        }
      };
      walk(navEl && [...navEl.children].find((c) => c.localName === 'ol'), 0);
    }
    if (!toc.length && ncxItem) {
      const ncx = parseMarkup(await findFile(zip, ncxItem.href).async('text'), 'application/xml');
      const walk = (parent, depth) => {
        for (const np of parent.children) {
          if (np.localName !== 'navPoint') continue;
          const label = text(np.getElementsByTagName('navLabel')[0]);
          const src = np.getElementsByTagName('content')[0]?.getAttribute('src');
          if (src) {
            const [path, frag] = splitHash(resolvePath(ncxItem.href, src));
            toc.push({ title: label, path, frag, depth });
          }
          walk(np, depth + 1);
        }
      };
      const navMap = ncx.getElementsByTagName('navMap')[0];
      if (navMap) walk(navMap, 0);
    }
  } catch (e) {
    console.warn('TOC konnte nicht gelesen werden', e);
  }

  // Spine -> Kapitel
  const spine = [...(spineEl?.getElementsByTagName('itemref') || [])]
    .map((r) => manifest.get(r.getAttribute('idref')))
    .filter((i) => i && /html|xml/.test(i.type));

  const chapters = [];
  for (let s = 0; s < spine.length; s++) {
    onProgress(s / spine.length);
    const item = spine[s];
    const f = findFile(zip, item.href);
    if (!f) continue;
    const doc = parseMarkup(await f.async('text'), item.type.includes('html') && !item.type.includes('xhtml') ? 'text/html' : 'application/xhtml+xml');
    const body = doc.body || doc.getElementsByTagName('body')[0] || doc.documentElement;
    const html = sanitize(body, {
      resolveImg: (src) => imgKey(resolvePath(item.href, src)),
      resolveHref: (href) => {
        if (/^(https?:|mailto:)/i.test(href)) return href;
        return resolvePath(item.href, href);
      },
    });
    if (!html.trim()) continue;
    const tocTitle = toc.find((t) => t.path === item.href)?.title;
    const heading = text(body.querySelector?.('h1, h2, h3'));
    chapters.push({ title: tocTitle || heading || '', html, path: item.href });
  }
  await Promise.all(pendingImgs);
  onProgress(1);

  return { title, author: creators.join(', '), lang, cover, chapters, toc, images };
}
