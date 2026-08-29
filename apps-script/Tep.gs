/**
 * Tep.gs — Tệp đính kèm của hồ sơ.
 *
 * Ba đường đưa tệp vào hệ thống:
 *   1. Tải trực tiếp, tệp nhỏ   — trình duyệt gửi base64 qua Vercel, Apps Script ghi vào Drive.
 *   2. Tải theo phiên, tệp lớn  — Apps Script mở phiên tải lên, trình duyệt gửi thẳng tới Google.
 *   3. Dán link Drive           — dùng cho video ở kho 20 TB và cho tệp đã có sẵn.
 *
 * Video luôn đi đường thứ ba: hệ thống không chứa video.
 */

const LOAI_TEP = {
  DOC: { ten: 'Tài liệu', thu_muc: 'Kịch bản - Tài liệu' },
  HOP_DONG: { ten: 'Hợp đồng', thu_muc: 'Hợp đồng' },
  AUDIO: { ten: 'Audio', thu_muc: 'Audio - Hình ảnh' },
  IMAGE: { ten: 'Hình ảnh', thu_muc: 'Audio - Hình ảnh' },
  VIDEO: { ten: 'Video', thu_muc: null }
};

/**
 * Ngưỡng để trình duyệt chọn đường tải. Trên mức này phải dùng phiên tải lên.
 * Đặt ở 3 MB vì base64 làm phình dữ liệu thêm một phần ba, mà hàm serverless
 * trên Vercel chỉ nhận thân yêu cầu tối đa 4,5 MB.
 */
const NGUONG_TRUC_TIEP = 3 * 1024 * 1024;

/** Trần dung lượng một tệp tải vào Drive của hệ thống. */
const TRAN_MOT_TEP = 512 * 1024 * 1024;

/* ================= Danh sách ================= */

function danhSachTep_(payload, ctx) {
  const h = layHoSo_(payload.ho_so_id);
  kiemTraDuocXem_(h, ctx);

  const laDoiTac = ctx.nhom === 'DOI_TAC';
  const tenNguoi = {};
  docAllRows_('NGUOI_DUNG').forEach(function (u) { tenNguoi[u.user_id] = u.ho_ten; });

  let ds = loc_('TEP_DINH_KEM', function (t) {
    return String(t.ho_so_id) === String(h.ho_so_id) && t.thay_the_cho !== 'DA_XOA';
  });

  // Đối tác chỉ thấy tệp được đánh dấu cho họ xem.
  if (laDoiTac) {
    ds = ds.filter(function (t) {
      return t.cho_doi_tac_xem === true || String(t.cho_doi_tac_xem).toUpperCase() === 'TRUE';
    });
  }

  ds.sort(function (a, b) { return new Date(b.ngay_tao) - new Date(a.ngay_tao); });

  return {
    duoc_tai_len: co_(ctx, 'tep.tai_len') && h.trang_thai !== 'LUU_TRU',
    duoc_xoa: co_(ctx, 'tep.xoa') && h.trang_thai !== 'LUU_TRU',
    nguong_truc_tiep: NGUONG_TRUC_TIEP,
    tep: ds.map(function (t) {
      return {
        file_id: t.file_id,
        loai: t.loai,
        ten_loai: (LOAI_TEP[t.loai] || {}).ten || t.loai,
        nguon: t.nguon,
        ten_hien_thi: t.ten_hien_thi,
        drive_file_id: t.drive_file_id,
        url_xem: urlXem_(t.drive_file_id),
        url_nhung: urlNhung_(t.drive_file_id),
        mime: t.mime,
        dung_luong: Number(t.dung_luong || 0),
        thoi_luong_giay: Number(t.thoi_luong_giay || 0),
        mo_ta: t.mo_ta,
        cho_doi_tac_xem: t.cho_doi_tac_xem === true || String(t.cho_doi_tac_xem).toUpperCase() === 'TRUE',
        nhay_cam: t.nhay_cam === true || String(t.nhay_cam).toUpperCase() === 'TRUE',
        link_con_song: t.link_con_song === '' || t.link_con_song === true
          || String(t.link_con_song).toUpperCase() === 'TRUE',
        lan_kiem_tra_cuoi: t.lan_kiem_tra_cuoi,
        nguoi_tai: tenNguoi[t.nguoi_tai] || t.nguoi_tai || '',
        ngay_tao: t.ngay_tao
      };
    })
  };
}

