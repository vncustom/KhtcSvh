/**
 * MoTrang.gs — Gộp mọi thứ một trang cần vào đúng một lời gọi.
 *
 * Mỗi lần gọi Apps Script tốn khoảng hai giây, phần lớn là chi phí khởi động
 * chứ không phải đọc dữ liệu. Trang chi tiết hồ sơ trước đây gọi bảy lần nên
 * mất hơn mười giây mới hiện đủ; gộp lại còn một lần thì chỉ còn khoảng hai giây.
 *
 * Trong cùng một lần chạy, các bảng đã đọc còn nằm sẵn trong bộ đệm nên gộp
 * gần như không tốn thêm thời gian nào.
 */

function moTrang_(payload, ctx) {
  const trang = String(payload.trang || '');
  const ra = { toi: goiNguoiDung_(ctx.user) };

  switch (trang) {

    case 'BANG_DIEU_KHIEN':
      ra.bang = bangDieuKhien_({}, ctx);
      if (co_(ctx, 'cau_hinh.xem')) ra.tinh_trang = tinhTrangHeThong_({}, ctx);
      return ra;

    case 'HO_SO':
      ra.danh_muc = layDanhMuc_({}, ctx);
      ra.don_vi = thuLay_(function () { return danhSachDonViDayDu_({}, ctx); }, []);
      ra.danh_sach = danhSachHoSo_(payload.loc || {}, ctx);
      return ra;

    case 'CHI_TIET':
      ra.danh_muc = layDanhMuc_({}, ctx);
      ra.don_vi = thuLay_(function () { return danhSachDonViDayDu_({}, ctx); }, []);
      ra.chi_tiet = chiTietHoSo_({ ho_so_id: payload.ho_so_id }, ctx);
      ra.tep = thuLay_(function () { return danhSachTep_({ ho_so_id: payload.ho_so_id }, ctx); }, null);
      ra.hop_dong = thuLay_(function () { return hopDongCuaHoSo_({ ho_so_id: payload.ho_so_id }, ctx); }, null);
      ra.chia_se = thuLay_(function () { return danhSachPhieu_({ ho_so_id: payload.ho_so_id }, ctx); }, null);
      return ra;

    case 'BIEU_MAU':
      ra.danh_muc = layDanhMuc_({}, ctx);
      ra.don_vi = thuLay_(function () { return danhSachDonViDayDu_({}, ctx); }, []);
      if (payload.ho_so_id) {
        ra.chi_tiet = chiTietHoSo_({ ho_so_id: payload.ho_so_id }, ctx);
      }
      return ra;

    case 'HOP_DONG':
      ra.don_vi = thuLay_(function () { return danhSachDonViDayDu_({}, ctx); }, []);
      ra.danh_sach = danhSachHopDong_(payload.loc || {}, ctx);
      return ra;

    case 'BAO_CAO':
      ra.don_vi = thuLay_(function () { return danhSachDonViDayDu_({}, ctx); }, []);
      ra.bao_cao = baoCaoTongHop_(payload.loc || {}, ctx);
      return ra;

    case 'QUAN_TRI':
      ra.nguoi_dung = thuLay_(function () { return danhSachNguoiDung_({}, ctx); }, null);
      ra.don_vi = thuLay_(function () { return danhSachDonViDayDu_({}, ctx); }, null);
      if (co_(ctx, 'cau_hinh.xem')) {
        ra.cau_hinh = layCauHinh_({}, ctx);
        ra.tinh_trang = tinhTrangHeThong_({}, ctx);
      }
      return ra;

    case 'NHAP_EXCEL':
      ra.danh_muc = layDanhMuc_({}, ctx);
      ra.don_vi = thuLay_(function () { return danhSachDonViDayDu_({}, ctx); }, []);
      return ra;

    default:
      // Không có phần riêng thì vẫn trả về thông tin người dùng, đủ để dựng khung trang.
      return ra;
  }
}

/**
 * Chạy một phần của trang, thiếu quyền thì trả về giá trị thay thế.
 *
 * Gộp nhiều phần vào một lời gọi thì một phần bị từ chối quyền không được làm
 * hỏng cả trang — ví dụ tài khoản đối tác không đọc được danh sách đơn vị,
 * nhưng vẫn phải xem được hồ sơ.
 */
function thuLay_(ham, thayThe) {
  try {
    return ham();
  } catch (e) {
    return thayThe;
  }
}
