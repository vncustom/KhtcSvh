/**
 * Repo.gs — Lớp truy cập dữ liệu.
 *
 * Mọi thao tác đọc/ghi Sheet đều đi qua đây. Đọc có bộ đệm 60 giây;
 * ghi bọc trong LockService để hai người thao tác cùng lúc không ghi đè nhau.
 */

const CACHE_GIAY = 60;

function sheet_(tab) {
  const sh = getSpreadsheet_().getSheetByName(tab);
  if (!sh) throw new Error('Chưa có tab "' + tab + '". Hãy chạy khoiTaoCoSoDuLieu() một lần.');
  return sh;
}

function cotCua_(tab) {
  if (!SCHEMA[tab]) throw new Error('Bảng "' + tab + '" không có trong Schema.gs.');
  return SCHEMA[tab];
}

/** Đọc toàn bộ một bảng thành mảng object. Có bộ đệm. */
function docAllRows_(tab, boQuaCache) {
  const cache = CacheService.getScriptCache();
  const khoa = 'tbl_' + tab;
  if (!boQuaCache) {
    const hit = cache.get(khoa);
    if (hit) {
      try { return JSON.parse(hit); } catch (e) { /* bộ đệm hỏng thì đọc lại */ }
    }
  }

  const sh = sheet_(tab);
  const soDong = sh.getLastRow();
  const cot = cotCua_(tab);
  if (soDong < 2) return [];

  const values = sh.getRange(2, 1, soDong - 1, cot.length).getValues();
  const rows = values.map(function (r, i) {
    const o = { _dong: i + 2 };
    cot.forEach(function (ten, c) {
      const v = r[c];
      o[ten] = (v instanceof Date) ? Utilities.formatDate(v, 'Asia/Ho_Chi_Minh', "yyyy-MM-dd'T'HH:mm:ss") : v;
    });
    return o;
  }).filter(function (o) {
    return String(o[cot[0]]).length > 0;   // bỏ dòng trống
  });

  try { cache.put(khoa, JSON.stringify(rows), CACHE_GIAY); } catch (e) { /* quá 100KB thì thôi */ }
  return rows;
}

function xoaCache_(tab) {
  CacheService.getScriptCache().remove('tbl_' + tab);
}

function timMot_(tab, truong, giaTri) {
  const rows = docAllRows_(tab);
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][truong]) === String(giaTri)) return rows[i];
  }
  return null;
}

function loc_(tab, ham) {
  return docAllRows_(tab).filter(ham);
}

/** Chuyển object thành mảng theo đúng thứ tự cột của bảng. */
function thanhDong_(tab, obj) {
  return cotCua_(tab).map(function (ten) {
    const v = obj[ten];
    return (v === undefined || v === null) ? '' : v;
  });
}

/** Thêm một dòng. */
function them_(tab, obj) {
  return themNhieu_(tab, [obj])[0];
}

/** Thêm nhiều dòng trong một lần ghi — tiết kiệm hạn mức đáng kể. */
function themNhieu_(tab, mangObj) {
  if (!mangObj.length) return [];
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = sheet_(tab);
    const dong = mangObj.map(function (o) { return thanhDong_(tab, o); });
    sh.getRange(sh.getLastRow() + 1, 1, dong.length, cotCua_(tab).length).setValues(dong);
    SpreadsheetApp.flush();
    xoaCache_(tab);
    return mangObj;
  } finally {
    lock.releaseLock();
  }
}

/** Cập nhật một dòng theo khoá chính. Chỉ ghi những cột có trong patch. */
function capNhat_(tab, giaTriKhoa, patch) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const cot = cotCua_(tab);
    const rows = docAllRows_(tab, true);
    let dong = -1;
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][cot[0]]) === String(giaTriKhoa)) { dong = rows[i]._dong; break; }
    }
    if (dong < 0) throw new Error('Không tìm thấy ' + giaTriKhoa + ' trong ' + tab + '.');

    const sh = sheet_(tab);
    Object.keys(patch).forEach(function (ten) {
      const c = cot.indexOf(ten);
      if (c >= 0) sh.getRange(dong, c + 1).setValue(patch[ten]);
    });
    SpreadsheetApp.flush();
    xoaCache_(tab);
    return true;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Xoá hẳn một dòng theo khoá chính.
 * Chỉ dùng cho bảng liên kết như HO_SO_DON_VI, nơi giữ lại dòng cũ không có ý nghĩa.
 * Với bảng nghiệp vụ, luôn dùng xoaMem_ để không mất dấu vết.
 */
function xoaDong_(tab, giaTriKhoa) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const cot = cotCua_(tab);
    const rows = docAllRows_(tab, true);
    let dong = -1;
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][cot[0]]) === String(giaTriKhoa)) { dong = rows[i]._dong; break; }
    }
    if (dong < 0) return false;
    sheet_(tab).deleteRow(dong);
    SpreadsheetApp.flush();
    xoaCache_(tab);
    return true;
  } finally {
    lock.releaseLock();
  }
}

/** Xoá mềm: đổi trang_thai thành XOA thay vì xoá dòng, để giữ dấu vết. */
function xoaMem_(tab, giaTriKhoa) {
  return capNhat_(tab, giaTriKhoa, { trang_thai: 'XOA', ngay_cap_nhat: nowIso_() });
}
