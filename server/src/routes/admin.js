// واجهة لوحة تحكم الوكالة (المدير والموظفون)
const express = require('express');
const bcrypt = require('bcryptjs');
const { db, save, nextId } = require('../db');
const { sign, auth, STAFF, publicUser } = require('../auth');
const { nowIso, httpError, required, minutesBetween, addDays, ymd, today } = require('../util');
const S = require('../services');
const amadeus = require('../providers/amadeus');
const { summary } = require('../commission');
const { upload, fileRecord } = require('../upload');
const { addMessage } = require('./api');

const r = express.Router();

r.post('/login', (req, res) => {
  required(req.body, ['username', 'password']);
  const u = db().users.find((x) => STAFF.includes(x.role) && x.username === String(req.body.username).trim());
  if (!u || !bcrypt.compareSync(String(req.body.password), u.passwordHash)) throw httpError(401, 'اسم المستخدم أو كلمة المرور غير صحيحة');
  if (u.disabled) throw httpError(403, 'الحساب موقوف');
  res.json({ token: sign(u), user: publicUser(u) });
});

const staff = auth(STAFF);
const adminOnly = auth(['admin']);

r.get('/me', staff, (req, res) => res.json(publicUser(req.user)));

r.put('/me/password', staff, (req, res) => {
  if (!bcrypt.compareSync(String(req.body.currentPassword || ''), req.user.passwordHash)) throw httpError(400, 'كلمة المرور الحالية غير صحيحة');
  if (String(req.body.newPassword || '').length < 6) throw httpError(400, 'كلمة المرور الجديدة قصيرة (6 أحرف على الأقل)');
  req.user.passwordHash = bcrypt.hashSync(String(req.body.newPassword), 10);
  save();
  res.json({ ok: true });
});

// ---------- الإحصائيات ----------
r.get('/stats', staff, (_req, res) => {
  const d = db();
  const t = ymd(new Date());
  const monthPrefix = t.slice(0, 7);
  const paid = ['confirmed', 'ticketed'];
  const unreadByThread = {};
  d.messages.filter((m) => !m.fromStaff && !m.readByStaff).forEach((m) => {
    const k = m.threadType + ':' + m.threadId;
    unreadByThread[k] = (unreadByThread[k] || 0) + 1;
  });
  const inMonth = (b) => ymd(new Date(b.createdAt)).startsWith(monthPrefix);
  res.json({
    awaitingPayment: d.bookings.filter((b) => b.status === 'awaiting_payment').length,
    paymentReview: d.bookings.filter((b) => b.status === 'payment_review').length,
    toIssue: d.bookings.filter((b) => b.status === 'confirmed').length,
    openCustomerRequests: d.bookings.filter((b) => b.customerRequest && b.customerRequest.status === 'open').length,
    newQuoteRequests: d.requests.filter((x) => x.status === 'new').length,
    pendingStudents: d.users.filter((u) => u.role === 'customer' && u.student && u.student.status === 'pending').length,
    todayBookings: d.bookings.filter((b) => ymd(new Date(b.createdAt)) === t).length,
    monthRevenue: d.bookings.filter((b) => paid.includes(b.status) && inMonth(b)).reduce((s, b) => s + b.total, 0),
    monthTickets: d.bookings.filter((b) => b.status === 'ticketed' && inMonth(b)).length,
    monthCommission: d.bookings.filter((b) => b.commission.status === 'earned' && inMonth(b)).reduce((s, b) => s + b.commission.amount, 0),
    customers: d.users.filter((u) => u.role === 'customer').length,
    unreadMessages: Object.values(unreadByThread).reduce((a, b) => a + b, 0),
    unreadByThread,
    amadeus: amadeus.isReady(),
    platformRejected: d.platformPayments.filter((p) => p.status === 'rejected' && !p.seenByAgency).length,
  });
});

// ---------- الحجوزات ----------
function withLabels(b) {
  const unread = db().messages.filter((m) => m.threadType === 'booking' && m.threadId === b.id && !m.fromStaff && !m.readByStaff).length;
  const u = db().users.find((x) => x.id === b.userId);
  return { ...b, statusLabel: S.STATUS_LABELS[b.status], unread, customerPhone: u ? u.phone : '', commissionLabel: S.COMMISSION_LABELS[b.commission.status] };
}

function findBooking(id) {
  const b = db().bookings.find((x) => x.id === Number(id));
  if (!b) throw httpError(404, 'الحجز غير موجود');
  return b;
}

