// منطق العمل: الأسعار، الخصومات، النقاط، العمولة، الحجوزات، الإشعارات، السجل
const { db, save, nextId, randomCode } = require('./db');
const { nowIso, httpError, today } = require('./util');
const amadeus = require('./providers/amadeus');

const STATUS_LABELS = {
  awaiting_payment: 'بانتظار الدفع',
  payment_review: 'جاري التحقق من الدفع',
  confirmed: 'مدفوع — جاري إصدار التذكرة',
  ticketed: 'تم إصدار التذكرة',
  cancelled: 'ملغى',
  expired: 'انتهت مهلة الدفع',
  refunded: 'تم الاسترجاع',
};

const REQUEST_LABELS = { new: 'جديد', quoted: 'وصلتك عروض', accepted: 'تم القبول', closed: 'مغلق' };
const COMMISSION_LABELS = { pending: 'معلّقة (لم تصدر التذكرة)', earned: 'مستحقة', void: 'ملغاة' };
const CLOSED = ['cancelled', 'expired', 'refunded'];

// ---------- السجل والإشعارات ----------
function audit(actor, action, text, meta = {}) {
  const a = typeof actor === 'string' ? { name: actor, role: 'system' } : { name: actor.name, role: actor.role };
  db().audit.push({ id: nextId('audit'), at: nowIso(), actor: a.name, role: a.role, action, text, ...meta });
  if (db().audit.length > 20000) db().audit.splice(0, db().audit.length - 20000);
}

function notify(userId, title, body, link = null) {
  db().notifications.push({ id: nextId('notifications'), userId, title, body, link, read: false, createdAt: nowIso() });
}

function airportCity(code) {
  const a = db().airports.find((x) => x.code === code);
  return a ? a.city : code;
}

const findUser = (id) => db().users.find((u) => u.id === id);

// ---------- الأسعار ----------
function paxPrice(base, type) {
  const s = db().settings;
  if (type === 'child') return Math.round((base * s.childPercent) / 100);
  if (type === 'infant') return Math.round((base * s.infantPercent) / 100);
  return base;
}

const seatCount = (passengers) => passengers.filter((p) => p.type !== 'infant').length;
const normName = (s) => String(s || '').trim().toUpperCase().replace(/\s+/g, ' ');

// ---------- الطلاب ----------
function studentStatus(user) {
  const st = user.student || { status: 'none' };
  if (st.status === 'verified' && st.validUntil && st.validUntil < today()) return 'expired';
  return st.status;
}

function defaultStudentValidUntil() {
  const d = new Date();
  const y = d.getMonth() >= 8 ? d.getFullYear() + 1 : d.getFullYear(); // تنتهي السنة الدراسية في 31 أغسطس
  return `${y}-08-31`;
}

// ---------- النقاط ----------
function addPoints(user, delta, reason, bookingId = null, note = '') {
  if (!delta) return 0;
  if (delta < 0) delta = -Math.min(user.points || 0, -delta);
  user.points = (user.points || 0) + delta;
  user.pointsActivityAt = nowIso();
  db().pointsLedger.push({ id: nextId('points'), userId: user.id, delta, reason, bookingId, note, balance: user.points, at: nowIso() });
  return delta;
}

const POINT_REASONS = { earn: 'نقاط حجز', redeem: 'استعمال نقاط في حجز', refund_redeem: 'إرجاع نقاط حجز ملغى', revoke: 'سحب نقاط حجز مسترجع', referral: 'مكافأة دعوة صديق', referral_welcome: 'مكافأة التسجيل بدعوة', expired: 'انتهاء صلاحية النقاط', manual: 'تعديل من الوكالة' };

// ---------- المسافرون ----------
const PAX_TYPES = ['adult', 'child', 'infant'];
const TYPE_ORDER = { adult: 0, child: 1, infant: 2 };

