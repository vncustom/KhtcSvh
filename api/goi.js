/**
 * api/goi.js — Cửa duy nhất mà trình duyệt gọi.
 *
 * Nhận { action, payload }, gắn thêm phiên và IP, rồi chuyển tiếp sang Apps Script.
 * Trình duyệt không bao giờ biết địa chỉ Apps Script.
 */

import { goiGas, docBody, traJson, bocLoi, loi } from './_gas.js';
import { docPhien } from './_phien.js';
import { kiemTraNhipDo } from './_nhipdo.js';

export default bocLoi(async function handler(req, res) {
  if (req.method !== 'POST') throw loi('Chỉ nhận phương thức POST.', 405);

  const ip = layIp(req);
  kiemTraNhipDo(ip);

  const { action, payload } = await docBody(req);
  if (!action) throw loi('Thiếu tham số "action".', 400);

  const ctx = {
    session: docPhien(req),
    ip,
    user_agent: (req.headers['user-agent'] || '').slice(0, 300)
  };

  const data = await goiGas(action, payload || {}, ctx);
  traJson(res, 200, { ok: true, data });
});

export function layIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.socket?.remoteAddress || '';
}
