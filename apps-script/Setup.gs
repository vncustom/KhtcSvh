/**
 * Setup.gs — Khởi tạo cơ sở dữ liệu. Chạy MỘT LẦN từ trình soạn thảo Apps Script.
 *
 * Cách chạy: chọn hàm khoiTaoCoSoDuLieu ➜ Run ➜ xem kết quả ở Execution log.
 * Chạy lại nhiều lần vẫn an toàn: tab đã có thì bỏ qua, dữ liệu mẫu đã có thì không thêm trùng.
 */

/** 20 ban và trung tâm của Đài. */
const DON_VI_NOI_BO = [
  'Ban Chuyên đề',
  'Ban Chương trình',
  'Ban Khoa giáo',
  'Ban Văn nghệ',
  'Ban Thể dục - Thể thao',
  'Ban Kế hoạch - Tài chính',
  'Hãng phim Truyền hình',
  'Trung tâm Tin tức',
  'Trung tâm Phát triển nội dung số',
  'Trung tâm Dịch vụ Truyền thông',
  'Trung tâm Sản xuất chương trình',
  'Trung tâm Phát thanh',
  'Trung tâm HTV Bình Dương',
  'Trung tâm HTV Bà Rịa',
  'Ban Tổ chức - Đào tạo',
  'Văn phòng',
  'Văn phòng đại diện HTV tại Hà Nội',
  'Trung tâm Phát hình - Tư liệu',
  'Ban Kỹ thuật công nghệ',
  'Trung tâm Thể thao HTV'
];

/** Đối tác giai đoạn đầu. Thêm đối tác khác sau qua màn hình quản trị. */
const DOI_TAC_BAN_DAU = [
  { ten: 'Sở Văn hóa và Thể thao TP. Hồ Chí Minh' },
  { ten: 'Công ty ABC' }
];

/** Email dùng chung trong giai đoạn thử nghiệm. Sửa lại ở màn hình quản trị khi chạy thật. */
const EMAIL_TEST = 'patusrila@gmail.com';

const DANH_MUC_BAN_DAU = [
  ['KENH', 'HTV1', 'HTV1'], ['KENH', 'HTV2', 'HTV2'], ['KENH', 'HTV3', 'HTV3'],
  ['KENH', 'HTV4', 'HTV4'], ['KENH', 'HTV7', 'HTV7'], ['KENH', 'HTV9', 'HTV9'],
  ['KENH', 'HTVTT', 'HTV Thể thao'], ['KENH', 'HTVC', 'HTVC'],
  ['KENH', 'RADIO', 'Phát thanh AM/FM'], ['KENH', 'SO', 'Nền tảng số'],

  ['THE_LOAI', 'GAMESHOW', 'Gameshow – Âm nhạc'],
  ['THE_LOAI', 'KYSU', 'Ký sự – Phim tài liệu'],
  ['THE_LOAI', 'TINTUC', 'Tin tức – Chuyên đề'],
  ['THE_LOAI', 'PHIM', 'Phim truyện'],
  ['THE_LOAI', 'THETHAO', 'Thể thao'],
  ['THE_LOAI', 'GIAITRI', 'Giải trí – Tạp kỹ'],
  ['THE_LOAI', 'KHOAGIAO', 'Khoa giáo'],
  ['THE_LOAI', 'THIEUNHI', 'Thiếu nhi'],
  ['THE_LOAI', 'SANKHAU', 'Sân khấu – Cải lương'],
  ['THE_LOAI', 'TALKSHOW', 'Talkshow – Giao lưu'],

  ['VAI_TRO_DOI_TAC', 'DONG_SAN_XUAT', 'Đồng sản xuất'],
  ['VAI_TRO_DOI_TAC', 'TAI_TRO', 'Tài trợ'],
  ['VAI_TRO_DOI_TAC', 'CUNG_CAP_NOI_DUNG', 'Cung cấp nội dung'],
  ['VAI_TRO_DOI_TAC', 'DICH_VU', 'Dịch vụ kỹ thuật'],

  ['LOAI_HOP_DONG', 'HD_CHINH', 'Hợp đồng chính'],
  ['LOAI_HOP_DONG', 'PHU_LUC', 'Phụ lục hợp đồng'],
  ['LOAI_HOP_DONG', 'NGHIEM_THU', 'Biên bản nghiệm thu'],
  ['LOAI_HOP_DONG', 'THANH_LY', 'Biên bản thanh lý']
];

/* ------------------------------------------------------------------ */

