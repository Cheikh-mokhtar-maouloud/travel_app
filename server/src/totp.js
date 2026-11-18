// رمز التحقق الثنائي (TOTP) — يعمل مع Google Authenticator و Microsoft Authenticator
const crypto = require('crypto');

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function newSecret() {
  const bytes = crypto.randomBytes(20);
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

function decode(secret) {
  let bits = '';
  for (const c of secret.replace(/=+$/, '').toUpperCase()) {
    const v = B32.indexOf(c);
    if (v < 0) continue;
    bits += v.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function code(secret, counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', decode(secret)).update(buf).digest();
  const o = h[h.length - 1] & 0xf;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1e6).padStart(6, '0');
}

// يقبل الرمز الحالي والرمز السابق/التالي (فرق ساعة بسيط)
function verify(secret, token) {
  const t = String(token || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(t)) return false;
  const c = Math.floor(Date.now() / 30000);
  return [c - 1, c, c + 1].some((x) => crypto.timingSafeEqual(Buffer.from(code(secret, x)), Buffer.from(t)));
}

const uri = (secret, label = 'owner', issuer = 'TravelApp') => `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=6&period=30`;

module.exports = { newSecret, verify, code, uri };
