// Wörterbuch-/Übersetzungs-Popup (Desktop: Karte am Wort, Handy: Karte unten/oben)
import { settings } from './settings.js';
import { translateWord, translateText } from './translate.js';
import { englishEntry, wiktionary } from './dict.js';
import { speak, playRecording, stop as stopSpeech } from './speech.js';
import { saveWord, getWord, removeWord, vocabId } from './vocabStore.js';
import { escapeHtml, isMobile, langName, LANGS, toast } from './util.js';
import { canPractice, listen, feedback } from './practice.js';
import { addStat } from './statsStore.js';

let box;
let token = 0;
let closedAt = 0;
let onCloseCb = null;

function ensureBox() {
  if (box) return box;
  box = document.createElement('div');
  box.id = 'lookup';
  box.className = 'lookup';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', 'Wörterbuch');
  box.hidden = true;
  document.body.append(box);
  document.addEventListener('pointerdown', (e) => {
    if (!box.hidden && !box.contains(e.target) && !e.target.closest('.sel-bar')) close();
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !box.hidden) { e.stopPropagation(); close(); }
  }, true);
  return box;
}

export function isOpen() {
  return box && !box.hidden;
}

/** true, wenn das Popup gerade eben durch einen Tipp daneben geschlossen wurde */
export function justClosed() {
  return Date.now() - closedAt < 450;
}

export function close() {
  if (!box || box.hidden) return;
  box.hidden = true;
  box.classList.remove('show');
  closedAt = Date.now();
  token++;
  onCloseCb?.();
  onCloseCb = null;
}

function targetFor(src) {
  return src === settings.target ? (settings.target2 === src ? 'en' : settings.target2) : settings.target;
}

function place(rect) {
  const b = ensureBox();
  b.hidden = false;
  b.classList.remove('sheet', 'sheet-top', 'card');
  b.style.left = b.style.top = b.style.right = b.style.bottom = '';
  if (isMobile()) {
    const top = rect && rect.top + rect.height / 2 > innerHeight * 0.52;
    b.classList.add('sheet', top ? 'sheet-top' : 'sheet-bottom');
  } else {
    b.classList.add('card');
    const w = Math.min(400, innerWidth - 24);
    b.style.width = w + 'px';
    let left = rect ? rect.left + rect.width / 2 - w / 2 : (innerWidth - w) / 2;
    left = Math.max(12, Math.min(innerWidth - w - 12, left));
    b.style.left = left + 'px';
    const below = rect ? rect.bottom + 10 : innerHeight / 3;
    // erst unten versuchen, sonst oben
    b.style.top = below + 'px';
    b.style.maxHeight = Math.max(220, innerHeight - below - 16) + 'px';
    requestAnimationFrame(() => {
      const h = b.offsetHeight;
      if (rect && below + h > innerHeight - 12 && rect.top - 10 - h > 12) {
        b.style.top = rect.top - 10 - h + 'px';
      } else if (rect && below + h > innerHeight - 12) {
        const spaceAbove = rect.top - 22;
        const spaceBelow = innerHeight - below - 12;
        if (spaceAbove > spaceBelow) {
          b.style.maxHeight = spaceAbove + 'px';
          b.style.top = Math.max(12, rect.top - 10 - Math.min(h, spaceAbove)) + 'px';
        }
      }
    });
  }
  requestAnimationFrame(() => b.classList.add('show'));
}

const ICON = {
  speak: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a4.5 4.5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
  slow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16c0-4 3.5-7 7.5-7S19 12 19 15v1H4z" fill="currentColor"/><circle cx="20" cy="12" r="2" fill="currentColor"/><path d="M6 16v2M16 16v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9l-5.3 2.7 1-5.8-4.2-4.1 5.9-.9z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  practice: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
  para: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 10h16M4 14h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M15 17l3 3 3-3M18 13v7" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>',
};

function langSelect(current) {
  const opts = [...new Set([current, ...LANGS])].filter(Boolean)
    .map((l) => `<option value="${l}" ${l === current ? 'selected' : ''}>${l.toUpperCase()} · ${escapeHtml(langName(l))}</option>`).join('');
  return `<label class="lk-lang" title="Sprache des Buches (für Aussprache und Übersetzung)"><span class="sr-only">Sprache</span><select data-act="lang">${opts}</select></label>`;
}

const skeleton = '<div class="skel"></div><div class="skel short"></div>';

// ---------------- Wort ----------------

/**
 * @param {object} o { word, lang, rect, sentence, bookId, bookTitle, onLangChange, onSaved, onClose }
 */
