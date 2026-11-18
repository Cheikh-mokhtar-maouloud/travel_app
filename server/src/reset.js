// حذف قاعدة البيانات وإعادة إنشائها بالبيانات التجريبية: npm run reset
const fs = require('fs');
const { FILE } = require('./db');
if (fs.existsSync(FILE)) fs.unlinkSync(FILE);
require('./db').load();
console.log('تمت إعادة الضبط.');
