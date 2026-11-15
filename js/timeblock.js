// Daily TIME TABLE as a 10-minute grid (05:00–24:59 → 20 rows × 6 cells = 120 cells).
// Blocks are stored per day under key d-<date>-tb as JSON:
//   [{ id, s: startCell, n: cellCount, t: title, c: colour, src?: checklist key, done? }]
// A block made by dragging a checklist item keeps `src`, so its title and done state
// follow that checklist row.
import { HL, esc, plain, TODAY, NOW } from './util.js';
import * as store from './store.js';

const H0 = 5, ROWS = 20, PER = 6, N = ROWS * PER;
const GREY = '#e6e3dc';
const COLORS = [...HL.map(x => x[0]), GREY];
export const QCOLOR = [HL[4][0], HL[3][0], HL[0][0], HL[5][0]]; // per checklist quadrant
const key = date => `d-${date}-tb`;
const load = date => store.getJSON(key(date), []);
const saveBlocks = (date, bl) => store.setJSON(key(date), bl);
const uid = () => Math.random().toString(36).slice(2, 9);
const fmtT = i => { const m = H0 * 60 + i * 10; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

/* ---------- markup ---------- */
export function render(date) {
  let s = '';
  for (let r = 0; r < ROWS; r++) {
    let cells = '';
    for (let j = 0; j < PER; j++) cells += `<b data-i="${r * PER + j}"></b>`;
    s += `<div class="tr"><i>${H0 + r}</i><div class="tgc">${cells}</div><div class="segs"></div></div>`;
  }
  return `<div class="tg" data-date="${date}">${s}</div>`;
}

const doneOf = b => b.src ? store.get(b.src.replace(/t(\d)$/, 'c$1')) === 'v' : !!b.done;
const titleOf = b => (b.src && plain(store.get(b.src))) || b.t || '';

export function paint(tg) {
  const date = tg.dataset.date;
  tg.querySelectorAll('b.sel').forEach(b => b.classList.remove('sel'));
  paintWith(tg, load(date));
  const rows = [...tg.querySelectorAll('.tr')];
  // current-time marker
  if (date === TODAY) {
    const mins = NOW.getHours() * 60 + NOW.getMinutes() - H0 * 60;
    if (mins >= 0 && mins < ROWS * 60) {
      const m = document.createElement('div'); m.className = 'nowline';
      m.style.left = ((mins % 60) / 60 * 100) + '%';
      rows[Math.floor(mins / 60)].querySelector('.segs').appendChild(m);
    }
  }
}
function paintWith(tg, bl) {
  const rows = [...tg.querySelectorAll('.tr')];
  rows.forEach(r => { r.querySelector('.segs').innerHTML = ''; });
  for (const b of bl) {
    const title = titleOf(b), done = doneOf(b);
    for (let i = b.s; i < b.s + b.n;) {
      const r = Math.floor(i / PER), c0 = i % PER, len = Math.min(PER - c0, b.s + b.n - i);
      const first = i === b.s, last = i + len === b.s + b.n;
      const seg = document.createElement('div');
      seg.className = 'tbs' + (done ? ' done' : '') + (first ? ' first' : '') + (last ? ' last' : '');
      seg.dataset.id = b.id;
      seg.style.left = (c0 / PER * 100) + '%'; seg.style.width = (len / PER * 100) + '%';
      seg.style.background = b.c || GREY;
      seg.title = `${title}  ${fmtT(b.s)}–${fmtT(b.s + b.n)}（${b.n * 10} 分）`;
      seg.innerHTML = (first || c0 === 0 ? `<span>${esc(title)}</span>` : '') + (last ? '<em class="rz" title="拖曳調整長度"></em>' : '');
      rows[r] && rows[r].querySelector('.segs').appendChild(seg);
      i += len;
    }
  }
}
export const paintAll = root => root.querySelectorAll('.tg').forEach(paint);

/* ---------- helpers ---------- */
function occupied(bl, exceptId) {
  const o = new Array(N).fill(false);
  for (const b of bl) if (b.id !== exceptId) for (let i = b.s; i < b.s + b.n; i++) o[i] = true;
  return o;
}
const fits = (o, s, n) => { if (s < 0 || s + n > N) return false; for (let i = s; i < s + n; i++) if (o[i]) return false; return true; };
function cellAt(x, y, tg) {
  const el = document.elementFromPoint(x, y);
  const b = el && el.closest && el.closest('.tg b[data-i]');
  if (b && (!tg || b.closest('.tg') === tg)) return { tg: b.closest('.tg'), i: +b.dataset.i };
  // over a block segment: work out the cell from its row and x position
  const seg = el && el.closest && el.closest('.tg .tbs');
  if (seg && (!tg || seg.closest('.tg') === tg)) {
    const tr = seg.closest('.tr'), g = tr.closest('.tg'), cells = tr.querySelector('.tgc').getBoundingClientRect();
    const r = [...g.querySelectorAll('.tr')].indexOf(tr);
    const j = Math.max(0, Math.min(PER - 1, Math.floor((x - cells.left) / cells.width * PER)));
    return { tg: g, i: r * PER + j };
  }
  return null;
}
function markSel(tg, a, b) {
  tg.querySelectorAll('b.sel').forEach(x => x.classList.remove('sel'));
  if (a == null) return;
  for (let i = Math.min(a, b); i <= Math.max(a, b); i++) { const c = tg.querySelector(`b[data-i="${i}"]`); c && c.classList.add('sel'); }
}

/* ---------- popover (create / edit) ---------- */
let pop;
function closePop() { if (pop) pop.classList.remove('show'); document.querySelectorAll('.tg b.sel').forEach(x => x.classList.remove('sel')); }
function openPop(x, y, opts) {
  // opts: { mode:'new'|'edit', date, s, n, block? }
  const b = opts.block;
  let color = b ? (b.c || GREY) : HL[2][0];
  pop.innerHTML = `
    <div class="tp-time">${fmtT(opts.s)} – ${fmtT(opts.s + opts.n)}<small>${opts.n * 10} 分鐘</small></div>
    <input class="tp-in" placeholder="任務名稱" value="${b ? esc(titleOf(b)) : ''}" ${b && b.src ? 'title="名稱跟著左邊的 check list"' : ''}>
    <div class="tp-sw">${COLORS.map(c => `<button data-c="${c}" style="background:${c}" class="${c === color ? 'on' : ''}"></button>`).join('')}</div>
    <div class="tp-acts">
      ${b ? `<button class="tp-done">${doneOf(b) ? '↺ 未完成' : '✓ 完成'}</button><button class="tp-del">刪除</button>` : ''}
      <span style="flex:1"></span><button class="tp-cancel">取消</button><button class="tp-ok">${b ? '儲存' : '新增'}</button>
    </div>`;
  pop.classList.add('show');
  const w = pop.offsetWidth, h = pop.offsetHeight;
  pop.style.left = Math.max(8, Math.min(innerWidth - w - 8, x - w / 2)) + 'px';
  pop.style.top = (y + 14 + h > innerHeight ? Math.max(8, y - h - 14) : y + 14) + 'px';
  // focus after the mouse-up/click that opened the popover has finished
  const inp = pop.querySelector('.tp-in');
  const focusIn = () => { if (pop.classList.contains('show') && document.activeElement !== inp) { inp.focus(); inp.select(); } };
  setTimeout(focusIn, 30); setTimeout(focusIn, 150);
  pop.querySelectorAll('.tp-sw button').forEach(btn => btn.onclick = () => {
    color = btn.dataset.c; pop.querySelectorAll('.tp-sw button').forEach(z => z.classList.toggle('on', z === btn));
  });
  const commit = () => {
    const t = inp.value.trim();
    const bl = load(opts.date);
    if (b) {
      const x = bl.find(z => z.id === b.id); if (!x) return closePop();
      if (!x.src || t !== titleOf(x)) { x.t = t; if (x.src && t !== plain(store.get(x.src))) delete x.src; }
      x.c = color;
    } else {
      if (!t) { inp.focus(); return; }
      bl.push({ id: uid(), s: opts.s, n: opts.n, t, c: color });
    }
    saveBlocks(opts.date, bl); closePop(); repaint(opts.date);
  };
  pop.querySelector('.tp-ok').onclick = commit;
  pop.querySelector('.tp-cancel').onclick = closePop;
  inp.onkeydown = e => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); commit(); } if (e.key === 'Escape') closePop(); };
  if (b) {
    pop.querySelector('.tp-del').onclick = () => { saveBlocks(opts.date, load(opts.date).filter(z => z.id !== b.id)); closePop(); repaint(opts.date); };
    pop.querySelector('.tp-done').onclick = () => {
      const bl = load(opts.date), x = bl.find(z => z.id === b.id);
      if (x.src) { const ck = x.src.replace(/t(\d)$/, 'c$1'); store.set(ck, store.get(ck) === 'v' ? '' : 'v'); }
      else x.done = !x.done;
      saveBlocks(opts.date, bl); closePop(); repaint(opts.date);
      document.dispatchEvent(new CustomEvent('planner:redraw-checks'));
    };
  }
}
const repaint = date => document.querySelectorAll(`.tg[data-date="${date}"]`).forEach(paint);