function validatePassengers(passengers) {
  if (!Array.isArray(passengers) || passengers.length === 0) throw httpError(400, 'أضف مسافراً واحداً على الأقل');
  if (passengers.length > 9) throw httpError(400, 'الحد الأقصى 9 مسافرين في الحجز الواحد');
  const adults = passengers.filter((p) => p.type === 'adult').length;
  const infants = passengers.filter((p) => p.type === 'infant').length;
  if (adults === 0) throw httpError(400, 'يجب أن يكون هناك بالغ واحد على الأقل');
  if (infants > adults) throw httpError(400, 'عدد الرضّع لا يمكن أن يتجاوز عدد البالغين');
  const list = passengers.map((p, i) => {
    if (!PAX_TYPES.includes(p.type)) throw httpError(400, `نوع المسافر ${i + 1} غير صحيح`);
    for (const f of ['firstName', 'lastName', 'passportNo']) {
      if (!p[f] || !String(p[f]).trim()) throw httpError(400, `أكمل بيانات المسافر ${i + 1}`);
    }
    return {
      type: p.type,
      gender: p.gender === 'F' ? 'F' : 'M',
      firstName: normName(p.firstName),
      lastName: normName(p.lastName),
      birthDate: p.birthDate || '',
      nationality: p.nationality || '',
      passportNo: String(p.passportNo).trim().toUpperCase(),
      passportExpiry: p.passportExpiry || '',
      isStudent: false,
      ticketNumber: '',
      save: !!p.saveTraveler,
    };
  });
  // ترتيب ثابت: البالغون ثم الأطفال ثم الرضّع (مطلوب لمطابقة عروض Amadeus)
  return list.map((p, i) => ({ p, i })).sort((a, b) => TYPE_ORDER[a.p.type] - TYPE_ORDER[b.p.type] || a.i - b.i).map((x) => ({ ...x.p, _orig: x.i }));
}

// حفظ المسافرين الذين طلب الزبون حفظهم
function saveTravelers(user, passengers) {
  user.travelers = user.travelers || [];
  for (const p of passengers) {
    if (!p.save) continue;
    const t = { firstName: p.firstName, lastName: p.lastName, gender: p.gender, birthDate: p.birthDate, nationality: p.nationality, passportNo: p.passportNo, passportExpiry: p.passportExpiry, type: p.type };
    const old = user.travelers.find((x) => x.passportNo === p.passportNo);
    if (old) Object.assign(old, t);
    else if (user.travelers.length < 30) user.travelers.push({ id: nextId('travelers'), relation: '', ...t });
  }
}

// ---------- الرحلات (محلية أو Amadeus) ----------
function localSnapshot(f, fareKey) {
  const fare = f.fares[fareKey];
  return {
    provider: 'local', flightId: f.id, airline: f.airline, airlineFr: f.airlineFr || '', airlineCode: f.airlineCode, flightNo: f.flightNo,
    from: f.from, to: f.to, fromCity: airportCity(f.from), toCity: airportCity(f.to), departAt: f.departAt, arriveAt: f.arriveAt,
    durationMin: f.durationMin, stops: f.stops, via: f.via, baggage: fare.baggage, refundable: fare.refundable, changeable: fare.changeable, farePrice: fare.price,
  };
}

function amadeusSnapshot(m) {
  return {
    provider: 'amadeus', flightId: null, airline: m.airline, airlineFr: m.airlineFr, airlineCode: m.airlineCode, flightNo: m.flightNo,
    from: m.from, to: m.to, fromCity: airportCity(m.from), toCity: airportCity(m.to), departAt: m.departAt, arriveAt: m.arriveAt,
    durationMin: m.durationMin, stops: m.stops, via: m.via, baggage: m.baggage, refundable: false, changeable: false, farePrice: m.adultPrice,
  };
}

