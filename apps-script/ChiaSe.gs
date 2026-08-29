/**
 * ChiaSe.gs — Phiếu chia sẻ hồ sơ cho đối tác.
 *
 * Thay cho mã PIN tĩnh in sẵn của bản demo. Mỗi lần cấp quyền tạo một phiếu riêng:
 * token ngẫu nhiên 128 bit, hạn hiệu lực, giới hạn lượt xem, phạm vi tệp được xem,
 * và thu hồi được bất cứ lúc nào. Bảng trong Sheet chỉ giữ bản băm; bản gốc của
 * token và PIN cất riêng ở Script Properties để cán bộ mở lại phiếu khi cần in.
 *
 * Mã in trên giấy chỉ còn là định danh hồ sơ, không còn là chìa khoá:
 * chìa khoá là mã xác thực gửi tới đối tác hoặc mã PIN cấp riêng cho từng phiếu.
 */

const PHIEN_XEM_PHUT = 30;

/**
 * Token và mã PIN của phiếu được cất ở Script Properties chứ không ghi vào Sheet.
 *
 * Bảng PHIEU_CHIA_SE chỉ giữ bản băm, nên ai đọc được file Sheet cũng không suy ra
 * được đường dẫn. Nhưng cán bộ phụ trách vẫn cần mở lại phiếu để in hoặc gửi lại,
 * nên bản gốc được cất ở nơi chỉ Apps Script đọc được.
 */
function khoaBiMatPhieu_(shareId) {
  return 'CS_BM_' + shareId;
}

function luuBiMatPhieu_(shareId, token, pin) {
  try {
    PROP.setProperty(khoaBiMatPhieu_(shareId), JSON.stringify({ t: token, p: pin || '' }));
  } catch (e) {
    console.error('Không lưu được bí mật phiếu: ' + e.message);
  }
}

function docBiMatPhieu_(shareId) {
  const s = PROP.getProperty(khoaBiMatPhieu_(shareId));
  if (!s) return null;
  try {
    const o = JSON.parse(s);
    return { token: o.t, pin: o.p || '' };
  } catch (e) {
    return null;
  }
}

function xoaBiMatPhieu_(shareId) {
  try { PROP.deleteProperty(khoaBiMatPhieu_(shareId)); } catch (e) { /* không có thì thôi */ }
}

/* ================= Cấp phiếu ================= */

function capPhieuChiaSe_(payload, ctx) {
  doiHoiQuyen_(ctx, 'chia_se.cap');

  const h = layHoSo_(payload.ho_so_id);
  if (h.trang_thai !== 'DA_DUYET') {
    throw new Error('Chỉ cấp phiếu chia sẻ cho hồ sơ đã duyệt. '
      + 'Hồ sơ này đang ở trạng thái "' + (TRANG_THAI_HO_SO[h.trang_thai] || h.trang_thai) + '".');
  }

  const dv = timMot_('DON_VI', 'don_vi_id', String(payload.don_vi_id || ''));
  if (!dv) throw new Error('Vui lòng chọn đơn vị đối tác nhận phiếu.');

  const phuongThuc = String(payload.phuong_thuc || 'OTP').toUpperCase();
  if (['OTP', 'PIN'].indexOf(phuongThuc) < 0) {
    throw new Error('Phương thức xác thực phải là OTP hoặc PIN.');
  }

  const email = String(payload.email_nhan || dv.email || '').trim();
  if (phuongThuc === 'OTP' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error('Đối tác chưa có email hợp lệ để nhận mã xác thực. '
      + 'Hãy bổ sung email cho đơn vị, hoặc chọn phương thức PIN.');
  }

  const soNgay = Math.max(1, Math.min(365,
    Number(payload.so_ngay || getCauHinh('SHARE_TTL_NGAY', '90'))));

  const token = randomToken_(16);   // 128 bit
  const shareId = 'CS_' + randomToken_(8);

  // PIN sinh ngẫu nhiên cho riêng phiếu này và chỉ hiện đúng một lần.
  let pin = '';
  let pinBam = { hash: '', salt: '' };
  if (phuongThuc === 'PIN') {
    pin = String(Math.floor(100000 + Math.random() * 900000));
    pinBam = taoMatKhau_(pin);
  }

  const phamVi = Array.isArray(payload.pham_vi_tep) && payload.pham_vi_tep.length
    ? payload.pham_vi_tep.join(',')
    : 'CHO_DOI_TAC';

  them_('PHIEU_CHIA_SE', {
    share_id: shareId,
    ho_so_id: h.ho_so_id,
    don_vi_id: dv.don_vi_id,
    email_nhan: email,
    dien_thoai_nhan: String(payload.dien_thoai_nhan || dv.dien_thoai || ''),
    token_hash: sha256Hex_(token),
    phuong_thuc_xac_thuc: phuongThuc,
    pin_hash: pinBam.hash,
    pin_salt: pinBam.salt,
    ngay_cap: nowIso_(),
    het_han: congPhut_(soNgay * 24 * 60),
    so_luot_toi_da: Math.max(0, Number(payload.so_luot_toi_da || 0)),
    so_luot_da_dung: 0,
    so_lan_sai: 0,
    khoa_den: '',
    pham_vi_tep: phamVi,
    trang_thai: 'HOAT_DONG',
    nguoi_cap: ctx.user_id,
    ly_do_thu_hoi: '',
    ngay_thu_hoi: ''
  });

  luuBiMatPhieu_(shareId, token, pin);

  ghiNhatKy_(ctx, 'CAP_PHIEU_CHIA_SE', 'HO_SO', h.ho_so_id,
    'Cấp phiếu cho ' + dv.ten + ' (' + phuongThuc + '), hạn ' + soNgay + ' ngày', 'THANH_CONG');

  return {
    share_id: shareId,
    token: token,
    pin: pin,
    ten_don_vi: dv.ten,
    email_nhan: email,
    het_han: congPhut_(soNgay * 24 * 60),
    phuong_thuc: phuongThuc
  };
}

