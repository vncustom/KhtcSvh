/**
 * HoSo.gs — Nghiệp vụ hồ sơ chương trình.
 *
 * Vòng đời:  NHAP ➜ CHO_DUYET ➜ DA_DUYET ➜ LUU_TRU
 * Từ CHO_DUYET có thể bị trả lại về NHAP kèm lý do.
 * Từ LUU_TRU có thể mở lại về DA_DUYET.
 */

const TRANG_THAI_HO_SO = {
  NHAP: 'Nháp',
  CHO_DUYET: 'Chờ duyệt',
  DA_DUYET: 'Đã duyệt',
  LUU_TRU: 'Lưu trữ',
  XOA: 'Đã xoá'
};

/** Ai làm được hành động nào, và hành động đó đi từ trạng thái nào sang trạng thái nào. */
const CHUYEN_TRANG_THAI = {
  GUI_DUYET: { tu: ['NHAP'], sang: 'CHO_DUYET', quyen: 'ho_so.gui_duyet', canLyDo: false },
  DUYET: { tu: ['CHO_DUYET'], sang: 'DA_DUYET', quyen: 'ho_so.duyet', canLyDo: false },
  TRA_LAI: { tu: ['CHO_DUYET'], sang: 'NHAP', quyen: 'ho_so.duyet', canLyDo: true },
  LUU_TRU: { tu: ['DA_DUYET'], sang: 'LUU_TRU', quyen: 'ho_so.duyet', canLyDo: false },
  MO_LAI: { tu: ['LUU_TRU'], sang: 'DA_DUYET', quyen: 'ho_so.duyet', canLyDo: false }
};

/* ================= Danh sách ================= */

/**
 * Lọc hồ sơ theo phạm vi của vai trò, trước khi áp bộ lọc của người dùng.
 * Cả danh sách lẫn bảng điều khiển đều dùng chung hàm này để hai nơi
 * không bao giờ đếm trên hai tập dữ liệu khác nhau.
 */
function trongPhamVi_(pham, doiTacTheoHoSo) {
  const ds = docAllRows_('HO_SO').filter(function (h) { return h.trang_thai !== 'XOA'; });

  if (pham.kieu === 'DON_VI') {
    return ds.filter(function (h) {
      return String(h.don_vi_chu_quan_id) === String(pham.don_vi_id);
    });
  }

  if (pham.kieu === 'DUOC_GAN') {
    // Đối tác chỉ thấy hồ sơ đã duyệt và có gán đơn vị của mình.
    return ds.filter(function (h) {
      const gan = doiTacTheoHoSo[h.ho_so_id] || [];
      return h.trang_thai === 'DA_DUYET' && gan.indexOf(pham.don_vi_id) >= 0;
    });
  }

  return ds;
}

function doiTacTheoHoSo_() {
  const m = {};
  docAllRows_('HO_SO_DON_VI').forEach(function (r) {
    (m[r.ho_so_id] = m[r.ho_so_id] || []).push(r.don_vi_id);
  });
  return m;
}

