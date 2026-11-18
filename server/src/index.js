// نقطة تشغيل الخادم
const path = require('path');
const os = require('os');
const express = require('express');
const cors = require('cors');
const { load } = require('./db');
const { sweep, sweepAmadeus } = require('./services');
const { translate } = require('./i18n');

load();

const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ترجمة رسائل الخطأ للزبون الذي يستعمل الفرنسية
app.use('/api', (req, res, next) => {
  const lang = req.get('x-lang');
  if (lang !== 'fr' && lang !== 'en') return next();
  const json = res.json.bind(res);
  res.json = (body) => json(body && typeof body.error === 'string' ? { ...body, error: translate(body.error, lang) } : body);
  next();
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/owner', require('./routes/owner'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', require('./routes/api').router);

// لوحة تحكم الوكالة ولوحة المالك
app.use('/admin', express.static(path.join(__dirname, '..', 'public', 'admin')));
app.use('/owner', express.static(path.join(__dirname, '..', 'public', 'owner')));
app.use('/shared', express.static(path.join(__dirname, '..', 'public', 'shared')));
app.get('/', (_req, res) => res.redirect('/admin/'));

app.use('/api', (_req, res) => res.status(404).json({ error: 'غير موجود' }));

// معالجة الأخطاء
app.use((err, _req, res, _next) => {
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 400 : 500);
  if (status >= 500 && status !== 502) console.error(err);
  res.status(status).json({ error: status >= 500 && status !== 502 ? 'حدث خطأ في الخادم' : err.message });
});

setInterval(sweep, 60 * 1000);
setInterval(() => sweepAmadeus().catch(() => {}), 10 * 60 * 1000);
sweep();

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, '0.0.0.0', () => {
  const ips = Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
  console.log('\n✈  الخادم يعمل');
  console.log(`   لوحة الوكالة:  http://localhost:${PORT}/admin   (admin / admin123 — غيّرها فوراً)`);
  console.log(`   لوحة المالك:   http://localhost:${PORT}/owner   (كلمة المرور في data/OWNER-PASSWORD.txt)`);
  ips.forEach((ip) => console.log(`   من الهاتف:      http://${ip}:${PORT}`));
  console.log('');
});
