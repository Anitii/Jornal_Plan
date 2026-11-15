// Cross-page links that copy data.
//
// Highlight → Yearly: highlighting text inside a monthly field (mo-<m>-<day> or the monthly
// memo — also when edited from the weekly "FROM MONTHLY" row) appends one line to that
// month's Yearly box, e.g. "11/15 面試", in the same highlighter colour. It is written once
// at the moment of highlighting; afterwards the Yearly text is independent and editable.
import { MS, esc, plain } from './util.js';
import * as store from './store.js';

export function highlightToYearly(ed, text, color) {
  const m = /^mo-(\d+)-(\d+|memo)$/.exec(ed.dataset.k || '');
  if (!m) return;
  const mi = +m[1];
  const t = String(text).replace(/\s+/g, ' ').trim();
  if (!t) return;
  const line = m[2] === 'memo' ? t : `${mi + 1}/${m[2]} ${t}`;
  const yk = 'yr-' + mi;
  let cur = store.get(yk) || '';
  if (plain(cur).includes(line)) { toast(`${MS[mi]} 年計畫已經有「${line}」`); return; }
  if (cur && !/[<&]/.test(cur)) cur = esc(cur).replace(/\n/g, '<br>');
  store.set(yk, cur + `<div><span style="background-color: ${color};">${esc(line)}</span></div>`);
  toast(`已寫入 ${MS[mi]} 年計畫：${line}`);
}

let tt;
export function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show');
  clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), 2200);
}
