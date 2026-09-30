// Der Leser: Seiten blättern oder scrollen, Wort antippen, Text markieren, Suchen,
// Lesezeichen & Markierungen, zweisprachig lesen, Hörbuch-Modus (Vorlesen)
import * as db from './db.js';
import { settings, setSetting } from './settings.js';
import * as popup from './popup.js';
import { speak, stop as stopSpeech } from './speech.js';
import { translateText } from './translate.js';
import { savedWordSet, onVocab } from './vocabStore.js';
import { addStat } from './statsStore.js';
import { current as abCurrent, toggle as abToggle } from './audioPlayer.js';
import { el, escapeHtml, debounce, clamp, wordSegments, sentenceSegments, cleanWord, isMobile, isTouch, langName, LANGS, fmtMinutes, toast, uid } from './util.js';
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
const COLORS = ['yellow', 'green', 'blue', 'pink'];
const COLOR_NAMES = { yellow: 'Gelb', green: 'Grün', blue: 'Blau', pink: 'Rosa' };
const hasHL = typeof CSS !== 'undefined' && !!CSS.highlights && typeof Highlight !== 'undefined';

const I = {
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  toc: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  aa: '<svg viewBox="0 0 24 24"><path d="M3 18l5-12 5 12M4.8 14h6.4" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M14.5 18l3.2-8 3.3 8M15.5 15.5h4.4" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  tts: '<svg viewBox="0 0 24 24"><path d="M4 14v-2a8 8 0 0 1 16 0v2" stroke="currentColor" stroke-width="1.9" fill="none"/><rect x="3" y="13" width="4" height="7" rx="1.5" fill="currentColor"/><rect x="17" y="13" width="4" height="7" rx="1.5" fill="currentColor"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.9" fill="none"/><path d="M16 16l4 4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
  bi: '<svg viewBox="0 0 24 24"><path d="M3 6h9M3 10h9M3 14h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M13.5 20l3.5-8.5 3.5 8.5m-5.9-2.6h4.8" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bookmark: '<svg viewBox="0 0 24 24"><path d="M7 3.5h10v17l-5-3.6-5 3.6z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  translate: '<svg viewBox="0 0 24 24"><path d="M4 5h8M8 3v2m2.5 0c-.8 3.5-3 6.5-6.5 8m2-4.5c1 1.8 2.6 3.3 4.5 4.3" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/><path d="M12.5 21l4-10 4 10m-6.8-3h5.6" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  speak: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a4.5 4.5 0 0 1 0 7" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  note: '<svg viewBox="0 0 24 24"><path d="M5 4h14v12l-4 4H5z" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/><path d="M8.5 9h7M8.5 12.5h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
};

