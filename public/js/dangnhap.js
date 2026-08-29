/**
 * js/dangnhap.js — Ba bước đăng nhập: mật khẩu ➜ mã xác thực ➜ đổi mật khẩu lần đầu.
 */

import { dat, goi, chu, $ } from './api.js';

const buoc = {
  matKhau: $('buocMatKhau'),
  otp: $('buocOtp'),
  doiMk: $('buocDoiMk')
};

let dongHo = null;

/* ---------- Tiện ích ---------- */

function hien(ten) {
  Object.values(buoc).forEach((s) => s.classList.add('an'));
  buoc[ten].classList.remove('an');
  const oDau = buoc[ten].querySelector('input:not([type=checkbox])');
  if (oDau) oDau.focus();
}

function loi(thongDiep) {
  const el = $('baoLoi');
  chu(el, thongDiep);
  el.classList.remove('an');
}

function tin(thongDiep) {
  const el = $('baoTin');
  chu(el, thongDiep);
  el.classList.toggle('an', !thongDiep);
}

function xoaBao() {
  $('baoLoi').classList.add('an');
  $('baoTin').classList.add('an');
}

/** Khoá nút trong lúc chờ máy chủ, luôn trả về trạng thái cũ dù thành công hay lỗi. */
async function cho(nut, viec) {
  const chuGoc = nut.textContent;
  nut.disabled = true;
  nut.innerHTML = '<span class="quay"></span>';
  nut.append('Đang xử lý…');
  xoaBao();
  try {
    await viec();
  } catch (e) {
    loi(e.message);
  } finally {
    nut.disabled = false;
    nut.textContent = chuGoc;
  }
}

function vaoHeThong() {
  const dich = new URLSearchParams(location.search).get('tiep');
  location.href = dich && dich.startsWith('/') ? dich : '/app';
}

/* ---------- Bước 1: mật khẩu ---------- */

$('nutHienMk').addEventListener('click', () => {
  const o = $('matKhau');
  const dangAn = o.type === 'password';
  o.type = dangAn ? 'text' : 'password';
  $('nutHienMk').textContent = dangAn ? 'Ẩn' : 'Hiện';
  o.focus();
});

$('formMatKhau').addEventListener('submit', (ev) => {
  ev.preventDefault();
  cho(ev.submitter || $('formMatKhau').querySelector('[type=submit]'), async () => {
    const d = await dat('/api/dangnhap', {
      username: $('username').value.trim(),
      mat_khau: $('matKhau').value
    });

    if (d.xong) {
      if (d.nguoi_dung?.buoc_doi_mk) return hien('doiMk');
      return vaoHeThong();
    }

    chu($('emailChe'), d.email_che);
    if (d.canh_bao_quota != null) {
      tin(`Hệ thống chỉ còn ${d.canh_bao_quota} lượt gửi email trong hôm nay.`);
    }
    hien('otp');
    batDauDemNguoc(d.het_han);
  });
});

/* ---------- Bước 2: mã xác thực ---------- */

const oOtp = [...$('oOtp').querySelectorAll('input')];

oOtp.forEach((o, i) => {
  o.addEventListener('input', () => {
    o.value = o.value.replace(/\D/g, '').slice(0, 1);
    if (o.value && i < oOtp.length - 1) oOtp[i + 1].focus();
  });

  o.addEventListener('keydown', (ev) => {
    if (ev.key === 'Backspace' && !o.value && i > 0) oOtp[i - 1].focus();
    if (ev.key === 'ArrowLeft' && i > 0) oOtp[i - 1].focus();
    if (ev.key === 'ArrowRight' && i < oOtp.length - 1) oOtp[i + 1].focus();
  });

  // Dán cả mã 6 số vào bất kỳ ô nào cũng điền đủ.
  o.addEventListener('paste', (ev) => {
    const so = (ev.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!so) return;
    ev.preventDefault();
    so.split('').forEach((c, k) => { if (oOtp[k]) oOtp[k].value = c; });
    oOtp[Math.min(so.length, 5)].focus();
  });
});

$('formOtp').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const ma = oOtp.map((o) => o.value).join('');
  if (ma.length !== 6) return loi('Vui lòng nhập đủ 6 chữ số.');

  cho($('formOtp').querySelector('[type=submit]'), async () => {
    const d = await dat('/api/otp', { ma, ghi_nho: $('ghiNho').checked });
    dungDemNguoc();
    if (d.nguoi_dung?.buoc_doi_mk) return hien('doiMk');
    vaoHeThong();
  });
});

$('nutGuiLai').addEventListener('click', () => {
  cho($('nutGuiLai'), async () => {
    const d = await dat('/api/otp?viec=gui', {});
    oOtp.forEach((o) => { o.value = ''; });
    oOtp[0].focus();
    tin('Đã gửi mã mới. Kiểm tra hộp thư của bạn.');
    batDauDemNguoc(d.het_han);
  });
});

$('nutQuayLai').addEventListener('click', () => {
  dungDemNguoc();
  oOtp.forEach((o) => { o.value = ''; });
  xoaBao();
  hien('matKhau');
});

/* ---------- Đếm ngược hiệu lực mã ---------- */

function batDauDemNguoc(hetHan) {
  dungDemNguoc();
  const dich = new Date(hetHan).getTime();
  const nut = $('nutGuiLai');
  nut.disabled = true;

  const ve = () => {
    const conLai = Math.max(0, Math.round((dich - Date.now()) / 1000));
    const phut = String(Math.floor(conLai / 60)).padStart(2, '0');
    const giay = String(conLai % 60).padStart(2, '0');
    chu($('demNguoc'), `${phut}:${giay}`);

    // Cho gửi lại khi mã còn dưới 4 phút, khớp với hạn một phút ở máy chủ.
    if (conLai <= 240) nut.disabled = false;
    if (conLai === 0) {
      dungDemNguoc();
      chu($('demNguoc'), 'đã hết hạn');
    }
  };

  ve();
  dongHo = setInterval(ve, 1000);
}

function dungDemNguoc() {
  if (dongHo) clearInterval(dongHo);
  dongHo = null;
}

/* ---------- Bước 3: đổi mật khẩu bắt buộc ---------- */

$('formDoiMk').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const moi = $('mkMoi').value;
  if (moi !== $('mkLai').value) return loi('Hai lần nhập mật khẩu mới chưa khớp nhau.');

  cho($('formDoiMk').querySelector('[type=submit]'), async () => {
    await goi('doiMatKhau', { mat_khau_cu: $('mkCu').value, mat_khau_moi: moi });
    vaoHeThong();
  });
});

/* ---------- Khởi động ---------- */

(function batDau() {
  const tham = new URLSearchParams(location.search);
  if (tham.get('ly_do') === 'het_phien') {
    tin('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
  }
  if (tham.get('buoc') === 'doi_mk') {
    hien('doiMk');
    return;
  }
  hien('matKhau');
})();
