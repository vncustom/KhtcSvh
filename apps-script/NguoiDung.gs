/**
 * NguoiDung.gs — Quản lý tài khoản và đơn vị. Chỉ quản trị viên dùng được.
 */

function danhSachNguoiDung_(payload, ctx) {
  doiHoiQuyen_(ctx, 'nguoi_dung.xem');
  const donVi = {};
  docAllRows_('DON_VI').forEach(function (d) { donVi[d.don_vi_id] = d.ten; });

  return docAllRows_('NGUOI_DUNG')
    .filter(function (u) { return u.trang_thai !== 'XOA'; })
    .map(function (u) {
      // Không bao giờ trả mat_khau_hash hay salt ra khỏi máy chủ.
      return {
        user_id: u.user_id,
        username: u.username,
        ho_ten: u.ho_ten,
        email: u.email,
        dien_thoai: u.dien_thoai,
        nhom: u.nhom,
        ten_nhom: tenNhom_(u.nhom),
        don_vi_id: u.don_vi_id,
        ten_don_vi: donVi[u.don_vi_id] || '',
        trang_thai: u.trang_thai,
        bat_2fa: u.bat_2fa === true || String(u.bat_2fa).toUpperCase() === 'TRUE',
        buoc_doi_mk: u.buoc_doi_mk === true || String(u.buoc_doi_mk).toUpperCase() === 'TRUE',
        lan_dang_nhap_cuoi: u.lan_dang_nhap_cuoi,
        dang_khoa: !!(u.khoa_den && new Date(u.khoa_den) > new Date())
      };
    });
}

function luuNguoiDung_(payload, ctx) {
  doiHoiQuyen_(ctx, 'nguoi_dung.sua');

  const ten = String(payload.ho_ten || '').trim();
  const email = String(payload.email || '').trim();
  if (!ten) throw new Error('Vui lòng nhập họ tên.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Địa chỉ email không hợp lệ.');
  if (!BANG_QUYEN[payload.nhom]) throw new Error('Nhóm quyền không hợp lệ.');

  /* --- Sửa tài khoản đã có --- */
  if (payload.user_id) {
    const cu = timMot_('NGUOI_DUNG', 'user_id', payload.user_id);
    if (!cu) throw new Error('Không tìm thấy tài khoản.');

    if (cu.username === 'admin' && payload.nhom !== 'ADMIN') {
      throw new Error('Không thể hạ quyền tài khoản admin gốc.');
    }

    const patch = {
      ho_ten: ten, email: email,
      dien_thoai: String(payload.dien_thoai || ''),
      nhom: payload.nhom,
      don_vi_id: String(payload.don_vi_id || ''),
      bat_2fa: payload.bat_2fa !== false,
      ngay_cap_nhat: nowIso_(), nguoi_cap_nhat: ctx.user_id
    };
    capNhat_('NGUOI_DUNG', cu.user_id, patch);
    ghiNhatKy_(ctx, 'SUA_NGUOI_DUNG', 'NGUOI_DUNG', cu.user_id, 'Cập nhật ' + cu.username,
      'THANH_CONG', { ho_ten: cu.ho_ten, email: cu.email, nhom: cu.nhom }, patch);
    return { user_id: cu.user_id, da_luu: true };
  }

  /* --- Tạo tài khoản mới --- */
  const username = khongDau_(payload.username || ten).slice(0, 24);
  if (!username) throw new Error('Không tạo được tên đăng nhập từ họ tên.');
  if (timMot_('NGUOI_DUNG', 'username', username)) {
    throw new Error('Tên đăng nhập "' + username + '" đã tồn tại.');
  }

  const matKhau = sinhMatKhauTam_();
  const bam = taoMatKhau_(matKhau);
  const userId = 'U_' + username;

  them_('NGUOI_DUNG', {
    user_id: userId, username: username, ho_ten: ten, email: email,
    dien_thoai: String(payload.dien_thoai || ''),
    nhom: payload.nhom, don_vi_id: String(payload.don_vi_id || ''),
    mat_khau_hash: bam.hash, salt: bam.salt,
    buoc_doi_mk: true, bat_2fa: payload.bat_2fa !== false,
    trang_thai: 'HOAT_DONG', lan_dang_nhap_cuoi: '', so_lan_sai: 0, khoa_den: '',
    ngay_tao: nowIso_(), ngay_cap_nhat: nowIso_(), nguoi_cap_nhat: ctx.user_id
  });

  ghiNhatKy_(ctx, 'THEM_NGUOI_DUNG', 'NGUOI_DUNG', userId,
    'Tạo tài khoản ' + username + ' (' + payload.nhom + ')', 'THANH_CONG');

  // Trả mật khẩu tạm về đúng một lần để admin bàn giao; không lưu ở đâu dạng chữ thường.
  const daGui = thuGuiMatKhau_({ email: email, username: username, ho_ten: ten }, matKhau);
  return { user_id: userId, username: username, mat_khau_tam: matKhau, da_gui_mail: daGui };
}

