// Bereich "Hören": Übersicht + Vollbild-Player (Karaoke, Übersetzung, Wort antippen)
import * as db from './db.js';
import { settings, setSetting } from './settings.js';
import { getListener, currentListener, unlockAudio } from './listenEngine.js';
import * as popup from './popup.js';
import { recentAudiobooks } from './audioPlayer.js';
import { el, escapeHtml, coverColors, toast, storedToBlob, wordSegments, fmtMinutes } from './util.js';
import { openSheet } from './ui.js';

const I = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  prevS: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round"/></svg>',
  nextS: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v4h-4" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round"/></svg>',
  prevC: '<svg viewBox="0 0 24 24"><path d="M6 5v14M18 5l-9 7 9 7z" stroke="currentColor" stroke-width="2" fill="currentColor" stroke-linejoin="round"/></svg>',
  nextC: '<svg viewBox="0 0 24 24"><path d="M18 5v14M6 5l9 7-9 7z" stroke="currentColor" stroke-width="2" fill="currentColor" stroke-linejoin="round"/></svg>',
  list: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

function coverNode(book, cls = 'cover') {
  const blob = storedToBlob(book.cover);
  if (blob) {
    const u = URL.createObjectURL(blob);
    const img = el('img', { src: u, alt: '' });
    img.addEventListener('load', () => setTimeout(() => URL.revokeObjectURL(u), 1000));
    return el('div', { class: cls }, img);
  }
  const [c1, c2] = coverColors(book.title);
  return el('div', { class: `${cls} gen`, style: `--c1:${c1};--c2:${c2}` },
    el('span', { class: 'gen-title' }, book.title), book.author ? el('span', { class: 'gen-author' }, book.author) : null);
}

async function startAndOpen(bookId) {
  unlockAudio(); // iPhone: noch während des Tippens
  const l = await getListener(bookId);
  location.hash = `#/listen/${bookId}`;
  if (!l.playing) l.play();
}

// =========================================================
// Übersicht
// =========================================================
export async function openListenHub(mount) {
  const books = (await db.getAll('books')).sort((a, b) => (b.listen?.at || 0) - (a.listen?.at || 0) || (b.lastRead || b.addedAt) - (a.lastRead || a.addedAt));
  const recentLv = await recentAudiobooks();
  const active = currentListener();
  const root = el('div', { class: 'page listen-hub' });
  root.append(el('header', { class: 'page-head' },
    el('div', {}, el('h1', {}, 'Hören'), el('p', { class: 'muted' }, 'Lass dir jedes Buch vorlesen – auf Englisch, Deutsch und in vielen Sprachen – oder hör echte Hörbücher.'))));

  if (active) {
    root.append(el('a', { class: 'now-playing', href: `#/listen/${active.book.id}` },
      coverNode(active.book, 'cover small'),
      el('span', { class: 'np-text' }, el('span', { class: 'eyebrow' }, active.playing ? '▶ Läuft gerade' : '⏸ Pausiert'),
        el('strong', {}, active.book.title), el('span', { class: 'muted' }, active.chapterTitle)),
      el('span', { class: 'btn primary' }, 'Öffnen →')));
  }

  const started = books.filter((b) => b.listen && b.id !== active?.book.id).slice(0, 4);
  if (started.length) {
    root.append(el('h2', {}, 'Weiterhören'), el('div', { class: 'listen-list' }, ...started.map((b) => {
      const total = b.chapters.length;
      const btn = el('button', { class: 'btn primary small', onclick: () => startAndOpen(b.id) }, '▶ Weiter');
      return el('div', { class: 'listen-row' }, coverNode(b, 'cover small'),
        el('div', { class: 'lr-text' }, el('strong', {}, b.title),
          el('span', { class: 'muted' }, `${b.chapters[b.listen.ch]?.title || 'Kapitel ' + (b.listen.ch + 1)} · Kapitel ${b.listen.ch + 1}/${total}`)),
        btn);
    })));
  }

  root.append(el('h2', {}, 'Deine Bücher anhören'));
  if (!books.length) {
    root.append(el('div', { class: 'empty' }, el('div', { class: 'empty-art' }, '🎧'), el('h3', {}, 'Noch keine Bücher'),
      el('p', { class: 'muted' }, 'Lade unter „Entdecken“ ein Buch – zum Beispiel „The Tale of Peter Rabbit“ – und lass es dir vorlesen.'),
      el('div', { class: 'empty-actions' }, el('a', { class: 'btn primary', href: '#/discover/en' }, '📚 Englische Bücher'))));
  } else {
    root.append(el('div', { class: 'book-grid listen-grid' }, ...books.map((b) => el('article', { class: 'book-card' },
      el('button', { class: 'book-link listen-cover', 'aria-label': `${b.title} anhören`, onclick: () => startAndOpen(b.id) },
        coverNode(b), el('span', { class: 'play-badge', html: I.play })),
      el('div', { class: 'book-meta' },
        el('span', { class: 'book-title' }, b.title),
        el('span', { class: 'book-author' }, `${(b.lang || '?').toUpperCase()} · ${b.author || ''}`))))));
  }

  root.append(el('h2', { class: 'mt' }, 'Echte Hörbücher (von Menschen gelesen)'),
    el('a', { class: 'discover-banner', href: '#/discover/audio' },
      el('span', { class: 'db-icon' }, '🎙'),
      el('span', {}, el('strong', {}, 'LibriVox-Hörbücher'), el('span', { class: 'muted' }, recentLv.length
        ? `Zuletzt: ${recentLv[0].title}`
        : 'Tausende kostenlose Hörbücher auf Englisch, Deutsch, Russisch …')),
      el('span', { class: 'btn primary' }, 'Öffnen →')));

  root.append(el('section', { class: 'card-sec voice-quick' }, el('h2', {}, 'Stimme'),
    el('p', { class: 'muted small' }, 'Online-Stimme: klingt natürlich und läuft auf dem Handy auch bei ausgeschaltetem Bildschirm (braucht Internet). Gerätestimme: funktioniert offline.'),
    voiceControls()));

  mount.replaceChildren(root);
  return () => {};
}

