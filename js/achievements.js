// 🏆 Erfolge: Abzeichen für Serien, Bücher, Vokabeln, Lese- und Hörzeit
import * as db from './db.js';
import { totals, streak } from './statsStore.js';
import { allWords } from './vocabStore.js';
import { toast } from './util.js';

const H = 3600000;

/** Alle Erfolge: { id, icon, title, desc, value, goal } */
const LIST = [
  { id: 'book-start', icon: '📖', title: 'Erstes Buch', desc: 'Ein Buch angefangen', of: (d) => d.started, goal: 1 },
  { id: 'book-1', icon: '🏁', title: 'Durchgelesen', desc: 'Ein Buch zu Ende gelesen', of: (d) => d.finished, goal: 1 },
  { id: 'book-5', icon: '📚', title: 'Bücherwurm', desc: '5 Bücher zu Ende gelesen', of: (d) => d.finished, goal: 5 },
  { id: 'streak-3', icon: '🔥', title: '3 Tage am Stück', desc: '3 Tage hintereinander gelesen oder gehört', of: (d) => d.streak, goal: 3 },
  { id: 'streak-7', icon: '🔥', title: 'Eine Woche', desc: '7 Tage hintereinander', of: (d) => d.streak, goal: 7 },
  { id: 'streak-30', icon: '🏆', title: 'Ein ganzer Monat', desc: '30 Tage hintereinander', of: (d) => d.streak, goal: 30 },
  { id: 'words-10', icon: '⭐', title: 'Sammler', desc: '10 Wörter im Vokabelheft', of: (d) => d.words, goal: 10 },
  { id: 'words-100', icon: '🌟', title: 'Wortschatz', desc: '100 Wörter im Vokabelheft', of: (d) => d.words, goal: 100 },
  { id: 'words-500', icon: '💫', title: 'Wortmeister', desc: '500 Wörter im Vokabelheft', of: (d) => d.words, goal: 500 },
  { id: 'learned-25', icon: '🧠', title: 'Gut gelernt', desc: '25 Wörter sicher gelernt (Lernstufe 4+)', of: (d) => d.learned, goal: 25 },
  { id: 'lookup-100', icon: '🔎', title: 'Neugierig', desc: '100 Wörter nachgeschlagen', of: (d) => d.lookups, goal: 100 },
  { id: 'lookup-1000', icon: '🔍', title: 'Wortjäger', desc: '1000 Wörter nachgeschlagen', of: (d) => d.lookups, goal: 1000 },
  { id: 'read-1h', icon: '⏱️', title: 'Erste Stunde', desc: '1 Stunde gelesen', of: (d) => d.readH, goal: 1 },
  { id: 'read-10h', icon: '📘', title: 'Leseratte', desc: '10 Stunden gelesen', of: (d) => d.readH, goal: 10 },
  { id: 'listen-1h', icon: '🎧', title: 'Gutes Ohr', desc: '1 Stunde zugehört', of: (d) => d.listenH, goal: 1 },
  { id: 'listen-10h', icon: '🎶', title: 'Hörbuch-Fan', desc: '10 Stunden zugehört', of: (d) => d.listenH, goal: 10 },
];

async function collect() {
  const [t, st, words, books] = await Promise.all([totals(), streak(), allWords(), db.getAll('books')]);
  return {
    started: books.filter((b) => b.lastRead || b.listen).length,
    finished: books.filter((b) => (b.pos?.pct || 0) >= 0.98).length,
    streak: st,
    words: words.length,
    learned: words.filter((w) => (w.box || 0) >= 4).length,
    lookups: t.lookups,
    readH: t.readMs / H,
    listenH: (t.listenMs || 0) / H,
  };
}

/** Erfolge mit Fortschritt; einmal freigeschaltet bleibt freigeschaltet (z. B. Serien) */
export async function achievements() {
  const [d, unlocked] = await Promise.all([collect(), db.kvGet('achievements', {})]);
  return LIST.map((a) => {
    const value = a.of(d);
    const done = !!unlocked[a.id] || value >= a.goal;
    return { id: a.id, icon: a.icon, title: a.title, desc: a.desc, goal: a.goal, value: Math.min(value, a.goal), done, at: unlocked[a.id] || null };
  });
}

/** Neue Erfolge merken und anzeigen */
export async function checkAchievements() {
  try {
    const list = await achievements();
    const unlocked = await db.kvGet('achievements', {});
    const fresh = list.filter((a) => a.done && !unlocked[a.id]);
    if (!fresh.length) return;
    for (const a of fresh) unlocked[a.id] = Date.now();
    await db.kvSet('achievements', unlocked);
    // beim allerersten Mal nicht alle alten auf einmal feiern
    const firstRun = Object.keys(unlocked).length === fresh.length && fresh.length > 2;
    if (firstRun) return;
    const a = fresh[fresh.length - 1];
    toast(`🏆 Neuer Erfolg: ${a.icon} ${a.title}${fresh.length > 1 ? ` (+${fresh.length - 1})` : ''}`, {
      type: 'success', ms: 6000, action: { label: 'Ansehen', fn: () => { location.hash = '#/stats'; } },
    });
  } catch { /* ignorieren */ }
}