function datLaiMatKhau_(payload, ctx) {
  doiHoiQuyen_(ctx, 'nguoi_dung.sua');
  const u = timMot_('NGUOI_DUNG', 'user_id', payload.user_id);
  if (!u) throw new Error('Không tìm thấy tài khoản.');

  const matKhau = sinhMatKhauTam_();
  const bam = taoMatKhau_(matKhau);
  capNhat_('NGUOI_DUNG', u.user_id, {
    mat_khau_hash: bam.hash, salt: bam.salt, buoc_doi_mk: true,
    so_lan_sai: 0, khoa_den: '',
    ngay_cap_nhat: nowIso_(), nguoi_cap_nhat: ctx.user_id
  });

  ghiNhatKy_(ctx, 'DAT_LAI_MAT_KHAU', 'NGUOI_DUNG', u.user_id,
    'Đặt lại mật khẩu cho ' + u.username, 'THANH_CONG');

  const daGui = thuGuiMatKhau_(u, matKhau);
  return { mat_khau_tam: matKhau, da_gui_mail: daGui };
}

/**
 * Gửi mật khẩu tạm qua email nếu còn hạn mức. Hết hạn mức thì không phải lỗi —
 * admin vẫn nhận được mật khẩu trên màn hình để bàn giao trực tiếp.
 */
function thuGuiMatKhau_(user, matKhau) {
  try {
    if (MailApp.getRemainingDailyQuota() <= 0) return false;
    guiMailMatKhauMoi_(user, matKhau);
    return true;
  } catch (e) {
    console.error('Không gửi được mail mật khẩu: ' + e.message);
    return false;
  }
}

function doiTrangThaiNguoiDung_(payload, ctx) {
  doiHoiQuyen_(ctx, 'nguoi_dung.sua');
  const u = timMot_('NGUOI_DUNG', 'user_id', payload.user_id);
  if (!u) throw new Error('Không tìm thấy tài khoản.');
  if (u.username === 'admin') throw new Error('Không thể khoá tài khoản admin gốc.');
  if (u.user_id === ctx.user_id) throw new Error('Không thể tự khoá tài khoản của chính mình.');

  const moi = u.trang_thai === 'HOAT_DONG' ? 'KHOA' : 'HOAT_DONG';
  capNhat_('NGUOI_DUNG', u.user_id, {
    trang_thai: moi, so_lan_sai: 0, khoa_den: '',
    ngay_cap_nhat: nowIso_(), nguoi_cap_nhat: ctx.user_id
  });

  // Khoá tài khoản thì cắt luôn mọi phiên đang mở.
  if (moi === 'KHOA') {
    loc_('PHIEN', function (p) {
      return String(p.user_id) === String(u.user_id) && p.trang_thai === 'HOAT_DONG';
    }).forEach(function (p) { capNhat_('PHIEN', p.phien_id, { trang_thai: 'DA_HUY' }); });
  }

  ghiNhatKy_(ctx, 'DOI_TRANG_THAI', 'NGUOI_DUNG', u.user_id,
    u.username + ': ' + u.trang_thai + ' ➜ ' + moi, 'THANH_CONG');
  return { trang_thai: moi };
}

