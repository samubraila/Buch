// Lädt alle Bücher aus "Entdecken" herunter, damit GitHub Pages sie selbst ausliefert.
// Aufruf: node tools/fetch-books.mjs --cache .books-cache --out _site/books
//
// - Bereits geladene Bücher werden aus dem Cache genommen (schont Gutenberg/Standard Ebooks)
// - Fehlende Bücher brechen den Build nicht ab: die App lädt sie dann direkt von der Original-Seite
import fs from 'node:fs';
import path from 'node:path';
import { ALL_BOOKS, buildSources } from '../js/catalogData.js';

const arg = (name, def) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : def;
};
const CACHE = arg('--cache', '.books-cache');
const OUT = arg('--out', 'books');
const UA = 'LeseWelt-Build/2.1 (+https://samubraila.github.io/Buch/; GitHub Actions)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const isZip = (buf) => buf.length > 1000 && buf[0] === 0x50 && buf[1] === 0x4b; // "PK"

async function get(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      if (!isZip(buf)) throw new Error('keine EPUB-Datei (' + (res.headers.get('content-type') || '?') + ')');
      return buf;
    } catch (e) {
      if (attempt === 3) throw e;
      await sleep(3000 * attempt);
    }
  }
  return null;
}

const index = {};
const failed = [];
let downloaded = 0;
for (const b of ALL_BOOKS) {
  const file = `${b.id}.epub`;
  const cached = path.join(CACHE, file);
  try {
    if (!fs.existsSync(cached) || !isZip(fs.readFileSync(cached))) {
      const srcs = buildSources(b);
      if (!srcs.length) continue;
      process.stdout.write(`Lade ${b.id} … `);
      let buf = null;
      let lastErr = null;
      for (const src of srcs) {
        try { buf = await get(src); break; } catch (e) { lastErr = e; }
      }
      if (!buf) throw lastErr || new Error('keine Quelle');
      fs.writeFileSync(cached, buf);
      downloaded++;
      console.log(`${(buf.length / 1024).toFixed(0)} KB`);
      await sleep(b.gutenberg ? 2000 : 800); // höflich bleiben
    }
    fs.copyFileSync(cached, path.join(OUT, file));
    index[b.id] = { file, size: fs.statSync(cached).size };
  } catch (e) {
    console.log(`FEHLER ${b.id}: ${e.message}`);
    failed.push(`${b.id} (${e.message})`);
  }
}

fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ created: new Date().toISOString(), books: index }));
const total = Object.values(index).reduce((n, x) => n + x.size, 0);
const summary = `Bücher: ${Object.keys(index).length} von ${ALL_BOOKS.length} bereit (${(total / 1048576).toFixed(1)} MB, ${downloaded} neu geladen)` +
  (failed.length ? `\n\nNicht geladen (App nutzt dann die Original-Seite): ${failed.join(', ')}` : '');
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n${summary}\n`);
