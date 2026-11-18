// ═══════════════════════════════════════════════════════════════════════
// الربط مع Amadeus (واجهات REST بصيغة JSON: Flight Offers / Pricing / Orders)
//
// كل ما يخص Amadeus موجود في هذا الملف فقط. إذا أعطاكم عقد Amadeus عناوين أو
// حقولاً مختلفة قليلاً، عدّلوا هنا ولا تحتاجون تغيير باقي التطبيق.
//
// المراحل:
//   1) search      → البحث عن العروض الحية
//   2) price       → إعادة التحقق من السعر قبل الحجز
//   3) createOrder → إنشاء الحجز (PNR) في Amadeus
//   4) getOrder    → متابعة الحجز وجلب أرقام التذاكر بعد إصدارها
//   5) issue       → (اختياري) إصدار آلي إذا وفّر العقد واجهة لذلك
//   6) cancelOrder → إلغاء الحجز عند انتهاء مهلة الدفع
// ═══════════════════════════════════════════════════════════════════════
const crypto = require('crypto');
const { db } = require('../db');

const ENV_URLS = { test: 'https://test.api.amadeus.com', production: 'https://api.amadeus.com' };

function cfg() {
  return db().settings.amadeus;
}

function baseUrl() {
  const c = cfg();
  return (c.env === 'custom' ? c.baseUrl : ENV_URLS[c.env] || c.baseUrl || ENV_URLS.test).replace(/\/$/, '');
}

function isReady() {
  const c = cfg();
  return !!(c.enabled && c.clientId && c.clientSecret);
}

class AmadeusError extends Error {
  constructor(message, status = 502, details = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// ---------- المصادقة ----------
let token = null;
let tokenExp = 0;
let tokenKey = '';

async function getToken() {
  const c = cfg();
  const key = baseUrl() + c.clientId;
  if (token && tokenKey === key && Date.now() < tokenExp - 60000) return token;
  const res = await fetch(baseUrl() + '/v1/security/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: c.clientId, client_secret: c.clientSecret }),
  }).catch(() => null);
  if (!res) throw new AmadeusError('تعذّر الاتصال بخادم Amadeus');
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) throw new AmadeusError('فشل الدخول إلى Amadeus: تحقق من المفاتيح في الإعدادات', 502, j);
  token = j.access_token;
  tokenExp = Date.now() + (j.expires_in || 1799) * 1000;
  tokenKey = key;
  return token;
}

async function call(method, path, body) {
  const t = await getToken();
  const res = await fetch(baseUrl() + path, {
    method,
    headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/vnd.amadeus+json', Accept: 'application/vnd.amadeus+json, application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  }).catch((e) => {
    throw new AmadeusError(e.name === 'TimeoutError' ? 'Amadeus لم يرد في الوقت المحدد' : 'تعذّر الاتصال بخادم Amadeus');
  });
  if (res.status === 204) return {};
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = (j.errors && j.errors[0]) || {};
    throw new AmadeusError(`Amadeus: ${e.title || 'خطأ'}${e.detail ? ' — ' + e.detail : ''}`, res.status >= 500 ? 502 : 409, j);
  }
  return j;
}

// ---------- تحويل العروض إلى صيغة التطبيق ----------
const durationMin = (iso = '') => {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?/.exec(iso) || [];
  return Number(m[1] || 0) * 60 + Number(m[2] || 0);
};
const titleCase = (s = '') => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

function toLocal(amount, currency) {
  const c = cfg();
  const rate = currency === 'MRU' ? 1 : Number(c.exchangeRate) || 1;
  return Number(amount) * rate;
}

// السعر للزبون = سعر Amadeus × سعر الصرف + هامش الوكالة
function sellPrice(amount, currency, travelerType) {
  const c = cfg();
  let v = toLocal(amount, currency) * (1 + (Number(c.markupPercent) || 0) / 100);
  if (travelerType !== 'HELD_INFANT') v += Number(c.markupFixed) || 0;
  return Math.round(v);
}

const TYPE_MAP = { ADULT: 'adult', CHILD: 'child', HELD_INFANT: 'infant', SEATED_INFANT: 'infant', SENIOR: 'adult', YOUNG: 'adult', STUDENT: 'adult' };

function baggageText(tp) {
  const b = tp && tp.fareDetailsBySegment && tp.fareDetailsBySegment[0] && tp.fareDetailsBySegment[0].includedCheckedBags;
  if (!b) return '';
  if (b.quantity !== undefined) return b.quantity ? `${b.quantity} × 23 kg` : '—';
  if (b.weight) return `${b.weight} ${(b.weightUnit || 'KG').toLowerCase()}`;
  return '';
}

