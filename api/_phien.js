/**
 * api/_phien.js — Phiên đăng nhập trong cookie httpOnly.
 *
 * Cookie chứa token phiên đã ký bằng HMAC. JavaScript trên trang không đọc được,
 * nên một lỗ hổng XSS ở giao diện không kéo theo mất phiên.
 * Giai đoạn 1 sẽ dùng đầy đủ; Giai đoạn 0 mới chỉ dựng sẵn khung.
 */

import crypto from 'node:crypto';

const TEN_COOKIE = 'htv_phien';
const BI_MAT = process.env.SESSION_SECRET || '';

function ky(giaTri) {
  return crypto.createHmac('sha256', BI_MAT).update(giaTri).digest('base64url');
}

export function taoCookiePhien(token, soGio = 12) {
  if (!BI_MAT) throw new Error('Thiếu biến môi trường SESSION_SECRET.');
  const giaTri = `${token}.${ky(token)}`;
  const thuocTinh = [
    `${TEN_COOKIE}=${giaTri}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${soGio * 3600}`
  ];
  // Trên localhost không có HTTPS nên bỏ Secure, còn lại luôn bật.
  if (process.env.VERCEL) thuocTinh.push('Secure');
  return thuocTinh.join('; ');
}

export function xoaCookiePhien() {
  return `${TEN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/** Đọc và kiểm chữ ký token phiên từ cookie. Trả về null nếu không hợp lệ. */
export function docPhien(req) {
  const header = req.headers?.cookie || '';
  const cap = header.split(';').map((s) => s.trim()).find((s) => s.startsWith(TEN_COOKIE + '='));
  if (!cap) return null;

  const giaTri = decodeURIComponent(cap.slice(TEN_COOKIE.length + 1));
  const cham = giaTri.lastIndexOf('.');
  if (cham < 1) return null;

  const token = giaTri.slice(0, cham);
  const chuKy = giaTri.slice(cham + 1);
  const mongDoi = ky(token);

  if (chuKy.length !== mongDoi.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(chuKy), Buffer.from(mongDoi))) return null;
  return token;
}
