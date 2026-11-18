// الترجمة: العربية والفرنسية
// t('key')            → النص بلغة التطبيق الحالية
// t('key', { n: 3 })  → يعوّض {n} داخل النص
import STRINGS from './strings';
import EN from './strings_en';

export const i18n = { lang: 'ar' };

export function setI18nLang(lang) {
  i18n.lang = lang === 'fr' || lang === 'en' ? lang : 'ar';
}

export function t(key, params) {
  const entry = STRINGS[key];
  let s = i18n.lang === 'en' ? EN[key] ?? entry?.fr ?? entry?.ar ?? key : entry ? entry[i18n.lang] ?? entry.ar : key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

// ترجمة نص الأمتعة الذي تكتبه الوكالة بالعربية (مثل "حقيبتان 23 كغ")
export const bag = (text) => {
  if (i18n.lang === 'ar' || !text) return text;
  const none = i18n.lang === 'en' ? 'no checked bag' : 'sans bagage';
  return String(text)
    .replace(/حقيبتان\s*(\d+)\s*كغ/g, '2 × $1 kg')
    .replace(/حقيبة\s*(\d+)\s*كغ/g, '1 × $1 kg')
    .replace(/(\d+)\s*حقائب\s*(\d+)\s*كغ/g, '$1 × $2 kg')
    .replace(/كغ/g, 'kg')
    .replace(/بدون أمتعة/g, none);
};

// اختيار الحقل المترجم من بيانات الخادم (مثل title / titleFr)
// الإنجليزية: الحقل الإنجليزي، وإلا الفرنسي (أسماء لاتينية)، وإلا العربي
const has = (v) => (Array.isArray(v) ? v.length > 0 : !!v);
export const loc = (obj, field) => {
  if (!obj) return '';
  if (i18n.lang === 'fr' && has(obj[field + 'Fr'])) return obj[field + 'Fr'];
  if (i18n.lang === 'en') return has(obj[field + 'En']) ? obj[field + 'En'] : has(obj[field + 'Fr']) ? obj[field + 'Fr'] : obj[field];
  return obj[field];
};
