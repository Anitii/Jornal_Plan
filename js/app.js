// App shell: three books (MONTHLY · WEEKLY · DAILY LOG), navigation, layout, toolbar.
import { Y, KEY, MN, WD, pad, addDays, parseISO, dow, $, TODAY, IN_YEAR, WEEKS, weekOf } from './util.js';
import * as store from './store.js';
import { initEditor, bindEditors, refreshKeys, isEditing, setHighlightHook, hideFmt, hideScrollbar } from './editor.js';
import { initTimeGrid, paintAll } from './timeblock.js';
import { initSync } from './sync.js';
import { highlightToYearly, toast } from './links.js';
import { MON, WK, DL, DAYS } from './nav.js';
import * as P_MON from './pages/monthly.js';
import * as P_WK from './pages/weekly.js';
import * as P_DL from './pages/daily.js';

/* ---------- books ---------- */
const BOOKS = {
  mon: { pages: [{ t: 'cover' }, { t: 'timeline' }, { t: 'yearly' }] },
  wk: { pages: [{ t: 'cover' }] },
  dl: { pages: [{ t: 'cover' }] },
};
for (let m = 0; m < 12; m++) BOOKS.mon.pages.push({ t: 'month', m }, { t: 'nav', m });
WEEKS.forEach((_, i) => BOOKS.wk.pages.push({ t: 'week', i }));
for (let i = 0; i < 4; i++) BOOKS.wk.pages.push({ t: 'free', i });
BOOKS.wk.pages.push({ t: 'info' });
DAYS.forEach(k => BOOKS.dl.pages.push({ t: 'day', k }));

function render(book, it) {
  if (book === 'mon') return it.t === 'cover' ? P_MON.cover() : it.t === 'timeline' ? P_MON.timeline() : it.t === 'yearly' ? P_MON.yearly() : it.t === 'month' ? P_MON.month(it.m) : P_MON.nav(it.m);
  if (book === 'wk') return it.t === 'cover' ? P_WK.cover() : it.t === 'week' ? P_WK.week(it.i) : it.t === 'free' ? P_WK.free(it.i) : P_WK.info();
  return it.t === 'cover' ? P_DL.cover() : P_DL.day(it.k);
}
function label(book, it) {
  if (book === 'mon') return { cover: 'MONTHLY · CONTENTS', timeline: '365 TIMELINE', yearly: 'YEARLY', month: `MONTHLY · ${MN[it.m]}`, nav: `MONTHLY NAVIGATION · ${MN[it.m]}` }[it.t];
  if (book === 'wk') {
    if (it.t === 'week') { const a = WEEKS[it.i], z = addDays(a, 6); return `WEEKLY · W${pad(it.i + 1)} · ${pad(a.getMonth() + 1)}.${pad(a.getDate())}–${pad(z.getMonth() + 1)}.${pad(z.getDate())}`; }
    return { cover: 'WEEKLY · CONTENTS', free: `FREE NOTE · ${it.i + 1}/4`, info: 'PERSONAL INFORMATION' }[it.t];
  }
  return it.t === 'cover' ? 'DAILY LOG · CONTENTS' : `DAILY LOG · ${it.k.replace(/-/g, '.')} ${WD[dow(parseISO(it.k))]}`;
}
const firstWeekOfMonth = m => WEEKS.findIndex(w => addDays(w, 6) >= new Date(Y, m, 1));
function tabs(book, it) {
  if (book === 'mon') return [['Y', MON.timeline, it.t === 'timeline' || it.t === 'yearly'],
    ...MN.map((_, m) => [m + 1, MON.month(m), it.m === m && (it.t === 'month' || it.t === 'nav')])];
  if (book === 'wk') {
    const cm = it.t === 'week' ? Math.max(0, WEEKS[it.i].getFullYear() < Y ? 0 : WEEKS[it.i].getMonth()) : -1;
    return [...MN.map((_, m) => [m + 1, WK.week(firstWeekOfMonth(m)), cm === m]), ['N', WK.free(0), it.t === 'free' || it.t === 'info']];
  }
  const cm = it.t === 'day' ? +it.k.slice(5, 7) - 1 : -1;
  return MN.map((_, m) => [m + 1, DL.day(`${Y}-${pad(m + 1)}-01`), cm === m]);
}

/* ---------- state ---------- */
const VK = KEY + '-view2';
const st = { mode: 'wk', mon: MON.cover, wk: WK.cover, dl: DL.cover };
let fresh = true;
try { const v = JSON.parse(localStorage.getItem(VK) || 'null'); if (v) { Object.assign(st, v); fresh = false; } } catch (e) {}
if (fresh && IN_YEAR) Object.assign(st, todayIdx());
try {
  const h = new URLSearchParams(location.hash.slice(1));
  for (const k of ['mon', 'wk', 'dl']) if (h.has(k)) st[k] = +h.get(k);
  if (h.has('mode')) st.mode = h.get('mode');
} catch (e) {}
if (!BOOKS[st.mode]) st.mode = 'wk';
for (const b in BOOKS) st[b] = Math.max(0, Math.min(BOOKS[b].pages.length - 1, st[b] | 0));
const saveView = () => { try { localStorage.setItem(VK, JSON.stringify(st)); } catch (e) {} };
function todayIdx(k = TODAY) {
  const d = parseISO(k);
  return { mon: MON.month(d.getMonth()), wk: WK.week(Math.max(0, weekOf(d))), dl: DL.day(k) };
}