/* ================= Danh sách & thu hồi ================= */

function danhSachPhieu_(payload, ctx) {
  doiHoiQuyen_(ctx, 'chia_se.xem');
  const h = layHoSo_(payload.ho_so_id);
  kiemTraDuocXem_(h, ctx);

  const tenDonVi = {};
  docAllRows_('DON_VI').forEach(function (d) { tenDonVi[d.don_vi_id] = d.ten; });
  const tenNguoi = {};
  docAllRows_('NGUOI_DUNG').forEach(function (u) { tenNguoi[u.user_id] = u.ho_ten; });

  const luot = {};
  docAllRows_('LUOT_TRUY_CAP').forEach(function (l) {
    (luot[l.share_id] = luot[l.share_id] || []).push(l);
  });

  const bayGio = new Date();
  const ds = loc_('PHIEU_CHIA_SE', function (p) {
    return String(p.ho_so_id) === String(h.ho_so_id);
  });
  ds.sort(function (a, b) { return new Date(b.ngay_cap) - new Date(a.ngay_cap); });

  return {
    duoc_cap: co_(ctx, 'chia_se.cap') && h.trang_thai === 'DA_DUYET',
    duoc_thu_hoi: co_(ctx, 'chia_se.thu_hoi'),
    ho_so_da_duyet: h.trang_thai === 'DA_DUYET',
    phieu: ds.map(function (p) {
      const l = luot[p.share_id] || [];
      const thanhCong = l.filter(function (x) { return x.ket_qua === 'THANH_CONG'; });
      const hetHan = new Date(p.het_han) < bayGio;

      return {
        share_id: p.share_id,
        ten_don_vi: tenDonVi[p.don_vi_id] || '',
        email_nhan: cheEmail_(p.email_nhan),
        phuong_thuc: p.phuong_thuc_xac_thuc,
        ngay_cap: p.ngay_cap,
        het_han: p.het_han,
        het_han_roi: hetHan,
        so_luot_toi_da: Number(p.so_luot_toi_da || 0),
        so_luot_da_dung: Number(p.so_luot_da_dung || 0),
        pham_vi_tep: p.pham_vi_tep,
        trang_thai: p.trang_thai,
        con_hieu_luc: p.trang_thai === 'HOAT_DONG' && !hetHan,
        nguoi_cap: tenNguoi[p.nguoi_cap] || p.nguoi_cap || '',
        xem_lai_duoc: p.trang_thai === 'HOAT_DONG' && !hetHan && !!docBiMatPhieu_(p.share_id),
        ly_do_thu_hoi: p.ly_do_thu_hoi,
        lan_xem_cuoi: thanhCong.length
          ? thanhCong.map(function (x) { return x.thoi_gian; }).sort().pop()
          : '',
        so_lan_that_bai: l.length - thanhCong.length,
        luot: l.sort(function (a, b) { return new Date(b.thoi_gian) - new Date(a.thoi_gian); })
          .slice(0, 20)
          .map(function (x) {
            return { thoi_gian: x.thoi_gian, ip: x.ip, ket_qua: x.ket_qua, tep_da_mo: x.tep_da_mo };
          })
      };
    })
  };
}

