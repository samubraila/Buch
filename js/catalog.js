// "Entdecken": kostenlose Bücher und Hörbücher direkt in der App finden und lesen
import * as db from './db.js';
import { EN_BOOKS, DE_BOOKS, SEARCH_LANGS, LIBRIVOX_LANGS } from './catalogData.js';
import { importFromUrl } from './importer.js';
import { playBook, loadLibrivox, recentAudiobooks, unlock as unlockAudioPlayer } from './audioPlayer.js';
import { el, coverColors, langName, toast, fetchWithTimeout, logError } from './util.js';
import { openSheet } from './ui.js';

const IA = 'https://archive.org';
const LEVEL = { 1: 'Leicht', 2: 'Mittel', 3: 'Schwer' };
const TABS = [
  { id: 'en', label: 'Englisch' },
  { id: 'de', label: 'Deutsch' },
  { id: 'search', label: '🔍 Suchen' },
  { id: 'audio', label: '🎧 Hörbücher' },
];

// Liste der Bücher, die auf unserem eigenen Server liegen (books/index.json, vom Build erzeugt)
let localIndex = null;
async function loadLocalIndex() {
  if (localIndex) return localIndex;
  try {
    const res = await fetch('books/index.json', { cache: 'no-cache' });
    localIndex = res.ok ? (await res.json()).books || {} : {};
  } catch {
    localIndex = {};
  }
  return localIndex;
}

function prettyCreator(c) {
  const s = [].concat(c || [])[0] || '';
  const m = s.replace(/,?\s*\d{3,4}\??-\d{0,4}\??$/, '').match(/^([^,]+),\s*(.+)$/);
  return m ? `${m[2].replace(/\s*\(.*\)$/, '')} ${m[1]}` : s;
}

