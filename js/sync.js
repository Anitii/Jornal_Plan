// Cross-device sync: the whole planner is one JSON file in a (private) GitHub repo.
// Each field carries its own timestamp, so edits on different devices merge per field.
import { KEY, $ } from './util.js';
import { bus, snapshot, mergeRemote, localNewer } from './store.js';

const SK = KEY + '-sync';
let cfg = {};
try { cfg = JSON.parse(localStorage.getItem(SK) || '{}') || {}; } catch (e) { cfg = {}; }
const saveCfg = () => { try { localStorage.setItem(SK, JSON.stringify(cfg)); } catch (e) {} };

function b64enc(str) {
  const b = new TextEncoder().encode(str); let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}
function b64dec(b64) {
  const s = atob(b64.replace(/\s/g, '')); const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return new TextDecoder().decode(b);
}

const API = 'https://api.github.com';
const repoUrl = () => `${API}/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}`;
const fileUrl = () => `${repoUrl()}/contents/${cfg.path.split('/').filter(Boolean).map(encodeURIComponent).join('/')}`;
const ref = () => cfg.branch ? `?ref=${encodeURIComponent(cfg.branch)}` : '';
const hdr = x => Object.assign({ 'Authorization': 'Bearer ' + cfg.token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, x || {});
const errMsg = r => r.status === 401 ? 'Token 無效或已過期'
  : r.status === 403 ? 'Token 沒有這個 repo 的讀寫權限'
  : r.status === 404 ? '找不到這個 repo（名稱打錯，或 token 沒授權它）'
  : 'GitHub 回應錯誤 ' + r.status;

export const Sync = {
  busy: false, again: false, timer: null, state: 'off', msg: '',
  on() { return !!(cfg.token && cfg.owner && cfg.repo && cfg.path); },

  async pull() {
    const r = await fetch(fileUrl() + ref(), { headers: hdr(), cache: 'no-store' });
    if (r.status === 404) {
      // a missing file is fine on first sync — but the repo itself must be reachable
      const rr = await fetch(repoUrl(), { headers: hdr(), cache: 'no-store' });
      if (!rr.ok) throw new Error(errMsg(rr));
      return { sha: null, doc: null };
    }
    if (!r.ok) throw new Error(errMsg(r));
    const j = await r.json();
    let txt;
    if (j.content) txt = b64dec(j.content);
    else { // files over 1 MB come without inline content
      const r2 = await fetch(fileUrl() + ref(), { headers: hdr({ 'Accept': 'application/vnd.github.raw' }), cache: 'no-store' });
      if (!r2.ok) throw new Error(errMsg(r2));
      txt = await r2.text();
    }
    try { return { sha: j.sha, doc: JSON.parse(txt) }; }
    catch (e) { throw new Error('雲端檔案不是有效的 JSON'); }
  },

  async run() {
    if (!this.on()) return;
    if (this.busy) { this.again = true; return; }
    this.busy = true; clearTimeout(this.timer); this.set('sync');
    try {
      let done = false;
      for (let i = 0; i < 4 && !done; i++) {
        const { sha, doc } = await this.pull();
        mergeRemote(doc);
        if (!localNewer(doc)) { done = true; break; }
        const body = { message: 'planner sync ' + new Date().toISOString(), content: b64enc(JSON.stringify(snapshot())) };
        if (sha) body.sha = sha;
        if (cfg.branch) body.branch = cfg.branch;
        const r = await fetch(fileUrl(), { method: 'PUT', headers: hdr({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) });
        if (r.ok) { done = true; break; }
        if (r.status === 409 || r.status === 422) continue; // another device wrote first: pull, merge, retry
        throw new Error(errMsg(r));
      }
      if (!done) throw new Error('同步衝突，稍後會再試一次');
      cfg.last = Date.now(); saveCfg(); this.set('ok');
    } catch (e) { this.set('err', e.message || String(e)); }
    finally {
      this.busy = false;
      if (this.again) { this.again = false; this.timer = setTimeout(() => this.run(), 400); }
    }
  },

  dirty() { if (!this.on()) return; this.set('dirty'); clearTimeout(this.timer); this.timer = setTimeout(() => this.run(), 3000); },

  set(s, msg) {
    this.state = s; this.msg = msg || '';
    const b = $('syncBtn'); if (!b) return;
    b.textContent = { off: '☁ 同步', dirty: '☁ 待同步…', sync: '☁ 同步中…', ok: '☁ 已同步', err: '☁ 同步失敗' }[s];
    b.dataset.s = s;
    b.title = s === 'err' ? this.msg : s === 'ok' && cfg.last ? '上次同步：' + new Date(cfg.last).toLocaleString() : '設定跨裝置同步';
    const m = $('sMsg');
    if (m) m.textContent = s === 'err' ? '⚠ ' + this.msg : s === 'ok' ? '✓ 已同步（' + new Date(cfg.last).toLocaleTimeString() + '）' : s === 'sync' ? '同步中…' : '';
  },
};

/* ---------- settings dialog & automatic triggers ---------- */
export function initSync() {
  const dlg = $('syncDlg');
  const open = () => {
    $('sOwner').value = cfg.owner || ''; $('sRepo').value = cfg.repo || '';
    $('sPath').value = cfg.path || 'planner-2026.json'; $('sBranch').value = cfg.branch || ''; $('sToken').value = cfg.token || '';
    dlg.classList.add('show'); Sync.set(Sync.on() ? Sync.state : 'off', Sync.msg);
  };
  $('syncBtn').onclick = open;
  $('sClose').onclick = () => dlg.classList.remove('show');
  dlg.addEventListener('mousedown', e => { if (e.target === dlg) dlg.classList.remove('show'); });
  $('sSave').onclick = () => {
    const v = id => $(id).value.trim();
    if (!v('sOwner') || !v('sRepo') || !v('sToken')) { $('sMsg').textContent = '⚠ 請填寫帳號、repo 名稱和 token'; return; }
    cfg = { owner: v('sOwner'), repo: v('sRepo'), path: v('sPath') || 'planner-2026.json', branch: v('sBranch'), token: v('sToken') };
    saveCfg(); Sync.run();
  };
  $('sNow').onclick = () => { if (Sync.on()) Sync.run(); else $('sMsg').textContent = '⚠ 還沒設定同步'; };
  $('sOff').onclick = () => {
    if (!confirm('中斷這台裝置的同步？（本機和雲端資料都會保留，token 會從這台裝置移除）')) return;
    cfg = {}; saveCfg(); Sync.set('off'); $('sToken').value = '';
  };

  bus.addEventListener('local', () => Sync.dirty());
  document.addEventListener('visibilitychange', () => {
    if (!Sync.on()) return;
    if (document.hidden) { if (Sync.state === 'dirty') Sync.run(); } else Sync.run();
  });
  window.addEventListener('online', () => Sync.run());
  window.addEventListener('pagehide', () => { if (Sync.state === 'dirty') Sync.run(); });
  window.addEventListener('beforeunload', e => {
    if (Sync.on() && (Sync.state === 'dirty' || Sync.state === 'sync')) { Sync.run(); e.preventDefault(); e.returnValue = ''; }
  });
  setInterval(() => { if (Sync.on() && !document.hidden && Sync.state !== 'dirty') Sync.run(); }, 60000);
  if (Sync.on()) Sync.run();
}
