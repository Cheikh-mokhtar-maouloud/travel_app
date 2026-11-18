// رفع الملفات (إيصالات الدفع، التذاكر PDF)
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { UPLOADS_DIR } = require('./db');

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname || '') || '').toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 6);
    cb(null, crypto.randomBytes(16).toString('hex') + (ext || ''));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.includes(file.mimetype)) cb(null, true);
    else cb(Object.assign(new Error('نوع الملف غير مسموح (صورة أو PDF فقط)'), { status: 400 }));
  },
});

function fileRecord(file) {
  if (!file) return null;
  return { name: file.filename, original: file.originalname, mime: file.mimetype, size: file.size };
}

module.exports = { upload, fileRecord };