function danhSachHoSo_(payload, ctx) {
  const pham = phamViHoSo_(ctx);
  if (pham.kieu === 'KHONG') throw new Error('Tài khoản của bạn không được xem hồ sơ.');

  const tenDonVi = {};
  docAllRows_('DON_VI').forEach(function (d) { tenDonVi[d.don_vi_id] = d.ten; });

  const doiTacTheoHoSo = doiTacTheoHoSo_();

  let ds = trongPhamVi_(pham, doiTacTheoHoSo);

  /* --- Bộ lọc của người dùng --- */
  const f = payload || {};
  const tu = String(f.tu_khoa || '').toLowerCase().trim();

  if (f.trang_thai) ds = ds.filter(function (h) { return h.trang_thai === f.trang_thai; });
  if (f.kenh) ds = ds.filter(function (h) { return h.kenh === f.kenh; });
  if (f.the_loai) ds = ds.filter(function (h) { return h.the_loai === f.the_loai; });
  if (f.don_vi_id) {
    ds = ds.filter(function (h) {
      return String(h.don_vi_chu_quan_id) === String(f.don_vi_id)
        || (doiTacTheoHoSo[h.ho_so_id] || []).indexOf(f.don_vi_id) >= 0;
    });
  }
  if (f.tu_ngay) ds = ds.filter(function (h) { return h.ngay_phat_song && h.ngay_phat_song >= f.tu_ngay; });
  if (f.den_ngay) ds = ds.filter(function (h) { return h.ngay_phat_song && h.ngay_phat_song <= f.den_ngay; });

  if (tu) {
    ds = ds.filter(function (h) {
      const gan = (doiTacTheoHoSo[h.ho_so_id] || [])
        .map(function (id) { return tenDonVi[id] || ''; }).join(' ');
      return [h.ho_so_id, h.ten_chuong_trinh, tenDonVi[h.don_vi_chu_quan_id], gan, h.mo_ta]
        .join(' ').toLowerCase().indexOf(tu) >= 0;
    });
  }

  /* --- Sắp xếp --- */
  const sap = String(f.sap_xep || 'moi_nhat');
  ds.sort(function (a, b) {
    if (sap === 'ten') return String(a.ten_chuong_trinh).localeCompare(String(b.ten_chuong_trinh), 'vi');
    if (sap === 'phat_song') return String(b.ngay_phat_song || '').localeCompare(String(a.ngay_phat_song || ''));
    return new Date(b.ngay_tao) - new Date(a.ngay_tao);
  });

  /* --- Thống kê trên toàn bộ kết quả lọc, không chỉ trang hiện tại --- */
  const thongKe = { tong: ds.length, tong_thoi_luong: 0 };
  Object.keys(TRANG_THAI_HO_SO).forEach(function (t) { thongKe[t] = 0; });
  ds.forEach(function (h) {
    thongKe[h.trang_thai] = (thongKe[h.trang_thai] || 0) + 1;
    thongKe.tong_thoi_luong += Number(h.thoi_luong_phut || 0);
  });

  const trang = Math.max(1, Number(f.trang || 1));
  const moiTrang = Math.min(100, Math.max(5, Number(f.moi_trang || 20)));
  const batDau = (trang - 1) * moiTrang;

  return {
    tong: ds.length,
    trang: trang,
    so_trang: Math.max(1, Math.ceil(ds.length / moiTrang)),
    thong_ke: thongKe,
    dong: ds.slice(batDau, batDau + moiTrang).map(function (h) {
      return {
        ho_so_id: h.ho_so_id,
        ten_chuong_trinh: h.ten_chuong_trinh,
        don_vi_chu_quan: tenDonVi[h.don_vi_chu_quan_id] || '',
        doi_tac: (doiTacTheoHoSo[h.ho_so_id] || [])
          .map(function (id) { return tenDonVi[id] || ''; })
          .filter(Boolean),
        the_loai: h.the_loai,
        kenh: h.kenh,
        thoi_luong_phut: Number(h.thoi_luong_phut || 0),
        so_tap: h.so_tap,
        ngay_phat_song: h.ngay_phat_song,
        gio_phat_song: h.gio_phat_song,
        trang_thai: h.trang_thai,
        ten_trang_thai: TRANG_THAI_HO_SO[h.trang_thai] || h.trang_thai,
        ngay_cap_nhat: h.ngay_cap_nhat
      };
    })
  };
}

/* ================= Chi tiết ================= */

