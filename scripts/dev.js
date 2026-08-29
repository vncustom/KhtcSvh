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
let dangKhoiDongLai = false;

function chay() {
  con = spawn(process.execPath, [MAY_CHU], { stdio: 'inherit', env: process.env });

  con.on('exit', (ma, tinHieu) => {
    // Khởi động lại do sửa mã thì đã đặt cờ, bỏ qua.
    if (dangKhoiDongLai || dangDong) return;

    // Mọi trường hợp còn lại đều bất thường: cổng bị chiếm, lỗi cú pháp, hoặc
    // có ai đó kết thúc tiến trình. Dừng hẳn thay vì âm thầm hồi sinh máy chủ.
    console.error(tinHieu
      ? `\n  Máy chủ bị kết thúc bởi ${tinHieu}. Chạy lại "npm run dev" khi cần.\n`
      : `\n  Máy chủ dừng với mã ${ma}. Sửa lỗi rồi chạy lại "npm run dev".\n`);
    process.exit(ma || 1);
  });
}

function khoiDongLai(tep) {
  clearTimeout(hen);
  // Trình soạn thảo thường ghi file nhiều lần liên tiếp, nên đợi một nhịp.
  hen = setTimeout(() => {
    console.log(`\n  ↻ ${tep} đã đổi — khởi động lại máy chủ…`);
    dangKhoiDongLai = true;
    if (con) con.kill('SIGTERM');
    setTimeout(() => { dangKhoiDongLai = false; chay(); }, 120);
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
