// Alles sichern und auf einem anderen Gerät wiederherstellen (eine ZIP-Datei)
import * as db from './db.js';
import { loadJSZip } from './parsers/epub.js';
import { BUILD } from './version.js';

const FORMAT = 'lesewelt-backup-1';

/** Erstellt die Sicherungsdatei (Blob) mit Büchern, Fortschritt, Vokabeln, Markierungen, Statistik */
export async function createBackup(onProgress = () => {}) {
  const JSZip = await loadJSZip();
  const zip = new JSZip();
  const books = await db.getAll('books');
  const manifest = {
    format: FORMAT,
    app: 'LeseWelt',
    build: BUILD,
    createdAt: new Date().toISOString(),
    books: [],
    vocab: await db.getAll('vocab'),
    marks: await db.getAll('marks'),
    stats: await db.getAll('stats'),
    settings: await db.kvGet('settings', {}),
  };
  for (let i = 0; i < books.length; i++) {
    onProgress(i / Math.max(1, books.length));
    const b = books[i];
    const { cover, ...meta } = b;
    if (cover) zip.file(`covers/${b.id}.jpg`, cover);
    manifest.books.push({ ...meta, hasCover: !!cover });
    const content = await db.get('contents', b.id);
    if (!content) continue;
    const imageKeys = Object.keys(content.images || {});
    for (const k of imageKeys) zip.file(`images/${b.id}/${k}`, content.images[k]);
    zip.file(`contents/${b.id}.json`, JSON.stringify({
      chapters: content.chapters,
      images: imageKeys.map((k) => ({ key: k, type: content.images[k].type })),
    }));
  }
  zip.file('lesewelt.json', JSON.stringify(manifest));
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }, (m) => onProgress(0.5 + m.percent / 200));
  onProgress(1);
  return blob;
}

export function backupName() {
  return `LeseWelt-Sicherung-${new Date().toISOString().slice(0, 10)}.zip`;
}

/** Sicherung einlesen und zusammenführen (nichts wird gelöscht) */
export async function restoreBackup(file, onProgress = () => {}) {
  const JSZip = await loadJSZip();
  let zip;
  try { zip = await JSZip.loadAsync(file); } catch { throw new Error('Das ist keine LeseWelt-Sicherung (ZIP erwartet).'); }
  const mf = zip.file('lesewelt.json');
  if (!mf) throw new Error('Das ist keine LeseWelt-Sicherung.');
  const manifest = JSON.parse(await mf.async('text'));
  if (manifest.format !== FORMAT) throw new Error('Unbekanntes Sicherungsformat.');

  const existing = new Map((await db.getAll('books')).map((b) => [b.id, b]));
  let added = 0;
  let updated = 0;
  for (let i = 0; i < manifest.books.length; i++) {
    onProgress(i / Math.max(1, manifest.books.length));
    const { hasCover, ...meta } = manifest.books[i];
    const old = existing.get(meta.id);
    if (old) {
      // Fortschritt übernehmen, wenn die Sicherung neuer ist
      if ((meta.lastRead || 0) > (old.lastRead || 0)) { await db.put('books', { ...old, pos: meta.pos, lastRead: meta.lastRead }); updated++; }
      continue;
    }
    const cf = zip.file(`contents/${meta.id}.json`);
    if (!cf) continue;
    const c = JSON.parse(await cf.async('text'));
    const images = {};
    for (const im of c.images || []) {
      const f = zip.file(`images/${meta.id}/${im.key}`);
      if (f) images[im.key] = new Blob([await f.async('arraybuffer')], { type: im.type || 'image/*' });
    }
    let cover = null;
    const cov = hasCover && zip.file(`covers/${meta.id}.jpg`);
    if (cov) cover = new Blob([await cov.async('arraybuffer')], { type: 'image/jpeg' });
    await db.put('contents', { id: meta.id, chapters: c.chapters, images });
    await db.put('books', { ...meta, cover });
    added++;
  }

  // Vokabeln: der Eintrag mit mehr Lernfortschritt gewinnt
  const vocab = new Map((await db.getAll('vocab')).map((v) => [v.id, v]));
  let words = 0;
  for (const v of manifest.vocab || []) {
    const old = vocab.get(v.id);
    if (!old || (v.lastReview || v.addedAt || 0) > (old.lastReview || old.addedAt || 0)) { await db.put('vocab', v); words++; }
  }
  const markIds = new Set((await db.getAll('marks')).map((m) => m.id));
  for (const m of manifest.marks || []) if (!markIds.has(m.id)) await db.put('marks', m);
  const statDays = new Map((await db.getAll('stats')).map((s) => [s.day, s]));
  for (const s of manifest.stats || []) {
    const old = statDays.get(s.day);
    if (!old || (s.readMs || 0) > (old.readMs || 0)) await db.put('stats', s);
  }
  onProgress(1);
  return { added, updated, words };
}

/** Datei teilen (Handy) oder herunterladen (Laptop) */
export async function shareOrDownload(blob, name) {
  const file = new File([blob], name, { type: 'application/zip' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'LeseWelt-Sicherung' });
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'aborted';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  return 'downloaded';
}
