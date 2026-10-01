// Hör-Engine: liest ein Buch Satz für Satz vor (Online-Stimme oder Gerätestimme)
// – unabhängig vom Leser, läuft beim Wechsel zwischen Seiten weiter (Mini-Leiste)
// – lädt den nächsten Satz vorab, meldet das gesprochene Wort (Karaoke), merkt die Position
import * as db from './db.js';
import { settings } from './settings.js';
import { speechLang, bestVoice, stop as stopWordSpeech } from './speech.js';
import { translateText } from './translate.js';
import { addStat } from './statsStore.js';
import { el, sentenceSegments, storedToBlob, toast, logError, isTouch, silentWavUrl } from './util.js';

const BLOCK_SEL = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,dt,dd,figure,img,table,figcaption';
const TEXT_SEL = 'p,h1,h2,h3,h4,h5,h6,li,pre,dt,dd,figcaption,td,th,blockquote';

/** Sätze eines Kapitels (mit Block-Nummer, damit "Im Buch weiterlesen" die Stelle findet) */
export function chapterSentences(html, lang) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  // Zeilenumbrüche (<br>) als Leerzeichen, sonst kleben Wörter zusammen ("Chapter I.Down")
  tpl.content.querySelectorAll('br').forEach((br) => br.replaceWith(' '));
  const blocks = [...tpl.content.querySelectorAll(BLOCK_SEL)];
  const leafs = [...tpl.content.querySelectorAll(TEXT_SEL)].filter((b) => !b.querySelector(TEXT_SEL));
  const out = [];
  for (const b of leafs) {
    const text = b.textContent.replace(/\s+/g, ' ').trim();
    if (!text || !/[\p{L}\p{N}]/u.test(text)) continue;
    let blk = blocks.indexOf(b);
    if (blk < 0) blk = blocks.findIndex((x) => x.contains(b));
    for (const s of sentenceSegments(text, lang)) {
      const t = s.segment.trim();
      if (t && /[\p{L}\p{N}]/u.test(t)) out.push({ text: t, blk: Math.max(0, blk) });
    }
  }
  return out;
}

function chunkText(text, max = 190) {
  const out = [];
  let rest = text.trim();
  while (rest.length > max) {
    const slice = rest.slice(0, max);
    let cut = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '), slice.lastIndexOf('; '));
    if (cut < max * 0.4) cut = Math.max(slice.lastIndexOf(', '), slice.lastIndexOf(' – '));
    if (cut < max * 0.4) cut = slice.lastIndexOf(' ');
    if (cut <= 0) cut = max - 1;
    out.push(rest.slice(0, cut + 1));
    rest = rest.slice(cut + 1);
  }
  if (rest.trim()) out.push(rest);
  return out;
}

function onlineUrl(text, lang) {
  const full = lang.includes('-') ? lang : speechLang(lang);
  const tl = full.startsWith('en-GB') ? 'en-GB' : full.split('-')[0];
  return `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(text.trim())}`;
}

const synth = 'speechSynthesis' in self ? self.speechSynthesis : null;

// Ein gemeinsames Audio-Element für alle Wiedergaben: einmal durch Antippen freigeschaltet,
// darf Safari (iPhone) es danach ohne weitere Berührung abspielen.
const AUDIO = new Audio();
AUDIO.preload = 'auto';

let unlocked = false;

/** Muss direkt in einem Tipp-Ereignis aufgerufen werden (iPhone) */
export function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  try {
    AUDIO.src = silentWavUrl();
    const p = AUDIO.play();
    if (p?.catch) p.catch(() => { unlocked = false; });
  } catch { unlocked = false; }
  try {
    if (synth) {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      synth.speak(u);
    }
  } catch { /* ignorieren */ }
}

class Listener {
  constructor(book, content) {
    this.book = book;
    this.content = content;
    this.lang = book.lang || 'en';
    this.ch = book.listen?.ch ?? book.pos?.ch ?? 0;
    this.idx = 0;
    this.sentences = [];
    this.playing = false;
    this.gen = 0;
    this.pending = null;
    this.audio = AUDIO;
    this.pre = new Audio();
    this.pre.preload = 'auto';
    this.audio.preload = 'auto';
    this.rate = settings.rate || 1;
    this.forceDevice = false;
    this.sleepUntil = 0;
    this.sleepChapter = false;
    this.sleepTimer = 0;
    this.trCache = new Map();
    this.listeners = new Set();
    this.wordPos = -1;
    // Hörzeit für die Statistik (auch bei ausgeschaltetem Bildschirm)
    this.statTimer = setInterval(() => { if (this.playing) addStat('listenMs', 15000); }, 15000);
    const cov = storedToBlob(book.cover);
    this.coverUrl = cov ? URL.createObjectURL(cov) : null;
    this.load(this.ch, book.listen?.ch === this.ch ? book.listen.idx || 0 : 0);
    // vom Leser übergeben: an der Stelle starten, die gerade gelesen wird
    if (book.listen?.fromBlk != null && book.listen.ch === this.ch) {
      const i = this.sentences.findIndex((s) => s.blk >= book.listen.fromBlk);
      this.idx = i >= 0 ? i : 0;
    }
    this.ensureText();
  }

