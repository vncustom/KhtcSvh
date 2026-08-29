/**
 * api/quenthietbi.js — Huỷ ghi nhớ thiết bị: xoá dấu ở máy chủ và xoá cookie.
 */

import { goiGas, traJson, bocLoi, loi } from './_gas.js';
import { COOKIE_THIET_BI, xoaCookie, docPhien, ganCookie } from './_phien.js';
import { layIp } from './goi.js';

export default bocLoi(async function handler(req, res) {
  if (req.method !== 'POST') throw loi('Chỉ nhận phương thức POST.', 405);

  const session = docPhien(req);
  if (!session) throw loi('Phiên đã hết hạn, mời đăng nhập lại.', 401, 'HET_PHIEN');

  const data = await goiGas('quenThietBi', {}, { session, ip: layIp(req) });
  ganCookie(res, [xoaCookie(COOKIE_THIET_BI)]);
  traJson(res, 200, { ok: true, data });
});