function mapOffer(offer, dictionaries = {}) {
  const it = offer.itineraries[0];
  const segs = it.segments;
  const first = segs[0];
  const last = segs[segs.length - 1];
  const code = (offer.validatingAirlineCodes && offer.validatingAirlineCodes[0]) || first.carrierCode;
  const carriers = dictionaries.carriers || {};
  const name = titleCase(carriers[code] || code);
  const currency = offer.price.currency;
  const perPax = offer.travelerPricings.map((tp) => ({ travelerId: tp.travelerId, type: TYPE_MAP[tp.travelerType] || 'adult', amount: sellPrice(tp.price.total, currency, tp.travelerType) }));
  const adult = perPax.find((p) => p.type === 'adult');
  return {
    provider: 'amadeus',
    airline: name,
    airlineFr: name,
    airlineCode: code,
    flightNo: segs.map((s) => `${s.carrierCode} ${s.number}`).join(' / '),
    from: first.departure.iataCode,
    to: last.arrival.iataCode,
    departAt: String(first.departure.at).slice(0, 16),
    arriveAt: String(last.arrival.at).slice(0, 16),
    durationMin: durationMin(it.duration),
    stops: segs.length - 1,
    via: segs.length > 1 ? segs.slice(0, -1).map((s) => s.arrival.iataCode).join(', ') : '',
    seatsLeft: offer.numberOfBookableSeats || 9,
    perPax,
    total: perPax.reduce((a, p) => a + p.amount, 0),
    adultPrice: adult ? adult.amount : perPax[0].amount,
    baggage: baggageText(offer.travelerPricings[0]),
    lastTicketingDate: offer.lastTicketingDate || '',
  };
}

// ---------- ذاكرة مؤقتة للعروض (العرض الكامل مطلوب عند الحجز) ----------
const cache = new Map();
const CACHE_MS = 40 * 60 * 1000;

function remember(offer, mapped) {
  const id = 'amx_' + crypto.randomBytes(8).toString('hex');
  cache.set(id, { offer, mapped, at: Date.now() });
  if (cache.size > 3000) {
    for (const [k, v] of cache) if (Date.now() - v.at > CACHE_MS) cache.delete(k);
  }
  return id;
}

function recall(id) {
  const v = cache.get(id);
  if (!v || Date.now() - v.at > CACHE_MS) return null;
  return v;
}

// ---------- 1) البحث ----------
async function search({ from, to, date, pax, cabin }) {
  const c = cfg();
  const q = new URLSearchParams({
    originLocationCode: from,
    destinationLocationCode: to,
    departureDate: date,
    adults: String(pax.adults),
    currencyCode: c.currency || 'EUR',
    max: String(c.maxResults || 20),
  });
  if (pax.children) q.set('children', String(pax.children));
  if (pax.infants) q.set('infants', String(pax.infants));
  if (cabin === 'business') q.set('travelClass', 'BUSINESS');
  const j = await call('GET', '/v2/shopping/flight-offers?' + q.toString());
  return (j.data || []).map((offer) => {
    const mapped = mapOffer(offer, j.dictionaries);
    return { id: remember(offer, mapped), ...mapped };
  });
}

// ---------- 2) إعادة التسعير قبل الحجز ----------
async function price(offer) {
  const j = await call('POST', '/v1/shopping/flight-offers/pricing', { data: { type: 'flight-offers-pricing', flightOffers: [offer] } });
  const priced = j.data && j.data.flightOffers && j.data.flightOffers[0];
  if (!priced) throw new AmadeusError('لم يؤكد Amadeus السعر، ابحث من جديد', 409);
  return { offer: priced, mapped: mapOffer(priced, j.dictionaries) };
}

// ---------- 3) إنشاء الحجز PNR ----------
const NATIONALITY = { موريتانية: 'MR', موريتاني: 'MR', مغربية: 'MA', مغربي: 'MA', سنغالية: 'SN', سنغالي: 'SN', جزائرية: 'DZ', جزائري: 'DZ', تونسية: 'TN', تونسي: 'TN', مالية: 'ML', مالي: 'ML', فرنسية: 'FR', فرنسي: 'FR', مصرية: 'EG', مصري: 'EG', سعودية: 'SA', سعودي: 'SA' };
const FR_NAT = { mauritanienne: 'MR', mauritanien: 'MR', marocaine: 'MA', marocain: 'MA', sénégalaise: 'SN', sénégalais: 'SN', algérienne: 'DZ', algérien: 'DZ', tunisienne: 'TN', tunisien: 'TN', malienne: 'ML', malien: 'ML', française: 'FR', français: 'FR' };

