/**
 * api/dangnhap.js — Bước 1 của đăng nhập.
 *
 * Kiểm mật khẩu ở phía Apps Script. Thiết bị đã ghi nhớ thì vào thẳng và
 * nhận cookie phiên; chưa ghi nhớ thì nhận cookie tạm và chờ nhập OTP.
 */

import { goiGas, docBody, traJson, bocLoi, loi } from './_gas.js';
import { COOKIE_PHIEN, COOKIE_TAM, COOKIE_THIET_BI, datCookie, docCookie, ganCookie } from './_phien.js';
import { kiemTraNhipDo } from './_nhipdo.js';
import { layIp } from './goi.js';

const PHIEN_GIAY = 12 * 3600;
const TAM_GIAY = 10 * 60;

export default bocLoi(async function handler(req, res) {
  if (req.method !== 'POST') throw loi('Chỉ nhận phương thức POST.', 405);

  const ip = layIp(req);
  // Siết chặt hơn API thường: 10 lần thử mỗi phút cho mỗi địa chỉ.
  kiemTraNhipDo('dangnhap:' + ip, 10);

  const { username, mat_khau } = await docBody(req);
  if (!username || !mat_khau) throw loi('Vui lòng nhập tên đăng nhập và mật khẩu.', 400);

  const data = await goiGas(
    'dangNhap',
    { username, mat_khau, thiet_bi: docCookie(req, COOKIE_THIET_BI) },
    { ip, user_agent: (req.headers['user-agent'] || '').slice(0, 300) }
  );

  if (data.xong) {
    ganCookie(res, [datCookie(COOKIE_PHIEN, data.token, PHIEN_GIAY)]);
    return traJson(res, 200, { ok: true, data: { xong: true, nguoi_dung: data.nguoi_dung } });
  }

  ganCookie(res, [datCookie(COOKIE_TAM, data.phien_tam, TAM_GIAY)]);
  traJson(res, 200, {
    ok: true,
    data: {
      xong: false,
      can_otp: true,
      email_che: data.email_che,
      het_han: data.het_han,
      canh_bao_quota: data.canh_bao_quota
    }
  });
});
