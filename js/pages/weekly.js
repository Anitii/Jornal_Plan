// WEEKLY book: cover, 53 weekly spreads, free notes, personal information.
// The top row of each day is linked to the MONTHLY calendar: it edits the very same
// field (mo-<month>-<day>), so writing in either place shows up in both.
import { Y, WD, pad, addDays, iso, TODAY, WEEKS, weekOf, IN_YEAR, MN } from '../util.js';
import { E } from '../editor.js';
import { WK, MON } from '../nav.js';

export function cover() {
  const L = `<div class="face f-wk"><div class="code">&gt; open weekly.plan --year ${Y}
  link: monthly -&gt; weekly (auto)
  week[53]  mon..sun
  free_note[8p]
&gt; run: plan_the_week_</div>
<div class="big">weekly plan / ${Y}</div><div class="band"></div></div>`;
  const tw = IN_YEAR ? weekOf(new Date()) : 0;
  const items = [
    ['This week', `wk:${WK.week(tw)}`, `W${pad(tw + 1)}`],
    ['Weekly', `wk:${WK.week(0)}`, 'W01 – W53'],
    ['Free note', `wk:${WK.free(0)}`, '8 頁'],
    ['Personal Information', `wk:${WK.info}`, ''],
    ['← Monthly', `mon:${MON.month(IN_YEAR ? new Date().getMonth() : 0)}`, '月計畫本'],
  ];
  const R = `<div class="contents"><h2>WEEKLY</h2><div class="toc">${items.map(([n, g, p]) => `<a data-go="${g}"><span>${n}</span><span>${p}</span></a>`).join('')}</div></div>`;
  return [L, R, 'cover', ''];
}

export function week(i) {
  const mon = WEEKS[i], sun = addDays(mon, 6);
  const col = c => {
    const d = addDays(mon, c), k = iso(d), out = d.getFullYear() !== Y, e = (c === 2 || c === 6) ? ' e' : '';
    return {
      hd: `<div class="hd${e}${k === TODAY ? ' today' : ''}${out ? ' out' : ''}"><span class="lbl">${WD[c]}</span><span class="dd">${pad(d.getMonth() + 1)}.${pad(d.getDate())}</span></div>`,
      link: out ? `<div class="lnk void${e}"></div>`
        : `<div class="lnk${e}" title="連動月計畫 ${d.getMonth() + 1}/${d.getDate()}">${E(`mo-${d.getMonth()}-${d.getDate()}`, 'lined')}</div>`,
      body: `<div class="day${e}${out ? ' out' : ''}">${[0, 1, 2].map(g => `<div class="grp">${E(`wk-${k}-${g}`, 'lined')}</div>`).join('')}</div>`,
    };
  };
  const cs = [...Array(7)].map((_, c) => col(c));
  const rows = 'grid-template-rows:var(--wk-hd) var(--wk-link) var(--wk-body)';
  const L = `<div class="mg wk" style="${rows}">
    <div class="hd"><span class="mtitle">W${pad(i + 1)}<small>${pad(mon.getMonth() + 1)}.${pad(mon.getDate())} – ${pad(sun.getMonth() + 1)}.${pad(sun.getDate())}</small></span></div>${cs[0].hd + cs[1].hd + cs[2].hd}
    <div class="lnk lnk-lbl"><span class="lbl">FROM MONTHLY ↗</span><span class="lnk-sub">和月計畫同步</span></div>${cs[0].link + cs[1].link + cs[2].link}
    <div class="memo">${E(`wk-${iso(mon)}-memo`, '', 'this week')}</div>${cs[0].body + cs[1].body + cs[2].body}</div>`;
  const R = `<div class="mg wk" style="${rows}">${cs[3].hd + cs[4].hd + cs[5].hd + cs[6].hd}${cs[3].link + cs[4].link + cs[5].link + cs[6].link}${cs[3].body + cs[4].body + cs[5].body + cs[6].body}</div>`;
  return [L, R];
}

export const free = i => [E(`fn-${i}-l`, 'dot'), E(`fn-${i}-r`, 'dot')];

export function info() {
  const f = ['NAME', 'PHONE', 'E-MAIL', 'ADDRESS', 'SNS', 'EMERGENCY'];
  const R = `<div class="info"><h2>PERSONAL INFORMATION</h2>${f.map(x => `<div class="f"><span class="lbl">${x}</span>${E(`pi-${x}`, 'one')}</div>`).join('')}<div class="note">資料存在這個瀏覽器裡；開啟上方「☁ 同步」後，會同時存到你的 GitHub 私人 repo，其他裝置連到同一個檔案就能看到。沒開同步的話，換裝置前記得按「匯出備份」。</div></div>`;
  return [E('fn-last', 'dot'), R];
}

export const monthOfWeek = i => { const d = WEEKS[i]; return d.getFullYear() < Y ? 0 : d.getMonth(); };
export { MN };
