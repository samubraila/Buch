// Globale Einstellungen
import { settings, setSetting } from './settings.js';
import { onVoices, voicesFor, bestVoice, speak, speechLang, hasSynth } from './speech.js';
import { deviceSupported, deviceAvailability, prepareDevice } from './translate.js';
import * as db from './db.js';
import { el, LANGS, langName, toast } from './util.js';
import { segmented, toggle, field, confirmDialog } from './ui.js';
import { BUILD } from './version.js';

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
        for (const s of ['books', 'contents', 'vocab', 'cache', 'kv']) await db.clear(s);
        location.hash = '#/library';
        location.reload();
      } }, 'Alles löschen')));

  async function estimate() {
    try {
      const e = await navigator.storage.estimate();
      usage.textContent = `${(e.usage / 1048576).toFixed(1)} MB`;
    } catch { usage.textContent = 'unbekannt'; }
  }

  const about = el('section', { class: 'card-sec' }, el('h2', {}, 'Als App installieren'),
    el('ul', { class: 'howto' },
      el('li', {}, el('strong', {}, 'Laptop (Chrome/Edge): '), 'In der Adressleiste auf das Installieren-Symbol ⊕ klicken.'),
      el('li', {}, el('strong', {}, 'Android (Chrome): '), 'Menü ⋮ → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.'),
      el('li', {}, el('strong', {}, 'iPhone/iPad (Safari): '), 'Teilen-Knopf → „Zum Home-Bildschirm“.')),
    el('p', { class: 'version' }, 'Version: ', el('strong', {}, BUILD)),
    el('p', { class: 'muted small' }, 'LeseWelt 1.0 · Übersetzung: Google Translate / MyMemory · Wörterbuch: dictionaryapi.dev, Wiktionary'));

  root.append(el('header', { class: 'page-head' }, el('div', {}, el('h1', {}, 'Einstellungen'))), look, tr, sp, data, about);
  refreshDevice();
  const off = onVoices(drawVoices);
  drawVoices();
  estimate();
  return () => off();
}
