// حساب عمولة مالك التطبيق ومستحقاته — تُستعمل في لوحة المالك وفي صفحة "مستحقات المنصة" لدى الوكالة
const { db } = require('./db');
const { ymd } = require('./util');
const { STATUS_LABELS, COMMISSION_LABELS } = require('./services');

const month = (iso) => ymd(new Date(iso)).slice(0, 7);

function bookingRow(b) {
  const first = (b.segments || [])[0];
  return {
    id: b.id,
    ref: b.ref,
    createdAt: b.createdAt,
    customerName: b.customerName,
    source: b.source,
    route: b.package ? b.package.title : first ? `${first.fromCity} ← ${first.toCity}${b.segments.length > 1 ? ' ⇄' : ''}` : '',
    status: b.status,
    statusLabel: STATUS_LABELS[b.status],
    subtotal: b.subtotal,
    studentDiscount: b.studentDiscount || 0,
    pointsDiscount: b.pointsDiscount || 0,
    total: b.total,
    commission: { ...b.commission, label: COMMISSION_LABELS[b.commission.status] },
    // تنبيه: حجز أُلغي أو استُرجع بعد أن دُفع — للمراجعة
    flagged: !!b.commission.voidedAfterPayment,
  };
}

function summary({ from, to } = {}) {
  const d = db();
  let list = d.bookings.slice();
  if (from) list = list.filter((b) => ymd(new Date(b.createdAt)) >= from);
  if (to) list = list.filter((b) => ymd(new Date(b.createdAt)) <= to);
  const sum = (arr) => arr.reduce((a, b) => a + (b.commission.amount || 0), 0);
  const earned = d.bookings.filter((b) => b.commission.status === 'earned');
  const settledTotal = d.settlements.reduce((a, s) => a + s.amount, 0);
  const earnedTotal = sum(earned);

  const months = {};
  for (const b of earned) {
    const m = month(b.commission.earnedAt || b.createdAt);
    months[m] = months[m] || { month: m, earned: 0, count: 0, sales: 0 };
    months[m].earned += b.commission.amount;
    months[m].sales += b.subtotal;
    months[m].count += 1;
  }
  const thisMonth = month(new Date().toISOString());

  return {
    percent: d.owner.commissionPercent,
    earnedTotal,
    pendingTotal: sum(d.bookings.filter((b) => b.commission.status === 'pending' && b.status !== 'awaiting_payment')),
    awaitingTotal: sum(d.bookings.filter((b) => b.status === 'awaiting_payment')),
    settledTotal,
    balance: earnedTotal - settledTotal, // المبلغ المستحق على الوكالة الآن
    thisMonth: months[thisMonth] || { month: thisMonth, earned: 0, count: 0, sales: 0 },
    salesTotal: earned.reduce((a, b) => a + b.subtotal, 0),
    flaggedCount: d.bookings.filter((b) => b.commission.voidedAfterPayment).length,
    months: Object.values(months).sort((a, b) => b.month.localeCompare(a.month)),
    bookings: list.sort((a, b) => b.id - a.id).map(bookingRow),
    settlements: d.settlements.slice().sort((a, b) => b.id - a.id),
    payments: d.platformPayments.slice().sort((a, b) => b.id - a.id),
    pendingPaymentsTotal: d.platformPayments.filter((p) => p.status === 'pending').reduce((a, p) => a + p.amount, 0),
    payoutAccounts: (d.owner.payoutAccounts || []).filter((x) => x.enabled !== false),
    rates: d.settings.exchangeRates,
  };
}

module.exports = { summary };
