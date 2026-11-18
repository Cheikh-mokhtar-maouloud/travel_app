// واجهة الزبائن (تطبيق الموبايل)
const path = require('path');
const fs = require('fs');
const express = require('express');
const bcrypt = require('bcryptjs');
const { db, save, nextId, UPLOADS_DIR } = require('../db');
const { sign, auth, STAFF, publicUser } = require('../auth');
const { addDays, nowIso, httpError, required, today } = require('../util');
const S = require('../services');
const amadeus = require('../providers/amadeus');
const { upload, fileRecord } = require('../upload');
const { labels } = require('../i18n');

const r = express.Router();
const lang = (req) => (['fr', 'en'].includes(req.get('x-lang')) ? req.get('x-lang') : 'ar');

// ---------- عام ----------
r.get('/config', (req, res) => {
  const s = db().settings;
  const L = labels(lang(req));
  res.json({
    agencyName: s.agencyName,
    agencyPhone: s.agencyPhone,
    whatsapp: s.whatsapp,
    address: s.address,
    currency: s.currency,
    childPercent: s.childPercent,
    infantPercent: s.infantPercent,
    paymentDeadlineHours: s.paymentDeadlineHours,
    paymentMethods: s.paymentMethods.filter((m) => m.enabled),
    popularDestinations: (s.popularDestinations || []).map((c) => db().airports.find((a) => a.code === c)).filter(Boolean),
    statusLabels: L.status,
    requestLabels: L.request,
    exchangeRates: s.exchangeRates,
    studentDiscountPercent: s.studentDiscountPercent,
    studentMaxAge: s.studentMaxAge,
    points: { enabled: s.pointsEnabled, earnPer: s.pointsEarnPer, pointValue: s.pointValue, minRedeem: s.pointsMinRedeem, maxRedeemPercent: s.pointsMaxRedeemPercent, expiryMonths: s.pointsExpiryMonths },
    referral: { enabled: s.referralEnabled, referrer: s.referralPointsReferrer, referee: s.referralPointsReferee },
    hasPackages: db().packages.some((p) => p.active && p.departDate > today()),
  });
});

r.get('/airports', (_req, res) => res.json(db().airports));

// ---------- الحساب ----------
const normPhone = (p) => String(p || '').replace(/[^\d+]/g, '');

function meView(u) {
  const { passwordHash, totp, ...rest } = u;
  return { ...rest, student: { ...(u.student || { status: 'none' }), status: S.studentStatus(u) } };
}

