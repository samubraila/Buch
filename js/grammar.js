// Grammatik zum Wort: Artikel & Plural (deutsche Nomen), Verbformen, Steigerung, Grundform
// Quelle: Wiktionary (de/en, MediaWiki-API mit CORS) + fest eingebaute englische unregelmäßige Verben
import { cacheGet, cacheSet } from './db.js';
import { fetchWithTimeout } from './util.js';

// ---------- englische unregelmäßige Verben: Grundform → [Vergangenheit, Partizip] ----------
const IRREGULAR = {
  arise: ['arose', 'arisen'], awake: ['awoke', 'awoken'], be: ['was/were', 'been'], bear: ['bore', 'borne'],
  beat: ['beat', 'beaten'], become: ['became', 'become'], begin: ['began', 'begun'], bend: ['bent', 'bent'],
  bet: ['bet', 'bet'], bind: ['bound', 'bound'], bite: ['bit', 'bitten'], bleed: ['bled', 'bled'],
  blow: ['blew', 'blown'], break: ['broke', 'broken'], breed: ['bred', 'bred'], bring: ['brought', 'brought'],
  build: ['built', 'built'], burn: ['burnt/burned', 'burnt/burned'], burst: ['burst', 'burst'], buy: ['bought', 'bought'],
  cast: ['cast', 'cast'], catch: ['caught', 'caught'], choose: ['chose', 'chosen'], cling: ['clung', 'clung'],
  come: ['came', 'come'], cost: ['cost', 'cost'], creep: ['crept', 'crept'], cut: ['cut', 'cut'],
  deal: ['dealt', 'dealt'], dig: ['dug', 'dug'], do: ['did', 'done'], draw: ['drew', 'drawn'],
  dream: ['dreamt/dreamed', 'dreamt/dreamed'], drink: ['drank', 'drunk'], drive: ['drove', 'driven'], dwell: ['dwelt', 'dwelt'],
  eat: ['ate', 'eaten'], fall: ['fell', 'fallen'], feed: ['fed', 'fed'], feel: ['felt', 'felt'],
  fight: ['fought', 'fought'], find: ['found', 'found'], flee: ['fled', 'fled'], fling: ['flung', 'flung'],
  fly: ['flew', 'flown'], forbid: ['forbade', 'forbidden'], forget: ['forgot', 'forgotten'], forgive: ['forgave', 'forgiven'],
  forsake: ['forsook', 'forsaken'], freeze: ['froze', 'frozen'], get: ['got', 'got/gotten'], give: ['gave', 'given'],
  go: ['went', 'gone'], grind: ['ground', 'ground'], grow: ['grew', 'grown'], hang: ['hung', 'hung'],
  have: ['had', 'had'], hear: ['heard', 'heard'], hide: ['hid', 'hidden'], hit: ['hit', 'hit'],
  hold: ['held', 'held'], hurt: ['hurt', 'hurt'], keep: ['kept', 'kept'], kneel: ['knelt', 'knelt'],
  know: ['knew', 'known'], lay: ['laid', 'laid'], lead: ['led', 'led'], lean: ['leant/leaned', 'leant/leaned'],
  leap: ['leapt/leaped', 'leapt/leaped'], learn: ['learnt/learned', 'learnt/learned'], leave: ['left', 'left'], lend: ['lent', 'lent'],
  let: ['let', 'let'], lie: ['lay', 'lain'], light: ['lit', 'lit'], lose: ['lost', 'lost'],
  make: ['made', 'made'], mean: ['meant', 'meant'], meet: ['met', 'met'], overcome: ['overcame', 'overcome'],
  pay: ['paid', 'paid'], put: ['put', 'put'], quit: ['quit', 'quit'], read: ['read', 'read'],
  rid: ['rid', 'rid'], ride: ['rode', 'ridden'], ring: ['rang', 'rung'], rise: ['rose', 'risen'],
  run: ['ran', 'run'], say: ['said', 'said'], see: ['saw', 'seen'], seek: ['sought', 'sought'],
  sell: ['sold', 'sold'], send: ['sent', 'sent'], set: ['set', 'set'], shake: ['shook', 'shaken'],
  shed: ['shed', 'shed'], shine: ['shone', 'shone'], shoot: ['shot', 'shot'], show: ['showed', 'shown'],
  shrink: ['shrank', 'shrunk'], shut: ['shut', 'shut'], sing: ['sang', 'sung'], sink: ['sank', 'sunk'],
  sit: ['sat', 'sat'], slay: ['slew', 'slain'], sleep: ['slept', 'slept'], slide: ['slid', 'slid'],
  sling: ['slung', 'slung'], smell: ['smelt/smelled', 'smelt/smelled'], speak: ['spoke', 'spoken'], speed: ['sped', 'sped'],
  spell: ['spelt/spelled', 'spelt/spelled'], spend: ['spent', 'spent'], spill: ['spilt/spilled', 'spilt/spilled'], spin: ['spun', 'spun'],
  spit: ['spat', 'spat'], split: ['split', 'split'], spoil: ['spoilt/spoiled', 'spoilt/spoiled'], spread: ['spread', 'spread'],
  spring: ['sprang', 'sprung'], stand: ['stood', 'stood'], steal: ['stole', 'stolen'], stick: ['stuck', 'stuck'],
  sting: ['stung', 'stung'], stink: ['stank', 'stunk'], stride: ['strode', 'stridden'], strike: ['struck', 'struck'],
  string: ['strung', 'strung'], strive: ['strove', 'striven'], swear: ['swore', 'sworn'], sweep: ['swept', 'swept'],
  swell: ['swelled', 'swollen'], swim: ['swam', 'swum'], swing: ['swung', 'swung'], take: ['took', 'taken'],
  teach: ['taught', 'taught'], tear: ['tore', 'torn'], tell: ['told', 'told'], think: ['thought', 'thought'],
  throw: ['threw', 'thrown'], thrust: ['thrust', 'thrust'], tread: ['trod', 'trodden'], understand: ['understood', 'understood'],
  undertake: ['undertook', 'undertaken'], wake: ['woke', 'woken'], wear: ['wore', 'worn'], weave: ['wove', 'woven'],
  weep: ['wept', 'wept'], win: ['won', 'won'], wind: ['wound', 'wound'], withdraw: ['withdrew', 'withdrawn'],
  wring: ['wrung', 'wrung'], write: ['wrote', 'written'],
};
// gebeugte Form → Grundform (z. B. "went" → "go"), ohne Netz
const IRREGULAR_FORMS = (() => {
  const m = {};
  for (const [base, [past, pp]] of Object.entries(IRREGULAR)) {
    for (const f of [...past.split('/'), ...pp.split('/')]) if (f !== base && !m[f]) m[f] = base;
  }
  m.am = 'be'; m.is = 'be'; m.are = 'be'; m.were = 'be'; m.has = 'have'; m.does = 'do';
  return m;
})();

