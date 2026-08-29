/**
 * api/dangxuat.js — Kết thúc phiên và xoá cookie.
 *
 * Cookie thiết bị tin cậy được giữ lại, để lần đăng nhập sau trên chính máy này
 * không phải nhập OTP. Muốn quên hẳn thì dùng chức năng "Quên thiết bị này".
 */

import { goiGas, traJson, bocLoi } from './_gas.js';
import { COOKIE_PHIEN, COOKIE_TAM, xoaCookie, docPhien, ganCookie } from './_phien.js';
import { layIp } from './goi.js';

export default bocLoi(async function handler(req, res) {
  const session = docPhien(req);

  if (session) {
    try {
      await goiGas('dangXuat', {}, { session, ip: layIp(req) });
    } catch (e) {
      // Phiên hỏng hay Apps Script lỗi đều không được cản việc đăng xuất.
      console.error('Lỗi khi huỷ phiên phía máy chủ: ' + e.message);
    }
  }

  ganCookie(res, [xoaCookie(COOKIE_PHIEN), xoaCookie(COOKIE_TAM)]);
  traJson(res, 200, { ok: true, data: { da_thoat: true } });
});