r.get('/bookings', staff, (req, res) => {
  const { status, q, source } = req.query;
  let list = db().bookings.slice().sort((a, b) => b.id - a.id);
  if (status === 'open_requests') list = list.filter((b) => b.customerRequest && b.customerRequest.status === 'open');
  else if (status) list = list.filter((b) => b.status === status);
  if (source) list = list.filter((b) => b.source === source);
  if (req.query.requestId) list = list.filter((b) => b.requestId === Number(req.query.requestId));
  if (q) {
    const s = String(q).toUpperCase();
    list = list.filter((b) => b.ref.includes(s) || (b.pnr || '').toUpperCase().includes(s) || b.customerName.toUpperCase().includes(s) || (b.contactPhone || '').includes(s) || b.passengers.some((p) => (p.firstName + ' ' + p.lastName).includes(s) || p.passportNo.includes(s)));
  }
  res.json(list.map(withLabels));
});

r.get('/bookings/:id', staff, (req, res) => res.json(withLabels(findBooking(req.params.id))));

// تعديل بيانات الإصدار: PNR، أرقام التذاكر، ملاحظة داخلية، الحالة
r.put('/bookings/:id', staff, (req, res) => {
  const b = findBooking(req.params.id);
  if (req.body.pnr !== undefined) {
    const pnr = String(req.body.pnr).trim().toUpperCase();
    if (pnr !== b.pnr) S.audit(req.user, 'booking.pnr', `${b.ref}: PNR ${b.pnr || '—'} ← ${pnr || '—'}`, { bookingId: b.id });
    b.pnr = pnr;
  }
  if (Array.isArray(req.body.ticketNumbers)) req.body.ticketNumbers.forEach((t, i) => b.passengers[i] && (b.passengers[i].ticketNumber = String(t || '').trim()));
  if (req.body.internalNote !== undefined) b.internalNote = String(req.body.internalNote);
  if (req.body.status && req.body.status !== b.status) {
    if (!S.STATUS_LABELS[req.body.status]) throw httpError(400, 'حالة غير صحيحة');
    if (req.body.status === 'ticketed' && !b.pnr) throw httpError(400, 'أدخل رقم الحجز PNR قبل تعيين الحالة "تم الإصدار"');
    if (['cancelled', 'refunded'].includes(req.body.status) && ['confirmed', 'ticketed'].includes(b.status) && !String(req.body.statusNote || '').trim()) {
      throw httpError(400, 'اكتب سبب الإلغاء أو الاسترجاع (يُسجَّل في السجل ويصل للزبون)');
    }
    S.setStatus(b, req.body.status, req.user.name, req.body.statusNote || '', req.user.role);
  }
  if (req.body.customerRequestStatus && b.customerRequest) b.customerRequest.status = req.body.customerRequestStatus;
  b.updatedAt = nowIso();
  save();
  res.json(withLabels(b));
});

r.post('/bookings/:id/payment/approve', staff, (req, res) => {
  const b = findBooking(req.params.id);
  if (!['payment_review', 'awaiting_payment'].includes(b.status)) throw httpError(409, 'لا يوجد دفع للتأكيد');
  b.payment = { ...(b.payment || { method: b.paymentMethod, submittedAt: nowIso() }), status: 'approved', reviewedBy: req.user.name, reviewedAt: nowIso() };
  S.setStatus(b, 'confirmed', req.user.name, 'تم تأكيد الدفع', req.user.role);
  save();
  S.amadeusAfterPayment(b); // إصدار/متابعة آلية في الخلفية إن كان الحجز من Amadeus
  res.json(withLabels(b));
});

r.post('/bookings/:id/payment/reject', staff, (req, res) => {
  const b = findBooking(req.params.id);
  if (b.status !== 'payment_review') throw httpError(409, 'لا يوجد دفع قيد المراجعة');
  const reason = String(req.body.reason || 'لم نتمكن من التحقق من الدفع');
  b.payment = { ...b.payment, status: 'rejected', reason, reviewedBy: req.user.name, reviewedAt: nowIso() };
  b.paymentDeadline = new Date(Date.now() + db().settings.paymentDeadlineHours * 3600 * 1000).toISOString();
  S.setStatus(b, 'awaiting_payment', req.user.name, `رُفض إثبات الدفع: ${reason}. يرجى إعادة الإرسال.`, req.user.role);
  save();
  res.json(withLabels(b));
});

// رفع ملف التذكرة PDF وتعيين الحالة "تم الإصدار"
r.post('/bookings/:id/ticket', staff, upload.single('file'), (req, res) => {
  const b = findBooking(req.params.id);
  if (!req.file) throw httpError(400, 'اختر ملف التذكرة');
  b.ticketFile = fileRecord(req.file);
  if (req.body.pnr) b.pnr = String(req.body.pnr).trim().toUpperCase();
  if (!b.pnr) throw httpError(400, 'أدخل رقم الحجز PNR');
  if (b.status !== 'ticketed') S.setStatus(b, 'ticketed', req.user.name, 'تم رفع التذكرة', req.user.role);
  else S.notify(b.userId, `حجز ${b.ref}: تم تحديث التذكرة`, 'تم رفع نسخة جديدة من تذكرتك.', { type: 'booking', id: b.id });
  save();
  res.json(withLabels(b));
});