// ---------- Wiktionary ----------
async function wikitext(host, page) {
  const key = `wt|${host}|${page}`;
  const cached = await cacheGet(key, 120 * 864e5);
  if (cached !== undefined) return cached;
  const url = `https://${host}/w/api.php?action=parse&page=${encodeURIComponent(page)}&prop=wikitext&format=json&origin=*&formatversion=2&redirects=1`;
  const res = await fetchWithTimeout(url, {}, 7000);
  if (!res.ok) throw new Error('Wiktionary ' + res.status);
  const j = await res.json();
  const text = j.parse?.wikitext || null; // null = Seite gibt es nicht
  cacheSet(key, text);
  return text;
}

/** Erste Vorlage {{name|…}} finden und ihre Parameter lesen */
function template(text, name) {
  const start = text.indexOf('{{' + name);
  if (start < 0) return null;
  let depth = 0;
  let i = start;
  for (; i < text.length - 1; i++) {
    if (text[i] === '{' && text[i + 1] === '{') { depth++; i++; } else if (text[i] === '}' && text[i + 1] === '}') { depth--; i++; if (!depth) break; }
  }
  const inner = text.slice(start + 2, i - 1);
  const parts = [];
  let cur = '';
  let d = 0;
  for (let k = 0; k < inner.length; k++) {
    const two = inner.slice(k, k + 2);
    if (two === '{{' || two === '[[') { d++; cur += two; k++; continue; }
    if (two === '}}' || two === ']]') { d--; cur += two; k++; continue; }
    if (inner[k] === '|' && d === 0) { parts.push(cur); cur = ''; continue; }
    cur += inner[k];
  }
  parts.push(cur);
  const params = {};
  let pos = 1;
  for (const p of parts.slice(1)) {
    const eq = p.indexOf('=');
    if (eq > 0 && !p.slice(0, eq).includes('[[')) params[p.slice(0, eq).trim()] = clean(p.slice(eq + 1));
    else params[pos++] = clean(p);
  }
  return params;
}

function clean(v) {
  return String(v).replace(/<ref[\s\S]*?(<\/ref>|\/>)/g, '').replace(/<[^>]+>/g, '')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1').replace(/'''?/g, '').replace(/\{\{[^}]*\}\}/g, '').trim();
}

function section(text, startRe, nextRe) {
  const m = startRe.exec(text);
  if (!m) return null;
  const rest = text.slice(m.index + m[0].length);
  const n = nextRe.exec(rest);
  return n ? rest.slice(0, n.index) : rest;
}

const ARTICLE = { m: 'der', f: 'die', n: 'das' };

