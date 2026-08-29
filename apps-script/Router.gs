/**
 * Router.gs — Điểm vào duy nhất của Web App.
 *
 * Vercel gửi POST với thân là JSON: { key, action, payload, ctx }
 * Apps Script không đọc được header tuỳ ý, nên khoá dùng chung đi trong thân yêu cầu.
 */

/** Các action không cần đăng nhập. */
const ACTION_CONG_KHAI = ['ping', 'dangNhap', 'guiOtp', 'xacThucOtp', 'xemHoSoTheoPhieu', 'guiMaChiaSe'];

/**
 * Action chỉ phục vụ Giai đoạn 0. Chúng bỏ qua bước đăng nhập, nên chỉ chạy
 * khi CHE_DO_KIEM_TRA đang bật. Sang Giai đoạn 1, đặt tham số này thành TAT
 * ở màn hình cấu hình là chúng tự khoá lại.
 */
const ACTION_KIEM_TRA = ['tongQuan', 'ghiThu', 'danhSachDonVi'];

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

    // Các action cần đăng nhập phải kèm phiên hợp lệ.
    if (ACTION_CONG_KHAI.indexOf(action) < 0 && ACTION_KIEM_TRA.indexOf(action) < 0) {
      const user = xacThucPhien_(ctx.session);
      if (!user) return traLoi_({ ok: false, loi: 'Phiên đã hết hạn, mời đăng nhập lại.', maLoi: 'HET_PHIEN' }, 401);
      ctx.user_id = user.user_id;
      ctx.nhom = user.nhom;
      ctx.don_vi_id = user.don_vi_id;
      ctx.user = user;
    }

    const ketQua = ACTIONS[action](payload, ctx);
    return traLoi_({ ok: true, data: ketQua, ms: new Date().getTime() - batDau });

  } catch (err) {
    console.error(err.stack || err.message);
    ghiNhatKy_(req.ctx || {}, 'LOI_HE_THONG', '', '', String(err.message), 'THAT_BAI');
    return traLoi_({ ok: false, loi: String(err.message) }, 500);
  }
}

/** GET chỉ dùng để kiểm tra Web App đã triển khai chưa. */
function doGet() {
  return traLoi_({
    ok: true,
    data: { ten: 'HTV KHTC API', thoi_gian: nowIso_() }
  });
}

function traLoi_(obj, maLoi) {
  if (maLoi) obj.http = maLoi;
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Bảng điều phối. Mỗi giai đoạn bổ sung thêm action vào đây.
 * Giai đoạn 0 chỉ có các action đủ để chứng minh đường truyền thông suốt.
 */
const ACTIONS = {

  /** Kiểm tra toàn tuyến: Vercel ➜ Apps Script ➜ Sheet. */
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

  /** Số liệu tổng quan để trang kiểm tra hiển thị. */
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

  /** Ghi thử một dòng vào NHAT_KY — chứng minh đường ghi hoạt động. */
  ghiThu: function (payload, ctx) {
    const ghiChu = String((payload && payload.ghi_chu) || 'Ghi thử từ trang kiểm tra');
    ghiNhatKy_(ctx, 'GHI_THU', 'NHAT_KY', '', ghiChu, 'THANH_CONG');
    return { da_ghi: true, ghi_chu: ghiChu, thoi_gian: nowIso_() };
  },

  /** Danh sách đơn vị, dùng để đối chiếu dữ liệu mẫu đã nạp đúng chưa. */
  danhSachDonVi: function () {
    return docAllRows_('DON_VI').map(function (d) {
      return { don_vi_id: d.don_vi_id, ten: d.ten, loai: d.loai, email: d.email };
    });
  }
};

/**
 * Xác thực phiên. Giai đoạn 1 sẽ cài đặt đầy đủ;
 * hiện trả về null để mọi action cần đăng nhập đều bị từ chối.
 */
function xacThucPhien_(token) {
  if (!token) return null;
  const hash = sha256Hex_(String(token));
  const phien = timMot_('PHIEN', 'token_hash', hash);
  if (!phien || phien.trang_thai !== 'HOAT_DONG') return null;
  if (new Date(phien.het_han) < new Date()) return null;
  return timMot_('NGUOI_DUNG', 'user_id', phien.user_id);
}
