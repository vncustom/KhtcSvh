/**
 * js/hoso-chung.js — Những thứ cả ba trang hồ sơ đều dùng.
 */

export const TEN_TRANG_THAI = {
  NHAP: 'Nháp',
  CHO_DUYET: 'Chờ duyệt',
  DA_DUYET: 'Đã duyệt',
  LUU_TRU: 'Lưu trữ'
};

/** Trạng thái nào hiện màu nào. Màu ngữ nghĩa, tách khỏi màu thương hiệu. */
export const LOP_TRANG_THAI = {
  NHAP: 'cho',
  CHO_DUYET: 'canh-bao',
  DA_DUYET: 'tot',
  LUU_TRU: 'cho',
  XOA: 'loi'
};

/** Nhãn nút cho từng bước chuyển trạng thái. */
export const HANH_DONG = {
  GUI_DUYET: { ten: 'Gửi duyệt', lop: 'nut-chinh' },
  DUYET: { ten: 'Duyệt hồ sơ', lop: 'nut-chinh' },
  TRA_LAI: { ten: 'Trả lại', lop: 'nut-phu', canLyDo: true },
  LUU_TRU: { ten: 'Chuyển lưu trữ', lop: 'nut-phu' },
  MO_LAI: { ten: 'Mở lại', lop: 'nut-phu' }
};

export const VAI_TRO_DOI_TAC = {
  DONG_SAN_XUAT: 'Đồng sản xuất',
  TAI_TRO: 'Tài trợ',
  CUNG_CAP_NOI_DUNG: 'Cung cấp nội dung',
  DICH_VU: 'Dịch vụ kỹ thuật'
};

/**
 * Thời lượng lưu bằng giây, hiển thị và nhập theo dạng mm:ss.
 * Quá 60 phút thì hiện thêm phần giờ cho dễ đọc.
 */
export function giaySangChu(giay) {
  const n = Math.max(0, Math.round(Number(giay) || 0));
  const gio = Math.floor(n / 3600);
  const phut = Math.floor((n % 3600) / 60);
  const giaySo = n % 60;
  const hai = (x) => String(x).padStart(2, '0');
  return gio ? `${gio}:${hai(phut)}:${hai(giaySo)}` : `${phut}:${hai(giaySo)}`;
}

/** Đọc chuỗi mm:ss hoặc h:mm:ss thành số giây. Trả về null nếu không hợp lệ. */
export function chuSangGiay(chuoi) {
  const s = String(chuoi || '').trim();
  if (!s) return null;

  const phan = s.split(':').map((x) => x.trim());
  if (phan.some((x) => x === '' || !/^\d+$/.test(x))) return null;

  const so = phan.map(Number);
  if (so.length === 3) return so[0] * 3600 + so[1] * 60 + so[2];
  if (so.length === 2) return so[0] * 60 + so[1];
  if (so.length === 1) return so[0] * 60;   // chỉ một số thì hiểu là phút
  return null;
}

/** Tổng thời lượng của nhiều hồ sơ, hiển thị theo giờ và phút. */
export function tongThoiLuong(giay) {
  const n = Math.max(0, Math.round(Number(giay) || 0));
  const gio = Math.floor(n / 3600);
  const phut = Math.round((n % 3600) / 60);
  return gio ? `${gio} giờ ${phut} phút` : `${phut} phút`;
}

/** Đọc mã hồ sơ từ địa chỉ trang. */
export function maHoSoTuUrl() {
  return new URLSearchParams(location.search).get('id') || '';
}
