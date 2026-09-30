// "Entdecken": kostenlose Bücher und Hörbücher direkt in der App finden und laden
import * as db from './db.js';
import { EN_BOOKS, DE_BOOKS, SEARCH_LANGS, LIBRIVOX_LANGS } from './catalogData.js';
import { importFromUrl } from './importer.js';
import { playBook, loadLibrivox, recentAudiobooks } from './audioPlayer.js';
import { el, coverColors, langName, toast, fetchWithTimeout } from './util.js';

const IA = 'https://archive.org';
const LEVEL = { 1: 'Leicht', 2: 'Mittel', 3: 'Schwer' };
const TABS = [
  { id: 'en', label: 'Englisch' },
  { id: 'de', label: 'Deutsch' },
  { id: 'search', label: '🔍 Suchen' },
  { id: 'audio', label: '🎧 Hörbücher' },
];

function prettyCreator(c) {
  const s = [].concat(c || [])[0] || '';
  const m = s.replace(/,?\s*\d{3,4}\??-\d{0,4}\??$/, '').match(/^([^,]+),\s*(.+)$/);
  return m ? `${m[2].replace(/\s*\(.*\)$/, '')} ${m[1]}` : s;
}

function cleanQuery(q) {
  return q.replace(/[:"()[\]{}\\^~*?!+\-&|/]/g, ' ').replace(/\s+/g, ' ').trim();
}

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

export async function openCatalog(mount, tab = 'en', query = '') {
  if (!TABS.some((t) => t.id === tab)) tab = 'en';
  const state = { tab, q: query ? decodeURIComponent(query) : '', lang: 'en', audioLang: 'en' };
  let library = await db.getAll('books');
  const inLib = (key) => library.find((b) => b.fileKey === 'url|' + key);

  const root = el('div', { class: 'page catalog' });
  root.innerHTML = `
    <header class="page-head">
      <div><h1>Entdecken</h1><p class="muted">Kostenlose Bücher und Hörbücher – ein Tipp und los geht's</p></div>
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

  function bookCard({ title, author, level, key, lang, source, load }) {
    const existing = inLib(key);
    const btn = el('button', { class: 'btn small ' + (existing ? '' : 'primary') }, existing ? 'Lesen' : 'Laden');
    btn.addEventListener('click', async () => {
      const ex = inLib(key);
      if (ex) { location.hash = `#/read/${ex.id}`; return; }
      btn.disabled = true;
      btn.textContent = 'Lädt …';
      try {
        const { book } = await load((p) => { btn.textContent = `${Math.round(p * 100)} %`; });
        library = await db.getAll('books');
        toast(`„${book.title}“ ist in deiner Bibliothek ✓`, { type: 'success', action: { label: 'Lesen', fn: () => { location.hash = `#/read/${book.id}`; } } });
        btn.textContent = 'Lesen';
        btn.classList.remove('primary');
      } catch (e) {
        toast(e.message, { type: 'error', ms: 6000 });
        btn.textContent = 'Laden';
      }
      btn.disabled = false;
    });
    return el('article', { class: 'cat-card' },
      coverEl(title, author),
      el('div', { class: 'cat-meta' },
        el('strong', {}, title),
        el('span', { class: 'muted' }, author),
        el('div', { class: 'cat-tags' },
          lang ? el('span', { class: 'lang-chip' }, lang.toUpperCase()) : null,
          level ? el('span', { class: `level l${level}` }, LEVEL[level]) : null,
          source ? el('span', { class: 'muted small' }, source) : null),
        btn));
  }

  function curated(list, lang, source) {
    const groups = [1, 2, 3].map((lv) => ({ lv, items: list.filter((b) => b.level === lv) })).filter((g) => g.items.length);
    body.replaceChildren(
      el('p', { class: 'muted cat-intro' }, lang === 'en'
        ? 'Englische Klassiker von Standard Ebooks – liebevoll gesetzt, mit Cover. Tipp: Beginne mit „Leicht“.'
        : 'Deutsche Klassiker von Project Gutenberg. Tipp: Beginne mit „Leicht“ oder einer kurzen Novelle.'),
      ...groups.map((g) => el('section', { class: 'cat-group' },
        el('h2', {}, `${LEVEL[g.lv]}`),
        el('div', { class: 'cat-grid' }, ...g.items.map((b) => bookCard({
          title: b.title, author: b.author, level: b.level, lang, source,
          key: b.url || `ia:${b.ia}`,
          load: (onProgress) => b.url
            ? importFromUrl({ url: b.url, title: b.title, author: b.author, lang, name: 'buch.epub', onProgress })
            : importFromUrl({ url: `${IA}/download/${b.ia}/${b.file}`, key: `ia:${b.ia}`, title: b.title, author: b.author, lang, name: b.file, onProgress }),
        }))))));
  }

  function langSelect(value, map, onChange) {
    const s = el('select', { class: 'select', 'aria-label': 'Sprache' },
      Object.keys(map).map((l) => el('option', { value: l, selected: l === value || null }, langName(l))));
    s.addEventListener('change', () => onChange(s.value));
    return s;
  }

  function searchView() {
    const input = el('input', { type: 'search', class: 'input', placeholder: 'Titel oder Autor, z. B. „Kafka“ oder „Sherlock“', value: state.q });
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
          load: async (onProgress) => {
            const file = await iaTextFile(d.identifier);
            if (!file) throw new Error('Für dieses Buch gibt es leider keine Textdatei.');
            return importFromUrl({ url: `${IA}/download/${d.identifier}/${file}`, key: `ia:${d.identifier}`, title: String(d.title).trim(), author: prettyCreator(d.creator), lang: state.lang, name: file, onProgress });
          },
        })));
      } catch (e) {
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
    const input = el('input', { type: 'search', class: 'input', placeholder: 'Hörbuch suchen, z. B. „Alice“ oder „Tolstoi“', value: state.q });
    const results = el('div', { class: 'cat-grid' });
    const info = el('p', { class: 'muted' });
    const recentBox = el('div');

    const audioCard = (d) => {
      const cover = `${IA}/services/img/${encodeURIComponent(d.identifier)}`;
      const title = String(d.title).replace(/\s*\(?version \d+\)?$/i, '').trim();
      const author = prettyCreator(d.creator);
      const btn = el('button', { class: 'btn small primary' }, '▶ Anhören');
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Lädt …';
        try {
          await playBook(await loadLibrivox(d.identifier, { title, author }));
        } catch (e) { toast(e.message, { type: 'error' }); }
        btn.disabled = false;
        btn.textContent = '▶ Anhören';
      });
      return el('article', { class: 'cat-card' },
        el('div', { class: 'cover' }, el('img', { src: cover, alt: '', loading: 'lazy' })),
        el('div', { class: 'cat-meta' },
          el('strong', {}, title), el('span', { class: 'muted' }, author),
          el('div', { class: 'cat-tags' }, el('span', { class: 'muted small' }, 'LibriVox · gelesen von Freiwilligen')),
          btn));
    };

    const run = async () => {
      const q = cleanQuery(input.value);
      state.q = input.value;
      info.textContent = 'Suche …';
      results.replaceChildren();
      try {
        const lang = LIBRIVOX_LANGS[state.audioLang];
        const query = `collection:librivoxaudio AND language:${lang}` + (q ? ` AND (title:(${q}) OR creator:(${q}))` : '');
        const docs = await iaSearch(query, 30);
        info.textContent = q
          ? (docs.length ? `${docs.length} Hörbücher gefunden` : 'Nichts gefunden – anderes Wort oder andere Sprache versuchen.')
          : `Beliebte Hörbücher (${langName(state.audioLang)})`;
        results.replaceChildren(...docs.map(audioCard));
      } catch (e) {
        info.textContent = navigator.onLine === false ? 'Keine Internetverbindung.' : e.message;
      }
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });

    const recent = await recentAudiobooks();
    if (recent.length) {
      recentBox.append(el('h2', {}, 'Weiterhören'), el('div', { class: 'cat-grid' }, ...recent.slice(0, 6).map((r) => {
        const btn = el('button', { class: 'btn small primary' }, '▶ Weiter');
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try { await playBook(await loadLibrivox(r.id, { title: r.title, author: r.author })); } catch (e) { toast(e.message, { type: 'error' }); }
          btn.disabled = false;
        });
        return el('article', { class: 'cat-card' },
          el('div', { class: 'cover' }, el('img', { src: r.cover, alt: '', loading: 'lazy' })),
          el('div', { class: 'cat-meta' }, el('strong', {}, r.title), el('span', { class: 'muted' }, r.author),
            el('span', { class: 'muted small' }, `Kapitel ${r.index + 1} von ${r.total}`), btn));
      })));
    }

    body.replaceChildren(
      el('p', { class: 'muted cat-intro' }, 'Echte Hörbücher, von Menschen gelesen (LibriVox). Tipp: Das gleiche Buch in „Englisch“ laden und beim Hören mitlesen. Jedes Buch in deiner Bibliothek kannst du dir außerdem mit 🎧 vorlesen lassen.'),
      recentBox,
      el('div', { class: 'cat-search' }, input, langSelect(state.audioLang, LIBRIVOX_LANGS, (l) => { state.audioLang = l; run(); }),
        el('button', { class: 'btn primary', onclick: run }, 'Suchen')),
      info, results);
    run();
  }

  function draw() {
    root.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === state.tab)));
    if (navigator.onLine === false && state.tab !== 'audio') {
      body.replaceChildren(el('div', { class: 'empty' }, el('div', { class: 'empty-art' }, '📡'), el('h3', {}, 'Keine Internetverbindung'),
        el('p', { class: 'muted' }, 'Zum Laden neuer Bücher brauchst du Internet. Deine Bibliothek funktioniert auch offline.')));
      return;
    }
    if (state.tab === 'en') curated(EN_BOOKS, 'en', 'Standard Ebooks');
    else if (state.tab === 'de') curated(DE_BOOKS, 'de', 'Gutenberg');
    else if (state.tab === 'search') searchView();
    else audioView();
  }

  draw();
  return () => {};
}

