/**
 * js/hoso-sua.js — Biểu mẫu thêm và sửa hồ sơ chương trình.
 * Cùng một trang phục vụ cả hai việc: có ?id= là sửa, không có là tạo mới.
 */

import { goiCanDangNhap as api, chu, $ } from './api.js';
import { dungKhung, coQuyen, bao, cho } from './khung.js';
import { VAI_TRO_DOI_TAC, maHoSoTuUrl } from './hoso-chung.js';

const maHoSo = maHoSoTuUrl();
let donViTatCa = [];
let danhMuc = {};

(async function batDau() {
  const me = await dungKhung({ trangHienTai: '/ho-so' });
  if (!me) return;

  if (!maHoSo && !coQuyen('ho_so.them')) {
    chu($('dangTai'), 'Tài khoản của bạn không có quyền tạo hồ sơ.');
    return;
  }

  try {
    [danhMuc, donViTatCa] = await Promise.all([api('layDanhMuc'), api('danhSachDonViDayDu')]);
  } catch (e) {
    chu($('dangTai'), e.message);
    return;
  }

  napLuaChon(me);

  if (maHoSo) {
    try {
      await napHoSoCu();
    } catch (e) {
      chu($('dangTai'), e.message);
      return;
    }
  } else if (me.don_vi_id) {
    // Đơn vị chủ quản chỉ tạo được hồ sơ cho chính mình, nên chọn sẵn và khoá lại.
    $('fDonVi').value = me.don_vi_id;
    if (!coQuyen('ho_so.sua_tat_ca')) $('fDonVi').disabled = true;
  }

  $('dangTai').classList.add('an');
  $('bieuMau').classList.remove('an');
  $('fTen').focus();
})();

function napLuaChon(me) {
  const noiBo = donViTatCa.filter((d) => d.loai === 'NOI_BO');
  const chuQuan = coQuyen('ho_so.sua_tat_ca')
    ? noiBo
    : noiBo.filter((d) => d.don_vi_id === me.don_vi_id);

  const sel = $('fDonVi');
  sel.replaceChildren();
  if (!chuQuan.length) {
    const o = document.createElement('option');
    o.value = '';
    o.textContent = '— Tài khoản chưa gắn đơn vị nào —';
    sel.append(o);
  }
  for (const d of chuQuan) {
    const o = document.createElement('option');
    o.value = d.don_vi_id;
    o.textContent = d.ten;
    sel.append(o);
  }

  themMuc($('fKenh'), danhMuc.KENH || []);
  themMuc($('fTheLoai'), danhMuc.THE_LOAI || []);
}

function themMuc(sel, ds) {
  for (const m of ds) {
    const o = document.createElement('option');
    o.value = m.ma;
    o.textContent = m.ten;
    sel.append(o);
  }
}

/* ---------- Nạp hồ sơ đang sửa ---------- */

async function napHoSoCu() {
  const d = await api('chiTietHoSo', { ho_so_id: maHoSo });
  if (!d.duoc_lam.sua) throw new Error('Bạn không có quyền sửa hồ sơ này.');

  const h = d.ho_so;
  chu($('tieuDe'), 'Sửa hồ sơ ' + h.ho_so_id);
  chu($('phuDe'), h.ten_chuong_trinh);
  document.title = 'Sửa ' + h.ho_so_id + ' — Cổng hồ sơ KHTC';

  const ve = '/ho-so-chi-tiet?id=' + encodeURIComponent(maHoSo);
  $('lienKetQuayLai').href = ve;
  chu($('lienKetQuayLai'), '← Quay lại hồ sơ');
  $('nutHuy').href = ve;

  $('fTen').value = h.ten_chuong_trinh || '';
  $('fDonVi').value = h.don_vi_chu_quan_id || '';
  $('fTheLoai').value = h.the_loai || '';
  $('fKenh').value = h.kenh || '';
  $('fThoiLuong').value = h.thoi_luong_phut || '';
  $('fSoTap').value = h.so_tap || '';
  $('fNgayPhat').value = h.ngay_phat_song || '';
  $('fGioPhat').value = h.gio_phat_song || '';
  $('fGhiChuLich').value = h.ghi_chu_lich || '';
  $('fMoTa').value = h.mo_ta || '';

  if (!coQuyen('ho_so.sua_tat_ca')) $('fDonVi').disabled = true;

  for (const dt of d.doi_tac) themHangDoiTac(dt.don_vi_id, dt.vai_tro);

  // Nói trước hậu quả thay vì để người dùng phát hiện sau khi bấm lưu.
  if (h.trang_thai === 'DA_DUYET' && !coQuyen('ho_so.duyet')) {
    const c = $('canhBaoDuyet');
    chu(c, 'Hồ sơ này đã được duyệt. Khi bạn lưu thay đổi, hồ sơ sẽ quay lại trạng thái '
      + 'Chờ duyệt và cần Ban Kế hoạch – Tài chính duyệt lại.');
    c.classList.remove('an');
  }
}

