/**
 * Router.gs — Điểm vào duy nhất của Web App.
 *
 * Vercel gửi POST với thân là JSON: { key, action, payload, ctx }
 * Apps Script không đọc được header tuỳ ý, nên khoá dùng chung đi trong thân yêu cầu.
 */

/** Action không cần đăng nhập. */
const ACTION_CONG_KHAI = [
  'ping', 'dangNhap', 'xacThucOtp', 'guiLaiOtp',
  // Bốn action dưới đây phục vụ đối tác quét mã QR, không có tài khoản trong hệ thống.
  // Mỗi action tự kiểm tra token của phiếu chia sẻ.
  'xemPhieu', 'guiMaChiaSe', 'xacThucPhieu', 'noiDungPhieu', 'ghiLuotMoTep'
];

/**
 * Action chỉ phục vụ Giai đoạn 0. Chúng bỏ qua bước đăng nhập, nên chỉ chạy
 * khi CHE_DO_KIEM_TRA đang bật. Đặt tham số này thành TAT khi chạy thật.
 */
const ACTION_KIEM_TRA = ['tongQuan', 'ghiThu', 'danhSachDonVi'];

/**
 * Action mà người vừa đăng nhập nhưng chưa đổi mật khẩu bắt buộc vẫn gọi được.
 * Mọi action khác bị chặn cho tới khi đổi xong.
 */
const ACTION_KHI_CHUA_DOI_MK = ['layToi', 'doiMatKhau', 'dangXuat'];

function doPost(e) {
  const batDau = new Date().getTime();
  let req = {};
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return traLoi_({ ok: false, loi: 'Thân yêu cầu không phải JSON hợp lệ.' });
  }

  try {
    if (!soSanhAnToan_(String(req.key || ''), getAppKey_())) {
      return traLoi_({ ok: false, loi: 'Khoá truy cập không đúng.' }, 403);
    }

    const action = String(req.action || '');
    const payload = req.payload || {};
    const ctx = req.ctx || {};

    if (!ACTIONS[action]) {
      return traLoi_({ ok: false, loi: 'Không có action "' + action + '".' }, 404);
    }

    if (ACTION_KIEM_TRA.indexOf(action) >= 0 && getCauHinh('CHE_DO_KIEM_TRA', 'TAT') !== 'BAT') {
      return traLoi_({
        ok: false,
        loi: 'Chế độ kiểm tra đang tắt. Bật lại bằng cách đặt CHE_DO_KIEM_TRA = BAT trong tab CAU_HINH.'
      }, 403);
    }

    const canDangNhap = ACTION_CONG_KHAI.indexOf(action) < 0 && ACTION_KIEM_TRA.indexOf(action) < 0;

    if (canDangNhap) {
      const user = xacThucPhien_(ctx.session);
      if (!user) {
        return traLoi_({ ok: false, loi: 'Phiên đã hết hạn, mời đăng nhập lại.', maLoi: 'HET_PHIEN' }, 401);
      }
      ctx.user_id = user.user_id;
      ctx.nhom = user.nhom;
      ctx.don_vi_id = user.don_vi_id;
      ctx.user = user;

      const buocDoi = user.buoc_doi_mk === true || String(user.buoc_doi_mk).toUpperCase() === 'TRUE';
      if (buocDoi && ACTION_KHI_CHUA_DOI_MK.indexOf(action) < 0) {
        return traLoi_({
          ok: false,
          loi: 'Vui lòng đổi mật khẩu trước khi sử dụng hệ thống.',
          maLoi: 'BUOC_DOI_MK'
        }, 403);
      }
    }

    const ketQua = ACTIONS[action](payload, ctx);
    return traLoi_({ ok: true, data: ketQua, ms: new Date().getTime() - batDau });

  } catch (err) {
    console.error(err.stack || err.message);
    return traLoi_({ ok: false, loi: String(err.message) }, err.http || 400);
  }
}

/** GET chỉ dùng để kiểm tra Web App đã triển khai chưa. */
function doGet() {
  return traLoi_({ ok: true, data: { ten: 'HTV KHTC API', thoi_gian: nowIso_() } });
}