function voiceControls(onChange = () => {}) {
  const mode = el('select', { class: 'select', 'aria-label': 'Stimme' },
    [['auto', 'Stimme: Automatisch'], ['online', 'Stimme: Online (natürlich)'], ['device', 'Stimme: Gerät (offline)']]
      .map(([v, l]) => el('option', { value: v, selected: settings.listenMode === v || null }, l)));
  mode.addEventListener('change', () => { setSetting({ listenMode: mode.value }); onChange(); });
  const accent = el('select', { class: 'select', 'aria-label': 'Englisch-Akzent' },
    [['en-US', 'Englisch: Amerikanisch'], ['en-GB', 'Englisch: Britisch']]
      .map(([v, l]) => el('option', { value: v, selected: settings.enAccent === v || null }, l)));
  accent.addEventListener('change', () => { setSetting({ enAccent: accent.value }); onChange(); });
  return el('div', { class: 'row wrap' }, mode, accent);
}

// =========================================================
// Vollbild-Player
// =========================================================
export async function openPlayer(mount, bookId) {
  let l;
  try {
    l = await getListener(bookId);
  } catch (e) {
    toast(e.message, { type: 'error' });
    location.hash = '#/listen';
    return () => {};
  }
  const book = l.book;
  const root = el('div', { class: 'player-page' });
  root.innerHTML = `
    <header class="pl-head">
      <a class="icon-btn" href="#/listen" aria-label="Zurück">${I.back}</a>
      <span class="pl-head-title">Hören</span>
      <button class="icon-btn" data-act="chapters" aria-label="Kapitel">${I.list}</button>
    </header>
    <div class="pl-top">
      <div data-slot="cover"></div>
      <div class="pl-meta">
        <strong class="pl-title">${escapeHtml(book.title)}</strong>
        <span class="muted">${escapeHtml(book.author || '')}</span>
        <span class="pl-chapter" data-slot="chapter"></span>
      </div>
    </div>
    <div class="pl-text">
      <p class="pl-prev" data-slot="prev" lang="${book.lang}"></p>
      <p class="pl-current" data-slot="current" lang="${book.lang}"></p>
      <p class="pl-tr" data-slot="tr"></p>
      <p class="pl-next" data-slot="next" lang="${book.lang}"></p>
      <p class="pl-hint muted small">Tipp: Wort im Satz antippen → Übersetzung & „Zu Vokabeln“</p>
    </div>
    <div class="pl-progress">
      <input type="range" class="range" min="0" max="100" value="0" data-slot="seek" aria-label="Position im Kapitel">
      <div class="pl-times"><span data-slot="pos"></span><span data-slot="left"></span></div>
    </div>
    <div class="pl-controls">
      <button class="icon-btn" data-act="prevC" aria-label="Vorheriges Kapitel">${I.prevC}</button>
      <button class="icon-btn" data-act="prevS" aria-label="Satz zurück">${I.prevS}</button>
      <button class="icon-btn big" data-act="toggle" aria-label="Abspielen/Pause"></button>
      <button class="icon-btn" data-act="nextS" aria-label="Nächster Satz">${I.nextS}</button>
      <button class="icon-btn" data-act="nextC" aria-label="Nächstes Kapitel">${I.nextC}</button>
    </div>
    <div class="pl-options" data-slot="options"></div>
    <div class="pl-actions">
      <button class="btn" data-act="read">📖 Im Buch weiterlesen</button>
      <a class="btn" href="#/discover/audio/${encodeURIComponent(book.title)}">🎙 Echtes Hörbuch suchen</a>
    </div>`;
  mount.replaceChildren(root);
  const slot = (s) => root.querySelector(`[data-slot="${s}"]`);
  slot('cover').append(coverNode(book, 'cover pl-cover'));

  // ---- Optionen ----
  const rate = el('select', { class: 'select', 'aria-label': 'Tempo' },
    [0.6, 0.75, 0.9, 1, 1.15, 1.3, 1.5].map((r) => el('option', { value: r, selected: Math.abs(r - l.rate) < 0.01 || null }, `Tempo ${r}×`)));
  rate.addEventListener('change', () => { l.setRate(Number(rate.value)); setSetting({ rate: Number(rate.value) }); });
  const sleep = el('select', { class: 'select', 'aria-label': 'Schlaf-Timer' },
    [['0', '🌙 Schlaf-Timer aus'], ['15', '🌙 15 Min.'], ['30', '🌙 30 Min.'], ['45', '🌙 45 Min.'], ['60', '🌙 60 Min.'], ['ch', '🌙 Kapitelende']]
      .map(([v, t]) => el('option', { value: v }, t)));
  sleep.value = l.sleepChapter ? 'ch' : '0';
  sleep.addEventListener('change', () => l.setSleep(sleep.value === 'ch' ? 'ch' : Number(sleep.value)));
  const tgt = l.target;
  const showTr = el('label', { class: 'pl-check' }, el('input', { type: 'checkbox', checked: settings.listenShowTr !== false || null }), ` Übersetzung zeigen (${tgt.toUpperCase()})`);
  showTr.querySelector('input').addEventListener('change', (e) => { setSetting({ listenShowTr: e.target.checked }); lastIdx = -1; render(); });
  const sayTr = el('label', { class: 'pl-check' }, el('input', { type: 'checkbox', checked: settings.listenBilingual || null }), ` Übersetzung auch vorlesen`);
  sayTr.querySelector('input').addEventListener('change', (e) => setSetting({ listenBilingual: e.target.checked }));
  slot('options').append(el('div', { class: 'row wrap' }, rate, sleep), voiceControls(() => { if (l.playing) l.jumpTo(l.ch, l.idx); }), el('div', { class: 'row wrap' }, showTr, sayTr));

  // ---- Anzeige ----
  let lastIdx = -1;
  let lastCh = -1;
  function renderSentence() {
    const cur = l.current;
    const box = slot('current');
    box.replaceChildren();
    if (!cur) return;
    for (const s of wordSegments(cur.text, l.lang)) {
      if (s.isWordLike) box.append(el('span', { class: 'w', 'data-start': s.index, 'data-end': s.index + s.segment.length }, s.segment));
      else box.append(s.segment);
    }
    slot('prev').textContent = l.sentences[l.idx - 1]?.text || '';
    slot('next').textContent = l.sentences[l.idx + 1]?.text || '';
    const trBox = slot('tr');
    trBox.textContent = '';
    trBox.lang = tgt;
    if (settings.listenShowTr !== false) {
      const myIdx = l.idx;
      trBox.classList.add('loading');
      l.translation(myIdx).then((t) => {
        if (l.idx !== myIdx) return;
        trBox.classList.remove('loading');
        trBox.textContent = t || '';
      });
    }
  }

  function render() {
    root.querySelector('[data-act="toggle"]').innerHTML = l.playing ? I.pause : I.play;
    slot('chapter').textContent = `${l.chapterTitle} · Kapitel ${l.ch + 1} von ${l.chapters}`;
    const n = l.sentences.length;
    const seek = slot('seek');
    seek.max = String(Math.max(0, n - 1));
    if (document.activeElement !== seek) seek.value = String(l.idx);
    slot('pos').textContent = `Satz ${Math.min(l.idx + 1, n)} von ${n}`;
    const leftChars = l.sentences.slice(l.idx).reduce((a, s) => a + s.text.length, 0);
    slot('left').textContent = `noch ca. ${fmtMinutes(leftChars * 0.9 / l.rate)} im Kapitel`;
    if (l.idx !== lastIdx || l.ch !== lastCh) { lastIdx = l.idx; lastCh = l.ch; renderSentence(); }
  }

  function highlightWord() {
    const pos = l.wordPos;
    root.querySelectorAll('.pl-current .w.on').forEach((w) => w.classList.remove('on'));
    if (pos < 0) return;
    for (const w of root.querySelectorAll('.pl-current .w')) {
      if (pos >= Number(w.dataset.start) && pos < Number(w.dataset.end) + 1) { w.classList.add('on'); break; }
    }
  }

  const off = l.on((type) => {
    if (type === 'word') highlightWord();
    else render();
  });

  // ---- Bedienung ----
  root.addEventListener('click', async (e) => {
    const w = e.target.closest('.pl-current .w');
    if (w) {
      if (l.playing) l.pause();
      popup.openWord({
        word: w.textContent, lang: l.lang, rect: w.getBoundingClientRect(), sentence: l.current?.text || '',
        bookId: book.id, bookTitle: book.title,
      });
      return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'toggle') { unlockAudio(); l.toggle(); }
    if (act === 'prevS') l.prev();
    if (act === 'nextS') l.next();
    if (act === 'prevC') l.prevChapter();
    if (act === 'nextC') l.nextChapter();
    if (act === 'chapters') openChapters();
    if (act === 'read') {
      // Leseposition auf die Hörposition setzen und Buch öffnen
      book.pos = { ch: l.ch, blk: l.current?.blk || 0, pct: book.pos?.pct || 0 };
      await db.put('books', book);
      l.pause();
      location.hash = `#/read/${book.id}`;
    }
  });
  slot('seek').addEventListener('change', (e) => { l.jumpTo(l.ch, Number(e.target.value)); e.target.blur(); });

  function openChapters() {
    const list = el('nav', { class: 'toc-list' }, ...book.chapters.map((c, i) => el('button', {
      class: 'toc-item' + (i === l.ch ? ' current' : ''),
      onclick: () => { dlg.close(); l.jumpTo(i, 0); if (!l.playing) l.play(); },
    }, el('span', {}, c.title || `Kapitel ${i + 1}`), el('small', {}, fmtMinutes((c.chars || 0) * 0.9)))));
    const dlg = openSheet({ title: 'Kapitel', body: list, side: 'left' });
    requestAnimationFrame(() => list.querySelector('.current')?.scrollIntoView({ block: 'center' }));
  }

  const onKey = (e) => {
    if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName) || document.querySelector('dialog[open]')) return;
    if (e.key === ' ') { e.preventDefault(); l.toggle(); }
    if (e.key === 'ArrowRight') l.next();
    if (e.key === 'ArrowLeft') l.prev();
  };
  document.addEventListener('keydown', onKey);

  render();
  return () => { off(); document.removeEventListener('keydown', onKey); popup.close(); };
}

