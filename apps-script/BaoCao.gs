/**
 * BaoCao.gs — Tổng hợp số liệu và xuất ra Excel.
 *
 * Mọi con số đều tính trong đúng phạm vi vai trò của người xem, dùng chung
 * hàm trongPhamVi_ với danh sách hồ sơ để hai nơi không bao giờ lệch nhau.
 */

/* ================= Tổng hợp ================= */

function baoCaoTongHop_(payload, ctx) {
  doiHoiQuyen_(ctx, 'bao_cao.xem');

  const f = payload || {};
  const tenDonVi = {};
  docAllRows_('DON_VI').forEach(function (d) { tenDonVi[d.don_vi_id] = d.ten; });

  const danhMuc = layDanhMuc_({}, ctx);
  const tenMuc = function (loai, ma) {
    if (!ma) return '(chưa xác định)';
    const ds = danhMuc[loai] || [];
    for (let i = 0; i < ds.length; i++) if (ds[i].ma === ma) return ds[i].ten;
    return ma;
  };

  let ds = trongPhamVi_(phamViHoSo_(ctx), doiTacTheoHoSo_());

  if (f.tu_ngay) ds = ds.filter(function (h) { return h.ngay_phat_song && h.ngay_phat_song >= f.tu_ngay; });
  if (f.den_ngay) ds = ds.filter(function (h) { return h.ngay_phat_song && h.ngay_phat_song <= f.den_ngay; });
  if (f.don_vi_id) ds = ds.filter(function (h) { return String(h.don_vi_chu_quan_id) === String(f.don_vi_id); });

  /* --- Gom nhóm --- */
  const theoDonVi = {};
  const theoKenh = {};
  const theoTheLoai = {};
  const theoThang = {};
  const theoTrangThai = {};

  const gom = function (kho, khoa, h) {
    const o = kho[khoa] || (kho[khoa] = { ten: khoa, so_ho_so: 0, giay: 0, da_duyet: 0 });
    o.so_ho_so++;
    o.giay += giayCua_(h);
    if (h.trang_thai === 'DA_DUYET' || h.trang_thai === 'LUU_TRU') o.da_duyet++;
  };

  ds.forEach(function (h) {
    gom(theoDonVi, tenDonVi[h.don_vi_chu_quan_id] || '(chưa rõ)', h);
    gom(theoKenh, tenMuc('KENH', h.kenh), h);
    gom(theoTheLoai, tenMuc('THE_LOAI', h.the_loai), h);
    gom(theoThang, (h.ngay_phat_song || '').slice(0, 7) || '(chưa có lịch)', h);
    theoTrangThai[h.trang_thai] = (theoTrangThai[h.trang_thai] || 0) + 1;
  });

  const raMang = function (kho, sapTheoTen) {
    const m = Object.keys(kho).map(function (k) { return kho[k]; });
    m.sort(sapTheoTen
      ? function (a, b) { return String(a.ten).localeCompare(String(b.ten), 'vi'); }
      : function (a, b) { return b.so_ho_so - a.so_ho_so; });
    return m;
  };

  /* --- Hợp đồng, chỉ cho người có quyền --- */
  let hopDong = null;
  if (co_(ctx, 'hop_dong.xem')) {
    const trongTam = {};
    ds.forEach(function (h) { trongTam[h.ho_so_id] = true; });

    const thanhToan = gomThanhToan_();
    const theoDv = {};
    let tongGiaTri = 0;
    let tongDaTra = 0;

    docAllRows_('HOP_DONG')
      .filter(function (c) { return c.trang_thai !== 'XOA' && trongTam[c.ho_so_id]; })
      .forEach(function (c) {
        const ten = tenDonVi[c.don_vi_id] || '(chưa rõ)';
        const o = theoDv[ten] || (theoDv[ten] = { ten: ten, so_hop_dong: 0, gia_tri: 0, da_tra: 0 });
        const daTra = (thanhToan[c.hop_dong_id] || [])
          .filter(function (t) { return t.trang_thai === 'DA_TT'; })
          .reduce(function (a, t) { return a + Number(t.so_tien || 0); }, 0);

        o.so_hop_dong++;
        o.gia_tri += Number(c.gia_tri || 0);
        o.da_tra += daTra;
        tongGiaTri += Number(c.gia_tri || 0);
        tongDaTra += daTra;
      });

    hopDong = {
      tong_gia_tri: tongGiaTri,
      da_tra: tongDaTra,
      con_lai: tongGiaTri - tongDaTra,
      theo_don_vi: Object.keys(theoDv)
        .map(function (k) { return theoDv[k]; })
        .sort(function (a, b) { return b.gia_tri - a.gia_tri; })
    };
  }

  return {
    tu_ngay: f.tu_ngay || '',
    den_ngay: f.den_ngay || '',
    tong_ho_so: ds.length,
    tong_giay: ds.reduce(function (a, h) { return a + giayCua_(h); }, 0),
    theo_trang_thai: theoTrangThai,
    theo_don_vi: raMang(theoDonVi),
    theo_kenh: raMang(theoKenh),
    theo_the_loai: raMang(theoTheLoai),
    theo_thang: raMang(theoThang, true),
    hop_dong: hopDong,
    lap_luc: nowIso_()
  };
}

