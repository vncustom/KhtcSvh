/**
 * js/api.js — Lớp gọi API duy nhất của giao diện.
 *
 * Giao diện không bao giờ biết địa chỉ Apps Script; nó chỉ nói chuyện với
 * /api/goi trên chính tên miền của mình.
 */

export async function goi(action, payload = {}) {
  let res;
  try {
    res = await fetch('/api/goi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload })
    });
  } catch (e) {
    throw new Error('Không kết nối được máy chủ. Kiểm tra kết nối mạng rồi thử lại.');
  }

  let json;
  try {
    json = await res.json();
  } catch (e) {
    throw new Error(`Máy chủ trả về dữ liệu không đọc được (mã ${res.status}).`);
  }

  if (!json.ok) {
    const err = new Error(json.loi || `Yêu cầu thất bại (mã ${res.status}).`);
    err.maLoi = json.maLoi;
    err.http = res.status;
    throw err;
  }
  return json.data;
}

/** Định dạng số theo kiểu Việt Nam: 1.234.567 */
export function soVn(n) {
  return new Intl.NumberFormat('vi-VN').format(n ?? 0);
}

/** Rút gọn thời điểm ISO thành dạng dễ đọc. */
export function gioVn(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  return d.toLocaleString('vi-VN', { hour12: false });
}

/** Đặt nội dung văn bản an toàn — không dùng innerHTML với dữ liệu từ máy chủ. */
export function chu(el, s) {
  el.textContent = s == null ? '' : String(s);
}
