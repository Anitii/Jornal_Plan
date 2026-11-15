// DAILY LOG book: cover + one spread per day (left: goal / check list / time grid / review, right: free note).
import { Y, WD, pad, dow, parseISO, TODAY, IN_YEAR } from '../util.js';
import { E } from '../editor.js';
import { render as timeGrid } from '../timeblock.js';
import { MON, WK } from '../nav.js';

export function cover() {
  const L = `<div class="face f-dl"><div class="code">&gt; open daily.log --year ${Y}
  date / goal
  check_list[4]  --drag-to--&gt;  time_grid[10min]
  daily_review: keep / problem / try
&gt; _</div><div class="big">daily log / ${Y}</div><div class="band"></div></div>`;
  const R = `<div class="contents"><h2>DAILY LOG</h2><div class="toc">
    <a data-go="dl:today"><span>Today</span><span>${IN_YEAR ? TODAY.replace(/-/g, '.') : '—'}</span></a>
    <a><span>Ⓐ DATE &amp; GOAL</span><span>今天的目標</span></a>
    <a><span>Ⓑ CHECK LIST</span><span>拖曳 ⠿ 到右邊時間表</span></a>
    <a><span>Ⓒ TIME TABLE</span><span>05 – 24 時 · 每格 10 分鐘</span></a>
    <a><span>Ⓓ DAILY REVIEW</span><span>Keep · Problem · Try</span></a>
    <a data-go="mon:${MON.cover}"><span>← Monthly</span><span>月計畫本</span></a>
    <a data-go="wk:${WK.cover}"><span>← Weekly</span><span>週計畫本</span></a></div></div>`;
  return [L, R, 'cover', ''];
}

const CAT = ['Work', 'Life', 'Project', 'Learn'];
export function day(k) {
  const d = parseISO(k), p = 'd-' + k + '-';
  const q = n => {
    let s = `<div><div class="qr h">${E(`${p}q${n}h`, 'one', CAT[n])}</div>`;
    for (let r = 0; r < 6; r++) s += `<div class="qr"><button data-c="${p}q${n}c${r}"></button>${E(`${p}q${n}t${r}`, 'one')}<span class="grip" data-q="${n}" data-date="${k}" title="拖曳到右邊時間表">⠿</span></div>`;
    return s + '</div>';
  };
  const L = `<div class="dl"><div class="lft">
    <div class="head"><div><span class="lbl">DATE</span><span class="dt">${pad(d.getMonth() + 1)}.${pad(d.getDate())}<small>${WD[dow(d)]}</small></span></div><div><span class="lbl">GOAL</span>${E(`${p}goal`, 'one')}</div></div>
    <div class="ql">${q(0)}${q(1)}</div><div class="ql">${q(2)}${q(3)}</div>
    <div class="rev"><span class="lbl">DAILY REVIEW</span>${E(`${p}rev`, 'lined', 'Keep：&#10;Problem：&#10;Try：')}</div>
  </div><div class="tt"><div class="tt-hd"><span class="lbl">TIME TABLE</span><span class="lbl">10 MIN</span></div>${timeGrid(k)}</div></div>`;
  return [L, E(`${p}note`, 'dot')];
}
