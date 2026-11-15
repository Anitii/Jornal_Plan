// Page indices inside each book (used by links like data-go="wk:12").
//   mon: 0 cover · 1 365 timeline · 2 yearly · then [monthly, navigation] × 12
//   wk : 0 cover · 1..53 weeks · 54..57 free notes · 58 personal info
//   dl : 0 cover · 1..365 days
import { Y, addDays, iso } from './util.js';

export const MON = { cover: 0, timeline: 1, yearly: 2, month: m => 3 + 2 * m, nav: m => 4 + 2 * m };
export const WK = { cover: 0, week: i => 1 + i, free: i => 54 + i, info: 58 };
export const DAYS = [];
for (let d = new Date(Y, 0, 1); d.getFullYear() === Y; d = addDays(d, 1)) DAYS.push(iso(d));
export const DL = { cover: 0, day: k => 1 + DAYS.indexOf(k) };
