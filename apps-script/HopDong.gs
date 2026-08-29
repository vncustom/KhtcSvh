/**
 * HopDong.gs — Hợp đồng, phụ lục, biên bản và các đợt thanh toán.
 *
 * Mỗi hợp đồng gắn với một hồ sơ chương trình và một đơn vị đối tác.
 * Các đợt thanh toán nằm ở bảng riêng để theo dõi tiến độ chi trả.
 */

const TRANG_THAI_HOP_DONG = {
  DU_THAO: 'Dự thảo',
  DANG_HIEU_LUC: 'Đang hiệu lực',
  HOAN_THANH: 'Đã hoàn thành',
  THANH_LY: 'Đã thanh lý',
  HUY: 'Đã huỷ'
};

const TRANG_THAI_THANH_TOAN = {
  CHUA_TT: 'Chưa thanh toán',
  DA_TT: 'Đã thanh toán',
  HUY: 'Đã huỷ'
};

/** Số ngày trước hạn thì bắt đầu cảnh báo. */
const NGAY_CANH_BAO = 30;

/* ================= Danh sách ================= */

function danhSachHopDong_(payload, ctx) {
  doiHoiQuyen_(ctx, quyenXemHopDong_(ctx));

  const f = payload || {};
  const tenDonVi = {};
  docAllRows_('DON_VI').forEach(function (d) { tenDonVi[d.don_vi_id] = d.ten; });

  const hoSo = {};
  docAllRows_('HO_SO').forEach(function (h) { hoSo[h.ho_so_id] = h; });

  const thanhToanTheoHd = gomThanhToan_();

  let ds = docAllRows_('HOP_DONG').filter(function (c) { return c.trang_thai !== 'XOA'; });

  /* --- Giới hạn theo vai trò: chỉ thấy hợp đồng của hồ sơ mình được xem --- */
  const pham = phamViHoSo_(ctx);
  if (pham.kieu !== 'TAT_CA') {
    const duocXem = {};
    trongPhamVi_(pham, doiTacTheoHoSo_()).forEach(function (h) { duocXem[h.ho_so_id] = true; });
    ds = ds.filter(function (c) {
      if (pham.kieu === 'DUOC_GAN') {
        // Đối tác chỉ thấy hợp đồng ký với chính mình.
        return duocXem[c.ho_so_id] && String(c.don_vi_id) === String(pham.don_vi_id);
      }
      return duocXem[c.ho_so_id];
    });
  }

  /* --- Bộ lọc --- */
  if (f.ho_so_id) ds = ds.filter(function (c) { return String(c.ho_so_id) === String(f.ho_so_id); });
  if (f.don_vi_id) ds = ds.filter(function (c) { return String(c.don_vi_id) === String(f.don_vi_id); });
  if (f.loai) ds = ds.filter(function (c) { return c.loai === f.loai; });
  if (f.trang_thai) ds = ds.filter(function (c) { return c.trang_thai === f.trang_thai; });

  const homNay = ngayIso_();
  const hanCanhBao = ngayIso_(new Date(new Date().getTime() + NGAY_CANH_BAO * 86400000));

  if (f.sap_het_han) {
    ds = ds.filter(function (c) {
      return c.ngay_het_han && c.ngay_het_han >= homNay && c.ngay_het_han <= hanCanhBao
        && c.trang_thai === 'DANG_HIEU_LUC';
    });
  }
  if (f.qua_han) {
    ds = ds.filter(function (c) {
      return c.ngay_het_han && c.ngay_het_han < homNay && c.trang_thai === 'DANG_HIEU_LUC';
    });
  }

  const tu = String(f.tu_khoa || '').toLowerCase().trim();
  if (tu) {
    ds = ds.filter(function (c) {
      const h = hoSo[c.ho_so_id] || {};
      return [c.so_hop_dong, c.ghi_chu, h.ten_chuong_trinh, tenDonVi[c.don_vi_id]]
        .join(' ').toLowerCase().indexOf(tu) >= 0;
    });
  }

  ds.sort(function (a, b) {
    return String(b.ngay_ky || '').localeCompare(String(a.ngay_ky || ''));
  });

  /* --- Thống kê trên toàn bộ kết quả lọc --- */
  const tk = { tong: ds.length, tong_gia_tri: 0, da_tra: 0, sap_het_han: 0, qua_han: 0 };
  ds.forEach(function (c) {
    tk.tong_gia_tri += Number(c.gia_tri || 0);
    (thanhToanTheoHd[c.hop_dong_id] || []).forEach(function (t) {
      if (t.trang_thai === 'DA_TT') tk.da_tra += Number(t.so_tien || 0);
    });
    if (c.trang_thai === 'DANG_HIEU_LUC' && c.ngay_het_han) {
      if (c.ngay_het_han < homNay) tk.qua_han++;
      else if (c.ngay_het_han <= hanCanhBao) tk.sap_het_han++;
    }
  });

  const trang = Math.max(1, Number(f.trang || 1));
  const moiTrang = Math.min(100, Math.max(5, Number(f.moi_trang || 20)));
  const batDau = (trang - 1) * moiTrang;

  return {
    tong: ds.length,
    trang: trang,
    so_trang: Math.max(1, Math.ceil(ds.length / moiTrang)),
    thong_ke: tk,
    duoc_sua: co_(ctx, 'hop_dong.sua'),
    dong: ds.slice(batDau, batDau + moiTrang).map(function (c) {
      return goiHopDong_(c, hoSo, tenDonVi, thanhToanTheoHd[c.hop_dong_id] || [], homNay, hanCanhBao);
    })
  };
}

