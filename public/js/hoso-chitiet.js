/**
 * js/hoso-chitiet.js — Xem một hồ sơ và thực hiện các bước duyệt.
 */

import { goiCanDangNhap as api, soVn, gioVn, ngayVn, chu, $ } from './api.js';
import { dungKhung, bao, cho } from './khung.js';
import { LOP_TRANG_THAI, HANH_DONG, VAI_TRO_DOI_TAC, maHoSoTuUrl, giaySangChu } from './hoso-chung.js';
import { napTep } from './hoso-tep.js';
import { napHopDong, datDonVi } from './hoso-hopdong.js';
import { napChiaSe } from './hoso-chiase.js';

const maHoSo = maHoSoTuUrl();
let danhMuc = {};
let danhSachDonVi = [];

(async function batDau() {
  const me = await dungKhung({ trangHienTai: '/ho-so' });
  if (!me) return;

  if (!maHoSo) {
    chu($('dangTai'), 'Địa chỉ thiếu mã hồ sơ.');
    return;
  }

  danhMuc = await api('layDanhMuc');

  // Danh sách đơn vị dùng cho hộp thoại hợp đồng và phiếu chia sẻ;
  // tài khoản đối tác không có quyền đọc nên bỏ qua trong im lặng.
  try {
    danhSachDonVi = await api('danhSachDonViDayDu');
  } catch (e) {
    danhSachDonVi = [];
  }
  datDonVi(danhSachDonVi);

  await nap();
})();

async function nap() {
  let d;
  try {
    d = await api('chiTietHoSo', { ho_so_id: maHoSo });
  } catch (e) {
    chu($('dangTai'), e.message);
    return;
  }

  $('dangTai').classList.add('an');
  $('noiDung').classList.remove('an');
  ve(d);
}

/** Đổi mã danh mục thành tên đọc được, ví dụ GAMESHOW ➜ Gameshow – Âm nhạc. */
function tenDanhMuc(loai, ma) {
  if (!ma) return '—';
  const m = (danhMuc[loai] || []).find((x) => x.ma === ma);
  return m ? m.ten : ma;
}

function ve(d) {
  const h = d.ho_so;

  document.title = `${h.ten_chuong_trinh} — Cổng hồ sơ KHTC`;
  chu($('maHoSo'), h.ho_so_id);
  chu($('tenChuongTrinh'), h.ten_chuong_trinh);
  chu($('donViChuQuan'), h.don_vi_chu_quan);
  chu($('moTa'), h.mo_ta || 'Chưa có mô tả.');

  const chip = $('chipTrangThai');
  chip.className = 'trang-thai ' + LOP_TRANG_THAI[h.trang_thai];
  chu(chip, h.ten_trang_thai);

  if (h.trang_thai === 'NHAP' && h.ly_do_tra_lai) {
    $('canhTraLai').classList.remove('an');
    chu($('lyDoTraLai'), h.ly_do_tra_lai);
  } else {
    $('canhTraLai').classList.add('an');
  }

  veBang('bangTongQuan', [
    ['Mã hồ sơ', h.ho_so_id],
    ['Mã của đơn vị', h.ma_don_vi || '—'],
    ['Đơn vị chủ quản', h.don_vi_chu_quan],
    ['Thể loại', tenDanhMuc('THE_LOAI', h.the_loai)],
    ['Người tạo', h.nguoi_tao],
    ['Ngày tạo', gioVn(h.ngay_tao)],
    ['Cập nhật gần nhất', gioVn(h.ngay_cap_nhat)],
    ['Người duyệt', h.nguoi_duyet || '—'],
    ['Ngày duyệt', h.ngay_duyet ? gioVn(h.ngay_duyet) : '—']
  ]);

  veBang('bangPhatSong', [
    ['Kênh phát sóng', tenDanhMuc('KENH', h.kenh)],
    ['Thời lượng', h.thoi_luong_giay ? giaySangChu(h.thoi_luong_giay) : '—'],
    ['Tên file', h.ten_file || '—'],
    ['Ngày phát sóng', h.ngay_phat_song ? ngayVn(h.ngay_phat_song) : '—'],
    ['Giờ phát sóng', h.gio_phat_song || '—'],
    ['Ghi chú lịch', h.ghi_chu_lich || '—']
  ]);

  veDoiTac(d.doi_tac);
  veThuMuc(h);
  napTep(h.ho_so_id);
  napHopDong(h.ho_so_id);
  napChiaSe(h.ho_so_id, h.ten_chuong_trinh,
    danhSachDonVi.filter((d) => d.loai === 'DOI_TAC'));
  veNhatKy(d.nhat_ky);
  veHanhDong(d.duoc_lam, h);
}