function chiTietHoSo_(payload, ctx) {
  const h = layHoSo_(payload.ho_so_id);
  kiemTraDuocXem_(h, ctx);

  const tenDonVi = {};
  docAllRows_('DON_VI').forEach(function (d) { tenDonVi[d.don_vi_id] = d.ten; });

  const doiTac = loc_('HO_SO_DON_VI', function (r) {
    return String(r.ho_so_id) === String(h.ho_so_id);
  }).map(function (r) {
    return { don_vi_id: r.don_vi_id, ten: tenDonVi[r.don_vi_id] || '', vai_tro: r.vai_tro };
  });

  const nhatKy = loc_('NHAT_KY', function (r) {
    return String(r.doi_tuong_id) === String(h.ho_so_id);
  });
  nhatKy.sort(function (a, b) { return new Date(b.thoi_gian) - new Date(a.thoi_gian); });

  const tenNguoi = {};
  docAllRows_('NGUOI_DUNG').forEach(function (u) { tenNguoi[u.user_id] = u.ho_ten; });

  return {
    ho_so: {
      ho_so_id: h.ho_so_id,
      ten_chuong_trinh: h.ten_chuong_trinh,
      don_vi_chu_quan_id: h.don_vi_chu_quan_id,
      don_vi_chu_quan: tenDonVi[h.don_vi_chu_quan_id] || '',
      the_loai: h.the_loai,
      kenh: h.kenh,
      thoi_luong_phut: Number(h.thoi_luong_phut || 0),
      so_tap: h.so_tap,
      ngay_phat_song: h.ngay_phat_song,
      gio_phat_song: h.gio_phat_song,
      ghi_chu_lich: h.ghi_chu_lich,
      mo_ta: h.mo_ta,
      trang_thai: h.trang_thai,
      ten_trang_thai: TRANG_THAI_HO_SO[h.trang_thai] || h.trang_thai,
      nguoi_duyet: tenNguoi[h.nguoi_duyet] || h.nguoi_duyet || '',
      ngay_duyet: h.ngay_duyet,
      ly_do_tra_lai: h.ly_do_tra_lai,
      drive_folder_id: h.drive_folder_id,
      drive_url: urlThuMuc_(h.drive_folder_id),
      ngay_tao: h.ngay_tao,
      nguoi_tao: tenNguoi[h.nguoi_tao] || h.nguoi_tao || '',
      ngay_cap_nhat: h.ngay_cap_nhat
    },
    doi_tac: doiTac,
    duoc_lam: duocLam_(h, ctx),
    nhat_ky: nhatKy.slice(0, 30).map(function (r) {
      return {
        thoi_gian: r.thoi_gian,
        nguoi: tenNguoi[r.user_id] || r.user_id || '—',
        hanh_dong: r.hanh_dong,
        chi_tiet: r.chi_tiet,
        ket_qua: r.ket_qua
      };
    })
  };
}

/* ================= Thêm & sửa ================= */

