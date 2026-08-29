/**
 * js/taive.js — Đưa dữ liệu từ máy chủ thành tệp tải xuống.
 *
 * Tách riêng thành module nhỏ để các trang cùng dùng được. Đặt trong một trang
 * cụ thể sẽ kéo theo cả phần khởi động của trang đó khi trang khác nhập vào,
 * và làm hỏng trang không có sẵn những ô mà trang kia cần.
 */

const KIEU_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Đổi chuỗi base64 do máy chủ trả về thành tệp rồi để trình duyệt tải xuống. */
export function taiVe(tenTep, base64, kieu = KIEU_XLSX) {
  const nhiPhan = atob(base64);
  const byte = new Uint8Array(nhiPhan.length);
  for (let i = 0; i < nhiPhan.length; i++) byte[i] = nhiPhan.charCodeAt(i);

  const url = URL.createObjectURL(new Blob([byte], { type: kieu }));

  const a = document.createElement('a');
  a.href = url;
  a.download = tenTep;
  document.body.append(a);
  a.click();
  a.remove();

  // Thu hồi địa chỉ tạm sau khi trình duyệt đã kịp bắt đầu tải.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
