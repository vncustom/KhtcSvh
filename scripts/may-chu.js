/**
 * scripts/may-chu.js — Máy chủ thử nghiệm.
 *
 * Phục vụ thư mục public/ và định tuyến /api/* sang đúng file trong api/,
 * giống cách Vercel làm. File này do scripts/dev.js khởi chạy và tự khởi động lại
 * mỗi khi mã trong api/ thay đổi.
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

function traLoi(res, ma, obj) {
  res.statusCode = ma;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

async function chayApi(req, res, duongDan) {
  const ten = duongDan.replace(/^\/api\//, '').replace(/\/$/, '') || 'index';

  // Không cho gọi file dùng chung (tên bắt đầu bằng _) và chặn thoát thư mục.
  if (ten.startsWith('_') || ten.includes('..') || ten.includes('/_')) {
    return traLoi(res, 404, { ok: false, loi: 'Không có API này.' });
  }

  const file = path.join(API, ten + '.js');
  if (!fs.existsSync(file)) {
    return traLoi(res, 404, { ok: false, loi: `Không có API "/api/${ten}".` });
  }

  try {
    const mod = await import(pathToFileURL(file).href);
    await mod.default(req, boSung(res));
  } catch (e) {
    console.error(e);
    if (!res.headersSent) traLoi(res, 500, { ok: false, loi: e.message });
  }
}

function phucVuTinh(res, duongDan) {
  let p = decodeURIComponent(duongDan.split('?')[0]);
  if (p === '/' || p.endsWith('/')) p += 'index.html';

  const file = path.join(TINH, p);
  if (!file.startsWith(TINH)) { res.statusCode = 403; return res.end('Cấm truy cập.'); }

  // cleanUrls: /quan-tri cũng mở được quan-tri.html
  const thu = fs.existsSync(file) && fs.statSync(file).isFile() ? file
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

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n  Cổng ${CONG} đang bị chiếm bởi một tiến trình khác.`);
    console.error('\n  Cách 1 — đóng tiến trình đang giữ cổng (chạy trong PowerShell):');
    console.error(`    Get-NetTCPConnection -LocalPort ${CONG} -State Listen |`
      + ' Select-Object -ExpandProperty OwningProcess -Unique |'
      + ' ForEach-Object { Stop-Process -Id $_ -Force }');
    console.error('\n  Cách 2 — chạy ở cổng khác:');
    console.error('    set PORT=3001 && npm run dev        (Command Prompt)');
    console.error('    $env:PORT=3001; npm run dev         (PowerShell)\n');
    process.exit(1);
  }
  throw e;
});

server.listen(CONG, () => {
  const thieu = ['GAS_URL', 'GAS_APP_KEY', 'SESSION_SECRET'].filter((k) => !process.env[k]);
  console.log('\n  Cổng hồ sơ KHTC — máy chủ thử nghiệm');
  console.log(`  http://localhost:${CONG}\n`);
  if (thieu.length) {
    console.log(`  ⚠  Chưa có biến môi trường: ${thieu.join(', ')}`);
    console.log('     Tạo file .env.local theo mẫu .env.example rồi chạy lại.\n');
  } else {
    console.log('  ✓  Đã nạp đủ biến môi trường.\n');
  }
});

// Cho phép scripts/dev.js dừng máy chủ gọn gàng khi cần khởi động lại.
process.on('SIGTERM', () => server.close(() => process.exit(0)));