/* ---------- drawing ---------- */
const sp = () => $('sp');
function bindChecks(root) {
  const SYM = { '': '', v: '✓', '>': '→', t: '△' };
  root.querySelectorAll('[data-c]').forEach(el => { const v = store.get(el.dataset.c) || ''; el.dataset.v = v; el.textContent = SYM[v] || ''; });
  root.querySelectorAll('[data-t]').forEach(el => el.classList.toggle('on', !!store.get(el.dataset.t)));
  root.querySelectorAll('[data-blk]').forEach(total);
}
function total(blk) { blk.querySelector('.tot').textContent = blk.querySelectorAll('[data-t].on').length; }
function draw() {
  const b = st.mode, it = BOOKS[b].pages[st[b]];
  const [L, R, lc, rc] = render(b, it);
  const el = sp();
  el.className = 'spread book-' + b;
  el.innerHTML = `<div class="page l ${lc || ''}">${L}</div><div class="page r ${rc || ''}">${R}</div>`;
  bindEditors(el); bindChecks(el); paintAll(el);
  $('where').textContent = label(b, it);
  const tb = $('tabs');
  tb.className = 'tabs t-' + b;
  tb.innerHTML = tabs(b, it).map(([t, i, on]) => `<a data-go="${b}:${i}" class="${on ? 'on' : ''}">${t}</a>`).join('');
  document.querySelectorAll('#mode button').forEach(x => x.classList.toggle('on', x.dataset.m === b));
  hideFmt(); hideScrollbar();
}
function go(book, i) {
  if (book !== st.mode) st.mode = book;
  st[book] = Math.max(0, Math.min(BOOKS[book].pages.length - 1, i));
  saveView(); draw();
}
function layout() {
  const stage = $('stage');
  const aw = stage.clientWidth - 80, ah = stage.clientHeight - 64;
  const s = Math.max(.3, Math.min(aw / 1200, ah / 504, 1.9));
  $('scale').style.transform = `scale(${s})`;
  $('hold').style.width = (1230 * s) + 'px'; $('hold').style.height = (504 * s) + 'px';
}

/* ---------- events ---------- */
function initEvents() {
  document.addEventListener('click', e => {
    const c = e.target.closest('[data-c]');
    if (c) {
      const CYC = ['', 'v', '>', 't'], SYM = { '': '', v: '✓', '>': '→', t: '△' };
      const v = CYC[(CYC.indexOf(c.dataset.v || '') + 1) % CYC.length];
      c.dataset.v = v; c.textContent = SYM[v]; store.set(c.dataset.c, v); return;
    }
    const t = e.target.closest('[data-t]');
    if (t) { t.classList.toggle('on'); store.set(t.dataset.t, t.classList.contains('on') ? 1 : ''); total(t.closest('[data-blk]')); return; }
    const g = e.target.closest('[data-go]');
    if (g) {
      const [b, i] = g.dataset.go.split(':');
      if (i === 'today') { Object.assign(st, IN_YEAR ? todayIdx() : { dl: DL.day(`${Y}-01-01`) }); go(b, st[b]); return; }
      go(b, +i); return;
    }
    const a = e.target.closest('.arrow');
    if (a) { go(st.mode, st[st.mode] + (+a.dataset.d)); return; }
    const mb = e.target.closest('#mode button');
    if (mb) { st.mode = mb.dataset.m; saveView(); draw(); return; }
    if (!e.target.closest('#help,#helpBtn')) { $('help').classList.remove('show'); $('helpBtn').classList.remove('on'); }
  });
  document.addEventListener('keydown', e => {
    const a = document.activeElement;
    if (a && (a.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(a.tagName))) return;
    if (e.key === 'ArrowLeft') go(st.mode, st[st.mode] - 1);
    if (e.key === 'ArrowRight') go(st.mode, st[st.mode] + 1);
  });
  $('helpBtn').onclick = () => { const on = $('help').classList.toggle('show'); $('helpBtn').classList.toggle('on', on); };
  $('todayBtn').onclick = () => {
    if (!IN_YEAR) { toast(`今天不在 ${Y} 年`); return; }
    Object.assign(st, todayIdx()); saveView(); draw();
  };
  $('datePick').onchange = e => {
    const k = e.target.value; if (!k || !k.startsWith(String(Y))) return;
    Object.assign(st, todayIdx(k)); saveView(); draw();
  };
  $('exportBtn').onclick = () => {
    const blob = new Blob([store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `os-planner-${Y}-backup.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $('importBtn').onclick = () => $('importFile').click();
  $('importFile').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(t => {
      try { const o = JSON.parse(t); if (o && typeof o === 'object' && confirm('匯入會覆蓋目前所有內容，確定嗎？')) store.importAll(o); }
      catch (_) { alert('檔案格式不正確'); }
    });
    e.target.value = '';
  };
  window.addEventListener('resize', () => { layout(); hideFmt(); hideScrollbar(); });

  // another device changed something: update without disturbing the field being typed in
  store.bus.addEventListener('remote', e => {
    if (isEditing()) { refreshKeys(sp(), e.detail); bindChecks(sp()); paintAll(sp()); }
    else draw();
  });
  store.bus.addEventListener('reset', draw);
  document.addEventListener('planner:redraw-checks', () => bindChecks(sp()));
}

/* ---------- boot ---------- */
initEditor();
setHighlightHook(highlightToYearly);
initTimeGrid();
initEvents();
layout(); draw();
document.fonts && document.fonts.ready.then(() => { layout(); draw(); });
initSync();

if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