/** Hợp đồng của một hồ sơ, dùng cho thẻ hợp đồng trong trang chi tiết hồ sơ. */
function hopDongCuaHoSo_(payload, ctx) {
  const h = layHoSo_(payload.ho_so_id);
  kiemTraDuocXem_(h, ctx);

  const kq = danhSachHopDong_({ ho_so_id: h.ho_so_id, moi_trang: 100 }, ctx);
  kq.duoc_sua = co_(ctx, 'hop_dong.sua') && h.trang_thai !== 'LUU_TRU';
  return kq;
}

function goiHopDong_(c, hoSo, tenDonVi, thanhToan, homNay, hanCanhBao) {
  const h = hoSo[c.ho_so_id] || {};
  const daTra = thanhToan
    .filter(function (t) { return t.trang_thai === 'DA_TT'; })
    .reduce(function (a, t) { return a + Number(t.so_tien || 0); }, 0);

  const denHan = thanhToan.filter(function (t) {
    return t.trang_thai === 'CHUA_TT' && t.ngay_du_kien && t.ngay_du_kien < homNay;
  }).length;

  let canhBaoHan = '';
  if (c.trang_thai === 'DANG_HIEU_LUC' && c.ngay_het_han) {
    if (c.ngay_het_han < homNay) canhBaoHan = 'QUA_HAN';
    else if (c.ngay_het_han <= hanCanhBao) canhBaoHan = 'SAP_HET_HAN';
  }

  return {
    hop_dong_id: c.hop_dong_id,
    ho_so_id: c.ho_so_id,
    ten_chuong_trinh: h.ten_chuong_trinh || '',
    so_hop_dong: c.so_hop_dong,
    loai: c.loai,
    don_vi_id: c.don_vi_id,
    ten_don_vi: tenDonVi[c.don_vi_id] || '',
    ngay_ky: c.ngay_ky,
    ngay_hieu_luc: c.ngay_hieu_luc,
    ngay_het_han: c.ngay_het_han,
    gia_tri: Number(c.gia_tri || 0),
    tien_te: c.tien_te || 'VND',
    thue_suat: Number(c.thue_suat || 0),
    trang_thai: c.trang_thai,
    ten_trang_thai: TRANG_THAI_HOP_DONG[c.trang_thai] || c.trang_thai,
    ghi_chu: c.ghi_chu,
    canh_bao_han: canhBaoHan,
    so_dot: thanhToan.length,
    da_tra: daTra,
    con_lai: Number(c.gia_tri || 0) - daTra,
    dot_den_han: denHan
  };
}