/* ================= Đường 1: tải trực tiếp ================= */

function taiLenTep_(payload, ctx) {
  const h = chuanBiTaiLen_(payload, ctx);
  const loai = kiemTraLoai_(payload.loai);

  const ten = lamSachTenTep_(payload.ten);
  const b64 = String(payload.du_lieu || '');
  if (!b64) throw new Error('Không nhận được nội dung tệp.');

  let blob;
  try {
    blob = Utilities.newBlob(Utilities.base64Decode(b64), String(payload.mime || 'application/octet-stream'), ten);
  } catch (e) {
    throw new Error('Nội dung tệp không đọc được. Vui lòng thử tải lại.');
  }

  const kichThuoc = blob.getBytes().length;
  if (kichThuoc > NGUONG_TRUC_TIEP * 2) {
    throw new Error('Tệp quá lớn cho cách tải này. Trình duyệt cần dùng phiên tải lên.');
  }

  const thuMuc = thuMucDich_(h, loai);
  const f = thuMuc.createFile(blob);

  return ghiSoTep_({
    ho_so: h, loai: loai, nguon: 'DRIVE_HE_THONG',
    ten: f.getName(), drive_file_id: f.getId(),
    mime: f.getMimeType(), dung_luong: kichThuoc,
    mo_ta: payload.mo_ta, cho_doi_tac_xem: payload.cho_doi_tac_xem
  }, ctx);
}

/* ================= Đường 2: phiên tải lên ================= */

/**
 * Mở một phiên tải lên của Google Drive và trả về địa chỉ phiên.
 * Trình duyệt gửi từng khối thẳng tới địa chỉ đó, không đi qua Apps Script
 * lẫn Vercel, nên không vướng hạn mức của cả hai.
 */
function moPhienTaiLen_(payload, ctx) {
  const h = chuanBiTaiLen_(payload, ctx);
  const loai = kiemTraLoai_(payload.loai);
  const kichThuoc = Number(payload.kich_thuoc || 0);

  if (!(kichThuoc > 0)) throw new Error('Thiếu dung lượng tệp.');
  if (kichThuoc > TRAN_MOT_TEP) {
    throw new Error('Tệp vượt quá ' + dinhDangDungLuong_(TRAN_MOT_TEP)
      + '. Hãy tải lên Drive rồi dán link vào hồ sơ.');
  }

  const thuMuc = thuMucDich_(h, loai);
  const ten = lamSachTenTep_(payload.ten);

  const res = UrlFetchApp.fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',
    {
      method: 'post',
      contentType: 'application/json; charset=UTF-8',
      headers: {
        Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
        'X-Upload-Content-Type': String(payload.mime || 'application/octet-stream'),
        'X-Upload-Content-Length': String(kichThuoc)
      },
      payload: JSON.stringify({ name: ten, parents: [thuMuc.getId()] }),
      muteHttpExceptions: true
    }
  );

  if (res.getResponseCode() >= 300) {
    throw new Error('Google không mở được phiên tải lên (mã ' + res.getResponseCode() + '). '
      + 'Hãy thử lại, hoặc tải tệp lên Drive rồi dán link.');
  }

  // Tên header không cố định hoa thường giữa các lần gọi.
  const headers = res.getAllHeaders();
  const diaChi = headers.Location || headers.location;
  if (!diaChi) {
    throw new Error('Google không trả về địa chỉ phiên tải lên. '
      + 'Hãy tải tệp lên Drive rồi dán link vào hồ sơ.');
  }

  return { dia_chi_phien: diaChi, ten: ten };
}