function luuHoSo_(payload, ctx) {
  const ten = String(payload.ten_chuong_trinh || '').trim();
  if (!ten) throw new Error('Vui lòng nhập tên chương trình.');

  const donViChuQuan = String(payload.don_vi_chu_quan_id || '');
  if (!donViChuQuan) throw new Error('Vui lòng chọn đơn vị chủ quản.');
  if (!timMot_('DON_VI', 'don_vi_id', donViChuQuan)) {
    throw new Error('Đơn vị chủ quản không tồn tại.');
  }

  const thoiLuong = Number(payload.thoi_luong_phut || 0);
  if (!(thoiLuong > 0)) throw new Error('Thời lượng phải lớn hơn 0 phút.');

  const truong = {
    ten_chuong_trinh: ten,
    don_vi_chu_quan_id: donViChuQuan,
    the_loai: String(payload.the_loai || ''),
    kenh: String(payload.kenh || ''),
    thoi_luong_phut: thoiLuong,
    so_tap: Number(payload.so_tap || 0),
    ngay_phat_song: String(payload.ngay_phat_song || ''),
    gio_phat_song: String(payload.gio_phat_song || ''),
    ghi_chu_lich: String(payload.ghi_chu_lich || ''),
    mo_ta: String(payload.mo_ta || ''),
    ngay_cap_nhat: nowIso_(),
    nguoi_cap_nhat: ctx.user_id
  };

  /* --- Sửa hồ sơ đã có --- */
  if (payload.ho_so_id) {
    const cu = layHoSo_(payload.ho_so_id);
    kiemTraDuocSua_(cu, ctx);

    // Đơn vị chủ quản chỉ được giữ hồ sơ trong đơn vị mình.
    if (!co_(ctx, 'ho_so.sua_tat_ca') && donViChuQuan !== cu.don_vi_chu_quan_id) {
      throw new Error('Bạn không được chuyển hồ sơ sang đơn vị chủ quản khác.');
    }

    // Sửa hồ sơ đã duyệt thì phải duyệt lại, trừ khi chính người sửa có quyền duyệt.
    if (cu.trang_thai === 'DA_DUYET' && !co_(ctx, 'ho_so.duyet')) {
      truong.trang_thai = 'CHO_DUYET';
      truong.nguoi_duyet = '';
      truong.ngay_duyet = '';
    }

    capNhat_('HO_SO', cu.ho_so_id, truong);
    luuDoiTac_(cu.ho_so_id, payload.doi_tac, ctx);

    ghiNhatKy_(ctx, 'SUA_HO_SO', 'HO_SO', cu.ho_so_id,
      'Cập nhật hồ sơ ' + ten, 'THANH_CONG',
      { ten: cu.ten_chuong_trinh, kenh: cu.kenh, thoi_luong: cu.thoi_luong_phut },
      { ten: ten, kenh: truong.kenh, thoi_luong: thoiLuong });

    if (truong.trang_thai === 'CHO_DUYET') {
      ghiNhatKy_(ctx, 'CHO_DUYET_LAI', 'HO_SO', cu.ho_so_id,
        'Hồ sơ đã duyệt bị sửa nên quay lại chờ duyệt', 'THANH_CONG');
    }

    return { ho_so_id: cu.ho_so_id, trang_thai: truong.trang_thai || cu.trang_thai };
  }

  /* --- Tạo hồ sơ mới --- */
  doiHoiQuyen_(ctx, 'ho_so.them');

  // Đơn vị chủ quản chỉ tạo được hồ sơ cho chính đơn vị mình.
  if (!co_(ctx, 'ho_so.sua_tat_ca') && donViChuQuan !== ctx.don_vi_id) {
    throw new Error('Bạn chỉ tạo được hồ sơ cho đơn vị của mình.');
  }

  const hoSoId = sinhMaHoSo_();
  truong.ho_so_id = hoSoId;
  truong.trang_thai = 'NHAP';
  truong.nguoi_duyet = '';
  truong.ngay_duyet = '';
  truong.ly_do_tra_lai = '';
  truong.ngay_tao = nowIso_();
  truong.nguoi_tao = ctx.user_id;

  // Tạo thư mục Drive trước khi ghi dòng, để hồ sơ không bao giờ thiếu chỗ lưu tài liệu.
  const nam = (truong.ngay_phat_song || nowIso_()).slice(0, 4);
  try {
    truong.drive_folder_id = taoThuMucHoSo_(hoSoId, nam);
  } catch (e) {
    throw new Error('Không tạo được thư mục lưu trữ: ' + e.message);
  }

  them_('HO_SO', truong);
  luuDoiTac_(hoSoId, payload.doi_tac, ctx);

  ghiNhatKy_(ctx, 'THEM_HO_SO', 'HO_SO', hoSoId, 'Tạo hồ sơ ' + ten, 'THANH_CONG');
  return { ho_so_id: hoSoId, trang_thai: 'NHAP' };
}