/**
 * Mở lại một phiếu đã cấp để in hoặc gửi lại cho đối tác.
 * Chỉ người có quyền cấp phiếu mới xem lại được, và mỗi lần xem đều ghi nhật ký.
 */
function xemLaiPhieu_(payload, ctx) {
  doiHoiQuyen_(ctx, 'chia_se.cap');
  const p = layPhieu_(payload.share_id);

  const loi = kiemTraHieuLuc_(p);
  if (loi) throw new Error(loi);

  const bm = docBiMatPhieu_(p.share_id);
  if (!bm) {
    throw new Error('Không mở lại được phiếu này. Phiếu cấp trước khi hệ thống hỗ trợ '
      + 'xem lại, hoặc bí mật đã bị dọn. Hãy thu hồi rồi cấp phiếu mới.');
  }

  const dv = timMot_('DON_VI', 'don_vi_id', p.don_vi_id);
  ghiNhatKy_(ctx, 'XEM_LAI_PHIEU', 'HO_SO', p.ho_so_id,
    'Mở lại phiếu của ' + (dv ? dv.ten : p.don_vi_id), 'THANH_CONG');

  return {
    share_id: p.share_id,
    token: bm.token,
    pin: bm.pin,
    ten_don_vi: dv ? dv.ten : '',
    email_nhan: p.email_nhan,
    het_han: p.het_han,
    phuong_thuc: p.phuong_thuc_xac_thuc
  };
}

function thuHoiPhieu_(payload, ctx) {
  doiHoiQuyen_(ctx, 'chia_se.thu_hoi');
  const p = layPhieu_(payload.share_id);

  if (p.trang_thai !== 'HOAT_DONG') throw new Error('Phiếu này đã không còn hiệu lực.');

  capNhat_('PHIEU_CHIA_SE', p.share_id, {
    trang_thai: 'THU_HOI',
    ly_do_thu_hoi: String(payload.ly_do || ''),
    ngay_thu_hoi: nowIso_()
  });

  // Cắt luôn các phiên xem đang mở của phiếu này.
  loc_('PHIEN', function (x) {
    return x.trang_thai === 'XEM_PHIEU' && String(x.user_id) === 'CS:' + p.share_id;
  }).forEach(function (x) { capNhat_('PHIEN', x.phien_id, { trang_thai: 'DA_HUY' }); });

  xoaBiMatPhieu_(p.share_id);

  ghiNhatKy_(ctx, 'THU_HOI_PHIEU', 'HO_SO', p.ho_so_id,
    'Thu hồi phiếu ' + p.share_id + (payload.ly_do ? ' — ' + payload.ly_do : ''), 'THANH_CONG');
  return { da_thu_hoi: true };
}

/* ================= Phía đối tác — không cần đăng nhập ================= */

/** Thông tin tối thiểu để đối tác biết mình đang mở đúng hồ sơ nào. */
function xemPhieu_(payload, ctx) {
  const p = timTheoToken_(payload.token);
  if (!p) return { hop_le: false, ly_do: 'Đường dẫn không đúng hoặc đã bị thu hồi.' };

  const loi = kiemTraHieuLuc_(p);
  if (loi) return { hop_le: false, ly_do: loi };

  const h = timMot_('HO_SO', 'ho_so_id', p.ho_so_id);
  const dv = timMot_('DON_VI', 'don_vi_id', p.don_vi_id);

  return {
    hop_le: true,
    ho_so_id: p.ho_so_id,
    ten_chuong_trinh: h ? h.ten_chuong_trinh : '',
    don_vi_nhan: dv ? dv.ten : '',
    phuong_thuc: p.phuong_thuc_xac_thuc,
    email_che: cheEmail_(p.email_nhan),
    het_han: p.het_han
  };
}