r.post('/auth/register', (req, res) => {
  required(req.body, ['name', 'phone', 'password']);
  const phone = normPhone(req.body.phone);
  if (phone.length < 8) throw httpError(400, 'رقم الهاتف غير صحيح');
  if (String(req.body.password).length < 6) throw httpError(400, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
  if (db().users.some((u) => u.phone === phone)) throw httpError(409, 'هذا الرقم مسجّل مسبقاً، سجّل الدخول');
  let referredBy = null;
  const code = String(req.body.referralCode || '').trim().toUpperCase();
  if (code) {
    const ref = db().users.find((u) => u.role === 'customer' && u.referralCode === code);
    if (!ref) throw httpError(400, 'رمز الدعوة غير صحيح');
    referredBy = ref.id;
  }
  const user = {
    id: nextId('users'),
    role: 'customer',
    name: String(req.body.name).trim(),
    phone,
    email: req.body.email || '',
    passwordHash: bcrypt.hashSync(String(req.body.password), 10),
    lang: lang(req),
    points: 0,
    travelers: [],
    student: { status: 'none' },
    referredBy,
    createdAt: nowIso(),
  };
  db().users.push(user);
  require('../migrate')(db()); // يولّد رمز الدعوة
  save();
  res.json({ token: sign(user), user: meView(user) });
});

r.post('/auth/login', (req, res) => {
  required(req.body, ['phone', 'password']);
  const phone = normPhone(req.body.phone);
  const u = db().users.find((x) => x.phone === phone && x.role === 'customer');
  if (!u || !bcrypt.compareSync(String(req.body.password), u.passwordHash)) throw httpError(401, 'رقم الهاتف أو كلمة المرور غير صحيحة');
  if (u.disabled) throw httpError(403, 'الحساب موقوف، تواصل مع الوكالة');
  u.lang = lang(req);
  save();
  res.json({ token: sign(u), user: meView(u) });
});

const me = auth(['customer']);

r.get('/me', me, (req, res) => res.json(meView(req.user)));

r.put('/me', me, (req, res) => {
  const u = req.user;
  if (req.body.name) u.name = String(req.body.name).trim();
  if (req.body.email !== undefined) u.email = String(req.body.email).trim();
  if (['ar', 'fr', 'en'].includes(req.body.lang)) u.lang = req.body.lang;
  if (req.body.newPassword) {
    if (!bcrypt.compareSync(String(req.body.currentPassword || ''), u.passwordHash)) throw httpError(400, 'كلمة المرور الحالية غير صحيحة');
    if (String(req.body.newPassword).length < 6) throw httpError(400, 'كلمة المرور الجديدة قصيرة');
    u.passwordHash = bcrypt.hashSync(String(req.body.newPassword), 10);
  }
  save();
  res.json(meView(u));
});

// ---------- النقاط والدعوات ----------
r.get('/me/points', me, (req, res) => {
  const items = db().pointsLedger.filter((p) => p.userId === req.user.id).sort((a, b) => b.id - a.id).slice(0, 200);
  const invited = db().users.filter((u) => u.referredBy === req.user.id).map((u) => ({ name: u.name.split(' ')[0], rewarded: !!u.referralRewarded, at: u.createdAt }));
  res.json({ balance: req.user.points || 0, referralCode: req.user.referralCode, items, invited });
});

// ---------- المسافرون المحفوظون ----------
function travelerFromBody(b) {
  required(b, ['firstName', 'lastName', 'passportNo']);
  return {
    relation: String(b.relation || '').slice(0, 40),
    type: ['adult', 'child', 'infant'].includes(b.type) ? b.type : 'adult',
    gender: b.gender === 'F' ? 'F' : 'M',
    firstName: S.normName(b.firstName),
    lastName: S.normName(b.lastName),
    birthDate: b.birthDate || '',
    nationality: b.nationality || '',
    passportNo: String(b.passportNo).trim().toUpperCase(),
    passportExpiry: b.passportExpiry || '',
  };
}

r.get('/me/travelers', me, (req, res) => res.json(req.user.travelers || []));

r.post('/me/travelers', me, (req, res) => {
  const u = req.user;
  u.travelers = u.travelers || [];
  if (u.travelers.length >= 30) throw httpError(400, 'وصلت للحد الأقصى من المسافرين المحفوظين');
  const t = { id: nextId('travelers'), ...travelerFromBody(req.body) };
  u.travelers.push(t);
  save();
  res.status(201).json(t);
});

r.put('/me/travelers/:id', me, (req, res) => {
  const t = (req.user.travelers || []).find((x) => x.id === Number(req.params.id));
  if (!t) throw httpError(404, 'غير موجود');
  Object.assign(t, travelerFromBody(req.body));
  save();
  res.json(t);
});

r.delete('/me/travelers/:id', me, (req, res) => {
  req.user.travelers = (req.user.travelers || []).filter((x) => x.id !== Number(req.params.id));
  save();
  res.json({ ok: true });
});

// ---------- توثيق الطالب ----------
r.post('/me/student', me, upload.fields([{ name: 'card', maxCount: 1 }, { name: 'certificate', maxCount: 1 }]), (req, res) => {
  const u = req.user;
  const b = req.body;
  required(b, ['firstName', 'lastName', 'birthDate', 'university']);
  if (S.studentStatus(u) === 'verified') throw httpError(409, 'حسابك موثّق كطالب بالفعل');
  const card = req.files && req.files.card && req.files.card[0];
  const cert = req.files && req.files.certificate && req.files.certificate[0];
  if (!card || !cert) throw httpError(400, 'أرفق صورة بطاقة الطالب وشهادة التسجيل');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.birthDate)) throw httpError(400, 'صيغة تاريخ الميلاد 2003-05-20');
  const age = (Date.now() - new Date(b.birthDate).getTime()) / (365.25 * 86400000);
  const max = db().settings.studentMaxAge;
  if (max && age > max) throw httpError(400, `سعر الطالب متاح لمن عمره ${max} سنة أو أقل`);
  u.student = {
    status: 'pending',
    firstName: S.normName(b.firstName),
    lastName: S.normName(b.lastName),
    birthDate: b.birthDate,
    university: String(b.university).trim(),
    studentIdNo: String(b.studentIdNo || '').trim(),
    card: fileRecord(card),
    certificate: fileRecord(cert),
    submittedAt: nowIso(),
  };
  S.audit({ name: u.name, role: 'customer' }, 'student.submit', `أرسل ${u.name} وثائق الطالب`);
  save();
  res.json(meView(u));
});

