/**
 * js/hoso-danhsach.js — Danh sách hồ sơ chương trình: lọc, phân trang, lọc nhanh theo trạng thái.
 */

import { goiCanDangNhap as api, soVn, ngayVn, chu, $ } from './api.js';
import { dungKhung, coQuyen, bao } from './khung.js';
import { LOP_TRANG_THAI, TEN_TRANG_THAI, giaySangChu, tongThoiLuong } from './hoso-chung.js';

const loc = { trang: 1, moi_trang: 20, sap_xep: 'moi_nhat', trang_thai: '' };
let danhMuc = {};

/* ---------- Khởi động ---------- */

(async function batDau() {
  const me = await dungKhung({ trangHienTai: '/ho-so' });
  if (!me) return;

  const duocThem = coQuyen('ho_so.them');
  $('nutThem').classList.toggle('an', !duocThem);
  $('nutNhapExcel').classList.toggle('an', !duocThem);

  // Cho phép mở sẵn một bộ lọc từ địa chỉ, ví dụ /ho-so?trang_thai=CHO_DUYET
  const tham = new URLSearchParams(location.search);
  if (tham.get('trang_thai')) loc.trang_thai = tham.get('trang_thai');

  await napDanhMuc();
  await nap();
})();

async function napDanhMuc() {
  const [dm, donVi] = await Promise.all([
    api('layDanhMuc'),
    coQuyen('don_vi.xem') ? api('danhSachDonViDayDu') : Promise.resolve([])
  ]);
  danhMuc = dm;

  themLuaChon($('fKenh'), (dm.KENH || []).map((k) => [k.ma, k.ten]));
  themLuaChon($('fTheLoai'), (dm.THE_LOAI || []).map((k) => [k.ma, k.ten]));
  themLuaChon($('fDonVi'), donVi.map((d) => [d.don_vi_id, d.ten]));
}

function themLuaChon(sel, cap) {
  for (const [gt, ten] of cap) {
    const o = document.createElement('option');
    o.value = gt;
    o.textContent = ten;
    sel.append(o);
  }
}

/* ---------- Nạp và vẽ ---------- */

async function nap() {
  let d;
  try {
    d = await api('danhSachHoSo', {
      ...loc,
      tu_khoa: $('fTuKhoa').value,
      don_vi_id: $('fDonVi').value,
      kenh: $('fKenh').value,
      the_loai: $('fTheLoai').value
    });
  } catch (e) {
    bao(e.message, 'loi', 7);
    return;
  }

  veLocNhanh(d.thong_ke);
  veBang(d.dong);

  chu($('tomTat'), `${soVn(d.tong)} hồ sơ · ${tongThoiLuong(d.thong_ke.tong_thoi_luong)}`);
  chu($('soTrang'), `Trang ${d.trang} / ${d.so_trang}`);
  $('nutTruoc').disabled = d.trang <= 1;
  $('nutSau').disabled = d.trang >= d.so_trang;
  $('khongCo').classList.toggle('an', d.dong.length > 0);
}

function veLocNhanh(tk) {
  const vung = $('locNhanh');
  vung.replaceChildren();

  const muc = [
    ['', 'Tất cả', tk.tong],
    ['NHAP', TEN_TRANG_THAI.NHAP, tk.NHAP || 0],
    ['CHO_DUYET', TEN_TRANG_THAI.CHO_DUYET, tk.CHO_DUYET || 0],
    ['DA_DUYET', TEN_TRANG_THAI.DA_DUYET, tk.DA_DUYET || 0],
    ['LUU_TRU', TEN_TRANG_THAI.LUU_TRU, tk.LUU_TRU || 0]
  ];

  for (const [ma, ten, so] of muc) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'vien-loc' + (loc.trang_thai === ma ? ' dang-o' : '');
    b.append(ten);

    const dem = document.createElement('span');
    dem.className = 'dem';
    dem.textContent = soVn(so);
    b.append(dem);

    b.addEventListener('click', () => {
      loc.trang_thai = ma;
      loc.trang = 1;
      nap();
    });
    vung.append(b);
  }
}

