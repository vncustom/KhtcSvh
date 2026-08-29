/**
 * Log.gs — Nhật ký hệ thống. Chỉ ghi thêm, không sửa, không xoá.
 */

function ghiNhatKy_(ctx, hanhDong, bang, doiTuongId, chiTiet, ketQua, giaTriCu, giaTriMoi) {
  try {
    them_('NHAT_KY', {
      log_id: uuid_(),
      thoi_gian: nowIso_(),
      user_id: (ctx && ctx.user_id) || 'ANONYMOUS',
      hanh_dong: hanhDong,
      bang: bang || '',
      doi_tuong_id: doiTuongId || '',
      gia_tri_cu: giaTriCu ? JSON.stringify(giaTriCu).slice(0, 2000) : '',
      gia_tri_moi: giaTriMoi ? JSON.stringify(giaTriMoi).slice(0, 2000) : '',
      ip: (ctx && ctx.ip) || '',
      ket_qua: ketQua || 'THANH_CONG',
      chi_tiet: chiTiet || ''
    });
  } catch (e) {
    // Nhật ký hỏng không được làm hỏng nghiệp vụ chính.
    console.error('Không ghi được nhật ký: ' + e.message);
  }
}