function veBang(id, dong) {
  const tbody = $(id);
  tbody.replaceChildren();

  for (const [nhan, giaTri] of dong) {
    const tr = document.createElement('tr');
    const a = document.createElement('td');
    a.textContent = nhan;
    const b = document.createElement('td');
    b.textContent = giaTri;
    tr.append(a, b);
    tbody.append(tr);
  }
}

function veDoiTac(ds) {
  const vung = $('dsDoiTac');
  vung.replaceChildren();

  if (!ds.length) {
    const p = document.createElement('p');
    p.className = 'mo-ta';
    p.style.margin = '0';
    p.textContent = 'Hồ sơ này chưa gán đối tác nào.';
    vung.append(p);
    return;
  }

  vung.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px';
  for (const d of ds) {
    const the = document.createElement('div');
    the.style.cssText = 'border:1px solid var(--duong);border-radius:5px;padding:9px 13px;background:var(--nen)';

    const ten = document.createElement('div');
    ten.style.cssText = 'font-weight:500;font-size:13.5px';
    ten.textContent = d.ten;

    const vai = document.createElement('div');
    vai.style.cssText = 'font-size:12.5px;color:var(--chu-mo)';
    vai.textContent = VAI_TRO_DOI_TAC[d.vai_tro] || d.vai_tro || '—';

    the.append(ten, vai);
    vung.append(the);
  }
}

function veThuMuc(h) {
  const vung = $('oThuMuc');
  vung.replaceChildren();

  if (h.drive_url) {
    const a = document.createElement('a');
    a.className = 'nut nut-phu';
    a.style.textDecoration = 'none';
    a.href = h.drive_url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = 'Mở thư mục trên Drive';
    vung.append(a);
  } else {
    const p = document.createElement('div');
    p.className = 'thong-bao';
    p.style.cssText = 'background:var(--mat-2);border-color:var(--duong);color:var(--chu-nhat)';
    p.textContent = 'Thư mục trên Drive sẽ được tạo khi tệp đầu tiên được tải lên.';
    vung.append(p);
  }
}

function veNhatKy(ds) {
  const vung = $('dongThoiGian');
  vung.replaceChildren();

  if (!ds.length) {
    const p = document.createElement('p');
    p.className = 'mo-ta';
    p.style.margin = '0';
    p.textContent = 'Chưa có hoạt động nào.';
    vung.append(p);
    return;
  }

  ds.forEach((r, i) => {
    const moc = document.createElement('div');
    moc.className = 'moc';

    const ray = document.createElement('div');
    ray.className = 'moc-ray';
    const cham = document.createElement('div');
    cham.className = 'moc-cham';
    if (r.ket_qua !== 'THANH_CONG') cham.style.background = 'var(--loi)';
    ray.append(cham);
    if (i < ds.length - 1) {
      const vach = document.createElement('div');
      vach.className = 'moc-vach';
      ray.append(vach);
    }

    const than = document.createElement('div');
    than.className = 'moc-than';

    const khi = document.createElement('div');
    khi.className = 'khi';
    khi.textContent = gioVn(r.thoi_gian);

    const gi = document.createElement('div');
    gi.className = 'gi';
    gi.textContent = r.chi_tiet || r.hanh_dong;

    const ai = document.createElement('div');
    ai.className = 'ai';
    ai.textContent = r.nguoi;

    than.append(khi, gi, ai);
    moc.append(ray, than);
    vung.append(moc);
  });
}

