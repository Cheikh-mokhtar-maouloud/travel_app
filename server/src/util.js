// دوال مساعدة عامة
const crypto = require('crypto');

const pad = (n) => String(n).padStart(2, '0');

// التواريخ تُخزَّن كنص محلي "YYYY-MM-DDTHH:mm" بتوقيت المطار (كما تُكتب على التذكرة)
function ymd(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return ymd(dt);
}

function addMinutesLocal(localStr, minutes) {
  const [date, time] = localStr.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const dt = new Date(y, m - 1, d, hh, mm + minutes);
  return `${ymd(dt)}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

function minutesBetween(a, b) {
  const toDate = (s) => {
    const [date, time] = s.split('T');
    const [y, m, d] = date.split('-').map(Number);
    const [hh, mm] = time.split(':').map(Number);
    return new Date(y, m - 1, d, hh, mm);
  };
  return Math.round((toDate(b) - toDate(a)) / 60000);
}

function today() {
  return ymd(new Date());
}

// رمز حجز مثل TR7K2QXM (بدون أحرف مربكة مثل O و 0 و I و 1)
function refCode(prefix = 'TR') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) s += chars[bytes[i] % chars.length];
  return prefix + s;
}

function nowIso() {
  return new Date().toISOString();
}

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function required(obj, fields) {
  for (const f of fields) {
    if (obj[f] === undefined || obj[f] === null || String(obj[f]).trim() === '') {
      throw httpError(400, `الحقل مطلوب: ${f}`);
    }
  }
}

module.exports = { ymd, addDays, addMinutesLocal, minutesBetween, today, refCode, nowIso, httpError, required, pad };