export async function openReader(bookId, mount, opts = {}) {
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
  let marks = [];
  try { marks = await db.getAllByIndex('marks', 'bookId', book.id); } catch { marks = []; }
  const cleanups = [];
  const targetLang = () => (lang === settings.target ? (settings.target2 === lang ? 'en' : settings.target2) : settings.target);

  // ---------- DOM ----------
  const root = el('div', { class: 'reader ui-visible', 'data-mode': settings.mode });
  root.innerHTML = `
    <header class="r-top">
      <button class="icon-btn" data-act="back" aria-label="Zur Bibliothek">${I.back}</button>
      <div class="r-title"><strong>${escapeHtml(book.title)}</strong><span data-slot="chap"></span></div>
      <button class="icon-btn" data-act="search" aria-label="Im Buch suchen" title="Suchen">${I.search}</button>
      <button class="icon-btn" data-act="toc" aria-label="Inhalt, Lesezeichen, Markierungen" title="Inhalt & Markierungen">${I.toc}</button>
      <button class="icon-btn" data-act="bi" aria-label="Zweisprachig lesen" title="Zweisprachig lesen">${I.bi}</button>
      <button class="icon-btn" data-act="tts" aria-label="Anhören (Hörbuch-Modus)" title="Anhören">${I.tts}</button>
      <button class="icon-btn" data-act="aa" aria-label="Darstellung & Übersetzung" title="Darstellung">${I.aa}</button>
    </header>
    <div class="r-slim r-slim-top"><span data-slot="slimtop"></span>
      <button class="r-bookmark" data-act="bookmark" aria-label="Lesezeichen setzen" title="Lesezeichen">${I.bookmark}</button></div>
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
      <span class="sel-sep"></span>
      ${COLORS.map((c) => `<button class="sel-color c-${c}" data-act="sel-mark" data-color="${c}" aria-label="${COLOR_NAMES[c]} markieren" title="${COLOR_NAMES[c]} markieren"></button>`).join('')}
    </div>
    <div class="tts-caption" hidden></div>
    <div class="tts-bar" hidden>
      <button class="icon-btn" data-act="tts-prev" aria-label="Vorheriger Satz">${I.prev}</button>
      <button class="icon-btn big" data-act="tts-toggle" aria-label="Pause">${I.pause}</button>
      <button class="icon-btn" data-act="tts-next" aria-label="Nächster Satz">${I.next}</button>
      <button class="chip-btn" data-act="tts-rate" title="Tempo">1×</button>
      <button class="chip-btn" data-act="tts-sleep" title="Schlaf-Timer">${I.moon}<span>Aus</span></button>
      <button class="chip-btn" data-act="tts-bi" title="Nach jedem Satz die Übersetzung vorlesen">+${escapeHtml(targetLang().toUpperCase())}</button>
      <button class="icon-btn" data-act="tts-stop" aria-label="Anhören beenden">${I.close}</button>
    </div>
  `;
  mount.replaceChildren(root);
  const slot = (s) => root.querySelector(`[data-slot="${s}"]`);
  const viewport = root.querySelector('.r-viewport');
  const clip = root.querySelector('.r-clip');
  const article = slot('article');
  const selBar = root.querySelector('.sel-bar');
  const ttsBar = root.querySelector('.tts-bar');
  const caption = root.querySelector('.tts-caption');
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
    root.querySelector('[data-act="bi"]').classList.toggle('on', !!s.bilingual);
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

  function setTransformNoAnim() {
    article.style.transition = 'none';
    setTransform();
    requestAnimationFrame(() => { article.style.transition = ''; });
  }

  /** Neu umbrechen, ohne dass sich die Leseposition verschiebt */
  function relayoutAnchored() {
    const anchor = firstVisibleBlock();
    layout();
    goTo({ blk: anchor });
    updateInfo();
  }

  // ---------- Text-Positionen (ohne eingefügte Übersetzungen) ----------
  function textWalker(rootNode = article) {
    return document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT, {
      acceptNode: (t) => (t.parentElement?.closest('.para-tr') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
  }

  function offsetOf(node, off) {
    const w = textWalker();
    let t;
    let acc = 0;
    while ((t = w.nextNode())) {
      if (t === node) return acc + off;
      acc += t.data.length;
    }
    return acc;
  }

  function blockOffset(block) {
    const w = textWalker(block);
    const first = w.nextNode();
    return first ? offsetOf(first, 0) : 0;
  }

  function rangeAt(start, end) {
    const w = textWalker();
    let t;
    let acc = 0;
    const r = document.createRange();
    let started = false;
    while ((t = w.nextNode())) {
      const len = t.data.length;
      if (!started && start <= acc + len) { r.setStart(t, Math.max(0, start - acc)); started = true; }
      if (started && end <= acc + len) { r.setEnd(t, Math.max(0, end - acc)); return r; }
      acc += len;
    }
    return started ? r : null;
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
   * @param {object} at { blk } | { frac } | { end: true } | { frag } | { el } | { offset }
   */
  async function render(i, at = { blk: 0 }, { keepTts = false } = {}) {
    if (!keepTts) ttsStop();
    popup.close();
    hideSelBar();
    highlight('search', null);
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
    applyMarks();
    updateInfo();
    if (settings.bilingual) scheduleBilingual();
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
    } else if (at.range) {
      ensureVisible(at.range, true);
    } else {
      const b = blocks[at.blk || 0];
      if (b && at.blk) goToEl(b);
    }
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

  function ensureVisible(r, center = false) {
    const rect = r.getClientRects()[0];
    if (!rect) return;
    if (settings.mode === 'paged') {
      const x = rect.left - article.getBoundingClientRect().left;
      const p = clamp(Math.floor((x + 1) / pageW), 0, pages - 1);
      if (p !== page) { page = p; setTransform(); updateInfo(); }
    } else {
      const vr = viewport.getBoundingClientRect();
      if (center || rect.top < vr.top + 40 || rect.bottom > vr.bottom - 60) {
        viewport.scrollTo({ top: viewport.scrollTop + rect.top - vr.top - vr.height / 3, behavior: center ? 'auto' : 'smooth' });
      }
    }
  }

  function isBlockVisible(b) {
    if (settings.mode === 'paged') {
      const cr = clip.getBoundingClientRect();
      return [...b.getClientRects()].some((r) => r.width > 0 && r.right > cr.left + 2 && r.left < cr.right - 2);
    }
    const vr = viewport.getBoundingClientRect();
    const r = b.getBoundingClientRect();
    return r.bottom > vr.top && r.top < vr.bottom;
  }

  function firstVisibleBlock() {
    if (settings.mode === 'paged') {
      for (let i = 0; i < blocks.length; i++) if (isBlockVisible(blocks[i])) return i;
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

  function lastVisibleBlock() {
    const first = firstVisibleBlock();
    let last = first;
    for (let i = first + 1; i < blocks.length; i++) {
      if (isBlockVisible(blocks[i])) last = i;
      else if (i > last + 2) break;
    }
    return last;
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
    updateBookmarkBtn();
    savePos();
  }

  const savePos = debounce(async () => {
    const blk = firstVisibleBlock();
    book.pos = { ch, blk, pct: bookPct() };
    book.lastRead = Date.now();
    try { await db.put('books', book); } catch { /* ignorieren */ }
  }, 700);

  // ---------- Statistik: aktive Lesezeit ----------
  let lastActive = Date.now();
  const active = () => { lastActive = Date.now(); };
  const statTimer = setInterval(() => {
    const reading = Date.now() - lastActive < 120000 || (tts.on && !tts.paused);
    if (document.visibilityState === 'visible' && reading) addStat('readMs', 15000);
  }, 15000);
  cleanups.push(() => clearInterval(statTimer));

  // ---------- Navigation ----------
  function next() {
    popup.close();
    active();
    if (settings.mode === 'paged') {
      if (page < pages - 1) { page++; setTransform(); updateInfo(); hideUi(); addStat('pages'); afterPageChange(); }
      else if (ch < n - 1) render(ch + 1, { blk: 0 });
      else toast('Ende des Buches 🎉');
    } else {
      viewport.scrollBy({ top: viewport.clientHeight * 0.9, behavior: 'smooth' });
    }
  }
  function prev() {
    popup.close();
    active();
    if (settings.mode === 'paged') {
      if (page > 0) { page--; setTransform(); updateInfo(); hideUi(); afterPageChange(); }
      else if (ch > 0) render(ch - 1, { end: true });
    } else {
      viewport.scrollBy({ top: -viewport.clientHeight * 0.9, behavior: 'smooth' });
    }
  }
  function afterPageChange() {
    if (settings.bilingual) scheduleBilingual();
  }
  function goPct(p) {
    const target = p * total;
    let i = 0;
    while (i < n - 1 && charStart[i + 1] <= target) i++;
    const chars = book.chapters[i]?.chars || 1;
    const frac = clamp((target - charStart[i]) / chars, 0, 1);
    if (i === ch) { goTo({ frac }); updateInfo(); } else render(i, { frac });
  }

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
    if (c.node.parentElement?.closest('.para-tr')) return null; // Übersetzungen nicht nachschlagen
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
    const walker = textWalker();
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
    const block = hit.node.parentElement?.closest(TEXT_SEL);
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
      onTranslateParagraph: block ? () => translateBlocks([block]) : null,
    });
  }

  // ---------- Zweisprachig: Übersetzung unter Absätzen ----------
  const hasTr = (b) => b.nextElementSibling?.classList.contains('para-tr');

  async function translateBlocks(list) {
    const todo = list.filter((b) => b.isConnected && !hasTr(b) && b.textContent.trim().length > 1 && !b.closest('.para-tr'));
    if (!todo.length) return;
    const tgt = targetLang();
    const boxes = todo.map((b) => {
      const box = el('div', { class: 'para-tr loading', lang: tgt }, el('span', { class: 'skel' }));
      b.after(box);
      return box;
    });
    relayoutAnchored();
    let i = 0;
    const worker = async () => {
      while (i < todo.length) {
        const k = i++;
        try {
          const r = await translateText(todo[k].textContent, lang, tgt);
          boxes[k].textContent = r.text;
          boxes[k].classList.remove('loading');
        } catch {
          boxes[k].textContent = '⚠ Übersetzung nicht möglich';
          boxes[k].classList.remove('loading');
          boxes[k].classList.add('err');
        }
      }
    };
    await Promise.all([worker(), worker()]);
    if (article.isConnected) relayoutAnchored();
  }

  function visibleLeafBlocks() {
    const out = [];
    const first = firstVisibleBlock();
    const last = lastVisibleBlock();
    for (let k = first; k <= last && k < blocks.length; k++) {
      const b = blocks[k];
      if (b.matches(TEXT_SEL) && !b.querySelector(TEXT_SEL)) out.push(b);
    }
    return out.slice(0, 12);
  }

  const scheduleBilingual = debounce(() => {
    if (settings.bilingual && article.isConnected) translateBlocks(visibleLeafBlocks());
  }, 350);

  function setBilingual(on) {
    setSetting({ bilingual: on });
    applyStyles();
    if (on) {
      toast('Zweisprachig: Übersetzungen erscheinen unter den Absätzen');
      scheduleBilingual();
    } else {
      article.querySelectorAll('.para-tr').forEach((x) => x.remove());
      relayoutAnchored();
    }
  }

  // ---------- Lesezeichen & Markierungen ----------
  const markName = (c) => `hl-${c}`;

  function applyMarks() {
    if (!hasHL) return;
    for (const c of COLORS) {
      const ranges = marks.filter((m) => m.type === 'highlight' && m.ch === ch && m.color === c)
        .map((m) => rangeAt(m.start, m.end)).filter(Boolean);
      highlight(markName(c), ranges);
    }
    updateBookmarkBtn();
  }

  async function addHighlight(color) {
    const sel = getSelection();
    if (!sel?.rangeCount) return;
    const r = sel.getRangeAt(0);
    if (!article.contains(r.commonAncestorContainer)) return;
    const start = r.startContainer.nodeType === 3 ? offsetOf(r.startContainer, r.startOffset) : blockOffset(r.startContainer);
    const end = r.endContainer.nodeType === 3 ? offsetOf(r.endContainer, r.endOffset) : start + sel.toString().length;
    const m = { id: uid(), bookId: book.id, type: 'highlight', ch, start, end, text: sel.toString().replace(/\s+/g, ' ').trim().slice(0, 600), color, note: '', createdAt: Date.now() };
    marks.push(m);
    await db.put('marks', m);
    sel.removeAllRanges();
    hideSelBar();
    applyMarks();
    toast(`Markiert (${COLOR_NAMES[color]}) – alle Markierungen unter ☰`, { ms: 2500 });
  }

  function bookmarkHere() {
    const first = firstVisibleBlock();
    const last = lastVisibleBlock();
    return marks.find((m) => m.type === 'bookmark' && m.ch === ch && m.blk >= first && m.blk <= last);
  }

  function updateBookmarkBtn() {
    const btn = root.querySelector('[data-act="bookmark"]');
    if (btn) btn.classList.toggle('on', !!bookmarkHere());
  }

  async function toggleBookmark() {
    const existing = bookmarkHere();
    if (existing) {
      marks = marks.filter((m) => m !== existing);
      await db.del('marks', existing.id);
      toast('Lesezeichen entfernt');
    } else {
      const blk = firstVisibleBlock();
      const b = blocks[blk];
      const m = {
        id: uid(), bookId: book.id, type: 'bookmark', ch, blk, start: b ? blockOffset(b) : 0, end: 0,
        text: (b?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 140), color: '', note: '', createdAt: Date.now(),
        pct: bookPct(),
      };
      marks.push(m);
      await db.put('marks', m);
      toast('Lesezeichen gesetzt 🔖');
    }
    updateBookmarkBtn();
  }

  function jumpToMark(m) {
    if (m.type === 'bookmark') {
      if (m.ch !== ch) render(m.ch, { blk: m.blk }); else { goTo({ blk: m.blk }); updateInfo(); }
      return;
    }
    const go = () => {
      const r = rangeAt(m.start, m.end);
      if (r) { ensureVisible(r, true); updateInfo(); }
    };
    if (m.ch !== ch) { render(m.ch, { blk: 0 }); requestAnimationFrame(go); } else go();
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
      const looksLikeNote = a.classList.contains('note') || /^[[(]?\d{1,3}[\])]?$|^\*+$/.test(a.textContent.trim());
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
    active();
    if (Date.now() - swipedAt < 400) return;
    if (e.target.closest('.r-side, .r-chap-end button')) return;
    const sel = getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim()) return;
    const a = e.target.closest('a[data-href]');
    if (a) { e.preventDefault(); handleLink(a); return; }
    const hit = wordAt(e.clientX, e.clientY);
    if (hit) { lookup(hit); return; }
    if (popup.justClosed()) return;
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

  viewport.addEventListener('scroll', debounce(() => {
    if (settings.mode === 'scroll') { updateInfo(); if (settings.bilingual) scheduleBilingual(); }
  }, 120), { passive: true });
  let lastScroll = 0;
  viewport.addEventListener('scroll', () => {
    if (settings.mode !== 'scroll') return;
    active();
    if (Math.abs(viewport.scrollTop - lastScroll) > 60) { hideUi(); popup.close(); lastScroll = viewport.scrollTop; }
  }, { passive: true });

  // Tastatur
  const onKey = (e) => {
    if (document.querySelector('dialog[open]') || /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName)) return;
    active();
    if (['ArrowRight', 'PageDown'].includes(e.key) || (e.key === ' ' && !e.shiftKey)) { e.preventDefault(); next(); }
    else if (['ArrowLeft', 'PageUp'].includes(e.key) || (e.key === ' ' && e.shiftKey)) { e.preventDefault(); prev(); }
    else if (e.key === 'Escape' && !popup.isOpen()) location.hash = '#/library';
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); openSearch(); }
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
    let top = rect.bottom + 12;
    if (top + h > innerHeight - 10) top = Math.max(10, rect.top - h - 12);
    selBar.style.top = clamp(top, 10, innerHeight - h - 10) + 'px';
    selBar.style.left = clamp(rect.left + rect.width / 2 - w / 2, 8, innerWidth - w - 8) + 'px';
  }
  function hideSelBar() { selBar.hidden = true; }
  // Mausklick auf die Farbknöpfe darf die Markierung nicht aufheben
  selBar.addEventListener('mousedown', (e) => e.preventDefault());

  // ---------- Hörbuch-Modus (Vorlesen) ----------
  const tts = { on: false, paused: false, list: [], idx: 0, rate: settings.rate || 1, sleepUntil: 0, sleepChapter: false, sleepTimer: 0 };
  const SLEEP_STEPS = [0, 15, 30, 60, 'ch'];
  const cover = book.cover ? URL.createObjectURL(book.cover) : null;
  if (cover) cleanups.push(() => URL.revokeObjectURL(cover));

  function listenMode() {
    if (settings.listenMode !== 'auto') return settings.listenMode;
    // Auf dem Handy: Online-Stimme -> läuft auch bei ausgeschaltetem Bildschirm weiter
    return isTouch() && navigator.onLine !== false ? 'online' : settings.speechMode;
  }

  function buildSentences(fromBlock = 0) {
    const out = [];
    const leafs = [...article.querySelectorAll(TEXT_SEL)].filter((b) => !b.querySelector(TEXT_SEL) && !b.closest('.para-tr'));
    const startEl = blocks[fromBlock];
    let started = !startEl;
    for (const b of leafs) {
      if (!started) {
        if (b === startEl || startEl.contains(b) || b.contains(startEl) ||
          (startEl.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)) started = true;
        else continue;
      }
      const nodes = [];
      const w = textWalker(b);
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

  function setMediaSession() {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: chapterTitle(ch),
        artist: book.author || '',
        album: book.title,
        artwork: [{ src: cover || new URL('icons/icon-512.png', location.href).href, sizes: '512x512', type: cover ? 'image/jpeg' : 'image/png' }],
      });
      const ms = navigator.mediaSession;
      const set = (a, f) => { try { ms.setActionHandler(a, f); } catch { /* nicht unterstützt */ } };
      set('play', () => { if (tts.paused) ttsToggle(); });
      set('pause', () => { if (!tts.paused) ttsToggle(); });
      set('previoustrack', () => ttsJump(-1));
      set('nexttrack', () => ttsJump(1));
      set('seekbackward', () => ttsJump(-3));
      set('seekforward', () => ttsJump(3));
      set('seekto', null);
      ms.playbackState = tts.paused ? 'paused' : 'playing';
    } catch { /* ignorieren */ }
  }

  function ttsStart() {
    if (tts.on) { ttsStop(); return; }
    popup.close();
    const ab = abCurrent();
    if (ab?.playing) abToggle(); // echtes Hörbuch pausieren
    tts.on = true;
    tts.paused = false;
    tts.list = buildSentences(firstVisibleBlock());
    tts.idx = 0;
    ttsBar.hidden = false;
    root.querySelector('[data-act="tts"]').classList.add('on');
    root.classList.add('listening');
    ttsBar.querySelector('[data-act="tts-rate"]').textContent = fmtRate(tts.rate);
    updateTtsBar();
    setMediaSession();
    ttsSpeak();
  }

  const fmtRate = (r) => String(Math.round(r * 100) / 100).replace(/\.0+$/, '') + '×';

  function updateTtsBar() {
    ttsBar.querySelector('[data-act="tts-toggle"]').innerHTML = tts.paused ? I.play : I.pause;
    const s = ttsBar.querySelector('[data-act="tts-sleep"] span');
    s.textContent = tts.sleepChapter ? 'Kapitel' : tts.sleepUntil ? `${Math.max(1, Math.round((tts.sleepUntil - Date.now()) / 60000))} Min.` : 'Aus';
    ttsBar.querySelector('[data-act="tts-bi"]').classList.toggle('on', !!settings.listenBilingual);
    if ('mediaSession' in navigator) { try { navigator.mediaSession.playbackState = tts.paused ? 'paused' : 'playing'; } catch { /* ignorieren */ } }
  }

  let prefetch = null;
  async function ttsSpeak() {
    if (!tts.on || tts.paused) return;
    if (tts.idx >= tts.list.length) {
      if (tts.sleepChapter) { ttsPause(); toast('🌙 Schlaf-Timer: Kapitel beendet'); tts.sleepChapter = false; updateTtsBar(); return; }
      if (ch < n - 1) {
        await render(ch + 1, { blk: 0 }, { keepTts: true });
        tts.list = buildSentences(0);
        tts.idx = 0;
        setMediaSession();
      } else { ttsStop(); toast('Ende des Buches 🎉'); return; }
    }
    const item = tts.list[tts.idx];
    if (!item) { ttsStop(); return; }
    highlight('tts', [item.range]);
    ensureVisible(item.range);
    updateTtsBar();
    const my = tts.idx;
    const myList = tts.list;
    const mode = listenMode();
    const tgt = targetLang();
    // Übersetzung schon vorab holen, damit keine Pause entsteht
    const trPromise = settings.listenBilingual
      ? (prefetch?.idx === my && prefetch.list === myList ? prefetch.p : translateText(item.text, lang, tgt).catch(() => null))
      : null;
    if (settings.listenBilingual && myList[my + 1]) {
      const nextText = myList[my + 1].text;
      prefetch = { idx: my + 1, list: myList, p: translateText(nextText, lang, tgt).catch(() => null) };
    }
    caption.hidden = true;
    try {
      await speak(item.text, lang, { rate: tts.rate, mode });
      if (trPromise && tts.on && !tts.paused && tts.idx === my && tts.list === myList) {
        const tr = await trPromise;
        if (tr?.text && tts.on && !tts.paused && tts.idx === my) {
          caption.textContent = tr.text;
          caption.hidden = false;
          await speak(tr.text, tgt, { rate: tts.rate, mode });
        }
      }
    } catch (e) {
      toast('Vorlesen nicht möglich: ' + e.message, { type: 'error' });
      ttsStop();
      return;
    }
    if (!tts.on || tts.paused || tts.list !== myList || tts.idx !== my) return;
    tts.idx++;
    ttsSpeak();
  }

  function ttsPause() {
    tts.paused = true;
    stopSpeech();
    updateTtsBar();
  }

  function ttsStop() {
    if (!tts.on) return;
    tts.on = false;
    clearTimeout(tts.sleepTimer);
    tts.sleepUntil = 0;
    tts.sleepChapter = false;
    stopSpeech();
    highlight('tts', null);
    ttsBar.hidden = true;
    caption.hidden = true;
    root.classList.remove('listening');
    root.querySelector('[data-act="tts"]')?.classList.remove('on');
    if ('mediaSession' in navigator) { try { navigator.mediaSession.playbackState = 'none'; } catch { /* ignorieren */ } }
  }

  function ttsToggle() {
    if (!tts.on) return;
    if (tts.paused) { tts.paused = false; updateTtsBar(); ttsSpeak(); } else ttsPause();
  }

  function ttsJump(d) {
    if (!tts.on) return;
    tts.idx = clamp(tts.idx + d, 0, Math.max(0, tts.list.length - 1));
    tts.paused = false;
    stopSpeech();
    ttsSpeak();
  }

  let sleepIdx = 0;
  function ttsSleepCycle() {
    const running = tts.sleepChapter || tts.sleepUntil > Date.now();
    sleepIdx = running ? (sleepIdx + 1) % SLEEP_STEPS.length : 1;
    const nextStep = SLEEP_STEPS[sleepIdx];
    clearTimeout(tts.sleepTimer);
    tts.sleepUntil = 0;
    tts.sleepChapter = false;
    if (nextStep === 'ch') tts.sleepChapter = true;
    else if (nextStep > 0) {
      tts.sleepUntil = Date.now() + nextStep * 60000;
      tts.sleepTimer = setTimeout(() => { ttsPause(); tts.sleepUntil = 0; updateTtsBar(); toast('🌙 Schlaf-Timer: Vorlesen angehalten'); }, nextStep * 60000);
    }
    toast(nextStep === 'ch' ? '🌙 Stoppt am Kapitelende' : nextStep ? `🌙 Stoppt in ${nextStep} Minuten` : '🌙 Schlaf-Timer aus', { ms: 1800 });
    updateTtsBar();
  }

  // ---------- Suche im Buch ----------
  const plainCache = new Map();
  function plainOf(i) {
    if (!plainCache.has(i)) {
      const tpl = document.createElement('template');
      tpl.innerHTML = content.chapters[i].html;
      plainCache.set(i, tpl.content.textContent);
    }
    return plainCache.get(i);
  }

  let lastQuery = '';
  function openSearch() {
    const input = el('input', { type: 'search', class: 'input', placeholder: 'Wort oder Satz suchen …', value: lastQuery, enterkeyhint: 'search' });
    const info = el('p', { class: 'muted small' });
    const list = el('div', { class: 'search-results' });
    const run = () => {
      const q = input.value.trim();
      lastQuery = q;
      list.replaceChildren();
      if (q.length < 2) { info.textContent = 'Mindestens 2 Zeichen eingeben.'; return; }
      const needle = q.toLocaleLowerCase();
      const results = [];
      for (let i = 0; i < n && results.length < 300; i++) {
        const text = plainOf(i);
        const hay = text.toLocaleLowerCase();
        let pos = hay.indexOf(needle);
        while (pos >= 0 && results.length < 300) {
          results.push({ ch: i, start: pos, end: pos + q.length, snippet: text.slice(Math.max(0, pos - 50), pos + q.length + 60), pre: Math.min(50, pos) });
          pos = hay.indexOf(needle, pos + needle.length);
        }
      }
      info.textContent = results.length ? `${results.length >= 300 ? '300+' : results.length} Treffer` : 'Keine Treffer.';
      let lastCh = -1;
      for (const r of results) {
        if (r.ch !== lastCh) { list.append(el('div', { class: 'sr-chap' }, chapterTitle(r.ch))); lastCh = r.ch; }
        const s = r.snippet.replace(/\s+/g, ' ');
        const pre = r.snippet.slice(0, r.pre).replace(/\s+/g, ' ');
        const hit = r.snippet.slice(r.pre, r.pre + q.length);
        const post = r.snippet.slice(r.pre + q.length).replace(/\s+/g, ' ');
        list.append(el('button', { class: 'sr-item', title: s, onclick: () => { dlg.close(); jumpToMatch(r); } },
          el('span', {}, (r.pre >= 50 ? '…' : '') + pre), el('mark', {}, hit), el('span', {}, post + '…')));
      }
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); run(); } });
    input.addEventListener('input', debounce(run, 350));
    const dlg = openSheet({ title: 'Im Buch suchen', body: el('div', { class: 'search-panel' }, input, info, list), side: 'right' });
    setTimeout(() => { input.focus(); if (input.value) run(); }, 60);
  }

  function jumpToMatch(r) {
    const show = () => {
      const rg = rangeAt(r.start, r.end);
      if (!rg) return;
      highlight('search', [rg]);
      ensureVisible(rg, true);
      updateInfo();
      setTimeout(() => highlight('search', null), 4000);
    };
    if (r.ch !== ch) { render(r.ch, { blk: 0 }); requestAnimationFrame(show); } else show();
  }

  // ---------- Buttons ----------
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    const act = btn?.dataset.act;
    if (!act) return;
    switch (act) {
      case 'back': location.hash = '#/library'; break;
      case 'prev': prev(); break;
      case 'next': next(); break;
      case 'prevch': if (ch > 0) render(ch - 1, { blk: 0 }); break;
      case 'nextch': if (ch < n - 1) render(ch + 1, { blk: 0 }); break;
      case 'toc': openToc(); break;
      case 'search': openSearch(); break;
      case 'bi': setBilingual(!settings.bilingual); break;
      case 'bookmark': toggleBookmark(); break;
      case 'aa': openDisplay(); break;
      case 'tts': ttsStart(); break;
      case 'tts-toggle': ttsToggle(); break;
      case 'tts-prev': ttsJump(-1); break;
      case 'tts-next': ttsJump(1); break;
      case 'tts-stop': ttsStop(); break;
      case 'tts-sleep': ttsSleepCycle(); break;
      case 'tts-bi':
        setSetting({ listenBilingual: !settings.listenBilingual });
        toast(settings.listenBilingual ? `Nach jedem Satz: Übersetzung (${langName(targetLang())})` : 'Nur Originaltext', { ms: 2000 });
        updateTtsBar();
        break;
      case 'tts-rate': {
        const rates = [0.6, 0.75, 0.9, 1, 1.15, 1.3, 1.5];
        const k = rates.findIndex((r) => r >= tts.rate - 0.001);
        tts.rate = rates[(k + 1) % rates.length];
        setSetting({ rate: tts.rate });
        btn.textContent = fmtRate(tts.rate);
        ttsJump(0);
        break;
      }
      case 'sel-tr':
        hideSelBar();
        popup.openPhrase({ text: selText, lang, rect: selRect, sentence: selSentence, bookId: book.id, bookTitle: book.title, onSaved: markSaved });
        break;
      case 'sel-speak': speak(selText, lang).catch(() => {}); break;
      case 'sel-mark': addHighlight(btn.dataset.color); break;
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

  // ---------- Inhalt | Lesezeichen | Markierungen ----------
  function openToc(tab = 'toc') {
    const body = el('div', { class: 'toc-panel' });
    const tabs = el('div', { class: 'tabs small', role: 'tablist' });
    const pane = el('div');
    const TABS = [['toc', 'Inhalt'], ['bookmarks', 'Lesezeichen'], ['highlights', 'Markierungen']];
    const draw = (t) => {
      tabs.replaceChildren(...TABS.map(([id, label]) => el('button', {
        class: 'tab', role: 'tab', 'aria-selected': String(id === t), onclick: () => draw(id),
      }, label + (id === 'bookmarks' ? ` (${marks.filter((m) => m.type === 'bookmark').length})` : id === 'highlights' ? ` (${marks.filter((m) => m.type === 'highlight').length})` : ''))));
      pane.replaceChildren(t === 'toc' ? tocList() : t === 'bookmarks' ? markList('bookmark') : markList('highlight'));
    };

    const tocList = () => {
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
      requestAnimationFrame(() => currentBtn?.scrollIntoView({ block: 'center' }));
      return list;
    };

    const markList = (type) => {
      const items = marks.filter((m) => m.type === type).sort((a, b) => a.ch - b.ch || a.start - b.start);
      const here = type === 'bookmark' ? bookmarkHere() : null;
      const addBtn = type === 'bookmark'
        ? el('button', { class: 'btn small ' + (here ? '' : 'primary'), onclick: async () => { await toggleBookmark(); draw('bookmarks'); } },
          here ? '🔖 Lesezeichen dieser Seite entfernen' : '🔖 Diese Seite merken')
        : null;
      if (!items.length) {
        return el('div', {}, addBtn, el('p', { class: 'muted empty-marks' }, type === 'bookmark'
          ? 'Noch keine Lesezeichen. Tipp: Auch das 🔖 oben rechts auf der Seite setzt ein Lesezeichen.'
          : 'Noch keine Markierungen. Markiere Text (lange drücken bzw. mit der Maus ziehen) und wähle eine Farbe.'));
      }
      const list = el('div', { class: 'mark-list' });
      if (addBtn) list.append(addBtn);
      for (const m of items) {
        const noteBox = el('div', { class: 'mark-note' }, m.note ? m.note : '');
        const row = el('div', { class: 'mark-item' },
          el('button', { class: 'mark-main', onclick: () => { dlg.close(); jumpToMark(m); } },
            m.type === 'highlight' ? el('span', { class: `mark-dot c-${m.color}` }) : el('span', { class: 'mark-dot bm', html: I.bookmark }),
            el('span', { class: 'mark-text' },
              el('small', { class: 'muted' }, `${chapterTitle(m.ch)}`),
              el('span', {}, m.type === 'highlight' ? `„${m.text}“` : (m.text || 'Lesezeichen') + ' …'),
              noteBox)),
          el('div', { class: 'mark-actions' },
            m.type === 'highlight' ? el('button', { class: 'icon-btn small', 'aria-label': 'Notiz', title: 'Notiz', html: I.note, onclick: () => editNote(m, noteBox) }) : null,
            el('button', { class: 'icon-btn small', 'aria-label': 'Löschen', title: 'Löschen', html: I.trash, onclick: async () => {
              marks = marks.filter((x) => x !== m);
              await db.del('marks', m.id);
              applyMarks();
              draw(type === 'bookmark' ? 'bookmarks' : 'highlights');
            } })));
        list.append(row);
      }
      if (type === 'highlight') {
        list.append(el('button', { class: 'btn small', onclick: exportMarks }, '📋 Markierungen kopieren'));
      }
      return list;
    };

    const editNote = (m, box) => {
      const ta = el('textarea', { class: 'input', rows: 3, placeholder: 'Deine Notiz …' });
      ta.value = m.note || '';
      const save = el('button', { class: 'btn small primary', onclick: async () => {
        m.note = ta.value.trim();
        await db.put('marks', m);
        box.replaceChildren(m.note);
      } }, 'Speichern');
      box.replaceChildren(ta, save);
      ta.focus();
    };

    const info = el('div', { class: 'toc-book' },
      el('strong', {}, book.title), book.author ? el('span', {}, book.author) : null,
      el('span', { class: 'muted' }, `${langName(lang)} · ${fmtMinutes(total)} Lesezeit gesamt`),
      el('a', { class: 'btn small', href: `#/discover/audio/${encodeURIComponent(book.title)}`, onclick: () => dlg.close() }, '🎧 Echtes Hörbuch dazu suchen'));
    body.append(info, tabs, pane);
    const dlg = openSheet({ title: 'Inhalt', body, side: 'left' });
    draw(tab);
  }

  async function exportMarks() {
    const text = marks.filter((m) => m.type === 'highlight').sort((a, b) => a.ch - b.ch || a.start - b.start)
      .map((m) => `• ${m.text}${m.note ? `\n  Notiz: ${m.note}` : ''}\n  (${chapterTitle(m.ch)})`).join('\n\n');
    try {
      await navigator.clipboard.writeText(`${book.title}${book.author ? ' – ' + book.author : ''}\n\n${text}`);
      toast('Markierungen kopiert ✓');
    } catch { toast('Kopieren nicht möglich', { type: 'error' }); }
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
      toggle('Zweisprachig lesen', settings.bilingual, (v) => setBilingual(v), 'Übersetzung erscheint unter jedem Absatz'),
      toggle('Wort beim Antippen aussprechen', settings.autoSpeak, (v) => setSetting({ autoSpeak: v })),
      toggle('Satz automatisch mitübersetzen', settings.autoSentence, (v) => setSetting({ autoSentence: v })),
      toggle('Gespeicherte Wörter markieren', settings.markSaved, (v) => { setSetting({ markSaved: v }); markSaved(); }),
      el('hr'),
      field('Stimme beim Anhören', segmented([
        { value: 'auto', label: 'Automatisch' }, { value: 'device', label: 'Gerät' }, { value: 'online', label: 'Online' },
      ], settings.listenMode, (v) => setSetting({ listenMode: v })),
      'Online-Stimme: klingt natürlich und läuft auf dem Handy auch bei ausgeschaltetem Bildschirm weiter.'),
      toggle('Beim Anhören Übersetzung nach jedem Satz', settings.listenBilingual, (v) => { setSetting({ listenBilingual: v }); updateTtsBar(); }),
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
  document.fonts?.ready.then(() => {
    if (!article.isConnected) return;
    const anchor = firstVisibleBlock();
    layout();
    goTo({ blk: anchor || book.pos?.blk || 0 });
    updateInfo();
  });
  hideTimer = setTimeout(hideUi, 2500);
  viewport.focus({ preventScroll: true });
  if (opts.listen) setTimeout(() => { if (article.isConnected && !tts.on) ttsStart(); }, 400);

  // Aufräumen beim Verlassen
  return () => {
    savePos.flush();
    ttsStop();
    popup.stopAll();
    for (const name of ['saved', 'lookup', 'search', 'tts', ...COLORS.map(markName)]) highlight(name, null);
    cleanups.forEach((f) => f());
    for (const u of imgUrls.values()) if (u) URL.revokeObjectURL(u);
  };
}
