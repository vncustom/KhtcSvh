/**
 * NhapExcel.gs — Nhập nhiều hồ sơ từ phiếu Excel của đơn vị gửi đến.
 *
 * Hai bước:
 *   1. docFileExcel  đọc file, đoán đơn vị và cột, trả về bản xem trước để đối chiếu.
 *   2. taoHangLoat   tạo hồ sơ thật từ những dòng đã được xác nhận.
 *
 * Apps Script không đọc thẳng được .xlsx, nên file được chuyển tạm thành
 * Google Sheets rồi xoá ngay sau khi đọc xong.
 */

/** Tên cột trong phiếu, đã bỏ dấu và khoảng trắng, ánh xạ sang trường của hồ sơ. */
const COT_PHIEU = {
  id: 'ma_don_vi',
  ma: 'ma_don_vi',
  machuongtrinh: 'ma_don_vi',
  tenchuongtrinh: 'ten_chuong_trinh',
  theloai: 'the_loai',
  ngayphatsong: 'ngay_phat_song',
  ngayphat: 'ngay_phat_song',
  kenhphatsong: 'kenh',
  kenh: 'kenh',
  giophatsong: 'gio_phat_song',
  gio: 'gio_phat_song',
  thoiluongct: 'thoi_luong',
  thoiluong: 'thoi_luong',
  thoiluongchuongtrinh: 'thoi_luong',
  noidungdenghi: 'mo_ta',
  noidung: 'mo_ta',
  ghichu: 'mo_ta',
  tenfile: 'ten_file',
  link: 'link'
};

const TOI_DA_MOT_LAN = 300;

/* ================= Bước 1: đọc file ================= */

function docFileExcel_(payload, ctx) {
  doiHoiQuyen_(ctx, 'ho_so.them');

  const b64 = String(payload.du_lieu || '');
  if (!b64) throw new Error('Không nhận được nội dung file.');

  const blob = Utilities.newBlob(
    Utilities.base64Decode(b64),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    String(payload.ten || 'phieu.xlsx')
  );

  const tamId = xlsxSangSheet_(blob);
  let bang;
  try {
    bang = SpreadsheetApp.openById(tamId).getSheets()[0].getDataRange().getValues();
  } finally {
    try { DriveApp.getFileById(tamId).setTrashed(true); } catch (e) { /* dọn được thì tốt */ }
  }

  return phanTichBang_(bang, ctx);
}

/** Chuyển .xlsx thành Google Sheets tạm trên Drive, trả về id. */
function xlsxSangSheet_(blob) {
  const bien = 'htv' + randomToken_(12);
  const meta = JSON.stringify({
    name: 'TAM_NHAP_' + randomToken_(6),
    mimeType: 'application/vnd.google-apps.spreadsheet'
  });

  const truoc = Utilities.newBlob(
    '--' + bien + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + meta
    + '\r\n--' + bien + '\r\nContent-Type: ' + blob.getContentType() + '\r\n\r\n'
  ).getBytes();
  const sau = Utilities.newBlob('\r\n--' + bien + '--').getBytes();

  const res = UrlFetchApp.fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'post',
      contentType: 'multipart/related; boundary=' + bien,
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      payload: truoc.concat(blob.getBytes(), sau),
      muteHttpExceptions: true
    }
  );

  if (res.getResponseCode() >= 300) {
    throw new Error('Không đọc được file Excel (mã ' + res.getResponseCode() + '). '
      + 'Hãy kiểm tra file có đúng định dạng .xlsx không.');
  }
  return JSON.parse(res.getContentText()).id;
}

/* ================= Phân tích nội dung phiếu ================= */

