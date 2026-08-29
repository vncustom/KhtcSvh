/**
 * scripts/kiem-tra-quyen.mjs — Kiểm thử bảng phân quyền.
 *
 * Nạp thẳng mã Quyen.gs và HoSo.gs rồi chạy trên dữ liệu giả, nên bộ kiểm này
 * kiểm đúng logic sẽ chạy thật chứ không phải một bản chép lại.
 *
 *   npm run kiemtra
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GOC = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/* ---------- Dữ liệu giả ---------- */

const HO_SO = {
  nhap_A: { ho_so_id: 'HS1', don_vi_chu_quan_id: 'DV_A', trang_thai: 'NHAP' },
  cho_A: { ho_so_id: 'HS2', don_vi_chu_quan_id: 'DV_A', trang_thai: 'CHO_DUYET' },
  duyet_A: { ho_so_id: 'HS3', don_vi_chu_quan_id: 'DV_A', trang_thai: 'DA_DUYET' },
  luu_A: { ho_so_id: 'HS4', don_vi_chu_quan_id: 'DV_A', trang_thai: 'LUU_TRU' },
  nhap_B: { ho_so_id: 'HS5', don_vi_chu_quan_id: 'DV_B', trang_thai: 'NHAP' },
  cho_B: { ho_so_id: 'HS6', don_vi_chu_quan_id: 'DV_B', trang_thai: 'CHO_DUYET' },
  duyet_B: { ho_so_id: 'HS7', don_vi_chu_quan_id: 'DV_B', trang_thai: 'DA_DUYET' }
};

const DON_VI = [
  { don_vi_id: 'DV_A', ten: 'Ban Khoa giáo', loai: 'NOI_BO' },
  { don_vi_id: 'DV_B', ten: 'Ban Văn nghệ', loai: 'NOI_BO' },
  { don_vi_id: 'DV_TL', ten: 'Trung tâm Phát hình - Tư liệu', loai: 'NOI_BO' },
  { don_vi_id: 'DT_1', ten: 'Sở Văn hóa', loai: 'DOI_TAC' }
];

/** Gán DV_A cho đối tác DT_1, chỉ với hồ sơ HS3 và HS7. */
const HO_SO_DON_VI = [
  { ho_so_id: 'HS3', don_vi_id: 'DT_1' },
  { ho_so_id: 'HS7', don_vi_id: 'DT_1' }
];

const CAU_HINH = {
  DON_VI_GUI_DUYET_HO: 'Trung tâm Phát hình - Tư liệu',
  DON_VI_CHU_QUAN_DUOC_DUYET: 'BAT'
};

/* ---------- Nạp mã thật với các hàm phụ trợ giả ---------- */

function napMa(cauHinh) {
  const nguon = ['Util.gs', 'Quyen.gs', 'HoSo.gs']
    .map((f) => fs.readFileSync(path.join(GOC, 'apps-script', f), 'utf8'))
    .join('\n');

  const docAllRows_ = (tab) => {
    if (tab === 'DON_VI') return DON_VI;
    if (tab === 'HO_SO') return Object.values(HO_SO);
    if (tab === 'HO_SO_DON_VI') return HO_SO_DON_VI;
    return [];
  };
  const timMot_ = (tab, truong, giaTri) =>
    docAllRows_(tab).find((r) => String(r[truong]) === String(giaTri)) || null;
  const loc_ = (tab, ham) => docAllRows_(tab).filter(ham);
  const getCauHinh = (khoa, macDinh) => (khoa in cauHinh ? cauHinh[khoa] : macDinh);
  const ghiNhatKy_ = () => {};
  const Utilities = { formatDate: () => '' };

  const lay = new Function(
    'docAllRows_', 'timMot_', 'loc_', 'getCauHinh', 'ghiNhatKy_', 'Utilities',
    nguon + `
    return { co_, phamViHoSo_, duocGuiDuyet_, duocDuyet_, coTheChuyen_,
             kiemTraDuocXem_, kiemTraDuocSua_, duocLam_, trongPhamVi_, doiTacTheoHoSo_ };`
  );
  return lay(docAllRows_, timMot_, loc_, getCauHinh, ghiNhatKy_, Utilities);
}

/* ---------- Các vai trò đem ra thử ---------- */