// مزامنة يدوية مع Amadeus (جلب PNR وأرقام التذاكر)
r.post('/bookings/:id/amadeus/sync', staff, async (req, res) => {
  const b = findBooking(req.params.id);
  if (!b.amadeus || !b.amadeus.orders) throw httpError(400, 'هذا الحجز ليس من Amadeus');
  if (!amadeus.isReady()) throw httpError(400, 'Amadeus غير مفعّل في الإعدادات');
  try {
    await S.syncAmadeus(b);
  } catch (e) {
    b.amadeus.lastError = e.message;
    save();
    throw httpError(e.status || 502, e.message);
  }
  res.json(withLabels(b));
});

// ---------- طلبات التسعيرة ----------
function reqView(x) {
  const unread = db().messages.filter((m) => m.threadType === 'request' && m.threadId === x.id && !m.fromStaff && !m.readByStaff).length;
  return { ...x, statusLabel: S.REQUEST_LABELS[x.status], fromCity: S.airportCity(x.from), toCity: S.airportCity(x.to), unread };
}

function findRequest(id) {
  const x = db().requests.find((q) => q.id === Number(id));
  if (!x) throw httpError(404, 'الطلب غير موجود');
  return x;
}

r.get('/requests', staff, (req, res) => {
  let list = db().requests.slice().sort((a, b) => b.id - a.id);
  if (req.query.status) list = list.filter((x) => x.status === req.query.status);
  res.json(list.map(reqView));
});

r.get('/requests/:id', staff, (req, res) => res.json(reqView(findRequest(req.params.id))));

function segmentFromInput(s) {
  required(s, ['flightNo', 'from', 'to', 'departAt', 'arriveAt']);
  return {
    airline: s.airline || '',
    airlineCode: s.airlineCode || '',
    flightNo: String(s.flightNo).toUpperCase(),
    from: String(s.from).toUpperCase(),
    to: String(s.to).toUpperCase(),
    fromCity: S.airportCity(String(s.from).toUpperCase()),
    toCity: S.airportCity(String(s.to).toUpperCase()),
    departAt: s.departAt,
    arriveAt: s.arriveAt,
    durationMin: Number(s.durationMin) || Math.max(0, minutesBetween(s.departAt, s.arriveAt)),
    stops: Number(s.stops) || 0,
    via: s.via || '',
    baggage: s.baggage || '',
  };
}

r.post('/requests/:id/offers', staff, (req, res) => {
  const x = findRequest(req.params.id);
  required(req.body, ['airline', 'totalPrice']);
  const segments = (req.body.segments || []).filter(Boolean).map((s) => segmentFromInput({ ...s, airline: req.body.airline, airlineCode: req.body.airlineCode, baggage: req.body.baggage }));
  if (!segments.length) throw httpError(400, 'أضف رحلة الذهاب على الأقل');
  const offer = {
    id: nextId('offers'),
    airline: req.body.airline,
    airlineCode: req.body.airlineCode || '',
    segments,
    baggage: req.body.baggage || '',
    conditions: req.body.conditions || '',
    totalPrice: Number(req.body.totalPrice),
    validUntil: req.body.validUntil || '',
    createdBy: req.user.name,
    createdAt: nowIso(),
  };
  x.offers.push(offer);
  if (x.status === 'new') x.status = 'quoted';
  S.notify(x.userId, 'وصلك عرض جديد', `عرض ${offer.airline} بسعر ${offer.totalPrice.toLocaleString('en')} ${db().settings.currency} لرحلتك إلى ${S.airportCity(x.to)}.`, { type: 'request', id: x.id });
  save();
  res.status(201).json(reqView(x));
});

r.delete('/requests/:id/offers/:offerId', staff, (req, res) => {
  const x = findRequest(req.params.id);
  x.offers = x.offers.filter((o) => o.id !== Number(req.params.offerId));
  if (!x.offers.length && x.status === 'quoted') x.status = 'new';
  save();
  res.json(reqView(x));
});

r.put('/requests/:id', staff, (req, res) => {
  const x = findRequest(req.params.id);
  if (req.body.status && S.REQUEST_LABELS[req.body.status]) x.status = req.body.status;
  save();
  res.json(reqView(x));
});

// ---------- المحادثات ----------
r.get('/threads/:type/:id/messages', staff, (req, res) => {
  const { type, id } = req.params;
  const list = db().messages.filter((m) => m.threadType === type && m.threadId === Number(id));
  list.forEach((m) => (m.readByStaff = true));
  save();
  res.json(list);
});

