/**
 * js/bao-cao.js — Báo cáo tổng hợp, xuất Excel và bản in.
 */

import { goiCanDangNhap as api, soVn, chu, $ } from './api.js';
import { dungKhung, coQuyen, bao, cho } from './khung.js';
import { tongThoiLuong, giaySangChu, TEN_TRANG_THAI } from './hoso-chung.js';
import { tien } from './hoso-hopdong.js';

let ketQua = null;

(async function batDau() {
  const me = await dungKhung({ trangHienTai: '/bao-cao' });
  if (!me) return;

  if (!coQuyen('bao_cao.xem')) {
    chu($('tomTat'), 'Tài khoản của bạn không có quyền xem báo cáo.');
    return;
  }

  try {
    for (const d of await api('danhSachDonViDayDu')) {
      if (d.loai !== 'NOI_BO') continue;
      const o = document.createElement('option');
      o.value = d.don_vi_id;
      o.textContent = d.ten;
      $('fDonVi').append(o);
    }
  } catch (e) { /* đơn vị chủ quản không đọc được danh sách thì vẫn xem báo cáo được */ }

  veLocNhanhKy();
  await nap();
})();

/* ---------- Lọc nhanh theo kỳ ---------- */

function veLocNhanhKy() {
  const homNay = new Date();
  const nam = homNay.getFullYear();
  const thang = homNay.getMonth();
  const iso = (d) => d.toISOString().slice(0, 10);

  const ky = [
    ['Tháng này', new Date(nam, thang, 1), new Date(nam, thang + 1, 0)],
    ['Tháng trước', new Date(nam, thang - 1, 1), new Date(nam, thang, 0)],
    ['Quý này', new Date(nam, Math.floor(thang / 3) * 3, 1), new Date(nam, Math.floor(thang / 3) * 3 + 3, 0)],
    ['Năm nay', new Date(nam, 0, 1), new Date(nam, 11, 31)]
  ];

  const vung = $('locNhanhKy');
  for (const [ten, tu, den] of ky) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'nut-nho';
    b.textContent = ten;
    b.addEventListener('click', () => {
      $('fTuNgay').value = iso(tu);
      $('fDenNgay').value = iso(den);
      nap();
    });
    vung.append(b);
  }
}

function docLoc() {
  return {
    tu_ngay: $('fTuNgay').value,
    den_ngay: $('fDenNgay').value,
    don_vi_id: $('fDonVi').value
  };
}

/* ---------- Nạp và vẽ ---------- */

async function nap() {
  let d;
  try {
    d = await api('baoCaoTongHop', docLoc());
  } catch (e) {
    bao(e.message, 'loi', 7);
    return;
  }

  ketQua = d;
  veSoLieu(d);
  veNhom('bangDonVi', d.theo_don_vi);
  veNhom('bangKenh', d.theo_kenh);
  veNhom('bangTheLoai', d.theo_the_loai);
  veNhom('bangThang', d.theo_thang, thangDep);
  veHopDong(d.hop_dong);

  const khoang = (d.tu_ngay ? `từ ${vnNgay(d.tu_ngay)}` : 'từ đầu')
    + (d.den_ngay ? ` đến ${vnNgay(d.den_ngay)}` : ' đến nay');
  chu($('tomTat'), `${soVn(d.tong_ho_so)} hồ sơ · ${tongThoiLuong(d.tong_giay)} · ${khoang}`);
  chu($('khoangIn'), `Khoảng thời gian: ${khoang}`);
  chu($('lapLuc'), `Lập lúc ${new Date(d.lap_luc).toLocaleString('vi-VN', { hour12: false })}`);
}

function veSoLieu(d) {
  const tt = d.theo_trang_thai;
  const muc = [
    { so: soVn(d.tong_ho_so), ten: 'Tổng hồ sơ' },
    { so: tongThoiLuong(d.tong_giay), ten: 'Tổng thời lượng' },
    { so: soVn((tt.DA_DUYET || 0) + (tt.LUU_TRU || 0)), ten: 'Đã duyệt' },
    { so: soVn(tt.CHO_DUYET || 0), ten: TEN_TRANG_THAI.CHO_DUYET, nhan: (tt.CHO_DUYET || 0) > 0 }
  ];

  const vung = $('oSoLieu');
  vung.replaceChildren();

  for (const m of muc) {
    const div = document.createElement('div');
    div.className = 'o-so';
    if (m.nhan) div.style.borderTopColor = 'var(--canh-bao)';

    const s = document.createElement('div');
    s.className = 'con-so';
    s.style.fontSize = '20px';
    if (m.nhan) s.style.color = 'var(--canh-bao)';
    s.textContent = m.so;

    const t = document.createElement('div');
    t.className = 'ten';
    t.textContent = m.ten;

    div.append(s, t);
    vung.append(div);
  }
}

