/* لوحة تحكم الوكالة — JavaScript بدون مكتبات */
(() => {
  const API = '/api';
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
  };
  let TOKEN = store.get('agency_token');
  let ME = null;
  let CFG = { statusLabels: {}, requestLabels: {}, currency: '' };
  let STATS = {};
  let AIRPORTS = [];
  const app = document.getElementById('app');

  // ---------- أدوات ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => Number(n || 0).toLocaleString('en') + ' ' + esc(CFG.currency);
  // ما يعادل المبلغ بالدولار واليورو حسب أسعار الصرف في الإعدادات
  const fx = (n) => { const r = CFG.exchangeRates || {}; const f = (x, c) => (r[c] ? (x / r[c]).toLocaleString('en', { maximumFractionDigits: 0 }) : '—'); return `≈ $${f(n, 'USD')} · €${f(n, 'EUR')}`; };
  const fmtDT = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)} ${s.slice(11, 16)}` : '');
  const fmtIso = (s) => { if (!s) return ''; const d = new Date(s); return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }); };
  const dur = (m) => `${Math.floor(m / 60)} س ${m % 60} د`;
  const who = (b) => ({ customer: 'الزبون', system: 'النظام' }[b] || b);
  const city = (c) => (AIRPORTS.find((a) => a.code === c) || {}).city || c;
  const pill = (status, label) => `<span class="pill s-${esc(status)}">${esc(label || status)}</span>`;
  const paxType = { adult: 'بالغ', child: 'طفل', infant: 'رضيع' };
  const ROOMS = { quad: 'رباعية', triple: 'ثلاثية', double: 'ثنائية', single: 'فردية' };
  const SOURCE = { flights: 'رحلات الوكالة', amadeus: 'Amadeus', request: 'طلب تسعيرة', package: 'باقة' };
  const routeOf = (b) => (b.package ? `${b.package.type === 'hajj' ? 'حج' : 'عمرة'}: ${esc(b.package.title)}` : b.segments.length ? `${esc(b.segments[0].fromCity)} ← ${esc(b.segments[0].toCity)}${b.segments.length > 1 ? ' ⇄' : ''}` : '—');
  const travelDate = (b) => (b.package ? b.package.departDate : b.segments[0] ? fmtDT(b.segments[0].departAt) : '');
  const tags = (b) => [b.source === 'amadeus' ? '<span class="pill s-quoted">Amadeus</span>' : '', b.source === 'package' ? '<span class="pill s-accepted">باقة</span>' : '', b.studentDiscount ? '<span class="pill s-new">طالب</span>' : '', b.pointsUsed ? '<span class="pill s-confirmed">نقاط</span>' : ''].join(' ');
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const fileUrl = (name) => `${API}/files/${encodeURIComponent(name)}?token=${encodeURIComponent(TOKEN)}`;

  let toastTimer;
  function toast(msg, err = false) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'show' + (err ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.className = ''), 3000);
  }

  async function api(path, { method = 'GET', body, form } = {}) {
    const headers = {};
    if (TOKEN) headers.Authorization = 'Bearer ' + TOKEN;
    let payload;
    if (form) payload = form;
    else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    const res = await fetch(API + path, { method, headers, body: payload });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== '/admin/login') { logout(); throw new Error(data.error || 'سجّل الدخول'); }
    if (!res.ok) throw new Error(data.error || 'حدث خطأ');
    return data;
  }

  // تنفيذ عملية مع رسالة خطأ تلقائية
  async function run(fn, okMsg) {
    try { const r = await fn(); if (okMsg) toast(okMsg); return r; } catch (e) { toast(e.message, true); throw e; }
  }

  function logout() { TOKEN = null; ME = null; store.set('agency_token', null); renderLogin(); }

  // ---------- تسجيل الدخول ----------
  function renderLogin() {
    app.innerHTML = `
    <div class="login"><form class="card" id="lf">
      <div class="brand" style="color:var(--ink);padding:0"><span class="brand-mark" style="color:#fff">✈</span> لوحة تحكم الوكالة</div>
      <label class="f">اسم المستخدم<input name="username" required autocomplete="username" class="ltr"></label>
      <label class="f">كلمة المرور<input name="password" type="password" required autocomplete="current-password" class="ltr"></label>
      <button class="btn primary" type="submit">دخول</button>
    </form></div>`;
    $('#lf').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const r = await run(() => api('/admin/login', { method: 'POST', body: { username: fd.get('username'), password: fd.get('password') } }));
      TOKEN = r.token; ME = r.user; store.set('agency_token', TOKEN);
      await boot();
    };
  }

  // ---------- الهيكل ----------
  const NAV = [
    ['#/', 'الرئيسية', null],
    ['#/bookings', 'الحجوزات', () => (STATS.paymentReview || 0) + (STATS.toIssue || 0)],
    ['#/requests', 'طلبات التسعيرة', () => STATS.newQuoteRequests],
    ['#/students', 'توثيق الطلاب', () => STATS.pendingStudents],
    ['#/flights', 'الرحلات والأسعار', null],
    ['#/packages', 'العمرة والحج', null],
    ['#/airports', 'المطارات', null],
    ['#/customers', 'الزبائن والنقاط', null],
    ['#/platform', 'مستحقات المنصة', () => STATS.platformRejected],
    ['#/settings', 'الإعدادات', null],
  ];

  function shell(active, html) {
    app.innerHTML = `
    <div class="layout">
      <aside class="side">
        <div class="brand"><span class="brand-mark">✈</span>${esc(CFG.agencyName || 'الوكالة')}</div>
        <nav class="nav" id="nav">${navHtml(active)}</nav>
        <div class="side-foot"><span>${esc(ME.name)} · ${ME.role === 'admin' ? 'مدير' : 'موظف'}</span><button id="logout">تسجيل الخروج</button></div>
      </aside>
      <main class="main" id="main">${html}</main>
    </div>`;
    $('#logout').onclick = logout;
    return $('#main');
  }
  function navHtml(active) {
    return NAV.map(([href, label, count]) => {
      const n = count ? count() : 0;
      return `<a href="${href}" class="${active === href ? 'on' : ''}">${label}${n ? `<span class="badge">${n}</span>` : ''}</a>`;
    }).join('');
  }
  function activeHref() {
    const page = (location.hash || '#/').slice(2).split('?')[0].split('/')[0];
    const map = { booking: 'bookings', request: 'requests' };
    return '#/' + (map[page] || page);
  }
  async function refreshStats() {
    try {
      STATS = await api('/admin/stats');
      const nav = $('#nav');
      if (nav) nav.innerHTML = navHtml(activeHref());
    } catch {}
  }

  // ---------- الموجّه ----------
  async function router() {
    if (!ME) return;
    document.querySelectorAll('.modal-bg').forEach((m) => m.remove());
    const parts = (location.hash || '#/').slice(2).split('?')[0].split('/');
    const [page, id] = parts;
    try {
      if (!page) return await pageDashboard();
      if (page === 'bookings') return await pageBookings();
      if (page === 'booking') return await pageBooking(id);
      if (page === 'requests') return await pageRequests();
      if (page === 'request') return await pageRequest(id);
      if (page === 'flights') return await pageFlights();
      if (page === 'packages') return await pagePackages();
      if (page === 'students') return await pageStudents();
      if (page === 'platform') return await pagePlatform();
      if (page === 'airports') return await pageAirports();
      if (page === 'customers') return await pageCustomers();
      if (page === 'settings') return await pageSettings();
      location.hash = '#/';
    } catch (e) {
      if (ME) toast(e.message, true);
    }
  }
  window.addEventListener('hashchange', router);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.modal-bg').forEach((m) => m.remove()); });

  // ---------- الرئيسية ----------
  async function pageDashboard() {
    STATS = await api('/admin/stats');
    const [review, issue, reqs] = await Promise.all([
      api('/admin/bookings?status=payment_review'),
      api('/admin/bookings?status=confirmed'),
      api('/admin/requests?status=new'),
    ]);
    const card = (n, l, href, hot) => `<a class="card stat ${hot && n ? 'hot' : ''}" href="${href}"><span class="n">${n}</span><span class="l">${l}</span></a>`;
    const main = shell('#/', `
      <div class="head"><h1>مرحباً ${esc(ME.name)}</h1><span class="muted">${new Date().toLocaleDateString('ar', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
      <div class="grid g4">
        ${card(STATS.paymentReview, 'دفعات تنتظر التحقق', '#/bookings?payment_review', true)}
        ${card(STATS.toIssue, 'مدفوعة — بانتظار إصدار التذكرة', '#/bookings?confirmed', true)}
        ${card(STATS.newQuoteRequests, 'طلبات تسعيرة جديدة', '#/requests', true)}
        ${card(STATS.openCustomerRequests, 'طلبات إلغاء/تعديل مفتوحة', '#/bookings?open_requests', true)}
        ${card(STATS.pendingStudents, 'طلاب بانتظار التوثيق', '#/students', true)}
        <a class="card stat" href="#/platform"><span class="n" style="font-size:22px">${money(STATS.monthCommission)}</span><span class="l">عمولة المنصة هذا الشهر</span></a>
        ${card(STATS.awaitingPayment, 'حجوزات بانتظار الدفع', '#/bookings?awaiting_payment')}
        ${card(STATS.todayBookings, 'حجوزات اليوم', '#/bookings')}
        ${card(STATS.monthTickets, 'تذاكر صادرة هذا الشهر', '#/bookings?ticketed')}
        <div class="card stat"><span class="n" style="font-size:22px">${money(STATS.monthRevenue)}</span><span class="l">مبيعات هذا الشهر (مدفوعة)</span></div>
      </div>
      <div class="grid g2" style="margin-top:18px">
        <div class="card"><h2 style="margin-bottom:10px">دفعات تنتظر التحقق</h2>${miniBookings(review)}</div>
        <div class="card"><h2 style="margin-bottom:10px">بانتظار إصدار التذكرة</h2>${miniBookings(issue)}</div>
        <div class="card"><h2 style="margin-bottom:10px">طلبات تسعيرة جديدة</h2>${reqs.length ? reqs.slice(0, 8).map((r) => `<a class="row" href="#/request/${r.id}" style="padding:8px 0;border-bottom:1px solid #f0ebe0;text-decoration:none;color:inherit"><b>${esc(r.fromCity)} ← ${esc(r.toCity)}</b><span class="muted small">${esc(r.date)}</span><span class="spacer"></span><span class="small">${esc(r.customerName)}</span></a>`).join('') : '<div class="muted">لا يوجد</div>'}</div>
      </div>`);
    return main;
  }
  function miniBookings(list) {
    if (!list.length) return '<div class="muted">لا يوجد</div>';
    return list.slice(0, 8).map((b) => `<a class="row" href="#/booking/${b.id}" style="padding:8px 0;border-bottom:1px solid #f0ebe0;text-decoration:none;color:inherit"><span class="mono">${b.ref}</span><span>${esc(b.customerName)}</span><span class="spacer"></span><b>${money(b.total)}</b></a>`).join('');
  }

  // ---------- الحجوزات ----------
  async function pageBookings() {
    const q = location.hash.split('?')[1] || '';
    const tabs = [['', 'الكل'], ['payment_review', 'تحقق الدفع'], ['confirmed', 'للإصدار'], ['awaiting_payment', 'بانتظار الدفع'], ['ticketed', 'صادرة'], ['open_requests', 'طلبات إلغاء/تعديل'], ['cancelled', 'ملغاة'], ['expired', 'منتهية']];
    const main = shell('#/bookings', `
      <div class="head"><h1>الحجوزات</h1><input id="search" placeholder="بحث: رقم الحجز، PNR، اسم، هاتف، جواز" style="width:min(360px,100%)"></div>
      <div class="tabs">${tabs.map(([k, l]) => `<button data-s="${k}" class="${k === q ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div id="list"></div>`);
    let status = q;
    const load = async () => {
      const s = $('#search').value.trim();
      const list = await api(`/admin/bookings?status=${status}&q=${encodeURIComponent(s)}`);
      $('#list', main).innerHTML = list.length ? `<div class="table-wrap"><table>
        <thead><tr><th>رقم الحجز</th><th>الزبون</th><th>المسار</th><th>تاريخ السفر</th><th>المسافرون</th><th>المبلغ</th><th>الدفع</th><th>الحالة</th><th></th></tr></thead>
        <tbody>${list.map((b) => `<tr class="click" data-id="${b.id}">
          <td><span class="mono">${b.ref}</span>${b.pnr ? `<div class="small muted mono">PNR ${esc(b.pnr)}</div>` : ''}</td>
          <td>${esc(b.customerName)}<div class="small muted ltr">${esc(b.contactPhone)}</div></td>
          <td>${routeOf(b)}<div>${tags(b)}</div></td>
          <td class="small">${travelDate(b)}</td>
          <td>${b.passengers.length}</td>
          <td><b>${money(b.total)}</b></td>
          <td class="small">${esc(b.paymentMethodName)}</td>
          <td>${pill(b.status, b.statusLabel)}${b.customerRequest && b.customerRequest.status === 'open' ? ` <span class="pill s-new">${b.customerRequest.type === 'cancel' ? 'طلب إلغاء' : 'طلب تعديل'}</span>` : ''}</td>
          <td>${b.unread ? `<span class="badge">${b.unread}</span>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="card empty">لا توجد حجوزات</div>';
      $$('tr.click', main).forEach((tr) => (tr.onclick = () => (location.hash = '#/booking/' + tr.dataset.id)));
    };
    $$('.tabs button', main).forEach((b) => (b.onclick = () => { status = b.dataset.s; $$('.tabs button', main).forEach((x) => x.classList.toggle('on', x === b)); load(); }));
    let t; $('#search').oninput = () => { clearTimeout(t); t = setTimeout(load, 300); };
    await load();
  }

  function segmentsHtml(segs) {
    return segs.map((s, i) => `<div class="seg">
      <div><div class="small muted">${segs.length > 1 ? (i === 0 ? 'ذهاب' : 'عودة') : 'الرحلة'} · ${esc(s.airline)} <span class="mono">${esc(s.flightNo)}</span></div>
      <div class="row" style="margin-top:6px"><div><div class="t">${s.departAt.slice(11, 16)}</div><div class="small">${esc(s.from)} ${esc(s.fromCity)}</div></div></div></div>
      <div class="line"><span>${dur(s.durationMin || 0)} · ${s.stops ? 'توقف ' + esc(s.via) : 'مباشرة'}</span></div>
      <div><div class="t">${s.arriveAt.slice(11, 16)}</div><div class="small">${esc(s.to)} ${esc(s.toCity)}</div></div>
      <div class="small muted" style="min-width:120px">${fmtDT(s.departAt).slice(0, 10)}<br>${esc(s.baggage || '')}</div>
    </div>`).join('');
  }

  async function pageBooking(id) {
    const b = await api('/admin/bookings/' + id);
    const statuses = Object.entries(CFG.statusLabels);
    const p = b.payment;
    const main = shell('#/bookings', `
      <div class="head">
        <div class="row"><a href="#/bookings" class="btn sm">→ رجوع</a><h1 class="mono">${b.ref}</h1>${pill(b.status, b.statusLabel)}</div>
        <div class="row small muted">أُنشئ ${fmtIso(b.createdAt)} · المصدر: ${SOURCE[b.source] || b.source}${b.requestId ? ' #' + b.requestId : ''} · ${b.package ? 'غرفة ' + (ROOMS[b.package.roomType] || '') : 'نوع التذكرة: ' + ({ flex: 'مرنة', basic: 'أساسية', offer: 'عرض خاص' }[b.fare] || '')} ${tags(b)}</div>
      </div>
      ${b.customerRequest && b.customerRequest.status === 'open' ? `<div class="alert warn row" style="margin-bottom:14px"><b>${b.customerRequest.type === 'cancel' ? 'الزبون يطلب الإلغاء' : 'الزبون يطلب التعديل'}:</b> ${esc(b.customerRequest.note || '—')}<span class="spacer"></span><button class="btn sm" id="crDone">تمت المعالجة</button></div>` : ''}
      <div class="grid" style="grid-template-columns: minmax(0,2fr) minmax(0,1fr); align-items:start">
        <div class="grid">
          ${b.package ? `<div class="card grid"><h2>${b.package.type === 'hajj' ? 'باقة حج' : 'باقة عمرة'}: ${esc(b.package.title)}</h2>
            <dl class="kv"><dt>السفر</dt><dd>${esc(b.package.departDate)} ← ${esc(b.package.returnDate)} من ${esc(city(b.package.departCity))}</dd><dt>الغرفة</dt><dd>${ROOMS[b.package.roomType] || ''}</dd><dt>فندق مكة</dt><dd>${esc(b.package.hotelMakkah || '—')}</dd><dt>فندق المدينة</dt><dd>${esc(b.package.hotelMadinah || '—')}</dd></dl></div>` : `<div class="card grid"><h2>الرحلات</h2>${segmentsHtml(b.segments)}
            ${b.offer && b.offer.conditions ? `<div class="alert info">شروط العرض: ${esc(b.offer.conditions)}</div>` : ''}</div>`}
          ${b.amadeus ? `<div class="card grid"><div class="row"><h2>Amadeus</h2><span class="spacer"></span><button class="btn sm" id="amxSync">مزامنة الآن</button></div>
            <div class="small muted">الحجز أُنشئ آلياً في Amadeus. بعد إصدار التذاكر (آلياً أو من نظامكم) تُجلب أرقامها هنا تلقائياً كل 10 دقائق، أو اضغط "مزامنة الآن".</div>
            <dl class="kv">${b.amadeus.orders.map((o, i) => `<dt>${b.amadeus.orders.length > 1 ? (i === 0 ? 'PNR الذهاب' : 'PNR العودة') : 'PNR'}</dt><dd class="mono">${esc(o.pnr || '—')} <span class="muted small">(${esc(o.orderId)})</span></dd>`).join('')}
            <dt>آخر مزامنة</dt><dd>${b.amadeus.lastSyncAt ? fmtIso(b.amadeus.lastSyncAt) : '—'}</dd></dl>
            ${b.amadeus.lastError ? `<div class="alert danger">${esc(b.amadeus.lastError)}</div>` : ''}</div>` : ''}
          <div class="card"><div class="row" style="margin-bottom:10px"><h2>المسافرون وأرقام التذاكر</h2></div>
            <div class="table-wrap"><table><thead><tr><th>#</th><th>الاسم (كما في الجواز)</th><th>النوع</th><th>الجنس</th><th>الجواز</th><th>الانتهاء</th><th>الميلاد</th><th>رقم التذكرة</th></tr></thead>
            <tbody>${b.passengers.map((x, i) => `<tr><td>${i + 1}</td><td class="ltr"><b>${esc(x.lastName)}/${esc(x.firstName)}</b></td><td>${paxType[x.type]}${x.isStudent ? ' <span class="pill s-new">طالب</span>' : ''}</td><td>${x.gender === 'F' ? 'أنثى' : 'ذكر'}</td><td class="mono">${esc(x.passportNo)}</td><td class="small">${esc(x.passportExpiry)}</td><td class="small">${esc(x.birthDate)}</td><td><input class="tkt ltr" data-i="${i}" value="${esc(x.ticketNumber)}" placeholder="000-0000000000" style="width:240px"></td></tr>`).join('')}</tbody></table></div>
          </div>
          <div class="card grid"><h2>إصدار التذكرة</h2>
            <div class="row"><label class="f">رقم الحجز PNR<input id="pnr" class="ltr mono" value="${esc(b.pnr)}" maxlength="40" style="width:200px;text-transform:uppercase"></label>
              <button class="btn" id="savePnr" style="align-self:flex-end">حفظ PNR وأرقام التذاكر</button></div>
            <div class="row"><label class="f">ملف التذكرة (PDF أو صورة)<input type="file" id="tfile" accept="application/pdf,image/*" style="padding-top:7px"></label>
              <button class="btn primary" id="upTicket" style="align-self:flex-end">رفع التذكرة وإبلاغ الزبون</button></div>
            ${b.ticketFile ? `<div><a href="${fileUrl(b.ticketFile.name)}" target="_blank" rel="noopener">📄 عرض التذكرة المرفوعة</a></div>` : '<div class="small muted">عند رفع التذكرة تتغير الحالة إلى "تم إصدار التذكرة" ويصل إشعار للزبون.</div>'}
          </div>
          <div class="card"><h2 style="margin-bottom:10px">المحادثة مع الزبون</h2>${chatBox()}</div>
        </div>
        <div class="grid">
          <div class="card grid"><h2>الزبون</h2>
            <dl class="kv"><dt>الاسم</dt><dd>${esc(b.customerName)}</dd><dt>هاتف التواصل</dt><dd class="ltr">${esc(b.contactPhone)}</dd><dt>هاتف الحساب</dt><dd class="ltr">${esc(b.customerPhone)}</dd></dl>
            <a class="btn sm" target="_blank" rel="noopener" href="https://wa.me/${esc(String(b.contactPhone || '').replace(/\D/g, ''))}">واتساب</a>
          </div>
          <div class="card grid"><h2>الدفع</h2>
            <dl class="kv"><dt>سعر التذاكر</dt><dd>${money(b.fareTotal)}</dd>
            ${b.studentDiscount ? `<dt>خصم الطالب</dt><dd>− ${money(b.studentDiscount)}</dd>` : ''}
            ${b.pointsDiscount ? `<dt>خصم النقاط</dt><dd>− ${money(b.pointsDiscount)} <span class="muted small">(${b.pointsUsed} نقطة — تتحمله الوكالة)</span></dd>` : ''}
            <dt>يدفع الزبون</dt><dd><b style="font-size:18px">${money(b.total)}</b> <span class="muted small">${fx(b.total)}</span></dd>
            <dt>عمولة المنصة</dt><dd>${money(b.commission.amount)} <span class="muted small">(${b.commission.percent}% من ${money(b.commission.base)} · ${esc(b.commissionLabel)})</span></dd>
            ${b.pointsEarned ? `<dt>نقاط الزبون</dt><dd>+${b.pointsEarned}</dd>` : ''}
            <dt>الطريقة</dt><dd>${esc(b.paymentMethodName)}</dd>
            ${b.status === 'awaiting_payment' ? `<dt>آخر مهلة</dt><dd>${fmtIso(b.paymentDeadline)}</dd>` : ''}
            ${p ? `<dt>رقم العملية</dt><dd class="mono">${esc(p.reference || '—')}</dd><dt>الإيصال</dt><dd>${p.receipt ? `<a href="${fileUrl(p.receipt.name)}" target="_blank" rel="noopener">عرض الإيصال</a>` : '—'}</dd><dt>حالة التحقق</dt><dd>${{ pending: 'قيد المراجعة', approved: 'مقبول ✔', rejected: 'مرفوض: ' + esc(p.reason || '') }[p.status] || ''}</dd>` : ''}</dl>
            ${b.status === 'payment_review' ? `<div class="row"><button class="btn primary" id="approve">تأكيد الدفع</button><button class="btn danger" id="reject">رفض</button></div>` : ''}
            ${b.status === 'awaiting_payment' ? `<button class="btn" id="approve">تسجيل دفع يدوي (نقداً/تحويل)</button>` : ''}
          </div>
          <div class="card grid"><h2>تغيير الحالة</h2>
            <select id="st">${statuses.map(([k, l]) => `<option value="${k}" ${k === b.status ? 'selected' : ''}>${l}</option>`).join('')}</select>
            <input id="stNote" placeholder="ملاحظة تُرسل للزبون (اختياري)">
            <button class="btn" id="saveSt">حفظ الحالة</button>
          </div>
          <div class="card grid"><h2>ملاحظة داخلية</h2><textarea id="inote" placeholder="لا يراها الزبون">${esc(b.internalNote)}</textarea><button class="btn sm" id="saveNote">حفظ</button></div>
          <div class="card"><h2 style="margin-bottom:10px">السجل</h2>${b.history.slice().reverse().map((h) => `<div class="small" style="padding:6px 0;border-bottom:1px solid #f0ebe0">${pill(h.status, CFG.statusLabels[h.status])} <span class="muted">${fmtIso(h.at)} · ${esc(who(h.by))}</span>${h.note ? `<div>${esc(h.note)}</div>` : ''}</div>`).join('')}</div>
        </div>
      </div>`);
    const reload = () => pageBooking(id);
    const tickets = () => $$('.tkt', main).map((i) => i.value);
    $('#savePnr').onclick = () => run(() => api('/admin/bookings/' + id, { method: 'PUT', body: { pnr: $('#pnr').value, ticketNumbers: tickets() } }), 'تم الحفظ').then(reload);
    $('#upTicket').onclick = async () => {
      const f = $('#tfile').files[0];
      if (!f) return toast('اختر ملف التذكرة', true);
      const fd = new FormData(); fd.append('file', f); fd.append('pnr', $('#pnr').value);
      await run(() => api('/admin/bookings/' + id, { method: 'PUT', body: { pnr: $('#pnr').value, ticketNumbers: tickets() } }));
      await run(() => api(`/admin/bookings/${id}/ticket`, { method: 'POST', form: fd }), 'تم رفع التذكرة وإبلاغ الزبون');
      reload();
    };
    if ($('#approve')) $('#approve').onclick = () => confirm('تأكيد استلام المبلغ ' + b.total.toLocaleString('en') + '؟') && run(() => api(`/admin/bookings/${id}/payment/approve`, { method: 'POST' }), 'تم تأكيد الدفع').then(reload);
    if ($('#reject')) $('#reject').onclick = () => { const reason = prompt('سبب الرفض (يصل للزبون):', 'لم يصل المبلغ إلى حسابنا'); if (reason) run(() => api(`/admin/bookings/${id}/payment/reject`, { method: 'POST', body: { reason } }), 'تم الرفض وإبلاغ الزبون').then(reload); };
    $('#saveSt').onclick = () => {
      const st = $('#st').value;
      if (['cancelled', 'refunded'].includes(st) && ['confirmed', 'ticketed'].includes(b.status) && !$('#stNote').value.trim()) return toast('اكتب سبب الإلغاء أو الاسترجاع في خانة الملاحظة', true);
      run(() => api('/admin/bookings/' + id, { method: 'PUT', body: { status: st, statusNote: $('#stNote').value } }), 'تم تحديث الحالة').then(reload);
    };
    $('#saveNote').onclick = () => run(() => api('/admin/bookings/' + id, { method: 'PUT', body: { internalNote: $('#inote').value } }), 'تم الحفظ');
    if ($('#amxSync')) $('#amxSync').onclick = () => run(() => api(`/admin/bookings/${id}/amadeus/sync`, { method: 'POST' }), 'تمت المزامنة').then(reload);
    if ($('#crDone')) $('#crDone').onclick = () => run(() => api('/admin/bookings/' + id, { method: 'PUT', body: { customerRequestStatus: 'done' } }), 'تم').then(reload);
    bindChat('booking', id, main);
    refreshStats();
  }

  // ---------- المحادثة ----------
  function chatBox() {
    return `<div class="chat" id="chat"></div><form class="row" id="chatForm" style="margin-top:10px"><input id="chatText" placeholder="اكتب رسالة للزبون…" style="flex:1"><button class="btn primary" type="submit">إرسال</button></form>`;
  }
  let chatTimer;
  function bindChat(type, id, root) {
    const load = async () => {
      const box = $('#chat', root);
      if (!box || !document.body.contains(box)) return clearInterval(chatTimer);
      const list = await api(`/admin/threads/${type}/${id}/messages`).catch(() => []);
      box.innerHTML = list.length ? list.map((m) => `<div class="msg ${m.fromStaff ? 'staff' : 'cust'}">${esc(m.text)}<div class="meta">${esc(m.senderName)} · ${fmtIso(m.createdAt)}</div></div>`).join('') : '<div class="muted small">لا توجد رسائل</div>';
      box.scrollTop = box.scrollHeight;
    };
    $('#chatForm', root).onsubmit = async (e) => {
      e.preventDefault();
      const t = $('#chatText', root).value.trim();
      if (!t) return;
      await run(() => api(`/admin/threads/${type}/${id}/messages`, { method: 'POST', body: { text: t } }));
      $('#chatText', root).value = '';
      load();
    };
    clearInterval(chatTimer);
    chatTimer = setInterval(load, 15000);
    load();
  }

  // ---------- طلبات التسعيرة ----------
  async function pageRequests() {
    const main = shell('#/requests', `<div class="head"><h1>طلبات التسعيرة</h1><span class="muted small">يرسلها الزبون عندما لا يجد رحلة مناسبة في التطبيق</span></div>
      <div class="tabs">${[['', 'الكل'], ['new', 'جديدة'], ['quoted', 'أُرسل عرض'], ['accepted', 'مقبولة'], ['closed', 'مغلقة']].map(([k, l]) => `<button data-s="${k}" class="${k === '' ? 'on' : ''}">${l}</button>`).join('')}</div><div id="list"></div>`);
    const load = async (s = '') => {
      const list = await api('/admin/requests?status=' + s);
      $('#list', main).innerHTML = list.length ? `<div class="table-wrap"><table><thead><tr><th>#</th><th>الزبون</th><th>المسار</th><th>التاريخ</th><th>المسافرون</th><th>ملاحظات</th><th>العروض</th><th>الحالة</th><th></th></tr></thead><tbody>
        ${list.map((r) => `<tr class="click" data-id="${r.id}"><td>${r.id}</td><td>${esc(r.customerName)}<div class="small muted ltr">${esc(r.customerPhone)}</div></td><td><b>${esc(r.fromCity)} ← ${esc(r.toCity)}</b>${r.returnDate ? ' ⇄' : ''}</td><td class="small">${esc(r.date)}${r.returnDate ? '<br>' + esc(r.returnDate) : ''}</td><td>${r.adults + r.children + r.infants}</td><td class="small" style="max-width:220px">${esc(r.notes)}</td><td>${r.offers.length}</td><td>${pill(r.status, r.statusLabel)}</td><td>${r.unread ? `<span class="badge">${r.unread}</span>` : ''}</td></tr>`).join('')}
        </tbody></table></div>` : '<div class="card empty">لا توجد طلبات</div>';
      $$('tr.click', main).forEach((tr) => (tr.onclick = () => (location.hash = '#/request/' + tr.dataset.id)));
    };
    $$('.tabs button', main).forEach((b) => (b.onclick = () => { $$('.tabs button', main).forEach((x) => x.classList.toggle('on', x === b)); load(b.dataset.s); }));
    await load();
  }

  function segInputs(prefix, title, from, to, date) {
    return `<fieldset style="border:1px solid var(--line);border-radius:12px;padding:12px" id="${prefix}Box"><legend class="small muted">${title}</legend>
      <div class="grid g4">
        <label class="f">رقم الرحلة<input name="${prefix}_flightNo" class="ltr" placeholder="AT 000"></label>
        <label class="f">من<input name="${prefix}_from" class="ltr" value="${esc(from)}" maxlength="3"></label>
        <label class="f">إلى<input name="${prefix}_to" class="ltr" value="${esc(to)}" maxlength="3"></label>
        <label class="f">عدد التوقفات<input name="${prefix}_stops" type="number" min="0" value="0"></label>
        <label class="f">الإقلاع<input name="${prefix}_departAt" type="datetime-local" value="${esc(date)}T00:00"></label>
        <label class="f">الوصول<input name="${prefix}_arriveAt" type="datetime-local" value="${esc(date)}T00:00"></label>
        <label class="f">مطار التوقف<input name="${prefix}_via" class="ltr" maxlength="3"></label>
      </div></fieldset>`;
  }

  async function pageRequest(id) {
    const r = await api('/admin/requests/' + id);
    let linked = null;
    if (r.status === 'accepted') linked = (await api('/admin/bookings')).find((b) => b.requestId === r.id);
    const main = shell('#/requests', `
      <div class="head"><div class="row"><a href="#/requests" class="btn sm">→ رجوع</a><h1>طلب #${r.id}: ${esc(r.fromCity)} ← ${esc(r.toCity)}</h1>${pill(r.status, r.statusLabel)}</div>
        ${r.status !== 'closed' ? '<button class="btn" id="close">إغلاق الطلب</button>' : ''}</div>
      ${linked ? `<div class="alert info" style="margin-bottom:14px">قبل الزبون العرض وتم إنشاء الحجز <a href="#/booking/${linked.id}" class="mono">${linked.ref}</a></div>` : ''}
      <div class="grid" style="grid-template-columns: minmax(0,2fr) minmax(0,1fr); align-items:start">
        <div class="grid">
          <div class="card"><h2 style="margin-bottom:10px">تفاصيل الطلب</h2><dl class="kv">
            <dt>الزبون</dt><dd>${esc(r.customerName)} <span class="ltr muted">${esc(r.customerPhone)}</span></dd>
            <dt>الرحلة</dt><dd>${r.tripType === 'round' ? 'ذهاب وعودة' : 'ذهاب فقط'} · ${esc(r.from)} ${esc(r.fromCity)} ← ${esc(r.to)} ${esc(r.toCity)}</dd>
            <dt>الذهاب</dt><dd>${esc(r.date)}</dd>${r.returnDate ? `<dt>العودة</dt><dd>${esc(r.returnDate)}</dd>` : ''}
            <dt>المسافرون</dt><dd>${r.adults} بالغ، ${r.children} طفل، ${r.infants} رضيع</dd>
            <dt>الدرجة</dt><dd>${r.cabin === 'business' ? 'رجال الأعمال' : 'اقتصادية'}</dd>
            <dt>ملاحظات</dt><dd>${esc(r.notes || '—')}</dd></dl></div>
          <div class="card grid"><h2>العروض المرسلة (${r.offers.length})</h2>
            ${r.offers.map((o) => `<div class="grid" style="gap:8px;padding:12px;border:1px solid var(--line);border-radius:12px"><div class="row"><b>${esc(o.airline)}</b><span class="spacer"></span><b>${money(o.totalPrice)}</b>${r.status !== 'accepted' ? `<button class="btn sm danger" data-del="${o.id}">حذف</button>` : ''}</div>${segmentsHtml(o.segments)}<div class="small muted">الأمتعة: ${esc(o.baggage || '—')} · صالح حتى: ${esc(o.validUntil || '—')} ${o.conditions ? '· ' + esc(o.conditions) : ''}</div></div>`).join('') || '<div class="muted">لم ترسل عروضاً بعد</div>'}
          </div>
          ${r.status === 'accepted' || r.status === 'closed' ? '' : `<form class="card grid" id="offerForm"><h2>إرسال عرض جديد للزبون</h2>
            <div class="grid g4">
              <label class="f">شركة الطيران<input name="airline" required></label>
              <label class="f">رمز الشركة<input name="airlineCode" class="ltr" maxlength="3" placeholder="AT"></label>
              <label class="f">الأمتعة<input name="baggage" placeholder="حقيبة 23 كغ"></label>
              <label class="f">السعر الإجمالي (${esc(CFG.currency)})<input name="totalPrice" type="number" min="0" required></label>
              <label class="f">صالح حتى<input name="validUntil" type="date"></label>
            </div>
            ${segInputs('out', 'رحلة الذهاب', r.from, r.to, r.date)}
            ${r.returnDate ? segInputs('in', 'رحلة العودة', r.to, r.from, r.returnDate) : ''}
            <label class="f">شروط العرض (الاسترجاع، التعديل…)<textarea name="conditions"></textarea></label>
            <button class="btn primary" type="submit">إرسال العرض للزبون</button></form>`}
        </div>
        <div class="card"><h2 style="margin-bottom:10px">المحادثة مع الزبون</h2>${chatBox()}</div>
      </div>`);
    const reload = () => pageRequest(id);
    if ($('#close')) $('#close').onclick = () => confirm('إغلاق الطلب؟') && run(() => api('/admin/requests/' + id, { method: 'PUT', body: { status: 'closed' } }), 'تم الإغلاق').then(reload);
    $$('[data-del]', main).forEach((b) => (b.onclick = () => confirm('حذف العرض؟') && run(() => api(`/admin/requests/${id}/offers/${b.dataset.del}`, { method: 'DELETE' })).then(reload)));
    const form = $('#offerForm', main);
    if (form) form.onsubmit = async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(form));
      const seg = (p) => ({ flightNo: fd[p + '_flightNo'], from: fd[p + '_from'], to: fd[p + '_to'], departAt: fd[p + '_departAt'], arriveAt: fd[p + '_arriveAt'], stops: fd[p + '_stops'], via: fd[p + '_via'] });
      const segments = [seg('out')];
      if (r.returnDate) segments.push(seg('in'));
      await run(() => api(`/admin/requests/${id}/offers`, { method: 'POST', body: { airline: fd.airline, airlineCode: fd.airlineCode, baggage: fd.baggage, totalPrice: fd.totalPrice, validUntil: fd.validUntil, conditions: fd.conditions, segments } }), 'تم إرسال العرض للزبون');
      reload();
    };
    bindChat('request', id, main);
    refreshStats();
  }

  // ---------- الرحلات ----------
  async function pageFlights() {
    const opts = (sel) => `<option value="">الكل</option>` + AIRPORTS.map((a) => `<option value="${a.code}" ${a.code === sel ? 'selected' : ''}>${a.code} · ${esc(a.city)}</option>`).join('');
    const main = shell('#/flights', `
      <div class="head"><h1>الرحلات والأسعار</h1><div class="row">${ME.role === 'admin' ? '<button class="btn danger sm" id="delDemo">حذف الرحلات التجريبية</button>' : ''}<button class="btn primary" id="add">+ إضافة رحلة</button></div></div>
      <div class="alert info" style="margin-bottom:14px">الرحلات التي تضيفها هنا تظهر للزبون فوراً في نتائج البحث ويمكنه حجزها مباشرة. إن لم يجد رحلة، يرسل طلب تسعيرة يصلك في "طلبات التسعيرة".</div>
      <div class="row card" style="margin-bottom:14px">
        <label class="f">من<select id="ff">${opts('')}</select></label>
        <label class="f">إلى<select id="ft">${opts('')}</select></label>
        <label class="f">التاريخ<input type="date" id="fd"></label>
        <label class="f">بحث<input id="fq" placeholder="رقم الرحلة أو الشركة"></label>
      </div>
      <div id="list"></div>`);
    const load = async () => {
      const list = await api(`/admin/flights?from=${$('#ff').value}&to=${$('#ft').value}&date=${$('#fd').value}&q=${encodeURIComponent($('#fq').value)}`);
      $('#list', main).innerHTML = list.length ? `<div class="table-wrap"><table><thead><tr><th>الرحلة</th><th>المسار</th><th>الإقلاع</th><th>الوصول</th><th>المدة</th><th>أساسية</th><th>مرنة</th><th>المقاعد</th><th>الحالة</th><th></th></tr></thead><tbody>
        ${list.map((f) => `<tr><td><b>${esc(f.airline)}</b><div class="mono small">${esc(f.flightNo)}</div>${f.demo ? '<span class="pill s-new">تجريبية</span>' : ''}</td>
          <td>${esc(f.from)} ← ${esc(f.to)}${f.stops ? `<div class="small muted">توقف ${esc(f.via)}</div>` : ''}</td><td class="small">${fmtDT(f.departAt)}</td><td class="small">${fmtDT(f.arriveAt)}</td><td class="small">${dur(f.durationMin)}</td>
          <td>${f.fares.basic.price.toLocaleString('en')}</td><td>${f.fares.flex.price.toLocaleString('en')}</td>
          <td><input type="number" min="0" value="${f.seats}" data-seats="${f.id}" style="width:72px;height:32px"></td>
          <td><label class="check"><input type="checkbox" data-act="${f.id}" ${f.active ? 'checked' : ''}> ${f.active ? 'منشورة' : 'مخفية'}</label></td>
          <td class="row" style="flex-wrap:nowrap"><button class="btn sm" data-edit="${f.id}">تعديل</button><button class="btn sm" data-copy="${f.id}">نسخ</button><button class="btn sm danger" data-del="${f.id}">حذف</button></td></tr>`).join('')}
        </tbody></table></div>${list.length >= 500 ? '<div class="small muted">يُعرض أول 500 رحلة فقط، استخدم التصفية.</div>' : ''}` : '<div class="card empty">لا توجد رحلات</div>';
      $$('[data-edit]', main).forEach((b) => (b.onclick = () => flightModal(list.find((f) => f.id == b.dataset.edit), load)));
      $$('[data-copy]', main).forEach((b) => (b.onclick = () => { const f = { ...list.find((x) => x.id == b.dataset.copy) }; delete f.id; flightModal(f, load); }));
      $$('[data-del]', main).forEach((b) => (b.onclick = () => confirm('حذف الرحلة؟') && run(() => api('/admin/flights/' + b.dataset.del, { method: 'DELETE' }), 'تم الحذف').then(load)));
      $$('[data-act]', main).forEach((c) => (c.onchange = () => run(() => api('/admin/flights/' + c.dataset.act, { method: 'PATCH', body: { active: c.checked } }), c.checked ? 'الرحلة منشورة' : 'الرحلة مخفية').then(load)));
      $$('[data-seats]', main).forEach((i) => (i.onchange = () => run(() => api('/admin/flights/' + i.dataset.seats, { method: 'PATCH', body: { seats: i.value } }), 'تم تحديث المقاعد')));
    };
    ['#ff', '#ft', '#fd'].forEach((s) => ($(s).onchange = load));
    let t; $('#fq').oninput = () => { clearTimeout(t); t = setTimeout(load, 300); };
    $('#add').onclick = () => flightModal(null, load);
    if ($('#delDemo')) $('#delDemo').onclick = () => confirm('حذف كل الرحلات التجريبية؟') && run(() => api('/admin/flights/delete-demo', { method: 'POST' })).then((r) => { toast(`تم حذف ${r.deleted} رحلة`); load(); });
    await load();
  }

  function flightModal(f, done) {
    const isEdit = f && f.id;
    const v = (x) => esc(x ?? '');
    const apOpts = (sel) => AIRPORTS.map((a) => `<option value="${a.code}" ${a.code === sel ? 'selected' : ''}>${a.code} · ${esc(a.city)}</option>`).join('');
    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<form class="modal" id="fm">
      <div class="row"><h2>${isEdit ? 'تعديل رحلة' : 'إضافة رحلة'}</h2><span class="spacer"></span><button type="button" class="btn sm" id="x" aria-label="إغلاق">✕</button></div>
      <div class="grid g3">
        <label class="f">شركة الطيران<input name="airline" required value="${v(f?.airline)}"></label>
        <label class="f">الاسم اللاتيني — للفرنسية والإنجليزية (اختياري)<input name="airlineFr" class="ltr" value="${v(f?.airlineFr)}" placeholder="Royal Air Maroc"></label>
        <label class="f">رمز الشركة<input name="airlineCode" class="ltr" maxlength="3" value="${v(f?.airlineCode)}" placeholder="AT"></label>
        <label class="f">رقم الرحلة<input name="flightNo" class="ltr" required value="${v(f?.flightNo)}"></label>
        <label class="f">من<select name="from" required>${apOpts(f?.from || 'NKC')}</select></label>
        <label class="f">إلى<select name="to" required>${apOpts(f?.to || 'CMN')}</select></label>
        <label class="f">المقاعد المتاحة<input name="seats" type="number" min="0" value="${v(f?.seats ?? 9)}"></label>
        <label class="f">الإقلاع (توقيت المطار)<input name="departAt" type="datetime-local" required value="${v(f?.departAt)}"></label>
        <label class="f">الوصول (توقيت المطار)<input name="arriveAt" type="datetime-local" required value="${v(f?.arriveAt)}"></label>
        <label class="f">مدة الطيران بالدقائق<input name="durationMin" type="number" min="0" value="${v(f?.durationMin)}" placeholder="تُحسب تلقائياً"></label>
        <label class="f">عدد التوقفات<input name="stops" type="number" min="0" value="${v(f?.stops ?? 0)}"></label>
        <label class="f">مطار التوقف<input name="via" class="ltr" maxlength="3" value="${v(f?.via)}"></label>
      </div>
      <div class="grid g2">
        <fieldset style="border:1px solid var(--line);border-radius:12px;padding:12px" class="grid"><legend class="small muted">التذكرة الأساسية (للبالغ)</legend>
          <label class="f">السعر<input name="basicPrice" type="number" min="0" required value="${v(f?.fares?.basic?.price)}"></label>
          <label class="f">الأمتعة<input name="basicBaggage" value="${v(f?.fares?.basic?.baggage ?? 'حقيبة 23 كغ')}"></label>
          <label class="check"><input type="checkbox" name="basicChangeable" ${f?.fares?.basic?.changeable ? 'checked' : ''}> قابلة للتعديل</label>
          <label class="check"><input type="checkbox" name="basicRefundable" ${f?.fares?.basic?.refundable ? 'checked' : ''}> قابلة للاسترجاع</label></fieldset>
        <fieldset style="border:1px solid var(--line);border-radius:12px;padding:12px" class="grid"><legend class="small muted">التذكرة المرنة (للبالغ)</legend>
          <label class="f">السعر<input name="flexPrice" type="number" min="0" value="${v(f?.fares?.flex?.price)}"></label>
          <label class="f">الأمتعة<input name="flexBaggage" value="${v(f?.fares?.flex?.baggage ?? 'حقيبتان 23 كغ')}"></label>
          <label class="check"><input type="checkbox" name="flexChangeable" ${f?.fares?.flex?.changeable !== false ? 'checked' : ''}> قابلة للتعديل</label>
          <label class="check"><input type="checkbox" name="flexRefundable" ${f?.fares?.flex?.refundable !== false ? 'checked' : ''}> قابلة للاسترجاع</label></fieldset>
      </div>
      ${isEdit ? '' : `<fieldset style="border:1px solid var(--line);border-radius:12px;padding:12px" class="grid"><legend class="small muted">تكرار الرحلة (اختياري)</legend>
        <div class="row">${days.map((d, i) => `<label class="check"><input type="checkbox" name="wd" value="${i}"> ${d}</label>`).join('')}</div>
        <label class="f" style="max-width:220px">كرّر حتى تاريخ<input name="untilDate" type="date"></label>
        <div class="small muted">مثال: رحلة كل إثنين وخميس حتى نهاية الشهر — تُنشأ كل الرحلات دفعة واحدة.</div></fieldset>`}
      <label class="check"><input type="checkbox" name="active" ${f?.active !== false ? 'checked' : ''}> منشورة للزبائن</label>
      <div class="row"><button class="btn primary" type="submit">${isEdit ? 'حفظ التعديلات' : 'إضافة'}</button></div>
    </form>`;
    document.body.appendChild(bg);
    const close = () => bg.remove();
    $('#x', bg).onclick = close;
    bg.onclick = (e) => e.target === bg && close();
    $('#fm', bg).onsubmit = async (e) => {
      e.preventDefault();
      const form = e.target;
      const fd = new FormData(form);
      const body = Object.fromEntries(fd);
      ['basicChangeable', 'basicRefundable', 'flexChangeable', 'flexRefundable', 'active'].forEach((k) => (body[k] = fd.has(k)));
      const wd = fd.getAll('wd');
      if (wd.length && body.untilDate) body.repeat = { weekdays: wd, untilDate: body.untilDate };
      delete body.wd; delete body.untilDate;
      const r = await run(() => api('/admin/flights' + (isEdit ? '/' + f.id : ''), { method: isEdit ? 'PUT' : 'POST', body }));
      toast(isEdit ? 'تم الحفظ' : `تمت إضافة ${r.created} رحلة`);
      close();
      done();
    };
  }

  // ---------- المطارات ----------
  async function pageAirports() {
    AIRPORTS = await api('/admin/airports');
    const main = shell('#/airports', `<div class="head"><h1>المطارات</h1></div>
      <form class="card row" id="af" style="margin-bottom:14px"><label class="f">الرمز (IATA)<input name="code" class="ltr" maxlength="3" required placeholder="NKC" style="width:100px;text-transform:uppercase"></label><label class="f">المدينة<input name="city" required></label><label class="f">الدولة<input name="country"></label><label class="f">المدينة بالفرنسية<input name="cityFr" class="ltr"></label><label class="f">الدولة بالفرنسية<input name="countryFr" class="ltr"></label><label class="f">المدينة بالإنجليزية<input name="cityEn" class="ltr"></label><label class="f">الدولة بالإنجليزية<input name="countryEn" class="ltr"></label><button class="btn primary" style="align-self:flex-end">إضافة</button></form>
      <div class="table-wrap"><table><thead><tr><th>الرمز</th><th>المدينة</th><th>الدولة</th><th>فرنسي / إنجليزي</th><th></th></tr></thead><tbody>${AIRPORTS.map((a) => `<tr><td class="mono">${a.code}</td><td>${esc(a.city)}</td><td>${esc(a.country)}</td><td class="ltr small">${esc(a.cityFr || '')}${a.countryFr ? ', ' + esc(a.countryFr) : ''}<br>${esc(a.cityEn || '')}${a.countryEn ? ', ' + esc(a.countryEn) : ''}</td><td><button class="btn sm danger" data-del="${a.code}">حذف</button></td></tr>`).join('')}</tbody></table></div>`);
    $('#af').onsubmit = async (e) => { e.preventDefault(); await run(() => api('/admin/airports', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }), 'تمت الإضافة'); pageAirports(); };
    $$('[data-del]', main).forEach((b) => (b.onclick = () => confirm('حذف المطار؟') && run(() => api('/admin/airports/' + b.dataset.del, { method: 'DELETE' })).then(pageAirports)));
  }

  // ---------- الزبائن ----------
  async function pageCustomers() {
    const main = shell('#/customers', `<div class="head"><h1>الزبائن</h1><input id="q" placeholder="بحث بالاسم أو الهاتف أو رمز الدعوة"></div><div id="list"></div>`);
    const load = async () => {
      const list = await api('/admin/customers?q=' + encodeURIComponent($('#q').value));
      $('#list', main).innerHTML = list.length ? `<div class="table-wrap"><table><thead><tr><th>الاسم</th><th>الهاتف</th><th>تاريخ التسجيل</th><th>الحجوزات</th><th>المدفوع</th><th>النقاط</th><th>الدعوات</th><th></th></tr></thead><tbody>
        ${list.map((u) => `<tr><td>${esc(u.name)}${u.disabled ? ' <span class="pill s-cancelled">موقوف</span>' : ''}${u.studentStatus === 'verified' ? ' <span class="pill s-new">طالب</span>' : ''}<div class="small muted">${u.lang === 'fr' ? 'Français' : 'عربي'}${u.referredByName ? ' · دعاه ' + esc(u.referredByName) : ''}</div></td><td class="ltr">${esc(u.phone)}</td><td class="small">${fmtIso(u.createdAt)}</td><td>${u.bookings}</td><td>${money(u.spent)}</td>
          <td><button class="btn sm" data-pts="${u.id}">${u.points || 0}</button></td><td class="small"><span class="mono">${esc(u.referralCode || '')}</span><br>${u.invited} صديق</td>
          <td class="row" style="flex-wrap:nowrap"><a class="btn sm" target="_blank" rel="noopener" href="https://wa.me/${esc(u.phone.replace(/\D/g, ''))}">واتساب</a>${ME.role === 'admin' ? `<button class="btn sm" data-pw="${u.id}">كلمة مرور جديدة</button><button class="btn sm ${u.disabled ? '' : 'danger'}" data-dis="${u.id}" data-v="${u.disabled ? 0 : 1}">${u.disabled ? 'تفعيل' : 'إيقاف'}</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div>` : '<div class="card empty">لا يوجد زبائن بعد</div>';
      $$('[data-pts]', main).forEach((b) => (b.onclick = () => pointsModal(list.find((u) => u.id == b.dataset.pts), load)));
      $$('[data-dis]', main).forEach((b) => (b.onclick = () => run(() => api('/admin/customers/' + b.dataset.dis, { method: 'PATCH', body: { disabled: b.dataset.v === '1' } }), 'تم').then(load)));
      $$('[data-pw]', main).forEach((b) => (b.onclick = () => { const pw = prompt('كلمة المرور الجديدة للزبون (6 أحرف على الأقل):'); if (pw) run(() => api('/admin/customers/' + b.dataset.pw, { method: 'PATCH', body: { newPassword: pw } }), 'تم تغيير كلمة المرور، أبلغ الزبون بها'); }));
    };
    let t; $('#q').oninput = () => { clearTimeout(t); t = setTimeout(load, 300); };
    await load();
  }

  // ---------- الإعدادات ----------
  async function pageSettings() {
    const s = await api('/admin/settings');
    const isAdmin = ME.role === 'admin';
    const staff = isAdmin ? await api('/admin/staff') : [];
    const dis = isAdmin ? '' : 'disabled';
    const main = shell('#/settings', `<div class="head"><h1>الإعدادات</h1></div>
      <div class="grid g2" style="align-items:start">
      <form class="card grid" id="sf"><h2>بيانات الوكالة</h2>
        <label class="f">اسم الوكالة (يظهر في التطبيق)<input name="agencyName" value="${esc(s.agencyName)}" ${dis}></label>
        <label class="f">هاتف الوكالة<input name="agencyPhone" class="ltr" value="${esc(s.agencyPhone)}" ${dis}></label>
        <label class="f">رقم واتساب (بالأرقام مع رمز الدولة، مثل 22245000000)<input name="whatsapp" class="ltr" value="${esc(s.whatsapp)}" ${dis}></label>
        <label class="f">العنوان<input name="address" value="${esc(s.address)}" ${dis}></label>
        <div class="grid g2">
          <label class="f">العملة<input name="currency" value="${esc(s.currency)}" ${dis}></label>
          <label class="f">سعر الدولار (كم ${esc(s.currency)} = 1 $)<input name="rateUSD" type="number" step="0.01" min="0" value="${s.exchangeRates.USD}" ${dis}></label>
          <label class="f">سعر اليورو (كم ${esc(s.currency)} = 1 €)<input name="rateEUR" type="number" step="0.01" min="0" value="${s.exchangeRates.EUR}" ${dis}></label>
          <div class="small muted" style="grid-column:1/-1">تظهر الأسعار للزبون بالأوقية مع ما يعادلها بالدولار واليورو. حدّث السعرين بانتظام${s.exchangeRatesUpdatedAt ? ' — آخر تحديث ' + fmtIso(s.exchangeRatesUpdatedAt) : ''}. الدفع يبقى بالأوقية.</div>
          <label class="f">مهلة الدفع (ساعات)<input name="paymentDeadlineHours" type="number" min="1" value="${s.paymentDeadlineHours}" ${dis}></label>
          <label class="f">سعر الطفل % من البالغ<input name="childPercent" type="number" min="0" max="100" value="${s.childPercent}" ${dis}></label>
          <label class="f">سعر الرضيع % من البالغ<input name="infantPercent" type="number" min="0" max="100" value="${s.infantPercent}" ${dis}></label>
        </div>
        <label class="f">الوجهات الشائعة (رموز مفصولة بفاصلة)<input name="popularDestinations" class="ltr" value="${esc((s.popularDestinations || []).join(', '))}" ${dis}></label>
        <h2 style="margin-top:6px">طرق الدفع</h2>
        <div class="small muted">يرى الزبون رقم الحساب واسم صاحبه ليحوّل المبلغ، ثم يرسل رقم العملية وصورة الإيصال.</div>
        ${s.paymentMethods.map((m, i) => `<div class="grid g3" style="padding:10px;border:1px solid var(--line);border-radius:12px">
          <label class="f">الاسم<input name="pm_name_${i}" value="${esc(m.name)}" ${dis}></label>
          <label class="f">رقم الحساب / التفاصيل<input name="pm_account_${i}" value="${esc(m.account)}" ${dis}></label>
          <label class="f">اسم صاحب الحساب<input name="pm_holder_${i}" value="${esc(m.holder)}" ${dis}></label>
          <label class="check"><input type="checkbox" name="pm_enabled_${i}" ${m.enabled ? 'checked' : ''} ${dis}> مفعّلة</label></div>`).join('')}
        ${isAdmin ? '<button class="btn primary" type="submit">حفظ الإعدادات</button>' : '<div class="small muted">التعديل للمدير فقط</div>'}
      </form>
      <div class="grid">
        <form class="card grid" id="lf2"><h2>الطلاب والنقاط والدعوات</h2>
          <div class="grid g2">
            <label class="f">خصم الطالب %<input name="studentDiscountPercent" type="number" min="0" max="90" value="${s.studentDiscountPercent}" ${dis}></label>
            <label class="f">أقصى عمر للطالب<input name="studentMaxAge" type="number" min="0" value="${s.studentMaxAge}" ${dis}></label>
          </div>
          <label class="check"><input type="checkbox" name="pointsEnabled" ${s.pointsEnabled ? 'checked' : ''} ${dis}> تفعيل نقاط الولاء</label>
          <div class="grid g2">
            <label class="f">نقطة واحدة لكل (${esc(s.currency)}) مدفوعة<input name="pointsEarnPer" type="number" min="1" value="${s.pointsEarnPer}" ${dis}></label>
            <label class="f">قيمة النقطة عند الاستعمال (${esc(s.currency)})<input name="pointValue" type="number" min="0" step="0.1" value="${s.pointValue}" ${dis}></label>
            <label class="f">أقل عدد نقاط للاستعمال<input name="pointsMinRedeem" type="number" min="0" value="${s.pointsMinRedeem}" ${dis}></label>
            <label class="f">أقصى خصم بالنقاط % من الحجز<input name="pointsMaxRedeemPercent" type="number" min="0" max="100" value="${s.pointsMaxRedeemPercent}" ${dis}></label>
            <label class="f">تنتهي النقاط بعد (شهر بلا نشاط، 0 = أبداً)<input name="pointsExpiryMonths" type="number" min="0" value="${s.pointsExpiryMonths}" ${dis}></label>
          </div>
          <div class="small muted" id="ptsHint"></div>
          <label class="check"><input type="checkbox" name="referralEnabled" ${s.referralEnabled ? 'checked' : ''} ${dis}> تفعيل "ادعُ صديقاً"</label>
          <div class="grid g2">
            <label class="f">نقاط الداعي<input name="referralPointsReferrer" type="number" min="0" value="${s.referralPointsReferrer}" ${dis}></label>
            <label class="f">نقاط الصديق المدعو<input name="referralPointsReferee" type="number" min="0" value="${s.referralPointsReferee}" ${dis}></label>
          </div>
          <div class="small muted">تُمنح نقاط الدعوة للطرفين عند صدور أول تذكرة للصديق. خصم النقاط والطلاب تتحمله الوكالة.</div>
          <div class="alert info">عمولة المنصة الحالية: <b>${s.commissionPercent}%</b> من السعر المعروض للزبون (قبل خصم النقاط)، وتُحسب فقط على الحجوزات التي صدرت تذاكرها. يحددها مالك التطبيق.</div>
          ${isAdmin ? '<button class="btn primary" type="submit">حفظ</button>' : ''}
        </form>
        <form class="card grid" id="amf"><div class="row"><h2>الربط مع Amadeus</h2><span class="spacer"></span>${s.amadeus.enabled ? '<span class="pill s-ticketed">مفعّل</span>' : '<span class="pill s-cancelled">متوقف</span>'}</div>
          <div class="small muted">عند التفعيل تظهر للزبون أسعار Amadeus الحية بجانب رحلاتكم، ويُنشأ الحجز (PNR) آلياً، وتُجلب أرقام التذاكر بعد إصدارها.</div>
          <div class="grid g2">
            <label class="f">البيئة<select name="env" ${dis}>${[['test', 'اختبار (test)'], ['production', 'حقيقي (production)'], ['custom', 'عنوان مخصص']].map(([k, l]) => `<option value="${k}" ${s.amadeus.env === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
            <label class="f">العنوان المخصص<input name="baseUrl" class="ltr" value="${esc(s.amadeus.baseUrl)}" placeholder="https://..." ${dis}></label>
            <label class="f">Client ID / API Key<input name="clientId" class="ltr" value="${esc(s.amadeus.clientId)}" ${dis}></label>
            <label class="f">Client Secret<input name="clientSecret" type="password" class="ltr" value="${esc(s.amadeus.clientSecret)}" ${dis}></label>
            <label class="f">عملة الأسعار من Amadeus<input name="currency" class="ltr" value="${esc(s.amadeus.currency)}" maxlength="3" ${dis}></label>
            <label class="f">سعر الصرف إلى ${esc(s.currency)}<input name="exchangeRate" type="number" step="0.0001" min="0" value="${s.amadeus.exchangeRate}" ${dis}></label>
            <label class="f">هامش ربح الوكالة %<input name="markupPercent" type="number" step="0.1" min="0" value="${s.amadeus.markupPercent}" ${dis}></label>
            <label class="f">رسوم ثابتة لكل مسافر (${esc(s.currency)})<input name="markupFixed" type="number" min="0" value="${s.amadeus.markupFixed}" ${dis}></label>
            <label class="f">عدد النتائج<input name="maxResults" type="number" min="1" max="250" value="${s.amadeus.maxResults}" ${dis}></label>
            <label class="f">رمز الدولة الافتراضي للجواز<input name="defaultCountry" class="ltr" maxlength="2" value="${esc(s.amadeus.defaultCountry)}" ${dis}></label>
          </div>
          <label class="check"><input type="checkbox" name="createOrder" ${s.amadeus.createOrder ? 'checked' : ''} ${dis}> إنشاء الحجز PNR آلياً عند حجز الزبون</label>
          <label class="check"><input type="checkbox" name="autoSync" ${s.amadeus.autoSync ? 'checked' : ''} ${dis}> جلب أرقام التذاكر آلياً (كل 10 دقائق)</label>
          <label class="f">مسار الإصدار الآلي (اختياري — حسب عقدكم مع Amadeus)<input name="ticketingPath" class="ltr" value="${esc(s.amadeus.ticketingPath)}" placeholder="/v1/booking/flight-orders/{id}/issuance" ${dis}></label>
          <label class="check"><input type="checkbox" name="enabled" ${s.amadeus.enabled ? 'checked' : ''} ${dis}> <b>تفعيل Amadeus للزبائن</b></label>
          ${isAdmin ? '<div class="row"><button class="btn primary" type="submit">حفظ</button><button class="btn" type="button" id="amTest">اختبار الاتصال</button></div>' : ''}
        </form>
        <form class="card grid" id="pwf"><h2>تغيير كلمة المرور</h2>
          <label class="f">كلمة المرور الحالية<input type="password" name="currentPassword" required></label>
          <label class="f">كلمة المرور الجديدة<input type="password" name="newPassword" required minlength="6"></label>
          <button class="btn" type="submit">تغيير</button></form>
        ${isAdmin ? `<div class="card grid"><h2>الموظفون</h2>
          ${staff.map((u) => `<div class="row" style="padding:6px 0;border-bottom:1px solid #f0ebe0"><b>${esc(u.name)}</b><span class="mono small">${esc(u.username)}</span><span class="pill ${u.role === 'admin' ? 's-ticketed' : 's-quoted'}">${u.role === 'admin' ? 'مدير' : 'موظف'}</span><span class="spacer"></span>${u.id !== ME.id ? `<button class="btn sm danger" data-del="${u.id}">حذف</button>` : ''}</div>`).join('')}
          <form class="grid g2" id="stf"><label class="f">الاسم<input name="name" required></label><label class="f">اسم المستخدم<input name="username" class="ltr" required></label>
            <label class="f">كلمة المرور<input name="password" type="password" required minlength="6"></label><label class="f">الصلاحية<select name="role"><option value="staff">موظف</option><option value="admin">مدير</option></select></label>
            <button class="btn" type="submit">إضافة موظف</button></form></div>` : ''}
      </div></div>`);
    if (isAdmin) $('#sf').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = Object.fromEntries(['agencyName', 'agencyPhone', 'whatsapp', 'address', 'currency', 'paymentDeadlineHours', 'childPercent', 'infantPercent'].map((k) => [k, fd.get(k)]));
      body.exchangeRates = { USD: fd.get('rateUSD'), EUR: fd.get('rateEUR') };
      body.popularDestinations = String(fd.get('popularDestinations')).split(',').map((x) => x.trim().toUpperCase()).filter(Boolean);
      body.paymentMethods = s.paymentMethods.map((m, i) => ({ ...m, name: fd.get('pm_name_' + i), account: fd.get('pm_account_' + i), holder: fd.get('pm_holder_' + i), enabled: fd.has('pm_enabled_' + i) }));
      await run(() => api('/admin/settings', { method: 'PUT', body }), 'تم حفظ الإعدادات');
      CFG = { ...CFG, ...(await api('/config')) };
      pageSettings();
    };
    const lf2 = $('#lf2');
    const hint = () => { const f = new FormData(lf2); const per = Number(f.get('pointsEarnPer')) || 1; const val = Number(f.get('pointValue')) || 0; $('#ptsHint').textContent = `= استرجاع ${((val / per) * 100).toFixed(1)}% من قيمة كل حجز على شكل نقاط (مثال: حجز بـ 20,000 يعطي ${Math.floor(20000 / per)} نقطة = ${Math.floor(20000 / per) * val} خصم)`; };
    lf2.oninput = hint; hint();
    if (isAdmin) lf2.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(lf2);
      const body = Object.fromEntries(['studentDiscountPercent', 'studentMaxAge', 'pointsEarnPer', 'pointValue', 'pointsMinRedeem', 'pointsMaxRedeemPercent', 'pointsExpiryMonths', 'referralPointsReferrer', 'referralPointsReferee'].map((k) => [k, fd.get(k)]));
      body.pointsEnabled = fd.has('pointsEnabled'); body.referralEnabled = fd.has('referralEnabled');
      await run(() => api('/admin/settings', { method: 'PUT', body }), 'تم الحفظ');
      pageSettings();
    };
    if (isAdmin) {
      const amBody = () => { const fd = new FormData($('#amf')); const b = Object.fromEntries(fd); ['enabled', 'createOrder', 'autoSync'].forEach((k) => (b[k] = fd.has(k))); return b; };
      $('#amf').onsubmit = async (e) => { e.preventDefault(); await run(() => api('/admin/settings/amadeus', { method: 'PUT', body: amBody() }), 'تم حفظ إعدادات Amadeus'); pageSettings(); };
      $('#amTest').onclick = async () => { await run(() => api('/admin/settings/amadeus', { method: 'PUT', body: { ...amBody(), enabled: s.amadeus.enabled } })); await run(() => api('/admin/settings/amadeus/test', { method: 'POST' }), '✔ الاتصال بـ Amadeus يعمل'); };
    }
    $('#pwf').onsubmit = async (e) => { e.preventDefault(); await run(() => api('/admin/me/password', { method: 'PUT', body: Object.fromEntries(new FormData(e.target)) }), 'تم تغيير كلمة المرور'); e.target.reset(); };
    if (isAdmin) {
      $('#stf').onsubmit = async (e) => { e.preventDefault(); await run(() => api('/admin/staff', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }), 'تمت إضافة الموظف'); pageSettings(); };
      $$('[data-del]', main).forEach((b) => (b.onclick = () => confirm('حذف الموظف؟') && run(() => api('/admin/staff/' + b.dataset.del, { method: 'DELETE' })).then(pageSettings)));
    }
  }

  // ---------- نقاط الزبون ----------
  async function pointsModal(u, done) {
    const r = await api(`/admin/customers/${u.id}/points`);
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal">
      <div class="row"><h2>نقاط ${esc(u.name)}</h2><span class="spacer"></span><b style="font-size:22px">${r.balance}</b><button type="button" class="btn sm" id="x" aria-label="إغلاق">✕</button></div>
      ${ME.role === 'admin' ? `<form class="row" id="pf"><label class="f">نقاط (+ إضافة، − خصم)<input name="delta" type="number" required style="width:140px"></label><label class="f" style="flex:1">السبب<input name="note" required placeholder="مثال: تعويض عن تأخير"></label><button class="btn primary" style="align-self:flex-end">تطبيق</button></form>` : ''}
      <div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>العملية</th><th>النقاط</th><th>الرصيد</th></tr></thead><tbody>
      ${r.items.map((i) => `<tr><td class="small">${fmtIso(i.at)}</td><td>${esc(r.reasons[i.reason] || i.reason)}${i.note ? ` <span class="muted small">— ${esc(i.note)}</span>` : ''}</td><td class="ltr" style="color:${i.delta > 0 ? 'var(--accent)' : 'var(--danger)'}">${i.delta > 0 ? '+' : ''}${i.delta}</td><td>${i.balance}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">لا توجد عمليات</td></tr>'}
      </tbody></table></div></div>`;
    document.body.appendChild(bg);
    const close = () => bg.remove();
    $('#x', bg).onclick = close;
    bg.onclick = (e) => e.target === bg && close();
    const f = $('#pf', bg);
    if (f) f.onsubmit = async (e) => {
      e.preventDefault();
      await run(() => api(`/admin/customers/${u.id}/points`, { method: 'POST', body: Object.fromEntries(new FormData(f)) }), 'تم تعديل النقاط');
      close();
      done();
    };
  }

  // ---------- توثيق الطلاب ----------
  async function pageStudents() {
    const main = shell('#/students', `<div class="head"><h1>توثيق الطلاب</h1><span class="muted small">يرفع الطالب بطاقة الطالب وشهادة تسجيل السنة الحالية من التطبيق</span></div>
      <div class="alert info" style="margin-bottom:14px">تحقق قبل القبول: <b>الاسم في البطاقة يطابق الاسم المكتوب</b>، والشهادة <b>للسنة الدراسية الحالية</b>، والعمر ضمن الحد المسموح. الطالب الموثّق يحصل على خصم الطالب لنفسه فقط، ويُطابَق اسمه مع الجواز عند كل حجز.</div>
      <div class="tabs">${[['pending', 'بانتظار المراجعة'], ['verified', 'موثّقون'], ['rejected', 'مرفوضون'], ['expired', 'منتهي التوثيق'], ['', 'الكل']].map(([k, l], i) => `<button data-s="${k}" class="${i === 0 ? 'on' : ''}">${l}</button>`).join('')}</div><div id="list"></div>`);
    const load = async (st = 'pending') => {
      const { list, defaultValidUntil } = await api('/admin/students?status=' + st);
      const age = (d) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / (365.25 * 864e5)) : '');
      const label = { pending: 'بانتظار المراجعة', verified: 'موثّق', rejected: 'مرفوض', expired: 'منتهي' };
      const cls = { pending: 's-new', verified: 's-ticketed', rejected: 's-cancelled', expired: 's-cancelled' };
      $('#list', main).innerHTML = list.length ? `<div class="grid g2">${list.map((x) => `<div class="card grid">
        <div class="row"><b>${esc(x.name)}</b><span class="ltr muted small">${esc(x.phone)}</span><span class="spacer"></span><span class="pill ${cls[x.status]}">${label[x.status]}</span></div>
        <dl class="kv"><dt>الاسم كما في الوثائق</dt><dd class="ltr"><b>${esc(x.lastName)}/${esc(x.firstName)}</b></dd><dt>تاريخ الميلاد</dt><dd>${esc(x.birthDate)} (${age(x.birthDate)} سنة)</dd><dt>الجامعة / المدرسة</dt><dd>${esc(x.university)}</dd>${x.studentIdNo ? `<dt>رقم الطالب</dt><dd class="mono">${esc(x.studentIdNo)}</dd>` : ''}<dt>أُرسل</dt><dd>${fmtIso(x.submittedAt)}</dd>
        ${x.validUntil ? `<dt>صالح حتى</dt><dd>${esc(x.validUntil)}</dd>` : ''}${x.rejectReason ? `<dt>سبب الرفض</dt><dd>${esc(x.rejectReason)}</dd>` : ''}${x.verifiedBy ? `<dt>بواسطة</dt><dd>${esc(x.verifiedBy)}</dd>` : ''}</dl>
        <div class="row">${x.card ? `<a class="btn sm" target="_blank" rel="noopener" href="${fileUrl(x.card.name)}">بطاقة الطالب</a>` : ''}${x.certificate ? `<a class="btn sm" target="_blank" rel="noopener" href="${fileUrl(x.certificate.name)}">شهادة التسجيل</a>` : ''}</div>
        ${x.status === 'pending' ? `<div class="row"><label class="f">صالح حتى<input type="date" data-until="${x.userId}" value="${defaultValidUntil}"></label><button class="btn primary" data-ok="${x.userId}" style="align-self:flex-end">قبول</button><button class="btn danger" data-no="${x.userId}" style="align-self:flex-end">رفض</button></div>` : ''}
        ${x.status === 'verified' ? `<button class="btn sm danger" data-revoke="${x.userId}">إلغاء التوثيق</button>` : ''}
      </div>`).join('')}</div>` : '<div class="card empty">لا يوجد</div>';
      $$('[data-ok]', main).forEach((b) => (b.onclick = () => run(() => api(`/admin/students/${b.dataset.ok}/approve`, { method: 'POST', body: { validUntil: $(`[data-until="${b.dataset.ok}"]`, main).value } }), 'تم التوثيق وإبلاغ الطالب').then(() => { load(st); refreshStats(); })));
      $$('[data-no]', main).forEach((b) => (b.onclick = () => { const reason = prompt('سبب الرفض (يصل للطالب):', 'الشهادة ليست للسنة الدراسية الحالية'); if (reason) run(() => api(`/admin/students/${b.dataset.no}/reject`, { method: 'POST', body: { reason } }), 'تم الرفض').then(() => { load(st); refreshStats(); }); }));
      $$('[data-revoke]', main).forEach((b) => (b.onclick = () => { const reason = prompt('سبب إلغاء التوثيق:'); if (reason) run(() => api(`/admin/students/${b.dataset.revoke}/revoke`, { method: 'POST', body: { reason } }), 'تم').then(() => load(st)); }));
    };
    $$('.tabs button', main).forEach((b) => (b.onclick = () => { $$('.tabs button', main).forEach((x) => x.classList.toggle('on', x === b)); load(b.dataset.s); }));
    await load();
  }

  // ---------- باقات العمرة والحج ----------
  async function pagePackages() {
    const list = await api('/admin/packages');
    const main = shell('#/packages', `<div class="head"><h1>العمرة والحج</h1><div class="row">${list.some((p) => p.demo) ? '<button class="btn danger sm" id="delDemo">حذف الباقات التجريبية</button>' : ''}<button class="btn primary" id="add">+ باقة جديدة</button></div></div>
      ${list.length ? `<div class="table-wrap"><table><thead><tr><th>الباقة</th><th>السفر</th><th>الأسعار (للشخص)</th><th>محجوز</th><th>الأماكن المتبقية</th><th>الحالة</th><th></th></tr></thead><tbody>
      ${list.map((p) => `<tr><td><span class="pill ${p.type === 'hajj' ? 's-confirmed' : 's-accepted'}">${p.type === 'hajj' ? 'حج' : 'عمرة'}</span> <b>${esc(p.title)}</b>${p.demo ? ' <span class="pill s-new">تجريبية</span>' : ''}<div class="small muted">${esc(p.airline)}</div></td>
        <td class="small">${esc(p.departDate)} ← ${esc(p.returnDate)}</td>
        <td class="small">${p.roomPrices.map((r) => `${ROOMS[r.room]}: ${money(r.price)}`).join('<br>')}</td>
        <td>${p.booked}</td><td>${p.seats}</td>
        <td>${p.active ? '<span class="pill s-ticketed">منشورة</span>' : '<span class="pill s-cancelled">مخفية</span>'}</td>
        <td class="row" style="flex-wrap:nowrap"><button class="btn sm" data-edit="${p.id}">تعديل</button><button class="btn sm" data-copy="${p.id}">نسخ</button><button class="btn sm danger" data-del="${p.id}">حذف</button></td></tr>`).join('')}
      </tbody></table></div>` : '<div class="card empty">لا توجد باقات. أضف أول باقة عمرة.</div>'}`);
    $('#add').onclick = () => packageModal(null);
    $$('[data-edit]', main).forEach((b) => (b.onclick = () => packageModal(list.find((p) => p.id == b.dataset.edit))));
    $$('[data-copy]', main).forEach((b) => (b.onclick = () => { const p = { ...list.find((x) => x.id == b.dataset.copy) }; delete p.id; packageModal(p); }));
    $$('[data-del]', main).forEach((b) => (b.onclick = () => confirm('حذف الباقة؟') && run(() => api('/admin/packages/' + b.dataset.del, { method: 'DELETE' }), 'تم الحذف').then(pagePackages)));
    if ($('#delDemo')) $('#delDemo').onclick = async () => { if (!confirm('حذف الباقات التجريبية؟')) return; for (const p of list.filter((x) => x.demo)) await run(() => api('/admin/packages/' + p.id, { method: 'DELETE' })); pagePackages(); };
  }

  function packageModal(p) {
    const isEdit = p && p.id;
    const v = (x) => esc(x ?? '');
    const price = (room) => ((p && p.roomPrices.find((r) => r.room === room)) || {}).price || '';
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<form class="modal" id="pm">
      <div class="row"><h2>${isEdit ? 'تعديل باقة' : 'باقة جديدة'}</h2><span class="spacer"></span><button type="button" class="btn sm" id="x" aria-label="إغلاق">✕</button></div>
      <div class="grid g3">
        <label class="f">النوع<select name="type"><option value="umrah" ${p?.type !== 'hajj' ? 'selected' : ''}>عمرة</option><option value="hajj" ${p?.type === 'hajj' ? 'selected' : ''}>حج</option></select></label>
        <label class="f">العنوان<input name="title" required value="${v(p?.title)}" placeholder="عمرة رمضان 15 يوماً"></label>
        <label class="f">العنوان بالفرنسية<input name="titleFr" class="ltr" value="${v(p?.titleFr)}"></label>
        <label class="f">العنوان بالإنجليزية<input name="titleEn" class="ltr" value="${v(p?.titleEn)}"></label>
        <label class="f">تاريخ السفر<input name="departDate" type="date" required value="${v(p?.departDate)}"></label>
        <label class="f">تاريخ العودة<input name="returnDate" type="date" required value="${v(p?.returnDate)}"></label>
        <label class="f">مدينة الانطلاق<select name="departCity">${AIRPORTS.map((a) => `<option value="${a.code}" ${a.code === (p?.departCity || 'NKC') ? 'selected' : ''}>${a.code} · ${esc(a.city)}</option>`).join('')}</select></label>
        <label class="f">شركة الطيران<input name="airline" value="${v(p?.airline)}"></label>
        <label class="f">فندق مكة<input name="hotelMakkah" value="${v(p?.hotelMakkah)}" placeholder="5 نجوم — 300 م من الحرم"></label>
        <label class="f">ليالي مكة<input name="nightsMakkah" type="number" min="0" value="${v(p?.nightsMakkah)}"></label>
        <label class="f">فندق المدينة<input name="hotelMadinah" value="${v(p?.hotelMadinah)}"></label>
        <label class="f">ليالي المدينة<input name="nightsMadinah" type="number" min="0" value="${v(p?.nightsMadinah)}"></label>
        <label class="f">عدد الأماكن المتبقية<input name="seats" type="number" min="0" value="${v(p?.seats ?? 30)}"></label>
      </div>
      <fieldset style="border:1px solid var(--line);border-radius:12px;padding:12px"><legend class="small muted">السعر للشخص البالغ حسب نوع الغرفة (اترك فارغاً إن لم تتوفر)</legend>
        <div class="grid g4">${Object.entries(ROOMS).map(([k, l]) => `<label class="f">غرفة ${l}<input name="room_${k}" type="number" min="0" value="${price(k)}"></label>`).join('')}</div>
        <div class="grid g2" style="margin-top:10px"><label class="f">سعر الطفل (فارغ = سعر الغرفة)<input name="childPrice" type="number" min="0" value="${v(p?.childPrice || '')}"></label><label class="f">سعر الرضيع<input name="infantPrice" type="number" min="0" value="${v(p?.infantPrice || '')}"></label></div>
      </fieldset>
      <div class="grid g2">
        <label class="f">الوصف<textarea name="description">${v(p?.description)}</textarea></label>
        <label class="f">الوصف بالفرنسية<textarea name="descriptionFr" class="ltr">${v(p?.descriptionFr)}</textarea></label>
        <label class="f">الوصف بالإنجليزية<textarea name="descriptionEn" class="ltr">${v(p?.descriptionEn)}</textarea></label>
        <label class="f">ماذا تشمل الباقة (سطر لكل عنصر)<textarea name="includes" rows="5">${v((p?.includes || []).join('\n'))}</textarea></label>
        <label class="f">ماذا تشمل — بالفرنسية<textarea name="includesFr" rows="5" class="ltr">${v((p?.includesFr || []).join('\n'))}</textarea></label>
        <label class="f">ماذا تشمل — بالإنجليزية<textarea name="includesEn" rows="5" class="ltr">${v((p?.includesEn || []).join('\n'))}</textarea></label>
      </div>
      <label class="check"><input type="checkbox" name="active" ${p?.active !== false ? 'checked' : ''}> منشورة للزبائن</label>
      <div class="row"><button class="btn primary" type="submit">${isEdit ? 'حفظ' : 'إضافة'}</button></div>
    </form>`;
    document.body.appendChild(bg);
    const close = () => bg.remove();
    $('#x', bg).onclick = close;
    bg.onclick = (e) => e.target === bg && close();
    $('#pm', bg).onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = Object.fromEntries(fd);
      body.active = fd.has('active');
      body.roomPrices = Object.keys(ROOMS).map((room) => ({ room, price: Number(fd.get('room_' + room)) || 0 })).filter((x) => x.price > 0);
      await run(() => api('/admin/packages' + (isEdit ? '/' + p.id : ''), { method: isEdit ? 'PUT' : 'POST', body }), 'تم الحفظ');
      close();
      pagePackages();
    };
  }

  // ---------- مستحقات المنصة ----------
  async function pagePlatform() {
    const r = await api('/admin/platform');
    const PST = { pending: ['s-new', 'بانتظار تأكيد المالك'], approved: ['s-ticketed', 'مؤكدة'], rejected: ['s-cancelled', 'مرفوضة'] };
    const main = shell('#/platform', `<div class="head"><h1>مستحقات المنصة</h1><span class="muted small">العمولة يحسبها النظام آلياً، والمالك يؤكد الدفعات</span></div>
      <div class="alert info" style="margin-bottom:14px">عمولة المنصة <b>${r.percent}%</b> من السعر المعروض للزبون لكل حجز تم عبر التطبيق. تصبح <b>مستحقة</b> عند إصدار التذكرة، وتُلغى تلقائياً إذا أُلغي الحجز أو استُرجع المبلغ. خصم النقاط تتحمله الوكالة ولا يقلل العمولة.</div>
      <div class="grid g4">
        <div class="card stat"><span class="n" style="font-size:22px">${money(r.balance)}</span><span class="l">المستحق الآن على الوكالة</span></div>
        <div class="card stat"><span class="n" style="font-size:22px">${money(r.thisMonth.earned)}</span><span class="l">عمولة هذا الشهر (${r.thisMonth.count} حجز)</span></div>
        <div class="card stat"><span class="n" style="font-size:22px">${money(r.earnedTotal)}</span><span class="l">إجمالي العمولات المستحقة</span></div>
        <div class="card stat"><span class="n" style="font-size:22px">${money(r.settledTotal)}</span><span class="l">ما سُدّد للمنصة</span></div>
      </div>
      <div class="grid g2" style="margin-top:18px;align-items:start">
        <form class="card grid" id="payf"><h2>ادفع مستحقات المنصة</h2>
          ${r.payoutAccounts.length ? `<div class="small muted">1) حوّل المبلغ إلى أحد حسابات مالك التطبيق، 2) أرسل رقم العملية وصورة الإيصال هنا، 3) يؤكد المالك الاستلام فيُخصم من المستحق.</div>
          <div class="grid" style="gap:8px">${r.payoutAccounts.map((a, i) => `<label class="check" style="padding:10px;border:1px solid var(--line);border-radius:10px"><input type="radio" name="accountId" value="${esc(a.id)}" ${i === 0 ? 'checked' : ''}> <b>${esc(a.name)}</b> <span class="mono">${esc(a.account)}</span> <span class="muted small">${esc(a.holder)}</span></label>`).join('')}</div>
          <div class="grid g2">
            <label class="f">المبلغ المحوَّل (${esc(CFG.currency)})<input name="amount" type="number" min="1" required value="${Math.max(0, r.balance - r.pendingPaymentsTotal) || ''}"></label>
            <label class="f">رقم العملية<input name="reference" class="ltr"></label>
          </div>
          <label class="f">صورة الإيصال<input type="file" name="receipt" accept="image/*,application/pdf" style="padding-top:7px"></label>
          <label class="f">ملاحظة (اختياري)<input name="note" placeholder="مثال: عمولة شهر أكتوبر"></label>
          ${r.pendingPaymentsTotal ? `<div class="alert warn">لديكم دفعات بمبلغ ${money(r.pendingPaymentsTotal)} بانتظار تأكيد المالك.</div>` : ''}
          <button class="btn primary">إرسال إثبات الدفع للمالك</button>` : '<div class="alert warn">لم يضف مالك التطبيق حسابات الاستلام بعد. تواصلوا معه لمعرفة طريقة الدفع.</div>'}
        </form>
        <div class="card"><h2 style="margin-bottom:10px">الدفعات المرسلة للمالك</h2>
          ${r.payments.map((p) => `<div style="padding:8px 0;border-bottom:1px solid #f0ebe0"><div class="row"><b>${money(p.status === 'approved' ? p.approvedAmount : p.amount)}</b><span class="pill ${PST[p.status][0]}">${PST[p.status][1]}</span><span class="spacer"></span><span class="small muted">${fmtIso(p.createdAt)}</span></div>
            <div class="small muted">${esc(p.method)} ${p.reference ? '· ' + esc(p.reference) : ''} · أرسلها ${esc(p.submittedBy)} ${p.receipt ? `· <a target="_blank" rel="noopener" href="${fileUrl(p.receipt.name)}">الإيصال</a>` : ''}</div>
            ${p.status === 'rejected' ? `<div class="alert danger" style="margin-top:6px">سبب الرفض: ${esc(p.reason)}</div>` : ''}
            ${p.status === 'pending' ? `<button class="btn sm danger" data-wd="${p.id}" style="margin-top:6px">سحب الدفعة</button>` : ''}</div>`).join('') || '<div class="muted">لم ترسلوا أي دفعة بعد</div>'}
        </div>
      </div>
      <div class="grid" style="grid-template-columns:minmax(0,2fr) minmax(0,1fr);align-items:start;margin-top:18px">
        <div class="card"><h2 style="margin-bottom:10px">العمولة لكل حجز</h2><div class="table-wrap"><table><thead><tr><th>الحجز</th><th>التاريخ</th><th>المسار</th><th>السعر المعروض</th><th>العمولة</th><th>الحالة</th></tr></thead><tbody>
          ${r.bookings.filter((b) => b.status !== 'awaiting_payment' || b.commission.status !== 'void').map((b) => `<tr class="click" data-id="${b.id}"><td class="mono">${b.ref}</td><td class="small">${fmtIso(b.createdAt)}</td><td>${esc(b.route)}</td><td>${money(b.subtotal)}</td><td><b>${money(b.commission.amount)}</b> <span class="muted small">${b.commission.percent}%</span></td><td><span class="pill ${b.commission.status === 'earned' ? 's-ticketed' : b.commission.status === 'void' ? 's-cancelled' : 's-new'}">${esc(b.commission.label)}</span>${b.flagged ? ' <span class="pill s-confirmed">أُلغي بعد الدفع</span>' : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">لا توجد حجوزات</td></tr>'}
        </tbody></table></div></div>
        <div class="grid">
          <div class="card"><h2 style="margin-bottom:10px">حسب الشهر</h2>${r.months.map((m) => `<div class="row" style="padding:6px 0;border-bottom:1px solid #f0ebe0"><span class="mono">${m.month}</span><span class="muted small">${m.count} حجز</span><span class="spacer"></span><b>${money(m.earned)}</b></div>`).join('') || '<div class="muted">لا يوجد</div>'}</div>
          <div class="card"><h2 style="margin-bottom:10px">الدفعات المسددة</h2>${r.settlements.map((s) => `<div style="padding:6px 0;border-bottom:1px solid #f0ebe0"><div class="row"><span>${esc(s.date)}</span><span class="spacer"></span><b>${money(s.amount)}</b></div><div class="small muted">${esc(s.method)} ${esc(s.note)}</div></div>`).join('') || '<div class="muted">لا يوجد</div>'}</div>
        </div>
      </div>`);
    $$('tr.click', main).forEach((tr) => (tr.onclick = () => (location.hash = '#/booking/' + tr.dataset.id)));
    const pf = $('#payf', main);
    if (pf && r.payoutAccounts.length) pf.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(pf);
      if (!fd.get('receipt') || !fd.get('receipt').size) fd.delete('receipt');
      await run(() => api('/admin/platform/payments', { method: 'POST', form: fd }), 'تم إرسال إثبات الدفع للمالك');
      pagePlatform();
    };
    $$('[data-wd]', main).forEach((b) => (b.onclick = () => confirm('سحب هذه الدفعة؟') && run(() => api('/admin/platform/payments/' + b.dataset.wd, { method: 'DELETE' }), 'تم السحب').then(pagePlatform)));
    refreshStats();
  }

  // ---------- التشغيل ----------
  async function boot() {
    if (!TOKEN) return renderLogin();
    try {
      ME = await api('/admin/me');
      const [cfg, aps, st] = await Promise.all([api('/config'), api('/airports'), api('/admin/stats')]);
      CFG = cfg; AIRPORTS = aps; STATS = st;
      await router();
      if (!window.__statsTimer) window.__statsTimer = setInterval(refreshStats, 30000);
    } catch {
      renderLogin();
    }
  }
  boot();
})();
