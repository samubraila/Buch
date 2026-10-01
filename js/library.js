// Bibliothek: Bücher anzeigen, importieren, löschen
import * as db from './db.js';
import { importFile, importText, deleteBook, saveParsed, ACCEPT } from './importer.js';
import { SAMPLES } from './samples.js';
import { el, coverColors, langName, toast, fmtMinutes, storedToBlob } from './util.js';
import { openSheet, confirmDialog } from './ui.js';
import { getDay, streak } from './statsStore.js';
import { goalRing, minutes } from './stats.js';
import { settings } from './settings.js';
import { allWords, dueWords, onVocab } from './vocabStore.js';
import { speak } from './speech.js';
import { hashStr, escapeHtml } from './util.js';
import { checkAchievements } from './achievements.js';

const I = {
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  paste: '<svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M9 4h6v3H9zM8.5 11h7M8.5 14.5h7M8.5 18h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="19" cy="12" r="1.8" fill="currentColor"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M16 16l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
};

export async function openLibrary(mount) {
  const urls = [];
  const coverUrl = (b) => {
    const blob = storedToBlob(b.cover);
    if (!blob) return '';
    const u = URL.createObjectURL(blob);
    urls.push(u);
    return u;
  };

  const root = el('div', { class: 'page library' });
  root.innerHTML = `
    <header class="page-head">
      <div class="brand"><img src="icons/icon.svg" alt="" width="36" height="36"><div><h1>LeseWelt</h1><p>Lesen · Übersetzen · Aussprechen</p></div></div>
      <div class="lib-actions">
        <label class="search"><span class="sr-only">Suchen</span>${I.search}<input type="search" placeholder="Titel oder Autor suchen" data-slot="q"></label>
        <button class="btn" data-act="paste">${I.paste}<span>Text einfügen</span></button>
        <button class="btn primary" data-act="import">${I.plus}<span>Buch hinzufügen</span></button>
        <input type="file" accept="${ACCEPT}" multiple hidden data-slot="file">
      </div>
    </header>
    <div class="lib-top"><div data-slot="continue"></div><a class="today-mini" href="#/stats" data-slot="today" aria-label="Statistik öffnen"></a></div>
    <div class="learn-row" data-slot="learn"></div>
    <section>
      <div class="sec-head"><h2>Meine Bücher</h2><span class="muted" data-slot="count"></span></div>
      <div class="lib-filters" data-slot="filters"></div>
      <div class="book-grid" data-slot="grid"></div>
      <div data-slot="empty"></div>
    </section>
    <section class="sources">
      <h2>Kostenlose Bücher & Hörbücher</h2>
      <a class="discover-banner" href="#/discover">
        <span class="db-icon">📚</span>
        <span><strong>Entdecken</strong><span class="muted">Über 70.000 freie Bücher und Tausende Hörbücher – direkt in der App laden, nach Schwierigkeit sortiert.</span></span>
        <span class="btn primary">Öffnen →</span>
      </a>
      <p class="muted">Oder selbst herunterladen und mit „Buch hinzufügen“ einfügen – bzw. die Datei in dieses Fenster ziehen:</p>
      <div class="source-list">
        <a href="https://standardebooks.org/ebooks" target="_blank" rel="noopener"><strong>Standard Ebooks</strong><span>Englische Klassiker, wunderschön gesetzt</span></a>
        <a href="https://www.gutenberg.org/ebooks/search/?query=l.en&sort_order=downloads" target="_blank" rel="noopener"><strong>Project Gutenberg · Englisch</strong><span>Über 70.000 freie Bücher</span></a>
        <a href="https://www.gutenberg.org/ebooks/search/?query=l.de&sort_order=downloads" target="_blank" rel="noopener"><strong>Project Gutenberg · Deutsch</strong><span>Deutsche Klassiker als EPUB</span></a>
        <a href="https://en.wikisource.org/wiki/Main_Page" target="_blank" rel="noopener"><strong>Wikisource</strong><span>Texte in vielen Sprachen, auch als EPUB</span></a>
      </div>
    </section>
    <div class="drop-overlay" hidden><div>📚 Datei hier ablegen</div></div>
  `;
  mount.replaceChildren(root);
  const slot = (s) => root.querySelector(`[data-slot="${s}"]`);
  const fileInput = slot('file');

  let books = [];
  const pref = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
  const setPref = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignorieren */ } };
  let sortBy = pref('lw-lib-sort', 'recent');
  let show = pref('lw-lib-show', 'all');
  let langShow = pref('lw-lib-lang', '');
  const done = (b) => (b.pos?.pct || 0) >= 0.98;

  async function refresh() {
    urls.splice(0).forEach((u) => URL.revokeObjectURL(u));
    books = (await db.getAll('books')).sort((a, b) => (b.lastRead || b.addedAt) - (a.lastRead || a.addedAt));
    draw();
    drawToday();
    drawLearn();
    checkAchievements();
  }

  // Lernkarte (fällige Wörter) und Wort des Tages
  async function drawLearn() {
    const [words, due] = await Promise.all([allWords(), dueWords()]);
    const box = slot('learn');
    if (!box) return;
    box.replaceChildren();
    if (!words.length) return;
    if (due.length) {
      box.append(el('a', { class: 'learn-card', href: '#/train' },
        el('span', { class: 'lc-icon' }, '🧠'),
        el('span', { class: 'lc-text' }, el('strong', {}, `${due.length} ${due.length === 1 ? 'Wort wartet' : 'Wörter warten'} auf dich`),
          el('span', { class: 'muted' }, 'Ein paar Minuten üben – dann bleiben sie im Kopf')),
        el('span', { class: 'btn small primary' }, 'Üben →')));
    }
    const today = new Date().toISOString().slice(0, 10);
    const sorted = [...words].sort((a, b) => a.id.localeCompare(b.id));
    const w = sorted[hashStr(today) % sorted.length];
    const g = w.gram;
    const art = g?.pos === 'noun' && g.article && !w.word.includes(' ') ? `<span class="art art-${g.gender}">${g.article}</span> ` : '';
    const wod = el('div', { class: 'wod-card' });
    wod.innerHTML = `<span class="eyebrow">Wort des Tages</span>
      <div class="wod-word"><span lang="${w.lang}">${art}<strong>${escapeHtml(w.word)}</strong></span>
        <button class="icon-btn small" data-act="wod-speak" aria-label="Anhören"><svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a4.5 4.5 0 0 1 0 7" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg></button></div>
      <div class="wod-tr" lang="${w.target || 'ru'}">${escapeHtml(w.translation || '')}</div>
      ${w.context ? `<div class="wod-ctx muted" lang="${w.lang}">„${escapeHtml(w.context.length > 140 ? w.context.slice(0, 138) + '…' : w.context)}“</div>` : ''}`;
    wod.querySelector('[data-act="wod-speak"]').addEventListener('click', () => speak(w.word, w.lang).catch(() => {}));
    box.append(wod);
  }

  function drawFilters() {
    const langs = [...new Set(books.map((b) => b.lang).filter(Boolean))];
    const f = slot('filters');
    f.replaceChildren();
    if (books.length < 2) return;
    const chip = (label, active, fn) => el('button', { class: 'chip' + (active ? ' on' : ''), onclick: fn }, label);
    f.append(
      el('div', { class: 'chips' },
        chip('Alle', show === 'all', () => { show = 'all'; setPref('lw-lib-show', show); draw(); }),
        chip('Angefangen', show === 'reading', () => { show = 'reading'; setPref('lw-lib-show', show); draw(); }),
        chip('Neu', show === 'new', () => { show = 'new'; setPref('lw-lib-show', show); draw(); }),
        chip('✓ Gelesen', show === 'done', () => { show = 'done'; setPref('lw-lib-show', show); draw(); }),
        ...(langs.length > 1 ? langs.map((l) => chip(l.toUpperCase(), langShow === l, () => { langShow = langShow === l ? '' : l; setPref('lw-lib-lang', langShow); draw(); })) : [])),
      (() => {
        const s = el('select', { class: 'select', 'aria-label': 'Sortieren' },
          [['recent', 'Zuletzt gelesen'], ['added', 'Neu hinzugefügt'], ['title', 'Titel A–Z'], ['progress', 'Fortschritt']]
            .map(([v, l]) => el('option', { value: v, selected: v === sortBy || null }, l)));
        s.addEventListener('change', () => { sortBy = s.value; setPref('lw-lib-sort', sortBy); draw(); });
        return s;
      })());
  }

  async function drawToday() {
    const [day, st] = await Promise.all([getDay(), streak()]);
    const goal = settings.dailyGoal || 15;
    const m = minutes((day.readMs || 0) + (day.listenMs || 0));
    slot('today').innerHTML = `${goalRing(m, goal, 58)}
      <span class="tm-text"><strong>${m}/${goal} Min.</strong><span class="muted">heute gelesen & gehört</span>
      <span class="streak">🔥 ${st} ${st === 1 ? 'Tag' : 'Tage'}</span></span>`;
  }

  function draw() {
    const q = slot('q').value.trim().toLowerCase();
    drawFilters();
    let list = q ? books.filter((b) => (b.title + ' ' + b.author).toLowerCase().includes(q)) : books;
    if (books.length >= 2) {
      if (show === 'reading') list = list.filter((b) => b.lastRead && !done(b));
      if (show === 'new') list = list.filter((b) => !b.lastRead);
      if (show === 'done') list = list.filter(done);
      if (langShow) list = list.filter((b) => b.lang === langShow);
      const by = {
        recent: (a, b) => (b.lastRead || b.addedAt) - (a.lastRead || a.addedAt),
        added: (a, b) => b.addedAt - a.addedAt,
        title: (a, b) => a.title.localeCompare(b.title, 'de'),
        progress: (a, b) => (b.pos?.pct || 0) - (a.pos?.pct || 0),
      }[sortBy];
      if (by) list = [...list].sort(by);
    }
    slot('count').textContent = books.length ? `${books.length} ${books.length === 1 ? 'Buch' : 'Bücher'}` : '';

    // Weiterlesen
    const last = books.find((b) => b.lastRead);
    const cont = slot('continue');
    cont.replaceChildren();
    if (last && !q) {
      const pct = Math.round((last.pos?.pct || 0) * 100);
      const leftChars = (1 - (last.pos?.pct || 0)) * (last.totalChars || 0);
      cont.append(el('a', { class: 'continue-card', href: `#/read/${last.id}` },
        coverEl(last, 'small'),
        el('div', { class: 'continue-info' },
          el('span', { class: 'eyebrow' }, 'Weiterlesen'),
          el('strong', {}, last.title),
          el('span', { class: 'muted' }, last.chapters[last.pos?.ch || 0]?.title || ''),
          el('div', { class: 'progress' }, el('span', { style: `width:${pct}%` })),
          el('span', { class: 'muted small' }, `${pct} % gelesen · noch ca. ${fmtMinutes(leftChars)}`)),
        el('span', { class: 'btn primary continue-btn' }, 'Lesen →')));
    }

    const grid = slot('grid');
    grid.replaceChildren(...list.map(card));
    const empty = slot('empty');
    empty.replaceChildren();
    if (!books.length) {
      empty.append(el('div', { class: 'empty' },
        el('div', { class: 'empty-art', 'aria-hidden': 'true' }, '📖'),
        el('h3', {}, 'Deine Bibliothek ist noch leer'),
        el('p', { class: 'muted' }, 'Füge ein Buch hinzu (EPUB, FB2, PDF, TXT) oder probiere ein Beispiel aus. Tippe beim Lesen auf ein Wort – du bekommst sofort die Übersetzung und hörst die Aussprache.'),
        el('div', { class: 'empty-actions' },
          ...SAMPLES.map((s) => el('button', { class: 'btn', onclick: () => addSample(s) }, el('span', { class: 'lang-chip' }, s.lang.toUpperCase()), s.title)),
          el('a', { class: 'btn primary', href: '#/discover' }, '📚 Mehr Bücher entdecken'))));
    } else if (!list.length) {
      empty.append(el('p', { class: 'muted empty-search' }, 'Keine Treffer.'));
    }
  }

  function coverEl(b, size = '') {
    const u = coverUrl(b);
    if (u) return el('div', { class: `cover ${size}` }, el('img', { src: u, alt: '', loading: 'lazy' }));
    const [c1, c2] = coverColors(b.title);
    return el('div', { class: `cover gen ${size}`, style: `--c1:${c1};--c2:${c2}` },
      el('span', { class: 'gen-title' }, b.title),
      b.author ? el('span', { class: 'gen-author' }, b.author) : null);
  }

  function card(b) {
    const pct = Math.round((b.pos?.pct || 0) * 100);
    const a = el('article', { class: 'book-card' },
      el('a', { href: `#/read/${b.id}`, class: 'book-link', 'aria-label': `${b.title} lesen` }, coverEl(b)),
      el('div', { class: 'book-meta' },
        el('a', { href: `#/read/${b.id}`, class: 'book-title' }, b.title),
        el('span', { class: 'book-author' }, b.author || ' '),
        el('div', { class: 'book-foot' },
          el('span', { class: 'lang-chip', title: langName(b.lang) }, (b.lang || '?').toUpperCase()),
          el('div', { class: 'progress', title: `${pct} %` }, el('span', { style: `width:${pct}%` })),
          el('span', { class: 'pct' + (done(b) ? ' done' : '') }, done(b) ? '✓ Gelesen' : pct ? pct + ' %' : 'neu'),
          el('button', { class: 'icon-btn small', 'aria-label': 'Optionen', html: I.more, onclick: (e) => { e.preventDefault(); bookMenu(b); } }))));
    return a;
  }

  function bookMenu(b) {
    const body = el('div', { class: 'menu-list' },
      el('div', { class: 'book-info' },
        el('strong', {}, b.title),
        el('span', { class: 'muted' }, [b.author, langName(b.lang), (b.format || '').toUpperCase(), `${b.chapters.length} Kapitel`, fmtMinutes(b.totalChars) + ' Lesezeit'].filter(Boolean).join(' · '))),
      el('a', { class: 'menu-item', href: `#/read/${b.id}`, onclick: () => dlg.close() }, '📖 Lesen'),
      el('a', { class: 'menu-item', href: `#/listen/${b.id}`, onclick: () => dlg.close() }, '🎧 Anhören (Hör-Player)'),
      el('a', { class: 'menu-item', href: `#/discover/audio/${encodeURIComponent(b.title)}`, onclick: () => dlg.close() }, '🎙 Echtes Hörbuch dazu suchen'),
      el('button', { class: 'menu-item', onclick: async () => {
        b.pos = { ch: 0, blk: 0, pct: 0 }; b.lastRead = 0;
        await db.put('books', b); dlg.close(); refresh();
      } }, '↺ Fortschritt zurücksetzen'),
      el('button', { class: 'menu-item', onclick: async () => {
        b.pos = { ...(b.pos || {}), pct: 1 }; b.lastRead = Date.now();
        await db.put('books', b); dlg.close(); toast('Als gelesen markiert ✓'); refresh();
      } }, '✓ Als gelesen markieren'),
      el('button', { class: 'menu-item danger', onclick: async () => {
        dlg.close();
        if (await confirmDialog(`„${b.title}“ wirklich löschen? Deine Vokabeln bleiben erhalten.`, { ok: 'Löschen', danger: true })) {
          await deleteBook(b.id);
          toast('Buch gelöscht');
          refresh();
        }
      } }, '🗑 Löschen'));
    const dlg = openSheet({ title: 'Buch', body, className: 'small' });
  }

  async function addSample(s) {
    const existing = books.find((b) => b.fileKey === 'sample|' + s.key);
    if (existing) { location.hash = `#/read/${existing.id}`; return; }
    const book = await saveParsed({ title: s.title, author: s.author, lang: s.lang, chapters: s.chapters.map((c) => ({ ...c, path: 'sample' })), toc: [], images: {} },
      { format: 'beispiel', fileKey: 'sample|' + s.key });
    toast(`„${s.title}“ hinzugefügt`);
    location.hash = `#/read/${book.id}`;
  }

  async function handleFiles(files) {
    for (const f of files) {
      const t = toast(`Importiere „${f.name}“ …`, { ms: 60000 });
      const label = t.querySelector('span');
      try {
        const { book, existed } = await importFile(f, (p) => { label.textContent = `Importiere „${f.name}“ … ${Math.round(p * 100)} %`; });
        t.remove();
        toast(existed ? `„${book.title}“ ist schon in deiner Bibliothek` : `„${book.title}“ hinzugefügt ✓`, {
          type: 'success',
          action: { label: 'Lesen', fn: () => { location.hash = `#/read/${book.id}`; } },
        });
      } catch (e) {
        console.error(e);
        t.remove();
        toast(`Fehler bei „${f.name}“: ${e.message}`, { type: 'error', ms: 6000 });
      }
    }
    refresh();
  }

  function pasteDialog() {
    const title = el('input', { class: 'input', placeholder: 'Titel (optional)' });
    const area = el('textarea', { class: 'input', rows: 10, placeholder: 'Text hier einfügen (z. B. einen Artikel oder ein Kapitel) …' });
    const body = el('div', { class: 'paste-form' }, title, area,
      el('button', { class: 'btn primary', onclick: async () => {
        const text = area.value.trim();
        if (text.length < 5) { area.focus(); return; }
        const b = await importText(text, title.value.trim());
        dlg.close();
        location.hash = `#/read/${b.id}`;
      } }, 'Als Buch öffnen'));
    const dlg = openSheet({ title: 'Text einfügen', body });
    setTimeout(() => area.focus(), 50);
  }

  root.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'import') fileInput.click();
    if (act === 'paste') pasteDialog();
  });
  fileInput.addEventListener('change', () => { handleFiles([...fileInput.files]); fileInput.value = ''; });
  slot('q').addEventListener('input', draw);

  // Drag & Drop
  const overlay = root.querySelector('.drop-overlay');
  let dragDepth = 0;
  const onDragEnter = (e) => { if (e.dataTransfer?.types?.includes('Files')) { dragDepth++; overlay.hidden = false; } };
  const onDragLeave = () => { if (--dragDepth <= 0) { dragDepth = 0; overlay.hidden = true; } };
  const onDragOver = (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); };
  const onDrop = (e) => {
    e.preventDefault();
    dragDepth = 0;
    overlay.hidden = true;
    const files = [...(e.dataTransfer?.files || [])];
    if (files.length) handleFiles(files);
  };
  window.addEventListener('dragenter', onDragEnter);
  window.addEventListener('dragleave', onDragLeave);
  window.addEventListener('dragover', onDragOver);
  window.addEventListener('drop', onDrop);

  await refresh();

  return () => {
    window.removeEventListener('dragenter', onDragEnter);
    window.removeEventListener('dragleave', onDragLeave);
    window.removeEventListener('dragover', onDragOver);
    window.removeEventListener('drop', onDrop);
    urls.forEach((u) => URL.revokeObjectURL(u));
  };
}

// Dateien, die über "Öffnen mit" / Teilen an die App übergeben werden
export async function importLaunchedFiles(files) {
  for (const f of files) {
    try { await importFile(f); } catch (e) { toast(e.message, { type: 'error' }); }
  }
}
