/**
 * js/huong-dan.js — Trang hướng dẫn, chia theo vai trò.
 * Mở sẵn mục hợp với vai trò của người đang đăng nhập.
 */

import { $ } from './api.js';
import { dungKhung, toi } from './khung.js';

const MUC = [
  { ma: 'DonVi', ten: 'Đơn vị chủ quản', nhom: ['DON_VI'] },
  { ma: 'Khtc', ten: 'Ban Kế hoạch – Tài chính', nhom: ['KHTC'] },
  { ma: 'Admin', ten: 'Quản trị hệ thống', nhom: ['ADMIN'] },
  { ma: 'DoiTac', ten: 'Đối tác', nhom: ['DOI_TAC'] }
];

(async function batDau() {
  const me = await dungKhung({ trangHienTai: '/huong-dan' });
  if (!me) return;

  const thanh = $('thanhThe');
  for (const m of MUC) {
    const b = document.createElement('button');
    b.className = 'the-muc';
    b.type = 'button';
    b.textContent = m.ten;
    b.dataset.ma = m.ma;
    b.setAttribute('role', 'tab');
    b.addEventListener('click', () => mo(m.ma));
    thanh.append(b);
  }

  // Mở mục hợp với vai trò, hoặc mục ghi trên địa chỉ nếu có.
  const yeuCau = location.hash.slice(1);
  const hopVai = MUC.find((m) => m.nhom.includes(me.nhom));
  mo(MUC.some((m) => m.ma === yeuCau) ? yeuCau : (hopVai ? hopVai.ma : 'DonVi'));
})();

function mo(ma) {
  document.querySelectorAll('.muc').forEach((s) => s.classList.add('an'));
  document.querySelectorAll('.the-muc').forEach((b) => {
    const dangO = b.dataset.ma === ma;
    b.classList.toggle('dang-o', dangO);
    b.setAttribute('aria-selected', dangO ? 'true' : 'false');
  });
  $('muc' + ma).classList.remove('an');
  history.replaceState(null, '', '#' + ma);
}

$('nutIn').addEventListener('click', () => {
  // In thì cho hiện hết mọi mục, không chỉ mục đang mở.
  document.querySelectorAll('.muc').forEach((s) => s.classList.remove('an'));
  window.print();
  setTimeout(() => mo(location.hash.slice(1) || 'DonVi'), 500);
});