// يعيد لكل رحلة مختارة: السعر لكل مسافر + لقطة الرحلة + ما يلزم لحجزها
async function resolveLeg(id, fareKey, passengers) {
  const seats = seatCount(passengers);
  if (String(id).startsWith('amx_')) {
    const c = amadeus.recall(String(id));
    if (!c) throw httpError(410, 'انتهت صلاحية نتائج البحث، ابحث من جديد');
    const priced = await amadeus.price(c.offer);
    if (priced.mapped.total > c.mapped.total) {
      throw httpError(409, `تغيّر سعر الرحلة ${priced.mapped.flightNo} إلى ${priced.mapped.total.toLocaleString('en')}. ابحث من جديد لترى السعر المحدّث.`);
    }
    if (priced.offer.numberOfBookableSeats && priced.offer.numberOfBookableSeats < seats) throw httpError(409, `لا توجد مقاعد كافية في رحلة ${priced.mapped.flightNo}`);
    // سعر كل مسافر حسب ترتيب travelerPricings (بالغون ثم أطفال ثم رضّع) = نفس ترتيب passengers
    const amounts = priced.mapped.perPax.map((x) => x.amount);
    if (amounts.length !== passengers.length) throw httpError(400, 'عدد المسافرين لا يطابق البحث، ابحث من جديد');
    return { provider: 'amadeus', amounts, snapshot: amadeusSnapshot(priced.mapped), offer: priced.offer };
  }
  const f = db().flights.find((x) => x.id === Number(id) && x.active);
  if (!f) throw httpError(404, 'الرحلة لم تعد متاحة');
  if (f.seats < seats) throw httpError(409, `لا توجد مقاعد كافية في رحلة ${f.flightNo}`);
  return { provider: 'local', flight: f, amounts: passengers.map((p) => paxPrice(f.fares[fareKey].price, p.type)), snapshot: localSnapshot(f, fareKey) };
}

// ---------- الخصومات (الطالب ثم النقاط) ----------
function applyDiscounts(user, passengers, amounts, body, { allowStudent }) {
  const s = db().settings;
  const fareTotal = amounts.reduce((a, b) => a + b, 0);
  let studentDiscount = 0;
  const si = body.studentPassengerIndex;
  if (si !== undefined && si !== null && si !== '') {
    if (!allowStudent) throw httpError(400, 'سعر الطالب غير متاح لهذا النوع من الحجز');
    if (studentStatus(user) !== 'verified') throw httpError(403, 'حسابك غير موثّق كطالب، أرسل وثائقك أولاً');
    const idx = passengers.findIndex((p) => p._orig === Number(si));
    const p = passengers[idx];
    if (!p) throw httpError(400, 'اختر المسافر الطالب');
    const st = user.student;
    if (normName(p.firstName) !== normName(st.firstName) || normName(p.lastName) !== normName(st.lastName)) {
      throw httpError(400, `سعر الطالب للطالب نفسه فقط: الاسم يجب أن يطابق ${st.firstName} ${st.lastName}`);
    }
    p.isStudent = true;
    studentDiscount = Math.round((amounts[idx] * s.studentDiscountPercent) / 100);
  }
  const subtotal = fareTotal - studentDiscount;

  let pointsUsed = 0;
  let pointsDiscount = 0;
  const want = Math.floor(Number(body.pointsToUse) || 0);
  if (want > 0) {
    if (!s.pointsEnabled) throw httpError(400, 'النقاط غير مفعّلة حالياً');
    if (want > (user.points || 0)) throw httpError(400, 'رصيد نقاطك لا يكفي');
    if (want < s.pointsMinRedeem) throw httpError(400, `أقل عدد نقاط يمكن استعماله هو ${s.pointsMinRedeem}`);
    const cap = Math.floor((subtotal * s.pointsMaxRedeemPercent) / 100);
    pointsUsed = Math.min(want, Math.floor(cap / s.pointValue));
    pointsDiscount = pointsUsed * s.pointValue;
  }
  return { fareTotal, studentDiscount, subtotal, pointsUsed, pointsDiscount, total: subtotal - pointsDiscount };
}

// ---------- إنشاء الحجز ----------
async function createBooking(user, body) {
  if (body.packageId) return createPackageBooking(user, body);
  if (body.requestId) return createOfferBooking(user, body);
  return createFlightBooking(user, body);
}