// ---------- البحث عن الرحلات ----------
function publicFlight(f, pax) {
  const priceFor = (base) => pax.adults * base + pax.children * S.paxPrice(base, 'child') + pax.infants * S.paxPrice(base, 'infant');
  return {
    id: f.id,
    provider: 'local',
    airline: f.airline,
    airlineFr: f.airlineFr || '',
    airlineCode: f.airlineCode,
    flightNo: f.flightNo,
    from: f.from,
    to: f.to,
    departAt: f.departAt,
    arriveAt: f.arriveAt,
    durationMin: f.durationMin,
    stops: f.stops,
    via: f.via,
    seatsLeft: f.seats,
    fares: {
      basic: { ...f.fares.basic, total: priceFor(f.fares.basic.price) },
      flex: { ...f.fares.flex, total: priceFor(f.fares.flex.price) },
    },
  };
}

function amadeusPublic(m) {
  return {
    id: m.id,
    provider: 'amadeus',
    airline: m.airline,
    airlineFr: m.airlineFr,
    airlineCode: m.airlineCode,
    flightNo: m.flightNo,
    from: m.from,
    to: m.to,
    departAt: m.departAt,
    arriveAt: m.arriveAt,
    durationMin: m.durationMin,
    stops: m.stops,
    via: m.via,
    seatsLeft: m.seatsLeft,
    fares: { basic: { price: m.adultPrice, total: m.total, baggage: m.baggage, refundable: false, changeable: false }, flex: null },
  };
}

function findFlights(from, to, date, pax) {
  const need = pax.adults + pax.children;
  const nowLocal = new Date(Date.now() + 2 * 3600 * 1000); // لا تعرض رحلات تقلع خلال ساعتين
  return db()
    .flights.filter((f) => f.active && f.from === from && f.to === to && f.departAt.startsWith(date) && f.seats >= need)
    .filter((f) => new Date(f.departAt) > nowLocal)
    .sort((a, b) => a.fares.basic.price - b.fares.basic.price);
}

async function liveFlights(from, to, date, pax, cabin) {
  if (!amadeus.isReady() || !date) return { list: [], error: null };
  try {
    return { list: (await amadeus.search({ from, to, date, pax, cabin })).map(amadeusPublic), error: null };
  } catch (e) {
    return { list: [], error: e.message };
  }
}

r.get('/flights/search', async (req, res) => {
  const { from, to, date, returnDate, cabin } = req.query;
  if (!from || !to || !date) throw httpError(400, 'حدد المدينة والتاريخ');
  if (from === to) throw httpError(400, 'مدينة المغادرة والوصول متطابقتان');
  const pax = {
    adults: Math.max(1, Number(req.query.adults) || 1),
    children: Math.max(0, Number(req.query.children) || 0),
    infants: Math.max(0, Number(req.query.infants) || 0),
  };
  const [liveOut, liveIn] = await Promise.all([liveFlights(from, to, date, pax, cabin), returnDate ? liveFlights(to, from, returnDate, pax, cabin) : { list: [] }]);
  const outbound = findFlights(from, to, date, pax).map((f) => publicFlight(f, pax)).concat(liveOut.list);
  const inbound = returnDate ? findFlights(to, from, returnDate, pax).map((f) => publicFlight(f, pax)).concat(liveIn.list) : [];
  const dateStrip = [];
  for (let i = -3; i <= 3; i++) {
    const d = addDays(date, i);
    const list = findFlights(from, to, d, pax);
    const live = d === date ? liveOut.list : [];
    const prices = list.map((f) => publicFlight(f, pax).fares.basic.total).concat(live.map((f) => f.fares.basic.total));
    dateStrip.push({ date: d, minPrice: prices.length ? Math.min(...prices) : null });
  }
  res.json({ outbound, inbound, dateStrip, pax, live: amadeus.isReady(), liveError: liveOut.error || liveIn.error || null });
});

// ---------- باقات العمرة والحج ----------
function publicPackage(p) {
  const { demo, ...rest } = p;
  return { ...rest, fromPrice: Math.min(...p.roomPrices.map((x) => x.price)) };
}

r.get('/packages', (_req, res) => {
  res.json(db().packages.filter((p) => p.active && p.departDate > today()).sort((a, b) => a.departDate.localeCompare(b.departDate)).map(publicPackage));
});

r.get('/packages/:id', (req, res) => {
  const p = db().packages.find((x) => x.id === Number(req.params.id) && x.active);
  if (!p) throw httpError(404, 'الباقة غير متاحة');
  res.json(publicPackage(p));
});