r.post('/threads/:type/:id/messages', staff, (req, res) => {
  const { type, id } = req.params;
  const col = type === 'booking' ? db().bookings : db().requests;
  const t = col.find((x) => x.id === Number(id));
  if (!t) throw httpError(404, 'غير موجود');
  if (!req.body.text || !String(req.body.text).trim()) throw httpError(400, 'اكتب رسالة');
  const m = addMessage(type, t.id, req.user, req.body.text);
  S.notify(t.userId, 'رسالة جديدة من الوكالة', String(req.body.text).slice(0, 120), { type, id: t.id });
  save();
  res.status(201).json(m);
});

// ---------- الرحلات ----------
function flightFromInput(b, base = {}) {
  required(b, ['airline', 'flightNo', 'from', 'to', 'departAt', 'arriveAt', 'basicPrice']);
  const from = String(b.from).toUpperCase();
  const to = String(b.to).toUpperCase();
  if (from === to) throw httpError(400, 'المغادرة والوصول متطابقان');
  for (const c of [from, to]) if (!db().airports.some((a) => a.code === c)) throw httpError(400, `المطار ${c} غير موجود، أضفه أولاً من صفحة المطارات`);
  const basic = Number(b.basicPrice);
  const flex = Number(b.flexPrice) || basic;
  return {
    ...base,
    airline: String(b.airline).trim(),
    airlineFr: String(b.airlineFr || '').trim(),
    airlineCode: String(b.airlineCode || '').trim().toUpperCase(),
    flightNo: String(b.flightNo).trim().toUpperCase(),
    from,
    to,
    departAt: b.departAt,
    arriveAt: b.arriveAt,
    durationMin: Number(b.durationMin) || Math.max(0, minutesBetween(b.departAt, b.arriveAt)),
    stops: Number(b.stops) || 0,
    via: String(b.via || '').toUpperCase(),
    cabin: b.cabin || 'economy',
    fares: {
      basic: { price: basic, baggage: b.basicBaggage || 'حقيبة 23 كغ', refundable: !!b.basicRefundable, changeable: !!b.basicChangeable },
      flex: { price: flex, baggage: b.flexBaggage || 'حقيبتان 23 كغ', refundable: b.flexRefundable !== false, changeable: b.flexChangeable !== false },
    },
    seats: Number(b.seats) >= 0 ? Number(b.seats) : 9,
    active: b.active !== false,
  };
}

r.get('/flights', staff, (req, res) => {
  const { from, to, date, q } = req.query;
  let list = db().flights.slice();
  if (from) list = list.filter((f) => f.from === from);
  if (to) list = list.filter((f) => f.to === to);
  if (date) list = list.filter((f) => f.departAt.startsWith(date));
  if (q) list = list.filter((f) => (f.flightNo + f.airline).toUpperCase().includes(String(q).toUpperCase()));
  list.sort((a, b) => a.departAt.localeCompare(b.departAt));
  res.json(list.slice(0, 500));
});

// إضافة رحلة، مع إمكانية تكرارها أسبوعياً حتى تاريخ معيّن
r.post('/flights', staff, (req, res) => {
  const base = flightFromInput(req.body);
  const created = [];
  const repeat = req.body.repeat;
  const days = repeat && Array.isArray(repeat.weekdays) && repeat.untilDate ? repeat.weekdays.map(Number) : null;
  const startDate = base.departAt.slice(0, 10);
  const depTime = base.departAt.slice(11);
  const arrOffsetMin = minutesBetween(base.departAt, base.arriveAt);
  let date = startDate;
  let guard = 0;
  do {
    const dow = new Date(date + 'T12:00').getDay();
    if (!days || days.includes(dow)) {
      const departAt = `${date}T${depTime}`;
      const arrive = new Date(new Date(departAt).getTime() + arrOffsetMin * 60000);
      const pad = (n) => String(n).padStart(2, '0');
      const arriveAt = `${ymd(arrive)}T${pad(arrive.getHours())}:${pad(arrive.getMinutes())}`;
      const f = { ...JSON.parse(JSON.stringify(base)), id: nextId('flights'), departAt, arriveAt, createdAt: nowIso() };
      db().flights.push(f);
      created.push(f);
    }
    date = addDays(date, 1);
  } while (days && date <= repeat.untilDate && ++guard < 400);
  S.audit(req.user, 'flight.create', `أضاف ${created.length} رحلة ${base.flightNo} ${base.from}→${base.to} بسعر ${base.fares.basic.price}`);
  save();
  res.status(201).json({ created: created.length, flights: created });
});

r.put('/flights/:id', staff, (req, res) => {
  const i = db().flights.findIndex((f) => f.id === Number(req.params.id));
  if (i < 0) throw httpError(404, 'الرحلة غير موجودة');
  const old = db().flights[i];
  db().flights[i] = flightFromInput(req.body, { id: old.id, createdAt: old.createdAt, demo: old.demo });
  const n = db().flights[i];
  if (old.fares.basic.price !== n.fares.basic.price || old.fares.flex.price !== n.fares.flex.price) {
    S.audit(req.user, 'flight.price', `${n.flightNo} ${n.departAt.slice(0, 10)}: السعر ${old.fares.basic.price}/${old.fares.flex.price} ← ${n.fares.basic.price}/${n.fares.flex.price}`);
  }
  save();
  res.json(n);
});

