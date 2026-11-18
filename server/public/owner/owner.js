/* لوحة مالك التطبيق — منفصلة عن لوحة الوكالة */
(() => {
  const API = '/api/owner';
  const store = {
    get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch {} },
  };
  let TOKEN = store.get('owner_token');
  let ME = null;
  const app = document.getElementById('app');
  const CUR = 'أوقية';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => Number(n || 0).toLocaleString('en') + ' ' + CUR;
  let RATES = {};
  const fx = (n) => { const f = (c) => (RATES[c] ? (n / RATES[c]).toLocaleString('en', { maximumFractionDigits: 0 }) : '—'); return `≈ $${f('USD')} · €${f('EUR')}`; };
  const fmtIso = (s) => (s ? new Date(s).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '');
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const today = () => new Date().toISOString().slice(0, 10);

  let toastTimer;
  function toast(msg, err = false) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'show' + (err ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.className = ''), 3000);
  }

  async function api(path, { method = 'GET', body } = {}) {
    const headers = {};
    if (TOKEN) headers.Authorization = 'Bearer ' + TOKEN;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(API + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== '/login') { logout(); throw new Error(data.error || 'سجّل الدخول'); }
    if (!res.ok) throw new Error(data.error || 'حدث خطأ');
    return data;
  }
  async function run(fn, okMsg) {
    try { const r = await fn(); if (okMsg) toast(okMsg); return r; } catch (e) { toast(e.message, true); throw e; }
  }
  function logout() { TOKEN = null; ME = null; store.set('owner_token', null); renderLogin(); }

  // ---------- الدخول ----------
  function renderLogin(needCode = false, creds = null) {
    app.innerHTML = `<div class="login"><form class="card" id="lf">
      <div class="brand" style="color:var(--ink);padding:0"><span class="brand-mark">◆</span> لوحة مالك التطبيق</div>
      ${needCode ? `<label class="f">رمز التحقق من تطبيق المصادقة<input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required class="ltr" autofocus></label>` : `
      <label class="f">اسم المستخدم<input name="username" required autocomplete="username" class="ltr" value="owner"></label>
      <label class="f">كلمة المرور<input name="password" type="password" required autocomplete="current-password" class="ltr"></label>`}
      <button class="btn primary" type="submit">دخول</button>
      <div class="small muted">هذه اللوحة خاصة بمالك التطبيق فقط ولا تظهر للوكالة.</div>
    </form></div>`;
    $('#lf').onsubmit = async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target));
      const body = needCode ? { ...creds, code: fd.code } : fd;
      const r = await run(() => api('/login', { method: 'POST', body }));
      if (r.needCode) return renderLogin(true, body);
      TOKEN = r.token; ME = r.user; store.set('owner_token', TOKEN);
      router();
    };
  }

  const NAV = [['#/', 'الملخص'], ['#/bookings', 'العمولة لكل حجز'], ['#/settlements', 'الدفعات المستلمة'], ['#/audit', 'سجل العمليات'], ['#/settings', 'الإعدادات والأمان']];
  let PENDING = 0;
  function shell(active, html) {
    app.innerHTML = `<div class="layout">
      <aside class="side"><div class="brand"><span class="brand-mark">◆</span>لوحة المالك</div>
        <nav class="nav">${NAV.map(([h, l]) => `<a href="${h}" class="${h === active ? 'on' : ''}">${l}${h === '#/settlements' && PENDING ? `<span class="badge">${PENDING}</span>` : ''}</a>`).join('')}</nav>
        <div class="side-foot"><span>${esc(ME.name)}</span><button id="logout">تسجيل الخروج</button></div></aside>
      <main class="main" id="main">${html}</main></div>`;
    $('#logout').onclick = logout;
    return $('#main');
  }

  async function router() {
    if (!TOKEN) return renderLogin();
    try {
      if (!ME) ME = await api('/me');
      try { const sm = await api('/summary'); PENDING = sm.payments.filter((x) => x.status === 'pending').length; RATES = sm.rates || {}; } catch {}
      const page = (location.hash || '#/').slice(2).split('/')[0];
      if (!page) return await pageSummary();
      if (page === 'bookings') return await pageBookings();
      if (page === 'settlements') return await pageSettlements();
      if (page === 'audit') return await pageAudit();
      if (page === 'settings') return await pageSettings();
      location.hash = '#/';
    } catch (e) {
      if (TOKEN) toast(e.message, true);
    }
  }
  window.addEventListener('hashchange', router);

  // ---------- الملخص ----------
  async function pageSummary() {
    const [s, o] = await Promise.all([api('/summary'), api('/overview')]);
    const max = Math.max(1, ...s.months.map((m) => m.earned));
    const src = { flights: 'رحلات الوكالة', amadeus: 'Amadeus', request: 'طلبات التسعيرة', package: 'العمرة والحج' };
    shell('#/', `
      <div class="head"><h1>أرباحك من التطبيق</h1><span class="muted">عمولتك الحالية: <b>${s.percent}%</b></span></div>
      <div class="grid g4">
        <div class="card stat" style="outline:2px solid var(--gold)"><span class="big">${money(s.balance)}</span><span class="l">المستحق لك على الوكالة الآن · ${fx(s.balance)}</span></div>
        <div class="card stat"><span class="big">${money(s.thisMonth.earned)}</span><span class="l">ربح هذا الشهر · ${s.thisMonth.count} تذكرة · مبيعات ${money(s.thisMonth.sales)}</span></div>
        <div class="card stat"><span class="big">${money(s.earnedTotal)}</span><span class="l">إجمالي أرباحك منذ البداية · ${fx(s.earnedTotal)}</span></div>
        <div class="card stat"><span class="big">${money(s.settledTotal)}</span><span class="l">ما استلمته من الوكالة</span></div>
      </div>
      ${s.pendingPaymentsTotal ? `<a class="alert warn row" href="#/settlements" style="margin-top:14px;text-decoration:none"><b>أرسلت الوكالة دفعات بمبلغ ${money(s.pendingPaymentsTotal)} تنتظر تأكيدك</b><span class="spacer"></span>راجعها ←</a>` : ''}
      ${!s.payoutAccounts.length ? `<a class="alert info row" href="#/settings" style="margin-top:14px;text-decoration:none">أضف حساباتك (Bankily / Masrvi / حساب بنكي) لتستطيع الوكالة تحويل مستحقاتك وإرسال الإثبات من لوحتها ←</a>` : ''}
      <div class="grid g4" style="margin-top:14px">
        <div class="card stat"><span class="n">${money(s.pendingTotal)}</span><span class="l">عمولات قادمة (مدفوعة، لم تصدر تذاكرها بعد)</span></div>
        <div class="card stat"><span class="n">${o.customers}</span><span class="l">زبون مسجّل (+${o.customersThisMonth} هذا الشهر)</span></div>
        <div class="card stat"><span class="n">${o.bookingsThisMonth}</span><span class="l">حجز هذا الشهر · ${o.ticketsThisMonth} تذكرة صادرة</span></div>
        <a class="card stat ${s.flaggedCount ? 'hot' : ''}" href="#/bookings"><span class="n">${s.flaggedCount}</span><span class="l">حجوزات أُلغيت أو استُرجعت بعد الدفع (راجعها)</span></a>
      </div>
      <div class="grid g2" style="margin-top:18px;align-items:start">
        <div class="card"><h2 style="margin-bottom:12px">أرباحك حسب الشهر</h2>
          ${s.months.map((m) => `<div style="padding:8px 0;border-bottom:1px solid #f0ebe0"><div class="row"><span class="mono">${m.month}</span><span class="muted small">${m.count} تذكرة · مبيعات ${money(m.sales)}</span><span class="spacer"></span><b>${money(m.earned)}</b></div><div class="bar" style="width:${Math.max(2, (m.earned / max) * 100)}%;margin-top:6px"></div></div>`).join('') || '<div class="muted">لا توجد أرباح بعد</div>'}</div>
        <div class="grid">
          <div class="card"><h2 style="margin-bottom:12px">التذاكر الصادرة حسب المصدر</h2>${o.bySource.map((x) => `<div class="row" style="padding:6px 0;border-bottom:1px solid #f0ebe0"><span>${src[x.source]}</span><span class="spacer"></span><b>${x.count}</b></div>`).join('')}</div>
          <div class="card"><h2 style="margin-bottom:8px">معلومات</h2><div class="small muted" style="line-height:1.9">• العمولة = ${s.percent}% من السعر المعروض للزبون (بعد خصم الطالب، وقبل خصم النقاط الذي تتحمله الوكالة).<br>• تصبح مستحقة عند إصدار التذكرة، وتُلغى تلقائياً عند الإلغاء أو الاسترجاع.<br>• الوكالة ترى نفس هذه الأرقام في صفحة "مستحقات المنصة" ولا تستطيع تعديلها.<br>• رصيد النقاط غير المستعملة لدى الزبائن: ${o.pointsOutstanding.toLocaleString('en')} نقطة.<br>• الطلاب الموثّقون: ${o.students}.</div></div>
        </div>
      </div>`);
  }

  // ---------- العمولة لكل حجز ----------
  async function pageBookings() {
    const main = shell('#/bookings', `<div class="head"><h1>العمولة لكل حجز</h1>
      <div class="row"><label class="f">من<input type="date" id="from"></label><label class="f">إلى<input type="date" id="to"></label><button class="btn" id="csv" style="align-self:flex-end">تصدير CSV</button></div></div>
      <div class="tabs">${[['all', 'الكل'], ['earned', 'مستحقة'], ['pending', 'معلّقة'], ['void', 'ملغاة'], ['flagged', 'أُلغيت بعد الدفع']].map(([k, l], i) => `<button data-s="${k}" class="${i === 0 ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div id="sum" class="row" style="margin-bottom:10px"></div><div id="list"></div>`);
    let filter = 'all';
    let rows = [];
    const load = async () => {
      const q = new URLSearchParams({ from: $('#from').value, to: $('#to').value });
      const s = await api('/summary?' + q);
      rows = s.bookings.filter((b) => (filter === 'all' ? true : filter === 'flagged' ? b.flagged : b.commission.status === filter));
      const total = rows.filter((b) => b.commission.status === 'earned').reduce((a, b) => a + b.commission.amount, 0);
      $('#sum', main).innerHTML = `<span class="muted">${rows.length} حجز</span><span class="spacer"></span><span>مجموع المستحق في هذه القائمة: <b>${money(total)}</b></span>`;
      $('#list', main).innerHTML = rows.length ? `<div class="table-wrap"><table><thead><tr><th>الحجز</th><th>التاريخ</th><th>الزبون</th><th>المسار</th><th>السعر المعروض</th><th>خصم النقاط</th><th>دفع الزبون</th><th>عمولتك</th><th>حالة العمولة</th><th>حالة الحجز</th></tr></thead><tbody>
        ${rows.map((b) => `<tr><td class="mono">${b.ref}</td><td class="small">${fmtIso(b.createdAt)}</td><td>${esc(b.customerName)}</td><td>${esc(b.route)}${b.studentDiscount ? ' <span class="pill s-new">طالب</span>' : ''}</td><td>${money(b.subtotal)}</td><td>${b.pointsDiscount ? money(b.pointsDiscount) : '—'}</td><td>${money(b.total)}</td>
          <td><b>${money(b.commission.amount)}</b> <span class="muted small">${b.commission.percent}%</span></td>
          <td><span class="pill ${b.commission.status === 'earned' ? 's-ticketed' : b.commission.status === 'void' ? 's-cancelled' : 's-new'}">${esc(b.commission.label)}</span>${b.flagged ? ' <span class="pill s-confirmed">⚠ أُلغي بعد الدفع</span>' : ''}</td>
          <td class="small">${esc(b.statusLabel)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="card empty">لا يوجد</div>';
    };
    $$('.tabs button', main).forEach((b) => (b.onclick = () => { filter = b.dataset.s; $$('.tabs button', main).forEach((x) => x.classList.toggle('on', x === b)); load(); }));
    $('#from').onchange = load; $('#to').onchange = load;
    $('#csv').onclick = () => {
      const head = ['ref', 'date', 'customer', 'route', 'displayed_price', 'points_discount', 'paid', 'commission_percent', 'commission', 'commission_status', 'booking_status'];
      const lines = rows.map((b) => [b.ref, b.createdAt, b.customerName, b.route, b.subtotal, b.pointsDiscount, b.total, b.commission.percent, b.commission.amount, b.commission.status, b.status].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
      const blob = new Blob(['﻿' + [head.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `commission-${today()}.csv`; a.click();
    };
    await load();
  }

  // ---------- الدفعات ----------
  async function pageSettlements() {
    const s = await api('/summary');
    const main = shell('#/settlements', `<div class="head"><h1>الدفعات المستلمة من الوكالة</h1></div>
      <div class="grid g3"><div class="card stat"><span class="big">${money(s.balance)}</span><span class="l">المستحق الآن</span></div><div class="card stat"><span class="n">${money(s.earnedTotal)}</span><span class="l">إجمالي المستحق</span></div><div class="card stat"><span class="n">${money(s.settledTotal)}</span><span class="l">إجمالي المستلم</span></div></div>
      <div class="card" style="margin-top:14px"><h2 style="margin-bottom:10px">دفعات أرسلتها الوكالة</h2>
        ${s.payments.length ? s.payments.map((p) => `<div style="padding:10px 0;border-bottom:1px solid #f0ebe0" class="grid">
          <div class="row"><b style="font-size:18px">${money(p.amount)}</b><span class="small muted">${fx(p.amount)}</span><span class="pill ${{ pending: 's-new', approved: 's-ticketed', rejected: 's-cancelled' }[p.status]}">${{ pending: 'بانتظار تأكيدك', approved: 'مؤكدة' + (p.approvedAmount !== p.amount ? ' (' + money(p.approvedAmount) + ')' : ''), rejected: 'مرفوضة' }[p.status]}</span><span class="spacer"></span><span class="small muted">${fmtIso(p.createdAt)}</span></div>
          <div class="small">عبر <b>${esc(p.method)}</b>${p.reference ? ` · رقم العملية <span class="mono">${esc(p.reference)}</span>` : ''} · أرسلها ${esc(p.submittedBy)}${p.note ? ' · ' + esc(p.note) : ''} ${p.receipt ? `· <a target="_blank" rel="noopener" href="/api/files/${encodeURIComponent(p.receipt.name)}?token=${encodeURIComponent(TOKEN)}">عرض الإيصال</a>` : ''}</div>
          ${p.status === 'rejected' ? `<div class="small muted">سبب الرفض: ${esc(p.reason)}</div>` : ''}
          ${p.status === 'pending' ? `<div class="row"><span class="small">تحقق من وصول المبلغ إلى حسابك ثم:</span><label class="f">المبلغ الذي وصل<input type="number" data-amt="${p.id}" value="${p.amount}" style="width:140px"></label><button class="btn primary" data-ok="${p.id}" style="align-self:flex-end">تأكيد الاستلام</button><button class="btn danger" data-no="${p.id}" style="align-self:flex-end">لم يصل</button></div>` : ''}
        </div>`).join('') : '<div class="muted">لا توجد دفعات من الوكالة بعد</div>'}
      </div>
      <h2 style="margin:18px 0 0">تسجيل دفعة يدوياً (نقداً أو خارج النظام)</h2>
      <form class="card row" id="sf" style="margin:10px 0 14px">
        <label class="f">المبلغ (${CUR})<input name="amount" type="number" min="1" required value="${Math.max(0, s.balance) || ''}"></label>
        <label class="f">التاريخ<input name="date" type="date" value="${today()}"></label>
        <label class="f">الطريقة<input name="method" placeholder="Bankily / نقداً / تحويل"></label>
        <label class="f" style="flex:1">ملاحظة<input name="note" placeholder="مثال: عمولة شهر أكتوبر"></label>
        <button class="btn primary" style="align-self:flex-end">تسجيل الاستلام</button></form>
      <div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>المبلغ</th><th>الطريقة</th><th>ملاحظة</th><th>سُجّل في</th><th></th></tr></thead><tbody>
        ${s.settlements.map((x) => `<tr><td>${esc(x.date)}</td><td><b>${money(x.amount)}</b></td><td>${esc(x.method)}</td><td>${esc(x.note)}</td><td class="small">${fmtIso(x.createdAt)}</td><td><button class="btn sm danger" data-del="${x.id}">حذف</button></td></tr>`).join('') || '<tr><td colspan="6" class="muted">لا توجد دفعات</td></tr>'}
      </tbody></table></div>
      <div class="small muted" style="margin-top:10px">كل دفعة تسجلها تظهر للوكالة فوراً في صفحة "مستحقات المنصة"، وتُكتب في سجل العمليات.</div>`);
    $('#sf').onsubmit = async (e) => { e.preventDefault(); await run(() => api('/settlements', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }), 'تم التسجيل'); pageSettlements(); };
    $$('[data-ok]', main).forEach((b) => (b.onclick = () => { const amt = $(`[data-amt="${b.dataset.ok}"]`, main).value; if (confirm(`تأكيد استلام ${Number(amt).toLocaleString('en')} ${CUR}؟`)) run(() => api(`/payments/${b.dataset.ok}/approve`, { method: 'POST', body: { amount: Number(amt) } }), 'تم التأكيد وخُصم من المستحق').then(() => { PENDING = Math.max(0, PENDING - 1); pageSettlements(); }); }));
    $$('[data-no]', main).forEach((b) => (b.onclick = () => { const reason = prompt('السبب (يظهر للوكالة):', 'لم يصل المبلغ إلى حسابي'); if (reason) run(() => api(`/payments/${b.dataset.no}/reject`, { method: 'POST', body: { reason } }), 'تم الرفض').then(() => { PENDING = Math.max(0, PENDING - 1); pageSettlements(); }); }));
    $$('[data-del]', main).forEach((b) => (b.onclick = () => confirm('حذف هذه الدفعة؟') && run(() => api('/settlements/' + b.dataset.del, { method: 'DELETE' }), 'تم الحذف').then(pageSettlements)));
  }

  // ---------- السجل ----------
  async function pageAudit() {
    const main = shell('#/audit', `<div class="head"><h1>سجل العمليات</h1><div class="row"><select id="act"><option value="">كل العمليات</option><option value="booking.status">تغيير حالة الحجوزات</option><option value="booking">كل ما يخص الحجوزات</option><option value="flight">الرحلات والأسعار</option><option value="settings">الإعدادات</option><option value="student">الطلاب</option><option value="points">النقاط اليدوية</option><option value="commission">العمولة</option><option value="settlement">الدفعات</option><option value="amadeus">Amadeus</option><option value="owner">دخول المالك والأمان</option></select><input id="q" placeholder="بحث"></div></div>
      <div class="alert info" style="margin-bottom:12px">كل تغيير مهم يُسجَّل هنا باسم من قام به ووقته، ولا يمكن للوكالة حذف السجل أو حذف الحجوزات. انتبه خاصة للحجوزات التي تُلغى بعد الدفع.</div><div id="list"></div>`);
    const roles = { admin: 'مدير الوكالة', staff: 'موظف', customer: 'زبون', owner: 'أنت', system: 'النظام' };
    const load = async () => {
      const list = await api(`/audit?action=${$('#act').value}&q=${encodeURIComponent($('#q').value)}`);
      $('#list', main).innerHTML = list.length ? `<div class="table-wrap"><table><thead><tr><th>الوقت</th><th>بواسطة</th><th>العملية</th></tr></thead><tbody>
        ${list.map((a) => `<tr><td class="small" style="white-space:nowrap">${fmtIso(a.at)}</td><td>${esc(a.actor)} <span class="muted small">${roles[a.role] || a.role}</span></td><td>${esc(a.text)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="card empty">لا يوجد</div>';
    };
    $('#act').onchange = load;
    let t; $('#q').oninput = () => { clearTimeout(t); t = setTimeout(load, 300); };
    await load();
  }

  // ---------- الإعدادات والأمان ----------
  async function pageSettings() {
    const s = await api('/summary');
    ME = await api('/me');
    const accs = await api('/payout-accounts');
    const main = shell('#/settings', `<div class="head"><h1>الإعدادات والأمان</h1></div>
      <div class="grid g2" style="align-items:start">
        <form class="card grid" id="accf" style="grid-column:1/-1"><h2>حساباتك لاستلام المستحقات</h2>
          <div class="small muted">تظهر هذه الحسابات للوكالة في صفحة "مستحقات المنصة" لتحوّل إليها، ثم ترسل لك إثبات الدفع لتؤكده.</div>
          <div id="accRows" class="grid" style="gap:8px"></div>
          <div class="row"><button type="button" class="btn sm" id="accAdd">+ إضافة حساب</button><span class="spacer"></span><button class="btn primary">حفظ الحسابات</button></div>
        </form>
        <form class="card grid" id="cf"><h2>نسبة عمولتك</h2>
          <label class="f">النسبة %<input name="percent" type="number" min="0" max="50" step="0.1" value="${s.percent}"></label>
          <div class="small muted">تُطبَّق على الحجوزات الجديدة فقط؛ الحجوزات السابقة تحتفظ بالنسبة التي أُنشئت بها. التغيير يُسجَّل ويظهر للوكالة.</div>
          <button class="btn primary">حفظ</button></form>
        <div class="grid">
          <form class="card grid" id="pf"><h2>تغيير كلمة المرور</h2>
            <label class="f">الحالية<input type="password" name="currentPassword" required class="ltr"></label>
            <label class="f">الجديدة (10 أحرف على الأقل)<input type="password" name="newPassword" required minlength="10" class="ltr"></label>
            <button class="btn">تغيير</button></form>
          <div class="card grid" id="tfa"><h2>التحقق الثنائي</h2>
            ${ME.totpEnabled ? `<div class="alert info">✔ مفعّل. عند الدخول يُطلب رمز من تطبيق المصادقة على هاتفك.</div>
              <form class="row" id="tdis"><input name="code" inputmode="numeric" maxlength="6" placeholder="الرمز الحالي" class="ltr" required><button class="btn danger">إيقاف</button></form>`
            : `<div class="small muted">يحمي لوحتك حتى لو عرف أحد كلمة المرور. تحتاج تطبيق Google Authenticator أو Microsoft Authenticator.</div><button class="btn primary" id="tset">تفعيل</button><div id="tstep"></div>`}
          </div>
        </div>
      </div>`);
    let rows = accs.length ? accs.map((a) => ({ ...a })) : [{ name: 'Bankily', account: '', holder: '', enabled: true }];
    const drawAcc = () => {
      $('#accRows', main).innerHTML = rows.map((a, i) => `<div class="grid g4" style="align-items:end;padding:8px;border:1px solid var(--line);border-radius:10px">
        <label class="f">الوسيلة<input data-i="${i}" data-k="name" value="${esc(a.name)}" placeholder="Bankily / Masrvi / Sedad / بنك"></label>
        <label class="f">رقم الحساب / الهاتف<input data-i="${i}" data-k="account" class="ltr" value="${esc(a.account)}"></label>
        <label class="f">باسم<input data-i="${i}" data-k="holder" value="${esc(a.holder)}"></label>
        <div class="row"><label class="check"><input type="checkbox" data-i="${i}" data-k="enabled" ${a.enabled !== false ? 'checked' : ''}> مفعّل</label><button type="button" class="btn sm danger" data-rm="${i}">حذف</button></div></div>`).join('');
      $$('#accRows input', main).forEach((inp) => (inp.oninput = inp.onchange = () => (rows[inp.dataset.i][inp.dataset.k] = inp.type === 'checkbox' ? inp.checked : inp.value)));
      $$('[data-rm]', main).forEach((b) => (b.onclick = () => { rows.splice(Number(b.dataset.rm), 1); drawAcc(); }));
    };
    drawAcc();
    $('#accAdd').onclick = () => { rows.push({ name: '', account: '', holder: '', enabled: true }); drawAcc(); };
    $('#accf').onsubmit = async (e) => { e.preventDefault(); await run(() => api('/payout-accounts', { method: 'PUT', body: { accounts: rows } }), 'تم حفظ الحسابات'); pageSettings(); };
    $('#cf').onsubmit = async (e) => { e.preventDefault(); const p = new FormData(e.target).get('percent'); if (!confirm(`تغيير العمولة إلى ${p}% للحجوزات الجديدة؟`)) return; await run(() => api('/commission', { method: 'PUT', body: { percent: Number(p) } }), 'تم الحفظ'); };
    $('#pf').onsubmit = async (e) => { e.preventDefault(); await run(() => api('/password', { method: 'PUT', body: Object.fromEntries(new FormData(e.target)) }), 'تم تغيير كلمة المرور'); e.target.reset(); };
    if ($('#tdis')) $('#tdis').onsubmit = async (e) => { e.preventDefault(); await run(() => api('/2fa/disable', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }), 'تم الإيقاف'); pageSettings(); };
    if ($('#tset')) $('#tset').onclick = async () => {
      const r = await run(() => api('/2fa/setup', { method: 'POST' }));
      $('#tstep', main).innerHTML = `<div class="grid"><div class="small">1) امسح الرمز بتطبيق المصادقة:</div><div id="qr"></div>
        <div class="small muted">أو أدخل هذا المفتاح يدوياً: <span class="mono">${esc(r.secret)}</span></div>
        <form class="row" id="ten"><label class="f">2) أدخل الرمز الظاهر في التطبيق<input name="code" inputmode="numeric" maxlength="6" required class="ltr"></label><button class="btn primary" style="align-self:flex-end">تأكيد</button></form></div>`;
      try { new QRCode($('#qr', main), { text: r.uri, width: 180, height: 180 }); } catch { $('#qr', main).textContent = ''; }
      $('#ten', main).onsubmit = async (e) => { e.preventDefault(); await run(() => api('/2fa/enable', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }), 'تم تفعيل التحقق الثنائي'); pageSettings(); };
    };
  }

  router();
})();
