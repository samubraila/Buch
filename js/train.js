// Vokabel-Training: Karteikarten, Auswahl, Hören, Schreiben, Sprechen
import { allWords, dueWords, review } from './vocabStore.js';
import { speak } from './speech.js';
import { escapeHtml, langName } from './util.js';
import { SPEAK, ctxHtml } from './vocab.js';
import { checkAchievements } from './achievements.js';

const MODES = [
  { id: 'cards', icon: '🃏', title: 'Karteikarten', desc: 'Wort sehen, Antwort aufdecken, selbst bewerten' },
  { id: 'choice', icon: '✅', title: 'Auswahl', desc: 'Die richtige Übersetzung aus 4 Antworten wählen' },
  { id: 'listen', icon: '👂', title: 'Hören', desc: 'Welches Wort hörst du? – trainiert das Verstehen' },
  { id: 'write', icon: '⌨️', title: 'Schreiben', desc: 'Übersetzung sehen und das Wort schreiben' },
  { id: 'speak', icon: '🎤', title: 'Sprechen', desc: 'Wort laut aussprechen – die App prüft es', needsMic: true },
  { id: 'article', icon: '🏷️', title: 'der · die · das', desc: 'Den richtigen Artikel deutscher Nomen wählen', needsNouns: true },
  { id: 'dictation', icon: '✍️', title: 'Diktat', desc: 'Satz aus dem Buch anhören und aufschreiben', needsContext: true },
];

/** Diktat-Text: kurzer Satz ganz, bei langen Sätzen nur der Satzteil um das Wort (max. ~140 Zeichen) */
function dictationText(w) {
  const ctx = (w.context || '').replace(/^…|…$/g, '').trim();
  if (ctx.length <= 140) return ctx;
  // in Satzteile an Komma/Semikolon/Doppelpunkt/Gedankenstrich teilen (ohne Lookbehind – alte iPhones)
  const parts = [];
  let cur = '';
  for (const tok of ctx.split(/(\s+)/)) {
    cur += tok;
    if (/[,;:–—]$/.test(tok)) { parts.push(cur.trim()); cur = ''; }
  }
  if (cur.trim()) parts.push(cur.trim());
  let k = parts.findIndex((p) => p.toLowerCase().includes(w.word.toLowerCase()));
  if (k < 0) k = 0;
  let text = parts[k];
  let a = k;
  let b = k;
  while (text.length < 50 && (a > 0 || b < parts.length - 1)) {
    if (b < parts.length - 1 && (text + ' ' + parts[b + 1]).length <= 140) { b++; text = parts.slice(a, b + 1).join(' '); } else if (a > 0 && (parts[a - 1] + ' ' + text).length <= 140) { a--; text = parts.slice(a, b + 1).join(' '); } else break;
  }
  return text.length > 160 ? text.slice(0, 160).replace(/\s+\S*$/, '') : text;
}
const hasDictation = (w) => !!w.context && dictationText(w).split(/\s+/).length >= 3;

