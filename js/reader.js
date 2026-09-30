// Der Leser: Seiten blättern oder scrollen, Wort antippen, Text markieren, Vorlesen
import * as db from './db.js';
import { settings, setSetting } from './settings.js';
import * as popup from './popup.js';
import { speak, stop as stopSpeech } from './speech.js';
import { savedWordSet, onVocab } from './vocabStore.js';
import { el, escapeHtml, debounce, clamp, wordSegments, sentenceSegments, cleanWord, isMobile, langName, LANGS, fmtMinutes, toast } from './util.js';
import { openSheet, segmented, toggle, field } from './ui.js';

const BLOCK_SEL = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,dt,dd,figure,img,table,figcaption';
const TEXT_SEL = 'p,h1,h2,h3,h4,h5,h6,li,pre,dt,dd,figcaption,td,th,blockquote';
export const FONTS = {
  literata: { label: 'Literata', css: "'Literata', Georgia, serif" },
  merriweather: { label: 'Merriweather', css: "'Merriweather', Georgia, serif" },
  sourceserif: { label: 'Source Serif', css: "'Source Serif 4', Georgia, serif" },
  sans: { label: 'Source Sans', css: "'Source Sans 3', system-ui, sans-serif" },
  system: { label: 'System', css: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
};
const hasHL = typeof CSS !== 'undefined' && !!CSS.highlights && typeof Highlight !== 'undefined';

const I = {
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  toc: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  aa: '<svg viewBox="0 0 24 24"><path d="M3 18l5-12 5 12M4.8 14h6.4" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M14.5 18l3.2-8 3.3 8M15.5 15.5h4.4" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  tts: '<svg viewBox="0 0 24 24"><path d="M4 14v-2a8 8 0 0 1 16 0v2" stroke="currentColor" stroke-width="1.9" fill="none"/><rect x="3" y="13" width="4" height="7" rx="1.5" fill="currentColor"/><rect x="17" y="13" width="4" height="7" rx="1.5" fill="currentColor"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  translate: '<svg viewBox="0 0 24 24"><path d="M4 5h8M8 3v2m2.5 0c-.8 3.5-3 6.5-6.5 8m2-4.5c1 1.8 2.6 3.3 4.5 4.3" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/><path d="M12.5 21l4-10 4 10m-6.8-3h5.6" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  speak: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a4.5 4.5 0 0 1 0 7" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
};

export async function openReader(bookId, mount) {
  const book = await db.get('books', bookId);
  const content = book && await db.get('contents', bookId);
  if (!book || !content) {
    toast('Buch nicht gefunden', { type: 'error' });
    location.hash = '#/library';
    return () => {};
  }

  // ---------- Zustand ----------
  const n = content.chapters.length;
  const charStart = [];
  book.chapters.reduce((acc, c, i) => { charStart[i] = acc; return acc + (c.chars || 0); }, 0);
  const total = Math.max(1, book.totalChars || 1);
  const imgUrls = new Map();
  let ch = clamp(book.pos?.ch || 0, 0, n - 1);
  let page = 0;
  let pages = 1;
  let pageW = 0;
  let blocks = [];
  let lang = book.lang || 'en';
  let savedSet = new Set();
  const cleanups = [];

  // ---------- DOM ----------
  const root = el('div', { class: 'reader ui-visible', 'data-mode': settings.mode });
  root.innerHTML = `
    <header class="r-top">
      <button class="icon-btn" data-act="back" aria-label="Zur Bibliothek">${I.back}</button>
      <div class="r-title"><strong>${escapeHtml(book.title)}</strong><span data-slot="chap"></span></div>
      <button class="icon-btn" data-act="toc" aria-label="Inhaltsverzeichnis" title="Inhalt">${I.toc}</button>
      <button class="icon-btn" data-act="tts" aria-label="Vorlesen" title="Vorlesen">${I.tts}</button>
      <button class="icon-btn" data-act="aa" aria-label="Darstellung & Übersetzung" title="Darstellung">${I.aa}</button>
    </header>
    <div class="r-slim r-slim-top" data-slot="slimtop"></div>
    <div class="r-viewport" tabindex="-1">
      <div class="r-clip">
        <article class="book-text" data-slot="article"></article>
        <div class="r-chap-end" data-slot="chapend"></div>
      </div>
      <button class="r-side prev" data-act="prev" aria-label="Vorherige Seite">${I.prev}</button>
      <button class="r-side next" data-act="next" aria-label="Nächste Seite">${I.next}</button>
    </div>
    <div class="r-slim r-slim-bottom"><span data-slot="pct"></span><span data-slot="pageinfo"></span><span data-slot="left"></span></div>
    <footer class="r-bottom">
      <button class="icon-btn" data-act="prevch" aria-label="Vorheriges Kapitel" title="Vorheriges Kapitel">${I.prev}</button>
      <div class="r-range-wrap">
        <input type="range" min="0" max="1000" step="1" data-slot="range" aria-label="Position im Buch">
        <div class="r-range-label" data-slot="rangelabel"></div>
      </div>
      <button class="icon-btn" data-act="nextch" aria-label="Nächstes Kapitel" title="Nächstes Kapitel">${I.next}</button>
    </footer>
    <div class="sel-bar" hidden>
      <button data-act="sel-tr">${I.translate}<span>Übersetzen</span></button>
      <button data-act="sel-speak">${I.speak}<span>Anhören</span></button>
    </div>
    <div class="tts-bar" hidden>
      <button class="icon-btn" data-act="tts-prev" aria-label="Vorheriger Satz">${I.prev}</button>
      <button class="icon-btn big" data-act="tts-toggle" aria-label="Pause">${I.pause}</button>
      <button class="icon-btn" data-act="tts-next" aria-label="Nächster Satz">${I.next}</button>
      <button class="chip-btn" data-act="tts-rate">1.0×</button>
      <button class="icon-btn" data-act="tts-stop" aria-label="Vorlesen beenden">${I.close}</button>
    </div>
  `;
  mount.replaceChildren(root);
  const slot = (s) => root.querySelector(`[data-slot="${s}"]`);
  const viewport = root.querySelector('.r-viewport');
  const clip = root.querySelector('.r-clip');
  const article = slot('article');
  const selBar = root.querySelector('.sel-bar');
  const ttsBar = root.querySelector('.tts-bar');
  const range = slot('range');
  article.lang = lang;

  // ---------- Darstellung ----------
  function applyStyles() {
    const s = settings;
    root.dataset.mode = s.mode;
    root.style.setProperty('--fs', s.fontSize + 'px');
    root.style.setProperty('--lh', s.lineHeight);
    root.style.setProperty('--book-font', (FONTS[s.font] || FONTS.literata).css);
    root.style.setProperty('--align', s.justify ? 'justify' : 'start');
    root.dataset.justify = s.justify;
  }

  function marginPx() {
    const m = isMobile() ? { s: 20, m: 32, l: 48 } : { s: 28, m: 56, l: 96 };
    return m[settings.margin] || m.m;
  }

  function layout() {
    const V = viewport.clientWidth;
    const H = viewport.clientHeight;
    const gap = Math.round(marginPx() / 2) * 2;
    const colMax = Math.round(settings.fontSize * 34);
    if (settings.mode === 'paged') {
      const cols = settings.spread === 'auto' && V >= 900 && V / H > 1.2 ? 2 : 1;
      let W = Math.min(V, cols * colMax + cols * gap);
      W = Math.floor(W / 2) * 2;
      pageW = W;
      root.style.setProperty('--page-w', W + 'px');
      root.style.setProperty('--page-h', H + 'px');
      root.style.setProperty('--cols', cols);
      root.style.setProperty('--gap', gap + 'px');
      article.style.transition = 'none';
      countPages();
      page = clamp(page, 0, pages - 1);
      setTransform();
      // Transition nach dem Layout wieder einschalten
      requestAnimationFrame(() => { article.style.transition = ''; });
    } else {
      root.style.setProperty('--page-w', Math.min(V, colMax + gap) + 'px');
      root.style.setProperty('--gap', gap + 'px');
      root.style.removeProperty('--cols');
      article.style.transform = '';
      pages = 1;
    }
  }

  function countPages() {
    let mark = article.querySelector('.end-mark');
    if (!mark) {
      mark = document.createElement('span');
      mark.className = 'end-mark';
      const last = article.lastElementChild;
      (last && last.matches(TEXT_SEL) ? last : article).append(mark);
    }
    const x = mark.getBoundingClientRect().left - article.getBoundingClientRect().left;
    pages = Math.max(1, Math.floor((x + 1) / pageW) + 1);
  }

  function setTransform() {
    article.style.transform = `translateX(${-page * pageW}px)`;
  }

  // ---------- Kapitel rendern ----------
  function imgUrl(key) {
    if (!imgUrls.has(key)) {
      const blob = content.images?.[key];
      imgUrls.set(key, blob ? URL.createObjectURL(blob) : '');
    }
    return imgUrls.get(key);
  }

  function chapterTitle(i) {
    return book.chapters[i]?.title || `Kapitel ${i + 1}`;
  }

  /**
   * @param {number} i Kapitel
   * @param {object} at { blk } | { frac } | { end: true } | { frag } | { el }
   */
  async function render(i, at = { blk: 0 }, { keepTts = false } = {}) {
    if (!keepTts) ttsStop();
    popup.close();
    hideSelBar();
    ch = clamp(i, 0, n - 1);
    article.innerHTML = content.chapters[ch].html;
    for (const img of article.querySelectorAll('img[data-img]')) {
      const u = imgUrl(img.dataset.img);
      if (u) img.src = u; else img.remove();
    }
    blocks = [...article.querySelectorAll(BLOCK_SEL)];
    slot('chap').textContent = chapterTitle(ch);
    slot('slimtop').textContent = chapterTitle(ch);
    slot('chapend').innerHTML = settings.mode === 'scroll'
      ? (ch < n - 1
        ? `<p>Ende von „${escapeHtml(chapterTitle(ch))}“</p><button class="btn primary" data-act="nextch">Nächstes Kapitel: ${escapeHtml(chapterTitle(ch + 1))} →</button>`
        : '<p>🎉 Ende des Buches</p>')
      : '';
    page = 0;
    viewport.scrollTop = 0;
    layout();
    goTo(at);
    markSaved();
    updateInfo();
  }

  function goTo(at) {
    if (at.end) {
      if (settings.mode === 'paged') { page = pages - 1; setTransformNoAnim(); }
      else viewport.scrollTop = viewport.scrollHeight;
    } else if (at.frac != null) {
      if (settings.mode === 'paged') { page = clamp(Math.round(at.frac * (pages - 1)), 0, pages - 1); setTransformNoAnim(); }
      else viewport.scrollTop = at.frac * (viewport.scrollHeight - viewport.clientHeight);
    } else if (at.frag) {
      const t = article.querySelector('#' + CSS.escape(at.frag));
      if (t) goToEl(t);
    } else if (at.el) {
      goToEl(at.el);
    } else {
      const b = blocks[at.blk || 0];
      if (b && at.blk) goToEl(b);
    }
  }

  function setTransformNoAnim() {
    article.style.transition = 'none';
    setTransform();
    requestAnimationFrame(() => { article.style.transition = ''; });
  }

  function goToEl(target, smooth = false) {
    const r = target.getClientRects()[0] || target.getBoundingClientRect();
    if (settings.mode === 'paged') {
      const x = r.left - article.getBoundingClientRect().left;
      const p = clamp(Math.floor((x + 1) / pageW), 0, pages - 1);
      if (p !== page) { page = p; smooth ? setTransform() : setTransformNoAnim(); }
    } else {
      const vr = viewport.getBoundingClientRect();
      viewport.scrollTo({ top: viewport.scrollTop + r.top - vr.top - 24, behavior: smooth ? 'smooth' : 'auto' });
    }
  }

  function firstVisibleBlock() {
    if (settings.mode === 'paged') {
      const cr = clip.getBoundingClientRect();
      for (let i = 0; i < blocks.length; i++) {
        for (const r of blocks[i].getClientRects()) {
          if (r.width > 0 && r.right > cr.left + 2 && r.left < cr.right - 2) return i;
        }
      }
      return 0;
    }
    const vr = viewport.getBoundingClientRect();
    let lo = 0;
    let hi = blocks.length - 1;
    let ans = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (blocks[mid].getBoundingClientRect().bottom > vr.top + 4) { ans = mid; hi = mid - 1; } else lo = mid + 1;
    }
    return ans;
  }

  function chapterFrac() {
    if (settings.mode === 'paged') return pages > 1 ? page / pages : 0;
    const max = viewport.scrollHeight - viewport.clientHeight;
    return max > 0 ? viewport.scrollTop / max : 0;
  }

  function bookPct() {
    return clamp((charStart[ch] + chapterFrac() * (book.chapters[ch]?.chars || 0)) / total, 0, 1);
  }

  function updateInfo() {
    const pct = bookPct();
    slot('pct').textContent = Math.round(pct * 100) + ' %';
    const chars = book.chapters[ch]?.chars || 0;
    if (settings.mode === 'paged') {
      slot('pageinfo').textContent = `Seite ${page + 1} / ${pages}`;
      const left = chars * (1 - (page + 1) / pages);
      slot('left').textContent = left > 300 ? `noch ${fmtMinutes(left)} im Kapitel` : (ch < n - 1 ? 'Kapitelende' : 'Buchende');
    } else {
      slot('pageinfo').textContent = `Kapitel ${ch + 1} / ${n}`;
      const left = chars * (1 - chapterFrac());
      slot('left').textContent = left > 300 ? `noch ${fmtMinutes(left)} im Kapitel` : '';
    }
    if (document.activeElement !== range) range.value = Math.round(pct * 1000);
    savePos();
  }

  const savePos = debounce(async () => {
    const blk = firstVisibleBlock();
    book.pos = { ch, blk, pct: bookPct() };
    book.lastRead = Date.now();
    try { await db.put('books', book); } catch { /* ignorieren */ }
  }, 700);

  // ---------- Navigation ----------
  function next() {
    popup.close();
    if (settings.mode === 'paged') {
      if (page < pages - 1) { page++; setTransform(); updateInfo(); hideUi(); }
      else if (ch < n - 1) render(ch + 1, { blk: 0 });
      else toast('Ende des Buches 🎉');
    } else {
      viewport.scrollBy({ top: viewport.clientHeight * 0.9, behavior: 'smooth' });
    }
  }
  function prev() {
    popup.close();
    if (settings.mode === 'paged') {
      if (page > 0) { page--; setTransform(); updateInfo(); hideUi(); }
      else if (ch > 0) render(ch - 1, { end: true });
    } else {
      viewport.scrollBy({ top: -viewport.clientHeight * 0.9, behavior: 'smooth' });
    }
  }
  function goPct(p) {
    const target = p * total;
    let i = 0;
    while (i < n - 1 && charStart[i + 1] <= target) i++;
    const chars = book.chapters[i]?.chars || 1;
    const frac = clamp((target - charStart[i]) / chars, 0, 1);
    if (i === ch) { goTo({ frac }); updateInfo(); } else render(i, { frac });
  }

  function showUi() { root.classList.add('ui-visible'); }
  function hideUi() { root.classList.remove('ui-visible'); }
  let hideTimer = 0;
  function toggleUi() { clearTimeout(hideTimer); root.classList.toggle('ui-visible'); }

  // ---------- Wort erkennen ----------
  function caretAt(x, y) {
    if (document.caretPositionFromPoint) {
      const p = document.caretPositionFromPoint(x, y);
      return p && { node: p.offsetNode, offset: p.offset };
    }
    if (document.caretRangeFromPoint) {
      const r = document.caretRangeFromPoint(x, y);
      return r && { node: r.startContainer, offset: r.startOffset };
    }
    return null;
  }

  function wordAt(x, y) {
    const c = caretAt(x, y);
    if (!c || !c.node || c.node.nodeType !== 3 || !article.contains(c.node)) return null;
    const node = c.node;
    for (const s of wordSegments(node.data, lang)) {
      if (!s.isWordLike) continue;
      const end = s.index + s.segment.length;
      if (c.offset < s.index || c.offset > end) continue;
      const r = document.createRange();
      r.setStart(node, s.index);
      r.setEnd(node, end);
      const hit = [...r.getClientRects()].some((b) => x >= b.left - 4 && x <= b.right + 4 && y >= b.top - 4 && y <= b.bottom + 4);
      if (hit) return { range: r, word: s.segment, node, index: s.index };
    }
    return null;
  }

  function sentenceOf(node, index) {
    const block = node.parentElement?.closest(TEXT_SEL) || node.parentElement;
    if (!block) return '';
    const r = document.createRange();
    r.setStart(block, 0);
    r.setEnd(node, index);
    const off = r.toString().length;
    const text = block.textContent;
    for (const s of sentenceSegments(text, lang)) {
      if (off >= s.index && off < s.index + s.segment.length) {
        let sent = s.segment.replace(/\s+/g, ' ').trim();
        if (sent.length > 420) {
          const local = off - s.index;
          sent = '…' + s.segment.slice(Math.max(0, local - 200), local + 200).replace(/\s+/g, ' ').trim() + '…';
        }
        return sent;
      }
    }
    return '';
  }

  function highlight(name, ranges) {
    if (!hasHL) return;
    if (!ranges || !ranges.length) CSS.highlights.delete(name);
    else CSS.highlights.set(name, new Highlight(...ranges));
  }

  async function markSaved() {
    highlight('saved', null);
    if (!settings.markSaved || !hasHL) return;
    savedSet = await savedWordSet(lang);
    if (!savedSet.size) return;
    const ranges = [];
    const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
    let node;
    let count = 0;
    while ((node = walker.nextNode()) && count < 40000) {
      for (const s of wordSegments(node.data, lang)) {
        count++;
        if (s.isWordLike && savedSet.has(s.segment.toLowerCase())) {
          const r = new Range();
          r.setStart(node, s.index);
          r.setEnd(node, s.index + s.segment.length);
          ranges.push(r);
        }
      }
    }
    highlight('saved', ranges);
  }

  function setLang(l) {
    lang = l;
    book.lang = l;
    article.lang = l;
    db.put('books', book);
    markSaved();
  }

  function lookup(hit) {
    const word = cleanWord(hit.word);
    if (!word) return;
    highlight('lookup', [hit.range]);
    const rects = hit.range.getClientRects();
    const rect = rects[0] || hit.range.getBoundingClientRect();
    popup.openWord({
      word,
      lang,
      rect,
      sentence: sentenceOf(hit.node, hit.index),
      bookId: book.id,
      bookTitle: book.title,
      onLangChange: setLang,
      onSaved: markSaved,
      onClose: () => highlight('lookup', null),
    });
  }

  // ---------- Links / Fußnoten ----------
  function findTarget(href) {
    const [pathRaw, frag] = href.split('#');
    const path = pathRaw || content.chapters[ch].path;
    const cands = content.chapters.map((c, i) => [c, i]).filter(([c]) => c.path === path);
    const list = cands.length ? cands : content.chapters.map((c, i) => [c, i]);
    if (frag) {
      const hit = list.find(([c]) => c.html.includes(`id="${frag}"`));
      if (hit) return { ch: hit[1], frag };
    }
    return cands.length ? { ch: cands[0][1], frag: '' } : null;
  }

  function handleLink(a) {
    const href = a.dataset.href;
    if (/^(https?:|mailto:)/i.test(href)) {
      if (confirm('Externen Link öffnen?\n' + href)) window.open(href, '_blank', 'noopener');
      return;
    }
    const t = findTarget(href);
    if (!t) return;
    if (t.frag) {
      const tpl = document.createElement('template');
      tpl.innerHTML = content.chapters[t.ch].html;
      let target = tpl.content.getElementById(t.frag);
      if (target && !target.textContent.trim()) target = target.closest('p,li,div,aside') || target.parentElement;
      const txt = target?.textContent.trim() || '';
      const looksLikeNote = a.classList.contains('note') || /^[\[(]?\d{1,3}[\])]?$|^\*+$/.test(a.textContent.trim());
      if (target && looksLikeNote && txt.length < 1500) {
        for (const img of target.querySelectorAll('img[data-img]')) img.src = imgUrl(img.dataset.img);
        popup.openNote({ html: target.innerHTML, rect: a.getBoundingClientRect(), lang, onJump: () => jump(t) });
        return;
      }
    }
    jump(t);
  }

  function jump(t) {
    if (t.ch === ch && t.frag) goTo({ frag: t.frag });
    else render(t.ch, t.frag ? { frag: t.frag } : { blk: 0 });
    updateInfo();
  }

  // ---------- Klick / Tippen ----------
  let swipedAt = 0;
  article.addEventListener('click', onTap);
  viewport.addEventListener('click', (e) => { if (!article.contains(e.target)) onTap(e); });

  function onTap(e) {
    clearTimeout(hideTimer);
    if (Date.now() - swipedAt < 400) return;
    if (e.target.closest('.r-side, .r-chap-end button')) return;
    const sel = getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim()) return;
    const a = e.target.closest('a[data-href]');
    if (a) { e.preventDefault(); handleLink(a); return; }
    const hit = wordAt(e.clientX, e.clientY);
    if (hit) { lookup(hit); return; }
    if (popup.justClosed()) return;
    // kein Wort: Seitenränder blättern, Mitte blendet Leisten ein/aus
    const vr = viewport.getBoundingClientRect();
    const rel = (e.clientX - vr.left) / vr.width;
    if (settings.mode === 'paged' && rel < 0.18) prev();
    else if (settings.mode === 'paged' && rel > 0.82) next();
    else toggleUi();
  }

  // Wischen (Touch) im Seitenmodus
  let sx = 0; let sy = 0; let dragging = false; let tracking = false; let st = 0;
  viewport.addEventListener('pointerdown', (e) => {
    if (settings.mode !== 'paged' || e.pointerType === 'mouse') return;
    tracking = true; dragging = false; sx = e.clientX; sy = e.clientY; st = performance.now();
  });
  viewport.addEventListener('pointermove', (e) => {
    if (!tracking) return;
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (!dragging) {
      const sel = getSelection();
      if (sel && !sel.isCollapsed) { tracking = false; return; }
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        dragging = true;
        article.style.transition = 'none';
        popup.close();
        try { viewport.setPointerCapture(e.pointerId); } catch { /* ignorieren */ }
      } else return;
    }
    let off = dx;
    if ((page === 0 && ch === 0 && dx > 0) || (page === pages - 1 && ch === n - 1 && dx < 0)) off = dx / 3;
    article.style.transform = `translateX(${-page * pageW + off}px)`;
  });
  const endSwipe = (e) => {
    if (!tracking) return;
    tracking = false;
    if (!dragging) return;
    dragging = false;
    swipedAt = Date.now();
    article.style.transition = '';
    const dx = e.clientX - sx;
    const fast = Math.abs(dx) > 30 && performance.now() - st < 250;
    if (e.type !== 'pointercancel' && (dx < -60 || (fast && dx < 0))) next();
    else if (e.type !== 'pointercancel' && (dx > 60 || (fast && dx > 0))) prev();
    else setTransform();
  };
  viewport.addEventListener('pointerup', endSwipe);
  viewport.addEventListener('pointercancel', endSwipe);

  // Mausrad im Seitenmodus
  let wheelLock = 0;
  viewport.addEventListener('wheel', (e) => {
    if (settings.mode !== 'paged' || popup.isOpen()) return;
    e.preventDefault();
    if (Date.now() < wheelLock || Math.abs(e.deltaY) + Math.abs(e.deltaX) < 8) return;
    wheelLock = Date.now() + 380;
    (e.deltaY || e.deltaX) > 0 ? next() : prev();
  }, { passive: false });

  viewport.addEventListener('scroll', debounce(() => { if (settings.mode === 'scroll') { updateInfo(); } }, 120), { passive: true });
  let lastScroll = 0;
  viewport.addEventListener('scroll', () => {
    if (settings.mode !== 'scroll') return;
    if (Math.abs(viewport.scrollTop - lastScroll) > 60) { hideUi(); popup.close(); lastScroll = viewport.scrollTop; }
  }, { passive: true });

  // Tastatur
  const onKey = (e) => {
    if (document.querySelector('dialog[open]') || /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName)) return;
    if (['ArrowRight', 'PageDown'].includes(e.key) || (e.key === ' ' && !e.shiftKey)) { e.preventDefault(); next(); }
    else if (['ArrowLeft', 'PageUp'].includes(e.key) || (e.key === ' ' && e.shiftKey)) { e.preventDefault(); prev(); }
    else if (e.key === 'Escape' && !popup.isOpen()) location.hash = '#/library';
  };
  document.addEventListener('keydown', onKey);
  cleanups.push(() => document.removeEventListener('keydown', onKey));

  // ---------- Markierter Text ----------
  let selText = '';
  let selRect = null;
  let selSentence = '';
  const onSel = debounce(() => {
    const sel = getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return hideSelBar();
    const r = sel.getRangeAt(0);
    if (!article.contains(r.commonAncestorContainer)) return hideSelBar();
    const text = sel.toString().replace(/\s+/g, ' ').trim();
    if (text.length < 2) return hideSelBar();
    if (popup.isOpen() && !text.includes(' ')) return; // Doppelklick auf ein Wort
    selText = text;
    selRect = r.getBoundingClientRect();
    selSentence = r.startContainer.nodeType === 3 ? sentenceOf(r.startContainer, r.startOffset) : '';
    showSelBar(selRect);
  }, 280);
  document.addEventListener('selectionchange', onSel);
  cleanups.push(() => document.removeEventListener('selectionchange', onSel));

  function showSelBar(rect) {
    selBar.hidden = false;
    const w = selBar.offsetWidth;
    const h = selBar.offsetHeight;
    // unter der Markierung (auf dem Handy liegt das System-Menü oben)
    let top = rect.bottom + 12;
    if (top + h > innerHeight - 10) top = Math.max(10, rect.top - h - 12);
    selBar.style.top = clamp(top, 10, innerHeight - h - 10) + 'px';
    selBar.style.left = clamp(rect.left + rect.width / 2 - w / 2, 8, innerWidth - w - 8) + 'px';
  }
  function hideSelBar() { selBar.hidden = true; }


  // ---------- Vorlesen (TTS) ----------
  const tts = { on: false, paused: false, list: [], idx: 0, rate: settings.rate || 1 };

  function buildSentences(fromBlock = 0) {
    const out = [];
    const leafs = [...article.querySelectorAll(TEXT_SEL)].filter((b) => !b.querySelector(TEXT_SEL));
    const startEl = blocks[fromBlock];
    let started = !startEl;
    for (const b of leafs) {
      if (!started) {
        if (b === startEl || startEl.contains(b) || b.contains(startEl) ||
          (startEl.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)) started = true;
        else continue;
      }
      const nodes = [];
      const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
      let t; let acc = 0; let text = '';
      while ((t = w.nextNode())) { nodes.push({ t, start: acc }); acc += t.data.length; text += t.data; }
      if (!text.trim()) continue;
      const pos = (off) => {
        let k = nodes.length - 1;
        while (k > 0 && nodes[k].start > off) k--;
        return [nodes[k].t, Math.min(off - nodes[k].start, nodes[k].t.data.length)];
      };
      for (const s of sentenceSegments(text, lang)) {
        const raw = s.segment;
        const lead = raw.length - raw.trimStart().length;
        const clean = raw.trim();
        if (!clean || !/[\p{L}\p{N}]/u.test(clean)) continue;
        const a = s.index + lead;
        const z = a + clean.length;
        const r = document.createRange();
        r.setStart(...pos(a));
        r.setEnd(...pos(z));
        out.push({ text: clean, range: r });
      }
    }
    return out;
  }

  function ttsStart() {
    if (tts.on) { ttsStop(); return; }
    popup.close();
    tts.on = true;
    tts.paused = false;
    tts.list = buildSentences(firstVisibleBlock());
    tts.idx = 0;
    ttsBar.hidden = false;
    root.querySelector('[data-act="tts"]').classList.add('on');
    ttsBar.querySelector('[data-act="tts-rate"]').textContent = tts.rate.toFixed(1).replace('.0', '') + '×';
    ttsSpeak();
  }

  async function ttsSpeak() {
    if (!tts.on || tts.paused) return;
    if (tts.idx >= tts.list.length) {
      if (ch < n - 1) {
        await render(ch + 1, { blk: 0 }, { keepTts: true });
        tts.list = buildSentences(0);
        tts.idx = 0;
      } else { ttsStop(); toast('Ende des Buches'); return; }
    }
    const item = tts.list[tts.idx];
    if (!item) { ttsStop(); return; }
    highlight('tts', [item.range]);
    ensureVisible(item.range);
    ttsBar.querySelector('[data-act="tts-toggle"]').innerHTML = I.pause;
    const my = tts.idx;
    const myList = tts.list;
    try {
      await speak(item.text, lang, { rate: tts.rate });
    } catch (e) {
      toast('Vorlesen nicht möglich: ' + e.message, { type: 'error' });
      ttsStop();
      return;
    }
    if (!tts.on || tts.paused || tts.list !== myList || tts.idx !== my) return;
    tts.idx++;
    ttsSpeak();
  }

  function ensureVisible(r) {
    const rect = r.getClientRects()[0];
    if (!rect) return;
    if (settings.mode === 'paged') {
      const x = rect.left - article.getBoundingClientRect().left;
      const p = clamp(Math.floor((x + 1) / pageW), 0, pages - 1);
      if (p !== page) { page = p; setTransform(); updateInfo(); }
    } else {
      const vr = viewport.getBoundingClientRect();
      if (rect.top < vr.top + 40 || rect.bottom > vr.bottom - 60) {
        viewport.scrollTo({ top: viewport.scrollTop + rect.top - vr.top - vr.height / 3, behavior: 'smooth' });
      }
    }
  }

  function ttsStop() {
    if (!tts.on) return;
    tts.on = false;
    stopSpeech();
    highlight('tts', null);
    ttsBar.hidden = true;
    root.querySelector('[data-act="tts"]')?.classList.remove('on');
  }

  function ttsToggle() {
    if (!tts.on) return;
    tts.paused = !tts.paused;
    if (tts.paused) {
      stopSpeech();
      ttsBar.querySelector('[data-act="tts-toggle"]').innerHTML = I.play;
    } else ttsSpeak();
  }

  function ttsJump(d) {
    if (!tts.on) return;
    tts.idx = clamp(tts.idx + d, 0, tts.list.length - 1);
    tts.paused = false;
    stopSpeech();
    ttsSpeak();
  }

  // ---------- Buttons ----------
  root.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    switch (act) {
      case 'back': location.hash = '#/library'; break;
      case 'prev': prev(); break;
      case 'next': next(); break;
      case 'prevch': if (ch > 0) render(ch - 1, { blk: 0 }); break;
      case 'nextch': if (ch < n - 1) render(ch + 1, { blk: 0 }); break;
      case 'toc': openToc(); break;
      case 'aa': openDisplay(); break;
      case 'tts': ttsStart(); break;
      case 'tts-toggle': ttsToggle(); break;
      case 'tts-prev': ttsJump(-1); break;
      case 'tts-next': ttsJump(1); break;
      case 'tts-stop': ttsStop(); break;
      case 'tts-rate': {
        const rates = [0.6, 0.8, 1, 1.2, 1.5];
        tts.rate = rates[(rates.indexOf(tts.rate) + 1) % rates.length] || 1;
        e.target.closest('[data-act]').textContent = String(tts.rate).replace('.0', '') + '×';
        ttsJump(0);
        break;
      }
      case 'sel-tr': {
        hideSelBar();
        popup.openPhrase({ text: selText, lang, rect: selRect, sentence: selSentence, bookId: book.id, bookTitle: book.title, onSaved: markSaved });
        break;
      }
      case 'sel-speak': speak(selText, lang).catch(() => {}); break;
      default: break;
    }
  });

  range.addEventListener('input', () => {
    const p = range.value / 1000;
    const target = p * total;
    let i = 0;
    while (i < n - 1 && charStart[i + 1] <= target) i++;
    slot('rangelabel').textContent = `${Math.round(p * 100)} % · ${chapterTitle(i)}`;
    slot('rangelabel').classList.add('show');
  });
  range.addEventListener('change', () => {
    slot('rangelabel').classList.remove('show');
    goPct(range.value / 1000);
    range.blur();
  });

  // ---------- Inhaltsverzeichnis ----------
  function openToc() {
    const list = el('nav', { class: 'toc-list', 'aria-label': 'Inhaltsverzeichnis' });
    const toc = book.toc?.length ? book.toc : book.chapters.map((c, i) => ({ title: c.title, ch: i, frag: '', depth: 0 }));
    let currentBtn = null;
    toc.forEach((t) => {
      const b = el('button', {
        class: 'toc-item' + (t.ch === ch ? ' current' : ''),
        style: `--depth:${Math.min(t.depth || 0, 3)}`,
        onclick: () => { dlg.close(); jump({ ch: t.ch, frag: t.frag }); },
      }, el('span', {}, t.title || `Kapitel ${t.ch + 1}`), el('small', {}, `${Math.round((charStart[t.ch] / total) * 100)} %`));
      if (t.ch === ch && !currentBtn) currentBtn = b;
      list.append(b);
    });
    const info = el('div', { class: 'toc-book' },
      el('strong', {}, book.title), book.author ? el('span', {}, book.author) : null,
      el('span', { class: 'muted' }, `${langName(lang)} · ${fmtMinutes(total)} Lesezeit gesamt`));
    const dlg = openSheet({ title: 'Inhalt', body: el('div', {}, info, list), side: 'left' });
    requestAnimationFrame(() => currentBtn?.scrollIntoView({ block: 'center' }));
  }

  // ---------- Darstellung & Übersetzung ----------
  function openDisplay() {
    const anchor = firstVisibleBlock();
    const relayout = () => { applyStyles(); render(ch, { blk: anchor }, { keepTts: false }); };
    const fsLabel = el('span', { class: 'fs-val' }, settings.fontSize + ' px');
    const setFs = (d) => {
      const v = clamp(settings.fontSize + d, 13, 34);
      setSetting({ fontSize: v });
      fsLabel.textContent = v + ' px';
      relayout();
    };
    const langOpts = [...new Set([lang, ...LANGS])].map((l) => el('option', { value: l, selected: l === lang || null }, `${langName(l)} (${l})`));
    const langSel = el('select', { class: 'select', onchange: (e) => setLang(e.target.value) }, langOpts);
    const tgtSel = el('select', { class: 'select', onchange: (e) => setSetting({ target: e.target.value }) },
      LANGS.map((l) => el('option', { value: l, selected: l === settings.target || null }, `${langName(l)} (${l})`)));

    const body = el('div', { class: 'display-panel' },
      field('Thema', segmented([
        { value: 'light', label: 'Hell', html: '<span class="sw sw-light"></span>Hell' },
        { value: 'sepia', label: 'Sepia', html: '<span class="sw sw-sepia"></span>Sepia' },
        { value: 'dark', label: 'Dunkel', html: '<span class="sw sw-dark"></span>Dunkel' },
        { value: 'black', label: 'Schwarz', html: '<span class="sw sw-black"></span>Schwarz' },
      ], settings.theme === 'auto' ? null : settings.theme, (v) => setSetting({ theme: v }), { className: 'themes' })),
      field('Schrift', segmented(Object.entries(FONTS).map(([k, f]) => ({ value: k, label: f.label, style: `font-family:${f.css}` })),
        settings.font, (v) => { setSetting({ font: v }); relayout(); }, { className: 'fonts' })),
      field('Schriftgröße', el('div', { class: 'stepper' },
        el('button', { class: 'btn', 'aria-label': 'Kleiner', onclick: () => setFs(-1) }, 'A−'),
        fsLabel,
        el('button', { class: 'btn', 'aria-label': 'Größer', onclick: () => setFs(1) }, 'A+'))),
      field('Zeilenabstand', segmented([{ value: 1.4, label: 'Eng' }, { value: 1.6, label: 'Normal' }, { value: 1.85, label: 'Weit' }],
        settings.lineHeight, (v) => { setSetting({ lineHeight: v }); relayout(); })),
      field('Seitenrand', segmented([{ value: 's', label: 'Schmal' }, { value: 'm', label: 'Mittel' }, { value: 'l', label: 'Breit' }],
        settings.margin, (v) => { setSetting({ margin: v }); relayout(); })),
      field('Lesemodus', segmented([{ value: 'paged', label: '📖 Seiten' }, { value: 'scroll', label: '📜 Scrollen' }],
        settings.mode, (v) => { setSetting({ mode: v }); relayout(); })),
      toggle('Blocksatz mit Silbentrennung', settings.justify, (v) => { setSetting({ justify: v }); relayout(); }),
      toggle('Zwei Seiten nebeneinander', settings.spread === 'auto', (v) => { setSetting({ spread: v ? 'auto' : 'one' }); relayout(); }, 'Nur auf breiten Bildschirmen (Laptop quer)'),
      el('hr'),
      field('Sprache des Buches', langSel, 'Wichtig für richtige Aussprache und Übersetzung'),
      field('Übersetzen nach', tgtSel),
      toggle('Wort beim Antippen aussprechen', settings.autoSpeak, (v) => setSetting({ autoSpeak: v })),
      toggle('Satz automatisch mitübersetzen', settings.autoSentence, (v) => setSetting({ autoSentence: v })),
      toggle('Gespeicherte Wörter markieren', settings.markSaved, (v) => { setSetting({ markSaved: v }); markSaved(); }),
    );
    openSheet({ title: 'Darstellung', body, side: 'right' });
  }

  // ---------- Start ----------
  applyStyles();
  const ro = new ResizeObserver(debounce(() => {
    const anchor = firstVisibleBlock();
    layout();
    goTo({ blk: anchor });
    updateInfo();
  }, 150));
  ro.observe(viewport);
  cleanups.push(() => ro.disconnect());

  const offVocab = onVocab(() => markSaved());
  cleanups.push(offVocab);


  await render(ch, { blk: book.pos?.blk || 0 });
  // Webfonts nachladen -> neu umbrechen
  document.fonts?.ready.then(() => {
    const anchor = firstVisibleBlock();
    layout();
    goTo({ blk: anchor || book.pos?.blk || 0 });
    updateInfo();
  });
  hideTimer = setTimeout(hideUi, 2500);
  viewport.focus({ preventScroll: true });

  // Aufräumen beim Verlassen
  return () => {
    savePos.flush();
    ttsStop();
    popup.stopAll();
    highlight('saved', null);
    highlight('lookup', null);
    cleanups.forEach((f) => f());
    for (const u of imgUrls.values()) if (u) URL.revokeObjectURL(u);
  };
}