r.patch('/flights/:id', staff, (req, res) => {
  const f = db().flights.find((x) => x.id === Number(req.params.id));
  if (!f) throw httpError(404, 'الرحلة غير موجودة');
  if (req.body.active !== undefined) f.active = !!req.body.active;
  if (req.body.seats !== undefined) f.seats = Math.max(0, Number(req.body.seats));
  save();
  res.json(f);
});

r.delete('/flights/:id', staff, (req, res) => {
  const f = db().flights.find((x) => x.id === Number(req.params.id));
  db().flights = db().flights.filter((x) => x.id !== Number(req.params.id));
  if (f) S.audit(req.user, 'flight.delete', `حذف الرحلة ${f.flightNo} ${f.departAt}`);
  save();
  res.json({ ok: true });
});

r.post('/flights/delete-demo', adminOnly, (req, res) => {
  const before = db().flights.length;
  db().flights = db().flights.filter((f) => !f.demo);
  S.audit(req.user, 'flight.delete', `حذف ${before - db().flights.length} رحلة تجريبية`);
  save();
  res.json({ deleted: before - db().flights.length });
});

// ---------- باقات العمرة والحج ----------
function packageFromInput(b, base = {}) {
  required(b, ['title', 'type', 'departDate', 'returnDate']);
  const roomPrices = (b.roomPrices || []).filter((x) => x && Number(x.price) > 0).map((x) => ({ room: x.room, price: Number(x.price) }));
  if (!roomPrices.length) throw httpError(400, 'أدخل سعر نوع غرفة واحد على الأقل');
  const lines = (v) => (Array.isArray(v) ? v : String(v || '').split('\n')).map((x) => String(x).trim()).filter(Boolean);
  return {
    ...base,
    type: ['umrah', 'hajj'].includes(b.type) ? b.type : 'umrah',
    title: String(b.title).trim(),
    titleFr: String(b.titleFr || '').trim(),
    titleEn: String(b.titleEn || '').trim(),
    descriptionEn: String(b.descriptionEn || ''),
    includesEn: lines(b.includesEn),
    description: String(b.description || ''),
    descriptionFr: String(b.descriptionFr || ''),
    departDate: b.departDate,
    returnDate: b.returnDate,
    departCity: String(b.departCity || 'NKC').toUpperCase(),
    airline: String(b.airline || ''),
    hotelMakkah: String(b.hotelMakkah || ''),
    nightsMakkah: Number(b.nightsMakkah) || 0,
    hotelMadinah: String(b.hotelMadinah || ''),
    nightsMadinah: Number(b.nightsMadinah) || 0,
    includes: lines(b.includes),
    includesFr: lines(b.includesFr),
    roomPrices,
    childPrice: Number(b.childPrice) || 0,
    infantPrice: Number(b.infantPrice) || 0,
    seats: Math.max(0, Number(b.seats) || 0),
    active: b.active !== false,
  };
}

r.get('/packages', staff, (_req, res) => {
  const d = db();
  res.json(d.packages.slice().sort((a, b) => a.departDate.localeCompare(b.departDate)).map((p) => ({ ...p, booked: d.bookings.filter((b) => b.package && b.package.id === p.id && !S.CLOSED.includes(b.status)).reduce((s, b) => s + b.passengers.filter((x) => x.type !== 'infant').length, 0) })));
});

r.post('/packages', staff, (req, res) => {
  const p = { id: nextId('packages'), ...packageFromInput(req.body), createdAt: nowIso() };
  db().packages.push(p);
  S.audit(req.user, 'package.create', `أضاف باقة "${p.title}"`);
  save();
  res.status(201).json(p);
});

r.put('/packages/:id', staff, (req, res) => {
  const i = db().packages.findIndex((x) => x.id === Number(req.params.id));
  if (i < 0) throw httpError(404, 'الباقة غير موجودة');
  const old = db().packages[i];
  db().packages[i] = packageFromInput(req.body, { id: old.id, createdAt: old.createdAt, demo: old.demo });
  S.audit(req.user, 'package.update', `عدّل باقة "${db().packages[i].title}"`);
  save();
  res.json(db().packages[i]);
});

r.delete('/packages/:id', staff, (req, res) => {
  const p = db().packages.find((x) => x.id === Number(req.params.id));
  if (p && db().bookings.some((b) => b.package && b.package.id === p.id && !S.CLOSED.includes(b.status))) throw httpError(409, 'لا يمكن حذف باقة فيها حجوزات قائمة؛ أخفِها بدلاً من ذلك');
  db().packages = db().packages.filter((x) => x.id !== Number(req.params.id));
  if (p) S.audit(req.user, 'package.delete', `حذف باقة "${p.title}"`);
  save();
  res.json({ ok: true });
});