/* ---------- Đối tác ---------- */

function themHangDoiTac(donViId = '', vaiTro = 'DONG_SAN_XUAT') {
  const hang = document.createElement('div');
  hang.className = 'hang-doi-tac';

  const selDonVi = document.createElement('select');
  selDonVi.className = 'o-nhap';
  const trong = document.createElement('option');
  trong.value = '';
  trong.textContent = '— Chọn đối tác —';
  selDonVi.append(trong);

  for (const d of donViTatCa.filter((x) => x.loai === 'DOI_TAC')) {
    const o = document.createElement('option');
    o.value = d.don_vi_id;
    o.textContent = d.ten;
    selDonVi.append(o);
  }
  selDonVi.value = donViId;

  const selVai = document.createElement('select');
  selVai.className = 'o-nhap';
  for (const [ma, ten] of Object.entries(VAI_TRO_DOI_TAC)) {
    const o = document.createElement('option');
    o.value = ma;
    o.textContent = ten;
    selVai.append(o);
  }
  selVai.value = vaiTro;

  const bo = document.createElement('button');
  bo.type = 'button';
  bo.className = 'nut-bo';
  bo.textContent = '✕';
  bo.setAttribute('aria-label', 'Bỏ đối tác này');
  bo.addEventListener('click', () => hang.remove());

  hang.append(selDonVi, selVai, bo);
  $('dsDoiTac').append(hang);
}

$('nutThemDoiTac').addEventListener('click', () => themHangDoiTac());

function docDoiTac() {
  const ra = [];
  const daCo = new Set();

  for (const hang of $('dsDoiTac').querySelectorAll('.hang-doi-tac')) {
    const [selDonVi, selVai] = hang.querySelectorAll('select');
    const id = selDonVi.value;
    if (!id || daCo.has(id)) continue;   // bỏ hàng trống và hàng trùng
    daCo.add(id);
    ra.push({ don_vi_id: id, vai_tro: selVai.value });
  }
  return ra;
}

/* ---------- Lưu ---------- */

$('bieuMau').addEventListener('submit', (ev) => {
  ev.preventDefault();

  if (!$('fTen').value.trim()) return bao('Vui lòng nhập tên chương trình.', 'canh-bao');
  if (!$('fDonVi').value) return bao('Vui lòng chọn đơn vị chủ quản.', 'canh-bao');
  if (!(Number($('fThoiLuong').value) > 0)) return bao('Thời lượng phải lớn hơn 0 phút.', 'canh-bao');

  cho($('nutLuu'), async () => {
    const r = await api('luuHoSo', {
      ho_so_id: maHoSo || undefined,
      ten_chuong_trinh: $('fTen').value,
      // Ô bị khoá không gửi giá trị, nên đọc thẳng từ phần tử.
      don_vi_chu_quan_id: $('fDonVi').value,
      the_loai: $('fTheLoai').value,
      kenh: $('fKenh').value,
      thoi_luong_phut: Number($('fThoiLuong').value),
      so_tap: Number($('fSoTap').value || 0),
      ngay_phat_song: $('fNgayPhat').value,
      gio_phat_song: $('fGioPhat').value,
      ghi_chu_lich: $('fGhiChuLich').value,
      mo_ta: $('fMoTa').value,
      doi_tac: docDoiTac()
    });

    location.href = '/ho-so-chi-tiet?id=' + encodeURIComponent(r.ho_so_id) + '&luu=1';
  });
});