async function createFlightBooking(user, body) {
  const fareKey = body.fare === 'flex' ? 'flex' : 'basic';
  const passengers = validatePassengers(body.passengers);
  const ids = [body.outboundFlightId, body.inboundFlightId].filter(Boolean);
  if (!ids.length) throw httpError(400, 'اختر رحلة');
  checkPayment(body.paymentMethod);

  const legs = [];
  for (const id of ids) legs.push(await resolveLeg(id, fareKey, passengers));
  const amounts = passengers.map((_, i) => legs.reduce((a, l) => a + l.amounts[i], 0));
  const price = applyDiscounts(user, passengers, amounts, body, { allowStudent: true });

  // إنشاء الحجز في Amadeus (PNR) قبل حفظه عندنا
  const orders = [];
  if (legs.some((l) => l.provider === 'amadeus') && db().settings.amadeus.createOrder) {
    try {
      for (const [i, l] of legs.entries()) {
        if (l.provider !== 'amadeus') continue;
        const o = await amadeus.createOrder(l.offer, passengers, body.contactPhone || user.phone, user.email);
        orders.push({ legIndex: i, orderId: o.id, pnr: o.pnr, ticketingDeadline: o.ticketingDeadline });
      }
    } catch (e) {
      for (const o of orders) amadeus.cancelOrder(o.orderId).catch(() => {});
      throw httpError(e.status || 502, e.message);
    }
  }

  const seats = seatCount(passengers);
  legs.filter((l) => l.provider === 'local').forEach((l) => (l.flight.seats -= seats)); // حجز المقاعد مؤقتاً حتى الدفع
  const hasAmadeus = legs.some((l) => l.provider === 'amadeus');
  return insertBooking(user, {
    source: hasAmadeus ? 'amadeus' : 'flights',
    fare: hasAmadeus && legs.every((l) => l.provider === 'amadeus') ? 'basic' : fareKey,
    segments: legs.map((l) => l.snapshot),
    passengers,
    ...price,
    amadeus: orders.length ? { orders } : null,
    pnr: orders.map((o) => o.pnr).filter(Boolean).join(' / '),
    contactPhone: body.contactPhone || user.phone,
    paymentMethod: body.paymentMethod,
  });
}

function createOfferBooking(user, body) {
  const d = db();
  const req = d.requests.find((r) => r.id === Number(body.requestId) && r.userId === user.id);
  if (!req) throw httpError(404, 'الطلب غير موجود');
  if (req.status === 'closed' || req.status === 'accepted') throw httpError(409, 'هذا الطلب مغلق');
  const offer = req.offers.find((o) => o.id === Number(body.offerId));
  if (!offer) throw httpError(404, 'العرض غير موجود');
  if (offer.validUntil && new Date(offer.validUntil + 'T23:59') < new Date()) throw httpError(409, 'انتهت صلاحية هذا العرض، اطلب عرضاً جديداً');
  checkPayment(body.paymentMethod);
  const passengers = validatePassengers(body.passengers);
  const total = Number(offer.totalPrice);
  // السعر الإجمالي للعرض يوزَّع على المسافرين بالتساوي (لحساب النقاط فقط)
  const amounts = passengers.map((_, i) => (i === 0 ? total - Math.floor(total / passengers.length) * (passengers.length - 1) : Math.floor(total / passengers.length)));
  const price = applyDiscounts(user, passengers, amounts, body, { allowStudent: false });
  req.status = 'accepted';
  req.acceptedOfferId = offer.id;
  return insertBooking(user, {
    source: 'request', requestId: req.id, fare: 'offer', offer: { ...offer }, segments: offer.segments || [], passengers, ...price,
    contactPhone: body.contactPhone || user.phone, paymentMethod: body.paymentMethod,
  });
}

const ROOM_LABELS = { quad: 'غرفة رباعية', triple: 'غرفة ثلاثية', double: 'غرفة ثنائية', single: 'غرفة فردية' };