// ---------- المطارات ----------
r.get('/airports', staff, (_req, res) => res.json(db().airports));

r.post('/airports', staff, (req, res) => {
  required(req.body, ['code', 'city']);
  const code = String(req.body.code).trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw httpError(400, 'رمز المطار 3 أحرف لاتينية (مثل NKC)');
  if (db().airports.some((a) => a.code === code)) throw httpError(409, 'المطار موجود');
  const a = { code, city: String(req.body.city).trim(), country: String(req.body.country || '').trim(), cityFr: String(req.body.cityFr || '').trim(), countryFr: String(req.body.countryFr || '').trim(), cityEn: String(req.body.cityEn || req.body.cityFr || '').trim(), countryEn: String(req.body.countryEn || '').trim() };
  db().airports.push(a);
  save();
  res.status(201).json(a);
});

r.delete('/airports/:code', staff, (req, res) => {
  db().airports = db().airports.filter((a) => a.code !== req.params.code);
  save();
  res.json({ ok: true });
});

// ---------- الطلاب ----------
r.get('/students', staff, (req, res) => {
  const st = req.query.status;
  const list = db()
    .users.filter((u) => u.role === 'customer' && u.student && u.student.status !== 'none')
    .map((u) => ({ userId: u.id, name: u.name, phone: u.phone, ...u.student, status: S.studentStatus(u) }))
    .filter((x) => !st || x.status === st)
    .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
  res.json({ list, defaultValidUntil: S.defaultStudentValidUntil() });
});

function findCustomer(id) {
  const u = db().users.find((x) => x.id === Number(id) && x.role === 'customer');
  if (!u) throw httpError(404, 'الزبون غير موجود');
  return u;
}

r.post('/students/:userId/approve', staff, (req, res) => {
  const u = findCustomer(req.params.userId);
  if (!u.student || u.student.status === 'none') throw httpError(400, 'لا توجد وثائق');
  const validUntil = req.body.validUntil || S.defaultStudentValidUntil();
  if (validUntil <= today()) throw httpError(400, 'تاريخ انتهاء التوثيق يجب أن يكون في المستقبل');
  Object.assign(u.student, { status: 'verified', validUntil, verifiedAt: nowIso(), verifiedBy: req.user.name, rejectReason: '' });
  S.notify(u.id, 'تم توثيقك كطالب', `يمكنك الآن الحجز بسعر الطالب (خصم ${db().settings.studentDiscountPercent}%) حتى ${validUntil}.`, { type: 'student' });
  S.audit(req.user, 'student.approve', `وثّق الطالب ${u.name} حتى ${validUntil}`);
  save();
  res.json({ ok: true });
});

r.post('/students/:userId/reject', staff, (req, res) => {
  const u = findCustomer(req.params.userId);
  const reason = String(req.body.reason || 'الوثائق غير واضحة أو غير صالحة');
  Object.assign(u.student, { status: 'rejected', rejectReason: reason, reviewedAt: nowIso(), verifiedBy: req.user.name });
  S.notify(u.id, 'لم يُقبل توثيق الطالب', `السبب: ${reason}. يمكنك إعادة الإرسال.`, { type: 'student' });
  S.audit(req.user, 'student.reject', `رفض توثيق ${u.name}: ${reason}`);
  save();
  res.json({ ok: true });
});

r.post('/students/:userId/revoke', staff, (req, res) => {
  const u = findCustomer(req.params.userId);
  Object.assign(u.student, { status: 'rejected', rejectReason: String(req.body.reason || 'أُلغي التوثيق') });
  S.audit(req.user, 'student.revoke', `ألغى توثيق ${u.name}`);
  save();
  res.json({ ok: true });
});

// ---------- الزبائن والنقاط ----------
r.get('/customers', staff, (req, res) => {
  const q = String(req.query.q || '');
  const d = db();
  const list = d.users
    .filter((u) => u.role === 'customer')
    .filter((u) => !q || u.name.includes(q) || u.phone.includes(q) || (u.referralCode || '').includes(q.toUpperCase()))
    .map((u) => ({
      ...publicUser(u),
      studentStatus: S.studentStatus(u),
      referredByName: u.referredBy ? (S.findUser(u.referredBy) || {}).name : '',
      invited: d.users.filter((x) => x.referredBy === u.id).length,
      bookings: d.bookings.filter((b) => b.userId === u.id).length,
      spent: d.bookings.filter((b) => b.userId === u.id && ['confirmed', 'ticketed'].includes(b.status)).reduce((s, b) => s + b.total, 0),
    }))
    .sort((a, b) => b.id - a.id);
  res.json(list);
});