/* ================= Xuất Excel ================= */

/**
 * Xuất báo cáo hoặc danh sách hồ sơ ra tệp .xlsx thật.
 *
 * Apps Script không tạo thẳng được .xlsx, nên cách làm là dựng một Google Sheet tạm,
 * gọi đường dẫn xuất của Google để lấy tệp, rồi xoá bảng tạm đi.
 */
function xuatExcel_(payload, ctx) {
  doiHoiQuyen_(ctx, 'bao_cao.xem');

  const loai = String(payload.loai || 'BAO_CAO');
  const bang = loai === 'HO_SO'
    ? bangHoSo_(payload, ctx)
    : bangBaoCao_(payload, ctx);

  const ten = (loai === 'HO_SO' ? 'HoSo_' : 'BaoCao_') + ngayIso_().replace(/-/g, '');
  return { ten_tep: ten + '.xlsx', du_lieu: taoXlsx_(ten, bang) };
}

/** Danh sách hồ sơ theo đúng bộ lọc đang xem trên màn hình. */
function bangHoSo_(payload, ctx) {
  const kq = danhSachHoSo_(Object.assign({}, payload.loc || {}, { trang: 1, moi_trang: 5000 }), ctx);

  const dong = [[
    'Mã hồ sơ', 'Mã đơn vị', 'Tên chương trình', 'Đơn vị chủ quản', 'Đối tác',
    'Thể loại', 'Kênh', 'Thời lượng', 'Số giây', 'Ngày phát sóng', 'Giờ phát sóng',
    'Tên file', 'Trạng thái', 'Cập nhật'
  ]];

  kq.dong.forEach(function (h) {
    dong.push([
      h.ho_so_id, h.ma_don_vi || '', h.ten_chuong_trinh, h.don_vi_chu_quan,
      (h.doi_tac || []).join(', '), h.the_loai || '', h.kenh || '',
      dinhDangGiay_(h.thoi_luong_giay), h.thoi_luong_giay,
      h.ngay_phat_song || '', h.gio_phat_song || '', h.ten_file || '',
      h.ten_trang_thai, h.ngay_cap_nhat || ''
    ]);
  });

  return [{ ten: 'Hồ sơ', dong: dong }];
}

