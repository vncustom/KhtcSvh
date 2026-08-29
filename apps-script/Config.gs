/**
 * Config.gs — Hằng số và truy cập tham số hệ thống.
 *
 * SPREADSHEET_ID và APP_KEY không nằm trong mã nguồn mà đặt ở
 * Project Settings ➜ Script Properties, để không bị đẩy lên GitHub.
 */

const PROP = PropertiesService.getScriptProperties();

/** ID file Google Sheet dùng làm cơ sở dữ liệu. */
function getSpreadsheetId_() {
  const id = PROP.getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Chưa đặt SPREADSHEET_ID trong Script Properties.');
  return id;
}

/** Khoá dùng chung giữa Vercel và Apps Script. */
function getAppKey_() {
  const k = PROP.getProperty('APP_KEY');
  if (!k) throw new Error('Chưa đặt APP_KEY trong Script Properties.');
  return k;
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(getSpreadsheetId_());
}

/** Giá trị mặc định khi khởi tạo bảng CAU_HINH. */
const CAU_HINH_MAC_DINH = [
  ['DRIVE_ROOT_FOLDER_ID', '', 'ID thư mục gốc trên Drive 5 TB — admin chọn bằng Google Picker'],
  ['DRIVE_ROOT_FOLDER_TEN', 'HTV_KHTC_HoSo', 'Tên thư mục gốc, chỉ để hiển thị'],
  ['KHO_VIDEO_FOLDER_ID', '', 'ID thư mục kho video 20 TB (nếu sau này chuyển sang chế độ riêng tư)'],
  ['EMAIL_GUI', '', 'Địa chỉ gửi OTP; để trống thì dùng tài khoản chạy Apps Script'],
  ['TEN_HE_THONG', 'Cổng quản trị hồ sơ chương trình — Ban Kế hoạch – Tài chính HTV', 'Tên hiển thị trên đầu trang và trong email'],
  ['OTP_TTL_PHUT', '5', 'Thời gian hiệu lực của mã OTP, tính bằng phút'],
  ['PHIEN_TTL_GIO', '12', 'Thời gian hiệu lực của phiên đăng nhập, tính bằng giờ'],
  ['TIN_CAY_THIET_BI_NGAY', '30', 'Số ngày ghi nhớ thiết bị tin cậy'],
  ['SHARE_TTL_NGAY', '90', 'Hạn mặc định của phiếu chia sẻ, tính bằng ngày'],
  ['SO_LAN_SAI_TOI_DA', '5', 'Số lần nhập sai trước khi khoá'],
  ['KHOA_PHUT', '15', 'Thời gian khoá sau khi nhập sai quá số lần cho phép'],
  ['TIEN_TO_MA_HO_SO', 'HTV-KHTC', 'Tiền tố của mã hồ sơ, ví dụ HTV-KHTC-2026-001'],
  ['DON_VI_GUI_DUYET_HO', 'Trung tâm Phát hình - Tư liệu',
    'Tên các đơn vị được gửi duyệt hộ hồ sơ của đơn vị khác, cách nhau bằng dấu chấm phẩy'],
  ['DON_VI_CHU_QUAN_DUOC_DUYET', 'BAT',
    'BAT cho phép đơn vị chủ quản tự duyệt hồ sơ của mình; TAT thì chỉ Ban KH-TC duyệt'],
  ['DOI_TAC_DUOC_TAI', 'BAT',
    'BAT cho phép đối tác tải tệp về máy; TAT thì chỉ xem được qua trình xem nhúng'],
  ['CHE_DO_KIEM_TRA', 'BAT', 'BAT cho phép trang kiểm tra Giai đoạn 0 chạy không cần đăng nhập. Đặt TAT khi chạy thật.'],
  ['QUOTA_MAIL_CANH_BAO', '20', 'Cảnh báo admin khi số email còn lại trong ngày thấp hơn mức này']
];

function getCauHinh(khoa, macDinh) {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('cfg_' + khoa);
  if (hit !== null) return hit;
  const rows = docAllRows_('CAU_HINH');
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].khoa === khoa) {
      cache.put('cfg_' + khoa, String(rows[i].gia_tri), 300);
      return String(rows[i].gia_tri);
    }
  }
  return macDinh === undefined ? '' : macDinh;
}