export async function openWord(o) {
  const my = ++token;
  const b = ensureBox();
  onCloseCb = o.onClose || null;
  const src = o.lang || 'en';
  const tgt = targetFor(src);
  const saved = await getWord(o.word, src);
  const isEn = src === 'en';
  addStat('lookups');

  b.innerHTML = `
    <div class="lk-grip" aria-hidden="true"></div>
    <header class="lk-head">
      <div class="lk-word-wrap">
        <h2 class="lk-word" lang="${src}">${escapeHtml(o.word)}</h2>
        <div class="lk-ipa" data-slot="ipa"></div>
      </div>
      <div class="lk-head-actions">
        <button class="vocab-btn ${saved ? 'on' : ''}" data-act="save" aria-pressed="${!!saved}" title="Wort ins Vokabelheft speichern">${ICON.star}<span>${saved ? 'In Vokabeln' : 'Zu Vokabeln'}</span></button>
        <button class="icon-btn" data-act="close" title="Schließen (Esc)">${ICON.close}</button>
      </div>
    </header>
    <div class="lk-speak">
      <button class="chip-btn primary" data-act="speak">${ICON.speak}<span>Anhören</span></button>
      <button class="chip-btn" data-act="slow">${ICON.slow}<span>Langsam</span></button>
      <span data-slot="rec"></span>
      ${canPractice ? `<button class="chip-btn" data-act="practice" title="Sprich das Wort nach – die App prüft deine Aussprache">${ICON.practice}<span>Nachsprechen</span></button>` : ''}
      ${langSelect(src)}
    </div>
    <div class="lk-practice" data-slot="practice" hidden></div>
    <section class="lk-sec">
      <div class="lk-label">${escapeHtml(langName(tgt))}</div>
      <div data-slot="tr">${skeleton}</div>
    </section>
    ${o.sentence ? `
    <section class="lk-sec lk-sentence">
      <div class="lk-label">Im Satz</div>
      <p class="lk-ctx" lang="${src}">${highlightWord(o.sentence, o.word)}</p>
      <div class="lk-row">
        <button class="chip-btn" data-act="speak-sentence">${ICON.speak}<span>Satz anhören</span></button>
        <button class="chip-btn" data-act="tr-sentence"><span>Satz übersetzen</span></button>
        ${o.onTranslateParagraph ? `<button class="chip-btn" data-act="tr-para" title="Übersetzung unter dem Absatz im Buch anzeigen">${ICON.para}<span>Absatz übersetzen</span></button>` : ''}
      </div>
      <div data-slot="sent"></div>
    </section>` : ''}
    ${settings.showDefs ? `<section class="lk-sec lk-defs-sec" data-slot="defs-sec" hidden>
      <details class="lk-defs"><summary class="lk-label">Bedeutung (Wörterbuch)</summary><div data-slot="defs"></div></details>
    </section>` : ''}
    <footer class="lk-foot" data-slot="foot"></footer>
  `;
  place(o.rect);

  const slot = (n) => b.querySelector(`[data-slot="${n}"]`);
  let trResult = null;
  let enData = null;

  if (settings.autoSpeak) speak(o.word, src).catch(() => {});

  b.onclick = async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'close') close();
    if (act === 'speak') speak(o.word, src).catch(speechErr);
    if (act === 'slow') speak(o.word, src, { slow: true }).catch(speechErr);
    if (act === 'rec-us' || act === 'rec-uk') {
      const url = act === 'rec-us' ? enData?.audio.us || enData?.audio.any : enData?.audio.uk;
      if (url) playRecording(url).catch(() => toast('Aufnahme konnte nicht abgespielt werden', { type: 'error' }));
    }
    if (act === 'speak-sentence') speak(o.sentence, src).catch(speechErr);
    if (act === 'tr-sentence') loadSentence();
    if (act === 'tr-para') { close(); o.onTranslateParagraph?.(); }
    if (act === 'practice') practice();
    if (act === 'save') {
      const btn = e.target.closest('[data-act]');
      const on = btn.classList.toggle('on');
      btn.setAttribute('aria-pressed', on);
      const lbl = btn.querySelector('span');
      if (lbl) lbl.textContent = on ? 'In Vokabeln' : 'Zu Vokabeln';
      if (on) {
        await saveWord({
          word: o.word, lang: src, target: tgt,
          translation: trResult?.text || '',
          alts: (trResult?.alts || []).flatMap((a) => a.terms.map((t) => t.word)).slice(0, 6),
          ipa: enData?.ipa || '',
          context: o.sentence || '', bookId: o.bookId, bookTitle: o.bookTitle,
        });
        savedToast();
        addStat('saved');
      } else {
        await removeWord(vocabId(o.word, src));
        toast('Aus dem Vokabelheft entfernt');
      }
      o.onSaved?.();
    }
    if (act === 'retry') loadTr();
    if (act === 'alt') {
      const w = e.target.closest('[data-word]')?.dataset.word;
      if (w) speak(w, tgt).catch(() => {});
    }
  };
  b.onchange = (e) => {
    if (e.target.dataset.act === 'lang') {
      o.onLangChange?.(e.target.value);
      openWord({ ...o, lang: e.target.value });
    }
  };

  async function loadTr() {
    slot('tr').innerHTML = skeleton;
    try {
      trResult = await translateWord(o.word, src, tgt);
      if (my !== token) return;
      slot('tr').innerHTML = renderTranslation(trResult, tgt);
      slot('foot').textContent = 'Übersetzung: ' + trResult.provider + (trResult.cached ? ' (gespeichert)' : '');
      // Übersetzung eines schon gespeicherten Wortes aktualisieren
      if (saved && !saved.translation) saveWord({ ...saved, translation: trResult.text });
    } catch (err) {
      if (my !== token) return;
      slot('tr').innerHTML = `<p class="lk-err">${escapeHtml(err.message)}</p><button class="chip-btn" data-act="retry">Erneut versuchen</button>`;
    }
  }

  async function practice() {
    const box = slot('practice');
    const btn = b.querySelector('[data-act="practice"]');
    box.hidden = false;
    box.className = 'lk-practice listening';
    box.innerHTML = '<span class="pulse"></span> Sprich jetzt: <strong></strong>';
    box.querySelector('strong').textContent = o.word;
    btn.disabled = true;
    stopSpeech();
    try {
      const r = await listen(o.word, src);
      if (my !== token) return;
      const f = feedback(r.score);
      box.className = `lk-practice ${f.cls}`;
      box.innerHTML = `<span>Gehört: „<strong></strong>“</span><span class="score">${r.score} %</span><span class="fb">${f.text}</span>`;
      box.querySelector('strong').textContent = r.heard;
    } catch (err) {
      if (my !== token) return;
      box.className = 'lk-practice bad';
      box.textContent = err.message;
    }
    btn.disabled = false;
  }

  async function loadSentence() {
    const s = slot('sent');
    if (!s) return;
    s.innerHTML = skeleton;
    b.querySelector('[data-act="tr-sentence"]')?.remove();
    try {
      const r = await translateText(o.sentence, src, tgt);
      if (my !== token) return;
      s.innerHTML = `<p class="lk-sent-tr" lang="${tgt}">${escapeHtml(r.text)}</p>`;
    } catch (err) {
      if (my === token) s.innerHTML = `<p class="lk-err">${escapeHtml(err.message)}</p>`;
    }
  }

  async function loadDict() {
    if (!settings.showDefs && !isEn) return;
    const [en, wk] = await Promise.all([
      isEn ? englishEntry(o.word.replace(/['’]s$/i, '')) : null,
      settings.showDefs ? wiktionary(isEn ? o.word.replace(/['’]s$/i, '') : o.word, src) : null,
    ]);
    if (my !== token) return;
    enData = en;
    if (en?.ipa) slot('ipa').textContent = en.ipa;
    if (en && (en.audio.us || en.audio.uk || en.audio.any)) {
      slot('rec').innerHTML =
        (en.audio.us || en.audio.any ? `<button class="chip-btn" data-act="rec-us" title="Echte Aufnahme (amerikanisch)">${ICON.mic}<span>US</span></button>` : '') +
        (en.audio.uk ? `<button class="chip-btn" data-act="rec-uk" title="Echte Aufnahme (britisch)">${ICON.mic}<span>UK</span></button>` : '');
    }
    const meanings = (wk && wk.length ? wk : en?.meanings) || [];
    if (meanings.length && slot('defs')) {
      slot('defs').innerHTML = meanings.slice(0, 3).map((m) => `
        <div class="lk-def">
          ${m.pos ? `<div class="lk-pos">${escapeHtml(m.pos)}</div>` : ''}
          <ol>${m.defs.map((d) => `<li>${escapeHtml(d.def)}${d.ex ? `<div class="lk-ex">„${escapeHtml(d.ex)}“</div>` : ''}</li>`).join('')}</ol>
        </div>`).join('');
      slot('defs-sec').hidden = false;
    }
  }

  loadTr();
  loadDict();
  if (settings.autoSentence && o.sentence) loadSentence();
}

export function savedToast() {
  toast('In Vokabeln gespeichert ⭐', { action: { label: 'Vokabeln öffnen', fn: () => { location.hash = '#/vocab'; } } });
}

function speechErr(e) {
  toast('Aussprache nicht möglich: ' + (e?.message || 'unbekannter Fehler'), { type: 'error' });
}

function renderTranslation(r, tgt) {
  const alts = (r.alts || []).map((a) => `
    <div class="lk-alt">
      ${a.pos ? `<span class="lk-pos">${escapeHtml(a.pos)}</span>` : ''}
      <span class="lk-terms">${a.terms.map((t) =>
        `<button class="term" data-act="alt" data-word="${escapeHtml(t.word)}" lang="${tgt}" title="${escapeHtml(t.back.join(', '))}">${escapeHtml(t.word)}</button>`).join('')}</span>
    </div>`).join('');
  return `<p class="lk-main" lang="${tgt}">${escapeHtml(r.text)}</p>${alts ? `<div class="lk-alts">${alts}</div>` : ''}`;
}

function highlightWord(sentence, word) {
  const s = escapeHtml(sentence);
  const w = escapeHtml(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    return s.replace(new RegExp(`(^|[^\\p{L}\\p{N}])(${w})(?![\\p{L}\\p{N}])`, 'u'), '$1<mark>$2</mark>');
  } catch {
    return s;
  }
}

// ---------------- Textstelle ----------------

export async function openPhrase(o) {
  const my = ++token;
  const b = ensureBox();
  onCloseCb = o.onClose || null;
  const src = o.lang || 'en';
  const tgt = targetFor(src);
  const text = o.text.replace(/\s+/g, ' ').trim();
  const short = text.split(' ').length <= 8;
  b.innerHTML = `
    <div class="lk-grip" aria-hidden="true"></div>
    <header class="lk-head">
      <blockquote class="lk-phrase" lang="${src}">${escapeHtml(text)}</blockquote>
      <div class="lk-head-actions">
        <button class="icon-btn" data-act="close" title="Schließen (Esc)">${ICON.close}</button>
      </div>
    </header>
    <div class="lk-speak">
      <button class="chip-btn primary" data-act="speak">${ICON.speak}<span>Vorlesen</span></button>
      <button class="chip-btn" data-act="slow">${ICON.slow}<span>Langsam</span></button>
      ${short ? `<button class="vocab-btn" data-act="save">${ICON.star}<span>Zu Vokabeln</span></button>` : ''}
      <button class="chip-btn" data-act="copy">${ICON.copy}<span>Kopieren</span></button>
    </div>
    <section class="lk-sec">
      <div class="lk-label">${escapeHtml(langName(tgt))}</div>
      <div data-slot="tr">${skeleton}</div>
    </section>
    <footer class="lk-foot" data-slot="foot"></footer>`;
  place(o.rect);
  const slot = (n) => b.querySelector(`[data-slot="${n}"]`);
  let result = null;

  b.onchange = null;
  b.onclick = async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'close') close();
    if (act === 'speak') speak(text, src).catch(speechErr);
    if (act === 'slow') speak(text, src, { slow: true }).catch(speechErr);
    if (act === 'copy') {
      try {
        await navigator.clipboard.writeText(result ? `${text}\n— ${result.text}` : text);
        toast('Kopiert');
      } catch { toast('Kopieren nicht möglich', { type: 'error' }); }
    }
    if (act === 'save') {
      await saveWord({ word: text, lang: src, target: tgt, translation: result?.text || '', alts: [], context: o.sentence || '', bookId: o.bookId, bookTitle: o.bookTitle });
      const sb = e.target.closest('[data-act]');
      sb.classList.add('on');
      if (sb.querySelector('span')) sb.querySelector('span').textContent = 'In Vokabeln';
      savedToast();
      addStat('saved');
      o.onSaved?.();
    }
    if (act === 'retry') load();
  };

  async function load() {
    slot('tr').innerHTML = skeleton;
    try {
      result = short && text.split(' ').length === 1 ? await translateWord(text, src, tgt) : await translateText(text, src, tgt);
      if (my !== token) return;
      slot('tr').innerHTML = `<p class="lk-main lk-main-long" lang="${tgt}">${escapeHtml(result.text)}</p>`;
      slot('foot').textContent = 'Übersetzung: ' + result.provider;
    } catch (err) {
      if (my !== token) return;
      slot('tr').innerHTML = `<p class="lk-err">${escapeHtml(err.message)}</p><button class="chip-btn" data-act="retry">Erneut versuchen</button>`;
    }
  }
  load();
}

// ---------------- Fußnote ----------------

export function openNote({ html, rect, lang, onJump }) {
  ++token;
  const b = ensureBox();
  onCloseCb = null;
  b.innerHTML = `
    <div class="lk-grip" aria-hidden="true"></div>
    <header class="lk-head"><div class="lk-label">Anmerkung</div>
      <div class="lk-head-actions"><button class="icon-btn" data-act="close">${ICON.close}</button></div></header>
    <div class="lk-note book-text" lang="${lang || ''}">${html}</div>
    <div class="lk-row"><button class="chip-btn" data-act="jump">Zur Stelle springen</button></div>`;
  place(rect);
  b.onchange = null;
  b.onclick = (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'close') close();
    if (act === 'jump') { close(); onJump?.(); }
  };
}

export function stopAll() {
  stopSpeech();
  close();
}