/** Ghi vào sổ sau khi trình duyệt tải xong qua phiên. */
function hoanTatTaiLen_(payload, ctx) {
  const h = chuanBiTaiLen_(payload, ctx);
  const loai = kiemTraLoai_(payload.loai);

  let f;
  try {
    f = DriveApp.getFileById(String(payload.drive_file_id || ''));
  } catch (e) {
    throw new Error('Không tìm thấy tệp vừa tải lên trên Drive.');
  }

  return ghiSoTep_({
    ho_so: h, loai: loai, nguon: 'DRIVE_HE_THONG',
    ten: f.getName(), drive_file_id: f.getId(),
    mime: f.getMimeType(), dung_luong: f.getSize(),
    mo_ta: payload.mo_ta, cho_doi_tac_xem: payload.cho_doi_tac_xem
  }, ctx);
}

/* ================= Đường 3: dán link ================= */

function themLinkTep_(payload, ctx) {
  const h = chuanBiTaiLen_(payload, ctx);
  const loai = kiemTraLoai_(payload.loai);

  const id = tachFileId_(String(payload.link || '').trim());
  if (!id) {
    throw new Error('Đường dẫn không hợp lệ. Hãy dán link chia sẻ của Google Drive, '
      + 'ví dụ https://drive.google.com/file/d/…/view');
  }

  if (timMot_('TEP_DINH_KEM', 'drive_file_id', id)) {
    const cu = timMot_('TEP_DINH_KEM', 'drive_file_id', id);
    if (String(cu.ho_so_id) === String(h.ho_so_id)) {
      throw new Error('Tệp này đã có trong hồ sơ.');
    }
  }

  // Đọc thông tin thật từ Drive thay vì tin vào chuỗi người dùng dán.
  let f;
  try {
    f = DriveApp.getFileById(id);
  } catch (e) {
    throw new Error('Không mở được tệp này. Kiểm tra lại quyền chia sẻ: '
      + 'tệp phải ở chế độ “bất kỳ ai có link” hoặc được chia sẻ cho tài khoản chạy hệ thống.');
  }

  return ghiSoTep_({
    ho_so: h, loai: loai, nguon: 'LINK_NGOAI',
    ten: String(payload.ten || '').trim() || f.getName(),
    drive_file_id: id, mime: f.getMimeType(), dung_luong: f.getSize(),
    mo_ta: payload.mo_ta, cho_doi_tac_xem: payload.cho_doi_tac_xem,
    nhay_cam: payload.nhay_cam
  }, ctx);
}

/* ================= Sửa & xoá ================= */

function capNhatTep_(payload, ctx) {
  const t = layTep_(payload.file_id);
  const h = layHoSo_(t.ho_so_id);
  doiHoiQuyen_(ctx, 'tep.tai_len');
  kiemTraDuocSua_(h, ctx);

  const patch = {};
  if (payload.mo_ta !== undefined) patch.mo_ta = String(payload.mo_ta);
  if (payload.ten_hien_thi !== undefined) {
    const ten = lamSachTenTep_(payload.ten_hien_thi);
    if (ten) patch.ten_hien_thi = ten;
  }
  if (payload.cho_doi_tac_xem !== undefined) patch.cho_doi_tac_xem = !!payload.cho_doi_tac_xem;
  if (payload.nhay_cam !== undefined) patch.nhay_cam = !!payload.nhay_cam;

  if (!Object.keys(patch).length) return { da_luu: false };

  capNhat_('TEP_DINH_KEM', t.file_id, patch);

  if ('cho_doi_tac_xem' in patch) {
    dongBoQuyenTep_(t, patch.cho_doi_tac_xem);
  }

  ghiNhatKy_(ctx, 'SUA_TEP', 'HO_SO', h.ho_so_id,
    'Cập nhật tệp ' + t.ten_hien_thi, 'THANH_CONG', null, patch);
  return { da_luu: true };
}