function phanTichBang_(bang, ctx) {
  const viTri = timDongTieuDe_(bang);
  if (viTri < 0) {
    throw new Error('Không tìm thấy dòng tiêu đề. Phiếu cần có cột "TÊN CHƯƠNG TRÌNH".');
  }

  const anhXa = anhXaCot_(bang[viTri]);
  const donVi = doanDonVi_(bang, viTri);
  const danhMuc = layDanhMuc_({}, ctx);

  const dong = [];
  const canhBaoChung = {};

  for (let r = viTri + 1; r < bang.length && dong.length < TOI_DA_MOT_LAN; r++) {
    const tho = {};
    Object.keys(anhXa).forEach(function (truong) {
      tho[truong] = bang[r][anhXa[truong]];
    });

    const ten = chuoi_(tho.ten_chuong_trinh);
    if (!ten) continue;   // bỏ dòng trống và dòng ký tên ở cuối phiếu

    const canhBao = [];
    const giay = doiThoiLuong_(tho.thoi_luong);
    if (!giay) canhBao.push('Thiếu thời lượng');

    const kenh = doiDanhMuc_(danhMuc.KENH, chuoi_(tho.kenh));
    if (chuoi_(tho.kenh) && !kenh.khop) {
      canhBao.push('Kênh "' + chuoi_(tho.kenh) + '" chưa có trong danh mục');
      canhBaoChung['kenh:' + chuoi_(tho.kenh)] = true;
    }

    const theLoai = doiDanhMuc_(danhMuc.THE_LOAI, chuoi_(tho.the_loai));
    if (chuoi_(tho.the_loai) && !theLoai.khop) {
      canhBaoChung['the_loai:' + chuoi_(tho.the_loai)] = true;
    }

    const ngay = doiNgay_(tho.ngay_phat_song);
    if (chuoi_(tho.ngay_phat_song) && !ngay) canhBao.push('Ngày phát sóng không đọc được');

    const link = chuoi_(tho.link);
    if (link && !tachFileId_(link)) canhBao.push('Link không phải đường dẫn Drive');

    dong.push({
      dong_excel: r + 1,
      ma_don_vi: chuoi_(tho.ma_don_vi),
      ten_chuong_trinh: ten,
      the_loai: theLoai.gia_tri,
      the_loai_goc: chuoi_(tho.the_loai),
      kenh: kenh.gia_tri,
      kenh_goc: chuoi_(tho.kenh),
      ngay_phat_song: ngay,
      gio_phat_song: doiGio_(tho.gio_phat_song),
      thoi_luong_giay: giay,
      mo_ta: chuoi_(tho.mo_ta),
      ten_file: chuoi_(tho.ten_file),
      link: link,
      canh_bao: canhBao
    });
  }

  return {
    don_vi_doan_duoc: donVi,
    cot_nhan_dien: Object.keys(anhXa),
    cot_thieu: ['ten_chuong_trinh', 'thoi_luong'].filter(function (c) { return !(c in anhXa); }),
    tong_dong: dong.length,
    cham_nguong: dong.length >= TOI_DA_MOT_LAN,
    gia_tri_la: Object.keys(canhBaoChung),
    dong: dong
  };
}

/** Dòng tiêu đề là dòng đầu tiên có ô chứa "TÊN CHƯƠNG TRÌNH". */
function timDongTieuDe_(bang) {
  for (let r = 0; r < Math.min(bang.length, 30); r++) {
    for (let c = 0; c < bang[r].length; c++) {
      if (khongDau_(bang[r][c]).indexOf('tenchuongtrinh') >= 0) return r;
    }
  }
  return -1;
}

function anhXaCot_(hangTieuDe) {
  const ra = {};
  hangTieuDe.forEach(function (o, c) {
    const khoa = khongDau_(o);
    if (!khoa) return;
    const truong = COT_PHIEU[khoa];
    // Cột đầu tiên khớp được giữ lại, để cột trùng tên phía sau không ghi đè.
    if (truong && !(truong in ra)) ra[truong] = c;
  });
  return ra;
}

