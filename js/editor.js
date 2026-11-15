// Rich-text fields: every editable box is a contenteditable <div class="ed" data-k="…">.
// Handles: sanitising, markdown shortcuts, the floating format toolbar (macaron
// highlighter / text colours), the hover/drag overlay scrollbar, and Enter-to-next-field.
import { esc, $, HL, FC } from './util.js';
import * as store from './store.js';

/* ---------- sanitising ---------- */
const OK = new Set(['B','STRONG','I','EM','U','S','STRIKE','DEL','CODE','MARK','SPAN','FONT','DIV','P','BR','H3','BLOCKQUOTE']);
const DROP = new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','LINK','META','IMG','SVG','VIDEO','AUDIO']);
function walk(node) {
  [...node.childNodes].forEach(c => {
    if (c.nodeType === 3) return;
    if (c.nodeType !== 1 || DROP.has(c.tagName)) { c.remove(); return; }
    if (!OK.has(c.tagName)) { walk(c); c.replaceWith(...c.childNodes); return; }
    const col = c.style.color, bg = c.style.backgroundColor, fc = c.tagName === 'FONT' ? c.getAttribute('color') : null;
    const ck = c.classList.contains('ck'), on = c.classList.contains('on');
    [...c.attributes].forEach(a => c.removeAttribute(a.name));
    if (col) c.style.color = col;
    if (bg) c.style.backgroundColor = bg;
    if (fc && /^#?[\w(),.\s%]+$/.test(fc)) c.setAttribute('color', fc);
    if (ck) { c.className = 'ck' + (on ? ' on' : ''); c.setAttribute('contenteditable', 'false'); c.textContent = on ? '☑' : '☐'; return; }
    walk(c);
  });
}
export function clean(html) { const t = document.createElement('template'); t.innerHTML = html; walk(t.content); return t.innerHTML.replace(/​/g, ''); }
export function toHTML(v) { if (!v) return ''; if (!/[<&]/.test(v)) return esc(v).replace(/\n/g, '<br>'); return clean(v); }

/** Editable field markup. cls: 'one' (single row), 'lined' (ruled), 'dot' (dot grid). */
export function E(k, cls = '', ph = '') {
  return `<div class="ed ${cls}" contenteditable="true" spellcheck="false" data-k="${k}"${ph ? ` data-ph="${ph}"` : ''}></div>`;
}
/** Fill all fields inside root from the store. */
export function bindEditors(root) {
  root.querySelectorAll('.ed[data-k]').forEach(el => { el.innerHTML = toHTML(store.get(el.dataset.k)); });
  requestAnimationFrame(() => root.querySelectorAll('.ed').forEach(marks));
}
/** Refresh only fields whose key changed (used after a remote sync). */
export function refreshKeys(root, keys) {
  const set = new Set(keys);
  root.querySelectorAll('.ed[data-k]').forEach(el => {
    if (set.has(el.dataset.k) && document.activeElement !== el) { el.innerHTML = toHTML(store.get(el.dataset.k)); marks(el); }
  });
}
export const isEditing = () => { const a = document.activeElement; return !!(a && a.classList && a.classList.contains('ed')); };

function save(el) {
  if (!el || !el.dataset.k) return;
  if (!el.textContent.replace(/[​\s]/g, '') && !el.querySelector('.ck')) {
    if (el.innerHTML) el.innerHTML = '';
    store.set(el.dataset.k, '');
  } else store.set(el.dataset.k, clean(el.innerHTML));
}

/* ---------- highlight hook (monthly → yearly) ---------- */
let onHighlight = () => {};
export function setHighlightHook(fn) { onHighlight = fn; }

/* ---------- overflow cue + overlay scrollbar ---------- */
const over = el => el.scrollHeight > el.clientHeight + 1;
export function marks(el) {
  const o = over(el);
  el.classList.toggle('more-dn', o && el.scrollTop + el.clientHeight < el.scrollHeight - 1);
  el.classList.toggle('more-up', o && el.scrollTop > 0);
}
let sb, thumb, sbEl = null, drag = null, hideT, focEd = null;
function placeSb() {
  const el = sbEl;
  if (!el || !document.contains(el) || !over(el)) { sb.classList.remove('show'); sbEl = null; return; }
  const r = el.getBoundingClientRect(), h = r.height;
  const tH = Math.max(Math.min(16, h), h * el.clientHeight / el.scrollHeight);
  const maxS = el.scrollHeight - el.clientHeight;
  sb.style.left = (r.right - 16) + 'px'; sb.style.top = r.top + 'px'; sb.style.height = h + 'px';
  thumb.style.height = tH + 'px'; thumb.style.top = ((h - tH) * el.scrollTop / maxS) + 'px';
  sb.classList.add('show');
}
function showSb(el) { clearTimeout(hideT); sbEl = el; placeSb(); }
function hideSb() {
  if (drag) return; clearTimeout(hideT);
  hideT = setTimeout(() => {
    if (focEd && document.contains(focEd) && over(focEd)) { sbEl = focEd; placeSb(); }
    else { sb.classList.remove('show'); sbEl = null; }
  }, 300);
}
export function hideScrollbar() { if (sb) { sb.classList.remove('show'); sbEl = null; } }

/* ---------- markdown shortcuts ---------- */
function caretAt(node, off) { const r = document.createRange(); r.setStart(node, off); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
function caretEnd(el) { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
const INLINE = [
  [/\*\*([^*]+)\*\*$/, 'b'], [/__([^_]+)__$/, 'b'],
  [/~~([^~]+)~~$/, 's'], [/`([^`]+)`$/, 'code'], [/==([^=]+)==$/, 'mark'],
  [/(^|[^*])\*([^*\s](?:[^*]*[^*\s])?)\*$/, 'i'],
];
function mdInline(ed) {
  const sel = getSelection(); if (!sel.rangeCount) return;
  const r = sel.getRangeAt(0); if (!r.collapsed) return;
  const n = r.startContainer; if (n.nodeType !== 3) return;
  const off = r.startOffset, before = n.data.slice(0, off);
  for (const [re, tag] of INLINE) {
    const m = before.match(re); if (!m) continue;
    const inner = m[m.length - 1];
    let start = off - m[0].length; if (tag === 'i' && m[1]) start += m[1].length;
    const rr = document.createRange(); rr.setStart(n, start); rr.setEnd(n, off); rr.deleteContents();
    const el = document.createElement(tag); el.textContent = inner; rr.insertNode(el);
    const t = document.createTextNode('​'); el.after(t); caretAt(t, 1);
    if (tag === 'mark' && ed) onHighlight(ed, inner, '#f8efb0');
    return true;
  }
}
function lineStart(n, ed) {
  let p = n.previousSibling;
  while (p && p.nodeType === 3 && !p.data.replace(/​/g, '')) p = p.previousSibling;
  if (p && p.nodeName !== 'BR') return false;
  const par = n.parentNode;
  return par === ed || (/^(DIV|P|H3|BLOCKQUOTE)$/.test(par.nodeName) && ed.contains(par));
}
function mdBlock(ed) {
  const sel = getSelection(); if (!sel.rangeCount) return;
  const r = sel.getRangeAt(0); if (!r.collapsed) return;
  const n = r.startContainer; if (n.nodeType !== 3) return;
  const off = r.startOffset, before = n.data.slice(0, off).replace(/​/g, '').replace(/ /g, ' ');
  if (!lineStart(n, ed)) return;
  const rest = n.data.slice(off);
  if (/^#{1,3} $/.test(before)) { n.data = '​' + rest; caretAt(n, 1); document.execCommand('formatBlock', false, 'h3'); return true; }
  if (/^> $/.test(before)) { n.data = '​' + rest; caretAt(n, 1); document.execCommand('formatBlock', false, 'blockquote'); return true; }
  if (/^[-*] $/.test(before)) { n.data = '• ' + rest; caretAt(n, 2); return true; }
  if (/^\[ ?\] $/.test(before)) {
    n.data = ' ' + rest;
    const ck = document.createElement('span'); ck.className = 'ck'; ck.contentEditable = 'false'; ck.textContent = '☐';
    n.parentNode.insertBefore(ck, n); caretAt(n, 1); return true;
  }
}

/* ---------- floating format toolbar ---------- */
let fmt;
const hideFmt = () => fmt && fmt.classList.remove('show');
export { hideFmt };
function curEd() {
  const s = getSelection(); if (!s.rangeCount) return null;
  const n = s.anchorNode; const el = n && (n.nodeType === 1 ? n : n.parentElement);
  return el && el.closest('.ed');
}

export function initEditor() {
  sb = document.createElement('div'); sb.id = 'sb'; sb.innerHTML = '<i></i>'; document.body.appendChild(sb);
  thumb = sb.firstChild;
  fmt = $('fmt');
  fmt.innerHTML = `<button data-f="bold" title="粗體 (Ctrl+B)"><b>B</b></button><button data-f="italic" title="斜體 (Ctrl+I)"><i>I</i></button><button data-f="underline" title="底線 (Ctrl+U)"><u>U</u></button><button data-f="strikeThrough" title="刪除線"><s>S</s></button><button data-f="code" title="程式碼標籤" style="font-family:'IBM Plex Mono';font-size:11px">&lt;/&gt;</button>
<span class="sep"></span><span class="ttl">螢光</span>${HL.map(([c, n]) => `<button class="sw" data-hl="${c}" title="${n}" style="background:${c}"></button>`).join('')}<button data-hl="transparent" title="移除螢光">∅</button>
<span class="sep"></span><span class="ttl">字色</span>${FC.map(([c, n]) => `<button class="fc" data-fc="${c}" title="${n}" style="color:${c}">A</button>`).join('')}<button class="fc" data-fc="#2e2b28" title="預設黑" style="color:#2e2b28">A</button>
<span class="sep"></span><button data-f="removeFormat" title="清除格式" style="font-size:11px">清除</button>`;
  fmt.addEventListener('mousedown', e => e.preventDefault());

  document.addEventListener('selectionchange', () => {
    const s = getSelection(), ed = curEd();
    if (!ed || !s.rangeCount || s.isCollapsed) { hideFmt(); return; }
    const rect = s.getRangeAt(0).getBoundingClientRect();
    if (!rect.width && !rect.height) { hideFmt(); return; }
    fmt.classList.add('show');
    const w = fmt.offsetWidth, h = fmt.offsetHeight;
    let x = rect.left + rect.width / 2 - w / 2; x = Math.max(8, Math.min(innerWidth - w - 8, x));
    let y = rect.top - h - 8; if (y < 62) y = rect.bottom + 8;
    fmt.style.left = x + 'px'; fmt.style.top = y + 'px';
  });
  fmt.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const ed = curEd(); if (!ed) return;
    const selText = getSelection().toString();
    document.execCommand('styleWithCSS', false, true);
    if (b.dataset.f === 'code') {
      const s = getSelection(), r = s.getRangeAt(0), c = document.createElement('code');
      c.appendChild(r.extractContents()); r.insertNode(c);
      const nr = document.createRange(); nr.selectNodeContents(c); s.removeAllRanges(); s.addRange(nr);
    } else if (b.dataset.f) document.execCommand(b.dataset.f, false, null);
    else if (b.dataset.hl) {
      document.execCommand('hiliteColor', false, b.dataset.hl);
      if (b.dataset.hl !== 'transparent' && selText.trim()) onHighlight(ed, selText, b.dataset.hl);
    } else if (b.dataset.fc) document.execCommand('foreColor', false, b.dataset.fc);
    save(ed);
  });

  document.addEventListener('input', e => {
    const ed = e.target.closest && e.target.closest('.ed'); if (!ed) return;
    if (e.inputType === 'insertText') { if (e.data === ' ') mdBlock(ed); mdInline(ed); }
    save(ed); marks(ed);
    if (over(ed)) showSb(ed);
  });
  document.addEventListener('compositionend', e => {
    const ed = e.target.closest && e.target.closest('.ed'); if (!ed) return;
    setTimeout(() => { if (mdInline(ed)) save(ed); }, 0);
  });
  document.addEventListener('paste', e => {
    const ed = e.target.closest && e.target.closest('.ed'); if (!ed) return;
    e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
  });
  document.addEventListener('keydown', e => {
    const ed = e.target.closest && e.target.closest('.ed.one');
    if (ed && e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      const all = [...ed.closest('.spread').querySelectorAll('.ed')];
      const nx = all[all.indexOf(ed) + 1]; if (nx) { nx.focus(); caretEnd(nx); }
    }
  });
  document.addEventListener('click', e => {
    const ck = e.target.closest('.ed .ck');
    if (ck) { const on = !ck.classList.contains('on'); ck.classList.toggle('on', on); ck.textContent = on ? '☑' : '☐'; save(ck.closest('.ed')); }
  });
  document.addEventListener('focusin', e => {
    const el = e.target.closest && e.target.closest('.ed'); if (!el) return;
    document.execCommand('styleWithCSS', false, true);
    focEd = el; if (over(el)) showSb(el);
  });
  document.addEventListener('focusout', e => { if (e.target === focEd) { focEd = null; hideSb(); } });

  /* scrollbar interaction */
  document.addEventListener('mousemove', e => {
    if (drag) {
      const el = drag.el, r = el.getBoundingClientRect(), maxS = el.scrollHeight - el.clientHeight;
      el.scrollTop = drag.s + (e.clientY - drag.y) * maxS / Math.max(1, r.height - thumb.offsetHeight); placeSb(); return;
    }
    if (e.target.closest && e.target.closest('#sb')) { clearTimeout(hideT); return; }
    let el = e.target.closest && e.target.closest('.ed');
    if (!el) { const p = document.elementFromPoint(e.clientX - 14, e.clientY); el = p && p.closest && p.closest('.ed'); }
    if (el && over(el)) showSb(el); else if (sbEl) hideSb();
  });
  thumb.addEventListener('mousedown', e => { if (!sbEl) return; e.preventDefault(); e.stopPropagation(); drag = { el: sbEl, y: e.clientY, s: sbEl.scrollTop }; sb.classList.add('drag'); });
  sb.addEventListener('mousedown', e => {
    if (e.target !== sb || !sbEl) return; e.preventDefault();
    const r = sbEl.getBoundingClientRect(); sbEl.scrollTop = (e.clientY - r.top) / r.height * (sbEl.scrollHeight - sbEl.clientHeight); placeSb();
  });
  sb.addEventListener('wheel', e => { if (!sbEl) return; e.preventDefault(); sbEl.scrollTop += e.deltaY; placeSb(); }, { passive: false });
  document.addEventListener('mouseup', () => { if (drag) { drag = null; sb.classList.remove('drag'); } });
  document.addEventListener('scroll', e => { const el = e.target; if (el.classList && el.classList.contains('ed')) { marks(el); if (el === sbEl) placeSb(); } }, true);
}
