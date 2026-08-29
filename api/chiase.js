/**
 * api/chiase.js — Cửa công khai cho đối tác quét mã QR.
 *
 * Không cần đăng nhập, nên siết nhịp độ chặt hơn hẳn API thường và
 * không bao giờ nhận action nào ngoài bốn action của luồng chia sẻ.
 *
 *   POST /api/chiase?viec=xem      { token }
 *   POST /api/chiase?viec=gui      { token }
 *   POST /api/chiase?viec=xacthuc  { token, ma }
 *   POST /api/chiase?viec=noidung  (dùng cookie phiên xem)
 *   POST /api/chiase?viec=motep    { ten_tep }
 */

import { goiGas, docBody, traJson, bocLoi, loi } from './_gas.js';
import { COOKIE_XEM, datCookie, docCookie, ganCookie } from './_phien.js';
import { kiemTraNhipDo } from './_nhipdo.js';
import { layIp } from './goi.js';

const XEM_GIAY = 30 * 60;

/** Mỗi việc có mức siết riêng: xác thực và gửi mã là chỗ dễ bị dò nhất. */
const NHIP_DO = { xem: 30, gui: 5, xacthuc: 10, noidung: 30, motep: 60 };

export default bocLoi(async function handler(req, res) {
  if (req.method !== 'POST') throw loi('Chỉ nhận phương thức POST.', 405);

  const viec = new URL(req.url, 'http://x').searchParams.get('viec') || 'xem';
  if (!(viec in NHIP_DO)) throw loi('Yêu cầu không hợp lệ.', 400);

  const ip = layIp(req);
  kiemTraNhipDo(`chiase:${viec}:${ip}`, NHIP_DO[viec]);

  const than = await docBody(req);
  const ctx = { ip, user_agent: (req.headers['user-agent'] || '').slice(0, 300) };

  if (viec === 'xem') {
    const d = await goiGas('xemPhieu', { token: than.token }, ctx);
    return traJson(res, 200, { ok: true, data: d });
  }

  if (viec === 'gui') {
    const d = await goiGas('guiMaChiaSe', { token: than.token }, ctx);
    return traJson(res, 200, { ok: true, data: d });
  }

  if (viec === 'xacthuc') {
    const d = await goiGas('xacThucPhieu', { token: than.token, ma: than.ma }, ctx);
    // Phiên xem nằm trong cookie httpOnly, đối tác không cần giữ token nào trên trang.
    ganCookie(res, [datCookie(COOKIE_XEM, d.phien_xem, XEM_GIAY)]);
    return traJson(res, 200, { ok: true, data: { noi_dung: d.noi_dung } });
  }

  const phienXem = docCookie(req, COOKIE_XEM);
  if (!phienXem) throw loi('Phiên xem đã hết hạn. Vui lòng xác thực lại.', 401, 'HET_PHIEN_XEM');

  if (viec === 'noidung') {
    const d = await goiGas('noiDungPhieu', { phien_xem: phienXem }, ctx);
    return traJson(res, 200, { ok: true, data: d });
  }

  const d = await goiGas('ghiLuotMoTep', { phien_xem: phienXem, ten_tep: than.ten_tep }, ctx);
  traJson(res, 200, { ok: true, data: d });
});
