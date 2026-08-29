/**
 * api/_gas.js — Cầu nối duy nhất tới Apps Script.
 *
 * Không file nào khác được gọi thẳng GAS_URL. Mọi lời gọi đi qua đây để
 * khoá dùng chung và địa chỉ Web App chỉ tồn tại ở phía máy chủ.
 */

const GAS_URL = process.env.GAS_URL;
const GAS_APP_KEY = process.env.GAS_APP_KEY;

/** Gọi một action trên Apps Script. Trả về phần data, hoặc ném lỗi có kèm mã HTTP. */
export async function goiGas(action, payload = {}, ctx = {}) {
  if (!GAS_URL || !GAS_APP_KEY) {
    throw loi('Thiếu biến môi trường GAS_URL hoặc GAS_APP_KEY.', 500);
  }

  let res;
  try {
    res = await fetch(GAS_URL, {
      method: 'POST',
      // text/plain để tránh yêu cầu kiểm tra trước; Apps Script đọc thân dưới dạng chuỗi.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ key: GAS_APP_KEY, action, payload, ctx }),
      redirect: 'follow'
    });
  } catch (e) {
    throw loi('Không kết nối được Apps Script: ' + e.message, 502);
  }

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    // Apps Script trả HTML khi Web App chưa triển khai đúng quyền truy cập.
    throw loi(
      'Apps Script không trả về JSON. Kiểm tra lại: Web App đã Deploy chưa, '
      + 'và mục "Who has access" đã chọn "Anyone" chưa.',
      502
    );
  }

  if (!json.ok) throw loi(json.loi || 'Apps Script báo lỗi.', json.http || 400, json.maLoi);
  return json.data;
}

export function loi(thongDiep, http = 400, maLoi) {
  const e = new Error(thongDiep);
  e.http = http;
  if (maLoi) e.maLoi = maLoi;
  return e;
}

/** Đọc thân JSON của yêu cầu, chấp nhận cả khi runtime chưa tự phân giải. */
export async function docBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw loi('Thân yêu cầu không phải JSON hợp lệ.', 400);
  }
}

/** Gửi trả JSON kèm mã trạng thái. */
export function traJson(res, http, obj) {
  res.status(http).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

/** Bọc một handler để lỗi luôn trở thành JSON thay vì trang lỗi HTML. */
export function bocLoi(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (e) {
      const http = e.http || 500;
      if (http >= 500) console.error(e);
      traJson(res, http, { ok: false, loi: e.message, maLoi: e.maLoi });
    }
  };
}