// ---------- الحجوزات ----------
function customerBooking(b) {
  const { internalNote, commission, amadeus: am, ...rest } = b;
  return { ...rest, statusLabel: S.STATUS_LABELS[b.status] };
}

r.get('/bookings', me, (req, res) => {
  res.json(db().bookings.filter((b) => b.userId === req.user.id).sort((a, b) => b.id - a.id).map(customerBooking));
});

function ownBooking(req) {
  const b = db().bookings.find((x) => x.id === Number(req.params.id) && x.userId === req.user.id);
  if (!b) throw httpError(404, 'الحجز غير موجود');
  return b;
}

r.get('/bookings/:id', me, (req, res) => res.json(customerBooking(ownBooking(req))));

r.post('/bookings', me, async (req, res) => {
  const b = await S.createBooking(req.user, req.body);
  res.status(201).json(customerBooking(b));
});

// إرسال إثبات الدفع (رقم العملية + صورة الإيصال)
r.post('/bookings/:id/payment', me, upload.single('receipt'), (req, res) => {
  const b = ownBooking(req);
  if (!['awaiting_payment'].includes(b.status)) throw httpError(409, 'لا يمكن إرسال الدفع لهذا الحجز الآن');
  if (!req.body.reference && !req.file) throw httpError(400, 'أدخل رقم العملية أو أرفق صورة الإيصال');
  b.payment = {
    method: b.paymentMethod,
    reference: String(req.body.reference || '').trim(),
    receipt: fileRecord(req.file),
    submittedAt: nowIso(),
    status: 'pending',
  };
  S.setStatus(b, 'payment_review', 'customer', 'أرسل الزبون إثبات الدفع', 'customer');
  save();
  res.json(customerBooking(b));
});

// طلب إلغاء أو تعديل
r.post('/bookings/:id/request', me, (req, res) => {
  const b = ownBooking(req);
  const type = req.body.type === 'change' ? 'change' : 'cancel';
  if (S.CLOSED.includes(b.status)) throw httpError(409, 'الحجز منتهٍ');
  if (b.status === 'awaiting_payment' && type === 'cancel') {
    S.setStatus(b, 'cancelled', 'customer', 'ألغاه الزبون قبل الدفع', 'customer');
    save();
    return res.json(customerBooking(b));
  }
  b.customerRequest = { type, note: String(req.body.note || ''), status: 'open', at: nowIso() };
  b.updatedAt = nowIso();
  addMessage('booking', b.id, req.user, `${type === 'cancel' ? 'طلب إلغاء' : 'طلب تعديل'}: ${req.body.note || '—'}`);
  save();
  res.json(customerBooking(b));
});

// ---------- طلبات التسعيرة ----------
function customerRequest(rq) {
  return { ...rq, statusLabel: S.REQUEST_LABELS[rq.status], fromCity: S.airportCity(rq.from), toCity: S.airportCity(rq.to) };
}

r.get('/requests', me, (req, res) => {
  res.json(db().requests.filter((x) => x.userId === req.user.id).sort((a, b) => b.id - a.id).map(customerRequest));
});

function ownRequest(req) {
  const x = db().requests.find((q) => q.id === Number(req.params.id) && q.userId === req.user.id);
  if (!x) throw httpError(404, 'الطلب غير موجود');
  return x;
}

r.get('/requests/:id', me, (req, res) => res.json(customerRequest(ownRequest(req))));

r.post('/requests', me, (req, res) => {
  required(req.body, ['from', 'to', 'date']);
  const rq = {
    id: nextId('requests'),
    userId: req.user.id,
    customerName: req.user.name,
    customerPhone: req.user.phone,
    tripType: req.body.returnDate ? 'round' : 'oneway',
    from: req.body.from,
    to: req.body.to,
    date: req.body.date,
    returnDate: req.body.returnDate || '',
    adults: Number(req.body.adults) || 1,
    children: Number(req.body.children) || 0,
    infants: Number(req.body.infants) || 0,
    cabin: req.body.cabin || 'economy',
    notes: String(req.body.notes || ''),
    isStudent: S.studentStatus(req.user) === 'verified',
    status: 'new',
    offers: [],
    createdAt: nowIso(),
  };
  db().requests.push(rq);
  save();
  res.status(201).json(customerRequest(rq));
});

r.post('/requests/:id/close', me, (req, res) => {
  const rq = ownRequest(req);
  rq.status = 'closed';
  save();
  res.json(customerRequest(rq));
});

