/**
 * CauHinh.gs — Cấu hình hệ thống, thư mục Drive, nhật ký, danh mục.
 */

/** Tham số không bao giờ gửi ra trình duyệt. */
const CAU_HINH_AN = [];

function layCauHinh_(payload, ctx) {
  doiHoiQuyen_(ctx, 'cau_hinh.xem');
  return docAllRows_('CAU_HINH')
    .filter(function (c) { return CAU_HINH_AN.indexOf(c.khoa) < 0; })
    .map(function (c) {
      return { khoa: c.khoa, gia_tri: c.gia_tri, mo_ta: c.mo_ta, ngay_cap_nhat: c.ngay_cap_nhat };
    });
}

function luuCauHinh_(payload, ctx) {
  doiHoiQuyen_(ctx, 'cau_hinh.sua');
  const thayDoi = payload.thay_doi || {};
  const daLuu = [];

  Object.keys(thayDoi).forEach(function (khoa) {
    const cu = timMot_('CAU_HINH', 'khoa', khoa);
    const moi = String(thayDoi[khoa]);
    if (!cu) {
      them_('CAU_HINH', {
        khoa: khoa, gia_tri: moi, mo_ta: '',
        ngay_cap_nhat: nowIso_(), nguoi_cap_nhat: ctx.user_id
      });
    } else {
      if (String(cu.gia_tri) === moi) return;
      capNhat_('CAU_HINH', khoa, {
        gia_tri: moi, ngay_cap_nhat: nowIso_(), nguoi_cap_nhat: ctx.user_id
      });
      ghiNhatKy_(ctx, 'SUA_CAU_HINH', 'CAU_HINH', khoa, khoa, 'THANH_CONG',
        { gia_tri: cu.gia_tri }, { gia_tri: moi });
    }
    CacheService.getScriptCache().remove('cfg_' + khoa);
    daLuu.push(khoa);
  });

  return { da_luu: daLuu };
}

/* ---------- Thư mục Drive ---------- */

/**
 * Kiểm tra một thư mục Drive: có tồn tại không, tài khoản chạy hệ thống
 * có quyền ghi không. Dùng khi admin dán ID hoặc chọn bằng Google Picker.
 */
function kiemTraThuMuc_(payload, ctx) {
  doiHoiQuyen_(ctx, 'cau_hinh.sua');
  const id = tachFolderId_(String(payload.id_hoac_link || '').trim());
  if (!id) throw new Error('Chưa có ID hoặc đường dẫn thư mục.');

  let folder;
  try {
    folder = DriveApp.getFolderById(id);
  } catch (e) {
    throw new Error('Không mở được thư mục này. Kiểm tra lại ID, hoặc chia sẻ thư mục '
      + 'cho tài khoản đang chạy hệ thống với quyền Người chỉnh sửa.');
  }

  // Thử tạo rồi xoá một thư mục con để chắc chắn có quyền ghi.
  let ghiDuoc = false;
  try {
    const thu = folder.createFolder('.kiem_tra_quyen_ghi');
    thu.setTrashed(true);
    ghiDuoc = true;
  } catch (e) {
    ghiDuoc = false;
  }

  return {
    id: folder.getId(),
    ten: folder.getName(),
    url: folder.getUrl(),
    ghi_duoc: ghiDuoc,
    so_muc_con: demMucCon_(folder)
  };
}

function luuThuMucGoc_(payload, ctx) {
  doiHoiQuyen_(ctx, 'cau_hinh.sua');
  const kq = kiemTraThuMuc_(payload, ctx);
  if (!kq.ghi_duoc) {
    throw new Error('Tài khoản hệ thống không có quyền ghi vào thư mục "' + kq.ten
      + '". Hãy chia sẻ thư mục với quyền Người chỉnh sửa rồi thử lại.');
  }

  luuCauHinh_({
    thay_doi: { DRIVE_ROOT_FOLDER_ID: kq.id, DRIVE_ROOT_FOLDER_TEN: kq.ten }
  }, ctx);

  ghiNhatKy_(ctx, 'DOI_THU_MUC_GOC', 'CAU_HINH', kq.id,
    'Đặt thư mục gốc: ' + kq.ten, 'THANH_CONG');
  return kq;
}

/** Chấp nhận cả ID trần lẫn đường dẫn đầy đủ của Drive. */
function tachFolderId_(s) {
  if (!s) return '';
  const m = s.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
  if (m) return m[1];
  const q = s.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (q) return q[1];
  return /^[a-zA-Z0-9_-]{10,}$/.test(s) ? s : '';
}