  /** Kapitel ohne Text (z. B. Cover-Seite) überspringen */
  ensureText() {
    while (!this.sentences.length && this.ch < this.chapters - 1) this.load(this.ch + 1, 0);
  }

  get target() {
    return this.lang === settings.target ? (settings.target2 === this.lang ? 'en' : settings.target2) : settings.target;
  }
  get chapters() { return this.content.chapters.length; }
  get chapterTitle() { return this.book.chapters[this.ch]?.title || `Kapitel ${this.ch + 1}`; }
  get current() { return this.sentences[this.idx] || null; }
  get mode() {
    if (this.forceDevice && synth) return 'device';
    const m = settings.listenMode;
    if (m === 'device' && synth) return 'device';
    if (m === 'online') return 'online';
    if (!synth) return 'online';
    // Automatisch: auf dem Handy Online-Stimme (läuft auch bei ausgeschaltetem Bildschirm)
    if (navigator.onLine === false) return 'device';
    return isTouch() ? 'online' : (bestVoice(speechLang(this.lang)) ? 'device' : 'online');
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(type = 'update') { for (const fn of this.listeners) fn(type, this); }

  load(ch, idx = 0) {
    this.ch = Math.max(0, Math.min(this.chapters - 1, ch));
    this.sentences = chapterSentences(this.content.chapters[this.ch].html, this.lang);
    this.idx = Math.max(0, Math.min(this.sentences.length - 1, idx));
    this.trCache.clear();
    this.wordPos = -1;
  }

  savePos() {
    clearTimeout(this._save);
    this._save = setTimeout(async () => {
      this.book.listen = { ch: this.ch, idx: this.idx, blk: this.current?.blk || 0, at: Date.now() };
      try { await db.put('books', this.book); } catch { /* ignorieren */ }
    }, 600);
  }

  translation(i = this.idx) {
    const s = this.sentences[i];
    if (!s) return Promise.resolve(null);
    if (!this.trCache.has(i)) {
      this.trCache.set(i, translateText(s.text, this.lang, this.target).then((r) => r.text).catch(() => null));
    }
    return this.trCache.get(i);
  }

  // ---------- Abspielen ----------
  play() {
    if (this.playing) return;
    this.ensureText();
    if (!this.sentences.length) { toast('Dieses Kapitel hat keinen Text zum Vorlesen'); return; }
    stopWordSpeech();
    this.playing = true;
    this.setMediaSession();
    this.emit();
    this.loop(); // erster Ton startet noch innerhalb des Tippens (wichtig für iPhone)
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    this.gen++;
    this.cancelSound();
    this.savePos();
    this.emit();
  }

  toggle() { this.playing ? this.pause() : this.play(); }

  cancelSound() {
    try { this.audio.pause(); } catch { /* ignorieren */ }
    synth?.cancel();
    if (this.pending) { const p = this.pending; this.pending = null; p.resolve(); }
  }

  jumpTo(ch, idx) {
    const was = this.playing;
    this.gen++;
    this.cancelSound();
    this.playing = false;
    if (ch !== this.ch) this.load(ch, idx); else this.idx = Math.max(0, Math.min(this.sentences.length - 1, idx));
    this.wordPos = -1;
    this.savePos();
    this.emit();
    if (was) this.play();
  }
  next() { if (this.idx < this.sentences.length - 1) this.jumpTo(this.ch, this.idx + 1); else this.nextChapter(); }
  prev() { this.jumpTo(this.ch, Math.max(0, this.idx - 1)); }
  nextChapter() { if (this.ch < this.chapters - 1) this.jumpTo(this.ch + 1, 0); }
  prevChapter() { this.jumpTo(this.idx > 2 ? this.ch : Math.max(0, this.ch - 1), 0); }
  setRate(r) { this.rate = r; this.audio.playbackRate = r; if (this.playing && this.mode === 'device') this.jumpTo(this.ch, this.idx); this.emit(); }

  setSleep(v) {
    clearTimeout(this.sleepTimer);
    this.sleepUntil = 0;
    this.sleepChapter = v === 'ch';
    if (typeof v === 'number' && v > 0) {
      this.sleepUntil = Date.now() + v * 60000;
      this.sleepTimer = setTimeout(() => { this.pause(); this.sleepUntil = 0; toast('🌙 Schlaf-Timer: Wiedergabe angehalten'); this.emit(); }, v * 60000);
    }
    this.emit();
  }

  async loop() {
    const my = this.gen;
    while (this.playing && my === this.gen) {
      if (this.idx >= this.sentences.length) {
        if (this.sleepChapter) { this.sleepChapter = false; this.pause(); toast('🌙 Kapitel beendet – gute Nacht'); return; }
        if (this.ch < this.chapters - 1) {
          this.load(this.ch + 1, 0);
          this.setMediaSession();
          if (!this.sentences.length) continue;
        } else {
          this.playing = false;
          this.emit('end');
          toast('Buch zu Ende gehört 🎉');
          return;
        }
      }
      const item = this.current;
      this.wordPos = -1;
      this.emit();
      this.savePos();
      this.preload(this.idx + 1);
      try {
        await this.speak(item.text, this.lang, my, true);
      } catch (e) {
        if (my !== this.gen) return;
        if (this.mode === 'online' && synth && !this.forceDevice) {
          logError('Online-Stimme', e);
          this.forceDevice = true;
          toast('Online-Stimme nicht erreichbar – es liest jetzt die Gerätestimme');
          continue; // gleichen Satz nochmal mit Gerätestimme
        }
        logError('Vorlesen', e);
        this.playing = false;
        this.emit();
        toast('Vorlesen nicht möglich: ' + e.message, { type: 'error', ms: 6000 });
        return;
      }
      if (!this.playing || my !== this.gen) return;
      if (settings.listenBilingual) {
        const tr = await this.translation(this.idx);
        if (tr && this.playing && my === this.gen) {
          this.emit('translation');
          try { await this.speak(tr, this.target, my, false); } catch { /* Übersetzung überspringen */ }
        }
        if (!this.playing || my !== this.gen) return;
      }
      this.idx++;
    }
  }

  preload(i) {
    const s = this.sentences[i];
    if (!s || this.mode !== 'online') return;
    try {
      this.pre.src = onlineUrl(chunkText(s.text)[0], this.lang);
      this.pre.load();
    } catch { /* ignorieren */ }
  }

  speak(text, lang, my, karaoke) {
    return this.mode === 'online' ? this.speakOnline(text, lang, my, karaoke) : this.speakDevice(text, lang, my, karaoke);
  }

  async speakOnline(text, lang, my, karaoke) {
    let offset = 0;
    for (const part of chunkText(text)) {
      if (my !== this.gen) return;
      await new Promise((resolve, reject) => {
        const a = this.audio;
        this.pending = { resolve, reject };
        const done = (fn, arg) => { a.onended = a.onerror = a.ontimeupdate = null; this.pending = null; fn(arg); };
        a.onended = () => done(resolve);
        a.onerror = () => done(reject, new Error('Online-Stimme lädt nicht'));
        if (karaoke) {
          const base = offset;
          a.ontimeupdate = () => {
            // Länge unbekannt (manche Browser bei Online-Stimme)? Dann nach Textlänge schätzen
            const dur = a.duration && isFinite(a.duration) ? a.duration : part.length / 14;
            this.wordPos = base + Math.min(part.length - 1, Math.floor((a.currentTime / dur) * part.length));
            this.emit('word');
          };
        }
        a.src = onlineUrl(part, lang);
        a.playbackRate = Math.max(0.5, Math.min(2, this.rate));
        const p = a.play();
        if (p?.catch) p.catch((e) => done(reject, e));
      });
      offset += part.length;
    }
  }

  speakDevice(text, lang, my, karaoke) {
    return new Promise((resolve, reject) => {
      if (!synth) { reject(new Error('Keine Gerätestimme vorhanden')); return; }
      const full = lang.includes('-') ? lang : speechLang(lang);
      const u = new SpeechSynthesisUtterance(text);
      u.lang = full;
      const v = bestVoice(full);
      if (v) u.voice = v;
      u.rate = this.rate;
      let started = false;
      const watchdog = setTimeout(() => { if (!started && my === this.gen) { synth.cancel(); reject(new Error('Gerätestimme startet nicht – bitte ▶ antippen')); } }, 4000);
      this.pending = { resolve, reject };
      u.onstart = () => { started = true; };
      u.onboundary = (e) => { if (karaoke && e.name !== 'sentence') { this.wordPos = e.charIndex; this.emit('word'); } };
      u.onend = () => { clearTimeout(watchdog); this.pending = null; resolve(); };
      u.onerror = (e) => {
        clearTimeout(watchdog);
        this.pending = null;
        if (e.error === 'interrupted' || e.error === 'canceled') resolve(); else reject(new Error(e.error));
      };
      this.utter = u; // Referenz halten (Chrome)
      synth.speak(u);
    });
  }

  setMediaSession() {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: this.chapterTitle,
        artist: this.book.author || '',
        album: this.book.title,
        artwork: [{ src: this.coverUrl || new URL('icons/icon-512.png', location.href).href, sizes: '512x512' }],
      });
      const ms = navigator.mediaSession;
      const set = (a, f) => { try { ms.setActionHandler(a, f); } catch { /* nicht unterstützt */ } };
      set('play', () => this.play());
      set('pause', () => this.pause());
      set('previoustrack', () => this.prev());
      set('nexttrack', () => this.next());
      set('seekbackward', () => this.jumpTo(this.ch, Math.max(0, this.idx - 3)));
      set('seekforward', () => this.jumpTo(this.ch, this.idx + 3));
      set('seekto', null);
    } catch { /* ignorieren */ }
  }

  destroy() {
    this.pause();
    clearInterval(this.statTimer);
    clearTimeout(this.sleepTimer);
    if (this.coverUrl) URL.revokeObjectURL(this.coverUrl);
    this.listeners.clear();
  }
}

