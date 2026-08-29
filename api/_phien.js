/**
 * api/_phien.js — Ba cookie httpOnly của hệ thống.
 *
 *   htv_phien  token phiên đăng nhập, mặc định 12 giờ
 *   htv_tam    phiên tạm giữa bước nhập mật khẩu và bước nhập OTP, 10 phút
 *   htv_tb     dấu thiết bị đã ghi nhớ, 30 ngày
 *
 * Cả ba đều được ký bằng HMAC-SHA256 và không đọc được từ JavaScript trên trang,
 * nên một lỗ hổng XSS ở giao diện không kéo theo mất phiên.
 */

import crypto from 'node:crypto';

export const COOKIE_PHIEN = 'htv_phien';
export const COOKIE_TAM = 'htv_tam';
export const COOKIE_THIET_BI = 'htv_tb';

const BI_MAT = process.env.SESSION_SECRET || '';

function ky(giaTri) {
  return crypto.createHmac('sha256', BI_MAT).update(giaTri).digest('base64url');
}

/** Tạo chuỗi Set-Cookie. maxAge tính bằng giây; 0 nghĩa là xoá cookie. */
export function datCookie(ten, token, maxAge) {
  if (!BI_MAT) throw new Error('Thiếu biến môi trường SESSION_SECRET.');

  const giaTri = token ? `${token}.${ky(token)}` : '';
  const phan = [`${ten}=${giaTri}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`];

  // Trên localhost không có HTTPS nên bỏ Secure; khi chạy trên Vercel thì luôn bật.
  if (process.env.VERCEL) phan.push('Secure');
  return phan.join('; ');
}

export function xoaCookie(ten) {
  return datCookie(ten, '', 0);
}

/** Đọc và kiểm chữ ký một cookie. Trả về null nếu thiếu hoặc chữ ký sai. */
export function docCookie(req, ten) {
  const header = req.headers?.cookie || '';
  const muc = header
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(ten + '='));
  if (!muc) return null;

  const giaTri = decodeURIComponent(muc.slice(ten.length + 1));
  const cham = giaTri.lastIndexOf('.');
  if (cham < 1) return null;

  const token = giaTri.slice(0, cham);
  const chuKy = giaTri.slice(cham + 1);
  const mongDoi = ky(token);

  if (chuKy.length !== mongDoi.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(chuKy), Buffer.from(mongDoi))) return null;
  return token;
}

export const docPhien = (req) => docCookie(req, COOKIE_PHIEN);

/** Gắn nhiều Set-Cookie vào một phản hồi. */
export function ganCookie(res, danhSach) {
  const co = res.getHeader?.('Set-Cookie');
  const gop = [].concat(co || [], danhSach.filter(Boolean));
  res.setHeader('Set-Cookie', gop);
}