r.get('/customers/:id/points', staff, (req, res) => {
  const u = findCustomer(req.params.id);
  res.json({ balance: u.points || 0, items: db().pointsLedger.filter((p) => p.userId === u.id).sort((a, b) => b.id - a.id), reasons: S.POINT_REASONS });
});

r.post('/customers/:id/points', adminOnly, (req, res) => {
  const u = findCustomer(req.params.id);
  const delta = Math.round(Number(req.body.delta) || 0);
  const note = String(req.body.note || '').trim();
  if (!delta) throw httpError(400, 'أدخل عدد النقاط (موجب للإضافة، سالب للخصم)');
  if (!note) throw httpError(400, 'اكتب سبب التعديل');
  const applied = S.addPoints(u, delta, 'manual', null, note);
  S.audit(req.user, 'points.manual', `${applied > 0 ? 'أضاف' : 'خصم'} ${Math.abs(applied)} نقطة لـ ${u.name}: ${note}`);
  S.notify(u.id, applied > 0 ? `أُضيفت ${applied} نقطة لرصيدك` : `خُصمت ${-applied} نقطة من رصيدك`, note, { type: 'points' });
  save();
  res.json({ balance: u.points });
});

r.patch('/customers/:id', adminOnly, (req, res) => {
  const u = findCustomer(req.params.id);
  if (req.body.disabled !== undefined) u.disabled = !!req.body.disabled;
  if (req.body.newPassword) {
    if (String(req.body.newPassword).length < 6) throw httpError(400, 'كلمة المرور قصيرة');
    u.passwordHash = bcrypt.hashSync(String(req.body.newPassword), 10);
  }
  save();
  res.json(publicUser(u));
});

// ---------- مستحقات المنصة (للاطلاع فقط) ----------
r.get('/platform', staff, (req, res) => {
  const out = summary({ from: req.query.from, to: req.query.to });
  db().platformPayments.filter((p) => p.status === 'rejected' && !p.seenByAgency).forEach((p) => (p.seenByAgency = true));
  save();
  res.json(out);
});

// الوكالة ترسل للمالك إثبات تحويل مستحقاته (رقم العملية + صورة الإيصال) — يؤكده المالك من لوحته
r.post('/platform/payments', staff, upload.single('receipt'), (req, res) => {
  const amount = Math.round(Number(req.body.amount) || 0);
  if (amount <= 0) throw httpError(400, 'أدخل المبلغ المحوَّل');
  const acc = (db().owner.payoutAccounts || []).find((a) => a.id === req.body.accountId);
  if (!acc) throw httpError(400, 'اختر الحساب الذي حوّلت إليه');
  if (!req.body.reference && !req.file) throw httpError(400, 'أدخل رقم العملية أو أرفق صورة الإيصال');
  const p = {
    id: nextId('platformPayments'),
    amount,
    accountId: acc.id,
    method: acc.name,
    reference: String(req.body.reference || '').trim(),
    note: String(req.body.note || '').trim(),
    receipt: fileRecord(req.file),
    status: 'pending',
    submittedBy: req.user.name,
    createdAt: nowIso(),
  };
  db().platformPayments.push(p);
  S.audit(req.user, 'payment.submit', `أرسلت الوكالة دفعة ${amount} للمالك عبر ${acc.name} (${p.reference || 'إيصال'})`);
  save();
  res.status(201).json(p);
});

r.delete('/platform/payments/:id', staff, (req, res) => {
  const p = db().platformPayments.find((x) => x.id === Number(req.params.id));
  if (!p || p.status !== 'pending') throw httpError(409, 'لا يمكن سحب دفعة تمت مراجعتها');
  db().platformPayments = db().platformPayments.filter((x) => x !== p);
  S.audit(req.user, 'payment.withdraw', `سحبت الوكالة دفعة ${p.amount} قبل مراجعتها`);
  save();
  res.json({ ok: true });
});

// ---------- الإعدادات ----------
function settingsView() {
  const s = db().settings;
  return { ...s, amadeus: { ...s.amadeus, clientSecret: s.amadeus.clientSecret ? '••••••••' : '' }, commissionPercent: db().owner.commissionPercent };
}

r.get('/settings', staff, (_req, res) => res.json(settingsView()));

const NUMERIC = ['childPercent', 'infantPercent', 'paymentDeadlineHours', 'studentDiscountPercent', 'studentMaxAge', 'pointsEarnPer', 'pointValue', 'pointsMinRedeem', 'pointsMaxRedeemPercent', 'pointsExpiryMonths', 'referralPointsReferrer', 'referralPointsReferee'];
const KEYS = ['agencyName', 'agencyPhone', 'whatsapp', 'address', 'currency', 'paymentMethods', 'popularDestinations', 'pointsEnabled', 'referralEnabled', ...NUMERIC];