/* ---------- pointer interactions ---------- */
let act = null; // current gesture
let ghost;
export function initTimeGrid() {
  pop = document.createElement('div'); pop.id = 'tbPop'; document.body.appendChild(pop);
  ghost = document.createElement('div'); ghost.id = 'tbGhost'; document.body.appendChild(ghost);

  document.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    if (pop.classList.contains('show') && !e.target.closest('#tbPop')) closePop();
    // drag a checklist row into the grid
    const grip = e.target.closest('.grip');
    if (grip) {
      const row = grip.closest('.qr'), ed = row.querySelector('.ed');
      const text = plain(store.get(ed.dataset.k));
      if (!text) return;
      e.preventDefault();
      act = { type: 'grip', src: ed.dataset.k, text, color: QCOLOR[+grip.dataset.q] || HL[2][0], date: grip.dataset.date };
      ghost.textContent = text; ghost.style.background = act.color; ghost.classList.add('show');
      ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px';
      return;
    }
    const tg = e.target.closest('.tg'); if (!tg) return;
    const date = tg.dataset.date;
    const seg = e.target.closest('.tbs');
    if (seg) {
      e.preventDefault();
      const bl = load(date), b = bl.find(z => z.id === seg.dataset.id); if (!b) return;
      const c = cellAt(e.clientX, e.clientY, tg);
      act = { type: e.target.classList.contains('rz') ? 'resize' : 'move', tg, date, id: b.id, s0: b.s, n0: b.n, c0: c ? c.i : b.s, moved: false, x: e.clientX, y: e.clientY };
      return;
    }
    const cell = e.target.closest('b[data-i]');
    if (cell) {
      e.preventDefault();
      const i = +cell.dataset.i;
      if (occupied(load(date))[i]) return;
      act = { type: 'select', tg, date, a: i, b: i };
      markSel(tg, i, i);
    }
  });

  document.addEventListener('pointermove', e => {
    if (!act) return;
    if (act.type === 'grip') {
      ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px';
      document.querySelectorAll('.tg b.sel').forEach(x => x.classList.remove('sel'));
      const c = cellAt(e.clientX, e.clientY);
      if (c) { const o = occupied(load(c.tg.dataset.date)); let n = 0; while (n < 3 && c.i + n < N && !o[c.i + n]) n++; if (n) markSel(c.tg, c.i, c.i + n - 1); }
      return;
    }
    const c = cellAt(e.clientX, e.clientY, act.tg); if (!c) return;
    if (act.type === 'select') {
      const o = occupied(load(act.date)), dir = c.i >= act.a ? 1 : -1;
      let i = act.a; while (i !== c.i && !o[i + dir] && i + dir >= 0 && i + dir < N) i += dir;
      act.b = i; markSel(act.tg, act.a, act.b);
    } else {
      if (Math.abs(e.clientX - act.x) + Math.abs(e.clientY - act.y) > 4) act.moved = true;
      if (!act.moved) return;
      const bl = load(act.date), b = bl.find(z => z.id === act.id), o = occupied(bl, act.id);
      if (act.type === 'move') { const s = act.s0 + (c.i - act.c0); if (fits(o, s, b.n) && s !== b.s) { b.s = s; act.bl = bl; tmpPaint(act.tg, bl); } }
      else { const n = c.i - b.s + 1; if (n >= 1 && fits(o, b.s, n) && n !== b.n) { b.n = n; act.bl = bl; tmpPaint(act.tg, bl); } }
    }
  });

  document.addEventListener('pointerup', e => {
    if (!act) return;
    const a = act; act = null;
    if (a.type === 'grip') {
      ghost.classList.remove('show');
      document.querySelectorAll('.tg b.sel').forEach(x => x.classList.remove('sel'));
      const c = cellAt(e.clientX, e.clientY); if (!c) return;
      const date = c.tg.dataset.date, bl = load(date), o = occupied(bl);
      let n = 0; while (n < 3 && c.i + n < N && !o[c.i + n]) n++;
      if (!n) return;
      bl.push({ id: uid(), s: c.i, n, t: a.text, c: a.color, src: date === a.date ? a.src : undefined });
      saveBlocks(date, bl); repaint(date);
      return;
    }
    if (a.type === 'select') {
      const s = Math.min(a.a, a.b), n = Math.abs(a.b - a.a) + 1;
      openPop(e.clientX, e.clientY, { mode: 'new', date: a.date, s, n });
      return;
    }
    if (!a.moved) { // a click on a block: edit it
      const b = load(a.date).find(z => z.id === a.id);
      if (b) openPop(e.clientX, e.clientY, { mode: 'edit', date: a.date, s: b.s, n: b.n, block: b });
      return;
    }
    if (a.bl) saveBlocks(a.date, a.bl);
    repaint(a.date);
  });

  // checklist text / check changes update linked blocks
  store.bus.addEventListener('local', e => {
    const m = /^d-(\d{4}-\d\d-\d\d)-q\d[tc]\d$/.exec(e.detail || ''); if (m) repaint(m[1]);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });
}

// paint from an in-memory list during a drag (saved on pointerup)
const tmpPaint = (tg, bl) => paintWith(tg, bl);
