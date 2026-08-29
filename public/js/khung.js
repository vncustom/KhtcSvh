/**
 * js/khung.js — Phần dùng chung của mọi trang sau khi đăng nhập:
 * lấy thông tin người đang đăng nhập, dựng thanh điều hướng, đăng xuất.
 */

import { goi, dat, chu, $ } from './api.js';

/** Trang nào cần quyền nào mới hiện trong thanh điều hướng. */
const MENU = [
  { duong_dan: '/app', ten: 'Bảng điều khiển', quyen: null },
  { duong_dan: '/ho-so', ten: 'Hồ sơ chương trình', quyen: null },
  { duong_dan: '/nhap-excel', ten: 'Nhập từ Excel', quyen: 'ho_so.them' },
  { duong_dan: '/quan-tri', ten: 'Quản trị', quyen: 'nhat_ky.xem' }
];

export let toi = null;

/**
 * Nạp thông tin người đang đăng nhập và dựng khung trang.
 * Chưa đăng nhập thì tự chuyển về trang đăng nhập kèm đường dẫn để quay lại.
 */
export async function dungKhung({ trangHienTai } = {}) {
  try {
    toi = await goi('layToi');
  } catch (e) {
    if (e.maLoi === 'HET_PHIEN') return veDangNhap('het_phien');
    if (e.maLoi === 'BUOC_DOI_MK') { location.href = '/?buoc=doi_mk'; return null; }
    throw e;
  }

  chu($('tenNguoiDung'), toi.ho_ten);
  chu($('tenVaiTro'), toi.ten_don_vi ? `${toi.ten_nhom} · ${toi.ten_don_vi}` : toi.ten_nhom);

  const dieuHuong = $('dieuHuong');
  if (dieuHuong) {
    dieuHuong.replaceChildren();
    for (const m of MENU) {
      if (m.quyen && !coQuyen(m.quyen)) continue;
      const a = document.createElement('a');
      a.href = m.duong_dan;
      a.textContent = m.ten;
      a.className = 'menu-muc' + (m.duong_dan === trangHienTai ? ' dang-o' : '');
      dieuHuong.append(a);
    }
  }

  const nutThoat = $('nutThoat');
  if (nutThoat) {
    nutThoat.addEventListener('click', async () => {
      nutThoat.disabled = true;
      try {
        await dat('/api/dangxuat', {});
      } finally {
        location.href = '/';
      }
    });
  }

  return toi;
}

export function coQuyen(quyen) {
  if (!toi) return false;
  return toi.quyen.includes('*') || toi.quyen.includes(quyen);
}

function veDangNhap(lyDo) {
  const tiep = encodeURIComponent(location.pathname);
  location.href = `/?ly_do=${lyDo}&tiep=${tiep}`;
  return null;
}

/* ---------- Thông báo nổi ---------- */

let vungBao = null;

/** Hiện một thông báo ngắn ở góc dưới. loai: 'tot' | 'loi' | 'canh-bao'. */
export function bao(thongDiep, loai = 'tot', giay = 4) {
  if (!vungBao) {
    vungBao = document.createElement('div');
    vungBao.className = 'vung-bao';
    vungBao.setAttribute('role', 'status');
    vungBao.setAttribute('aria-live', 'polite');
    document.body.append(vungBao);
  }

  const o = document.createElement('div');
  o.className = `thong-bao ${loai} bao-noi`;
  o.textContent = thongDiep;
  vungBao.append(o);

  setTimeout(() => {
    o.classList.add('bao-tan');
    setTimeout(() => o.remove(), 300);
  }, giay * 1000);
}

/** Khoá một nút trong lúc chờ máy chủ; lỗi được hiện thành thông báo nổi. */
export async function cho(nut, viec) {
  const chuGoc = nut.textContent;
  nut.disabled = true;
  nut.innerHTML = '<span class="quay"></span>';
  nut.append('Đang xử lý…');
  try {
    return await viec();
  } catch (e) {
    bao(e.message, 'loi', 6);
    return undefined;
  } finally {
    nut.disabled = false;
    nut.textContent = chuGoc;
  }
}