r.put('/settings', adminOnly, (req, res) => {
  const s = db().settings;
  const changed = [];
  for (const k of KEYS) {
    if (req.body[k] === undefined) continue;
    let v = req.body[k];
    if (NUMERIC.includes(k)) v = Math.max(0, Number(v) || 0);
    if (['pointsEnabled', 'referralEnabled'].includes(k)) v = !!v;
    if (JSON.stringify(s[k]) !== JSON.stringify(v)) changed.push(k);
    s[k] = v;
  }
  if (req.body.exchangeRates) {
    const er = req.body.exchangeRates;
    const next = { USD: Number(er.USD) || s.exchangeRates.USD, EUR: Number(er.EUR) || s.exchangeRates.EUR };
    if (next.USD !== s.exchangeRates.USD || next.EUR !== s.exchangeRates.EUR) changed.push(`أسعار الصرف (USD ${next.USD}، EUR ${next.EUR})`);
    s.exchangeRates = next;
    s.exchangeRatesUpdatedAt = nowIso();
  }
  if (s.pointsEarnPer < 1) s.pointsEarnPer = 1;
  if (s.studentDiscountPercent > 90) s.studentDiscountPercent = 90;
  if (changed.length) S.audit(req.user, 'settings', `غيّر الإعدادات: ${changed.join('، ')}`);
  save();
  res.json(settingsView());
});

// إعدادات Amadeus
r.put('/settings/amadeus', adminOnly, (req, res) => {
  const a = db().settings.amadeus;
  const b = req.body;
  for (const k of ['env', 'baseUrl', 'clientId', 'currency', 'ticketingPath', 'defaultCountry']) if (b[k] !== undefined) a[k] = String(b[k]).trim();
  for (const k of ['exchangeRate', 'markupPercent', 'markupFixed', 'maxResults']) if (b[k] !== undefined) a[k] = Math.max(0, Number(b[k]) || 0);
  for (const k of ['enabled', 'createOrder', 'autoSync']) if (b[k] !== undefined) a[k] = !!b[k];
  if (b.clientSecret && !/^•+$/.test(b.clientSecret)) a.clientSecret = String(b.clientSecret).trim();
  a.currency = (a.currency || 'EUR').toUpperCase();
  if (a.maxResults < 1 || a.maxResults > 250) a.maxResults = 20;
  if (a.exchangeRate <= 0) a.exchangeRate = 1;
  amadeus.resetToken();
  S.audit(req.user, 'settings.amadeus', `حدّث إعدادات Amadeus (${a.enabled ? 'مفعّل' : 'متوقف'}، ${a.env}، هامش ${a.markupPercent}% + ${a.markupFixed})`);
  save();
  res.json(settingsView());
});

r.post('/settings/amadeus/test', adminOnly, async (_req, res) => {
  const a = db().settings.amadeus;
  if (!a.clientId || !a.clientSecret) throw httpError(400, 'أدخل Client ID و Client Secret أولاً');
  amadeus.resetToken();
  const wasEnabled = a.enabled;
  a.enabled = true;
  try {
    await amadeus.testConnection();
  } catch (e) {
    throw httpError(e.status || 502, e.message);
  } finally {
    a.enabled = wasEnabled;
  }
  res.json({ ok: true, baseUrl: amadeus.baseUrl() });
});

// ---------- الموظفون ----------
r.get('/staff', adminOnly, (_req, res) => res.json(db().users.filter((u) => STAFF.includes(u.role)).map(publicUser)));

r.post('/staff', adminOnly, (req, res) => {
  required(req.body, ['name', 'username', 'password']);
  const username = String(req.body.username).trim();
  if (db().users.some((u) => u.username === username)) throw httpError(409, 'اسم المستخدم موجود');
  if (String(req.body.password).length < 6) throw httpError(400, 'كلمة المرور قصيرة');
  const u = { id: nextId('users'), role: req.body.role === 'admin' ? 'admin' : 'staff', name: req.body.name, username, phone: '', passwordHash: bcrypt.hashSync(String(req.body.password), 10), createdAt: nowIso() };
  db().users.push(u);
  S.audit(req.user, 'staff.create', `أضاف الموظف ${u.name} (${u.role})`);
  save();
  res.status(201).json(publicUser(u));
});

r.delete('/staff/:id', adminOnly, (req, res) => {
  if (Number(req.params.id) === req.user.id) throw httpError(400, 'لا يمكنك حذف حسابك');
  const u = db().users.find((x) => x.id === Number(req.params.id) && STAFF.includes(x.role));
  db().users = db().users.filter((x) => !(x.id === Number(req.params.id) && STAFF.includes(x.role)));
  if (u) S.audit(req.user, 'staff.delete', `حذف الموظف ${u.name}`);
  save();
  res.json({ ok: true });
});

module.exports = r;