function khoiTaoCoSoDuLieu() {
  const ss = getSpreadsheet_();
  const bienBan = [];

  bienBan.push(taoCacTab_(ss));
  bienBan.push(napCauHinh_());
  bienBan.push(napDanhMuc_());
  bienBan.push(napDonVi_());
  bienBan.push(napNguoiDung_());

  console.log('\n===== KHỞI TẠO XONG =====\n' + bienBan.join('\n'));
  return bienBan.join('\n');
}

function taoCacTab_(ss) {
  let taoMoi = 0, boQua = 0;
  THU_TU_TAB.forEach(function (tab) {
    if (ss.getSheetByName(tab)) { boQua++; return; }
    const sh = ss.insertSheet(tab);
    const cot = SCHEMA[tab];
    sh.getRange(1, 1, 1, cot.length).setValues([cot]);
    sh.getRange(1, 1, 1, cot.length)
      .setFontWeight('bold')
      .setBackground('#0d2748')
      .setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, Math.min(cot.length, 12));
    taoMoi++;
  });

  // Xoá tab mặc định còn trống (Sheet1 / Trang tính1)
  ss.getSheets().forEach(function (sh) {
    if (THU_TU_TAB.indexOf(sh.getName()) < 0 && sh.getLastRow() === 0 && ss.getSheets().length > 1) {
      ss.deleteSheet(sh);
    }
  });

  return 'Tab: tạo mới ' + taoMoi + ', đã có sẵn ' + boQua + '.';
}

function napCauHinh_() {
  const daCo = {};
  docAllRows_('CAU_HINH', true).forEach(function (r) { daCo[r.khoa] = true; });
  const them = CAU_HINH_MAC_DINH
    .filter(function (r) { return !daCo[r[0]]; })
    .map(function (r) {
      return {
        khoa: r[0], gia_tri: r[1], mo_ta: r[2],
        ngay_cap_nhat: nowIso_(), nguoi_cap_nhat: 'SETUP'
      };
    });
  if (them.length) themNhieu_('CAU_HINH', them);
  return 'Cấu hình: thêm ' + them.length + ' tham số.';
}

function napDanhMuc_() {
  const daCo = {};
  docAllRows_('DANH_MUC', true).forEach(function (r) { daCo[r.loai_danh_muc + '|' + r.ma] = true; });
  const them = [];
  DANH_MUC_BAN_DAU.forEach(function (r, i) {
    if (daCo[r[0] + '|' + r[1]]) return;
    them.push({ id: uuid_(), loai_danh_muc: r[0], ma: r[1], ten: r[2], thu_tu: i + 1, dang_dung: true });
  });
  if (them.length) themNhieu_('DANH_MUC', them);
  return 'Danh mục: thêm ' + them.length + ' mục.';
}

function napDonVi_() {
  const daCo = {};
  docAllRows_('DON_VI', true).forEach(function (r) { daCo[r.ten] = true; });
  const them = [];

  DON_VI_NOI_BO.forEach(function (ten) {
    if (daCo[ten]) return;
    them.push({
      don_vi_id: 'DV_' + khongDau_(ten).slice(0, 24),
      ten: ten, loai: 'NOI_BO', ma_so_thue: '', dia_chi: '',
      nguoi_lien_he: '', email: EMAIL_TEST, dien_thoai: '',
      trang_thai: 'HOAT_DONG',
      ngay_tao: nowIso_(), ngay_cap_nhat: nowIso_(), nguoi_cap_nhat: 'SETUP'
    });
  });

  DOI_TAC_BAN_DAU.forEach(function (dt) {
    if (daCo[dt.ten]) return;
    them.push({
      don_vi_id: 'DT_' + khongDau_(dt.ten).slice(0, 24),
      ten: dt.ten, loai: 'DOI_TAC', ma_so_thue: '', dia_chi: '',
      nguoi_lien_he: '', email: EMAIL_TEST, dien_thoai: '',
      trang_thai: 'HOAT_DONG',
      ngay_tao: nowIso_(), ngay_cap_nhat: nowIso_(), nguoi_cap_nhat: 'SETUP'
    });
  });

  if (them.length) themNhieu_('DON_VI', them);
  return 'Đơn vị: thêm ' + them.length + ' (' + DON_VI_NOI_BO.length + ' nội bộ, '
    + DOI_TAC_BAN_DAU.length + ' đối tác).';
}