function gomThanhToan_() {
  const m = {};
  docAllRows_('THANH_TOAN').forEach(function (t) {
    if (t.trang_thai === 'XOA') return;
    (m[t.hop_dong_id] = m[t.hop_dong_id] || []).push(t);
  });
  return m;
}

/** Đối tác chỉ có quyền xem hợp đồng của mình, các vai trò khác xem chung. */
function quyenXemHopDong_(ctx) {
  return co_(ctx, 'hop_dong.xem') ? 'hop_dong.xem' : 'hop_dong.xem_cua_minh';
}

/* ================= Chi tiết ================= */

function chiTietHopDong_(payload, ctx) {
  const c = layHopDong_(payload.hop_dong_id);
  const h = layHoSo_(c.ho_so_id);
  kiemTraDuocXem_(h, ctx);

  if (ctx.nhom === 'DOI_TAC' && String(c.don_vi_id) !== String(ctx.don_vi_id)) {
    throw new Error('Bạn không được xem hợp đồng này.');
  }

  const tenDonVi = {};
  docAllRows_('DON_VI').forEach(function (d) { tenDonVi[d.don_vi_id] = d.ten; });

  const homNay = ngayIso_();
  const dot = loc_('THANH_TOAN', function (t) {
    return String(t.hop_dong_id) === String(c.hop_dong_id) && t.trang_thai !== 'XOA';
  });
  dot.sort(function (a, b) { return Number(a.dot || 0) - Number(b.dot || 0); });

  const tep = loc_('TEP_DINH_KEM', function (t) {
    return String(t.hop_dong_id) === String(c.hop_dong_id);
  });

  return {
    hop_dong: goiHopDong_(c, { [h.ho_so_id]: h }, tenDonVi, dot, homNay,
      ngayIso_(new Date(new Date().getTime() + NGAY_CANH_BAO * 86400000))),
    thanh_toan: dot.map(function (t) {
      return {
        id: t.id,
        dot: Number(t.dot || 0),
        dien_giai: t.dien_giai,
        so_tien: Number(t.so_tien || 0),
        ngay_du_kien: t.ngay_du_kien,
        ngay_thuc_te: t.ngay_thuc_te,
        trang_thai: t.trang_thai,
        ten_trang_thai: TRANG_THAI_THANH_TOAN[t.trang_thai] || t.trang_thai,
        qua_han: t.trang_thai === 'CHUA_TT' && t.ngay_du_kien && t.ngay_du_kien < homNay,
        chung_tu_file_id: t.chung_tu_file_id
      };
    }),
    tep: tep.map(function (t) {
      return { file_id: t.file_id, ten_hien_thi: t.ten_hien_thi, url_xem: urlXem_(t.drive_file_id) };
    }),
    duoc_sua: co_(ctx, 'hop_dong.sua') && h.trang_thai !== 'LUU_TRU'
  };
}

/* ================= Thêm & sửa hợp đồng ================= */

