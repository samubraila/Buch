// Vokabelheft-Ansicht und Karteikarten-Training
import { allWords, dueWords, removeWord, review, toCSV, importBackup, INTERVALS } from './vocabStore.js';
import { speak } from './speech.js';
import { el, escapeHtml, langName, toast, fmtDate } from './util.js';
import { confirmDialog } from './ui.js';

const SPEAK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a4.5 4.5 0 0 1 0 7" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>';
const TRASH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function download(name, text, type) {
  const a = el('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function ctxHtml(ctx, word) {
  if (!ctx) return '';
  const s = escapeHtml(ctx);
  const w = escapeHtml(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try { return s.replace(new RegExp(`(${w})`, 'iu'), '<mark>$1</mark>'); } catch { return s; }
}

export async function openVocab(mount) {
  const root = el('div', { class: 'page vocab' });
  root.innerHTML = `
    <header class="page-head">
      <div><h1>Vokabelheft</h1><p class="muted" data-slot="sub"></p></div>
      <div class="lib-actions">
        <a class="btn primary" href="#/train" data-slot="train">Trainieren</a>
        <button class="btn" data-act="csv">CSV exportieren</button>
        <button class="btn" data-act="backup">Sichern</button>
        <button class="btn" data-act="restore">Wiederherstellen</button>
        <input type="file" accept=".json,application/json" hidden data-slot="file">
      </div>
    </header>
    <div class="vocab-tools">
      <label class="search"><span class="sr-only">Suchen</span><input type="search" placeholder="Wort oder Übersetzung suchen" data-slot="q"></label>
      <div class="chips" data-slot="langs"></div>
      <select class="select" data-slot="sort" aria-label="Sortierung">
        <option value="new">Neueste zuerst</option>
        <option value="az">A–Z</option>
        <option value="box">Am schwierigsten zuerst</option>
      </select>
    </div>
    <div class="vocab-list" data-slot="list"></div>
  `;
  mount.replaceChildren(root);
  const slot = (s) => root.querySelector(`[data-slot="${s}"]`);
  let words = [];
  let langFilter = '';

  async function refresh() {
    words = await allWords();
    const due = (await dueWords()).length;
    slot('sub').textContent = words.length
      ? `${words.length} Wörter · ${due} heute fällig`
      : 'Noch keine Wörter gespeichert';
    slot('train').textContent = due ? `Trainieren (${due})` : 'Trainieren';
    const langs = [...new Set(words.map((w) => w.lang))];
    slot('langs').replaceChildren(...(langs.length > 1 ? ['', ...langs] : []).map((l) =>
      el('button', { class: 'chip' + (l === langFilter ? ' on' : ''), onclick: () => { langFilter = l; refresh(); } }, l ? l.toUpperCase() : 'Alle')));
    draw();
  }

  function draw() {
    const q = slot('q').value.trim().toLowerCase();
    let list = words.filter((w) => (!langFilter || w.lang === langFilter) &&
      (!q || w.word.toLowerCase().includes(q) || (w.translation || '').toLowerCase().includes(q)));
    const sort = slot('sort').value;
    if (sort === 'new') list.sort((a, b) => b.addedAt - a.addedAt);
    if (sort === 'az') list.sort((a, b) => a.word.localeCompare(b.word));
    if (sort === 'box') list.sort((a, b) => (a.box || 0) - (b.box || 0));
    const box = slot('list');
    if (!words.length) {
      box.innerHTML = `<div class="empty"><div class="empty-art">⭐</div><h3>Noch leer</h3>
        <p class="muted">Tippe beim Lesen auf ein Wort und dann auf den Stern ⭐ – so landet es hier, mit Übersetzung und dem Satz aus dem Buch.</p></div>`;
      return;
    }
    box.replaceChildren(...list.map((w) => el('article', { class: 'vocab-row' },
      el('div', { class: 'vr-main' },
        el('div', { class: 'vr-word' },
          el('strong', { lang: w.lang }, w.word),
          w.ipa ? el('span', { class: 'ipa' }, w.ipa) : null,
          el('span', { class: 'lang-chip' }, w.lang.toUpperCase()),
          el('span', { class: 'box-dots', title: `Lernstufe ${w.box || 0} von ${INTERVALS.length - 1}` },
            ...INTERVALS.slice(1).map((_, i) => el('i', { class: i < (w.box || 0) ? 'on' : '' })))),
        el('div', { class: 'vr-tr', lang: w.target || 'ru' }, w.translation || '—',
          w.alts?.length ? el('span', { class: 'muted' }, ' · ' + w.alts.filter((a) => a !== w.translation).slice(0, 4).join(', ')) : null),
        w.context ? el('p', { class: 'vr-ctx', lang: w.lang, html: ctxHtml(w.context, w.word) }) : null,
        el('div', { class: 'vr-src muted' }, [w.bookTitle, fmtDate(w.addedAt)].filter(Boolean).join(' · '))),
      el('div', { class: 'vr-actions' },
        el('button', { class: 'icon-btn', 'aria-label': 'Anhören', html: SPEAK, onclick: () => speak(w.word, w.lang).catch(() => {}) }),
        el('button', { class: 'icon-btn', 'aria-label': 'Löschen', html: TRASH, onclick: async () => {
          if (await confirmDialog(`„${w.word}“ aus dem Vokabelheft löschen?`, { ok: 'Löschen', danger: true })) { await removeWord(w.id); refresh(); }
        } })))));
  }

  root.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
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
  slot('q').addEventListener('input', draw);
  slot('sort').addEventListener('change', draw);
  await refresh();
  return () => {};
}

// ---------------- Training ----------------

export async function openTrain(mount) {
  let queue = await dueWords();
  let extra = false;
  if (!queue.length) {
    const all = await allWords();
    queue = [...all].sort(() => Math.random() - 0.5).slice(0, 20);
    extra = true;
  }
  const total = queue.length;
  let done = 0;
  let reverse = false;
  const stats = { 0: 0, 1: 0, 2: 0 };

  const root = el('div', { class: 'page train' });
  mount.replaceChildren(root);

  function show() {
    if (!queue.length) {
      root.innerHTML = `
        <div class="train-done">
          <div class="empty-art">${total ? '🎉' : '⭐'}</div>
          <h2>${total ? 'Super gemacht!' : 'Noch keine Vokabeln'}</h2>
          <p class="muted">${total
            ? `${done} Karten wiederholt · ${stats[2]} gewusst · ${stats[1]} schwer · ${stats[0]} nochmal`
            : 'Speichere beim Lesen Wörter mit dem Stern ⭐, dann kannst du sie hier trainieren.'}</p>
          <div class="empty-actions"><a class="btn primary" href="#/vocab">Zum Vokabelheft</a><a class="btn" href="#/library">Weiterlesen</a></div>
        </div>`;
      return;
    }
    const w = queue[0];
    const front = reverse ? (w.translation || '—') : w.word;
    root.innerHTML = `
      <header class="train-head">
        <a class="btn" href="#/vocab">← Zurück</a>
        <div class="train-progress"><span style="width:${(done / total) * 100}%"></span></div>
        <span class="muted">${done + 1} / ${total}${extra ? ' · Übung' : ''}</span>
        <button class="btn" data-act="flip-dir" title="Richtung wechseln">${reverse ? 'Übersetzung → Wort' : 'Wort → Übersetzung'}</button>
      </header>
      <div class="flashcard" data-slot="card">
        <div class="fc-lang">${escapeHtml(langName(reverse ? (w.target || 'ru') : w.lang))}</div>
        <div class="fc-front" lang="${reverse ? (w.target || 'ru') : w.lang}">${escapeHtml(front)}</div>
        ${!reverse && w.ipa ? `<div class="ipa">${escapeHtml(w.ipa)}</div>` : ''}
        ${!reverse ? `<button class="chip-btn" data-act="speak">${SPEAK}<span>Anhören</span></button>` : ''}
        ${w.context && !reverse ? `<p class="fc-ctx" lang="${w.lang}">${ctxHtml(w.context, w.word)}</p>` : ''}
        <div class="fc-back" hidden>
          <div class="fc-answer" lang="${reverse ? w.lang : (w.target || 'ru')}">${escapeHtml(reverse ? w.word : (w.translation || '—'))}</div>
          ${reverse && w.ipa ? `<div class="ipa">${escapeHtml(w.ipa)}</div>` : ''}
          ${!reverse && w.alts?.length ? `<div class="muted">${escapeHtml(w.alts.filter((a) => a !== w.translation).slice(0, 5).join(', '))}</div>` : ''}
          ${reverse && w.context ? `<p class="fc-ctx" lang="${w.lang}">${ctxHtml(w.context, w.word)}</p>` : ''}
        </div>
      </div>
      <div class="train-actions" data-slot="actions">
        <button class="btn primary big" data-act="reveal">Antwort zeigen <kbd>Leertaste</kbd></button>
      </div>`;
    if (!reverse) speak(w.word, w.lang).catch(() => {});
  }

  function reveal() {
    const back = root.querySelector('.fc-back');
    if (!back || !back.hidden) return;
    back.hidden = false;
    const w = queue[0];
    if (reverse) speak(w.word, w.lang).catch(() => {});
    root.querySelector('[data-slot="actions"]').innerHTML = `
      <button class="btn grade g0" data-act="g0">Nochmal <kbd>1</kbd></button>
      <button class="btn grade g1" data-act="g1">Schwer <kbd>2</kbd></button>
      <button class="btn grade g2" data-act="g2">Gewusst <kbd>3</kbd></button>`;
  }

  async function grade(g) {
    const w = queue.shift();
    stats[g]++;
    done++;
    if (!extra) await review(w.id, g);
    else if (g === 2) await review(w.id, g);
    if (g === 0) queue.splice(Math.min(queue.length, 3), 0, w); // gleich nochmal
    if (g === 0) done--;
    show();
  }

  root.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'reveal') reveal();
    if (act === 'speak') speak(queue[0].word, queue[0].lang).catch(() => {});
    if (act === 'flip-dir') { reverse = !reverse; show(); }
    if (/^g[012]$/.test(act)) grade(Number(act[1]));
  });
  const onKey = (e) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); reveal(); }
    if (['1', '2', '3'].includes(e.key) && !root.querySelector('.fc-back')?.hidden) grade(Number(e.key) - 1);
  };
  document.addEventListener('keydown', onKey);
  show();
  return () => document.removeEventListener('keydown', onKey);
}