/** Ghi lại danh sách đối tác của hồ sơ: xoá hết rồi ghi lại theo danh sách mới. */
function luuDoiTac_(hoSoId, danhSach, ctx) {
  if (!Array.isArray(danhSach)) return;

  const cu = loc_('HO_SO_DON_VI', function (r) { return String(r.ho_so_id) === String(hoSoId); });
  const moi = danhSach
    .filter(function (d) { return d && d.don_vi_id; })
    .map(function (d) { return String(d.don_vi_id) + '|' + String(d.vai_tro || ''); });
  const cuKhoa = cu.map(function (r) { return String(r.don_vi_id) + '|' + String(r.vai_tro || ''); });

  // Không có gì đổi thì không đụng vào Sheet.
  if (cuKhoa.length === moi.length && cuKhoa.every(function (k) { return moi.indexOf(k) >= 0; })) {
    return;
  }

  cu.forEach(function (r) { xoaDong_('HO_SO_DON_VI', r.id); });

  const them = danhSach
    .filter(function (d) { return d && d.don_vi_id; })
    .map(function (d) {
      return {
        id: uuid_(), ho_so_id: hoSoId, don_vi_id: d.don_vi_id,
        vai_tro: String(d.vai_tro || 'DONG_SAN_XUAT'), ghi_chu: String(d.ghi_chu || ''),
        ngay_tao: nowIso_(), nguoi_tao: ctx.user_id
      };
    });

  if (them.length) themNhieu_('HO_SO_DON_VI', them);
}

/* ================= Chuyển trạng thái ================= */

function doiTrangThaiHoSo_(payload, ctx) {
  const h = layHoSo_(payload.ho_so_id);
  const hanhDong = String(payload.hanh_dong || '');
  const buoc = CHUYEN_TRANG_THAI[hanhDong];

  if (!buoc) throw new Error('Hành động không hợp lệ.');
  doiHoiQuyen_(ctx, buoc.quyen);

  if (buoc.tu.indexOf(h.trang_thai) < 0) {
    throw new Error('Hồ sơ đang ở trạng thái "' + (TRANG_THAI_HO_SO[h.trang_thai] || h.trang_thai)
      + '" nên không thực hiện được thao tác này.');
  }

  // Người gửi duyệt phải thuộc đơn vị chủ quản, trừ khi có quyền sửa mọi hồ sơ.
  if (hanhDong === 'GUI_DUYET' && !co_(ctx, 'ho_so.sua_tat_ca')
      && String(h.don_vi_chu_quan_id) !== String(ctx.don_vi_id)) {
    throw new Error('Bạn chỉ gửi duyệt được hồ sơ của đơn vị mình.');
  }

  const lyDo = String(payload.ly_do || '').trim();
  if (buoc.canLyDo && !lyDo) throw new Error('Vui lòng nhập lý do trả lại hồ sơ.');

  const patch = {
    trang_thai: buoc.sang,
    ngay_cap_nhat: nowIso_(),
    nguoi_cap_nhat: ctx.user_id
  };

  if (hanhDong === 'DUYET') {
    patch.nguoi_duyet = ctx.user_id;
    patch.ngay_duyet = nowIso_();
    patch.ly_do_tra_lai = '';
  }
  if (hanhDong === 'TRA_LAI') {
    patch.ly_do_tra_lai = lyDo;
    patch.nguoi_duyet = '';
    patch.ngay_duyet = '';
  }

  capNhat_('HO_SO', h.ho_so_id, patch);

  ghiNhatKy_(ctx, hanhDong, 'HO_SO', h.ho_so_id,
    (TRANG_THAI_HO_SO[h.trang_thai] || h.trang_thai) + ' ➜ ' + TRANG_THAI_HO_SO[buoc.sang]
    + (lyDo ? ' — ' + lyDo : ''), 'THANH_CONG');

  if (hanhDong === 'TRA_LAI') baoTraLai_(h, lyDo, ctx);

  return { trang_thai: buoc.sang, ten_trang_thai: TRANG_THAI_HO_SO[buoc.sang] };
}