function traLoi_(obj, maLoi) {
  if (maLoi) obj.http = maLoi;
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Bảng điều phối. Mỗi giai đoạn bổ sung thêm action vào đây.
 */
const ACTIONS = {

  /* ----- Giai đoạn 0: kiểm tra đường truyền ----- */

  ping: function (payload) {
    const ss = getSpreadsheet_();
    const tabs = ss.getSheets().map(function (s) { return s.getName(); });
    const thieu = THU_TU_TAB.filter(function (t) { return tabs.indexOf(t) < 0; });
    return {
      thong_diep: 'Kết nối thành công',
      thoi_gian: nowIso_(),
      ten_file: ss.getName(),
      so_tab: tabs.length,
      tab_con_thieu: thieu,
      da_khoi_tao: thieu.length === 0,
      tieng_vong: payload && payload.tieng_vong ? String(payload.tieng_vong) : ''
    };
  },

  tongQuan: function () {
    return {
      don_vi: docAllRows_('DON_VI').length,
      nguoi_dung: docAllRows_('NGUOI_DUNG').length,
      danh_muc: docAllRows_('DANH_MUC').length,
      ho_so: docAllRows_('HO_SO').length,
      nhat_ky: docAllRows_('NHAT_KY').length,
      thu_muc_goc: getCauHinh('DRIVE_ROOT_FOLDER_ID', ''),
      email_con_lai_hom_nay: MailApp.getRemainingDailyQuota()
    };
  },

  ghiThu: function (payload, ctx) {
    const ghiChu = String((payload && payload.ghi_chu) || 'Ghi thử từ trang kiểm tra');
    ghiNhatKy_(ctx, 'GHI_THU', 'NHAT_KY', '', ghiChu, 'THANH_CONG');
    return { da_ghi: true, ghi_chu: ghiChu, thoi_gian: nowIso_() };
  },

  danhSachDonVi: function () {
    return docAllRows_('DON_VI').map(function (d) {
      return { don_vi_id: d.don_vi_id, ten: d.ten, loai: d.loai, email: d.email };
    });
  },

  /* ----- Giai đoạn 1: xác thực ----- */

  dangNhap: dangNhap_,
  xacThucOtp: xacThucOtp_,
  guiLaiOtp: guiLaiOtp_,
  dangXuat: dangXuat_,
  layToi: layToi_,
  doiMatKhau: doiMatKhau_,
  quenThietBi: quenThietBi_,

  /* ----- Giai đoạn 1: quản trị ----- */

  danhSachNguoiDung: danhSachNguoiDung_,
  luuNguoiDung: luuNguoiDung_,
  datLaiMatKhau: datLaiMatKhau_,
  doiTrangThaiNguoiDung: doiTrangThaiNguoiDung_,
  moKhoaNguoiDung: moKhoaNguoiDung_,

  danhSachDonViDayDu: danhSachDonViDayDu_,
  luuDonVi: luuDonVi_,

  layCauHinh: layCauHinh_,
  luuCauHinh: luuCauHinh_,
  kiemTraThuMuc: kiemTraThuMuc_,
  luuThuMucGoc: luuThuMucGoc_,
  tinhTrangHeThong: tinhTrangHeThong_,

  layDanhMuc: layDanhMuc_,
  xemNhatKy: xemNhatKy_,

  /* ----- Giai đoạn 2: hồ sơ chương trình ----- */

  danhSachHoSo: danhSachHoSo_,
  chiTietHoSo: chiTietHoSo_,
  luuHoSo: luuHoSo_,
  doiTrangThaiHoSo: doiTrangThaiHoSo_,
  xoaHoSo: xoaHoSo_,
  bangDieuKhien: bangDieuKhien_,

  /* ----- Giai đoạn 3: tệp đính kèm ----- */

  danhSachTep: danhSachTep_,
  taiLenTep: taiLenTep_,
  moPhienTaiLen: moPhienTaiLen_,
  hoanTatTaiLen: hoanTatTaiLen_,
  themLinkTep: themLinkTep_,
  capNhatTep: capNhatTep_,
  xoaTep: xoaTep_,
  kiemTraLinkTep: kiemTraLinkTep_,

  /* ----- Nhập hồ sơ hàng loạt từ phiếu Excel ----- */

  docFileExcel: docFileExcel_,
  taoHangLoat: taoHangLoat_,

  /* ----- Giai đoạn 4: hợp đồng và thanh toán ----- */

  danhSachHopDong: danhSachHopDong_,
  hopDongCuaHoSo: hopDongCuaHoSo_,
  chiTietHopDong: chiTietHopDong_,
  luuHopDong: luuHopDong_,
  xoaHopDong: xoaHopDong_,
  luuThanhToan: luuThanhToan_,
  xoaThanhToan: xoaThanhToan_,

  /* ----- Giai đoạn 4B: phiếu chia sẻ ----- */

  capPhieuChiaSe: capPhieuChiaSe_,
  danhSachPhieu: danhSachPhieu_,
  xemLaiPhieu: xemLaiPhieu_,
  thuHoiPhieu: thuHoiPhieu_,

  /* Bốn action công khai cho đối tác quét mã QR */
  xemPhieu: xemPhieu_,
  guiMaChiaSe: guiMaChiaSe_,
  xacThucPhieu: xacThucPhieu_,
  noiDungPhieu: noiDungPhieu_,
  ghiLuotMoTep: ghiLuotMoTep_
};

/** Xác thực phiên đăng nhập từ token trong cookie. */
function xacThucPhien_(token) {
  if (!token) return null;
  const phien = timMot_('PHIEN', 'token_hash', sha256Hex_(String(token)));
  if (!phien || phien.trang_thai !== 'HOAT_DONG') return null;
  if (new Date(phien.het_han) < new Date()) return null;

  const user = timMot_('NGUOI_DUNG', 'user_id', phien.user_id);
  if (!user || user.trang_thai !== 'HOAT_DONG') return null;
  return user;
}
