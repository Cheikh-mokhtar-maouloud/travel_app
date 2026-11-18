import { I18nManager, StyleSheet } from 'react-native';
import { i18n } from './i18n';

export const colors = {
  bg: '#F4F1EA',
  card: '#FFFFFF',
  ink: '#13202B',
  muted: '#5B6670',
  line: '#E2DCCE',
  lineStrong: '#D6CFBF',
  accent: '#0E6B4F',
  accentDark: '#0A4F3A',
  accentSoft: '#E6F2EC',
  gold: '#C9962B',
  goldSoft: '#F6EAD0',
  goldInk: '#6B4A0C',
  danger: '#A83224',
  dangerSoft: '#FBEAE7',
  info: '#1D4E89',
  infoSoft: '#E5EDF7',
  purple: '#3B2F8F',
  purpleSoft: '#ECEBF8',
};

// ── اتجاه الواجهة ──────────────────────────────────────────────
// العربية: من اليمين لليسار. الفرنسية: من اليسار لليمين.
// يعمل مهما كانت لغة الهاتف، لأن React Native يعكس الاتجاه تلقائياً إذا كان الهاتف بالعربية.
// كل الشاشات تقرأ القيم من الكائن dir وقت الرسم، لذلك يتغير كل شيء فور تغيير اللغة.
const sysRTL = !!I18nManager.isRTL; // قد تكون undefined في بعض المنصات
export const dir = { rtl: true, row: 'row', start: 'left', aStart: 'flex-start', aEnd: 'flex-end', wd: 'rtl', back: 'chevron-forward', fwd: 'chevron-back', arrow: '←' };

export function applyDirection(lang) {
  const rtl = lang !== 'fr' && lang !== 'en';
  const flip = rtl !== sysRTL;
  const visualRight = { text: sysRTL ? 'left' : 'right', align: sysRTL ? 'flex-start' : 'flex-end' };
  const visualLeft = { text: sysRTL ? 'right' : 'left', align: sysRTL ? 'flex-end' : 'flex-start' };
  const st = rtl ? visualRight : visualLeft;
  const en = rtl ? visualLeft : visualRight;
  Object.assign(dir, {
    rtl,
    flip,
    row: flip ? 'row-reverse' : 'row',
    start: st.text,
    aStart: st.align,
    aEnd: en.align,
    wd: rtl ? 'rtl' : 'ltr',
    back: rtl ? 'chevron-forward' : 'chevron-back',
    fwd: rtl ? 'chevron-back' : 'chevron-forward',
    arrow: rtl ? '←' : '→',
  });
}
// موضع مطلق على "نهاية" السطر (يسار في العربية، يمين في الفرنسية)
export const posEnd = (v) => {
  const physicalLeft = dir.rtl;
  const key = physicalLeft ? (sysRTL ? 'right' : 'left') : sysRTL ? 'left' : 'right';
  return { [key]: v };
};
applyDirection('ar');

export const statusColors = {
  awaiting_payment: [colors.goldSoft, colors.goldInk],
  payment_review: [colors.infoSoft, colors.info],
  confirmed: ['#FFF0D6', '#7A4A00'],
  ticketed: [colors.accentSoft, colors.accent],
  cancelled: ['#ECECEC', '#4A4A4A'],
  expired: ['#ECECEC', '#4A4A4A'],
  refunded: ['#ECECEC', '#4A4A4A'],
  new: [colors.goldSoft, colors.goldInk],
  quoted: [colors.infoSoft, colors.info],
  accepted: [colors.accentSoft, colors.accent],
  closed: ['#ECECEC', '#4A4A4A'],
  pending: [colors.goldSoft, colors.goldInk],
  verified: [colors.accentSoft, colors.accent],
  rejected: [colors.dangerSoft, colors.danger],
  none: ['#ECECEC', '#4A4A4A'],
};

export const s = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    shadowColor: '#13202B',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
});

// ── تنسيقات ───────────────────────────────────────────────────
const MONTHS = {
  ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
const DAYS = {
  ar: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
  fr: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};
const L = () => i18n.lang;

export const money = (n, currency = '') => `${Number(n || 0).toLocaleString('en-US')} ${currency}`.trim();
export const hm = (local) => (local ? local.slice(11, 16) : '');
export const parseYmd = (str) => {
  const [y, m, d] = str.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const addDays = (str, n) => {
  const d = parseYmd(str);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
export const monthName = (i) => MONTHS[L()][i];
export const dayName = (str) => DAYS[L()][parseYmd(str).getDay()];
export const shortDate = (str) => {
  if (!str) return '';
  const d = parseYmd(str);
  return `${d.getDate()} ${MONTHS[L()][d.getMonth()]}`;
};
export const longDate = (str) => (str ? `${dayName(str)} ${shortDate(str)}` : '');
export const fullDate = (str) => (str ? `${shortDate(str)} ${parseYmd(str).getFullYear()}` : '');
export const duration = (min) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (L() === 'fr') return `${h} h ${String(m).padStart(2, '0')}`;
  if (L() === 'en') return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${h} س ${m} د`;
};
export const fromNow = (iso) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 60000;
  const W = {
    ar: ['الآن', (n) => `منذ ${n} دقيقة`, (n) => `منذ ${n} ساعة`, (n) => `منذ ${n} يوم`],
    fr: ["à l'instant", (n) => `il y a ${n} min`, (n) => `il y a ${n} h`, (n) => `il y a ${n} j`],
    en: ['just now', (n) => `${n} min ago`, (n) => `${n} h ago`, (n) => `${n} d ago`],
  }[L()];
  if (diff < 1) return W[0];
  if (diff < 60) return W[1](Math.floor(diff));
  if (diff < 1440) return W[2](Math.floor(diff / 60));
  return W[3](Math.floor(diff / 1440));
};
export const dateTime = (iso) => {
  const d = new Date(iso);
  return `${ymd(d).split('-').reverse().join('/')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