/** Báo cho đơn vị chủ quản khi hồ sơ bị trả lại. Hết hạn mức mail thì bỏ qua. */
function baoTraLai_(h, lyDo, ctx) {
  try {
    if (MailApp.getRemainingDailyQuota() <= 0) return;
    const dv = timMot_('DON_VI', 'don_vi_id', h.don_vi_chu_quan_id);
    if (!dv || !dv.email) return;

    MailApp.sendEmail({
      to: dv.email,
      subject: 'Hồ sơ ' + h.ho_so_id + ' bị trả lại',
      htmlBody: khungMail_('Hồ sơ bị trả lại',
        '<p style="margin:0 0 14px">Hồ sơ <strong>' + thoat_(h.ten_chuong_trinh) + '</strong> '
        + '(mã <code>' + thoat_(h.ho_so_id) + '</code>) đã được trả lại để chỉnh sửa.</p>'
        + '<p style="margin:0 0 8px;font-weight:600">Lý do:</p>'
        + '<div style="background:#f4f6f9;border-left:3px solid #b3862f;padding:12px 14px;'
        + 'border-radius:0 4px 4px 0">' + thoat_(lyDo) + '</div>'),
      body: 'Ho so ' + h.ho_so_id + ' bi tra lai. Ly do: ' + lyDo,
      name: 'Ban Kế hoạch – Tài chính HTV'
    });
  } catch (e) {
    console.error('Không gửi được thư báo trả lại: ' + e.message);
  }
}

/* ================= Xoá ================= */

function xoaHoSo_(payload, ctx) {
  doiHoiQuyen_(ctx, 'ho_so.xoa');
  const h = layHoSo_(payload.ho_so_id);

  if (h.trang_thai === 'DA_DUYET' || h.trang_thai === 'LUU_TRU') {
    throw new Error('Không xoá được hồ sơ đã duyệt. Hãy chuyển sang lưu trữ nếu không dùng nữa.');
  }

  // Xoá mềm: dòng vẫn còn trong Sheet, thư mục Drive giữ nguyên.
  capNhat_('HO_SO', h.ho_so_id, {
    trang_thai: 'XOA', ngay_cap_nhat: nowIso_(), nguoi_cap_nhat: ctx.user_id
  });
  ghiNhatKy_(ctx, 'XOA_HO_SO', 'HO_SO', h.ho_so_id,
    'Xoá hồ sơ ' + h.ten_chuong_trinh, 'THANH_CONG');
  return { da_xoa: true };
}

/* ================= Bảng điều khiển ================= */

function bangDieuKhien_(payload, ctx) {
  const ds = danhSachHoSo_({ moi_trang: 5, sap_xep: 'moi_nhat' }, ctx);
  const tk = ds.thong_ke;

  const tenDonVi = {};
  docAllRows_('DON_VI').forEach(function (d) { tenDonVi[d.don_vi_id] = d.ten; });

  // Đếm số hồ sơ theo đơn vị chủ quản, lấy 6 đơn vị nhiều nhất.
  // Dùng đúng phạm vi của vai trò để con số khớp với danh sách hồ sơ.
  const theoDonVi = {};
  trongPhamVi_(phamViHoSo_(ctx), doiTacTheoHoSo_()).forEach(function (h) {
    const ten = tenDonVi[h.don_vi_chu_quan_id] || '(chưa rõ)';
    theoDonVi[ten] = (theoDonVi[ten] || 0) + 1;
  });

  const topDonVi = Object.keys(theoDonVi)
    .map(function (ten) { return { ten: ten, so: theoDonVi[ten] }; })
    .sort(function (a, b) { return b.so - a.so; })
    .slice(0, 6);

  return {
    tong_ho_so: tk.tong,
    tong_thoi_luong: tk.tong_thoi_luong,
    theo_trang_thai: {
      NHAP: tk.NHAP || 0,
      CHO_DUYET: tk.CHO_DUYET || 0,
      DA_DUYET: tk.DA_DUYET || 0,
      LUU_TRU: tk.LUU_TRU || 0
    },
    so_doi_tac: docAllRows_('DON_VI').filter(function (d) {
      return d.loai === 'DOI_TAC' && d.trang_thai === 'HOAT_DONG';
    }).length,
    top_don_vi: topDonVi,
    moi_nhat: ds.dong,
    duoc_duyet: co_(ctx, 'ho_so.duyet'),
    duoc_them: co_(ctx, 'ho_so.them')
  };
}

