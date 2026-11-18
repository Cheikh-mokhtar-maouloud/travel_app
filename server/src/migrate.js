// ترقية قاعدة البيانات القديمة تلقائياً: يضيف الإعدادات والحقول الجديدة دون حذف أي بيانات
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const DEFAULT_SETTINGS = {
  // الطلاب
  studentDiscountPercent: 25,
  studentMaxAge: 30,
  // النقاط
  pointsEnabled: true,
  pointsEarnPer: 100, // نقطة واحدة لكل 100 أوقية مدفوعة
  pointValue: 2, // قيمة النقطة الواحدة عند الاستعمال (أوقية)
  pointsMinRedeem: 100, // أقل عدد نقاط يمكن استعماله
  pointsMaxRedeemPercent: 30, // أقصى خصم بالنقاط من سعر الحجز (%)
  pointsExpiryMonths: 12, // تنتهي النقاط إذا لم يكن هناك أي نشاط لمدة 12 شهراً
  // ادعُ صديقاً
  referralEnabled: true,
  referralPointsReferrer: 200,
  referralPointsReferee: 200,
  // أسعار الصرف لعرض الأسعار بالدولار واليورو (كم أوقية = 1 دولار / 1 يورو). حدّثها من الإعدادات
  exchangeRates: { USD: 39.9, EUR: 46.3 },
  // Amadeus
  amadeus: {
    enabled: false,
    env: 'test', // test | production | custom
    baseUrl: '',
    clientId: '',
    clientSecret: '',
    currency: 'EUR', // العملة التي تُطلب بها الأسعار من Amadeus
    exchangeRate: 43, // سعر تحويل تلك العملة إلى الأوقية (1 إذا كانت MRU)
    markupPercent: 0, // هامش ربح الوكالة على أسعار Amadeus
    markupFixed: 0, // مبلغ ثابت يُضاف لكل مسافر (غير الرضيع)
    maxResults: 20,
    createOrder: true, // إنشاء الحجز (PNR) آلياً في Amadeus عند الحجز
    ticketingPath: '', // مسار واجهة الإصدار الآلي إن وفّرها عقدكم مع Amadeus
    autoSync: true, // متابعة أرقام التذاكر آلياً من Amadeus
    defaultCountry: 'MR',
  },
};

const AIRPORTS_FR = {
  NKC: ['Nouakchott', 'Mauritanie'], NDB: ['Nouadhibou', 'Mauritanie'], ATR: ['Atar', 'Mauritanie'], OUZ: ['Zouérate', 'Mauritanie'], EMN: ['Néma', 'Mauritanie'],
  CMN: ['Casablanca', 'Maroc'], RAK: ['Marrakech', 'Maroc'], ALG: ['Alger', 'Algérie'], TUN: ['Tunis', 'Tunisie'], CAI: ['Le Caire', 'Égypte'],
  DSS: ['Dakar', 'Sénégal'], BKO: ['Bamako', 'Mali'], ABJ: ['Abidjan', "Côte d'Ivoire"], LPA: ['Las Palmas', 'Espagne'], MAD: ['Madrid', 'Espagne'],
  CDG: ['Paris', 'France'], BRU: ['Bruxelles', 'Belgique'], IST: ['Istanbul', 'Turquie'], JED: ['Djeddah', 'Arabie saoudite'], MED: ['Médine', 'Arabie saoudite'],
  DXB: ['Dubaï', 'Émirats arabes unis'], DOH: ['Doha', 'Qatar'],
};

