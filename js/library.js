// Bibliothek: Bücher anzeigen, importieren, löschen
import * as db from './db.js';
import { importFile, importText, deleteBook, saveParsed, ACCEPT } from './importer.js';
import { SAMPLES } from './samples.js';
import { el, coverColors, langName, toast, fmtMinutes } from './util.js';
import { openSheet, confirmDialog } from './ui.js';

const I = {
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  paste: '<svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M9 4h6v3H9zM8.5 11h7M8.5 14.5h7M8.5 18h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="19" cy="12" r="1.8" fill="currentColor"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M16 16l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
};

export async function openLibrary(mount) {
  const urls = [];
  const coverUrl = (b) => {
    if (!b.cover) return '';
    const u = URL.createObjectURL(b.cover);
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
    <div data-slot="continue"></div>
    <section>
      <div class="sec-head"><h2>Meine Bücher</h2><span class="muted" data-slot="count"></span></div>
      <div class="book-grid" data-slot="grid"></div>
      <div data-slot="empty"></div>
    </section>
    <section class="sources">
      <h2>Kostenlose Bücher finden</h2>
      <p class="muted">Lade ein EPUB herunter und füge es hier mit „Buch hinzufügen“ ein – oder ziehe die Datei einfach in dieses Fenster.</p>
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
  async function refresh() {
    urls.splice(0).forEach((u) => URL.revokeObjectURL(u));
    books = (await db.getAll('books')).sort((a, b) => (b.lastRead || b.addedAt) - (a.lastRead || a.addedAt));
    draw();
  }

  function draw() {
    const q = slot('q').value.trim().toLowerCase();
    const list = q ? books.filter((b) => (b.title + ' ' + b.author).toLowerCase().includes(q)) : books;
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
          ...SAMPLES.map((s) => el('button', { class: 'btn', onclick: () => addSample(s) }, el('span', { class: 'lang-chip' }, s.lang.toUpperCase()), s.title)))));
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
          el('span', { class: 'pct' }, pct ? pct + ' %' : 'neu'),
          el('button', { class: 'icon-btn small', 'aria-label': 'Optionen', html: I.more, onclick: (e) => { e.preventDefault(); bookMenu(b); } }))));
    return a;
  }

  function bookMenu(b) {
    const body = el('div', { class: 'menu-list' },
      el('div', { class: 'book-info' },
        el('strong', {}, b.title),
        el('span', { class: 'muted' }, [b.author, langName(b.lang), (b.format || '').toUpperCase(), `${b.chapters.length} Kapitel`, fmtMinutes(b.totalChars) + ' Lesezeit'].filter(Boolean).join(' · '))),
      el('a', { class: 'menu-item', href: `#/read/${b.id}`, onclick: () => dlg.close() }, '📖 Lesen'),
      el('button', { class: 'menu-item', onclick: async () => {
        b.pos = { ch: 0, blk: 0, pct: 0 }; b.lastRead = 0;
        await db.put('books', b); dlg.close(); refresh();
      } }, '↺ Fortschritt zurücksetzen'),
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
