// Lesestatistik pro Tag: Lesezeit, nachgeschlagene/gespeicherte Wörter, Seiten
import * as db from './db.js';

const listeners = new Set();
let queue = Promise.resolve();

export function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const empty = (day) => ({ day, readMs: 0, lookups: 0, saved: 0, pages: 0 });

export function onStats(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Zähler erhöhen (Aufrufe werden nacheinander ausgeführt, damit nichts verloren geht) */
export function addStat(field, amount = 1) {
  queue = queue.then(async () => {
    const day = dayKey();
    const row = (await db.get('stats', day)) || empty(day);
    row[field] = (row[field] || 0) + amount;
    await db.put('stats', row);
    for (const fn of listeners) fn(row);
  }).catch(() => {});
  return queue;
}

export async function getDay(day = dayKey()) {
  return (await db.get('stats', day)) || empty(day);
}

/** Die letzten n Tage (ältester zuerst), fehlende Tage mit 0 */
export async function lastDays(n = 14) {
  const all = new Map((await db.getAll('stats')).map((r) => [r.day, r]));
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = dayKey(d);
    out.push(all.get(k) || empty(k));
  }
  return out;
}

/** Serie: Tage am Stück mit mindestens 1 Minute Lesen (heute zählt, wenn schon gelesen) */
export async function streak() {
  const all = new Map((await db.getAll('stats')).map((r) => [r.day, r]));
  const d = new Date();
  let n = 0;
  if (!((all.get(dayKey(d))?.readMs || 0) >= 60000)) d.setDate(d.getDate() - 1); // heute noch nicht gelesen
  while ((all.get(dayKey(d))?.readMs || 0) >= 60000) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export async function totals() {
  const t = { readMs: 0, lookups: 0, saved: 0, pages: 0, days: 0 };
  for (const r of await db.getAll('stats')) {
    t.readMs += r.readMs || 0;
    t.lookups += r.lookups || 0;
    t.saved += r.saved || 0;
    t.pages += r.pages || 0;
    if ((r.readMs || 0) >= 60000) t.days++;
  }
  return t;
}
