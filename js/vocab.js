// Vokabelheft: Liste mit Grammatik, Suchen/Filtern, Wörter hinzufügen und bearbeiten
import { allWords, dueWords, removeWord, saveWord, toCSV, importBackup, INTERVALS } from './vocabStore.js';
import { speak } from './speech.js';
import { translateWord, translateText } from './translate.js';
import { grammarFor, grammarLine } from './grammar.js';
import { compactGrammar, openWord, openPhrase } from './popup.js';
import { settings } from './settings.js';
import { el, escapeHtml, langName, toast, fmtDate, LANGS, cleanWord } from './util.js';
import { confirmDialog, openSheet, field } from './ui.js';

export const SPEAK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a4.5 4.5 0 0 1 0 7" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>';
const TRASH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const EDIT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/></svg>';

function download(name, text, type) {
  const a = el('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export function ctxHtml(ctx, word) {
  if (!ctx) return '';
  const s = escapeHtml(ctx);
  const w = escapeHtml(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try { return s.replace(new RegExp(`(${w})`, 'iu'), '<mark>$1</mark>'); } catch { return s; }
}

/** Wort mit farbigem Artikel (deutsche Nomen), z. B. [das] Haus */
export function wordWithArticle(w) {
  const g = w.gram;
  const frag = document.createDocumentFragment();
  if (g?.pos === 'noun' && g.article && !w.word.includes(' ')) frag.append(el('span', { class: `art art-${g.gender}` }, g.article), ' ');
  frag.append(el('strong', { lang: w.lang }, w.word));
  return frag;
}

// Training auf ein Buch beschränken (wird von train.js gelesen)
export function setTrainBook(title) {
  try { if (title) sessionStorage.setItem('lw-train-book', title); else sessionStorage.removeItem('lw-train-book'); } catch { /* ignorieren */ }
}

/** Dialog: Wort selbst hinzufügen oder bearbeiten */
export function openWordEditor(existing, onDone) {
  const isNew = !existing;
  const w = existing || { word: '', lang: 'en', translation: '', context: '' };
  const word = el('input', { class: 'input', value: w.word, placeholder: 'Wort oder Wendung', autocapitalize: 'off', disabled: isNew ? null : true });
  const lang = el('select', { class: 'select', disabled: isNew ? null : true },
    ['en', 'de', ...LANGS.filter((l) => l !== 'en' && l !== 'de')].map((l) => el('option', { value: l, selected: l === w.lang || null }, langName(l))));
  const tr = el('textarea', { class: 'input', rows: 2, placeholder: `Übersetzung (${langName(settings.target)})` });
  tr.value = w.translation || '';
  const ctx = el('textarea', { class: 'input', rows: 2, placeholder: 'Beispielsatz (optional)' });
  ctx.value = w.context || '';
  const auto = el('button', { class: 'btn small', type: 'button', onclick: async () => {
    const text = word.value.trim();
    if (!text) { word.focus(); return; }
    auto.disabled = true;
    auto.textContent = 'Übersetze …';
    try {
      const r = text.includes(' ') ? await translateText(text, lang.value, settings.target) : await translateWord(text, lang.value, settings.target);
      tr.value = r.text;
    } catch (e) { toast(e.message, { type: 'error' }); }
    auto.disabled = false;
    auto.textContent = '🌐 Automatisch übersetzen';
  } }, '🌐 Automatisch übersetzen');
  const save = el('button', { class: 'btn primary', onclick: async () => {
    const text = word.value.trim();
    if (!text) { word.focus(); return; }
    save.disabled = true;
    const gram = isNew && !text.includes(' ') ? compactGrammar(await grammarFor(text, lang.value)) : w.gram;
    await saveWord({ ...w, word: text, lang: lang.value, target: w.target || settings.target, translation: tr.value.trim(), context: ctx.value.trim(), gram: gram || null, bookTitle: w.bookTitle || (isNew ? 'Selbst hinzugefügt' : '') });
    dlg.close();
    toast(isNew ? 'Wort hinzugefügt ⭐' : 'Gespeichert ✓');
    onDone?.();
  } }, isNew ? 'Hinzufügen' : 'Speichern');
  const body = el('div', { class: 'word-editor' },
    field('Wort', word),
    field('Sprache', lang),
    field('Übersetzung', el('div', { class: 'stack' }, tr, auto)),
    field('Beispielsatz', ctx),
    save);
  const dlg = openSheet({ title: isNew ? 'Wort hinzufügen' : 'Wort bearbeiten', body });
  setTimeout(() => (isNew ? word : tr).focus(), 60);
}

export async function openVocab(mount) {
  const root = el('div', { class: 'page vocab' });
  root.innerHTML = `
    <header class="page-head">
      <div><h1>Vokabelheft</h1><p class="muted" data-slot="sub"></p></div>
      <div class="lib-actions">
        <a class="btn primary" href="#/train" data-slot="train">Trainieren</a>
        <button class="btn" data-act="add">＋ Wort hinzufügen</button>
        <button class="btn" data-act="csv">CSV</button>
        <button class="btn" data-act="backup">Sichern</button>
        <button class="btn" data-act="restore">Wiederherstellen</button>
        <input type="file" accept=".json,application/json" hidden data-slot="file">
      </div>
    </header>
    <form class="lookup-box" data-slot="lookup">
      <label class="lb-label" for="lookup-input">🔎 Nachschlagen</label>
      <div class="lb-row">
        <input id="lookup-input" class="input" name="q" placeholder="Wort oder Satz eintippen …" autocomplete="off" autocapitalize="off" enterkeyhint="search">
        <select class="select" name="srclang" aria-label="Sprache"></select>
        <button class="btn primary" type="submit">Übersetzen</button>
      </div>
    </form>
    <div class="vocab-tools">
      <label class="search"><span class="sr-only">Suchen</span><input type="search" placeholder="Wort oder Übersetzung suchen" data-slot="q"></label>
      <div class="chips" data-slot="langs"></div>
      <select class="select" data-slot="book" aria-label="Nach Buch filtern"></select>
      <select class="select" data-slot="sort" aria-label="Sortierung">
        <option value="new">Neueste zuerst</option>
        <option value="az">A–Z</option>
        <option value="box">Am schwierigsten zuerst</option>
      </select>
    </div>
    <div data-slot="bookbar"></div>
    <div class="vocab-list" data-slot="list"></div>
  `;
  mount.replaceChildren(root);
  const slot = (s) => root.querySelector(`[data-slot="${s}"]`);
  let words = [];
  let langFilter = '';
  let bookFilter = '';

  async function refresh() {
    words = await allWords();
    const due = (await dueWords()).length;
    slot('sub').textContent = words.length ? `${words.length} Wörter · ${due} heute fällig` : 'Noch keine Wörter gespeichert';
    slot('train').textContent = due ? `Trainieren (${due})` : 'Trainieren';
    const langs = [...new Set(words.map((w) => w.lang))];
    slot('langs').replaceChildren(...(langs.length > 1 ? ['', ...langs] : []).map((l) =>
      el('button', { class: 'chip' + (l === langFilter ? ' on' : ''), onclick: () => { langFilter = l; refresh(); } }, l ? l.toUpperCase() : 'Alle')));
    const books = [...new Set(words.map((w) => w.bookTitle).filter(Boolean))].sort();
    const bookSel = slot('book');
    bookSel.hidden = books.length < 2;
    bookSel.replaceChildren(el('option', { value: '' }, 'Alle Bücher'),
      ...books.map((b) => el('option', { value: b, selected: b === bookFilter || null }, b.length > 40 ? b.slice(0, 38) + '…' : b)));
    draw();
  }

  function draw() {
    const q = slot('q').value.trim().toLowerCase();
    const list = words.filter((w) => (!langFilter || w.lang === langFilter) && (!bookFilter || w.bookTitle === bookFilter) &&
      (!q || w.word.toLowerCase().includes(q) || (w.translation || '').toLowerCase().includes(q)));
    const sort = slot('sort').value;
    if (sort === 'new') list.sort((a, b) => b.addedAt - a.addedAt);
    if (sort === 'az') list.sort((a, b) => a.word.localeCompare(b.word));
    if (sort === 'box') list.sort((a, b) => (a.box || 0) - (b.box || 0));

    slot('bookbar').replaceChildren(bookFilter
      ? el('div', { class: 'book-bar' },
        el('span', {}, `${list.length} Wörter aus „${bookFilter}“`),
        el('a', { class: 'btn small primary', href: '#/train', onclick: () => setTrainBook(bookFilter) }, '🧠 Diese Wörter üben'))
      : '');

    const box = slot('list');
    if (!words.length) {
      box.innerHTML = `<div class="empty"><div class="empty-art">⭐</div><h3>Noch leer</h3>
        <p class="muted">Tippe beim Lesen auf ein Wort und dann auf „Zu Vokabeln“ – so landet es hier, mit Übersetzung, Grammatik und dem Satz aus dem Buch. Oder füge oben selbst ein Wort hinzu.</p></div>`;
      return;
    }
    box.replaceChildren(...list.map((w) => {
      const gl = w.gram ? grammarLine(w.gram) : '';
      const showGl = gl && !(w.gram.pos === 'noun' && !w.gram.plural);
      return el('article', { class: 'vocab-row' },
        el('div', { class: 'vr-main' },
          el('div', { class: 'vr-word' },
            wordWithArticle(w),
            w.ipa ? el('span', { class: 'ipa' }, w.ipa) : null,
            el('span', { class: 'lang-chip' }, w.lang.toUpperCase()),
            el('span', { class: 'box-dots', title: `Lernstufe ${w.box || 0} von ${INTERVALS.length - 1}` },
              ...INTERVALS.slice(1).map((_, i) => el('i', { class: i < (w.box || 0) ? 'on' : '' })))),
          showGl ? el('div', { class: 'vr-gram' }, gl) : null,
          el('div', { class: 'vr-tr', lang: w.target || 'ru' }, w.translation || '—',
            w.alts?.length ? el('span', { class: 'muted' }, ' · ' + w.alts.filter((a) => a !== w.translation).slice(0, 4).join(', ')) : null),
          w.context ? el('p', { class: 'vr-ctx', lang: w.lang, html: ctxHtml(w.context, w.word) }) : null,
          el('div', { class: 'vr-src muted' }, [w.bookTitle, fmtDate(w.addedAt)].filter(Boolean).join(' · '))),
        el('div', { class: 'vr-actions' },
          el('button', { class: 'icon-btn', 'aria-label': 'Anhören', title: 'Anhören', html: SPEAK, onclick: () => speak(w.word, w.lang).catch(() => {}) }),
          el('button', { class: 'icon-btn', 'aria-label': 'Bearbeiten', title: 'Bearbeiten', html: EDIT, onclick: () => openWordEditor(w, refresh) }),
          el('button', { class: 'icon-btn', 'aria-label': 'Löschen', title: 'Löschen', html: TRASH, onclick: async () => {
            if (await confirmDialog(`„${w.word}“ aus dem Vokabelheft löschen?`, { ok: 'Löschen', danger: true })) { await removeWord(w.id); refresh(); }
          } })));
    }));
  }

  root.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'add') openWordEditor(null, refresh);
    if (act === 'csv') {
      if (!words.length) return toast('Keine Wörter zum Exportieren');
      download('vokabeln.csv', toCSV(words), 'text/csv;charset=utf-8');
    }
    if (act === 'backup') download(`lesewelt-vokabeln-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ app: 'LeseWelt', vocab: words }, null, 1), 'application/json');
    if (act === 'restore') slot('file').click();
  });
  slot('file').addEventListener('change', async () => {
    const f = slot('file').files[0];
    if (!f) return;
    try {
      const n = await importBackup(JSON.parse(await f.text()));
      toast(`${n} Wörter wiederhergestellt`, { type: 'success' });
      refresh();
    } catch (err) { toast(err.message, { type: 'error' }); }
    slot('file').value = '';
  });
  // Nachschlagen ohne Buch: Übersetzung, Aussprache, Grammatik, speichern
  const lookupForm = slot('lookup');
  let lastLang = 'en';
  try { lastLang = localStorage.getItem('lw-lookup-lang') || 'en'; } catch { /* ignorieren */ }
  const langSel = lookupForm.elements.srclang;
  langSel.replaceChildren(...['en', 'de', ...LANGS.filter((l) => l !== 'en' && l !== 'de' && l !== settings.target)]
    .map((l) => el('option', { value: l, selected: l === lastLang || null }, langName(l))));
  lookupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = lookupForm.elements.q.value.trim();
    if (!text) { lookupForm.elements.q.focus(); return; }
    const lang = langSel.value;
    try { localStorage.setItem('lw-lookup-lang', lang); } catch { /* ignorieren */ }
    const rect = lookupForm.elements.q.getBoundingClientRect();
    lookupForm.elements.q.blur();
    if (text.split(/\s+/).length === 1) openWord({ word: cleanWord(text) || text, lang, rect, sentence: '', bookTitle: 'Nachgeschlagen', onSaved: refresh });
    else openPhrase({ text, lang, rect, bookTitle: 'Nachgeschlagen', onSaved: refresh });
  });

  slot('q').addEventListener('input', draw);
  slot('sort').addEventListener('change', draw);
  slot('book').addEventListener('change', () => { bookFilter = slot('book').value; draw(); });
  await refresh();
  return () => {};
}
