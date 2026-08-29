/**
 * scripts/dev.js — Máy chủ chạy thử trên máy.
 *
 * Phục vụ thư mục public/ và định tuyến /api/* sang đúng file trong api/,
 * giống hệt cách Vercel làm. Không cần cài Vercel CLI, không cần đăng nhập.
 *
 *   npm run dev      ➜  http://localhost:3000
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const GOC = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TINH = path.join(GOC, 'public');
const API = path.join(GOC, 'api');
const CONG = Number(process.env.PORT) || 3000;

const KIEU = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

/** Vercel cho handler dùng res.status(n); Node thuần thì không, nên thêm vào. */
function boSung(res) {
  res.status = (n) => { res.statusCode = n; return res; };
  return res;
}

async function chayApi(req, res, duongDan) {
  const ten = duongDan.replace(/^\/api\//, '').replace(/\/$/, '') || 'index';

  // Không cho gọi file dùng chung (đặt tên bắt đầu bằng _) và chặn thoát thư mục.
  if (ten.startsWith('_') || ten.includes('..') || ten.includes('/_')) {
    return traLoi(res, 404, { ok: false, loi: 'Không có API này.' });
  }

  const file = path.join(API, ten + '.js');
  if (!fs.existsSync(file)) {
    return traLoi(res, 404, { ok: false, loi: `Không có API "/api/${ten}".` });
  }

  try {
    // Thêm tham số để Node nạp lại module sau mỗi lần sửa file, khỏi phải khởi động lại.
    const mod = await import(pathToFileURL(file).href + '?v=' + Date.now());
    await mod.default(req, boSung(res));
  } catch (e) {
    console.error(e);
    if (!res.headersSent) traLoi(res, 500, { ok: false, loi: e.message });
  }
}

function traLoi(res, ma, obj) {
  res.statusCode = ma;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

function phucVuTinh(res, duongDan) {
  let p = decodeURIComponent(duongDan.split('?')[0]);
  if (p === '/' || p.endsWith('/')) p += 'index.html';

  const file = path.join(TINH, p);
  if (!file.startsWith(TINH)) { res.statusCode = 403; return res.end('Cấm truy cập.'); }

  // cleanUrls: /trang cũng mở được trang.html
  const thu = fs.existsSync(file) ? file
    : fs.existsSync(file + '.html') ? file + '.html'
    : null;

  if (!thu) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end('<h1>404</h1><p>Không tìm thấy <code>' + p + '</code>.</p>');
  }

  res.setHeader('Content-Type', KIEU[path.extname(thu)] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  fs.createReadStream(thu).pipe(res);
}

const server = http.createServer((req, res) => {
  const duongDan = (req.url || '/').split('?')[0];
  if (duongDan.startsWith('/api/')) return chayApi(req, res, duongDan);
  phucVuTinh(res, req.url || '/');
});

server.listen(CONG, () => {
  const thieu = ['GAS_URL', 'GAS_APP_KEY', 'SESSION_SECRET'].filter((k) => !process.env[k]);
  console.log(`\n  Cổng hồ sơ KHTC — máy chủ thử nghiệm`);
  console.log(`  http://localhost:${CONG}\n`);
  if (thieu.length) {
    console.log(`  ⚠  Chưa có biến môi trường: ${thieu.join(', ')}`);
    console.log(`     Tạo file .env.local theo mẫu .env.example rồi chạy lại.\n`);
  } else {
    console.log(`  ✓  Đã nạp đủ biến môi trường.\n`);
  }
});