/** Tìm dòng "ĐƠN VỊ: ..." ở phần đầu phiếu rồi đối chiếu với danh sách đơn vị. */
function doanDonVi_(bang, dongTieuDe) {
  let ten = '';
  for (let r = 0; r < dongTieuDe; r++) {
    for (let c = 0; c < bang[r].length; c++) {
      const o = String(bang[r][c] || '');
      const m = o.match(/ĐƠN\s*VỊ\s*:\s*(.+)/i);
      if (m) { ten = m[1].trim(); break; }
    }
    if (ten) break;
  }
  if (!ten) return null;

  const goc = khongDau_(ten);
  const ds = docAllRows_('DON_VI').filter(function (d) { return d.loai === 'NOI_BO'; });

  for (let i = 0; i < ds.length; i++) {
    if (khongDau_(ds[i].ten) === goc) {
      return { don_vi_id: ds[i].don_vi_id, ten: ds[i].ten, ten_trong_file: ten, khop: true };
    }
  }
  return { don_vi_id: '', ten: '', ten_trong_file: ten, khop: false };
}

/* ---------- Đọc từng kiểu giá trị ---------- */

function chuoi_(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy');
  return String(v).trim();
}

/** "13:44" là 13 phút 44 giây; "1:05:30" là 1 giờ 5 phút 30 giây. */
function doiThoiLuong_(v) {
  if (v instanceof Date) {
    return v.getHours() * 3600 + v.getMinutes() * 60 + v.getSeconds();
  }
  const s = chuoi_(v);
  if (!s || s === '0') return 0;

  const phan = s.split(':').map(function (x) { return parseInt(x, 10); });
  if (phan.some(isNaN)) return 0;

  if (phan.length === 3) return phan[0] * 3600 + phan[1] * 60 + phan[2];
  if (phan.length === 2) return phan[0] * 60 + phan[1];
  return phan[0] * 60;   // chỉ có một số thì hiểu là phút
}

function doiNgay_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd');
  const s = chuoi_(v);
  if (!s) return '';

  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return '';
}

function doiGio_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Ho_Chi_Minh', 'HH:mm');
  const s = chuoi_(v);
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : s;
}

/** Đối chiếu chữ trong phiếu với danh mục; không khớp thì giữ nguyên chữ gốc. */
function doiDanhMuc_(ds, chu) {
  if (!chu) return { gia_tri: '', khop: true };
  const goc = khongDau_(chu);

  for (let i = 0; i < (ds || []).length; i++) {
    if (khongDau_(ds[i].ma) === goc || khongDau_(ds[i].ten) === goc) {
      return { gia_tri: ds[i].ma, khop: true };
    }
  }
  return { gia_tri: chu, khop: false };
}

/* ================= Bước 2: tạo hàng loạt ================= */