/** Báo cáo tổng hợp, mỗi cách gom nhóm một trang tính. */
function bangBaoCao_(payload, ctx) {
  const b = baoCaoTongHop_(payload.loc || {}, ctx);

  const nhomRa = function (ds) {
    const dong = [['Tên', 'Số hồ sơ', 'Đã duyệt', 'Tổng thời lượng', 'Tổng số giây']];
    ds.forEach(function (o) {
      dong.push([o.ten, o.so_ho_so, o.da_duyet, dinhDangGiay_(o.giay), o.giay]);
    });
    return dong;
  };

  const bang = [
    {
      ten: 'Tổng quan',
      dong: [
        ['Báo cáo hồ sơ chương trình'],
        ['Ban Kế hoạch – Tài chính, Đài Phát thanh - Truyền hình TP. Hồ Chí Minh'],
        [],
        ['Khoảng thời gian', (b.tu_ngay || 'từ đầu') + ' đến ' + (b.den_ngay || 'nay')],
        ['Lập lúc', b.lap_luc],
        [],
        ['Tổng số hồ sơ', b.tong_ho_so],
        ['Tổng thời lượng', dinhDangGiay_(b.tong_giay)],
        [],
        ['Trạng thái', 'Số hồ sơ'],
        ['Nháp', b.theo_trang_thai.NHAP || 0],
        ['Chờ duyệt', b.theo_trang_thai.CHO_DUYET || 0],
        ['Đã duyệt', b.theo_trang_thai.DA_DUYET || 0],
        ['Lưu trữ', b.theo_trang_thai.LUU_TRU || 0]
      ]
    },
    { ten: 'Theo đơn vị', dong: nhomRa(b.theo_don_vi) },
    { ten: 'Theo kênh', dong: nhomRa(b.theo_kenh) },
    { ten: 'Theo thể loại', dong: nhomRa(b.theo_the_loai) },
    { ten: 'Theo tháng', dong: nhomRa(b.theo_thang) }
  ];

  if (b.hop_dong) {
    const dong = [['Đơn vị', 'Số hợp đồng', 'Giá trị', 'Đã thanh toán', 'Còn lại']];
    b.hop_dong.theo_don_vi.forEach(function (o) {
      dong.push([o.ten, o.so_hop_dong, o.gia_tri, o.da_tra, o.gia_tri - o.da_tra]);
    });
    dong.push([]);
    dong.push(['Tổng cộng', '', b.hop_dong.tong_gia_tri, b.hop_dong.da_tra, b.hop_dong.con_lai]);
    bang.push({ ten: 'Hợp đồng', dong: dong });
  }

  return bang;
}

function taoXlsx_(ten, bang) {
  const ss = SpreadsheetApp.create(ten);
  let id = '';

  try {
    bang.forEach(function (b, i) {
      const sh = i === 0 ? ss.getSheets()[0] : ss.insertSheet();
      sh.setName(b.ten.slice(0, 30));
      if (!b.dong.length) return;

      // Các dòng phải cùng số cột thì setValues mới nhận.
      const soCot = Math.max.apply(null, b.dong.map(function (d) { return d.length; }));
      const deu = b.dong.map(function (d) {
        const r = d.slice();
        while (r.length < soCot) r.push('');
        return r;
      });

      sh.getRange(1, 1, deu.length, soCot).setValues(deu);
      sh.getRange(1, 1, 1, soCot).setFontWeight('bold');
      sh.setFrozenRows(1);
      sh.autoResizeColumns(1, Math.min(soCot, 12));
    });

    SpreadsheetApp.flush();
    id = ss.getId();

    const res = UrlFetchApp.fetch(
      'https://docs.google.com/spreadsheets/d/' + id + '/export?format=xlsx',
      { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true }
    );

    if (res.getResponseCode() >= 300) {
      throw new Error('Google không xuất được tệp (mã ' + res.getResponseCode() + ').');
    }
    return Utilities.base64Encode(res.getBlob().getBytes());

  } finally {
    // Bảng tạm phải được dọn dù xuất thành công hay không.
    try { if (id) DriveApp.getFileById(id).setTrashed(true); } catch (e) { /* dọn được thì tốt */ }
  }
}

/** Đổi số giây thành chuỗi mm:ss hoặc h:mm:ss cho dễ đọc trong Excel. */
function dinhDangGiay_(giay) {
  const n = Math.max(0, Math.round(Number(giay) || 0));
  const gio = Math.floor(n / 3600);
  const phut = Math.floor((n % 3600) / 60);
  const g = n % 60;
  const hai = function (x) { return ('0' + x).slice(-2); };
  return gio ? gio + ':' + hai(phut) + ':' + hai(g) : phut + ':' + hai(g);
}