function xoaTep_(payload, ctx) {
  const t = layTep_(payload.file_id);
  const h = layHoSo_(t.ho_so_id);
  doiHoiQuyen_(ctx, 'tep.xoa');
  kiemTraDuocSua_(h, ctx);

  // Tệp của hệ thống thì chuyển vào thùng rác Drive; link ngoài chỉ gỡ khỏi hồ sơ.
  let daBoVaoThungRac = false;
  if (t.nguon === 'DRIVE_HE_THONG' && t.drive_file_id) {
    try {
      dongBoQuyenTep_(t, false);
      DriveApp.getFileById(t.drive_file_id).setTrashed(true);
      daBoVaoThungRac = true;
    } catch (e) {
      console.error('Không bỏ được tệp vào thùng rác: ' + e.message);
    }
  }

  xoaDong_('TEP_DINH_KEM', t.file_id);
  ghiNhatKy_(ctx, 'XOA_TEP', 'HO_SO', h.ho_so_id,
    'Gỡ tệp ' + t.ten_hien_thi + (daBoVaoThungRac ? ' (đã bỏ vào thùng rác Drive)' : ''),
    'THANH_CONG');
  return { da_xoa: true, da_bo_vao_thung_rac: daBoVaoThungRac };
}

/* ================= Kiểm tra link còn sống ================= */

/**
 * Kiểm tra các tệp dạng link ngoài xem còn mở được không.
 * Kho video nằm ở tài khoản Drive khác, nên tệp có thể bị xoá hoặc đổi quyền
 * mà hệ thống không hay biết.
 */
function kiemTraLinkTep_(payload, ctx) {
  doiHoiQuyen_(ctx, 'tep.xem');

  let ds = loc_('TEP_DINH_KEM', function (t) { return t.nguon === 'LINK_NGOAI'; });
  if (payload && payload.ho_so_id) {
    ds = ds.filter(function (t) { return String(t.ho_so_id) === String(payload.ho_so_id); });
  }

  let song = 0;
  const hong = [];

  ds.forEach(function (t) {
    let ok = true;
    try {
      DriveApp.getFileById(t.drive_file_id).getName();
    } catch (e) {
      ok = false;
    }
    capNhat_('TEP_DINH_KEM', t.file_id, {
      link_con_song: ok, lan_kiem_tra_cuoi: nowIso_()
    });
    if (ok) song++;
    else hong.push({ file_id: t.file_id, ho_so_id: t.ho_so_id, ten: t.ten_hien_thi });
  });

  ghiNhatKy_(ctx, 'KIEM_TRA_LINK', 'TEP_DINH_KEM', '',
    'Kiểm tra ' + ds.length + ' link, hỏng ' + hong.length, 'THANH_CONG');

  return { da_kiem: ds.length, con_song: song, hong: hong };
}

/** Chạy hằng đêm bằng trigger để phát hiện link video hỏng. */
function kiemTraLinkHangDem() {
  const ctx = { user_id: 'HE_THONG', nhom: 'ADMIN' };
  const kq = kiemTraLinkTep_({}, ctx);
  console.log('Kiểm tra link: ' + kq.da_kiem + ' tệp, hỏng ' + kq.hong.length);

  if (!kq.hong.length) return kq;

  try {
    if (MailApp.getRemainingDailyQuota() <= 0) return kq;
    const admin = timMot_('NGUOI_DUNG', 'username', 'admin');
    if (!admin || !admin.email) return kq;

    const dong = kq.hong.map(function (t) {
      return '<li>' + thoat_(t.ho_so_id) + ' — ' + thoat_(t.ten) + '</li>';
    }).join('');

    MailApp.sendEmail({
      to: admin.email,
      subject: 'Có ' + kq.hong.length + ' link tệp không mở được',
      htmlBody: khungMail_('Link tệp hỏng',
        '<p style="margin:0 0 14px">Các tệp sau đã không còn mở được. '
        + 'Có thể tệp đã bị xoá hoặc đổi quyền chia sẻ ở kho lưu trữ.</p>'
        + '<ul style="margin:0;padding-left:20px">' + dong + '</ul>'),
      body: kq.hong.length + ' link tep khong mo duoc.',
      name: 'Ban Kế hoạch – Tài chính HTV'
    });
  } catch (e) {
    console.error('Không gửi được thư báo link hỏng: ' + e.message);
  }
  return kq;
}

