// Globale Einstellungen
import { settings, setSetting } from './settings.js';
import { onVoices, voicesFor, bestVoice, speak, speechLang, hasSynth } from './speech.js';
import { deviceSupported, deviceAvailability, prepareDevice } from './translate.js';
import * as db from './db.js';
import { el, LANGS, langName, toast, getErrorLog, clearErrorLog } from './util.js';
import { segmented, toggle, field, confirmDialog } from './ui.js';
import { BUILD } from './version.js';
import { APP_VERSION } from './changelog.js';
import { checkForUpdate, showChangelog } from './update.js';
import { createBackup, restoreBackup, shareOrDownload, backupName } from './backup.js';

const TEST = {
  en: 'Hello! This is how English sounds with this voice.',
  de: 'Hallo! So klingt Deutsch mit dieser Stimme.',
  ru: 'Привет! Так звучит русский язык этим голосом.',
  fr: 'Bonjour ! Voici comment sonne le français.',
  es: '¡Hola! Así suena el español con esta voz.',
};

export async function openSettings(mount) {
  const root = el('div', { class: 'page settings' });
  mount.replaceChildren(root);

  const langSelect = (value, onChange) => el('select', { class: 'select', onchange: (e) => onChange(e.target.value) },
    LANGS.map((l) => el('option', { value: l, selected: l === value || null }, `${langName(l)} (${l})`)));

  // ---- Aussehen ----
  const look = el('section', { class: 'card-sec' }, el('h2', {}, 'Aussehen'),
    field('Thema', segmented([
      { value: 'auto', label: 'Automatisch' }, { value: 'light', label: 'Hell' }, { value: 'sepia', label: 'Sepia' },
      { value: 'dark', label: 'Dunkel' }, { value: 'black', label: 'Schwarz' },
    ], settings.theme, (v) => setSetting({ theme: v }))),
    field('Lesemodus', segmented([{ value: 'paged', label: '📖 Seiten blättern' }, { value: 'scroll', label: '📜 Scrollen' }],
      settings.mode, (v) => setSetting({ mode: v }))));

  // ---- Übersetzung ----
  const deviceBox = el('div', { class: 'device-box' });
  const tr = el('section', { class: 'card-sec' }, el('h2', {}, 'Übersetzung'),
    field('Übersetzen nach', langSelect(settings.target, (v) => { setSetting({ target: v }); refreshDevice(); }), 'Standard: Russisch'),
    field('Wenn das Buch schon in dieser Sprache ist, übersetzen nach', langSelect(settings.target2, (v) => setSetting({ target2: v }))),
    toggle('Wort beim Antippen sofort aussprechen', settings.autoSpeak, (v) => setSetting({ autoSpeak: v })),
    toggle('Ganzen Satz automatisch mitübersetzen', settings.autoSentence, (v) => setSetting({ autoSentence: v }), 'Sonst per Knopf „Satz übersetzen“'),
    toggle('Wörterbuch-Bedeutungen anzeigen', settings.showDefs, (v) => setSetting({ showDefs: v }), 'Erklärungen aus Wiktionary (auf Englisch)'),
    deviceBox);

  async function refreshDevice() {
    deviceBox.replaceChildren();
    if (!deviceSupported()) {
      deviceBox.append(el('small', { class: 'hint' }, 'Übersetzt wird online (Google, Ersatz: MyMemory). Ein Offline-Übersetzer steht in Chrome/Edge am Computer zur Verfügung.'));
      return;
    }
    deviceBox.append(el('div', { class: 'field-label' }, 'Offline-Übersetzer (Chrome, auf diesem Gerät)'));
    for (const src of ['en', 'de']) {
      if (src === settings.target) continue;
      const st = await deviceAvailability(src, settings.target);
      const label = `${langName(src)} → ${langName(settings.target)}`;
      const row = el('div', { class: 'device-row' }, el('span', {}, label));
      if (st === 'available') row.append(el('span', { class: 'ok' }, '✓ bereit (auch ohne Internet)'));
      else if (st === 'unavailable') row.append(el('span', { class: 'muted' }, 'nicht verfügbar'));
      else {
        const btn = el('button', { class: 'btn small', onclick: async () => {
          btn.disabled = true;
          try {
            await prepareDevice(src, settings.target, (p) => { btn.textContent = `Lädt … ${Math.round(p * 100)} %`; });
            toast('Offline-Übersetzer bereit ✓', { type: 'success' });
          } catch (e) { toast('Download fehlgeschlagen: ' + e.message, { type: 'error' }); }
          refreshDevice();
        } }, 'Herunterladen');
        row.append(btn);
      }
      deviceBox.append(row);
    }
  }

  // ---- Aussprache ----
  const voiceBox = el('div', { class: 'voice-box' });
  const rateVal = el('span', { class: 'muted' }, settings.rate.toFixed(2) + '×');
  const rate = el('input', { type: 'range', min: '0.5', max: '1.5', step: '0.05', value: String(settings.rate), class: 'range' });
  rate.addEventListener('input', () => { rateVal.textContent = Number(rate.value).toFixed(2) + '×'; });
  rate.addEventListener('change', () => setSetting({ rate: Number(rate.value) }));

  const sp = el('section', { class: 'card-sec' }, el('h2', {}, 'Aussprache'),
    field('Stimme', segmented([
      { value: 'auto', label: 'Automatisch' }, { value: 'device', label: 'Gerätestimme' }, { value: 'online', label: 'Online-Stimme' },
    ], settings.speechMode, (v) => setSetting({ speechMode: v })),
    'Automatisch: nimmt die beste Stimme deines Geräts, sonst die natürliche Online-Stimme.'),
    field('Englische Aussprache', segmented([{ value: 'en-US', label: 'Amerikanisch (US)' }, { value: 'en-GB', label: 'Britisch (UK)' }],
      settings.enAccent, (v) => setSetting({ enAccent: v }))),
    field(el('span', {}, 'Geschwindigkeit ', rateVal), rate),
    voiceBox,
    el('small', { class: 'hint' }, 'Tipp: Bessere Stimmen installieren – Windows: Einstellungen → Zeit & Sprache → Sprache → Sprachpaket mit „Sprachausgabe“. iPhone: Einstellungen → Bedienungshilfen → Gesprochene Inhalte → Stimmen (z. B. „Premium“). Android: Einstellungen → Sprachausgabe → Google.'));

  function drawVoices() {
    voiceBox.replaceChildren();
    if (!hasSynth) {
      voiceBox.append(el('small', { class: 'hint' }, 'Dieser Browser hat keine Gerätestimmen – es wird die Online-Stimme verwendet.'));
      return;
    }
    for (const l of ['en', 'de', settings.target]) {
      if (voiceBox.querySelector(`[data-l="${l}"]`)) continue;
      const full = speechLang(l);
      const list = voicesFor(full);
      const best = bestVoice(full);
      const sel = el('select', { class: 'select', 'data-l': l, onchange: (e) => setSetting({ voices: { ...settings.voices, [l]: e.target.value } }) },
        el('option', { value: '' }, `Automatisch${best ? ' (' + best.name + ')' : ''}`),
        list.map((v) => el('option', { value: v.voiceURI, selected: settings.voices?.[l] === v.voiceURI || null }, `${v.name} · ${v.lang}${v.localService ? '' : ' · online'}`)));
      voiceBox.append(field(`Stimme für ${langName(l)}`, el('div', { class: 'row' }, sel,
        el('button', { class: 'btn', onclick: () => speak(TEST[l] || TEST.en, l).catch((e) => toast(e.message, { type: 'error' })) }, '▶ Test')),
        list.length ? null : 'Keine Gerätestimme gefunden – Online-Stimme wird verwendet.'));
    }
  }

  // ---- Daten ----
  const usage = el('span', { class: 'muted' }, '…');
  const data = el('section', { class: 'card-sec' }, el('h2', {}, 'Daten & Speicher'),
    el('p', {}, 'Alles wird nur auf diesem Gerät gespeichert. Belegter Speicher: ', usage),
    el('div', { class: 'row wrap' },
      el('button', { class: 'btn', onclick: async () => { await db.clear('cache'); toast('Übersetzungs-Cache geleert'); estimate(); } }, 'Übersetzungs-Cache leeren'),
      el('button', { class: 'btn danger', onclick: async () => {
        if (!(await confirmDialog('Wirklich ALLES löschen (Bücher, Vokabeln, Einstellungen)?', { ok: 'Alles löschen', danger: true }))) return;
        for (const s of ['books', 'contents', 'vocab', 'cache', 'kv', 'marks', 'stats']) await db.clear(s);
        location.hash = '#/library';
        location.reload();
      } }, 'Alles löschen')));

  async function estimate() {
    try {
      const e = await navigator.storage.estimate();
      usage.textContent = `${(e.usage / 1048576).toFixed(1)} MB`;
    } catch { usage.textContent = 'unbekannt'; }
  }

  // ---- Übertragen ----
  const restoreInput = el('input', { type: 'file', accept: '.zip,application/zip', hidden: true });
  const transferStatus = el('p', { class: 'muted small' });
  const backupBtn = el('button', { class: 'btn primary', onclick: async () => {
    backupBtn.disabled = true;
    try {
      const blob = await createBackup((p) => { transferStatus.textContent = `Sicherung wird erstellt … ${Math.round(p * 100)} %`; });
      transferStatus.textContent = `Sicherung fertig (${(blob.size / 1048576).toFixed(1)} MB)`;
      const how = await shareOrDownload(blob, backupName());
      if (how === 'downloaded') toast('Sicherung gespeichert (Downloads) ✓', { type: 'success' });
    } catch (e) { toast(e.message, { type: 'error' }); transferStatus.textContent = ''; }
    backupBtn.disabled = false;
  } }, '💾 Alles sichern');
  restoreInput.addEventListener('change', async () => {
    const f = restoreInput.files[0];
    restoreInput.value = '';
    if (!f) return;
    try {
      const r = await restoreBackup(f, (p) => { transferStatus.textContent = `Wird geladen … ${Math.round(p * 100)} %`; });
      transferStatus.textContent = '';
      toast(`Fertig ✓ ${r.added} Bücher neu, ${r.updated} aktualisiert, ${r.words} Vokabeln`, { type: 'success', ms: 6000 });
      estimate();
    } catch (e) { toast(e.message, { type: 'error', ms: 6000 }); transferStatus.textContent = ''; }
  });
  const transfer = el('section', { class: 'card-sec' }, el('h2', {}, 'Laptop ↔ Handy übertragen'),
    el('p', {}, 'Speichert Bücher, Lesefortschritt, Vokabeln, Markierungen und Statistik in ', el('strong', {}, 'einer Datei'),
      '. Auf dem anderen Gerät „Sicherung laden“ – vorhandene Daten bleiben erhalten und werden zusammengeführt.'),
    el('div', { class: 'row wrap' }, backupBtn,
      el('button', { class: 'btn', onclick: () => restoreInput.click() }, '📂 Sicherung laden'), restoreInput),
    transferStatus,
    el('small', { class: 'hint' }, 'Tipp fürs Handy: „Alles sichern“ öffnet das Teilen-Menü – schick dir die Datei z. B. per Telegram, WhatsApp oder E-Mail und öffne sie auf dem anderen Gerät mit „Sicherung laden“.'));

  // ---- Updates ----
  const updates = el('section', { class: 'card-sec' }, el('h2', {}, 'App & Updates'),
    el('p', { class: 'version' }, `LeseWelt ${APP_VERSION} · Version `, el('strong', {}, BUILD)),
    el('p', { class: 'muted small' }, 'Die App sucht automatisch nach Updates (beim Start, beim Zurückkehren und alle 30 Minuten) und aktualisiert sich selbst.'),
    el('div', { class: 'row wrap' },
      el('button', { class: 'btn', onclick: () => checkForUpdate({ manual: true }) }, '🔄 Nach Updates suchen'),
      el('button', { class: 'btn', onclick: showChangelog }, '✨ Was ist neu'),
      el('a', { class: 'btn', href: '#/stats' }, '📈 Statistik')));

  // ---- Hilfe & Diagnose ----
  const diagList = el('div', { class: 'diag' });
  function drawDiag() {
    const log = getErrorLog();
    diagList.replaceChildren(log.length
      ? el('div', {}, ...log.slice(0, 10).map((e) => el('div', { class: 'diag-item' },
        el('strong', {}, e.context), el('div', {}, e.msg), el('small', {}, new Date(e.t).toLocaleString('de-DE')))))
      : el('p', { class: 'muted' }, 'Keine Fehler aufgezeichnet 👍'));
  }
  const diagText = () => [
    `LeseWelt ${APP_VERSION} (${BUILD})`, `Browser: ${navigator.userAgent}`, `Online: ${navigator.onLine}`,
    `Bildschirm: ${innerWidth}×${innerHeight}`, '', 'Letzte Fehler:',
    ...getErrorLog().map((e) => `${e.t} | ${e.context} | ${e.msg}`),
  ].join('\n');
  const diag = el('section', { class: 'card-sec' }, el('h2', {}, 'Hilfe & Diagnose'),
    el('p', { class: 'muted small' }, 'Wenn etwas nicht klappt: „Bericht kopieren“ und an den Entwickler schicken. Es werden keine Bücher oder persönlichen Daten mitgeschickt.'),
    diagList,
    el('div', { class: 'row wrap' },
      el('button', { class: 'btn', onclick: async () => {
        try { await navigator.clipboard.writeText(diagText()); toast('Bericht kopiert ✓'); } catch { toast('Kopieren nicht möglich', { type: 'error' }); }
      } }, '📋 Bericht kopieren'),
      el('button', { class: 'btn', onclick: () => { clearErrorLog(); drawDiag(); } }, 'Liste leeren')));
  drawDiag();
  const about = el('section', { class: 'card-sec' }, el('h2', {}, 'Als App installieren'),
    el('ul', { class: 'howto' },
      el('li', {}, el('strong', {}, 'Laptop (Chrome/Edge): '), 'In der Adressleiste auf das Installieren-Symbol ⊕ klicken.'),
      el('li', {}, el('strong', {}, 'Android (Chrome): '), 'Menü ⋮ → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.'),
      el('li', {}, el('strong', {}, 'iPhone/iPad (Safari): '), 'Teilen-Knopf → „Zum Home-Bildschirm“.')),
    el('p', { class: 'muted small' }, 'Übersetzung: Google Translate / MyMemory · Wörterbuch: dictionaryapi.dev, Wiktionary · Bücher: Standard Ebooks, Project Gutenberg · Hörbücher: LibriVox'));

  root.append(el('header', { class: 'page-head' }, el('div', {}, el('h1', {}, 'Einstellungen'))), updates, look, tr, sp, transfer, data, diag, about);
  refreshDevice();
  const off = onVoices(drawVoices);
  drawVoices();
  estimate();
  return () => off();
}