// ---------- المحادثة مع الوكالة ----------
function addMessage(threadType, threadId, user, text) {
  const m = {
    id: nextId('messages'),
    threadType,
    threadId,
    fromStaff: STAFF.includes(user.role),
    senderName: user.name,
    text: String(text).slice(0, 2000),
    createdAt: nowIso(),
    readByCustomer: STAFF.includes(user.role) ? false : true,
    readByStaff: STAFF.includes(user.role),
  };
  db().messages.push(m);
  return m;
}

function threadOwner(type, id, userId) {
  const col = type === 'booking' ? db().bookings : db().requests;
  const t = col.find((x) => x.id === Number(id) && x.userId === userId);
  if (!t) throw httpError(404, 'المحادثة غير موجودة');
  return t;
}

r.get('/threads/:type/:id/messages', me, (req, res) => {
  const { type, id } = req.params;
  threadOwner(type, id, req.user.id);
  const list = db().messages.filter((m) => m.threadType === type && m.threadId === Number(id));
  list.forEach((m) => (m.readByCustomer = true));
  save();
  res.json(list);
});

r.post('/threads/:type/:id/messages', me, (req, res) => {
  const { type, id } = req.params;
  threadOwner(type, id, req.user.id);
  if (!req.body.text || !String(req.body.text).trim()) throw httpError(400, 'اكتب رسالة');
  const m = addMessage(type, Number(id), req.user, req.body.text);
  save();
  res.status(201).json(m);
});

// ---------- الإشعارات ----------
r.get('/notifications', me, (req, res) => {
  const { translate } = require('../i18n');
  const L = lang(req);
  const list = db()
    .notifications.filter((n) => n.userId === req.user.id)
    .sort((a, b) => b.id - a.id)
    .slice(0, 100)
    .map((n) => ({ ...n, title: translate(n.title, L), body: translate(n.body, L) }));
  const unreadMessages = db().messages.filter((m) => m.fromStaff && !m.readByCustomer && isOwnThread(m, req.user.id)).length;
  res.json({ items: list, unread: list.filter((n) => !n.read).length, unreadMessages, points: req.user.points || 0 });
});

function isOwnThread(m, userId) {
  const col = m.threadType === 'booking' ? db().bookings : db().requests;
  return col.some((x) => x.id === m.threadId && x.userId === userId);
}

r.post('/notifications/read', me, (req, res) => {
  db().notifications.filter((n) => n.userId === req.user.id).forEach((n) => (n.read = true));
  save();
  res.json({ ok: true });
});

// ---------- الملفات المحمية (إيصال الدفع، التذكرة، وثائق الطالب) ----------
r.get('/files/:name', auth(), (req, res) => {
  const name = path.basename(req.params.name);
  let rec = null;
  let ownerId = null;
  let fname = name;
  const b = db().bookings.find((x) => (x.payment && x.payment.receipt && x.payment.receipt.name === name) || (x.ticketFile && x.ticketFile.name === name));
  if (b) {
    rec = b.ticketFile && b.ticketFile.name === name ? b.ticketFile : b.payment.receipt;
    ownerId = b.userId;
    fname = b.ref + path.extname(name);
  } else {
    const u = db().users.find((x) => x.student && ((x.student.card && x.student.card.name === name) || (x.student.certificate && x.student.certificate.name === name)));
    if (u) {
      rec = u.student.card && u.student.card.name === name ? u.student.card : u.student.certificate;
      ownerId = u.id;
    }
  }
  if (!rec) {
    const pp = db().platformPayments.find((x) => x.receipt && x.receipt.name === name);
    if (pp) {
      if (!STAFF.includes(req.user.role) && req.user.role !== 'owner') throw httpError(403, 'ليست لديك صلاحية');
      rec = pp.receipt;
      ownerId = -1;
    }
  }
  if (!rec) throw httpError(404, 'الملف غير موجود');
  if (!STAFF.includes(req.user.role) && req.user.role !== 'owner' && ownerId !== req.user.id) throw httpError(403, 'ليست لديك صلاحية');
  if (req.user.role === 'owner' && ownerId !== -1) throw httpError(403, 'ليست لديك صلاحية');
  const full = path.join(UPLOADS_DIR, name);
  if (!fs.existsSync(full)) throw httpError(404, 'الملف غير موجود');
  res.setHeader('Content-Type', rec.mime);
  res.setHeader('Content-Disposition', `inline; filename="${fname}"`);
  res.sendFile(full);
});

module.exports = { router: r, addMessage, customerBooking };