function createPackageBooking(user, body) {
  const pkg = db().packages.find((p) => p.id === Number(body.packageId) && p.active);
  if (!pkg) throw httpError(404, 'الباقة غير متاحة');
  if (pkg.departDate <= today()) throw httpError(409, 'انتهى الحجز في هذه الباقة');
  const room = pkg.roomPrices.find((x) => x.room === body.roomType);
  if (!room) throw httpError(400, 'اختر نوع الغرفة');
  checkPayment(body.paymentMethod);
  const passengers = validatePassengers(body.passengers);
  const seats = seatCount(passengers);
  if (pkg.seats < seats) throw httpError(409, 'لا توجد أماكن كافية في هذه الباقة');
  const amounts = passengers.map((p) => (p.type === 'adult' ? room.price : p.type === 'child' ? pkg.childPrice || room.price : pkg.infantPrice || paxPrice(room.price, 'infant')));
  const price = applyDiscounts(user, passengers, amounts, body, { allowStudent: false });
  pkg.seats -= seats;
  return insertBooking(user, {
    source: 'package', fare: 'package',
    package: { id: pkg.id, type: pkg.type, title: pkg.title, titleFr: pkg.titleFr || '', departDate: pkg.departDate, returnDate: pkg.returnDate, departCity: pkg.departCity, roomType: room.room, roomLabel: ROOM_LABELS[room.room] || room.room, hotelMakkah: pkg.hotelMakkah, hotelMadinah: pkg.hotelMadinah },
    segments: [], passengers, ...price, contactPhone: body.contactPhone || user.phone, paymentMethod: body.paymentMethod,
  });
}

function checkPayment(methodId) {
  const m = db().settings.paymentMethods.find((x) => x.id === methodId && x.enabled);
  if (!m) throw httpError(400, 'اختر طريقة دفع صحيحة');
  return m;
}