/* ================= Quyền xem tệp trên Drive ================= */

/**
 * Đồng bộ quyền chia sẻ của một tệp trên Drive theo cờ "cho đối tác xem".
 *
 * Đối tác quét mã QR không đăng nhập Google, nên tệp để riêng tư sẽ hiện màn hình
 * "Đăng nhập vào Tài khoản Google" thay vì nội dung. Bật cờ thì đặt tệp sang chế độ
 * ai có link cũng xem được.
 *
 * Việc đối tác có tải tệp về máy được hay không do tham số DOI_TAC_DUOC_TAI quyết định:
 * BAT thì cho tải, TAT thì chặn tải, in và sao chép — chỉ đọc được qua trình xem nhúng.
 *
 * Tệp dạng link ngoài nằm ở tài khoản Drive khác nên hệ thống không đổi quyền được;
 * quyền của chúng do bên kho video quyết định.
 */
function dongBoQuyenTep_(t, choXem) {
  if (t.nguon !== 'DRIVE_HE_THONG' || !t.drive_file_id) return { doi: false };

  try {
    const f = DriveApp.getFileById(t.drive_file_id);
    if (choXem) {
      f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      chanTaiXuong_(t.drive_file_id, getCauHinh('DOI_TAC_DUOC_TAI', 'BAT') !== 'BAT');
    } else {
      f.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    }
    return { doi: true };
  } catch (e) {
    console.error('Không đổi được quyền tệp ' + t.drive_file_id + ': ' + e.message);
    return { doi: false, loi: e.message };
  }
}

/**
 * Bật hoặc tắt "người xem không được tải xuống, in và sao chép".
 * DriveApp không có hàm cho việc này nên phải gọi thẳng Drive API.
 */
function chanTaiXuong_(driveFileId, chan) {
  const res = UrlFetchApp.fetch(
    'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(driveFileId)
    + '?supportsAllDrives=true',
    {
      method: 'patch',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      payload: JSON.stringify({ copyRequiresWriterPermission: !!chan }),
      muteHttpExceptions: true
    }
  );
  if (res.getResponseCode() >= 300) {
    console.error('Không đặt được cờ chặn tải xuống: ' + res.getContentText().slice(0, 200));
  }
}

/**
 * Rà lại toàn bộ tệp của hệ thống và đặt quyền cho khớp với cờ hiện tại.
 * Dùng khi nghi ngờ quyền trên Drive bị lệch so với dữ liệu trong Sheet.
 */
function raSoatQuyenTep() {
  let doi = 0, boQua = 0;
  docAllRows_('TEP_DINH_KEM').forEach(function (t) {
    if (t.nguon !== 'DRIVE_HE_THONG') { boQua++; return; }
    const cho = t.cho_doi_tac_xem === true || String(t.cho_doi_tac_xem).toUpperCase() === 'TRUE';
    if (dongBoQuyenTep_(t, cho).doi) doi++;
  });
  const tb = 'Đã đồng bộ quyền cho ' + doi + ' tệp, bỏ qua ' + boQua + ' tệp link ngoài.';
  console.log(tb);
  return tb;
}

/* ================= Tiện ích nội bộ ================= */

function chuanBiTaiLen_(payload, ctx) {
  doiHoiQuyen_(ctx, 'tep.tai_len');
  const h = layHoSo_(payload.ho_so_id);
  kiemTraDuocSua_(h, ctx);
  return h;
}

function kiemTraLoai_(loai) {
  const l = String(loai || 'DOC').toUpperCase();
  if (!LOAI_TEP[l]) throw new Error('Loại tệp không hợp lệ.');
  return l;
}

