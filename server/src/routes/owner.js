// لوحة مالك التطبيق — منفصلة تماماً عن لوحة الوكالة، ولا يدخلها إلا حساب "owner"
const express = require('express');
const bcrypt = require('bcryptjs');
const { db, save, nextId } = require('../db');
const { sign, auth, publicUser } = require('../auth');
const { nowIso, httpError, required, ymd } = require('../util');
const S = require('../services');
const totp = require('../totp');
const { summary } = require('../commission');

const r = express.Router();

// حماية بسيطة من تخمين كلمة المرور: 5 محاولات خاطئة = قفل 15 دقيقة
const fails = new Map();
function guard(ip) {
  const f = fails.get(ip);
  if (f && f.count >= 5 && Date.now() - f.at < 15 * 60000) throw httpError(429, 'محاولات كثيرة، حاول بعد 15 دقيقة');
}
function fail(ip) {
  const f = fails.get(ip) || { count: 0, at: 0 };
  if (Date.now() - f.at > 15 * 60000) f.count = 0;
  f.count += 1;
  f.at = Date.now();
  fails.set(ip, f);
}

r.post('/login', (req, res) => {
  guard(req.ip);
  required(req.body, ['username', 'password']);
  const u = db().users.find((x) => x.role === 'owner' && x.username === String(req.body.username).trim());
  if (!u || !bcrypt.compareSync(String(req.body.password), u.passwordHash)) {
    fail(req.ip);
    throw httpError(401, 'اسم المستخدم أو كلمة المرور غير صحيحة');
  }
  if (u.totp && u.totp.enabled) {
    if (!req.body.code) return res.json({ needCode: true });
    if (!totp.verify(u.totp.secret, req.body.code)) {
      fail(req.ip);
      throw httpError(401, 'رمز التحقق غير صحيح');
    }
  }
  fails.delete(req.ip);
  S.audit(u, 'owner.login', 'دخول المالك إلى لوحته');
  save();
  res.json({ token: sign(u), user: publicUser(u) });
});

const owner = auth(['owner']);

r.get('/me', owner, (req, res) => res.json(publicUser(req.user)));

r.get('/summary', owner, (req, res) => res.json(summary({ from: req.query.from, to: req.query.to })));

// إحصائيات عامة عن نشاط التطبيق
r.get('/overview', owner, (_req, res) => {
  const d = db();
  const t = ymd(new Date());
  const m = t.slice(0, 7);
  const custs = d.users.filter((u) => u.role === 'customer');
  res.json({
    customers: custs.length,
    customersThisMonth: custs.filter((u) => ymd(new Date(u.createdAt)).startsWith(m)).length,
    students: custs.filter((u) => S.studentStatus(u) === 'verified').length,
    bookingsTotal: d.bookings.length,
    bookingsThisMonth: d.bookings.filter((b) => ymd(new Date(b.createdAt)).startsWith(m)).length,
    ticketsThisMonth: d.bookings.filter((b) => b.status === 'ticketed' && ymd(new Date(b.createdAt)).startsWith(m)).length,
    pointsOutstanding: custs.reduce((a, u) => a + (u.points || 0), 0),
    bySource: ['flights', 'amadeus', 'request', 'package'].map((src) => ({ source: src, count: d.bookings.filter((b) => b.source === src && b.status === 'ticketed').length })),
  });
});

// ---------- الدفعات المستلمة من الوكالة ----------
r.post('/settlements', owner, (req, res) => {
  const amount = Math.round(Number(req.body.amount) || 0);
  if (amount <= 0) throw httpError(400, 'أدخل المبلغ');
  const s = { id: nextId('settlements'), amount, date: req.body.date || ymd(new Date()), method: String(req.body.method || ''), note: String(req.body.note || ''), createdAt: nowIso() };
  db().settlements.push(s);
  S.audit(req.user, 'settlement.add', `سجّل المالك استلام ${amount} من الوكالة (${s.method || '—'})`);
  save();
  res.status(201).json(s);
});

r.delete('/settlements/:id', owner, (req, res) => {
  const s = db().settlements.find((x) => x.id === Number(req.params.id));
  if (!s) throw httpError(404, 'غير موجود');
  db().settlements = db().settlements.filter((x) => x.id !== s.id);
  S.audit(req.user, 'settlement.delete', `حذف المالك دفعة ${s.amount} بتاريخ ${s.date}`);
  save();
  res.json({ ok: true });
});

// ---------- حساباتك لاستلام المستحقات ----------
r.put('/payout-accounts', owner, (req, res) => {
  const list = (req.body.accounts || [])
    .filter((a) => a && String(a.name || '').trim() && String(a.account || '').trim())
    .slice(0, 10)
    .map((a, i) => ({ id: a.id || 'acc' + Date.now().toString(36) + i, name: String(a.name).trim(), account: String(a.account).trim(), holder: String(a.holder || '').trim(), enabled: a.enabled !== false }));
  db().owner.payoutAccounts = list;
  S.audit(req.user, 'owner.accounts', `حدّث المالك حسابات الاستلام (${list.map((a) => a.name).join('، ') || 'لا شيء'})`);
  save();
  res.json(list);
});

