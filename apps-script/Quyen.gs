/**
 * Quyen.gs — Phân quyền tập trung.
 *
 * Đây là nơi duy nhất quyết định ai làm được gì. Giao diện có ẩn nút hay không
 * không liên quan: mọi action đều phải đi qua doiHoiQuyen_.
 */

const NHOM = {
  ADMIN: 'Quản trị hệ thống',
  KHTC: 'Ban Kế hoạch – Tài chính',
  DON_VI: 'Đơn vị chủ quản',
  DOI_TAC: 'Đối tác',
  KHACH_QR: 'Khách quét mã QR'
};

/**
 * Bảng quyền. Mỗi vai trò là danh sách quyền được cấp;
 * dấu * nghĩa là toàn quyền.
 */
const BANG_QUYEN = {
  ADMIN: ['*'],

  KHTC: [
    'ho_so.xem_tat_ca', 'ho_so.them', 'ho_so.sua_tat_ca', 'ho_so.xoa', 'ho_so.duyet',
    'hop_dong.xem', 'hop_dong.sua',
    'tep.xem', 'tep.tai_len', 'tep.xoa',
    'chia_se.cap', 'chia_se.thu_hoi', 'chia_se.xem',
    'don_vi.xem', 'don_vi.sua',
    'nguoi_dung.xem',
    'nhat_ky.xem',
    'bao_cao.xem'
  ],

  DON_VI: [
    'ho_so.xem_don_vi', 'ho_so.them', 'ho_so.sua_don_vi', 'ho_so.gui_duyet',
    'hop_dong.xem',
    'tep.xem', 'tep.tai_len',
    'chia_se.de_nghi',
    'don_vi.xem',
    'bao_cao.xem'
  ],

  DOI_TAC: [
    'ho_so.xem_duoc_gan',
    'hop_dong.xem_cua_minh',
    'tep.xem'
  ],

  KHACH_QR: ['ho_so.xem_theo_phieu']
};

function quyenCua_(nhom) {
  return BANG_QUYEN[nhom] || [];
}

function tenNhom_(nhom) {
  return NHOM[nhom] || nhom || '';
}

function co_(ctx, quyen) {
  const ds = quyenCua_(ctx && ctx.nhom);
  return ds.indexOf('*') >= 0 || ds.indexOf(quyen) >= 0;
}

function doiHoiQuyen_(ctx, quyen) {
  if (!co_(ctx, quyen)) {
    ghiNhatKy_(ctx, 'TU_CHOI_QUYEN', '', '', 'Thiếu quyền ' + quyen, 'THAT_BAI');
    throw new Error('Tài khoản của bạn không có quyền thực hiện thao tác này.');
  }
}

function laAdmin_(ctx) {
  return ctx && ctx.nhom === 'ADMIN';
}

/** Phạm vi hồ sơ mà vai trò được nhìn thấy — dùng cho Giai đoạn 2. */
function phamViHoSo_(ctx) {
  if (co_(ctx, 'ho_so.xem_tat_ca')) return { kieu: 'TAT_CA' };
  if (co_(ctx, 'ho_so.xem_don_vi')) return { kieu: 'DON_VI', don_vi_id: ctx.don_vi_id };
  if (co_(ctx, 'ho_so.xem_duoc_gan')) return { kieu: 'DUOC_GAN', don_vi_id: ctx.don_vi_id };
  return { kieu: 'KHONG' };
}