/* ---------- Các nút hành động ---------- */

function veHanhDong(duoc, h) {
  const vung = $('hangHanhDong');
  vung.replaceChildren();

  if (duoc.sua) {
    const a = document.createElement('a');
    a.className = 'nut nut-phu';
    a.style.textDecoration = 'none';
    a.href = '/ho-so-sua?id=' + encodeURIComponent(h.ho_so_id);
    a.textContent = 'Sửa hồ sơ';
    vung.append(a);
  }

  for (const [ma, cauHinh] of Object.entries(HANH_DONG)) {
    if (!duoc[ma]) continue;

    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'nut ' + cauHinh.lop;
    b.textContent = cauHinh.ten;
    b.addEventListener('click', () => {
      if (cauHinh.canLyDo) hoiLyDo(ma, cauHinh.ten);
      else chay(b, ma, '');
    });
    vung.append(b);
  }

  if (duoc.xoa) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'nut-nho nguy';
    b.textContent = 'Xoá hồ sơ';
    b.addEventListener('click', () => cho(b, async () => {
      if (!confirm(`Xoá hồ sơ "${h.ten_chuong_trinh}"?\n\nHồ sơ sẽ không còn hiện trong danh sách. `
        + 'Thư mục tài liệu trên Drive vẫn được giữ nguyên.')) return;
      await api('xoaHoSo', { ho_so_id: maHoSo });
      location.href = '/ho-so';
    }));
    vung.append(b);
  }
}

async function chay(nut, hanhDong, lyDo) {
  await cho(nut, async () => {
    const r = await api('doiTrangThaiHoSo', { ho_so_id: maHoSo, hanh_dong: hanhDong, ly_do: lyDo });
    bao('Hồ sơ chuyển sang trạng thái: ' + r.ten_trang_thai);
    await nap();
  });
}

function hoiLyDo(hanhDong, tenHanhDong) {
  const che = document.createElement('div');
  che.className = 'man-che';
  che.innerHTML = `
    <div class="hop-thoai" role="dialog" aria-modal="true" aria-label="${tenHanhDong}">
      <div class="hop-thoai-dau">
        <h2>${tenHanhDong} hồ sơ</h2>
        <button class="nut-x" type="button" data-dong aria-label="Đóng">✕</button>
      </div>
      <div class="hop-thoai-than">
        <div class="truong">
          <label for="oLyDo">Lý do trả lại *</label>
          <textarea class="o-nhap" id="oLyDo" rows="4"
                    placeholder="Nêu rõ chỗ cần sửa để đơn vị chủ quản biết phải làm gì."></textarea>
          <p class="goi-y">Lý do sẽ được gửi qua email tới đơn vị chủ quản và ghi vào nhật ký hồ sơ.</p>
        </div>
      </div>
      <div class="hop-thoai-chan">
        <button class="nut nut-phu" type="button" data-dong>Huỷ</button>
        <button class="nut nut-chinh" type="button" data-gui>Trả lại hồ sơ</button>
      </div>
    </div>`;

  const dong = () => { che.remove(); document.removeEventListener('keydown', esc); };
  const esc = (ev) => { if (ev.key === 'Escape') dong(); };

  che.querySelectorAll('[data-dong]').forEach((b) => b.addEventListener('click', dong));
  che.addEventListener('click', (ev) => { if (ev.target === che) dong(); });
  document.addEventListener('keydown', esc);

  const nutGui = che.querySelector('[data-gui]');
  nutGui.addEventListener('click', async () => {
    const lyDo = che.querySelector('#oLyDo').value.trim();
    if (!lyDo) return bao('Vui lòng nhập lý do trả lại.', 'canh-bao');
    await chay(nutGui, hanhDong, lyDo);
    dong();
  });

  $('vungHopThoai').append(che);
  che.querySelector('#oLyDo').focus();
}