function cleanQuery(q) {
  return q.replace(/[:"()[\]{}\\^~*?!+\-&|/]/g, ' ').replace(/\s+/g, ' ').trim();
}

const fmtSize = (bytes) => (bytes > 1048576 ? `${(bytes / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

async function iaSearch(query, rows = 30) {
  const url = `${IA}/advancedsearch.php?` + new URLSearchParams([
    ['q', query], ['fl[]', 'identifier'], ['fl[]', 'title'], ['fl[]', 'creator'], ['fl[]', 'downloads'],
    ['sort[]', 'downloads desc'], ['rows', String(rows)], ['output', 'json'],
  ]);
  const res = await fetchWithTimeout(url, {}, 20000);
  if (!res.ok) throw new Error('Suche gerade nicht erreichbar');
  return (await res.json()).response?.docs || [];
}

// Beste Textdatei eines Gutenberg-Eintrags auf archive.org
async function iaTextFile(identifier) {
  const res = await fetchWithTimeout(`${IA}/metadata/${encodeURIComponent(identifier)}`, {}, 20000);
  const d = await res.json();
  const names = (d.files || []).map((f) => f.name).filter((n) => /\.txt$/i.test(n) && !/_djvu\.txt$|_meta\.txt$/i.test(n));
  return names.find((n) => /-0\.txt$/.test(n)) || names.find((n) => /-8\.txt$/.test(n)) || names.find((n) => /^\d+\.txt$/.test(n)) || names[0] || null;
}

/** Fehler verständlich anzeigen, mit "Erneut versuchen" und Details zum Kopieren */
function showLoadError(title, err, retry) {
  const details = [`Buch: ${title}`, `Zeit: ${new Date().toLocaleString('de-DE')}`, `Browser: ${navigator.userAgent}`,
    `Online: ${navigator.onLine}`, ...(err.details || [err.message]).map((d, i) => `Versuch ${i + 1}: ${d}`)].join('\n');
  const offline = navigator.onLine === false;
  const body = el('div', { class: 'load-error' },
    el('p', {}, offline
      ? 'Du bist gerade offline. Zum Laden neuer Bücher brauchst du Internet.'
      : 'Das Buch konnte nicht geladen werden. Meist hilft es, es einfach nochmal zu versuchen.'),
    el('p', { class: 'muted small' }, 'Grund: ' + err.message),
    el('div', { class: 'row wrap' },
      el('button', { class: 'btn primary', onclick: () => { dlg.close(); retry(); } }, '↻ Erneut versuchen'),
      el('button', { class: 'btn', onclick: async () => {
        try { await navigator.clipboard.writeText(details); toast('Fehlerbericht kopiert – du kannst ihn jetzt weiterschicken'); } catch { toast('Kopieren nicht möglich', { type: 'error' }); }
      } }, '📋 Fehlerbericht kopieren')),
    el('details', { class: 'err-details' }, el('summary', {}, 'Technische Details'), el('pre', {}, details)));
  const dlg = openSheet({ title: 'Laden fehlgeschlagen', body, className: 'small' });
}

export async function openCatalog(mount, tab = 'en', query = '') {
  if (!TABS.some((t) => t.id === tab)) tab = 'en';
  const state = { tab, q: query ? decodeURIComponent(query) : '', lang: 'en', audioLang: 'en' };
  let library = await db.getAll('books');
  const inLib = (key) => library.find((b) => b.fileKey === 'url|' + key);
  const local = await loadLocalIndex();
  let busy = false;

  const root = el('div', { class: 'page catalog' });
  root.innerHTML = `
    <header class="page-head">
      <div><h1>Entdecken</h1><p class="muted">Kostenlose Bücher und Hörbücher – antippen und lesen</p></div>
    </header>
    <nav class="tabs" role="tablist">${TABS.map((t) => `<button role="tab" class="tab" data-tab="${t.id}">${t.label}</button>`).join('')}</nav>
    <div data-slot="body"></div>`;
  mount.replaceChildren(root);
  const body = root.querySelector('[data-slot="body"]');

  root.querySelector('.tabs').addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]')?.dataset.tab;
    if (t && t !== state.tab) { state.tab = t; history.replaceState(null, '', `#/discover/${t}`); draw(); }
  });

  function coverEl(title, author) {
    const [c1, c2] = coverColors(title + author);
    return el('div', { class: 'cover gen', style: `--c1:${c1};--c2:${c2}` },
      el('span', { class: 'gen-title' }, title), el('span', { class: 'gen-author' }, author));
  }

  /**
   * Eine Buch-Karte. Ein Tipp auf "Lesen" lädt das Buch (falls nötig) und öffnet es sofort.
   * @param {object} o { title, author, level, key, lang, source, size, sources: () => Promise<[{url,name}]> }
   */
  function bookCard(o) {
    const progress = el('div', { class: 'cat-progress', hidden: true }, el('span'));
    const label = () => (inLib(o.key) ? '📖 Weiterlesen' : '📖 Lesen');
    const btn = el('button', { class: 'btn small primary' }, label());

    const open = async () => {
      const ex = inLib(o.key);
      if (ex) { location.hash = `#/read/${ex.id}`; return; }
      if (busy) { toast('Ein anderes Buch wird gerade geladen …'); return; }
      busy = true;
      btn.disabled = true;
      progress.hidden = false;
      const bar = progress.querySelector('span');
      const set = (p) => { bar.style.width = `${Math.round(p * 100)}%`; btn.textContent = `Lädt … ${Math.round(p * 100)} %`; };
      set(0.02);
      try {
        const sources = await o.sources();
        if (!sources.length) throw new Error('Für dieses Buch gibt es keine Datei.');
        const { book } = await importFromUrl({ sources, key: o.key, title: o.title, author: o.author, lang: o.lang, onProgress: set });
        set(1);
        library = await db.getAll('books');
        busy = false;
        location.hash = `#/read/${book.id}`; // gleich öffnen
        return;
      } catch (e) {
        logError(`Laden: ${o.title}`, e);
        showLoadError(o.title, e, open);
        btn.textContent = label();
      }
      busy = false;
      btn.disabled = false;
      progress.hidden = true;
    };
    btn.addEventListener('click', open);

    const card = el('article', { class: 'cat-card' },
      el('button', { class: 'cat-cover-btn', 'aria-label': `${o.title} lesen`, onclick: open }, coverEl(o.title, o.author)),
      el('div', { class: 'cat-meta' },
        el('strong', {}, o.title),
        el('span', { class: 'muted' }, o.author),
        el('div', { class: 'cat-tags' },
          o.lang ? el('span', { class: 'lang-chip' }, o.lang.toUpperCase()) : null,
          o.level ? el('span', { class: `level l${o.level}` }, LEVEL[o.level]) : null,
          el('span', { class: 'muted small' }, [o.source, o.size ? fmtSize(o.size) : ''].filter(Boolean).join(' · '))),
        btn, progress));
    return card;
  }

  function curatedSources(b) {
    const list = [];
    if (local[b.id]) list.push({ url: `books/${local[b.id].file}`, name: local[b.id].file });
    if (b.remote) list.push({ url: b.remote, name: b.remoteName || `${b.id}.epub` });
    return list;
  }

  function curated(list, lang) {
    // Bücher ohne Datei (weder eigener Server noch Original-Seite) gar nicht erst anzeigen
    const usable = list.filter((b) => local[b.id] || b.remote);
    const groups = [1, 2, 3].map((lv) => ({ lv, items: usable.filter((b) => b.level === lv) })).filter((g) => g.items.length);
    body.replaceChildren(
      el('p', { class: 'muted cat-intro' }, lang === 'en'
        ? 'Englische Klassiker – schön gesetzt, mit Bildern. Tipp: Beginne mit „Leicht“ (z. B. Peter Rabbit oder Aesop).'
        : 'Deutsche Klassiker von Project Gutenberg. Tipp: Beginne mit „Leicht“ oder einer kurzen Novelle wie „Das Urteil“.'),
      ...groups.map((g) => el('section', { class: 'cat-group' },
        el('h2', {}, `${LEVEL[g.lv]}`),
        el('div', { class: 'cat-grid' }, ...g.items.map((b) => bookCard({
          title: b.title, author: b.author, level: b.level, lang, source: b.source,
          size: local[b.id]?.size, key: b.remote || b.id, sources: async () => curatedSources(b),
        }))))));
  }

  function langSelect(value, map, onChange) {
    const s = el('select', { class: 'select', 'aria-label': 'Sprache' },
      Object.keys(map).map((l) => el('option', { value: l, selected: l === value || null }, langName(l))));
    s.addEventListener('change', () => onChange(s.value));
    return s;
  }

  function searchView() {
    const input = el('input', { type: 'search', class: 'input', placeholder: 'Titel oder Autor, z. B. „Kafka“ oder „Sherlock“', value: state.q, enterkeyhint: 'search' });
    const results = el('div', { class: 'cat-grid' });
    const info = el('p', { class: 'muted' }, 'Suche in über 70.000 freien Büchern von Project Gutenberg.');
    const run = async () => {
      const q = cleanQuery(input.value);
      state.q = input.value;
      if (q.length < 2) { input.focus(); return; }
      info.textContent = 'Suche …';
      results.replaceChildren();
      try {
        const docs = await iaSearch(`collection:gutenberg AND language:${SEARCH_LANGS[state.lang]} AND (title:(${q}) OR creator:(${q}))`);
        info.textContent = docs.length ? `${docs.length} Treffer` : 'Keine Treffer – anderes Wort oder andere Sprache versuchen.';
        results.replaceChildren(...docs.map((d) => bookCard({
          title: String(d.title).trim(), author: prettyCreator(d.creator), lang: state.lang, source: 'Gutenberg',
          key: `ia:${d.identifier}`,
          sources: async () => {
            const file = await iaTextFile(d.identifier);
            if (!file) throw new Error('Für dieses Buch gibt es leider keine Textdatei.');
            return [{ url: `${IA}/download/${d.identifier}/${file}`, name: file }];
          },
        })));
      } catch (e) {
        logError('Suche', e);
        info.textContent = navigator.onLine === false ? 'Keine Internetverbindung.' : e.message;
      }
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
    body.replaceChildren(
      el('div', { class: 'cat-search' }, input, langSelect(state.lang, SEARCH_LANGS, (l) => { state.lang = l; if (input.value.trim()) run(); }),
        el('button', { class: 'btn primary', onclick: run }, 'Suchen')),
      info, results);
    if (state.q) run(); else setTimeout(() => input.focus(), 50);
  }

  async function audioView() {
    const input = el('input', { type: 'search', class: 'input', placeholder: 'Hörbuch suchen, z. B. „Alice“ oder „Tolstoi“', value: state.q, enterkeyhint: 'search' });
    const results = el('div', { class: 'cat-grid' });
    const info = el('p', { class: 'muted' });
    const recentBox = el('div');

    const playCard = ({ id, title, author, extra, btnLabel }) => {
      const btn = el('button', { class: 'btn small primary' }, btnLabel || '▶ Anhören');
      const go = async () => {
        unlockAudioPlayer(); // iPhone: Ton noch während des Tippens freischalten
        btn.disabled = true;
        btn.textContent = 'Lädt …';
        try {
          await playBook(await loadLibrivox(id, { title, author }));
        } catch (e) {
          logError(`Hörbuch: ${title}`, e);
          toast(e.message, { type: 'error' });
        }
        btn.disabled = false;
        btn.textContent = btnLabel || '▶ Anhören';
      };
      btn.addEventListener('click', go);
      return el('article', { class: 'cat-card' },
        el('button', { class: 'cat-cover-btn', 'aria-label': `${title} anhören`, onclick: go },
          el('div', { class: 'cover' }, el('img', {
            src: `${IA}/services/img/${encodeURIComponent(id)}`, alt: '', loading: 'lazy',
            // archive.org liefert manchmal kein Bild -> selbst gemaltes Cover
            onerror: (e) => e.target.parentElement.replaceWith(coverEl(title, author)),
          }))),
        el('div', { class: 'cat-meta' }, el('strong', {}, title), el('span', { class: 'muted' }, author),
          el('div', { class: 'cat-tags' }, el('span', { class: 'muted small' }, extra)), btn));
    };

    const run = async () => {
      const q = cleanQuery(input.value);
      state.q = input.value;
      info.textContent = 'Suche …';
      results.replaceChildren();
      try {
        const query = `collection:librivoxaudio AND language:${LIBRIVOX_LANGS[state.audioLang]}` + (q ? ` AND (title:(${q}) OR creator:(${q}))` : '');
        const docs = await iaSearch(query, 30);
        info.textContent = q
          ? (docs.length ? `${docs.length} Hörbücher gefunden` : 'Nichts gefunden – anderes Wort oder andere Sprache versuchen.')
          : `Beliebte Hörbücher (${langName(state.audioLang)})`;
        results.replaceChildren(...docs.map((d) => playCard({
          id: d.identifier,
          title: String(d.title).replace(/\s*\(?version \d+\)?$/i, '').trim(),
          author: prettyCreator(d.creator),
          extra: 'LibriVox · gelesen von Freiwilligen',
        })));
      } catch (e) {
        logError('Hörbuch-Suche', e);
        info.textContent = navigator.onLine === false ? 'Keine Internetverbindung.' : e.message;
      }
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });

    const recent = await recentAudiobooks();
    if (recent.length) {
      recentBox.append(el('h2', {}, 'Weiterhören'), el('div', { class: 'cat-grid' }, ...recent.slice(0, 6).map((r) => playCard({
        id: r.id, title: r.title, author: r.author, extra: `Kapitel ${r.index + 1} von ${r.total}`, btnLabel: '▶ Weiter',
      }))));
    }

    body.replaceChildren(
      el('p', { class: 'muted cat-intro' }, 'Echte Hörbücher, von Menschen gelesen (LibriVox). Tipp: Das gleiche Buch unter „Englisch“ öffnen und beim Hören mitlesen. Jedes Buch in deiner Bibliothek kannst du dir außerdem mit 🎧 vorlesen lassen.'),
      recentBox,
      el('div', { class: 'cat-search' }, input, langSelect(state.audioLang, LIBRIVOX_LANGS, (l) => { state.audioLang = l; run(); }),
        el('button', { class: 'btn primary', onclick: run }, 'Suchen')),
      info, results);
    run();
  }

  function draw() {
    root.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === state.tab)));
    if (state.tab === 'en') curated(EN_BOOKS, 'en');
    else if (state.tab === 'de') curated(DE_BOOKS, 'de');
    else if (state.tab === 'search') searchView();
    else audioView();
  }

  draw();
  return () => {};
}