function insertBooking(user, b) {
  const d = db();
  const method = checkPayment(b.paymentMethod);
  let ref;
  do ref = 'TR' + randomCode(6); while (d.bookings.some((x) => x.ref === ref));
  const percent = Number(d.owner.commissionPercent) || 0;
  const passengers = b.passengers.map(({ _orig, save: s, ...p }) => p);
  const booking = {
    id: nextId('bookings'),
    ref,
    userId: user.id,
    customerName: user.name,
    status: 'awaiting_payment',
    pnr: '',
    ...b,
    passengers,
    paymentMethodName: method.name,
    paymentDeadline: new Date(Date.now() + d.settings.paymentDeadlineHours * 3600 * 1000).toISOString(),
    payment: null,
    ticketFile: null,
    customerRequest: null,
    internalNote: '',
    commission: { percent, base: b.subtotal, amount: Math.round((b.subtotal * percent) / 100), status: 'pending' },
    pointsEarned: 0,
    history: [{ at: nowIso(), status: 'awaiting_payment', by: 'customer', note: 'تم إنشاء الحجز' }],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  if (b.pointsUsed) addPoints(user, -b.pointsUsed, 'redeem', booking.id);
  saveTravelers(user, b.passengers);
  d.bookings.push(booking);
  audit({ name: user.name, role: 'customer' }, 'booking.create', `حجز جديد ${ref} بمبلغ ${booking.total} (عمولة ${booking.commission.amount})`, { bookingId: booking.id });
  notify(user.id, 'تم إنشاء حجزك', `رقم الحجز ${ref}. أكمل الدفع خلال ${d.settings.paymentDeadlineHours} ساعة.`, { type: 'booking', id: booking.id });
  save();
  return booking;
}

// ---------- تغيير حالة الحجز (وكل ما يترتب عليها) ----------
function releaseSeats(booking) {
  if (booking.seatsReleased) return;
  const seats = seatCount(booking.passengers);
  if (booking.source === 'package' && booking.package) {
    const p = db().packages.find((x) => x.id === booking.package.id);
    if (p) p.seats += seats;
  }
  for (const s of booking.segments || []) {
    if (s.provider === 'amadeus' || !s.flightId) continue;
    const f = db().flights.find((x) => x.id === s.flightId);
    if (f) f.seats += seats;
  }
  if (booking.amadeus && booking.amadeus.orders) {
    for (const o of booking.amadeus.orders) {
      amadeus.cancelOrder(o.orderId).then(
        () => audit('Amadeus', 'amadeus.cancel', `أُلغي PNR ${o.pnr} للحجز ${booking.ref}`, { bookingId: booking.id }),
        (e) => audit('Amadeus', 'amadeus.error', `تعذّر إلغاء PNR ${o.pnr} للحجز ${booking.ref}: ${e.message}`, { bookingId: booking.id })
      );
    }
  }
  booking.seatsReleased = true;
}

function setStatus(booking, status, by, note = '', actorRole = 'staff') {
  const prev = booking.status;
  if (prev === status) return;
  booking.status = status;
  booking.updatedAt = nowIso();
  booking.history.push({ at: nowIso(), status, by, note });
  const user = findUser(booking.userId);
  const s = db().settings;

  // العمولة
  const c = booking.commission;
  if (status === 'ticketed') Object.assign(c, { status: 'earned', earnedAt: nowIso() });
  else if (CLOSED.includes(status)) Object.assign(c, { status: 'void', voidedAt: nowIso(), voidReason: status, voidedAfterPayment: ['confirmed', 'ticketed'].includes(prev) });
  else c.status = 'pending';

  if (CLOSED.includes(status)) {
    releaseSeats(booking);
    // إرجاع النقاط المستعملة وسحب النقاط المكتسبة
    if (user && booking.pointsUsed && !booking.pointsUsedRefunded) {
      addPoints(user, booking.pointsUsed, 'refund_redeem', booking.id);
      booking.pointsUsedRefunded = true;
    }
    if (user && booking.pointsEarned && !booking.pointsEarnedRevoked) {
      addPoints(user, -booking.pointsEarned, 'revoke', booking.id);
      booking.pointsEarnedRevoked = true;
    }
  }

  if (status === 'ticketed' && user && !booking.pointsEarned && !booking.pointsEarnedRevoked && s.pointsEnabled) {
    const earn = Math.floor(booking.total / (Number(s.pointsEarnPer) || 100));
    if (earn > 0) {
      addPoints(user, earn, 'earn', booking.id);
      booking.pointsEarned = earn;
      notify(user.id, `ربحت ${earn} نقطة`, `أُضيفت ${earn} نقطة إلى رصيدك من الحجز ${booking.ref}.`, { type: 'points' });
    }
    // مكافأة الدعوة عند أول تذكرة للصديق المدعو
    if (user.referredBy && !user.referralRewarded && s.referralEnabled) {
      const ref = findUser(user.referredBy);
      user.referralRewarded = true;
      addPoints(user, s.referralPointsReferee, 'referral_welcome', booking.id);
      notify(user.id, `ربحت ${s.referralPointsReferee} نقطة`, 'مكافأة أول حجز لك عبر دعوة صديق.', { type: 'points' });
      if (ref) {
        addPoints(ref, s.referralPointsReferrer, 'referral', booking.id, user.name);
        notify(ref.id, `ربحت ${s.referralPointsReferrer} نقطة`, `صديقك ${user.name} أكمل أول حجز له. شكراً لدعوتك!`, { type: 'points' });
      }
    }
  }

  audit({ name: by, role: actorRole }, 'booking.status', `${booking.ref}: ${STATUS_LABELS[prev] || prev} ← ${STATUS_LABELS[status]}${note ? ' — ' + note : ''}`, { bookingId: booking.id });

  const msg = {
    payment_review: 'استلمنا إثبات الدفع وسنتحقق منه قريباً.',
    confirmed: 'تم تأكيد الدفع. جاري إصدار تذكرتك.',
    ticketed: 'تذكرتك جاهزة! يمكنك تحميلها من حجوزاتي.',
    cancelled: 'تم إلغاء الحجز.' + (note ? ' ' + note : ''),
    expired: 'انتهت مهلة الدفع وأُلغي الحجز تلقائياً.',
    refunded: 'تم استرجاع المبلغ.',
    awaiting_payment: note || 'الحجز بانتظار الدفع.',
  }[status];
  if (msg && by !== 'customer') notify(booking.userId, `حجز ${booking.ref}: ${STATUS_LABELS[status]}`, msg, { type: 'booking', id: booking.id });
}

// ---------- Amadeus: الإصدار والمتابعة ----------
async function amadeusAfterPayment(booking) {
  if (!booking.amadeus || !booking.amadeus.orders) return;
  try {
    let issued = false;
    for (const o of booking.amadeus.orders) issued = (await amadeus.issue(o.orderId)) || issued;
    if (issued) audit('Amadeus', 'amadeus.issue', `طُلب الإصدار الآلي للحجز ${booking.ref}`, { bookingId: booking.id });
    await syncAmadeus(booking);
  } catch (e) {
    booking.amadeus.lastError = e.message;
    audit('Amadeus', 'amadeus.error', `الإصدار الآلي للحجز ${booking.ref}: ${e.message}`, { bookingId: booking.id });
    save();
  }
}

// يجلب أرقام التذاكر من Amadeus؛ عند صدورها لكل المسافرين تتحول الحالة إلى "تم الإصدار"
async function syncAmadeus(booking) {
  if (!booking.amadeus || !booking.amadeus.orders || !amadeus.isReady()) return false;
  const numbers = booking.passengers.map(() => []);
  let pnrs = [];
  let complete = true;
  for (const o of booking.amadeus.orders) {
    const r = await amadeus.getOrder(o.orderId);
    if (r.pnr) {
      o.pnr = r.pnr;
      pnrs.push(r.pnr);
    }
    // ترتيب المسافرين في Amadeus = ترتيب passengers (بالغون، أطفال، رضّع)
    const ids = r.travelers.length ? r.travelers.map((t) => t.id) : booking.passengers.map((_, i) => String(i + 1));
    ids.forEach((tid, i) => {
      const t = r.tickets.find((x) => x.travelerId === tid && x.status !== 'VOID');
      if (t && numbers[i]) numbers[i].push(t.number);
      else complete = false;
    });
  }
  booking.amadeus.lastSyncAt = nowIso();
  booking.amadeus.lastError = '';
  if (pnrs.length) booking.pnr = pnrs.join(' / ');
  let changed = false;
  numbers.forEach((n, i) => {
    const v = n.join(' / ');
    if (v && booking.passengers[i].ticketNumber !== v) {
      booking.passengers[i].ticketNumber = v;
      changed = true;
    }
  });
  if (complete && booking.status === 'confirmed') {
    setStatus(booking, 'ticketed', 'Amadeus', 'صدرت التذاكر في Amadeus', 'system');
    changed = true;
  }
  save();
  return changed;
}

let syncing = false;
async function sweepAmadeus() {
  if (syncing || !amadeus.isReady() || !db().settings.amadeus.autoSync) return;
  syncing = true;
  try {
    for (const b of db().bookings.filter((x) => x.status === 'confirmed' && x.amadeus && x.amadeus.orders)) {
      await syncAmadeus(b).catch((e) => {
        b.amadeus.lastError = e.message;
      });
    }
  } finally {
    syncing = false;
  }
}

// ---------- مهام دورية ----------
function sweep() {
  const now = Date.now();
  const d = db();
  let changed = false;
  for (const b of d.bookings) {
    if (b.status === 'awaiting_payment' && new Date(b.paymentDeadline).getTime() < now) {
      setStatus(b, 'expired', 'system', '', 'system');
      changed = true;
    }
  }
  const t = today();
  const months = Number(d.settings.pointsExpiryMonths) || 0;
  for (const u of d.users) {
    if (u.role !== 'customer') continue;
    if (u.student && u.student.status === 'verified' && u.student.validUntil && u.student.validUntil < t) {
      u.student.status = 'expired';
      notify(u.id, 'انتهى توثيق الطالب', 'انتهت صلاحية توثيقك كطالب. أرسل وثائق السنة الجديدة للاستفادة من سعر الطالب.', { type: 'student' });
      changed = true;
    }
    if (months && u.points > 0 && u.pointsActivityAt && now - new Date(u.pointsActivityAt).getTime() > months * 30.5 * 86400000) {
      addPoints(u, -u.points, 'expired');
      notify(u.id, 'انتهت صلاحية نقاطك', `لم يكن هناك أي نشاط في حسابك منذ ${months} شهراً.`, { type: 'points' });
      changed = true;
    }
  }
  if (changed) save();
}

module.exports = {
  STATUS_LABELS, REQUEST_LABELS, COMMISSION_LABELS, ROOM_LABELS, POINT_REASONS, CLOSED,
  audit, notify, airportCity, paxPrice, findUser, addPoints, studentStatus, defaultStudentValidUntil, normName,
  createBooking, setStatus, releaseSeats, amadeusAfterPayment, syncAmadeus, sweep, sweepAmadeus,
};
