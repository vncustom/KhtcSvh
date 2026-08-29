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

/** Đọc mã hồ sơ từ địa chỉ trang. */
export function maHoSoTuUrl() {
  return new URLSearchParams(location.search).get('id') || '';
}