function germanInfo(w) {
  const de = section(w, /==[^=\n]*\(\{\{Sprache\|Deutsch\}\}\)\s*==/, /\n==[^=\n]*\(\{\{Sprache\|/) || '';
  if (!de) return null;
  const info = {};
  const noun = template(de, 'Deutsch Substantiv Übersicht');
  if (noun) {
    const g = (noun.Genus || noun['Genus 1'] || '').trim();
    info.pos = 'noun';
    info.gender = g;
    info.article = ARTICLE[g] || '';
    const pl = noun['Nominativ Plural'] || noun['Nominativ Plural 1'] || '';
    info.plural = pl && pl !== '—' && pl !== '-' ? pl : '';
    info.singular = noun['Nominativ Singular'] || noun['Nominativ Singular 1'] || '';
    return info;
  }
  const verb = template(de, 'Deutsch Verb Übersicht');
  if (verb) {
    info.pos = 'verb';
    info.present3 = verb['Präsens_er, sie, es'] || '';
    info.past = verb['Präteritum_ich'] || '';
    info.participle = verb['Partizip II'] || '';
    info.aux = verb.Hilfsverb || verb['Hilfsverb*'] || '';
    return info;
  }
  const adj = template(de, 'Deutsch Adjektiv Übersicht');
  if (adj) {
    info.pos = 'adj';
    info.comparative = adj.Komparativ || '';
    info.superlative = adj.Superlativ ? `am ${adj.Superlativ.replace(/^am\s+/, '')}` : '';
    return info;
  }
  // Nur wenn das Wort selbst keinen eigenen Eintrag hat, ist es eine gebeugte Form
  // (sonst z. B. "schön" → Befehlsform von "schönen")
  const ref = /\{\{Grundformverweis[^|}]*\|([^|}]+)/.exec(de);
  if (ref) info.lemma = clean(ref[1]);
  return info.lemma ? info : null;
}

/**
 * Deutsche Grammatik zu einem Wort.
 * @returns {Promise<null | {word, lemma?, pos?, gender?, article?, plural?, present3?, past?, participle?, aux?, comparative?, superlative?}>}
 */
export async function germanGrammar(word) {
  const key = 'gram|de|' + word;
  const cached = await cacheGet(key, 60 * 864e5);
  if (cached !== undefined) return cached;
  const lower = word.toLowerCase();
  const cap = lower.charAt(0).toUpperCase() + lower.slice(1);
  const tries = [...new Set([word, lower, cap])];
  let result = null;
  for (const t of tries) {
    const w = await wikitext('de.wiktionary.org', t);
    if (!w) continue;
    let info = germanInfo(w);
    if (!info) continue;
    if (info.lemma && !info.pos && info.lemma !== t) {
      // gebeugte Form → Infos der Grundform holen
      const lw = await wikitext('de.wiktionary.org', info.lemma);
      const li = lw ? germanInfo(lw) : null;
      info = { ...(li || {}), lemma: info.lemma };
    }
    result = { word: t, ...info };
    break;
  }
  cacheSet(key, result);
  return result;
}

/**
 * Englische Grammatik: Grundform und unregelmäßige Verbformen.
 * @returns {Promise<null | {word, lemma?, forms?: [base, past, participle], kind?}>}
 */
export async function englishGrammar(word) {
  const w = word.toLowerCase().replace(/['’]s$/, '');
  const key = 'gram|en|' + w;
  const cached = await cacheGet(key, 60 * 864e5);
  if (cached !== undefined) return cached;
  let lemma = IRREGULAR_FORMS[w] || null;
  let kind = lemma ? 'verb' : '';
  if (!lemma && !IRREGULAR[w]) {
    try {
      const text = await wikitext('en.wiktionary.org', w);
      const en = text && section(text, /==English==/, /\n==[^=]/);
      if (en) {
        const m = /\{\{(?:infl of|[a-z -]*? of)\|(?:en\|)?([^|}]+)(?:\|[^}]*)?\}\}/.exec(en);
        if (m && m[1] !== w) {
          lemma = clean(m[1]);
          kind = /plural/.test(m[0]) ? 'noun' : 'verb';
        }
      }
    } catch { /* ohne Netz: nur eingebaute Liste */ }
  }
  const base = lemma || w;
  const result = {
    word: w,
    lemma: lemma && lemma !== w ? lemma : '',
    kind,
    forms: IRREGULAR[base] ? [base, ...IRREGULAR[base]] : null,
  };
  const out = result.lemma || result.forms ? result : null;
  cacheSet(key, out);
  return out;
}

/** Grammatik für die Sprache des Buches (nur Deutsch und Englisch) */
export async function grammarFor(word, lang) {
  try {
    if (lang === 'de') return await germanGrammar(word);
    if (lang === 'en') return await englishGrammar(word);
  } catch { /* ohne Grammatik weiter */ }
  return null;
}

/** Kurztext für Vokabelheft / Training, z. B. "das Haus · die Häuser" */
export function grammarLine(g) {
  if (!g) return '';
  if (g.pos === 'noun' && g.article) return `${g.article} ${g.singular || g.word}${g.plural ? ` · die ${g.plural}` : ''}`;
  if (g.pos === 'verb' && g.past) return `${g.lemma || g.word} – ${g.past} – ${g.aux === 'sein' ? 'ist' : 'hat'} ${g.participle}`;
  if (g.pos === 'adj' && g.comparative) return `${g.lemma || g.word} – ${g.comparative} – ${g.superlative}`;
  if (g.forms) return g.forms.join(' – ');
  return g.lemma ? `Grundform: ${g.lemma}` : '';
}