function luuHopDong_(payload, ctx) {
  doiHoiQuyen_(ctx, 'hop_dong.sua');

  const h = layHoSo_(payload.ho_so_id);
  if (h.trang_thai === 'LUU_TRU') {
    throw new Error('Hồ sơ đang lưu trữ nên không thêm sửa hợp đồng được.');
  }

  const so = String(payload.so_hop_dong || '').trim();
  if (!so) throw new Error('Vui lòng nhập số hợp đồng.');

  if (!TRANG_THAI_HOP_DONG[payload.trang_thai || 'DU_THAO']) {
    throw new Error('Trạng thái hợp đồng không hợp lệ.');
  }

  const donViId = String(payload.don_vi_id || '');
  if (!donViId) throw new Error('Vui lòng chọn đơn vị ký hợp đồng.');
  if (!timMot_('DON_VI', 'don_vi_id', donViId)) throw new Error('Đơn vị không tồn tại.');

  const giaTri = Number(payload.gia_tri || 0);
  if (giaTri < 0) throw new Error('Giá trị hợp đồng không được âm.');

  // Số hợp đồng phải là duy nhất, nếu không thì tra cứu về sau sẽ nhập nhằng.
  const trung = timMot_('HOP_DONG', 'so_hop_dong', so);
  if (trung && trung.trang_thai !== 'XOA'
      && String(trung.hop_dong_id) !== String(payload.hop_dong_id || '')) {
    throw new Error('Số hợp đồng "' + so + '" đã có trong hệ thống.');
  }

  kiemTraNgay_(payload);

  const truong = {
    ho_so_id: h.ho_so_id,
    so_hop_dong: so,
    loai: String(payload.loai || 'HD_CHINH'),
    don_vi_id: donViId,
    ngay_ky: String(payload.ngay_ky || ''),
    ngay_hieu_luc: String(payload.ngay_hieu_luc || ''),
    ngay_het_han: String(payload.ngay_het_han || ''),
    gia_tri: giaTri,
    tien_te: String(payload.tien_te || 'VND'),
    thue_suat: Number(payload.thue_suat || 0),
    trang_thai: String(payload.trang_thai || 'DU_THAO'),
    ghi_chu: String(payload.ghi_chu || ''),
    ngay_cap_nhat: nowIso_(),
    nguoi_cap_nhat: ctx.user_id
  };

  if (payload.hop_dong_id) {
    const cu = layHopDong_(payload.hop_dong_id);
    capNhat_('HOP_DONG', cu.hop_dong_id, truong);
    ghiNhatKy_(ctx, 'SUA_HOP_DONG', 'HO_SO', h.ho_so_id,
      'Cập nhật hợp đồng ' + so, 'THANH_CONG',
      { so: cu.so_hop_dong, gia_tri: cu.gia_tri, trang_thai: cu.trang_thai },
      { so: so, gia_tri: giaTri, trang_thai: truong.trang_thai });
    return { hop_dong_id: cu.hop_dong_id };
  }

  const id = 'HD_' + randomToken_(8);
  truong.hop_dong_id = id;
  truong.ngay_tao = nowIso_();
  truong.nguoi_tao = ctx.user_id;
  them_('HOP_DONG', truong);

  ghiNhatKy_(ctx, 'THEM_HOP_DONG', 'HO_SO', h.ho_so_id,
    'Thêm hợp đồng ' + so + ' — ' + dinhDangTien_(giaTri, truong.tien_te), 'THANH_CONG');
  return { hop_dong_id: id };
}

/** Ngày ký, hiệu lực và hết hạn phải theo đúng thứ tự thời gian. */
function kiemTraNgay_(p) {
  const ky = String(p.ngay_ky || '');
  const hl = String(p.ngay_hieu_luc || '');
  const hh = String(p.ngay_het_han || '');

  if (ky && hl && hl < ky) {
    throw new Error('Ngày hiệu lực không được trước ngày ký.');
  }
  if (hh && hl && hh < hl) {
    throw new Error('Ngày hết hạn không được trước ngày hiệu lực.');
  }
  if (hh && ky && hh < ky) {
    throw new Error('Ngày hết hạn không được trước ngày ký.');
  }
}

function xoaHopDong_(payload, ctx) {
  doiHoiQuyen_(ctx, 'hop_dong.sua');
  const c = layHopDong_(payload.hop_dong_id);

  const daTra = loc_('THANH_TOAN', function (t) {
    return String(t.hop_dong_id) === String(c.hop_dong_id)
      && t.trang_thai === 'DA_TT';
  });
  if (daTra.length) {
    throw new Error('Hợp đồng đã có ' + daTra.length + ' đợt thanh toán. '
      + 'Hãy chuyển sang trạng thái Đã huỷ thay vì xoá, để giữ dấu vết chi trả.');
  }

  capNhat_('HOP_DONG', c.hop_dong_id, {
    trang_thai: 'XOA', ngay_cap_nhat: nowIso_(), nguoi_cap_nhat: ctx.user_id
  });
  ghiNhatKy_(ctx, 'XOA_HOP_DONG', 'HO_SO', c.ho_so_id,
    'Xoá hợp đồng ' + c.so_hop_dong, 'THANH_CONG');
  return { da_xoa: true };
}