// ---------- Ein Hörbuch zur Zeit + Mini-Leiste ----------
let active = null;
const globalListeners = new Set();
let bar = null;

export function currentListener() { return active; }
export function onListener(fn) { globalListeners.add(fn); return () => globalListeners.delete(fn); }

export async function getListener(bookId) {
  if (active?.book.id === bookId) return active;
  const book = await db.get('books', bookId);
  const content = book && await db.get('contents', bookId);
  if (!book || !content) throw new Error('Buch nicht gefunden');
  active?.destroy();
  // echtes Hörbuch (LibriVox) beenden, damit nicht zwei Dinge gleichzeitig laufen
  try {
    const ab = await import('./audioPlayer.js');
    if (ab.current()) ab.stopPlayer();
  } catch { /* ignorieren */ }
  active = new Listener(book, content);
  active.on(() => updateBar());
  for (const fn of globalListeners) fn(active);
  return active;
}

export function stopListener() {
  active?.destroy();
  active = null;
  if ('mediaSession' in navigator) { try { navigator.mediaSession.metadata = null; } catch { /* ignorieren */ } }
  updateBar();
  for (const fn of globalListeners) fn(null);
}

const ICON_PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>';
const ICON_CLOSE = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

function ensureBar() {
  if (bar) return bar;
  bar = el('div', { class: 'ab-bar ls-bar', hidden: true });
  bar.innerHTML = `
    <button class="ab-open" data-act="open" aria-label="Hör-Player öffnen">
      <img class="ab-cover" alt="">
      <span class="ab-text"><strong data-slot="title"></strong><span data-slot="sub"></span></span>
    </button>
    <button class="icon-btn" data-act="toggle" aria-label="Abspielen/Pause"></button>
    <button class="icon-btn" data-act="close" aria-label="Beenden">${ICON_CLOSE}</button>
    <div class="ab-bar-progress"><span></span></div>`;
  const img = bar.querySelector('.ab-cover');
  img.addEventListener('error', () => { if (!img.src.endsWith('icon-192.png')) img.src = 'icons/icon-192.png'; });
  bar.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'open' && active) location.hash = `#/listen/${active.book.id}`;
    if (act === 'toggle') active?.toggle();
    if (act === 'close') stopListener();
  });
  document.body.append(bar);
  return bar;
}

function updateBar() {
  const b = ensureBar();
  const onPlayer = active && location.hash === `#/listen/${active.book.id}`;
  if (!active || onPlayer) { b.hidden = true; document.body.classList.toggle('has-ls', false); return; }
  b.hidden = false;
  document.body.classList.add('has-ls');
  b.querySelector('.ab-cover').src = active.coverUrl || 'icons/icon-192.png';
  b.querySelector('[data-slot="title"]').textContent = active.book.title;
  b.querySelector('[data-slot="sub"]').textContent = `🎧 ${active.chapterTitle}`;
  b.querySelector('[data-act="toggle"]').innerHTML = active.playing ? ICON_PAUSE : ICON_PLAY;
  const frac = active.sentences.length ? active.idx / active.sentences.length : 0;
  b.querySelector('.ab-bar-progress span').style.width = `${frac * 100}%`;
}
window.addEventListener('hashchange', () => updateBar());