const VAI = {
  admin: { nhom: 'ADMIN', don_vi_id: '', user_id: 'U1' },
  khtc: { nhom: 'KHTC', don_vi_id: 'DV_B', user_id: 'U2' },
  donViA: { nhom: 'DON_VI', don_vi_id: 'DV_A', user_id: 'U3' },
  donViB: { nhom: 'DON_VI', don_vi_id: 'DV_B', user_id: 'U4' },
  tuLieu: { nhom: 'DON_VI', don_vi_id: 'DV_TL', user_id: 'U5' },
  doiTac: { nhom: 'DOI_TAC', don_vi_id: 'DT_1', user_id: 'U6' }
};

/* ---------- Bộ kiểm ---------- */

let dat = 0;
const hong = [];

function k(ten, thuc, mong) {
  if (thuc === mong) { dat++; return; }
  hong.push(`${ten}: nhận ${JSON.stringify(thuc)}, mong ${JSON.stringify(mong)}`);
}

/** Xem được hay không, đổi ngoại lệ thành đúng/sai. */
function xemDuoc(F, h, ctx) {
  try { F.kiemTraDuocXem_(h, ctx); return true; } catch { return false; }
}
function suaDuoc(F, h, ctx) {
  try { F.kiemTraDuocSua_(h, ctx); return true; } catch { return false; }
}