/** Wörter zweier Sätze vergleichen (längste gemeinsame Folge) → für jedes Zielwort: richtig/falsch */
function compareWords(target, answer) {
  const tok = (s) => s.split(/\s+/).filter(Boolean);
  const t = tok(target);
  const n = (w) => normAns(w);
  const a = tok(answer).map(n);
  const tn = t.map(n);
  const dp = Array.from({ length: t.length + 1 }, () => new Array(a.length + 1).fill(0));
  for (let i = t.length - 1; i >= 0; i--) {
    for (let j = a.length - 1; j >= 0; j--) {
      dp[i][j] = tn[i] && tn[i] === a[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ok = new Array(t.length).fill(false);
  let i = 0;
  let j = 0;
  while (i < t.length && j < a.length) {
    if (tn[i] && tn[i] === a[j]) { ok[i] = true; i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
  }
  const counted = t.map((w, k) => ({ w, ok: ok[k] || !tn[k] }));
  const real = counted.filter((x, k) => tn[k]);
  return { words: counted, score: real.length ? Math.round((real.filter((x) => x.ok).length / real.length) * 100) : 0 };
}

const ART_GENDER = { der: 'm', die: 'f', das: 'n' };
const isNoun = (w) => w.lang === 'de' && w.gram?.pos === 'noun' && w.gram.article && !w.word.includes(' ');
/** Wort für die Anzeige – deutsche Nomen mit farbigem Artikel */
const wordHtml = (w) => (isNoun(w)
  ? `<span class="art art-${w.gram.gender}">${w.gram.article}</span> ${escapeHtml(w.word)}`
  : escapeHtml(w.word));

const shuffle = (a) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};
const normAns = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function openTrain(mount, mode) {
  const root = document.createElement('div');
  root.className = 'page train';
  mount.replaceChildren(root);
  // Optional: nur Wörter aus einem Buch (aus dem Vokabelheft gewählt)
  let trainBook = '';
  try { trainBook = sessionStorage.getItem('lw-train-book') || ''; } catch { /* ignorieren */ }
  const everything = await allWords();
  const all = trainBook ? everything.filter((w) => w.bookTitle === trainBook) : everything;
  const dueAll = await dueWords();
  const due = trainBook ? dueAll.filter((w) => w.bookTitle === trainBook) : dueAll;
  const nouns = all.filter(isNoun);
  const dictations = all.filter(hasDictation);
  let practice = null;
  try { practice = await import('./practice.js'); } catch { practice = null; }
  const canSpeak = !!practice?.canPractice;

  // ---------- Auswahl der Trainingsart ----------
  if (!MODES.some((m) => m.id === mode)) {
    const intro = !all.length
      ? 'Speichere beim Lesen Wörter mit „Zu Vokabeln“, dann kannst du sie hier trainieren.'
      : due.length ? `<strong>${due.length}</strong> Wörter sind heute fällig.` : 'Heute ist nichts fällig – du kannst trotzdem üben (20 zufällige Wörter).';
    root.innerHTML = `
      <header class="train-head"><a class="btn" href="#/vocab">← Vokabelheft</a></header>
      <h1 class="train-h1">Trainieren</h1>
      ${trainBook ? `<div class="book-bar"><span>Nur Wörter aus „${escapeHtml(trainBook)}“ (${all.length})</span><button class="btn small" data-act="all-words">Alle Wörter</button></div>` : ''}
      <p class="muted">${intro}</p>
      <div class="mode-grid">${MODES.map((m) => {
        const off = !all.length || (m.needsMic && !canSpeak) || (m.needsNouns && !nouns.length) || (m.needsContext && !dictations.length);
        const why = m.needsMic && !canSpeak ? 'In diesem Browser nicht verfügbar'
          : m.needsNouns && !nouns.length ? 'Speichere zuerst deutsche Nomen (z. B. aus einem deutschen Buch)'
            : m.needsContext && !dictations.length ? 'Speichere zuerst Wörter beim Lesen (mit Satz)'
            : m.needsNouns ? `${m.desc} · ${nouns.length} Nomen` : m.desc;
        return `<a class="mode-card ${off ? 'disabled' : ''}" href="#/train/${m.id}" ${off ? 'aria-disabled="true" tabindex="-1"' : ''}>
          <span class="mode-icon">${m.icon}</span><strong>${m.title}</strong>
          <span class="muted">${why}</span></a>`;
      }).join('')}</div>`;
    root.querySelectorAll('.mode-card.disabled').forEach((a) => a.addEventListener('click', (e) => e.preventDefault()));
    root.querySelector('[data-act="all-words"]')?.addEventListener('click', () => {
      try { sessionStorage.removeItem('lw-train-book'); } catch { /* ignorieren */ }
      openTrain(mount, mode);
    });
    return () => {};
  }

  let queue;
  if (mode === 'article') {
    const dueNouns = due.filter(isNoun);
    queue = dueNouns.length ? dueNouns : shuffle(nouns).slice(0, 20);
  } else if (mode === 'dictation') {
    const dueD = due.filter(hasDictation);
    queue = dueD.length ? dueD.slice(0, 10) : shuffle(dictations).slice(0, 10);
  } else {
    queue = due.length ? [...due] : shuffle(all).slice(0, 20);
  }
  const extra = mode === 'article' ? !due.some(isNoun) : mode === 'dictation' ? !due.some(hasDictation) : !due.length;
  const total = queue.length;
  let done = 0;
  let reverse = false;
  let answered = false;
  const stats = { 0: 0, 1: 0, 2: 0 };
  const modeInfo = MODES.find((m) => m.id === mode);

  const distractors = (w, key, count = 3) => {
    const seen = new Set([normAns(w[key] || '')]);
    const out = [];
    for (const x of shuffle(all)) {
      if (x.id === w.id || !x[key]) continue;
      const k = normAns(x[key]);
      if (!seen.has(k)) { seen.add(k); out.push(x[key]); }
      if (out.length >= count) break;
    }
    return out;
  };

  const header = () => `<header class="train-head">
      <a class="btn" href="#/train">← Zurück</a>
      <div class="train-progress"><span style="width:${(done / Math.max(1, total)) * 100}%"></span></div>
      <span class="muted">${Math.min(done + 1, total)} / ${total}${extra ? ' · Übung' : ''}</span>
      ${mode === 'cards'
        ? `<button class="btn" data-act="flip-dir" title="Richtung wechseln">${reverse ? 'Übersetzung → Wort' : 'Wort → Übersetzung'}</button>`
        : `<span class="mode-tag">${modeInfo.icon} ${modeInfo.title}</span>`}
    </header>`;

  function contextHtml(w, blank) {
    if (!w.context) return '';
    const inner = blank
      ? escapeHtml(w.context).replace(new RegExp(reEsc(escapeHtml(w.word)), 'gi'), '<span class="blank">_____</span>')
      : ctxHtml(w.context, w.word);
    return `<p class="fc-ctx" lang="${w.lang}">${inner}</p>`;
  }

  function show() {
    answered = false;
    if (!queue.length) {
      checkAchievements();
      root.innerHTML = `
        <div class="train-done">
          <div class="empty-art">🎉</div>
          <h2>Super gemacht!</h2>
          <p class="muted">${done} Karten · ${stats[2]} gewusst · ${stats[1]} schwer · ${stats[0]} nochmal</p>
          <div class="empty-actions"><a class="btn primary" href="#/train">Andere Trainingsart</a><a class="btn" href="#/vocab">Vokabelheft</a><a class="btn" href="#/library">Weiterlesen</a></div>
        </div>`;
      return;
    }
    const w = queue[0];
    const tgt = w.target || 'ru';

    if (mode === 'cards') {
      const front = reverse ? (w.translation || '—') : w.word;
      root.innerHTML = header() + `
        <div class="flashcard">
          <div class="fc-lang">${escapeHtml(langName(reverse ? tgt : w.lang))}</div>
          <div class="fc-front" lang="${reverse ? tgt : w.lang}">${reverse ? escapeHtml(front) : wordHtml(w)}</div>
          ${!reverse && w.ipa ? `<div class="ipa">${escapeHtml(w.ipa)}</div>` : ''}
          ${!reverse ? `<button class="chip-btn" data-act="speak">${SPEAK}<span>Anhören</span></button>` : ''}
          ${!reverse ? contextHtml(w) : ''}
          <div class="fc-back" hidden>
            <div class="fc-answer" lang="${reverse ? w.lang : tgt}">${reverse ? wordHtml(w) : escapeHtml(w.translation || '—')}</div>
            ${!reverse && w.alts?.length ? `<div class="muted">${escapeHtml(w.alts.filter((a) => a !== w.translation).slice(0, 5).join(', '))}</div>` : ''}
            ${reverse ? contextHtml(w) : ''}
          </div>
        </div>
        <div class="train-actions" data-slot="actions"><button class="btn primary big" data-act="reveal">Antwort zeigen <kbd>Leertaste</kbd></button></div>`;
      if (!reverse) speak(w.word, w.lang).catch(() => {});
      return;
    }

    if (mode === 'choice' || mode === 'listen') {
      const key = mode === 'choice' ? 'translation' : 'word';
      const opts = shuffle([w[key] || '—', ...distractors(w, key)]);
      const top = mode === 'choice'
        ? `<div class="fc-lang">${escapeHtml(langName(w.lang))}</div><div class="fc-front" lang="${w.lang}">${wordHtml(w)}</div>
           <button class="chip-btn" data-act="speak">${SPEAK}<span>Anhören</span></button>${contextHtml(w)}`
        : `<div class="fc-lang">Welches Wort hörst du?</div>
           <button class="listen-btn" data-act="speak" aria-label="Nochmal anhören">${SPEAK}</button>
           <button class="chip-btn" data-act="speak-slow">🐢 Langsam</button>`;
      root.innerHTML = header() + `
        <div class="flashcard compact">${top}</div>
        <div class="choices">${opts.map((o, i) => `<button class="choice" data-act="choose" data-value="${escapeHtml(o)}" lang="${mode === 'choice' ? tgt : w.lang}"><kbd>${i + 1}</kbd><span>${escapeHtml(o)}</span></button>`).join('')}</div>
        <div class="train-actions" data-slot="actions"></div>`;
      speak(w.word, w.lang).catch(() => {});
      return;
    }

    if (mode === 'article') {
      const g = w.gram;
      root.innerHTML = header() + `
        <div class="flashcard compact">
          <div class="fc-lang">Welcher Artikel?</div>
          <div class="fc-front" lang="de"><span class="art-blank">___</span> ${escapeHtml(g.singular || w.word)}</div>
          <div class="muted" lang="${tgt}">${escapeHtml(w.translation || '')}</div>
        </div>
        <div class="choices articles">${['der', 'die', 'das'].map((a, i) =>
          `<button class="choice art-choice art-${ART_GENDER[a]}" data-act="article" data-value="${a}"><kbd>${i + 1}</kbd><span>${a}</span></button>`).join('')}</div>
        <div class="train-actions" data-slot="actions"></div>`;
      return;
    }

    if (mode === 'dictation') {
      root.innerHTML = header() + `
        <div class="flashcard compact dictation">
          <div class="fc-lang">Hör zu und schreib den Satz (${escapeHtml(langName(w.lang))})</div>
          <div class="lk-row center">
            <button class="listen-btn" data-act="say" aria-label="Satz anhören">${SPEAK}</button>
          </div>
          <div class="lk-row center"><button class="chip-btn" data-act="say-slow">🐢 Langsam</button></div>
          <div class="muted small">Tipp: Das Wort „${escapeHtml(w.word)}“ (${escapeHtml(w.translation || '')}) kommt vor.</div>
          <form class="dict-form" data-slot="form">
            <textarea class="input" name="answer" rows="3" autocomplete="off" autocapitalize="sentences" spellcheck="false" lang="${w.lang}" placeholder="Was hast du gehört?"></textarea>
            <button class="btn primary" type="submit">Prüfen</button>
          </form>
          <div class="dict-result" data-slot="result"></div>
        </div>
        <div class="train-actions" data-slot="actions"><button class="btn" data-act="dict-skip">Lösung zeigen</button></div>`;
      const form = root.querySelector('[data-slot="form"]');
      form.addEventListener('submit', (e) => { e.preventDefault(); checkDictation(form.elements.answer.value); });
      speak(dictationText(w), w.lang, { rate: 0.85 }).catch(() => {});
      return;
    }

    if (mode === 'write') {
      root.innerHTML = header() + `
        <div class="flashcard compact">
          <div class="fc-lang">Schreibe auf ${escapeHtml(langName(w.lang))}</div>
          <div class="fc-front small" lang="${tgt}">${escapeHtml(w.translation || '—')}</div>
          ${contextHtml(w, true)}
          <form class="write-form" data-slot="form">
            <input class="input" name="answer" autocomplete="off" autocapitalize="off" spellcheck="false" lang="${w.lang}" placeholder="Wort eingeben …" aria-label="Antwort">
            <button class="btn primary" type="submit">Prüfen</button>
          </form>
          <div class="write-result" data-slot="result"></div>
        </div>
        <div class="train-actions" data-slot="actions"><button class="btn" data-act="giveup">Weiß ich nicht</button></div>`;
      const form = root.querySelector('[data-slot="form"]');
      form.addEventListener('submit', (e) => { e.preventDefault(); checkWrite(form.answer.value); });
      setTimeout(() => form.answer.focus(), 50);
      return;
    }

    // Sprechen
    root.innerHTML = header() + `
      <div class="flashcard compact">
        <div class="fc-lang">Sprich laut aus</div>
        <div class="fc-front" lang="${w.lang}">${wordHtml(w)}</div>
        ${w.ipa ? `<div class="ipa">${escapeHtml(w.ipa)}</div>` : ''}
        <div class="muted" lang="${tgt}">${escapeHtml(w.translation || '')}</div>
        <div class="lk-row center">
          <button class="chip-btn" data-act="speak">${SPEAK}<span>Vorsprechen</span></button>
          <button class="btn primary" data-act="mic">🎤 Jetzt sprechen</button>
        </div>
        <div class="lk-practice" data-slot="practice" hidden></div>
      </div>
      <div class="train-actions" data-slot="actions"><button class="btn" data-act="skip">Überspringen</button></div>`;
    speak(w.word, w.lang).catch(() => {});
  }

  function gradeButtons() {
    root.querySelector('[data-slot="actions"]').innerHTML = `
      <button class="btn grade g0" data-act="g0">Nochmal <kbd>1</kbd></button>
      <button class="btn grade g1" data-act="g1">Schwer <kbd>2</kbd></button>
      <button class="btn grade g2" data-act="g2">Gewusst <kbd>3</kbd></button>`;
  }

  function nextButton(g) {
    answered = true;
    const actions = root.querySelector('[data-slot="actions"]');
    actions.innerHTML = `<button class="btn primary big" data-act="continue" data-grade="${g}">Weiter <kbd>Enter</kbd></button>`;
    actions.querySelector('button').focus();
  }

  function reveal() {
    const back = root.querySelector('.fc-back');
    if (!back || !back.hidden) return;
    back.hidden = false;
    if (reverse) speak(queue[0].word, queue[0].lang).catch(() => {});
    gradeButtons();
  }

  function choose(btn) {
    if (answered) return;
    const w = queue[0];
    const key = mode === 'choice' ? 'translation' : 'word';
    const right = normAns(w[key] || '—');
    const correct = normAns(btn.dataset.value) === right;
    root.querySelectorAll('.choice').forEach((b) => {
      b.disabled = true;
      if (normAns(b.dataset.value) === right) b.classList.add('right');
    });
    if (!correct) btn.classList.add('wrong');
    if (mode === 'listen') {
      root.querySelector('.flashcard').insertAdjacentHTML('beforeend',
        `<div class="fc-answer" lang="${w.lang}">${escapeHtml(w.word)}</div><div class="muted">${escapeHtml(w.translation || '')}</div>`);
    }
    nextButton(correct ? 2 : 0);
  }

  function chooseArticle(btn) {
    if (answered) return;
    const w = queue[0];
    const g = w.gram;
    const correct = btn.dataset.value === g.article;
    root.querySelectorAll('.choice').forEach((b) => {
      b.disabled = true;
      if (b.dataset.value === g.article) b.classList.add('right');
    });
    if (!correct) btn.classList.add('wrong');
    root.querySelector('.art-blank').outerHTML = `<span class="art art-${g.gender}">${g.article}</span>`;
    if (g.plural) root.querySelector('.flashcard').insertAdjacentHTML('beforeend', `<div class="muted">Plural: die ${escapeHtml(g.plural)}</div>`);
    speak(`${g.article} ${g.singular || w.word}`, 'de').catch(() => {});
    nextButton(correct ? 2 : 0);
  }

  function checkDictation(value) {
    if (answered) return;
    const w = queue[0];
    const r = compareWords(dictationText(w), value);
    const res = root.querySelector('[data-slot="result"]');
    res.innerHTML = `<div class="dict-score ${r.score >= 90 ? 'good' : r.score >= 60 ? 'ok' : 'bad'}">${r.score} % richtig</div>
      <p class="dict-target" lang="${w.lang}">${r.words.map((x) => `<span class="${x.ok ? 'dw-ok' : 'dw-miss'}">${escapeHtml(x.w)}</span>`).join(' ')}</p>`;
    root.querySelector('[data-slot="form"] textarea').disabled = true;
    nextButton(r.score >= 90 ? 2 : r.score >= 60 ? 1 : 0);
  }

  function checkWrite(value) {
    if (answered) return;
    const w = queue[0];
    const a = normAns(value);
    const t = normAns(w.word);
    const score = practice ? practice.similarity(t, a) : (a === t ? 100 : 0);
    const res = root.querySelector('[data-slot="result"]');
    let g = 0;
    if (a && a === t) { g = 2; res.innerHTML = '<span class="good">✓ Richtig!</span>'; }
    else if (a && score >= 80) { g = 1; res.innerHTML = `<span class="ok">Fast! Richtig ist: <strong lang="${w.lang}">${escapeHtml(w.word)}</strong></span>`; }
    else res.innerHTML = `<span class="bad">Richtig ist: <strong lang="${w.lang}">${escapeHtml(w.word)}</strong></span>`;
    root.querySelector('[data-slot="form"] input').disabled = true;
    speak(w.word, w.lang).catch(() => {});
    nextButton(g);
  }

  async function speakCheck() {
    const w = queue[0];
    const box = root.querySelector('[data-slot="practice"]');
    const btn = root.querySelector('[data-act="mic"]');
    box.hidden = false;
    box.className = 'lk-practice listening';
    box.innerHTML = '<span class="pulse"></span> Ich höre zu …';
    btn.disabled = true;
    try {
      const r = await practice.listen(w.word, w.lang);
      const f = practice.feedback(r.score);
      box.className = `lk-practice ${f.cls}`;
      box.innerHTML = `<span>Gehört: „<strong></strong>“</span><span class="score">${r.score} %</span><span class="fb">${f.text}</span>`;
      box.querySelector('strong').textContent = r.heard;
      if (r.score >= 70) nextButton(r.score >= 90 ? 2 : 1);
    } catch (err) {
      box.className = 'lk-practice bad';
      box.textContent = err.message;
    }
    btn.disabled = false;
  }

  async function grade(g) {
    const w = queue.shift();
    stats[g]++;
    done++;
    if (!extra || g === 2) await review(w.id, g);
    if (g === 0) { queue.splice(Math.min(queue.length, 3), 0, w); done--; }
    show();
  }

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    const act = btn?.dataset.act;
    if (!act) return;
    const w = queue[0];
    if (act === 'reveal') reveal();
    if (act === 'speak' && w) speak(w.word, w.lang).catch(() => {});
    if (act === 'speak-slow' && w) speak(w.word, w.lang, { slow: true }).catch(() => {});
    if (act === 'flip-dir') { reverse = !reverse; show(); }
    if (act === 'choose') choose(btn);
    if (act === 'article') chooseArticle(btn);
    if (act === 'say' && w) speak(dictationText(w), w.lang, { rate: 0.85 }).catch(() => {});
    if (act === 'say-slow' && w) speak(dictationText(w), w.lang, { slow: true }).catch(() => {});
    if (act === 'dict-skip') checkDictation('');
    if (act === 'giveup') checkWrite('');
    if (act === 'mic') speakCheck();
    if (act === 'skip') grade(0);
    if (act === 'continue') grade(Number(btn.dataset.grade));
    if (/^g[012]$/.test(act)) grade(Number(act[1]));
  });

  const onKey = (e) => {
    if (/INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const cont = root.querySelector('[data-act="continue"]');
    if (cont && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); cont.click(); return; }
    if (mode === 'cards') {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); reveal(); }
      if (['1', '2', '3'].includes(e.key) && !root.querySelector('.fc-back')?.hidden) grade(Number(e.key) - 1);
    }
    if ((mode === 'choice' || mode === 'listen' || mode === 'article') && /^[1-4]$/.test(e.key)) {
      root.querySelectorAll('.choice')[Number(e.key) - 1]?.click();
    }
  };
  document.addEventListener('keydown', onKey);
  show();
  return () => document.removeEventListener('keydown', onKey);
}