function guiMaChiaSe_(payload, ctx) {
  const p = timTheoToken_(payload.token);
  if (!p) throw new Error('Đường dẫn không đúng hoặc đã bị thu hồi.');

  const loi = kiemTraHieuLuc_(p);
  if (loi) throw new Error(loi);

  if (p.phuong_thuc_xac_thuc !== 'OTP') {
    throw new Error('Phiếu này dùng mã PIN do cán bộ phụ trách cấp, không gửi mã qua email.');
  }

  const truoc = otpMoiNhat_('CHIA_SE', p.share_id);
  if (truoc && (new Date() - new Date(truoc.tao_luc)) < 60000) {
    throw new Error('Vui lòng đợi một phút trước khi gửi lại mã.');
  }

  if (MailApp.getRemainingDailyQuota() <= 0) {
    throw new Error('Hệ thống đã hết lượt gửi email trong ngày. '
      + 'Vui lòng liên hệ Ban Kế hoạch – Tài chính để được hỗ trợ.');
  }

  const h = timMot_('HO_SO', 'ho_so_id', p.ho_so_id);
  const ma = String(Math.floor(100000 + Math.random() * 900000));
  const bam = taoMatKhau_(ma);
  const phut = Number(getCauHinh('OTP_TTL_PHUT', '5'));

  them_('OTP', {
    otp_id: uuid_(), loai: 'CHIA_SE', doi_tuong_id: p.share_id,
    email: p.email_nhan, ma_hash: bam.hash, salt: bam.salt,
    tao_luc: nowIso_(), het_han: congPhut_(phut),
    so_lan_thu: 0, da_dung: false, ip: (ctx && ctx.ip) || ''
  });

  guiMailChiaSe_(p, h, ma, phut);
  return { da_gui: true, email_che: cheEmail_(p.email_nhan), het_han: congPhut_(phut) };
}

function xacThucPhieu_(payload, ctx) {
  const p = timTheoToken_(payload.token);
  if (!p) throw new Error('Đường dẫn không đúng hoặc đã bị thu hồi.');

  const loi = kiemTraHieuLuc_(p);
  if (loi) throw new Error(loi);

  const ma = String(payload.ma || '').replace(/\D/g, '');
  if (ma.length !== 6) throw new Error('Mã xác thực gồm 6 chữ số.');

  const toiDa = Number(getCauHinh('SO_LAN_SAI_TOI_DA', '5'));
  const dung = p.phuong_thuc_xac_thuc === 'PIN'
    ? kiemTraMatKhau_(ma, p.pin_salt, p.pin_hash)
    : kiemTraOtpChiaSe_(p, ma);

  if (!dung) {
    const soLan = Number(p.so_lan_sai || 0) + 1;
    const patch = { so_lan_sai: soLan };
    if (soLan >= toiDa) {
      patch.khoa_den = congPhut_(Number(getCauHinh('KHOA_PHUT', '15')));
      patch.so_lan_sai = 0;
    }
    capNhat_('PHIEU_CHIA_SE', p.share_id, patch);
    ghiLuot_(p, ctx, 'SAI_MA', '');

    if (patch.khoa_den) {
      throw new Error('Nhập sai quá ' + toiDa + ' lần. Vui lòng thử lại sau '
        + getCauHinh('KHOA_PHUT', '15') + ' phút.');
    }
    throw new Error('Mã không đúng. Còn ' + (toiDa - soLan) + ' lần thử.');
  }

  capNhat_('PHIEU_CHIA_SE', p.share_id, {
    so_lan_sai: 0,
    khoa_den: '',
    so_luot_da_dung: Number(p.so_luot_da_dung || 0) + 1
  });
  ghiLuot_(p, ctx, 'THANH_CONG', '');

  // Phiên xem ngắn hạn để đối tác không phải nhập lại mã khi mở từng tệp.
  const token = randomToken_(24);
  them_('PHIEN', {
    phien_id: uuid_(),
    user_id: 'CS:' + p.share_id,
    token_hash: sha256Hex_(token),
    tao_luc: nowIso_(),
    het_han: congPhut_(PHIEN_XEM_PHUT),
    dau_van_tay_thiet_bi: '',
    tin_cay_den: '',
    ip: (ctx && ctx.ip) || '',
    trang_thai: 'XEM_PHIEU'
  });

  return { phien_xem: token, noi_dung: noiDungTheoPhieu_(p) };
}

