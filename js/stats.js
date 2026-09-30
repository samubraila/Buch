// Statistik-Seite: Tagesziel, Serie, Lesezeit der letzten 14 Tage
import { lastDays, streak, totals, getDay } from './statsStore.js';
import { settings, setSetting } from './settings.js';
import { allWords } from './vocabStore.js';
import * as db from './db.js';
import { el, escapeHtml } from './util.js';
import { segmented } from './ui.js';

export const minutes = (ms) => Math.round((ms || 0) / 60000);

// Fortschrittsring fürs Tagesziel (wird auch in der Bibliothek benutzt)
export function goalRing(doneMin, goalMin, size = 64) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.min(1, goalMin ? doneMin / goalMin : 0);
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${doneMin} von ${goalMin} Minuten">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--line)" stroke-width="6"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--chart-bar)" stroke-width="6" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - frac)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" class="ring-text">${frac >= 1 ? '✓' : doneMin}</text>
  </svg>`;
}

const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export async function openStats(mount) {
  const root = el('div', { class: 'page stats' });
  mount.replaceChildren(root);

  async function draw() {
    const [days, st, tot, today, words, books] = await Promise.all([lastDays(14), streak(), totals(), getDay(), allWords(), db.getAll('books')]);
    const goal = settings.dailyGoal || 15;
    const todayMin = minutes(today.readMs);
    const maxMin = Math.max(goal * 1.25, ...days.map((d) => minutes(d.readMs) * 1.05), 1);
    const finished = books.filter((b) => (b.pos?.pct || 0) >= 0.98).length;

    root.innerHTML = `
      <header class="page-head"><div><h1>Statistik</h1><p class="muted">Dein Lesen und Lernen im Überblick</p></div>
        <a class="btn" href="#/library">← Bibliothek</a></header>
      <section class="today-card">
        ${goalRing(todayMin, goal, 96)}
        <div class="today-info">
          <span class="eyebrow">Heute</span>
          <strong>${todayMin} von ${goal} Minuten gelesen</strong>
          <span class="muted">${todayMin >= goal ? 'Tagesziel erreicht – super! 🎉' : `Noch ${goal - todayMin} Minuten bis zum Tagesziel`}</span>
          <span class="streak">🔥 ${st} ${st === 1 ? 'Tag' : 'Tage'} am Stück</span>
        </div>
      </section>
      <section class="card-sec">
        <div class="sec-head"><h2>Lesezeit – letzte 14 Tage</h2><span class="muted small">Minuten pro Tag · Linie = Tagesziel</span></div>
        <div class="bar-chart" role="img" aria-label="Lesezeit der letzten 14 Tage">
          <div class="goal-line" style="bottom:${(goal / maxMin) * 100}%"><span>${goal} Min.</span></div>
          ${days.map((d) => {
            const m = minutes(d.readMs);
            const dt = new Date(d.day + 'T12:00:00');
            const label = `${WD[dt.getDay()]} ${dt.getDate()}.${dt.getMonth() + 1}.`;
            return `<div class="bar-col" tabindex="0" data-tip="${escapeHtml(`${label}: ${m} Min. · ${d.lookups || 0} Wörter nachgeschlagen`)}">
              <div class="bar" style="height:${m ? Math.max(2, (m / maxMin) * 100) : 0}%"></div>
              <span class="bar-x">${WD[dt.getDay()]}</span>
            </div>`;
          }).join('')}
          <div class="chart-tip" hidden></div>
        </div>
        <details class="table-view"><summary>Als Tabelle anzeigen</summary>
          <table><thead><tr><th>Tag</th><th>Minuten</th><th>Nachgeschlagen</th><th>Gespeichert</th></tr></thead>
          <tbody>${days.slice().reverse().map((d) => `<tr><td>${d.day}</td><td>${minutes(d.readMs)}</td><td>${d.lookups || 0}</td><td>${d.saved || 0}</td></tr>`).join('')}</tbody></table>
        </details>
      </section>
      <section class="kpis">
        <div class="kpi"><span class="kpi-v">${Math.round(tot.readMs / 3600000 * 10) / 10}</span><span class="kpi-l">Stunden gelesen</span></div>
        <div class="kpi"><span class="kpi-v">${tot.lookups}</span><span class="kpi-l">Wörter nachgeschlagen</span></div>
        <div class="kpi"><span class="kpi-v">${words.length}</span><span class="kpi-l">Wörter im Vokabelheft</span></div>
        <div class="kpi"><span class="kpi-v">${words.filter((w) => (w.box || 0) >= 4).length}</span><span class="kpi-l">Wörter gut gelernt</span></div>
        <div class="kpi"><span class="kpi-v">${tot.days}</span><span class="kpi-l">Lesetage insgesamt</span></div>
        <div class="kpi"><span class="kpi-v">${finished}</span><span class="kpi-l">Bücher beendet</span></div>
      </section>
      <section class="card-sec" data-slot="goal"><h2>Tagesziel</h2></section>`;

    root.querySelector('[data-slot="goal"]').append(segmented(
      [5, 10, 15, 20, 30, 45, 60].map((v) => ({ value: v, label: `${v} Min.` })),
      goal, (v) => { setSetting({ dailyGoal: v }); draw(); }));

    // Tooltip für die Säulen
    const chart = root.querySelector('.bar-chart');
    const tip = chart.querySelector('.chart-tip');
    const show = (col) => {
      tip.textContent = col.dataset.tip;
      tip.hidden = false;
      const cr = chart.getBoundingClientRect();
      const r = col.getBoundingClientRect();
      const left = Math.min(Math.max(r.left - cr.left + r.width / 2, 70), cr.width - 70);
      tip.style.left = left + 'px';
    };
    chart.addEventListener('pointerover', (e) => { const c = e.target.closest('.bar-col'); if (c) show(c); });
    chart.addEventListener('focusin', (e) => { const c = e.target.closest('.bar-col'); if (c) show(c); });
    chart.addEventListener('pointerleave', () => { tip.hidden = true; });
  }

  await draw();
  return () => {};
}
