// MONTHLY book: cover/contents, 365 timeline, yearly, monthly calendar, monthly navigation + review.
// Each renderer returns [leftHTML, rightHTML, leftExtraClass?, rightExtraClass?].
import { Y, MN, MS, WD, pad, dim, dow, iso, TODAY } from '../util.js';
import { E } from '../editor.js';
import { MON, WK } from '../nav.js';

export function cover() {
  const L = `<div class="face f-mw"><div class="code">&gt; boot --user me --year ${Y}
&gt; load monthly.plan
  [ok] 365_timeline  [ok] yearly
  [ok] monthly x12   [ok] navigation x12
&gt; run: goal -&gt; plan -&gt; execute -&gt; review_</div>
<div class="big">monthly plan / ${Y}</div><div class="band"></div></div>`;
  const items = [
    ['365 Timeline', `mon:${MON.timeline}`, '年度時間軸'],
    ['Yearly', `mon:${MON.yearly}`, '每月目標（螢光筆自動帶入）'],
    ['Monthly + Navigation', `mon:${MON.month(0)}`, '12 個月'],
    ['Weekly →', `wk:${WK.week(0)}`, '週計畫本'],
    ['Free note →', `wk:${WK.free(0)}`, '週計畫本'],
    ['Daily log →', 'dl:today', '日誌本'],
  ];
  const R = `<div class="contents"><h2>CONTENTS</h2><div class="toc">${items.map(([n, g, p]) => `<a data-go="${g}"><span>${n}</span><span>${p}</span></a>`).join('')}</div></div>`;
  return [L, R, 'cover', ''];
}

export function timeline() {
  const half = h => {
    let s = ''; for (let k = 0; k < 6; k++) s += `<div class="hd"><span class="lbl">${MS[h * 6 + k]}</span></div>`;
    for (let d = 1; d <= 31; d++) for (let k = 0; k < 6; k++) {
      const m = h * 6 + k;
      if (d > dim(m)) { s += '<div></div>'; continue; }
      const dt = new Date(Y, m, d), w = dow(dt);
      s += `<div class="${w > 4 ? 'we' : ''}${iso(dt) === TODAY ? ' td' : ''}" title="${Y}.${pad(m + 1)}.${pad(d)} ${WD[w]}"><i>${d}</i>${E(`tl-${m}-${d}`, 'one')}</div>`;
    }
    return `<div class="tl">${s}</div>`;
  };
  return [half(0), half(1)];
}

export function yearly() {
  const cell = m => `<div><span class="lbl">${MS[m]}</span>${E(`yr-${m}`, 'lined')}</div>`;
  return [`<div class="yr">${[0, 1, 2, 6, 7, 8].map(cell).join('')}</div>`, `<div class="yr">${[3, 4, 5, 9, 10, 11].map(cell).join('')}</div>`];
}

export function month(m) {
  const off = dow(new Date(Y, m, 1)), n = dim(m), rows = Math.ceil((off + n) / 7);
  const cells = cols => {
    let s = '';
    for (let r = 0; r < rows; r++) for (const c of cols) {
      const d = r * 7 + c - off + 1, e = (c === 2 || c === 6) ? ' e' : '';
      if (d < 1 || d > n) { s += `<div class="day void${e}"></div>`; continue; }
      const t = iso(new Date(Y, m, d)) === TODAY;
      s += `<div class="day${e}${t ? ' today' : ''}"><div class="dn"><b>${d}</b></div>${E(`mo-${m}-${d}`)}</div>`;
    }
    return s;
  };
  const st = `grid-template-rows:26px repeat(${rows},1fr)`;
  const L = `<div class="mg" style="${st}"><div class="hd"><span class="mtitle">${pad(m + 1)}<small>${MN[m]} ${Y}</small></span></div>${[0, 1, 2].map(c => `<div class="hd${c === 2 ? ' e' : ''}"><span class="lbl">${WD[c]}</span></div>`).join('')}<div class="memo">${E(`mo-${m}-memo`, '', 'to-do / memo')}</div>${cells([0, 1, 2])}</div>`;
  const R = `<div class="mg" style="${st}">${[3, 4, 5, 6].map(c => `<div class="hd${c === 6 ? ' e' : ''}"><span class="lbl">${WD[c]}</span></div>`).join('')}${cells([3, 4, 5, 6])}</div>`;
  return [L, R];
}

const REV = ['這個月值得感謝的 3 件事。', '這個月的計畫中，順利完成的事和留下遺憾的事是什麼？', '這個月有沒有預料之外的變化，或新發現的事？'];
const NXT = ['這個月做得好的事情中，下個月也想持續下去的是什麼？', '為了不再重複這個月的遺憾，下個月要改變什麼？', '訂下下個月最想達成的目標，並排出該做事項的優先順序。'];
export function nav(m) {
  const n = dim(m);
  const blk = b => {
    let nums = '', cells = '';
    for (let d = 1; d <= 31; d++) { nums += `<div>${d}</div>`; cells += d <= n ? `<div data-t="nv-${m}-${b}-${d}"></div>` : '<div class="na"></div>'; }
    return `<div class="blk" data-blk="nv-${m}-${b}">
      <div class="row"><div><span class="lbl">MAIN GOAL :</span>${E(`nv-${m}-${b}-goal`, 'one')}</div><div><span class="lbl">ROUTINE :</span>${E(`nv-${m}-${b}-rt`, 'one')}</div></div>
      <div class="row"><div><span class="lbl">TOOLS / PREPARATION :</span>${E(`nv-${m}-${b}-tool`, 'one')}</div><div><span class="lbl">BACKUP ACTION :</span>${E(`nv-${m}-${b}-bk`, 'one')}</div></div>
      <div class="trk">${nums}<div>TOTAL</div></div><div class="trk cells">${cells}<div class="tot">0</div></div></div>`;
  };
  const L = `<div class="nv"><div class="top"><span class="lbl">MONTHLY NAVIGATION</span><span class="lbl" style="color:#6f6a62">${pad(m + 1)} · ${MN[m]}</span></div>${[0, 1, 2, 3].map(blk).join('')}</div>`;
  let r = `<div class="hdr"><span class="lbl">REVIEW</span></div><div class="hdr"><span class="lbl">NEXT STEPS</span></div>`;
  for (let i = 0; i < 3; i++) r += `<div><div class="q">${REV[i]}</div>${E(`rv-${m}-r${i}`, 'lined')}</div><div><div class="q">${NXT[i]}</div>${E(`rv-${m}-n${i}`, 'lined')}</div>`;
  return [L, `<div class="rv">${r}</div>`];
}