function kiemTraOtpChiaSe_(p, ma) {
  const otp = otpMoiNhat_('CHIA_SE', p.share_id);
  if (!otp) return false;
  if (otp.da_dung === true || String(otp.da_dung).toUpperCase() === 'TRUE') return false;
  if (new Date(otp.het_han) < new Date()) return false;

  if (!kiemTraMatKhau_(ma, otp.salt, otp.ma_hash)) {
    capNhat_('OTP', otp.otp_id, { so_lan_thu: Number(otp.so_lan_thu || 0) + 1 });
    return false;
  }
  capNhat_('OTP', otp.otp_id, { da_dung: true });
  return true;
}

/** Đọc lại nội dung khi đối tác đã có phiên xem. */
function noiDungPhieu_(payload, ctx) {
  const phien = timMot_('PHIEN', 'token_hash', sha256Hex_(String(payload.phien_xem || '')));
  if (!phien || phien.trang_thai !== 'XEM_PHIEU' || new Date(phien.het_han) < new Date()) {
    throw new Error('Phiên xem đã hết hạn. Vui lòng xác thực lại.');
  }

  const shareId = String(phien.user_id).replace(/^CS:/, '');
  const p = timMot_('PHIEU_CHIA_SE', 'share_id', shareId);
  if (!p) throw new Error('Không tìm thấy phiếu chia sẻ.');

  const loi = kiemTraHieuLuc_(p);
  if (loi) throw new Error(loi);

  return noiDungTheoPhieu_(p);
}

/** Nội dung hồ sơ trong đúng phạm vi phiếu cho phép. */
function noiDungTheoPhieu_(p) {
  const h = timMot_('HO_SO', 'ho_so_id', p.ho_so_id);
  if (!h) throw new Error('Hồ sơ không còn tồn tại.');

  const dv = timMot_('DON_VI', 'don_vi_id', h.don_vi_chu_quan_id);
  const danhMuc = layDanhMuc_({}, {});

  const tenMuc = function (loai, ma) {
    if (!ma) return '';
    const ds = danhMuc[loai] || [];
    for (let i = 0; i < ds.length; i++) if (ds[i].ma === ma) return ds[i].ten;
    return ma;
  };

  const chon = String(p.pham_vi_tep || 'CHO_DOI_TAC');
  const tep = loc_('TEP_DINH_KEM', function (t) {
    if (String(t.ho_so_id) !== String(h.ho_so_id)) return false;
    if (chon === 'CHO_DOI_TAC') {
      return t.cho_doi_tac_xem === true || String(t.cho_doi_tac_xem).toUpperCase() === 'TRUE';
    }
    return chon.split(',').indexOf(String(t.file_id)) >= 0;
  });

  return {
    ho_so_id: h.ho_so_id,
    ten_chuong_trinh: h.ten_chuong_trinh,
    don_vi_chu_quan: dv ? dv.ten : '',
    the_loai: tenMuc('THE_LOAI', h.the_loai),
    kenh: tenMuc('KENH', h.kenh),
    thoi_luong_giay: giayCua_(h),
    ngay_phat_song: h.ngay_phat_song,
    gio_phat_song: h.gio_phat_song,
    ghi_chu_lich: h.ghi_chu_lich,
    mo_ta: h.mo_ta,
    ma_don_vi: h.ma_don_vi,
    het_han_phieu: p.het_han,
    tep: tep.map(function (t) {
      return {
        file_id: t.file_id,
        loai: t.loai,
        ten_loai: (LOAI_TEP[t.loai] || {}).ten || t.loai,
        ten_hien_thi: t.ten_hien_thi,
        dung_luong: Number(t.dung_luong || 0),
        mo_ta: t.mo_ta,
        // Chỉ đưa địa chỉ nhúng, không đưa đường dẫn tệp gốc ra trang.
        url_nhung: urlNhung_(t.drive_file_id)
      };
    })
  };
}