function demMucCon_(folder) {
  let n = 0;
  const it = folder.getFolders();
  while (it.hasNext() && n < 100) { it.next(); n++; }
  return n;
}

/* ---------- Nhật ký ---------- */

function xemNhatKy_(payload, ctx) {
  doiHoiQuyen_(ctx, 'nhat_ky.xem');

  const trang = Math.max(1, Number(payload.trang || 1));
  const moiTrang = Math.min(200, Math.max(10, Number(payload.moi_trang || 50)));
  const tuKhoa = String(payload.tu_khoa || '').toLowerCase().trim();
  const locHanhDong = String(payload.hanh_dong || '');

  const ten = {};
  docAllRows_('NGUOI_DUNG').forEach(function (u) { ten[u.user_id] = u.ho_ten; });

  // Giới hạn phạm vi đọc để màn hình nhật ký không chậm dần theo năm tháng.
  // Cần tra cứu xa hơn thì mở thẳng tab NHAT_KY trong file Google Sheet.
  const SOI_TOI_DA = 8000;
  let ds = docDongCuoi_('NHAT_KY', SOI_TOI_DA);
  const nguon = ds;

  if (locHanhDong) {
    ds = ds.filter(function (r) { return r.hanh_dong === locHanhDong; });
  }
  if (tuKhoa) {
    ds = ds.filter(function (r) {
      return (String(r.chi_tiet) + ' ' + String(r.hanh_dong) + ' ' + String(ten[r.user_id] || ''))
        .toLowerCase().indexOf(tuKhoa) >= 0;
    });
  }

  ds.sort(function (a, b) { return new Date(b.thoi_gian) - new Date(a.thoi_gian); });

  const tong = ds.length;
  const batDau = (trang - 1) * moiTrang;

  return {
    tong: tong,
    trang: trang,
    so_trang: Math.max(1, Math.ceil(tong / moiTrang)),
    gioi_han_soi: SOI_TOI_DA,
    hanh_dong_co: [...new Set(nguon.map(function (r) { return r.hanh_dong; }))].sort(),
    dong: ds.slice(batDau, batDau + moiTrang).map(function (r) {
      return {
        thoi_gian: r.thoi_gian,
        nguoi: ten[r.user_id] || r.user_id || '—',
        hanh_dong: r.hanh_dong,
        doi_tuong: r.doi_tuong_id,
        chi_tiet: r.chi_tiet,
        ip: r.ip,
        ket_qua: r.ket_qua
      };
    })
  };
}

/* ---------- Danh mục ---------- */

function layDanhMuc_(payload, ctx) {
  const ds = docAllRows_('DANH_MUC').filter(function (d) {
    return d.dang_dung === true || String(d.dang_dung).toUpperCase() === 'TRUE';
  });
  const nhom = {};
  ds.sort(function (a, b) { return Number(a.thu_tu) - Number(b.thu_tu); })
    .forEach(function (d) {
      (nhom[d.loai_danh_muc] = nhom[d.loai_danh_muc] || []).push({ ma: d.ma, ten: d.ten });
    });
  return nhom;
}

/* ---------- Tình trạng hệ thống ---------- */

function tinhTrangHeThong_(payload, ctx) {
  doiHoiQuyen_(ctx, 'cau_hinh.xem');
  const thuMucId = getCauHinh('DRIVE_ROOT_FOLDER_ID', '');
  let thuMuc = null;
  if (thuMucId) {
    try {
      const f = DriveApp.getFolderById(thuMucId);
      thuMuc = { id: f.getId(), ten: f.getName(), url: f.getUrl() };
    } catch (e) {
      thuMuc = { id: thuMucId, ten: '(không mở được)', url: '' };
    }
  }

  const conLai = MailApp.getRemainingDailyQuota();
  return {
    email_con_lai: conLai,
    email_nguong_canh_bao: Number(getCauHinh('QUOTA_MAIL_CANH_BAO', '20')),
    thu_muc_goc: thuMuc,
    che_do_kiem_tra: getCauHinh('CHE_DO_KIEM_TRA', 'TAT') === 'BAT',
    so_nguoi_dung: docAllRows_('NGUOI_DUNG').length,
    so_don_vi: docAllRows_('DON_VI').length,
    so_ho_so: docAllRows_('HO_SO').length,
    phien_dang_mo: loc_('PHIEN', function (p) {
      return p.trang_thai === 'HOAT_DONG' && new Date(p.het_han) > new Date();
    }).length,
    thiet_bi_tin_cay: loc_('PHIEN', function (p) {
      return p.trang_thai === 'TIN_CAY' && new Date(p.tin_cay_den) > new Date();
    }).length
  };
}
