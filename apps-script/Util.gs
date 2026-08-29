/**
 * Util.gs — Hàm dùng chung: sinh id, băm mật khẩu, thời gian, chuỗi.
 */

/** Chuỗi ngẫu nhiên an toàn, độ dài theo số byte. */
function randomToken_(soByte) {
  const b = [];
  for (let i = 0; i < (soByte || 16); i++) b.push(Math.floor(Math.random() * 256));
  // Trộn thêm nguồn entropy của Google để không phụ thuộc hoàn toàn vào Math.random
  const them = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    Utilities.getUuid() + new Date().getTime() + b.join(',')
  );
  return them.slice(0, soByte || 16)
    .map(function (x) { return ('0' + (x & 0xff).toString(16)).slice(-2); })
    .join('');
}

function uuid_() {
  return Utilities.getUuid();
}

function nowIso_() {
  return Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', "yyyy-MM-dd'T'HH:mm:ss");
}

function ngayIso_(d) {
  return Utilities.formatDate(d || new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd');
}

/** Cộng thêm số phút vào thời điểm hiện tại, trả về chuỗi ISO. */
function congPhut_(soPhut) {
  return Utilities.formatDate(
    new Date(new Date().getTime() + soPhut * 60000),
    'Asia/Ho_Chi_Minh', "yyyy-MM-dd'T'HH:mm:ss"
  );
}

function sha256Hex_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(function (x) { return ('0' + (x & 0xff).toString(16)).slice(-2); })
    .join('');
}

const PBKDF2_VONG = 4096;

/**
 * Băm mật khẩu bằng cách lặp HMAC-SHA256.
 * 4096 vòng là mức cân bằng: đủ chậm để chống dò, đủ nhanh để Apps Script
 * trả lời trong khoảng một giây.
 */
function bamMatKhau_(matKhau, salt) {
  let acc = salt + '|' + matKhau;
  for (let i = 0; i < PBKDF2_VONG; i++) {
    acc = Utilities.computeHmacSha256Signature(acc, salt)
      .map(function (x) { return ('0' + (x & 0xff).toString(16)).slice(-2); })
      .join('');
  }
  return acc;
}

function taoMatKhau_(matKhau) {
  const salt = randomToken_(16);
  return { salt: salt, hash: bamMatKhau_(matKhau, salt) };
}

function kiemTraMatKhau_(matKhau, salt, hash) {
  return soSanhAnToan_(bamMatKhau_(matKhau, salt), hash);
}

/** So sánh chuỗi không phụ thuộc thời gian, tránh rò rỉ qua độ trễ. */
function soSanhAnToan_(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let khac = 0;
  for (let i = 0; i < a.length; i++) khac |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return khac === 0;
}

/** Bỏ dấu tiếng Việt và chuyển thành slug dùng cho username, mã danh mục. */
function khongDau_(s) {
  const nguon = 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ';
  const dich  = 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooooouuuuuuuuuuuyyyyyd';
  let r = String(s).toLowerCase();
  let out = '';
  for (let i = 0; i < r.length; i++) {
    const p = nguon.indexOf(r[i]);
    out += p >= 0 ? dich[p] : r[i];
  }
  return out.replace(/[^a-z0-9]+/g, '');
}

/** Che một phần địa chỉ email: patusrila@gmail.com ➜ pa*****la@gmail.com */
function cheEmail_(email) {
  if (!email || email.indexOf('@') < 0) return '';
  const p = email.split('@');
  const ten = p[0];
  if (ten.length <= 4) return ten[0] + '***@' + p[1];
  return ten.slice(0, 2) + '*****' + ten.slice(-2) + '@' + p[1];
}
