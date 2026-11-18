// قاعدة بيانات بسيطة في ملف JSON (data/db.json)
// لا تحتاج تثبيت أي برنامج قاعدة بيانات. مناسبة لوكالة صغيرة/متوسطة.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'db.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

const EMPTY = {
  users: [],
  airports: [],
  flights: [],
  packages: [],
  bookings: [],
  requests: [],
  messages: [],
  notifications: [],
  pointsLedger: [],
  settlements: [],
  platformPayments: [],
  audit: [],
  settings: {},
  owner: {},
  counters: {},
};

let data = null;

function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (fs.existsSync(FILE)) {
    data = { ...JSON.parse(JSON.stringify(EMPTY)), ...JSON.parse(fs.readFileSync(FILE, 'utf8')) };
  } else {
    data = JSON.parse(JSON.stringify(EMPTY));
    require('./seed')(data);
    console.log('✔ تم إنشاء قاعدة بيانات جديدة مع بيانات تجريبية');
  }
  require('./migrate')(data);
  save();
}

function save() {
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
  fs.renameSync(tmp, FILE);
}

function nextId(name) {
  data.counters[name] = (data.counters[name] || 0) + 1;
  return data.counters[name];
}

function db() {
  return data;
}

const randomCode = (len = 6) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += chars[bytes[i] % chars.length];
  return s;
};

module.exports = { load, save, nextId, db, randomCode, DATA_DIR, FILE, UPLOADS_DIR };