const AIRPORTS_EN = {
  NKC: ['Nouakchott', 'Mauritania'], NDB: ['Nouadhibou', 'Mauritania'], ATR: ['Atar', 'Mauritania'], OUZ: ['Zouerate', 'Mauritania'], EMN: ['Nema', 'Mauritania'],
  CMN: ['Casablanca', 'Morocco'], RAK: ['Marrakesh', 'Morocco'], ALG: ['Algiers', 'Algeria'], TUN: ['Tunis', 'Tunisia'], CAI: ['Cairo', 'Egypt'],
  DSS: ['Dakar', 'Senegal'], BKO: ['Bamako', 'Mali'], ABJ: ['Abidjan', 'Ivory Coast'], LPA: ['Las Palmas', 'Spain'], MAD: ['Madrid', 'Spain'],
  CDG: ['Paris', 'France'], BRU: ['Brussels', 'Belgium'], IST: ['Istanbul', 'Turkey'], JED: ['Jeddah', 'Saudi Arabia'], MED: ['Medina', 'Saudi Arabia'],
  DXB: ['Dubai', 'United Arab Emirates'], DOH: ['Doha', 'Qatar'],
};

module.exports = function migrate(d) {
  d.settings = { ...DEFAULT_SETTINGS, ...d.settings, amadeus: { ...DEFAULT_SETTINGS.amadeus, ...(d.settings.amadeus || {}) } };
  d.settings.exchangeRates = { ...DEFAULT_SETTINGS.exchangeRates, ...(d.settings.exchangeRates || {}) };
  d.owner = { commissionPercent: 5, payoutAccounts: [], ...d.owner };
  if (!d.platformPayments) d.platformPayments = [];

  for (const a of d.airports) {
    if (!a.cityFr && AIRPORTS_FR[a.code]) [a.cityFr, a.countryFr] = AIRPORTS_FR[a.code];
    if (!a.cityEn && AIRPORTS_EN[a.code]) [a.cityEn, a.countryEn] = AIRPORTS_EN[a.code];
  }

  const usedCodes = new Set(d.users.map((u) => u.referralCode).filter(Boolean));
  for (const u of d.users) {
    if (u.role !== 'customer') continue;
    if (u.points === undefined) u.points = 0;
    if (!u.travelers) u.travelers = [];
    if (!u.student) u.student = { status: 'none' };
    if (!u.lang) u.lang = 'ar';
    if (!u.referralCode) {
      let c;
      do c = 'R' + crypto.randomBytes(3).toString('hex').toUpperCase(); while (usedCodes.has(c));
      usedCodes.add(c);
      u.referralCode = c;
    }
  }

  for (const b of d.bookings) {
    if (b.fareTotal === undefined) {
      b.fareTotal = b.total;
      b.studentDiscount = 0;
      b.subtotal = b.total;
      b.pointsUsed = 0;
      b.pointsDiscount = 0;
    }
    if (!b.commission) {
      b.commission = { percent: d.owner.commissionPercent, base: b.subtotal, amount: Math.round((b.subtotal * d.owner.commissionPercent) / 100), status: 'pending' };
      if (b.status === 'ticketed') b.commission.status = 'earned';
      if (['cancelled', 'expired', 'refunded'].includes(b.status)) b.commission.status = 'void';
    }
  }

  // حساب مالك التطبيق (لوحة منفصلة). كلمة المرور الأولى تُكتب في ملف داخل مجلد data
  if (!d.users.some((u) => u.role === 'owner')) {
    const pw = process.env.OWNER_PASSWORD || crypto.randomBytes(6).toString('base64url');
    d.counters.users = (d.counters.users || 0) + 1;
    d.users.push({ id: d.counters.users, role: 'owner', name: 'مالك التطبيق', username: 'owner', passwordHash: bcrypt.hashSync(pw, 10), totp: null, createdAt: new Date().toISOString() });
    const { DATA_DIR } = require('./db');
    fs.writeFileSync(path.join(DATA_DIR, 'OWNER-PASSWORD.txt'), `لوحة المالك: /owner\nاسم المستخدم: owner\nكلمة المرور: ${pw}\n\nغيّر كلمة المرور بعد أول دخول ثم احذف هذا الملف.\n`);
    console.log(`\n🔐 تم إنشاء حساب المالك — كلمة المرور في الملف: data/OWNER-PASSWORD.txt\n`);
  }
};
