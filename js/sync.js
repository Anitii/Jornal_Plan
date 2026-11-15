// Cross-device sync. The whole planner is one JSON document stored on GitHub, either:
//   • gist (default) — a secret Gist in your account; needs a token with only the "gist" scope.
//                      Every device that pastes the same token finds the same Gist automatically.
//   • repo           — a file in a (private) repository; needs a token with Contents read/write.
// Each field carries its own timestamp, so edits on different devices merge per field.
// If two devices write at the same instant, the device whose edit got overwritten still has
// it locally with a newer timestamp and simply re-sends it on its next sync.
import { KEY, $ } from './util.js';
import { bus, snapshot, mergeRemote, localNewer } from './store.js';

const SK = KEY + '-sync';
let cfg = {};
try { cfg = JSON.parse(localStorage.getItem(SK) || '{}') || {}; } catch (e) { cfg = {}; }
if (!cfg.mode) cfg.mode = cfg.repo ? 'repo' : 'gist'; // settings saved by older versions used repo mode
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
const parse = txt => { try { return JSON.parse(txt); } catch (e) { throw new Error('雲端檔案不是有效的 JSON'); } };

const API = 'https://api.github.com';
const hdr = x => Object.assign({ 'Authorization': 'Bearer ' + cfg.token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, x || {});
const errMsg = (r, what) => r.status === 401 ? 'Token 無效或已過期'
  : r.status === 403 ? (what === 'gist' ? 'Token 沒有 gist 權限（建立 token 時要勾選 gist）' : 'Token 沒有這個 repo 的讀寫權限')
  : r.status === 404 ? (what === 'gist' ? '找不到 Gist，或 token 沒有 gist 權限' : '找不到這個 repo（名稱打錯，或 token 沒授權它）')
  : r.status === 422 ? '資料格式被 GitHub 拒絕（422）'
  : 'GitHub 回應錯誤 ' + r.status;

/* ---------- backend: secret Gist ---------- */
export const GIST_FILE = 'planner-2026.json';
const GIST_DESC = 'OS Planner 2026 — synced planner data (do not rename the file)';
const gist = {
  async find() {
    if (cfg.gistId) return cfg.gistId;
    // look through this account's gists for the planner file (secret gists included)
    for (let page = 1; page <= 10; page++) {
      const r = await fetch(`${API}/gists?per_page=100&page=${page}`, { headers: hdr(), cache: 'no-store' });
      if (!r.ok) throw new Error(errMsg(r, 'gist'));
      const list = await r.json();
      const g = list.find(x => x.files && x.files[GIST_FILE]);
      if (g) { cfg.gistId = g.id; saveCfg(); return g.id; }
      if (list.length < 100) break;
    }
    return null;
  },
  async pull() {
    const id = await this.find();
    if (!id) return { doc: null };
    const r = await fetch(`${API}/gists/${encodeURIComponent(id)}`, { headers: hdr(), cache: 'no-store' });
    if (r.status === 404) { delete cfg.gistId; saveCfg(); throw new Error('之前的 Gist 不見了（被刪除？），再按一次「立即同步」會重新建立'); }
    if (!r.ok) throw new Error(errMsg(r, 'gist'));
    const j = await r.json();
    const f = j.files && j.files[GIST_FILE];
    if (!f) return { doc: null };
    let txt = f.content;
    if (f.truncated) { // files over 1 MB come truncated in the API response
      const rr = await fetch(f.raw_url, { cache: 'no-store' });
      if (!rr.ok) throw new Error(errMsg(rr, 'gist'));
      txt = await rr.text();
    }
    return { doc: txt ? parse(txt) : null };
  },
  async push() {
    const files = { [GIST_FILE]: { content: JSON.stringify(snapshot()) } };
    if (cfg.gistId) {
      const r = await fetch(`${API}/gists/${encodeURIComponent(cfg.gistId)}`, { method: 'PATCH', headers: hdr({ 'Content-Type': 'application/json' }), body: JSON.stringify({ files }) });
      if (!r.ok) throw new Error(errMsg(r, 'gist'));
      return true;
    }
    const r = await fetch(`${API}/gists`, { method: 'POST', headers: hdr({ 'Content-Type': 'application/json' }), body: JSON.stringify({ description: GIST_DESC, public: false, files }) });
    if (!r.ok) throw new Error(errMsg(r, 'gist'));
    const j = await r.json(); cfg.gistId = j.id; cfg.gistUrl = j.html_url; saveCfg();
    return true;
  },
};

/* ---------- backend: file in a repository ---------- */
const repoUrl = () => `${API}/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}`;
const fileUrl = () => `${repoUrl()}/contents/${(cfg.path || 'planner-2026.json').split('/').filter(Boolean).map(encodeURIComponent).join('/')}`;
const ref = () => cfg.branch ? `?ref=${encodeURIComponent(cfg.branch)}` : '';
const repo = {
  sha: null,
  async pull() {
    const r = await fetch(fileUrl() + ref(), { headers: hdr(), cache: 'no-store' });
    if (r.status === 404) {
      const rr = await fetch(repoUrl(), { headers: hdr(), cache: 'no-store' });
      if (!rr.ok) throw new Error(errMsg(rr, 'repo'));
      this.sha = null; return { doc: null };
    }
    if (!r.ok) throw new Error(errMsg(r, 'repo'));
    const j = await r.json(); this.sha = j.sha;
    let txt;
    if (j.content) txt = b64dec(j.content);
    else {
      const r2 = await fetch(fileUrl() + ref(), { headers: hdr({ 'Accept': 'application/vnd.github.raw' }), cache: 'no-store' });
      if (!r2.ok) throw new Error(errMsg(r2, 'repo'));
      txt = await r2.text();
    }
    return { doc: parse(txt) };
  },
  async push() {
    const body = { message: 'planner sync ' + new Date().toISOString(), content: b64enc(JSON.stringify(snapshot())) };
    if (this.sha) body.sha = this.sha;
    if (cfg.branch) body.branch = cfg.branch;
    const r = await fetch(fileUrl(), { method: 'PUT', headers: hdr({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) });
    if (r.ok) return true;
    if (r.status === 409 || r.status === 422) return false; // another device wrote first → pull, merge, retry
    throw new Error(errMsg(r, 'repo'));
  },
};

const backend = () => cfg.mode === 'repo' ? repo : gist;

export const Sync = {
  busy: false, again: false, timer: null, state: 'off', msg: '',
  on() { return !!cfg.token && (cfg.mode === 'gist' || !!(cfg.owner && cfg.repo)); },

  async run() {
    if (!this.on()) return;
    if (this.busy) { this.again = true; return; }
    this.busy = true; clearTimeout(this.timer); this.set('sync');
    try {
      const B = backend();
      let done = false;
      for (let i = 0; i < 4 && !done; i++) {
        const { doc } = await B.pull();
        mergeRemote(doc);
        if (!localNewer(doc)) { done = true; break; }
        done = await B.push();
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
    showGistInfo();
  },
};

function showGistInfo() {
  const el = $('sGistInfo'); if (!el) return;
  if (cfg.mode === 'gist' && cfg.gistId) {
    const url = cfg.gistUrl || `https://gist.github.com/${cfg.gistId}`;
    el.innerHTML = `已連到 Gist：<a href="${url}" target="_blank" rel="noopener">${cfg.gistId.slice(0, 8)}…</a>`;
  } else el.textContent = '';
}

/* ---------- settings dialog & automatic triggers ---------- */
export function initSync() {
  const dlg = $('syncDlg');
  const setMode = m => {
    dlg.dataset.mode = m;
    dlg.querySelectorAll('[data-smode]').forEach(b => b.classList.toggle('on', b.dataset.smode === m));
  };
  const open = () => {
    $('sToken').value = cfg.token || '';
    $('sOwner').value = cfg.owner || ''; $('sRepo').value = cfg.repo || '';
    $('sPath').value = cfg.path || 'planner-2026.json'; $('sBranch').value = cfg.branch || '';
    setMode(cfg.mode || 'gist');
    dlg.classList.add('show'); Sync.set(Sync.on() ? Sync.state : 'off', Sync.msg);
  };
  dlg.querySelectorAll('[data-smode]').forEach(b => b.onclick = () => setMode(b.dataset.smode));
  $('syncBtn').onclick = open;
  $('sClose').onclick = () => dlg.classList.remove('show');
  dlg.addEventListener('mousedown', e => { if (e.target === dlg) dlg.classList.remove('show'); });
  $('sSave').onclick = () => {
    const v = id => $(id).value.trim();
    const mode = dlg.dataset.mode || 'gist';
    if (!v('sToken')) { $('sMsg').textContent = '⚠ 請貼上 token'; return; }
    if (mode === 'repo' && (!v('sOwner') || !v('sRepo'))) { $('sMsg').textContent = '⚠ 請填寫帳號和 repo 名稱'; return; }
    const keepGist = cfg.mode === 'gist' && cfg.token === v('sToken') ? { gistId: cfg.gistId, gistUrl: cfg.gistUrl } : {};
    cfg = mode === 'gist'
      ? { mode, token: v('sToken'), ...keepGist }
      : { mode, token: v('sToken'), owner: v('sOwner'), repo: v('sRepo'), path: v('sPath') || 'planner-2026.json', branch: v('sBranch') };
    saveCfg(); Sync.run();
  };
  $('sNow').onclick = () => { if (Sync.on()) Sync.run(); else $('sMsg').textContent = '⚠ 還沒設定同步'; };
  $('sOff').onclick = () => {
    if (!confirm('中斷這台裝置的同步？（本機和雲端資料都會保留，token 會從這台裝置移除）')) return;
    cfg = { mode: cfg.mode }; saveCfg(); Sync.set('off'); $('sToken').value = '';
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
