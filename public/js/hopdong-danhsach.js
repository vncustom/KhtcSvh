/**
 * js/hopdong-danhsach.js — Hợp đồng toàn đài: lọc, phân trang, cảnh báo hạn.
 */

import { goiCanDangNhap as api, soVn, chu, $ } from './api.js';
import { dungKhung, coQuyen, bao } from './khung.js';
import { veDanhSachHopDong, datDonVi, datDuocSua, datHamLamMoi, tien } from './hoso-hopdong.js';

const loc = { trang: 1, moi_trang: 20 };
let locNhanh = '';

(async function batDau() {
  const me = await dungKhung({ trangHienTai: '/hop-dong' });
  if (!me) return;

  if (!coQuyen('hop_dong.xem') && !coQuyen('hop_dong.xem_cua_minh')) {
    chu($('soTrang'), 'Tài khoản của bạn không có quyền xem hợp đồng.');
    return;
  }

  try {
    const dv = await api('danhSachDonViDayDu');
    datDonVi(dv);
    for (const d of dv) {
      const o = document.createElement('option');
      o.value = d.don_vi_id;
      o.textContent = d.ten;
      $('fDonVi').append(o);
    }
  } catch (e) {
    datDonVi([]);
  }

  datHamLamMoi(nap);
  await nap();
})();

async function nap() {
  let d;
  try {
    d = await api('danhSachHopDong', {
      ...loc,
      tu_khoa: $('fTuKhoa').value,
      don_vi_id: $('fDonVi').value,
      loai: $('fLoai').value,
      trang_thai: $('fTrangThai').value,
      sap_het_han: locNhanh === 'sap_het_han' || undefined,
      qua_han: locNhanh === 'qua_han' || undefined
    });
  } catch (e) {
    bao(e.message, 'loi', 7);
    return;
  }

  datDuocSua(d.duoc_sua);
  veSoLieu(d.thong_ke);
  veLocNhanh(d.thong_ke);

  veDanhSachHopDong($('dsHopDong'), d.dong, {
    hienChuongTrinh: true,
    chuTrong: 'Không có hợp đồng nào khớp bộ lọc hiện tại.',
    sauKhiDoi: nap
  });

  chu($('soTrang'), `Trang ${d.trang} / ${d.so_trang} · ${soVn(d.tong)} hợp đồng`);
  $('nutTruoc').disabled = d.trang <= 1;
  $('nutSau').disabled = d.trang >= d.so_trang;
}

function veSoLieu(tk) {
  const muc = [
    { so: soVn(tk.tong), ten: 'Hợp đồng' },
    { so: tien(tk.tong_gia_tri), ten: 'Tổng giá trị' },
    { so: tien(tk.da_tra), ten: 'Đã thanh toán' },
    { so: tien(tk.tong_gia_tri - tk.da_tra), ten: 'Còn phải trả', nhan: tk.tong_gia_tri > tk.da_tra }
  ];

  const vung = $('oSoLieu');
  vung.replaceChildren();

  for (const m of muc) {
    const div = document.createElement('div');
    div.className = 'o-so';
    if (m.nhan) div.style.borderTopColor = 'var(--canh-bao)';

    const s = document.createElement('div');
    s.className = 'con-so';
    s.style.fontSize = '19px';
    if (m.nhan) s.style.color = 'var(--canh-bao)';
    s.textContent = m.so;

    const t = document.createElement('div');
    t.className = 'ten';
    t.textContent = m.ten;

    div.append(s, t);
    vung.append(div);
  }
}

function veLocNhanh(tk) {
  const vung = $('locNhanh');
  vung.replaceChildren();

  const muc = [
    ['', 'Tất cả', tk.tong],
    ['sap_het_han', 'Sắp hết hạn', tk.sap_het_han],
    ['qua_han', 'Đã quá hạn', tk.qua_han]
  ];

  for (const [ma, ten, so] of muc) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'vien-loc' + (locNhanh === ma ? ' dang-o' : '');
    b.append(ten);
    const dem = document.createElement('span');
    dem.className = 'dem';
    dem.textContent = soVn(so);
    b.append(dem);
    b.addEventListener('click', () => { locNhanh = ma; loc.trang = 1; nap(); });
    vung.append(b);
  }
}

/* ---------- Sự kiện ---------- */

let hoan = null;
$('fTuKhoa').addEventListener('input', () => {
  clearTimeout(hoan);
  hoan = setTimeout(() => { loc.trang = 1; nap(); }, 350);
});

for (const id of ['fDonVi', 'fLoai', 'fTrangThai']) {
  $(id).addEventListener('change', () => { loc.trang = 1; nap(); });
}

$('nutXoaLoc').addEventListener('click', () => {
  for (const id of ['fTuKhoa', 'fDonVi', 'fLoai', 'fTrangThai']) $(id).value = '';
  locNhanh = '';
  loc.trang = 1;
  nap();
});

$('nutTruoc').addEventListener('click', () => { loc.trang--; nap(); });
$('nutSau').addEventListener('click', () => { loc.trang++; nap(); });
