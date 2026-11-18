// بيانات أولية: الإعدادات، المطارات، حساب المدير، ورحلات تجريبية
// ⚠ الرحلات والأسعار هنا أمثلة للتجربة فقط — احذفها من لوحة التحكم وأدخل رحلاتكم الحقيقية.
const bcrypt = require('bcryptjs');
const { today, addDays, addMinutesLocal, nowIso } = require('./util');

module.exports = function seed(data) {
  data.settings = {
    agencyName: 'وكالة الأسفار',
    agencyPhone: '+222 00 00 00 00',
    whatsapp: '22200000000',
    address: 'نواكشوط، موريتانيا',
    currency: 'أوقية',
    childPercent: 75, // سعر الطفل (2-11 سنة) كنسبة من سعر البالغ
    infantPercent: 10, // سعر الرضيع (أقل من سنتين)
    paymentDeadlineHours: 24, // مهلة الدفع قبل إلغاء الحجز تلقائياً
    paymentMethods: [
      { id: 'bankily', name: 'Bankily', account: '00000000', holder: 'اسم صاحب الحساب', enabled: true },
      { id: 'masrvi', name: 'Masrvi', account: '00000000', holder: 'اسم صاحب الحساب', enabled: true },
      { id: 'sedad', name: 'Sedad', account: '00000000', holder: 'اسم صاحب الحساب', enabled: true },
      { id: 'cash', name: 'الدفع في الوكالة', account: 'نقداً في مقر الوكالة', holder: '', enabled: true },
    ],
    popularDestinations: ['CMN', 'IST', 'DSS', 'CDG', 'JED', 'TUN'],
  };

  data.airports = [
    ['NKC', 'نواكشوط', 'موريتانيا'],
    ['NDB', 'نواذيبو', 'موريتانيا'],
    ['ATR', 'أطار', 'موريتانيا'],
    ['OUZ', 'الزويرات', 'موريتانيا'],
    ['EMN', 'النعمة', 'موريتانيا'],
    ['CMN', 'الدار البيضاء', 'المغرب'],
    ['RAK', 'مراكش', 'المغرب'],
    ['ALG', 'الجزائر', 'الجزائر'],
    ['TUN', 'تونس', 'تونس'],
    ['CAI', 'القاهرة', 'مصر'],
    ['DSS', 'دكار', 'السنغال'],
    ['BKO', 'باماكو', 'مالي'],
    ['ABJ', 'أبيدجان', 'كوت ديفوار'],
    ['LPA', 'لاس بالماس', 'إسبانيا'],
    ['MAD', 'مدريد', 'إسبانيا'],
    ['CDG', 'باريس', 'فرنسا'],
    ['BRU', 'بروكسل', 'بلجيكا'],
    ['IST', 'إسطنبول', 'تركيا'],
    ['JED', 'جدة', 'السعودية'],
    ['MED', 'المدينة المنورة', 'السعودية'],
    ['DXB', 'دبي', 'الإمارات'],
    ['DOH', 'الدوحة', 'قطر'],
  ].map(([code, city, country]) => ({ code, city, country }));

  data.users = [
    {
      id: 1,
      role: 'admin',
      name: 'مدير الوكالة',
      username: 'admin',
      phone: '',
      passwordHash: bcrypt.hashSync('admin123', 10),
      createdAt: nowIso(),
    },
  ];
  data.counters.users = 1;

  // رحلات تجريبية لمدة 45 يوماً
  const templates = [
    { airline: 'الخطوط الملكية المغربية', code: 'AT', no: 'AT 000', from: 'NKC', to: 'CMN', dep: '03:10', dur: 145, basic: 8400, flex: 9800, days: [0, 1, 2, 3, 4, 5, 6] },
    { airline: 'الخطوط الملكية المغربية', code: 'AT', no: 'AT 001', from: 'CMN', to: 'NKC', dep: '23:55', dur: 155, basic: 8400, flex: 9800, days: [0, 1, 2, 3, 4, 5, 6] },
    { airline: 'الموريتانية للطيران', code: 'L6', no: 'L6 000', from: 'NKC', to: 'CMN', dep: '10:45', dur: 150, basic: 9100, flex: 10600, days: [1, 3, 5] },
    { airline: 'الموريتانية للطيران', code: 'L6', no: 'L6 001', from: 'CMN', to: 'NKC', dep: '15:30', dur: 150, basic: 9100, flex: 10600, days: [1, 3, 5] },
    { airline: 'الخطوط الجوية الجزائرية', code: 'AH', no: 'AH 000', from: 'NKC', to: 'CMN', dep: '14:20', dur: 550, stops: 1, via: 'ALG', basic: 10700, flex: 12300, days: [2, 6] },
    { airline: 'الموريتانية للطيران', code: 'L6', no: 'L6 010', from: 'NKC', to: 'DSS', dep: '08:00', dur: 70, basic: 5200, flex: 6100, days: [0, 2, 4, 6] },
    { airline: 'الموريتانية للطيران', code: 'L6', no: 'L6 011', from: 'DSS', to: 'NKC', dep: '11:00', dur: 75, basic: 5200, flex: 6100, days: [0, 2, 4, 6] },
    { airline: 'الخطوط التركية', code: 'TK', no: 'TK 000', from: 'NKC', to: 'IST', dep: '01:30', dur: 480, stops: 1, via: 'DSS', basic: 19500, flex: 23000, days: [1, 4, 6] },
    { airline: 'الخطوط التركية', code: 'TK', no: 'TK 001', from: 'IST', to: 'NKC', dep: '18:40', dur: 500, stops: 1, via: 'DSS', basic: 19500, flex: 23000, days: [1, 4, 6] },
    { airline: 'الخطوط التونسية', code: 'TU', no: 'TU 000', from: 'NKC', to: 'TUN', dep: '06:00', dur: 270, basic: 11900, flex: 13500, days: [3, 0] },
    { airline: 'الخطوط التونسية', code: 'TU', no: 'TU 001', from: 'TUN', to: 'NKC', dep: '20:00', dur: 275, basic: 11900, flex: 13500, days: [3, 0] },
    { airline: 'الخطوط الملكية المغربية', code: 'AT', no: 'AT 010', from: 'NKC', to: 'CDG', dep: '03:10', dur: 600, stops: 1, via: 'CMN', basic: 21500, flex: 25800, days: [0, 1, 2, 3, 4, 5, 6] },
  ];

  data.flights = [];
  let id = 0;
  const start = today();
  for (let i = 0; i < 45; i++) {
    const date = addDays(start, i);
    const dow = new Date(date + 'T12:00').getDay();
    for (const t of templates) {
      if (!t.days.includes(dow)) continue;
      const departAt = `${date}T${t.dep}`;
      data.flights.push({
        id: ++id,
        airline: t.airline,
        airlineFr: AIRLINE_FR[t.code] || '',
        airlineCode: t.code,
        flightNo: t.no,
        from: t.from,
        to: t.to,
        departAt,
        arriveAt: addMinutesLocal(departAt, t.dur),
        durationMin: t.dur,
        stops: t.stops || 0,
        via: t.via || '',
        cabin: 'economy',
        fares: {
          basic: { price: t.basic, baggage: 'حقيبة 23 كغ', refundable: false, changeable: false },
          flex: { price: t.flex, baggage: 'حقيبتان 23 كغ', refundable: true, changeable: true },
        },
        seats: 30,
        active: true,
        demo: true,
      });
    }
  }
  data.counters.flights = id;

  // باقات عمرة/حج تجريبية — احذفها من لوحة التحكم وأضف باقاتكم الحقيقية
  const d1 = addDays(start, 30);
  const d2 = addDays(start, 50);
  data.packages = [
    {
      id: 1, type: 'umrah', demo: true, active: true,
      title: 'عمرة اقتصادية 15 يوماً', titleFr: 'Omra économique 15 jours', titleEn: 'Economy Umrah – 15 days',
      descriptionEn: 'Umrah trip with a religious guide and agency support throughout.', includesEn: ['Return flights', 'Visa', 'Hotels', 'Transfers between cities', 'Religious guide'],
      description: 'رحلة عمرة مع مرشد ديني ومتابعة من الوكالة طوال الرحلة.', descriptionFr: "Omra avec guide religieux et suivi de l'agence pendant tout le séjour.",
      departDate: d1, returnDate: addDays(d1, 15), departCity: 'NKC', airline: 'الخطوط الملكية المغربية',
      hotelMakkah: 'فندق 3 نجوم — 600 م من الحرم', nightsMakkah: 9, hotelMadinah: 'فندق 3 نجوم — 400 م من المسجد النبوي', nightsMadinah: 5,
      includes: ['تذكرة الطيران ذهاباً وعودة', 'التأشيرة', 'الفنادق', 'النقل بين المدن', 'مرشد ديني'],
      includesFr: ['Billet aller-retour', 'Visa', 'Hôtels', 'Transferts', 'Guide religieux'],
      roomPrices: [{ room: 'quad', price: 98000 }, { room: 'triple', price: 108000 }, { room: 'double', price: 125000 }],
      childPrice: 85000, infantPrice: 15000, seats: 40,
    },
    {
      id: 2, type: 'umrah', demo: true, active: true,
      title: 'عمرة مميزة 10 أيام', titleFr: 'Omra confort 10 jours', titleEn: 'Comfort Umrah – 10 days',
      descriptionEn: 'Hotels very close to the two holy mosques.', includesEn: ['Flights', 'Visa', '5-star hotels with breakfast', 'Transfers', 'Sightseeing'],
      description: 'فنادق قريبة جداً من الحرمين.', descriptionFr: 'Hôtels tout proches des deux mosquées.',
      departDate: d2, returnDate: addDays(d2, 10), departCity: 'NKC', airline: 'الخطوط التركية',
      hotelMakkah: 'فندق 5 نجوم — مطل على الحرم', nightsMakkah: 5, hotelMadinah: 'فندق 5 نجوم — 100 م من المسجد النبوي', nightsMadinah: 4,
      includes: ['تذكرة الطيران', 'التأشيرة', 'فنادق 5 نجوم مع الإفطار', 'النقل', 'زيارة المعالم'],
      includesFr: ['Billet', 'Visa', 'Hôtels 5★ avec petit-déjeuner', 'Transferts', 'Visites'],
      roomPrices: [{ room: 'quad', price: 165000 }, { room: 'double', price: 210000 }],
      childPrice: 140000, infantPrice: 20000, seats: 20,
    },
  ];
  data.counters.packages = 2;
};

const AIRLINE_FR = { AT: 'Royal Air Maroc', L6: 'Mauritania Airlines', AH: 'Air Algérie', TK: 'Turkish Airlines', TU: 'Tunisair' };