/** Ghi lại lượt đối tác mở tệp, để biết ai đã xem gì. */
function ghiLuotMoTep_(payload, ctx) {
  const phien = timMot_('PHIEN', 'token_hash', sha256Hex_(String(payload.phien_xem || '')));
  if (!phien || phien.trang_thai !== 'XEM_PHIEU') return { da_ghi: false };

  const shareId = String(phien.user_id).replace(/^CS:/, '');
  const p = timMot_('PHIEU_CHIA_SE', 'share_id', shareId);
  if (!p) return { da_ghi: false };

  ghiLuot_(p, ctx, 'MO_TEP', String(payload.ten_tep || ''));
  return { da_ghi: true };
}

/* ================= Tiện ích ================= */

function layPhieu_(id) {
  const p = timMot_('PHIEU_CHIA_SE', 'share_id', String(id || ''));
  if (!p) throw new Error('Không tìm thấy phiếu chia sẻ.');
  return p;
}

function timTheoToken_(token) {
  const t = String(token || '');
  if (t.length < 16) return null;
  return timMot_('PHIEU_CHIA_SE', 'token_hash', sha256Hex_(t));
}

/** Trả về lý do phiếu không dùng được, hoặc chuỗi rỗng nếu vẫn hiệu lực. */
function kiemTraHieuLuc_(p) {
  if (p.trang_thai === 'THU_HOI') return 'Phiếu chia sẻ này đã bị thu hồi.';
  if (p.trang_thai !== 'HOAT_DONG') return 'Phiếu chia sẻ này không còn hiệu lực.';
  if (new Date(p.het_han) < new Date()) return 'Phiếu chia sẻ đã hết hạn.';

  if (p.khoa_den && new Date(p.khoa_den) > new Date()) {
    const con = Math.ceil((new Date(p.khoa_den) - new Date()) / 60000);
    return 'Đã nhập sai nhiều lần. Vui lòng thử lại sau ' + con + ' phút.';
  }

  const toiDa = Number(p.so_luot_toi_da || 0);
  if (toiDa > 0 && Number(p.so_luot_da_dung || 0) >= toiDa) {
    return 'Phiếu đã dùng hết ' + toiDa + ' lượt xem cho phép.';
  }
  return '';
}

function ghiLuot_(p, ctx, ketQua, tep) {
  try {
    them_('LUOT_TRUY_CAP', {
      id: uuid_(),
      share_id: p.share_id,
      ho_so_id: p.ho_so_id,
      thoi_gian: nowIso_(),
      ip: (ctx && ctx.ip) || '',
      user_agent: (ctx && ctx.user_agent) ? String(ctx.user_agent).slice(0, 200) : '',
      ket_qua: ketQua,
      tep_da_mo: tep || ''
    });
  } catch (e) {
    console.error('Không ghi được lượt truy cập: ' + e.message);
  }
}

function guiMailChiaSe_(p, h, ma, soPhut) {
  MailApp.sendEmail({
    to: p.email_nhan,
    subject: 'Mã xem hồ sơ ' + p.ho_so_id,
    htmlBody: khungMail_('Mã xác thực xem hồ sơ',
      '<p style="margin:0 0 16px">Bạn vừa yêu cầu xem hồ sơ chương trình '
      + '<strong>' + thoat_(h ? h.ten_chuong_trinh : p.ho_so_id) + '</strong> '
      + '(mã <code>' + thoat_(p.ho_so_id) + '</code>).</p>'
      + '<p style="margin:0 0 20px">Mã xác thực của bạn là:</p>'
      + oMa_(ma)
      + '<p style="margin:20px 0 0;font-size:14px;color:#4a5a70">Mã có hiệu lực trong '
      + soPhut + ' phút và chỉ dùng được một lần.</p>'
      + '<p style="margin:16px 0 0;font-size:14px;color:#4a5a70">Nếu bạn không thực hiện '
      + 'thao tác này, hãy bỏ qua thư và báo cho Ban Kế hoạch – Tài chính.</p>'),
    body: 'Ma xac thuc xem ho so ' + p.ho_so_id + ': ' + ma,
    name: 'Ban Kế hoạch – Tài chính HTV'
  });
}