function taoHangLoat_(payload, ctx) {
  doiHoiQuyen_(ctx, 'ho_so.them');

  const donViId = String(payload.don_vi_chu_quan_id || '');
  const dv = timMot_('DON_VI', 'don_vi_id', donViId);
  if (!dv) throw new Error('Chưa chọn đơn vị chủ quản.');

  if (!co_(ctx, 'ho_so.sua_tat_ca') && donViId !== ctx.don_vi_id) {
    throw new Error('Bạn chỉ tạo được hồ sơ cho đơn vị của mình.');
  }

  const dong = (payload.dong || []).filter(function (d) {
    return d && String(d.ten_chuong_trinh || '').trim() && Number(d.thoi_luong_giay || 0) > 0;
  });
  if (!dong.length) throw new Error('Không có dòng nào đủ điều kiện để tạo hồ sơ.');
  if (dong.length > TOI_DA_MOT_LAN) {
    throw new Error('Mỗi lần chỉ nhập tối đa ' + TOI_DA_MOT_LAN + ' hồ sơ.');
  }

  const ma = sinhNhieuMaHoSo_(dong.length);
  const bayGio = nowIso_();

  const hoSo = dong.map(function (d, i) {
    return {
      ho_so_id: ma[i],
      ten_chuong_trinh: String(d.ten_chuong_trinh).trim(),
      don_vi_chu_quan_id: donViId,
      the_loai: String(d.the_loai || ''),
      kenh: String(d.kenh || ''),
      thoi_luong_giay: Number(d.thoi_luong_giay || 0),
      ma_don_vi: String(d.ma_don_vi || ''),
      ten_file: String(d.ten_file || ''),
      ngay_phat_song: String(d.ngay_phat_song || ''),
      gio_phat_song: String(d.gio_phat_song || ''),
      ghi_chu_lich: '',
      mo_ta: String(d.mo_ta || ''),
      trang_thai: 'NHAP',
      nguoi_duyet: '', ngay_duyet: '', ly_do_tra_lai: '',
      drive_folder_id: '',
      ngay_tao: bayGio, nguoi_tao: ctx.user_id,
      ngay_cap_nhat: bayGio, nguoi_cap_nhat: ctx.user_id
    };
  });

  themNhieu_('HO_SO', hoSo);

  /* --- Gắn link video nếu phiếu có --- */
  const coLink = dong
    .map(function (d, i) { return { link: String(d.link || '').trim(), i: i }; })
    .filter(function (x) { return x.link && tachFileId_(x.link); });

  // Kiểm chứng từng link tốn một lượt gọi Drive, nên chỉ làm khi số lượng vừa phải.
  const kiemChung = coLink.length <= 50;
  const tep = [];
  let linkHong = 0;

  coLink.forEach(function (x) {
    const driveId = tachFileId_(x.link);
    let ten = String(dong[x.i].ten_file || '').trim();
    let song = true;

    if (kiemChung) {
      try {
        const f = DriveApp.getFileById(driveId);
        if (!ten) ten = f.getName();
      } catch (e) {
        song = false;
        linkHong++;
      }
    }

    tep.push({
      file_id: uuid_(),
      ho_so_id: ma[x.i],
      hop_dong_id: '',
      loai: 'VIDEO',
      nguon: 'LINK_NGOAI',
      ten_hien_thi: ten || hoSo[x.i].ten_chuong_trinh,
      drive_file_id: driveId,
      mime: 'video/mp4',
      dung_luong: 0,
      thoi_luong_giay: hoSo[x.i].thoi_luong_giay,
      phien_ban: 1,
      thay_the_cho: '',
      mo_ta: 'Nhập từ phiếu Excel',
      cho_doi_tac_xem: false,
      nhay_cam: false,
      lan_kiem_tra_cuoi: kiemChung ? bayGio : '',
      link_con_song: song,
      ngay_tao: bayGio,
      nguoi_tai: ctx.user_id
    });
  });

  if (tep.length) themNhieu_('TEP_DINH_KEM', tep);

  ghiNhatKy_(ctx, 'NHAP_EXCEL', 'HO_SO', '',
    'Nhập ' + hoSo.length + ' hồ sơ cho ' + dv.ten
    + (tep.length ? ', gắn ' + tep.length + ' link video' : ''), 'THANH_CONG');

  return {
    da_tao: hoSo.length,
    ma_dau: ma[0],
    ma_cuoi: ma[ma.length - 1],
    link_da_gan: tep.length,
    link_hong: linkHong,
    da_kiem_chung_link: kiemChung
  };
}

/**
 * Cấp một dải mã hồ sơ liên tiếp trong một lần khoá.
 * Gọi sinhMaHoSo_ nhiều lần sẽ khoá đi khoá lại và rất chậm khi nhập hàng loạt.
 */
function sinhNhieuMaHoSo_(soLuong) {
  const lock = LockService.getScriptLock();
  lock.waitLock(60000);
  try {
    const tienTo = getCauHinh('TIEN_TO_MA_HO_SO', 'HTV-KHTC');
    const nam = new Date().getFullYear();
    const dau = tienTo + '-' + nam + '-';

    let lonNhat = 0;
    docAllRows_('HO_SO', true).forEach(function (h) {
      const m = String(h.ho_so_id || '');
      if (m.indexOf(dau) !== 0) return;
      const so = parseInt(m.slice(dau.length), 10);
      if (!isNaN(so) && so > lonNhat) lonNhat = so;
    });

    const ra = [];
    for (let i = 1; i <= soLuong; i++) {
      ra.push(dau + String(lonNhat + i).padStart(3, '0'));
    }
    return ra;
  } finally {
    lock.releaseLock();
  }
}
