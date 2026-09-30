// Dialoge: Bottom-Sheet (Handy) / Panel (Desktop), Bestätigung
import { el } from './util.js';

const CLOSE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

/**
 * Öffnet einen modalen Dialog.
 * @param {object} o { title, body: Node, side: 'right'|'left'|'center', className, onClose }
 */
export function openSheet({ title, body, side = 'center', className = '', onClose } = {}) {
  const dlg = el('dialog', { class: `sheet-dialog side-${side} ${className}` },
    el('div', { class: 'sheet-grip', 'aria-hidden': 'true' }),
    el('header', { class: 'sheet-head' },
      el('h2', {}, title || ''),
      el('button', { class: 'icon-btn', 'aria-label': 'Schließen', html: CLOSE_SVG, onclick: () => dlg.close() })),
    el('div', { class: 'sheet-body' }, body));
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) dlg.close(); // Klick auf den Hintergrund
  });
  dlg.addEventListener('close', () => {
    onClose?.();
    setTimeout(() => dlg.remove(), 250);
  });
  document.body.append(dlg);
  dlg.showModal();
  return dlg;
}

export function confirmDialog(message, { ok = 'OK', cancel = 'Abbrechen', danger = false } = {}) {
  return new Promise((resolve) => {
    let result = false;
    const body = el('div', { class: 'confirm' },
      el('p', {}, message),
      el('div', { class: 'confirm-actions' },
        el('button', { class: 'btn', onclick: () => dlg.close() }, cancel),
        el('button', { class: `btn ${danger ? 'danger' : 'primary'}`, onclick: () => { result = true; dlg.close(); } }, ok)));
    const dlg = openSheet({ title: '', body, className: 'small', onClose: () => resolve(result) });
  });
}

// Segmentierte Auswahl (z. B. Hell | Sepia | Dunkel)
export function segmented(options, value, onChange, { className = '' } = {}) {
  const wrap = el('div', { class: 'seg ' + className, role: 'radiogroup' });
  for (const o of options) {
    const b = el('button', {
      type: 'button', role: 'radio', class: 'seg-btn', 'aria-checked': String(o.value === value),
      title: o.title || '', style: o.style || null,
      onclick: () => {
        wrap.querySelectorAll('.seg-btn').forEach((x) => x.setAttribute('aria-checked', 'false'));
        b.setAttribute('aria-checked', 'true');
        onChange(o.value);
      },
    });
    if (o.html) b.innerHTML = o.html; else b.textContent = o.label;
    wrap.append(b);
  }
  return wrap;
}

export function toggle(label, checked, onChange, hint) {
  const input = el('input', { type: 'checkbox', class: 'switch', checked: checked || null });
  input.addEventListener('change', () => onChange(input.checked));
  return el('label', { class: 'row-toggle' },
    el('span', { class: 'row-text' }, el('span', {}, label), hint ? el('small', {}, hint) : null),
    input);
}

export function field(label, control, hint) {
  return el('div', { class: 'field' }, el('div', { class: 'field-label' }, label), control, hint ? el('small', { class: 'hint' }, hint) : null);
}
