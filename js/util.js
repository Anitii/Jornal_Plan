// Shared constants and small helpers.
export const Y = 2026;
export const KEY = 'osplanner2026';

export const MN = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
export const MS = MN.map(m => m.slice(0, 3));
export const WD = ['MON','TUE','WED','THU','FRI','SAT','SUN'];

// macaron palettes: highlighter backgrounds and text colours
export const HL = [['#fbd3dc','草莓'],['#fde0c5','杏桃'],['#f8efb0','檸檬'],['#cdeedb','薄荷'],['#cfe4f7','天空'],['#e3d7f5','薰衣草']];
export const FC = [['#d97a93','玫瑰'],['#dd925a','杏桃'],['#b99a2c','芥末'],['#4fa585','薄荷'],['#5a8fc8','天空'],['#8e72c6','薰衣草']];

export const pad = n => String(n).padStart(2, '0');
export const dim = m => new Date(Y, m + 1, 0).getDate();
export const dow = d => (d.getDay() + 6) % 7;               // Monday = 0
export const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const parseISO = k => new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10));
export const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export const $ = id => document.getElementById(id);

export const NOW = new Date();
export const TODAY = iso(NOW);
export const IN_YEAR = TODAY.startsWith(String(Y));

// 53 Mondays: the week containing Jan 1 starts on 2025-12-29
export const WEEKS = [...Array(53)].map((_, i) => addDays(new Date(Y - 1, 11, 29), i * 7));
export const weekOf = d => WEEKS.findIndex(w => d >= w && d < addDays(w, 7));

// plain text of a stored rich-text value
export function plain(html) {
  if (!html) return '';
  const t = document.createElement('template');
  t.innerHTML = String(html).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(div|p|h3|blockquote)>/gi, '\n');
  return t.content.textContent.replace(/​/g, '').replace(/\n+/g, ' ').trim();
}
