// Einstellungen: laden, speichern, auf Änderungen reagieren
import * as db from './db.js';

export const DEFAULTS = {
  theme: 'auto',          // auto | light | sepia | dark | black
  font: 'literata',       // literata | merriweather | sourceserif | sans | system
  fontSize: 20,
  lineHeight: 1.6,
  margin: 'm',            // s | m | l
  justify: true,
  mode: 'paged',          // paged | scroll
  spread: 'auto',         // auto | one  (zwei Seiten nebeneinander auf breiten Bildschirmen)
  target: 'ru',           // Zielsprache der Übersetzung
  target2: 'de',          // Zielsprache, wenn das Buch schon in der Zielsprache ist
  autoSpeak: true,        // Wort beim Antippen sofort aussprechen
  autoSentence: false,    // Satz automatisch mitübersetzen
  speechMode: 'auto',     // auto | device | online
  enAccent: 'en-US',      // en-US | en-GB
  rate: 0.95,
  voices: {},             // Sprache -> voiceURI
  markSaved: true,        // gespeicherte Wörter im Text markieren
  showDefs: true,         // Wörterbuch-Bedeutungen anzeigen
  dailyGoal: 15,          // Tagesziel in Minuten
  bilingual: false,       // Zweisprachig lesen (Übersetzung unter jedem Absatz)
  listenBilingual: false, // Hörbuch: nach jedem Satz die Übersetzung vorlesen
  listenMode: 'auto',     // Hörbuch-Stimme: auto | device | online
};

export const settings = { ...DEFAULTS };
const listeners = new Set();

export async function loadSettings() {
  const saved = await db.kvGet('settings', {});
  Object.assign(settings, DEFAULTS, saved);
  if (!saved.fontSize && matchMedia('(max-width: 640px)').matches) settings.fontSize = 19;
  applyTheme();
  return settings;
}

export function setSetting(patch) {
  Object.assign(settings, patch);
  db.kvSet('settings', { ...settings });
  applyTheme();
  for (const fn of listeners) fn(patch);
}

export function onSettings(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const THEME_COLORS = { light: '#fbfaf7', sepia: '#f4ecd8', dark: '#1b1c1f', black: '#000000' };

export function resolvedTheme() {
  if (settings.theme !== 'auto') return settings.theme;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme() {
  const t = resolvedTheme();
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('lw-theme', settings.theme); } catch { /* ignorieren */ }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[t]);
}

matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