/** Thư mục con của hồ sơ ứng với loại tệp. Video không có thư mục vì không tải lên. */
function thuMucDich_(h, loai) {
  if (loai === 'VIDEO') {
    throw new Error('Video không tải lên hệ thống. Hãy tải lên kho video rồi dán link vào hồ sơ.');
  }

  let goc;
  try {
    goc = DriveApp.getFolderById(h.drive_folder_id);
  } catch (e) {
    // Hồ sơ cũ chưa có thư mục, hoặc thư mục đã bị xoá: dựng lại.
    const id = taoThuMucHoSo_(h.ho_so_id, (h.ngay_phat_song || h.ngay_tao || '').slice(0, 4));
    capNhat_('HO_SO', h.ho_so_id, { drive_folder_id: id });
    goc = DriveApp.getFolderById(id);
  }

  return thuMucCon_(goc, LOAI_TEP[loai].thu_muc);
}

function ghiSoTep_(t, ctx) {
  const fileId = uuid_();
  them_('TEP_DINH_KEM', {
    file_id: fileId,
    ho_so_id: t.ho_so.ho_so_id,
    hop_dong_id: '',
    loai: t.loai,
    nguon: t.nguon,
    ten_hien_thi: t.ten,
    drive_file_id: t.drive_file_id,
    mime: t.mime || '',
    dung_luong: Number(t.dung_luong || 0),
    thoi_luong_giay: 0,
    phien_ban: 1,
    thay_the_cho: '',
    mo_ta: String(t.mo_ta || ''),
    cho_doi_tac_xem: !!t.cho_doi_tac_xem,
    nhay_cam: !!t.nhay_cam,
    lan_kiem_tra_cuoi: nowIso_(),
    link_con_song: true,
    ngay_tao: nowIso_(),
    nguoi_tai: ctx.user_id
  });

  // Đặt quyền trên Drive cho khớp với cờ, để đối tác xem được ngay.
  if (t.cho_doi_tac_xem) {
    dongBoQuyenTep_({ nguon: t.nguon, drive_file_id: t.drive_file_id }, true);
  }

  ghiNhatKy_(ctx, 'THEM_TEP', 'HO_SO', t.ho_so.ho_so_id,
    'Thêm ' + (LOAI_TEP[t.loai] || {}).ten + ': ' + t.ten
    + ' (' + (t.nguon === 'LINK_NGOAI' ? 'link ngoài' : dinhDangDungLuong_(t.dung_luong)) + ')',
    'THANH_CONG');

  return { file_id: fileId, ten: t.ten, drive_file_id: t.drive_file_id };
}

function layTep_(id) {
  const t = timMot_('TEP_DINH_KEM', 'file_id', String(id || ''));
  if (!t) throw new Error('Không tìm thấy tệp.');
  return t;
}

/** Bỏ ký tự không hợp lệ trong tên tệp và chặn tên quá dài. */
function lamSachTenTep_(ten) {
  return String(ten || '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150);
}

/** Chấp nhận nhiều dạng link Drive khác nhau, và cả ID trần. */
function tachFileId_(s) {
  if (!s) return '';
  const m1 = s.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
  if (m1) return m1[1];
  const m2 = s.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (m2) return m2[1];
  const m3 = s.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  if (m3) return m3[1];
  return /^[a-zA-Z0-9_-]{20,}$/.test(s.trim()) ? s.trim() : '';
}

function urlXem_(driveFileId) {
  return driveFileId ? 'https://drive.google.com/file/d/' + driveFileId + '/view' : '';
}

function urlNhung_(driveFileId) {
  return driveFileId ? 'https://drive.google.com/file/d/' + driveFileId + '/preview' : '';
}

/** Đường dẫn tải thẳng tệp về máy. Chỉ mở được khi tệp đang ở chế độ ai có link cũng xem. */
function urlTai_(driveFileId) {
  return driveFileId
    ? 'https://drive.google.com/uc?export=download&id=' + driveFileId
    : '';
}

function dinhDangDungLuong_(byte) {
  const n = Number(byte || 0);
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
  return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}