function napNguoiDung_() {
  const daCo = {};
  docAllRows_('NGUOI_DUNG', true).forEach(function (r) { daCo[r.username] = true; });

  const donVi = docAllRows_('DON_VI', true);
  const timDonVi = function (ten) {
    for (let i = 0; i < donVi.length; i++) if (donVi[i].ten === ten) return donVi[i].don_vi_id;
    return '';
  };

  // Mật khẩu khởi tạo lấy từ Script Property nếu có, không thì sinh ngẫu nhiên
  // và in ra Execution log. Không có mật khẩu nào nằm trong mã nguồn.
  const mkAdmin = PROP.getProperty('ADMIN_MK_KHOI_TAO') || ('Htv' + randomToken_(5));
  const mkDonVi = PROP.getProperty('DON_VI_MK_KHOI_TAO') || ('Dv' + randomToken_(5));
  const mkDoiTac = PROP.getProperty('DOI_TAC_MK_KHOI_TAO') || ('Dt' + randomToken_(5));

  const them = [];
  const taoUser = function (username, hoTen, nhom, donViId, matKhau) {
    if (daCo[username]) return;
    const mk = taoMatKhau_(matKhau);
    them.push({
      user_id: 'U_' + username, username: username, ho_ten: hoTen,
      email: EMAIL_TEST, dien_thoai: '', nhom: nhom, don_vi_id: donViId,
      mat_khau_hash: mk.hash, salt: mk.salt,
      buoc_doi_mk: true, bat_2fa: true, trang_thai: 'HOAT_DONG',
      lan_dang_nhap_cuoi: '', so_lan_sai: 0, khoa_den: '',
      ngay_tao: nowIso_(), ngay_cap_nhat: nowIso_(), nguoi_cap_nhat: 'SETUP'
    });
  };

  taoUser('admin', 'Quản trị viên Hệ thống', 'ADMIN', '', mkAdmin);

  DON_VI_NOI_BO.forEach(function (ten) {
    const nhom = (ten === 'Ban Kế hoạch - Tài chính') ? 'KHTC' : 'DON_VI';
    taoUser(khongDau_(ten).slice(0, 24), ten, nhom, timDonVi(ten), mkDonVi);
  });

  DOI_TAC_BAN_DAU.forEach(function (dt) {
    taoUser(khongDau_(dt.ten).slice(0, 24), dt.ten, 'DOI_TAC', timDonVi(dt.ten), mkDoiTac);
  });

  if (them.length) themNhieu_('NGUOI_DUNG', them);

  console.log(
    '\n----- MẬT KHẨU KHỞI TẠO (chép lại ngay, chỉ hiện một lần) -----\n' +
    'admin             : ' + mkAdmin + '\n' +
    'Tài khoản đơn vị  : ' + mkDonVi + '\n' +
    'Tài khoản đối tác : ' + mkDoiTac + '\n' +
    'Tất cả đều buộc đổi mật khẩu ở lần đăng nhập đầu tiên.\n' +
    '---------------------------------------------------------------'
  );

  return 'Người dùng: thêm ' + them.length + ' tài khoản. Mật khẩu in ở cuối Execution log.';
}

/**
 * Tạo thư mục gốc trên My Drive nếu chưa có, rồi ghi ID vào CAU_HINH.
 * Admin vẫn đổi lại được bằng Google Picker ở màn hình cấu hình.
 */
function taoThuMucGoc() {
  const ten = getCauHinh('DRIVE_ROOT_FOLDER_TEN', 'HTV_KHTC_HoSo');
  const tim = DriveApp.getFoldersByName(ten);
  const folder = tim.hasNext() ? tim.next() : DriveApp.createFolder(ten);
  capNhat_('CAU_HINH', 'DRIVE_ROOT_FOLDER_ID', {
    gia_tri: folder.getId(), ngay_cap_nhat: nowIso_(), nguoi_cap_nhat: 'SETUP'
  });
  CacheService.getScriptCache().remove('cfg_DRIVE_ROOT_FOLDER_ID');
  const tb = 'Thư mục gốc: ' + folder.getName() + ' — ID ' + folder.getId();
  console.log(tb);
  return tb;
}

/** In khoá dùng chung để dán sang biến môi trường của Vercel. */
function xemAppKey() {
  let k = PROP.getProperty('APP_KEY');
  if (!k) {
    k = randomToken_(32);
    PROP.setProperty('APP_KEY', k);
    console.log('Đã sinh APP_KEY mới.');
  }
  console.log('APP_KEY = ' + k + '\nDán giá trị này vào biến GAS_APP_KEY trên Vercel và trong .env.local.');
  return k;
}
