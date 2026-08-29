/**
 * js/api.js — Lớp gọi API duy nhất của giao diện.
 *
 * Giao diện không bao giờ biết địa chỉ Apps Script; nó chỉ nói chuyện với
 * các đường dẫn /api/… trên chính tên miền của mình.
 */

/** Gọi một action nghiệp vụ qua cửa chung /api/goi. */
export function goi(action, payload = {}) {
  return dat('/api/goi', { action, payload });
}

/** Gọi thẳng một đường dẫn API riêng (đăng nhập, OTP, đăng xuất…). */
export async function dat(duongDan, than) {
  let res;
  try {
    res = await fetch(duongDan, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(than ?? {})
    });
  } catch {
    throw new Error('Không kết nối được máy chủ. Kiểm tra kết nối mạng rồi thử lại.');
  }

  let json;
  try {
    json = await res.json();
  } catch {
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

/**
 * Bọc một lời gọi cần đăng nhập: phiên hết hạn thì về trang đăng nhập,
 * còn đang nợ việc đổi mật khẩu thì đưa sang đúng bước đó.
 */
export async function goiCanDangNhap(action, payload = {}) {
  try {
    return await goi(action, payload);
  } catch (e) {
    if (e.maLoi === 'HET_PHIEN') {
      location.href = '/?ly_do=het_phien';
      throw e;
    }
    if (e.maLoi === 'BUOC_DOI_MK') {
      location.href = '/?buoc=doi_mk';
      throw e;
    }
    throw e;
  }
}

/* ---------- Định dạng ---------- */

export function soVn(n) {
  return new Intl.NumberFormat('vi-VN').format(n ?? 0);
}

export function gioVn(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  return d.toLocaleString('vi-VN', { hour12: false });
}

export function ngayVn(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  return d.toLocaleDateString('vi-VN');
}

/** Đặt nội dung văn bản an toàn — không dùng innerHTML với dữ liệu từ máy chủ. */
export function chu(el, s) {
  if (el) el.textContent = s == null ? '' : String(s);
}

export const $ = (id) => document.getElementById(id);