/* ================= Đợt thanh toán ================= */

function luuThanhToan_(payload, ctx) {
  doiHoiQuyen_(ctx, 'hop_dong.sua');
  const c = layHopDong_(payload.hop_dong_id);

  const soTien = Number(payload.so_tien || 0);
  if (!(soTien > 0)) throw new Error('Số tiền của đợt phải lớn hơn 0.');

  if (!TRANG_THAI_THANH_TOAN[payload.trang_thai || 'CHUA_TT']) {
    throw new Error('Trạng thái thanh toán không hợp lệ.');
  }

  const trangThai = String(payload.trang_thai || 'CHUA_TT');
  if (trangThai === 'DA_TT' && !payload.ngay_thuc_te) {
    throw new Error('Đợt đã thanh toán thì phải có ngày thực tế.');
  }

  // Cảnh báo khi tổng các đợt vượt giá trị hợp đồng.
  const khac = loc_('THANH_TOAN', function (t) {
    return String(t.hop_dong_id) === String(c.hop_dong_id)
      && t.trang_thai !== 'XOA' && t.trang_thai !== 'HUY'
      && String(t.id) !== String(payload.id || '');
  }).reduce(function (a, t) { return a + Number(t.so_tien || 0); }, 0);

  const vuot = (khac + soTien) - Number(c.gia_tri || 0);

  const truong = {
    hop_dong_id: c.hop_dong_id,
    dot: Number(payload.dot || 0),
    dien_giai: String(payload.dien_giai || ''),
    so_tien: soTien,
    ngay_du_kien: String(payload.ngay_du_kien || ''),
    ngay_thuc_te: String(payload.ngay_thuc_te || ''),
    trang_thai: trangThai,
    chung_tu_file_id: String(payload.chung_tu_file_id || ''),
    ngay_cap_nhat: nowIso_(),
    nguoi_cap_nhat: ctx.user_id
  };

  if (payload.id) {
    capNhat_('THANH_TOAN', payload.id, truong);
    ghiNhatKy_(ctx, 'SUA_THANH_TOAN', 'HO_SO', c.ho_so_id,
      'Sửa đợt ' + truong.dot + ' của hợp đồng ' + c.so_hop_dong, 'THANH_CONG');
    return { id: payload.id, vuot_gia_tri: vuot > 0 ? vuot : 0 };
  }

  if (!truong.dot) {
    const soDot = loc_('THANH_TOAN', function (t) {
      return String(t.hop_dong_id) === String(c.hop_dong_id) && t.trang_thai !== 'XOA';
    }).length;
    truong.dot = soDot + 1;
  }

  const id = 'TT_' + randomToken_(8);
  truong.id = id;
  truong.ngay_tao = nowIso_();
  truong.nguoi_tao = ctx.user_id;
  them_('THANH_TOAN', truong);

  ghiNhatKy_(ctx, 'THEM_THANH_TOAN', 'HO_SO', c.ho_so_id,
    'Thêm đợt ' + truong.dot + ' — ' + dinhDangTien_(soTien, c.tien_te)
    + ' cho hợp đồng ' + c.so_hop_dong, 'THANH_CONG');

  return { id: id, vuot_gia_tri: vuot > 0 ? vuot : 0 };
}

function xoaThanhToan_(payload, ctx) {
  doiHoiQuyen_(ctx, 'hop_dong.sua');
  const t = timMot_('THANH_TOAN', 'id', String(payload.id || ''));
  if (!t) throw new Error('Không tìm thấy đợt thanh toán.');

  const c = layHopDong_(t.hop_dong_id);
  capNhat_('THANH_TOAN', t.id, {
    trang_thai: 'XOA', ngay_cap_nhat: nowIso_(), nguoi_cap_nhat: ctx.user_id
  });
  ghiNhatKy_(ctx, 'XOA_THANH_TOAN', 'HO_SO', c.ho_so_id,
    'Xoá đợt ' + t.dot + ' của hợp đồng ' + c.so_hop_dong, 'THANH_CONG');
  return { da_xoa: true };
}