function veBang(dong) {
  const tbody = $('bangHoSo');
  tbody.replaceChildren();

  for (const h of dong) {
    const tr = document.createElement('tr');

    const ma = document.createElement('td');
    ma.className = 'so';
    const maCode = document.createElement('code');
    maCode.textContent = h.ho_so_id;
    ma.append(maCode);

    const ten = document.createElement('td');
    const t1 = document.createElement('div');
    t1.style.fontWeight = '500';
    t1.textContent = h.ten_chuong_trinh;
    ten.append(t1);
    if (h.ten_file) {
      const tf = document.createElement('div');
      tf.style.cssText = 'font-size:12.5px;color:var(--chu-mo)';
      tf.textContent = 'File: ' + h.ten_file;
      ten.append(tf);
    }
    if (h.doi_tac.length) {
      const t2 = document.createElement('div');
      t2.style.cssText = 'font-size:12.5px;color:var(--chu-mo)';
      t2.textContent = 'Đối tác: ' + h.doi_tac.join(', ');
      ten.append(t2);
    }

    const phatSong = document.createElement('td');
    phatSong.className = 'so';
    if (h.ngay_phat_song) {
      phatSong.append(ngayVn(h.ngay_phat_song));
      if (h.gio_phat_song) {
        const g = document.createElement('div');
        g.style.cssText = 'font-size:12.5px;color:var(--chu-mo)';
        g.textContent = h.gio_phat_song;
        phatSong.append(g);
      }
    } else {
      phatSong.append('—');
    }

    const tt = document.createElement('td');
    const chip = document.createElement('span');
    chip.className = 'trang-thai ' + LOP_TRANG_THAI[h.trang_thai];
    chip.textContent = h.ten_trang_thai;
    tt.append(chip);

    const xem = document.createElement('td');
    const a = document.createElement('a');
    a.className = 'nut-nho';
    a.style.textDecoration = 'none';
    a.href = '/ho-so-chi-tiet?id=' + encodeURIComponent(h.ho_so_id);
    a.textContent = 'Xem';
    xem.append(a);

    tr.append(
      ma, ten,
      o(h.don_vi_chu_quan),
      o(h.kenh || '—'),
      o(h.thoi_luong_giay ? giaySangChu(h.thoi_luong_giay) : '—', 'so'),
      phatSong, tt, xem
    );
    tbody.append(tr);
  }
}

function o(noiDung, lop) {
  const td = document.createElement('td');
  if (lop) td.className = lop;
  td.textContent = noiDung ?? '';
  return td;
}

/* ---------- Sự kiện ---------- */

let hoan = null;
$('fTuKhoa').addEventListener('input', () => {
  clearTimeout(hoan);
  hoan = setTimeout(() => { loc.trang = 1; nap(); }, 350);
});

for (const id of ['fDonVi', 'fKenh', 'fTheLoai', 'fSapXep']) {
  $(id).addEventListener('change', () => {
    if (id === 'fSapXep') loc.sap_xep = $('fSapXep').value;
    loc.trang = 1;
    nap();
  });
}

$('nutXoaLoc').addEventListener('click', () => {
  for (const id of ['fTuKhoa', 'fDonVi', 'fKenh', 'fTheLoai']) $(id).value = '';
  $('fSapXep').value = 'moi_nhat';
  Object.assign(loc, { trang: 1, sap_xep: 'moi_nhat', trang_thai: '' });
  nap();
});

$('nutTruoc').addEventListener('click', () => { loc.trang--; nap(); });
$('nutSau').addEventListener('click', () => { loc.trang++; nap(); });
$('nutThem').addEventListener('click', () => { location.href = '/ho-so-sua'; });
$('nutNhapExcel').addEventListener('click', () => { location.href = '/nhap-excel'; });
