/**
 * Auth.gs — Đăng nhập, OTP, phiên làm việc, thiết bị tin cậy.
 *
 * Luồng đăng nhập:
 *   1. dangNhap        kiểm mật khẩu. Thiết bị đã tin cậy thì vào thẳng,
 *                      chưa tin cậy thì gửi OTP và trả về một phiên tạm.
 *   2. xacThucOtp      kiểm mã, tạo phiên thật, có thể ghi nhớ thiết bị 30 ngày.
 *   3. doiMatKhau      bắt buộc ở lần đăng nhập đầu tiên.
 *
 * Trong bảng PHIEN, cột trang_thai phân biệt ba loại bản ghi:
 *   CHO_OTP    phiên tạm giữa bước 1 và bước 2, sống 10 phút
 *   HOAT_DONG  phiên đăng nhập thật
 *   TIN_CAY    dấu thiết bị đã được ghi nhớ
 */

const PHIEN_TAM_PHUT = 10;

/* ---------- Bước 1: kiểm mật khẩu ---------- */

function dangNhap_(payload, ctx) {
  const username = String(payload.username || '').trim().toLowerCase();
  const matKhau = String(payload.mat_khau || '');

  if (!username || !matKhau) {
    throw new Error('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
  }

  const user = timMot_('NGUOI_DUNG', 'username', username);

  // Trả cùng một thông báo dù sai tên hay sai mật khẩu, để không lộ tài khoản nào có thật.
  const thongBaoSai = 'Tên đăng nhập hoặc mật khẩu không đúng.';

  if (!user) {
    ghiNhatKy_(ctx, 'DANG_NHAP', 'NGUOI_DUNG', username, 'Tài khoản không tồn tại', 'THAT_BAI');
    throw new Error(thongBaoSai);
  }

  if (user.trang_thai !== 'HOAT_DONG') {
    ghiNhatKy_(ctx, 'DANG_NHAP', 'NGUOI_DUNG', user.user_id, 'Tài khoản đã bị khoá', 'THAT_BAI');
    throw new Error('Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên.');
  }

  if (user.khoa_den && new Date(user.khoa_den) > new Date()) {
    const con = Math.ceil((new Date(user.khoa_den) - new Date()) / 60000);
    throw new Error('Tài khoản tạm khoá do nhập sai nhiều lần. Thử lại sau ' + con + ' phút.');
  }

  if (!kiemTraMatKhau_(matKhau, user.salt, user.mat_khau_hash)) {
    const soLan = Number(user.so_lan_sai || 0) + 1;
    const toiDa = Number(getCauHinh('SO_LAN_SAI_TOI_DA', '5'));
    const patch = { so_lan_sai: soLan, ngay_cap_nhat: nowIso_() };

    if (soLan >= toiDa) {
      patch.khoa_den = congPhut_(Number(getCauHinh('KHOA_PHUT', '15')));
      patch.so_lan_sai = 0;
    }
    capNhat_('NGUOI_DUNG', user.user_id, patch);
    ghiNhatKy_(ctx, 'DANG_NHAP', 'NGUOI_DUNG', user.user_id,
      'Sai mật khẩu lần ' + soLan, 'THAT_BAI');

    if (patch.khoa_den) {
      throw new Error('Sai mật khẩu quá ' + toiDa + ' lần. Tài khoản tạm khoá '
        + getCauHinh('KHOA_PHUT', '15') + ' phút.');
    }
    throw new Error(thongBaoSai + ' Còn ' + (toiDa - soLan) + ' lần thử.');
  }

  if (Number(user.so_lan_sai || 0) > 0) {
    capNhat_('NGUOI_DUNG', user.user_id, { so_lan_sai: 0, khoa_den: '' });
  }

  // Thiết bị đã ghi nhớ thì bỏ qua OTP.
  if (payload.thiet_bi && thietBiTinCay_(user.user_id, payload.thiet_bi)) {
    const phien = taoPhien_(user, ctx);
    ghiNhatKy_(ctx, 'DANG_NHAP', 'NGUOI_DUNG', user.user_id,
      'Đăng nhập bằng thiết bị tin cậy', 'THANH_CONG');
    return { xong: true, token: phien.token, nguoi_dung: goiNguoiDung_(user) };
  }

  if (user.bat_2fa === false || String(user.bat_2fa).toUpperCase() === 'FALSE') {
    const phien = taoPhien_(user, ctx);
    ghiNhatKy_(ctx, 'DANG_NHAP', 'NGUOI_DUNG', user.user_id, 'Đăng nhập (2FA tắt)', 'THANH_CONG');
    return { xong: true, token: phien.token, nguoi_dung: goiNguoiDung_(user) };
  }

  // Chưa tin cậy: tạo phiên tạm rồi gửi OTP.
  const tam = taoPhienTam_(user, ctx);
  const ketQua = guiOtpChoUser_(user, ctx);

  return {
    xong: false,
    can_otp: true,
    phien_tam: tam.token,
    email_che: cheEmail_(user.email),
    het_han: ketQua.het_han,
    canh_bao_quota: ketQua.canh_bao_quota
  };
}

/* ---------- Bước 2: xác thực OTP ---------- */

function xacThucOtp_(payload, ctx) {
  const tam = layPhienTam_(payload.phien_tam);
  const user = timMot_('NGUOI_DUNG', 'user_id', tam.user_id);
  if (!user) throw new Error('Không tìm thấy tài khoản.');

  const ma = String(payload.ma || '').replace(/\D/g, '');
  if (ma.length !== 6) throw new Error('Mã xác thực gồm 6 chữ số.');

  const otp = otpMoiNhat_('DANG_NHAP', user.user_id);
  if (!otp) throw new Error('Mã đã hết hạn. Vui lòng bấm gửi lại mã.');
  if (otp.da_dung === true || String(otp.da_dung).toUpperCase() === 'TRUE') {
    throw new Error('Mã này đã được dùng. Vui lòng bấm gửi lại mã.');
  }
  if (new Date(otp.het_han) < new Date()) {
    throw new Error('Mã đã hết hạn. Vui lòng bấm gửi lại mã.');
  }

  const toiDa = Number(getCauHinh('SO_LAN_SAI_TOI_DA', '5'));
  const soLan = Number(otp.so_lan_thu || 0) + 1;

  if (!kiemTraMatKhau_(ma, otp.salt, otp.ma_hash)) {
    capNhat_('OTP', otp.otp_id, { so_lan_thu: soLan });
    ghiNhatKy_(ctx, 'XAC_THUC_OTP', 'NGUOI_DUNG', user.user_id,
      'Sai mã lần ' + soLan, 'THAT_BAI');
    if (soLan >= toiDa) {
      capNhat_('OTP', otp.otp_id, { da_dung: true });
      throw new Error('Nhập sai quá ' + toiDa + ' lần. Vui lòng bấm gửi lại mã.');
    }
    throw new Error('Mã xác thực không đúng. Còn ' + (toiDa - soLan) + ' lần thử.');
  }

  capNhat_('OTP', otp.otp_id, { da_dung: true, so_lan_thu: soLan });
  capNhat_('PHIEN', tam.phien_id, { trang_thai: 'DA_DUNG' });

  const phien = taoPhien_(user, ctx);

  let thietBi = null;
  if (payload.ghi_nho) {
    thietBi = ghiNhoThietBi_(user, ctx);
  }

  capNhat_('NGUOI_DUNG', user.user_id, { lan_dang_nhap_cuoi: nowIso_() });
  ghiNhatKy_(ctx, 'DANG_NHAP', 'NGUOI_DUNG', user.user_id,
    'Đăng nhập thành công' + (thietBi ? ' và ghi nhớ thiết bị' : ''), 'THANH_CONG');

  return {
    token: phien.token,
    thiet_bi: thietBi,
    nguoi_dung: goiNguoiDung_(user)
  };
}

/** Gửi lại mã cho phiên tạm đang chờ. */
function guiLaiOtp_(payload, ctx) {
  const tam = layPhienTam_(payload.phien_tam);
  const user = timMot_('NGUOI_DUNG', 'user_id', tam.user_id);
  if (!user) throw new Error('Không tìm thấy tài khoản.');

  const truoc = otpMoiNhat_('DANG_NHAP', user.user_id);
  if (truoc && (new Date() - new Date(truoc.tao_luc)) < 60000) {
    throw new Error('Vui lòng đợi một phút trước khi gửi lại mã.');
  }

  const kq = guiOtpChoUser_(user, ctx);
  return { email_che: cheEmail_(user.email), het_han: kq.het_han, canh_bao_quota: kq.canh_bao_quota };
}

/* ---------- Sinh và gửi OTP ---------- */

function guiOtpChoUser_(user, ctx) {
  if (!user.email) {
    throw new Error('Tài khoản chưa có địa chỉ email nhận mã. Vui lòng liên hệ quản trị viên.');
  }

  const conLai = MailApp.getRemainingDailyQuota();
  if (conLai <= 0) {
    throw new Error('Hệ thống đã hết lượt gửi email trong ngày. '
      + 'Vui lòng liên hệ quản trị viên để được cấp mã thủ công.');
  }

  const ma = String(Math.floor(100000 + Math.random() * 900000));
  const bam = taoMatKhau_(ma);
  const phut = Number(getCauHinh('OTP_TTL_PHUT', '5'));
  const hetHan = congPhut_(phut);

  them_('OTP', {
    otp_id: uuid_(),
    loai: 'DANG_NHAP',
    doi_tuong_id: user.user_id,
    email: user.email,
    ma_hash: bam.hash,
    salt: bam.salt,
    tao_luc: nowIso_(),
    het_han: hetHan,
    so_lan_thu: 0,
    da_dung: false,
    ip: (ctx && ctx.ip) || ''
  });

  guiMailOtp_(user, ma, phut);

  const nguong = Number(getCauHinh('QUOTA_MAIL_CANH_BAO', '20'));
  return {
    het_han: hetHan,
    canh_bao_quota: (conLai - 1) <= nguong ? (conLai - 1) : null
  };
}

function otpMoiNhat_(loai, doiTuongId) {
  const ds = loc_('OTP', function (o) {
    return o.loai === loai && String(o.doi_tuong_id) === String(doiTuongId);
  });
  if (!ds.length) return null;
  ds.sort(function (a, b) { return new Date(b.tao_luc) - new Date(a.tao_luc); });
  return ds[0];
}

/* ---------- Phiên ---------- */

function taoPhien_(user, ctx) {
  const token = randomToken_(32);
  const gio = Number(getCauHinh('PHIEN_TTL_GIO', '12'));
  them_('PHIEN', {
    phien_id: uuid_(),
    user_id: user.user_id,
    token_hash: sha256Hex_(token),
    tao_luc: nowIso_(),
    het_han: congPhut_(gio * 60),
    dau_van_tay_thiet_bi: '',
    tin_cay_den: '',
    ip: (ctx && ctx.ip) || '',
    trang_thai: 'HOAT_DONG'
  });
  return { token: token };
}

function taoPhienTam_(user, ctx) {
  const token = randomToken_(24);
  const phienId = uuid_();
  them_('PHIEN', {
    phien_id: phienId,
    user_id: user.user_id,
    token_hash: sha256Hex_(token),
    tao_luc: nowIso_(),
    het_han: congPhut_(PHIEN_TAM_PHUT),
    dau_van_tay_thiet_bi: '',
    tin_cay_den: '',
    ip: (ctx && ctx.ip) || '',
    trang_thai: 'CHO_OTP'
  });
  return { token: token, phien_id: phienId };
}

function layPhienTam_(token) {
  if (!token) throw new Error('Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.');
  const p = timMot_('PHIEN', 'token_hash', sha256Hex_(String(token)));
  if (!p || p.trang_thai !== 'CHO_OTP' || new Date(p.het_han) < new Date()) {
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }
  return p;
}

function dangXuat_(payload, ctx) {
  if (ctx.session) {
    const p = timMot_('PHIEN', 'token_hash', sha256Hex_(String(ctx.session)));
    if (p) capNhat_('PHIEN', p.phien_id, { trang_thai: 'DA_THOAT' });
  }
  ghiNhatKy_(ctx, 'DANG_XUAT', 'NGUOI_DUNG', ctx.user_id, 'Đăng xuất', 'THANH_CONG');
  return { da_thoat: true };
}

/* ---------- Thiết bị tin cậy ---------- */

function ghiNhoThietBi_(user, ctx) {
  const token = randomToken_(32);
  const ngay = Number(getCauHinh('TIN_CAY_THIET_BI_NGAY', '30'));
  them_('PHIEN', {
    phien_id: uuid_(),
    user_id: user.user_id,
    token_hash: sha256Hex_(token),
    tao_luc: nowIso_(),
    het_han: congPhut_(ngay * 24 * 60),
    dau_van_tay_thiet_bi: (ctx && ctx.user_agent ? ctx.user_agent.slice(0, 120) : ''),
    tin_cay_den: congPhut_(ngay * 24 * 60),
    ip: (ctx && ctx.ip) || '',
    trang_thai: 'TIN_CAY'
  });
  return token;
}

function thietBiTinCay_(userId, token) {
  const p = timMot_('PHIEN', 'token_hash', sha256Hex_(String(token)));
  return !!(p && p.trang_thai === 'TIN_CAY'
    && String(p.user_id) === String(userId)
    && new Date(p.tin_cay_den) > new Date());
}

function quenThietBi_(payload, ctx) {
  const ds = loc_('PHIEN', function (p) {
    return p.trang_thai === 'TIN_CAY' && String(p.user_id) === String(ctx.user_id);
  });
  ds.forEach(function (p) { capNhat_('PHIEN', p.phien_id, { trang_thai: 'DA_HUY' }); });
  ghiNhatKy_(ctx, 'QUEN_THIET_BI', 'PHIEN', ctx.user_id,
    'Huỷ ghi nhớ ' + ds.length + ' thiết bị', 'THANH_CONG');
  return { da_huy: ds.length };
}

/* ---------- Đổi mật khẩu ---------- */

function doiMatKhau_(payload, ctx) {
  const user = ctx.user;
  const cu = String(payload.mat_khau_cu || '');
  const moi = String(payload.mat_khau_moi || '');

  if (!kiemTraMatKhau_(cu, user.salt, user.mat_khau_hash)) {
    ghiNhatKy_(ctx, 'DOI_MAT_KHAU', 'NGUOI_DUNG', user.user_id, 'Sai mật khẩu cũ', 'THAT_BAI');
    throw new Error('Mật khẩu hiện tại không đúng.');
  }
  kiemTraDoManh_(moi);
  if (kiemTraMatKhau_(moi, user.salt, user.mat_khau_hash)) {
    throw new Error('Mật khẩu mới phải khác mật khẩu hiện tại.');
  }

  const bam = taoMatKhau_(moi);
  capNhat_('NGUOI_DUNG', user.user_id, {
    mat_khau_hash: bam.hash, salt: bam.salt, buoc_doi_mk: false,
    ngay_cap_nhat: nowIso_(), nguoi_cap_nhat: user.user_id
  });
  ghiNhatKy_(ctx, 'DOI_MAT_KHAU', 'NGUOI_DUNG', user.user_id, 'Đổi mật khẩu', 'THANH_CONG');
  return { da_doi: true };
}

function kiemTraDoManh_(mk) {
  if (mk.length < 8) throw new Error('Mật khẩu phải có ít nhất 8 ký tự.');
  if (!/[a-z]/.test(mk) || !/[A-Z]/.test(mk)) {
    throw new Error('Mật khẩu phải có cả chữ thường và chữ hoa.');
  }
  if (!/[0-9]/.test(mk)) throw new Error('Mật khẩu phải có ít nhất một chữ số.');
  const de = ['12345678', 'password', 'matkhau', 'qwerty', '11111111', 'htv12345'];
  if (de.indexOf(mk.toLowerCase()) >= 0) throw new Error('Mật khẩu này quá dễ đoán.');
}

/* ---------- Hồ sơ người đang đăng nhập ---------- */

/** Chỉ trả ra những trường an toàn — không bao giờ có hash hay salt. */
function goiNguoiDung_(user) {
  const donVi = user.don_vi_id ? timMot_('DON_VI', 'don_vi_id', user.don_vi_id) : null;
  return {
    user_id: user.user_id,
    username: user.username,
    ho_ten: user.ho_ten,
    email: user.email,
    nhom: user.nhom,
    ten_nhom: tenNhom_(user.nhom),
    don_vi_id: user.don_vi_id,
    ten_don_vi: donVi ? donVi.ten : '',
    buoc_doi_mk: user.buoc_doi_mk === true || String(user.buoc_doi_mk).toUpperCase() === 'TRUE',
    quyen: quyenCua_(user.nhom)
  };
}

function layToi_(payload, ctx) {
  return goiNguoiDung_(ctx.user);
}

/** Dọn phiên và mã OTP đã hết hạn. Nên đặt trigger chạy mỗi đêm. */
function donDepPhienHetHan() {
  const bayGio = new Date();
  let dem = 0;

  loc_('PHIEN', function (p) {
    return p.trang_thai !== 'DA_HUY' && new Date(p.het_han) < bayGio;
  }).forEach(function (p) {
    capNhat_('PHIEN', p.phien_id, { trang_thai: 'DA_HUY' });
    dem++;
  });

  loc_('OTP', function (o) {
    return !(o.da_dung === true || String(o.da_dung).toUpperCase() === 'TRUE')
      && new Date(o.het_han) < bayGio;
  }).forEach(function (o) {
    capNhat_('OTP', o.otp_id, { da_dung: true });
    dem++;
  });

  console.log('Đã dọn ' + dem + ' bản ghi hết hạn.');
  return dem;
}
