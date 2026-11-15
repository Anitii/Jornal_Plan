// Data layer. Every field is a key -> value pair (S), and every key records its
// last-changed time (M) — also for deleted keys — so devices can merge per field.
//
// Events on `bus`:
//   'local'  detail: key       — the user changed a field on this device
//   'remote' detail: [keys]    — fields changed by another device (after a sync)
//   'reset'                    — everything replaced (import)
import { KEY } from './util.js';

export const bus = new EventTarget();
const emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));

const S = {};
const M = {};
try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}') || {}); } catch (e) {}
try { Object.assign(M, JSON.parse(localStorage.getItem(KEY + '-meta') || '{}') || {}); } catch (e) {}
for (const k in S) if (!M[k]) M[k] = 1; // data written before timestamps existed counts as old

let tmr;
export function saveNow() {
  clearTimeout(tmr);
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
    localStorage.setItem(KEY + '-meta', JSON.stringify(M));
  } catch (e) {}
}
const save = () => { clearTimeout(tmr); tmr = setTimeout(saveNow, 250); };

export const get = k => S[k];
export const has = k => k in S;

/** Set (or with a falsy value, delete) a field. */
export function set(k, v) {
  if (v) { if (S[k] === v) return; S[k] = v; }
  else { if (!(k in S)) return; delete S[k]; }
  M[k] = Date.now();
  save();
  emit('local', k);
}

/* ---- JSON helpers for structured values (e.g. time blocks) ---- */
export function getJSON(k, dflt) { try { return S[k] ? JSON.parse(S[k]) : dflt; } catch (e) { return dflt; } }
export function setJSON(k, v) { set(k, v && (!Array.isArray(v) || v.length) ? JSON.stringify(v) : ''); }

/* ---- sync support ---- */
export const snapshot = () => ({ v: 1, updated: Date.now(), data: S, meta: M });

/** Merge a remote document; newer timestamp wins per key. Returns changed keys. */
export function mergeRemote(doc) {
  const ch = [];
  if (!doc) return ch;
  const rd = doc.data || {}, rm = doc.meta || {};
  for (const k in rm) {
    if ((rm[k] || 0) > (M[k] || 0)) {
      if (k in rd) S[k] = rd[k]; else delete S[k];
      M[k] = rm[k];
      ch.push(k);
    }
  }
  for (const k in rd) if (!(k in rm) && !(k in M)) { S[k] = rd[k]; M[k] = 1; ch.push(k); }
  if (ch.length) { saveNow(); emit('remote', ch); }
  return ch;
}
/** Does this device have changes the remote document doesn't? */
export function localNewer(doc) {
  const rm = (doc && doc.meta) || {};
  for (const k in M) if ((M[k] || 0) > (rm[k] || 0)) return true;
  return false;
}

/* ---- backup ---- */
export const exportJSON = () => JSON.stringify(S, null, 1);
export function importAll(o) {
  const nd = (o && o.v === 1 && o.data) ? o.data : o;
  const t = Date.now();
  for (const k in S) if (!(k in nd)) { M[k] = t; delete S[k]; }
  for (const k in nd) { S[k] = nd[k]; M[k] = t; }
  saveNow();
  emit('reset');
  emit('local', '*');
}