/* ================= Cảnh báo cho bảng điều khiển ================= */

function canhBaoHopDong_(ctx) {
  if (!co_(ctx, 'hop_dong.xem')) return null;

  const homNay = ngayIso_();
  const hanCanhBao = ngayIso_(new Date(new Date().getTime() + NGAY_CANH_BAO * 86400000));

  // Giới hạn đúng phạm vi của vai trò, để đơn vị chủ quản không thấy
  // số liệu hợp đồng của đơn vị khác.
  const pham = phamViHoSo_(ctx);
  let duocXem = null;
  if (pham.kieu !== 'TAT_CA') {
    duocXem = {};
    trongPhamVi_(pham, doiTacTheoHoSo_()).forEach(function (h) { duocXem[h.ho_so_id] = true; });
  }
  const trongTam = function (c) { return !duocXem || duocXem[c.ho_so_id]; };

  const hd = docAllRows_('HOP_DONG').filter(function (c) {
    return c.trang_thai === 'DANG_HIEU_LUC' && trongTam(c);
  });

  const sapHetHan = hd.filter(function (c) {
    return c.ngay_het_han && c.ngay_het_han >= homNay && c.ngay_het_han <= hanCanhBao;
  });
  const quaHan = hd.filter(function (c) {
    return c.ngay_het_han && c.ngay_het_han < homNay;
  });

  const hopDong = {};
  docAllRows_('HOP_DONG').forEach(function (c) { hopDong[c.hop_dong_id] = c; });

  const denHan = docAllRows_('THANH_TOAN').filter(function (t) {
    const c = hopDong[t.hop_dong_id];
    return t.trang_thai === 'CHUA_TT' && t.ngay_du_kien && t.ngay_du_kien <= hanCanhBao
      && c && trongTam(c);
  });

  const tenHoSo = {};
  docAllRows_('HO_SO').forEach(function (h) { tenHoSo[h.ho_so_id] = h.ten_chuong_trinh; });

  return {
    so_hop_dong: hd.length,
    tong_gia_tri: hd.reduce(function (a, c) { return a + Number(c.gia_tri || 0); }, 0),
    sap_het_han: sapHetHan.length,
    qua_han: quaHan.length,
    dot_den_han: denHan.length,
    tien_den_han: denHan.reduce(function (a, t) { return a + Number(t.so_tien || 0); }, 0),
    danh_sach_gap: sapHetHan.concat(quaHan)
      .sort(function (a, b) { return String(a.ngay_het_han).localeCompare(String(b.ngay_het_han)); })
      .slice(0, 5)
      .map(function (c) {
        return {
          hop_dong_id: c.hop_dong_id,
          so_hop_dong: c.so_hop_dong,
          ho_so_id: c.ho_so_id,
          ten_chuong_trinh: tenHoSo[c.ho_so_id] || '',
          ngay_het_han: c.ngay_het_han,
          qua_han: c.ngay_het_han < homNay
        };
      }),
    dot_gap: denHan
      .sort(function (a, b) { return String(a.ngay_du_kien).localeCompare(String(b.ngay_du_kien)); })
      .slice(0, 5)
      .map(function (t) {
        const c = hopDong[t.hop_dong_id] || {};
        return {
          id: t.id,
          hop_dong_id: t.hop_dong_id,
          so_hop_dong: c.so_hop_dong || '',
          dot: t.dot,
          so_tien: Number(t.so_tien || 0),
          ngay_du_kien: t.ngay_du_kien,
          qua_han: t.ngay_du_kien < homNay
        };
      })
  };
}

/* ================= Tiện ích ================= */

function layHopDong_(id) {
  const c = timMot_('HOP_DONG', 'hop_dong_id', String(id || ''));
  if (!c || c.trang_thai === 'XOA') throw new Error('Không tìm thấy hợp đồng.');
  return c;
}

function dinhDangTien_(so, tienTe) {
  const n = Math.round(Number(so || 0));
  const chu = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return chu + ' ' + (tienTe || 'VND');
}