/* ================= Tiện ích nội bộ ================= */

function layHoSo_(id) {
  const h = timMot_('HO_SO', 'ho_so_id', String(id || ''));
  if (!h || h.trang_thai === 'XOA') throw new Error('Không tìm thấy hồ sơ.');
  return h;
}

function kiemTraDuocXem_(h, ctx) {
  const pham = phamViHoSo_(ctx);
  if (pham.kieu === 'TAT_CA') return;

  if (pham.kieu === 'DON_VI') {
    if (String(h.don_vi_chu_quan_id) === String(pham.don_vi_id)) return;
    throw new Error('Hồ sơ này không thuộc đơn vị của bạn.');
  }

  if (pham.kieu === 'DUOC_GAN') {
    const gan = loc_('HO_SO_DON_VI', function (r) {
      return String(r.ho_so_id) === String(h.ho_so_id)
        && String(r.don_vi_id) === String(pham.don_vi_id);
    });
    if (gan.length && h.trang_thai === 'DA_DUYET') return;
    throw new Error('Bạn không được xem hồ sơ này.');
  }

  throw new Error('Tài khoản của bạn không được xem hồ sơ.');
}

function kiemTraDuocSua_(h, ctx) {
  if (h.trang_thai === 'LUU_TRU') {
    throw new Error('Hồ sơ đang lưu trữ nên chỉ đọc. Hãy mở lại trước khi sửa.');
  }

  if (co_(ctx, 'ho_so.sua_tat_ca')) return;

  if (co_(ctx, 'ho_so.sua_don_vi')) {
    if (String(h.don_vi_chu_quan_id) !== String(ctx.don_vi_id)) {
      throw new Error('Bạn chỉ sửa được hồ sơ của đơn vị mình.');
    }
    if (h.trang_thai === 'DA_DUYET') {
      // Vẫn cho sửa, nhưng luuHoSo_ sẽ đưa hồ sơ về chờ duyệt.
      return;
    }
    if (h.trang_thai === 'CHO_DUYET') {
      throw new Error('Hồ sơ đang chờ duyệt. Hãy đợi kết quả hoặc nhờ Ban KH-TC trả lại.');
    }
    return;
  }

  throw new Error('Tài khoản của bạn không có quyền sửa hồ sơ.');
}

/** Những nút mà giao diện được phép hiện cho hồ sơ này. */
function duocLam_(h, ctx) {
  const duoc = { sua: false };
  try {
    kiemTraDuocSua_(h, ctx);
    duoc.sua = true;
  } catch (e) {
    duoc.sua = false;
  }

  Object.keys(CHUYEN_TRANG_THAI).forEach(function (hd) {
    const b = CHUYEN_TRANG_THAI[hd];
    duoc[hd] = co_(ctx, b.quyen) && b.tu.indexOf(h.trang_thai) >= 0;
  });

  duoc.xoa = co_(ctx, 'ho_so.xoa')
    && h.trang_thai !== 'DA_DUYET' && h.trang_thai !== 'LUU_TRU';
  return duoc;
}

/**
 * Sinh mã hồ sơ dạng HTV-KHTC-2026-001.
 * Bọc trong LockService để hai người tạo cùng lúc không nhận trùng số.
 */
function sinhMaHoSo_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const tienTo = getCauHinh('TIEN_TO_MA_HO_SO', 'HTV-KHTC');
    const nam = new Date().getFullYear();
    const dau = tienTo + '-' + nam + '-';

    let lonNhat = 0;
    docAllRows_('HO_SO', true).forEach(function (h) {
      const ma = String(h.ho_so_id || '');
      if (ma.indexOf(dau) !== 0) return;
      const so = parseInt(ma.slice(dau.length), 10);
      if (!isNaN(so) && so > lonNhat) lonNhat = so;
    });

    return dau + String(lonNhat + 1).padStart(3, '0');
  } finally {
    lock.releaseLock();
  }
}