r.get('/payout-accounts', owner, (_req, res) => res.json(db().owner.payoutAccounts || []));

// ---------- مراجعة الدفعات التي أرسلتها الوكالة ----------
function findPayment(id) {
  const p = db().platformPayments.find((x) => x.id === Number(id));
  if (!p) throw httpError(404, 'غير موجود');
  if (p.status !== 'pending') throw httpError(409, 'تمت مراجعة هذه الدفعة');
  return p;
}

r.post('/payments/:id/approve', owner, (req, res) => {
  const p = findPayment(req.params.id);
  const amount = Math.round(Number(req.body.amount) || p.amount); // يمكن تصحيح المبلغ إن وصل مبلغ مختلف
  const s = { id: nextId('settlements'), amount, date: ymd(new Date()), method: p.method, note: `دفعة من الوكالة #${p.id}${p.reference ? ' — ' + p.reference : ''}`, paymentId: p.id, createdAt: nowIso() };
  db().settlements.push(s);
  Object.assign(p, { status: 'approved', approvedAmount: amount, reviewedAt: nowIso() });
  S.audit(req.user, 'payment.approve', `أكّد المالك استلام ${amount} من الوكالة (دفعة #${p.id})`);
  save();
  res.json(p);
});

r.post('/payments/:id/reject', owner, (req, res) => {
  const p = findPayment(req.params.id);
  const reason = String(req.body.reason || 'لم يصل المبلغ');
  Object.assign(p, { status: 'rejected', reason, reviewedAt: nowIso() });
  S.audit(req.user, 'payment.reject', `رفض المالك دفعة الوكالة #${p.id} (${p.amount}): ${reason}`);
  save();
  res.json(p);
});

// ---------- نسبة العمولة ----------
r.put('/commission', owner, (req, res) => {
  const p = Number(req.body.percent);
  if (!(p >= 0 && p <= 50)) throw httpError(400, 'النسبة بين 0 و 50');
  const old = db().owner.commissionPercent;
  db().owner.commissionPercent = p;
  S.audit(req.user, 'commission.percent', `غيّر المالك نسبة العمولة من ${old}% إلى ${p}% (للحجوزات الجديدة فقط)`);
  save();
  res.json({ percent: p });
});

// ---------- سجل العمليات ----------
r.get('/audit', owner, (req, res) => {
  const q = String(req.query.q || '');
  const action = String(req.query.action || '');
  let list = db().audit.slice().reverse();
  if (action) list = list.filter((a) => a.action.startsWith(action));
  if (q) list = list.filter((a) => a.text.includes(q) || a.actor.includes(q));
  res.json(list.slice(0, 500));
});

// ---------- الأمان ----------
r.put('/password', owner, (req, res) => {
  if (!bcrypt.compareSync(String(req.body.currentPassword || ''), req.user.passwordHash)) throw httpError(400, 'كلمة المرور الحالية غير صحيحة');
  if (String(req.body.newPassword || '').length < 10) throw httpError(400, 'كلمة مرور المالك يجب أن تكون 10 أحرف على الأقل');
  req.user.passwordHash = bcrypt.hashSync(String(req.body.newPassword), 10);
  S.audit(req.user, 'owner.password', 'غيّر المالك كلمة المرور');
  save();
  res.json({ ok: true });
});

r.post('/2fa/setup', owner, (req, res) => {
  const secret = totp.newSecret();
  req.user.totp = { secret, enabled: false };
  save();
  res.json({ secret, uri: totp.uri(secret, req.user.username, db().settings.agencyName || 'TravelApp') });
});

r.post('/2fa/enable', owner, (req, res) => {
  const t = req.user.totp;
  if (!t || !t.secret) throw httpError(400, 'ابدأ الإعداد أولاً');
  if (!totp.verify(t.secret, req.body.code)) throw httpError(400, 'الرمز غير صحيح، تأكد من وقت الهاتف وحاول مجدداً');
  t.enabled = true;
  S.audit(req.user, 'owner.2fa', 'فعّل المالك التحقق الثنائي');
  save();
  res.json({ ok: true });
});

r.post('/2fa/disable', owner, (req, res) => {
  const t = req.user.totp;
  if (!t || !t.enabled) throw httpError(400, 'التحقق الثنائي غير مفعّل');
  if (!totp.verify(t.secret, req.body.code)) throw httpError(400, 'الرمز غير صحيح');
  req.user.totp = null;
  S.audit(req.user, 'owner.2fa', 'أوقف المالك التحقق الثنائي');
  save();
  res.json({ ok: true });
});

module.exports = r;