function veNhom(id, ds, doiTen) {
  const tbody = $(id);
  tbody.replaceChildren();

  if (!ds.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.className = 'trong';
    td.textContent = 'Không có dữ liệu trong khoảng đã chọn.';
    tr.append(td);
    tbody.append(tr);
    return;
  }

  const lonNhat = Math.max(...ds.map((o) => o.so_ho_so)) || 1;

  for (const o of ds) {
    const ten = document.createElement('td');
    ten.textContent = doiTen ? doiTen(o.ten) : o.ten;

    // Thanh nền mờ giúp so sánh tỉ lệ mà không cần thêm biểu đồ riêng.
    const soHs = document.createElement('td');
    soHs.className = 'so';
    soHs.style.position = 'relative';
    const nen = document.createElement('span');
    nen.style.cssText = `position:absolute;left:0;top:4px;bottom:4px;border-radius:3px;
      background:var(--mat-2);width:${Math.round((o.so_ho_so / lonNhat) * 100)}%`;
    const chuSo = document.createElement('span');
    chuSo.style.position = 'relative';
    chuSo.textContent = soVn(o.so_ho_so);
    soHs.append(nen, chuSo);

    const tr = document.createElement('tr');
    tr.append(ten, soHs, o1(soVn(o.da_duyet)), o1(giaySangChu(o.giay)));
    tbody.append(tr);
  }
}

function veHopDong(hd) {
  if (!hd) return;
  $('khoiHopDong').classList.remove('an');

  chu($('tomTatHopDong'),
    `Tổng ${tien(hd.tong_gia_tri)} · đã thanh toán ${tien(hd.da_tra)} · còn lại ${tien(hd.con_lai)}`);

  const tbody = $('bangHopDong');
  tbody.replaceChildren();

  if (!hd.theo_don_vi.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.className = 'trong';
    td.textContent = 'Chưa có hợp đồng nào trong khoảng đã chọn.';
    tr.append(td);
    tbody.append(tr);
    return;
  }

  for (const o of hd.theo_don_vi) {
    const conLai = o.gia_tri - o.da_tra;
    const tiLe = o.gia_tri > 0 ? Math.round((o.da_tra / o.gia_tri) * 100) : 0;

    const tienDo = document.createElement('td');
    const ray = document.createElement('div');
    ray.className = 'thanh-ray';
    ray.style.minWidth = '90px';
    const day = document.createElement('div');
    day.className = 'thanh-day ' + (tiLe >= 100 ? 'muc-tot' : 'muc-navy');
    day.style.width = Math.min(100, tiLe) + '%';
    ray.append(day);
    const nhan = document.createElement('div');
    nhan.style.cssText = 'font-size:12px;color:var(--chu-mo);margin-top:3px';
    nhan.textContent = tiLe + '%';
    tienDo.append(ray, nhan);

    const oConLai = o1(tien(o.gia_tri - o.da_tra));
    if (conLai > 0) oConLai.style.color = 'var(--canh-bao)';

    const tr = document.createElement('tr');
    tr.append(o1(o.ten), o1(soVn(o.so_hop_dong)), o1(tien(o.gia_tri)),
      o1(tien(o.da_tra)), oConLai, tienDo);
    tbody.append(tr);
  }
}

function o1(noiDung) {
  const td = document.createElement('td');
  td.className = 'so';
  td.textContent = noiDung ?? '';
  return td;
}

/** "2026-09" thành "Tháng 9/2026". */
function thangDep(s) {
  const m = String(s).match(/^(\d{4})-(\d{2})$/);
  return m ? `Tháng ${Number(m[2])}/${m[1]}` : s;
}

function vnNgay(iso) {
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleDateString('vi-VN');
}

/* ---------- Sự kiện ---------- */

for (const id of ['fTuNgay', 'fDenNgay', 'fDonVi']) {
  $(id).addEventListener('change', nap);
}

$('nutXoaLoc').addEventListener('click', () => {
  for (const id of ['fTuNgay', 'fDenNgay', 'fDonVi']) $(id).value = '';
  nap();
});

$('nutIn').addEventListener('click', () => window.print());

$('nutXuat').addEventListener('click', (ev) => cho(ev.currentTarget, async () => {
  const r = await api('xuatExcel', { loai: 'BAO_CAO', loc: docLoc() });
  taiVe(r.ten_tep, r.du_lieu);
  bao('Đã tạo tệp ' + r.ten_tep);
}));

/** Đổi chuỗi base64 thành tệp rồi để trình duyệt tải xuống. */
export function taiVe(tenTep, base64) {
  const nhiPhan = atob(base64);
  const byte = new Uint8Array(nhiPhan.length);
  for (let i = 0; i < nhiPhan.length; i++) byte[i] = nhiPhan.charCodeAt(i);

  const blob = new Blob([byte], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = tenTep;
  document.body.append(a);
  a.click();
  a.remove();

  // Thu hồi địa chỉ tạm sau khi trình duyệt đã kịp bắt đầu tải.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