function moKhoaNguoiDung_(payload, ctx) {
  doiHoiQuyen_(ctx, 'nguoi_dung.sua');
  const u = timMot_('NGUOI_DUNG', 'user_id', payload.user_id);
  if (!u) throw new Error('Không tìm thấy tài khoản.');
  capNhat_('NGUOI_DUNG', u.user_id, { so_lan_sai: 0, khoa_den: '', ngay_cap_nhat: nowIso_() });
  ghiNhatKy_(ctx, 'MO_KHOA', 'NGUOI_DUNG', u.user_id, 'Gỡ khoá tạm ' + u.username, 'THANH_CONG');
  return { da_mo: true };
}

function sinhMatKhauTam_() {
  const hoa = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const thuong = 'abcdefghijkmnpqrstuvwxyz';
  const so = '23456789';
  const lay = function (nguon, n) {
    let r = '';
    for (let i = 0; i < n; i++) r += nguon[Math.floor(Math.random() * nguon.length)];
    return r;
  };
  return lay(hoa, 2) + lay(thuong, 5) + lay(so, 3);
}

/* ---------- Đơn vị ---------- */

function danhSachDonViDayDu_(payload, ctx) {
  doiHoiQuyen_(ctx, 'don_vi.xem');
  return docAllRows_('DON_VI')
    .filter(function (d) { return d.trang_thai !== 'XOA'; })
    .map(function (d) {
      return {
        don_vi_id: d.don_vi_id, ten: d.ten, loai: d.loai,
        ma_so_thue: d.ma_so_thue, dia_chi: d.dia_chi,
        nguoi_lien_he: d.nguoi_lien_he, email: d.email, dien_thoai: d.dien_thoai,
        trang_thai: d.trang_thai
      };
    });
}

function luuDonVi_(payload, ctx) {
  doiHoiQuyen_(ctx, 'don_vi.sua');
  const ten = String(payload.ten || '').trim();
  if (!ten) throw new Error('Vui lòng nhập tên đơn vị.');
  if (['NOI_BO', 'DOI_TAC'].indexOf(payload.loai) < 0) {
    throw new Error('Loại đơn vị phải là nội bộ hoặc đối tác.');
  }

  const truong = {
    ten: ten, loai: payload.loai,
    ma_so_thue: String(payload.ma_so_thue || ''),
    dia_chi: String(payload.dia_chi || ''),
    nguoi_lien_he: String(payload.nguoi_lien_he || ''),
    email: String(payload.email || ''),
    dien_thoai: String(payload.dien_thoai || ''),
    ngay_cap_nhat: nowIso_(), nguoi_cap_nhat: ctx.user_id
  };

  if (payload.don_vi_id) {
    const cu = timMot_('DON_VI', 'don_vi_id', payload.don_vi_id);
    if (!cu) throw new Error('Không tìm thấy đơn vị.');
    capNhat_('DON_VI', cu.don_vi_id, truong);
    ghiNhatKy_(ctx, 'SUA_DON_VI', 'DON_VI', cu.don_vi_id, 'Cập nhật ' + ten, 'THANH_CONG');
    return { don_vi_id: cu.don_vi_id };
  }

  const tienTo = payload.loai === 'DOI_TAC' ? 'DT_' : 'DV_';
  let id = tienTo + khongDau_(ten).slice(0, 24);
  if (timMot_('DON_VI', 'don_vi_id', id)) id += '_' + randomToken_(2);

  truong.don_vi_id = id;
  truong.trang_thai = 'HOAT_DONG';
  truong.ngay_tao = nowIso_();
  them_('DON_VI', truong);

  ghiNhatKy_(ctx, 'THEM_DON_VI', 'DON_VI', id, 'Tạo đơn vị ' + ten, 'THANH_CONG');
  return { don_vi_id: id };
}
