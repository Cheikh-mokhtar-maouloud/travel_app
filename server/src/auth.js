// تسجيل الدخول والصلاحيات (JWT)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { db, DATA_DIR } = require('./db');

function getSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const f = path.join(DATA_DIR, 'secret.key');
  if (!fs.existsSync(f)) fs.writeFileSync(f, crypto.randomBytes(48).toString('hex'));
  return fs.readFileSync(f, 'utf8').trim();
}
let SECRET = null;

function sign(user) {
  if (!SECRET) SECRET = getSecret();
  return jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: '60d' });
}

function readToken(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  if (req.query && req.query.token) return String(req.query.token); // لروابط الملفات (PDF / صور)
  return null;
}

// roles: مصفوفة الأدوار المسموحة، أو null لأي مستخدم مسجّل
function auth(roles = null) {
  return (req, res, next) => {
    if (!SECRET) SECRET = getSecret();
    const t = readToken(req);
    if (!t) return res.status(401).json({ error: 'يرجى تسجيل الدخول' });
    try {
      const p = jwt.verify(t, SECRET);
      const u = db().users.find((x) => x.id === p.id);
      if (!u || u.disabled) return res.status(401).json({ error: 'الحساب غير موجود أو موقوف' });
      if (roles && !roles.includes(u.role)) return res.status(403).json({ error: 'ليست لديك صلاحية' });
      req.user = u;
      next();
    } catch {
      return res.status(401).json({ error: 'انتهت الجلسة، سجّل الدخول من جديد' });
    }
  };
}

const STAFF = ['admin', 'staff'];

function publicUser(u) {
  const { passwordHash, totp, ...rest } = u;
  return { ...rest, totpEnabled: !!(totp && totp.enabled) };
}

module.exports = { sign, auth, STAFF, publicUser };
