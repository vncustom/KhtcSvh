/**
 * scripts/dev.js — Người trông máy chủ thử nghiệm.
 *
 * Chạy scripts/may-chu.js trong một tiến trình con và khởi động lại nó mỗi khi
 * mã trong api/ thay đổi. Cần làm theo cách này vì Node giữ nguyên module đã nạp
 * trong suốt vòng đời tiến trình — sửa api/_phien.js mà không khởi động lại thì
 * tiến trình vẫn chạy bản cũ.
 *
 * File trong public/ được đọc lại từ đĩa ở mỗi yêu cầu nên không cần khởi động lại.
 *
 *   npm run dev      ➜  http://localhost:3000
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GOC = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MAY_CHU = path.join(GOC, 'scripts', 'may-chu.js');
const THEO_DOI = [path.join(GOC, 'api'), path.join(GOC, 'scripts')];

let con = null;
let hen = null;
let dangDong = false;

function chay() {
  con = spawn(process.execPath, [MAY_CHU], { stdio: 'inherit', env: process.env });

  con.on('exit', (ma) => {
    if (dangDong) return;
    // Cổng bị chiếm hoặc lỗi cú pháp: dừng hẳn thay vì lặp vô hạn.
    if (ma !== null && ma !== 0) {
      console.error(`\n  Máy chủ dừng với mã ${ma}. Sửa lỗi rồi chạy lại "npm run dev".\n`);
      process.exit(ma);
    }
  });
}

function khoiDongLai(tep) {
  clearTimeout(hen);
  // Trình soạn thảo thường ghi file nhiều lần liên tiếp, nên đợi một nhịp.
  hen = setTimeout(() => {
    console.log(`\n  ↻ ${tep} đã đổi — khởi động lại máy chủ…`);
    if (con) con.kill('SIGTERM');
    setTimeout(chay, 120);
  }, 150);
}

for (const thuMuc of THEO_DOI) {
  if (!fs.existsSync(thuMuc)) continue;
  fs.watch(thuMuc, { recursive: true }, (_su, tep) => {
    if (tep && tep.endsWith('.js')) khoiDongLai(tep);
  });
}

for (const tin of ['SIGINT', 'SIGTERM']) {
  process.on(tin, () => {
    dangDong = true;
    if (con) con.kill('SIGTERM');
    process.exit(0);
  });
}

chay();