function countryCode(nat) {
  const n = String(nat || '').trim();
  if (/^[A-Za-z]{2}$/.test(n)) return n.toUpperCase();
  return NATIONALITY[n] || FR_NAT[n.toLowerCase()] || cfg().defaultCountry || 'MR';
}

function splitPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('222') && digits.length > 8) return { countryCallingCode: '222', number: digits.slice(3) };
  return { countryCallingCode: '222', number: digits.slice(-8) || '00000000' };
}

async function createOrder(offer, passengers, contactPhone, email) {
  // ترتيب المسافرين في Amadeus: البالغون، ثم الأطفال، ثم الرضّع (نفس ترتيب travelerPricings)
  const pool = { adult: passengers.filter((p) => p.type === 'adult'), child: passengers.filter((p) => p.type === 'child'), infant: passengers.filter((p) => p.type === 'infant') };
  const travelers = offer.travelerPricings.map((tp) => {
    const p = pool[TYPE_MAP[tp.travelerType] || 'adult'].shift();
    if (!p) throw new AmadeusError('عدد المسافرين لا يطابق العرض', 400);
    if (!p.birthDate) throw new AmadeusError(`أدخل تاريخ ميلاد ${p.firstName}`, 400);
    const cc = countryCode(p.nationality);
    return {
      id: tp.travelerId,
      dateOfBirth: p.birthDate,
      name: { firstName: p.firstName, lastName: p.lastName },
      gender: p.gender === 'F' ? 'FEMALE' : 'MALE',
      contact: { phones: [{ deviceType: 'MOBILE', ...splitPhone(contactPhone) }], ...(email ? { emailAddress: email } : {}) },
      documents: [{ documentType: 'PASSPORT', number: p.passportNo, expiryDate: p.passportExpiry, issuanceCountry: cc, nationality: cc, holder: true }],
    };
  });
  // ربط الرضيع بالبالغ المرافق له
  const adults = travelers.filter((t, i) => offer.travelerPricings[i].travelerType === 'ADULT');
  travelers.forEach((t, i) => {
    if (offer.travelerPricings[i].travelerType === 'HELD_INFANT') t.associatedAdultId = (adults.shift() || {}).id;
  });
  const j = await call('POST', '/v1/booking/flight-orders', { data: { type: 'flight-order', flightOffers: [offer], travelers } });
  const order = j.data || {};
  const rec = (order.associatedRecords || [])[0] || {};
  return { id: order.id, pnr: rec.reference || '', ticketingDeadline: (order.ticketingAgreement && order.ticketingAgreement.dateTime) || '' };
}

// ---------- 4) متابعة الحجز وجلب أرقام التذاكر ----------
async function getOrder(orderId) {
  const j = await call('GET', '/v1/booking/flight-orders/' + encodeURIComponent(orderId));
  const o = j.data || {};
  const tickets = (o.tickets || []).map((t) => ({ travelerId: t.travelerId, number: t.documentNumber, status: t.documentStatus }));
  const pnr = ((o.associatedRecords || [])[0] || {}).reference || '';
  return { pnr, tickets, travelers: o.travelers || [] };
}

// ---------- 5) إصدار آلي (اختياري) ----------
// واجهات REST العامة لا تتضمن الإصدار؛ بعض عقود Amadeus توفّر واجهة لذلك.
// ضع مسارها في الإعدادات (ticketingPath) مثل: /v1/booking/flight-orders/{id}/issuance
async function issue(orderId) {
  const p = cfg().ticketingPath;
  if (!p) return false;
  await call('POST', p.replace('{id}', encodeURIComponent(orderId)), { data: { type: 'flight-order-issuance', orderId } });
  return true;
}

// ---------- 6) الإلغاء ----------
async function cancelOrder(orderId) {
  await call('DELETE', '/v1/booking/flight-orders/' + encodeURIComponent(orderId));
}

async function testConnection() {
  await getToken();
  return true;
}

function resetToken() {
  token = null;
}

module.exports = { isReady, search, recall, price, createOrder, getOrder, issue, cancelOrder, testConnection, resetToken, AmadeusError, baseUrl };