function chay() {
  const F = napMa(CAU_HINH);

  console.log('— Phạm vi xem hồ sơ —');
  k('admin xem hồ sơ đơn vị khác', xemDuoc(F, HO_SO.nhap_B, VAI.admin), true);
  k('KHTC xem hồ sơ mọi đơn vị', xemDuoc(F, HO_SO.nhap_A, VAI.khtc), true);
  k('đơn vị A xem hồ sơ của mình', xemDuoc(F, HO_SO.nhap_A, VAI.donViA), true);
  k('đơn vị A KHÔNG xem hồ sơ đơn vị B', xemDuoc(F, HO_SO.nhap_B, VAI.donViA), false);
  k('đối tác xem hồ sơ đã duyệt được gán', xemDuoc(F, HO_SO.duyet_A, VAI.doiTac), true);
  k('đối tác KHÔNG xem hồ sơ chưa duyệt', xemDuoc(F, HO_SO.nhap_A, VAI.doiTac), false);
  k('đối tác KHÔNG xem hồ sơ không được gán', xemDuoc(F, HO_SO.cho_B, VAI.doiTac), false);

  console.log('— Quyền sửa —');
  k('đơn vị A sửa hồ sơ nháp của mình', suaDuoc(F, HO_SO.nhap_A, VAI.donViA), true);
  k('đơn vị A KHÔNG sửa hồ sơ đơn vị B', suaDuoc(F, HO_SO.nhap_B, VAI.donViA), false);
  k('đơn vị A KHÔNG sửa hồ sơ đang chờ duyệt', suaDuoc(F, HO_SO.cho_A, VAI.donViA), false);
  k('đơn vị A sửa được hồ sơ đã duyệt (sẽ phải duyệt lại)',
    suaDuoc(F, HO_SO.duyet_A, VAI.donViA), true);
  k('không ai sửa hồ sơ đang lưu trữ', suaDuoc(F, HO_SO.luu_A, VAI.admin), false);
  k('đối tác KHÔNG sửa gì', suaDuoc(F, HO_SO.duyet_A, VAI.doiTac), false);

  console.log('— Gửi duyệt —');
  k('đơn vị A gửi duyệt hồ sơ của mình', F.duocGuiDuyet_(HO_SO.nhap_A, VAI.donViA), true);
  k('đơn vị B KHÔNG gửi duyệt hộ đơn vị A', F.duocGuiDuyet_(HO_SO.nhap_A, VAI.donViB), false);
  k('Trung tâm Tư liệu gửi duyệt hộ được', F.duocGuiDuyet_(HO_SO.nhap_A, VAI.tuLieu), true);
  k('KHTC gửi duyệt mọi hồ sơ', F.duocGuiDuyet_(HO_SO.nhap_A, VAI.khtc), true);
  k('đối tác KHÔNG gửi duyệt', F.duocGuiDuyet_(HO_SO.nhap_A, VAI.doiTac), false);

  console.log('— Duyệt —');
  k('KHTC duyệt hồ sơ bất kỳ', F.duocDuyet_(HO_SO.cho_A, VAI.khtc), true);
  k('đơn vị A duyệt hồ sơ của chính mình', F.duocDuyet_(HO_SO.cho_A, VAI.donViA), true);
  k('đơn vị B KHÔNG duyệt hồ sơ đơn vị A', F.duocDuyet_(HO_SO.cho_A, VAI.donViB), false);
  k('Trung tâm Tư liệu KHÔNG duyệt hộ', F.duocDuyet_(HO_SO.cho_A, VAI.tuLieu), false);
  k('đối tác KHÔNG duyệt', F.duocDuyet_(HO_SO.cho_A, VAI.doiTac), false);

  console.log('— Chuyển trạng thái đúng chặng —');
  k('không gửi duyệt hồ sơ đã chờ duyệt',
    F.coTheChuyen_(HO_SO.cho_A, VAI.donViA, 'GUI_DUYET'), false);
  k('không duyệt hồ sơ còn ở Nháp', F.coTheChuyen_(HO_SO.nhap_A, VAI.khtc, 'DUYET'), false);
  k('trả lại chỉ từ Chờ duyệt', F.coTheChuyen_(HO_SO.cho_A, VAI.khtc, 'TRA_LAI'), true);
  k('không trả lại hồ sơ đã duyệt', F.coTheChuyen_(HO_SO.duyet_A, VAI.khtc, 'TRA_LAI'), false);
  k('lưu trữ từ Đã duyệt', F.coTheChuyen_(HO_SO.duyet_A, VAI.khtc, 'LUU_TRU'), true);
  k('mở lại từ Lưu trữ', F.coTheChuyen_(HO_SO.luu_A, VAI.khtc, 'MO_LAI'), true);

  console.log('— Nút hiện ra cho từng vai —');
  const doiTacXemDuyetA = F.duocLam_(HO_SO.duyet_A, VAI.doiTac);
  k('đối tác không thấy nút sửa', doiTacXemDuyetA.sua, false);
  k('đối tác không thấy nút xoá', doiTacXemDuyetA.xoa, false);
  k('đối tác không thấy nút lưu trữ', doiTacXemDuyetA.LUU_TRU, false);

  const khtcXemDuyetA = F.duocLam_(HO_SO.duyet_A, VAI.khtc);
  k('KHTC thấy nút lưu trữ', khtcXemDuyetA.LUU_TRU, true);
  k('KHTC không xoá được hồ sơ đã duyệt', khtcXemDuyetA.xoa, false);

  console.log('— Phạm vi dùng cho danh sách và báo cáo —');
  const doiTacThay = F.trongPhamVi_(F.phamViHoSo_(VAI.doiTac), F.doiTacTheoHoSo_());
  k('đối tác chỉ thấy 2 hồ sơ được gán và đã duyệt', doiTacThay.length, 2);
  const donViAThay = F.trongPhamVi_(F.phamViHoSo_(VAI.donViA), F.doiTacTheoHoSo_());
  k('đơn vị A thấy đúng 4 hồ sơ của mình', donViAThay.length, 4);
  const adminThay = F.trongPhamVi_(F.phamViHoSo_(VAI.admin), F.doiTacTheoHoSo_());
  k('admin thấy toàn bộ 7 hồ sơ', adminThay.length, 7);

  console.log('— Khi tắt cho phép đơn vị tự duyệt —');
  const G = napMa({ ...CAU_HINH, DON_VI_CHU_QUAN_DUOC_DUYET: 'TAT' });
  k('đơn vị A không còn tự duyệt', G.duocDuyet_(HO_SO.cho_A, VAI.donViA), false);
  k('KHTC vẫn duyệt được', G.duocDuyet_(HO_SO.cho_A, VAI.khtc), true);

  console.log('— Khi bỏ danh sách gửi duyệt hộ —');
  const H = napMa({ ...CAU_HINH, DON_VI_GUI_DUYET_HO: '' });
  k('Trung tâm Tư liệu hết quyền gửi hộ', H.duocGuiDuyet_(HO_SO.nhap_A, VAI.tuLieu), false);
  k('đơn vị A vẫn gửi duyệt hồ sơ mình', H.duocGuiDuyet_(HO_SO.nhap_A, VAI.donViA), true);
}

chay();

console.log('');
if (hong.length) {
  for (const h of hong) console.log('  ✗ ' + h);
  console.log(`\n${dat} phép kiểm đạt, ${hong.length} THẤT BẠI`);
  process.exit(1);
}
console.log(`${dat} phép kiểm phân quyền đều đạt.`);
