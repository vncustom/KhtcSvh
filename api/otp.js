/**
 * api/otp.js — Bước 2 của đăng nhập: xác thực mã, và gửi lại mã.
 *
 * POST /api/otp            { ma, ghi_nho }   xác thực
 * POST /api/otp?viec=gui                     gửi lại mã
 */

import { goiGas, docBody, traJson, bocLoi, loi } from './_gas.js';
import { COOKIE_PHIEN, COOKIE_TAM, COOKIE_THIET_BI, datCookie, xoaCookie, docCookie, ganCookie } from './_phien.js';
import { kiemTraNhipDo } from './_nhipdo.js';
import { layIp } from './goi.js';

const PHIEN_GIAY = 12 * 3600;
const THIET_BI_GIAY = 30 * 24 * 3600;

export default bocLoi(async function handler(req, res) {
  if (req.method !== 'POST') throw loi('Chỉ nhận phương thức POST.', 405);

  const ip = layIp(req);
  kiemTraNhipDo('otp:' + ip, 12);

  const phienTam = docCookie(req, COOKIE_TAM);
  if (!phienTam) throw loi('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 401);

  const ctx = { ip, user_agent: (req.headers['user-agent'] || '').slice(0, 300) };
  const url = new URL(req.url, 'http://x');

  if (url.searchParams.get('viec') === 'gui') {
    const d = await goiGas('guiLaiOtp', { phien_tam: phienTam }, ctx);
    return traJson(res, 200, { ok: true, data: d });
  }

  const { ma, ghi_nho } = await docBody(req);
  const data = await goiGas('xacThucOtp', { phien_tam: phienTam, ma, ghi_nho: !!ghi_nho }, ctx);

  const cookies = [
    datCookie(COOKIE_PHIEN, data.token, PHIEN_GIAY),
    xoaCookie(COOKIE_TAM)
  ];
  if (data.thiet_bi) cookies.push(datCookie(COOKIE_THIET_BI, data.thiet_bi, THIET_BI_GIAY));
  ganCookie(res, cookies);

  traJson(res, 200, { ok: true, data: { nguoi_dung: data.nguoi_dung } });
});
