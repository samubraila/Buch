// Vokabelheft: speichern, laden, Wiederholung (Leitner-System)
import * as db from './db.js';

const DAY = 864e5;
export const INTERVALS = [0, 1, 2, 4, 8, 16, 32, 64]; // Tage je Box

const listeners = new Set();
let all = null;

export function onVocab(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function changed() {
  for (const fn of listeners) fn();
}

export function vocabId(word, lang) {
  return `${lang}:${word.toLowerCase()}`;
}

export async function allWords() {
  if (!all) all = await db.getAll('vocab');
  return all;
}

export async function getWord(word, lang) {
  return (await allWords()).find((w) => w.id === vocabId(word, lang)) || null;
}

export async function saveWord(entry) {
  const id = vocabId(entry.word, entry.lang);
  const old = (await allWords()).find((w) => w.id === id);
  const row = {
    box: 0,
    due: Date.now(),
    addedAt: Date.now(),
    reviews: 0,
    ...old,
    ...entry,
    id,
  };
  await db.put('vocab', row);
  all = null;
  changed();
  return row;
}

export async function removeWord(id) {
  await db.del('vocab', id);
  all = null;
  changed();
}

export async function dueWords() {
  const now = Date.now();
  return (await allWords()).filter((w) => (w.due || 0) <= now).sort((a, b) => (a.due || 0) - (b.due || 0));
}

// grade: 0 = nochmal, 1 = schwer, 2 = gewusst
export async function review(id, grade) {
  const w = (await allWords()).find((x) => x.id === id);
  if (!w) return;
  let box = w.box || 0;
  if (grade === 0) box = 0;
  else if (grade === 1) box = Math.max(1, box);
  else box = Math.min(INTERVALS.length - 1, box + 1);
  const days = grade === 0 ? 0 : INTERVALS[box];
  // "nochmal" -> in 1 Minute wieder, sonst Anfang des Fälligkeitstages
  const due = grade === 0 ? Date.now() + 60000 : startOfDay(Date.now() + days * DAY);
  await db.put('vocab', { ...w, box, due, reviews: (w.reviews || 0) + 1, lastReview: Date.now() });
  all = null;
  changed();
}

function startOfDay(t) {
  const d = new Date(t);
  d.setHours(4, 0, 0, 0);
  return d.getTime();
}

export async function savedWordSet(lang) {
  return new Set((await allWords()).filter((w) => w.lang === lang && !w.word.includes(' ')).map((w) => w.word.toLowerCase()));
}

export function toCSV(words) {
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const rows = [['Wort', 'Übersetzung', 'Sprache', 'Lautschrift', 'Kontext', 'Buch', 'Datum']];
  for (const w of words) {
    rows.push([w.word, w.translation, w.lang, w.ipa || '', w.context || '', w.bookTitle || '', new Date(w.addedAt).toISOString().slice(0, 10)]);
  }
  return '﻿' + rows.map((r) => r.map(q).join(';')).join('\r\n');
}

export async function importBackup(json) {
  const list = Array.isArray(json) ? json : json.vocab;
  if (!Array.isArray(list)) throw new Error('Ungültige Sicherungsdatei');
  for (const w of list) if (w.id && w.word) await db.put('vocab', w);
  all = null;
  changed();
  return list.length;
}
