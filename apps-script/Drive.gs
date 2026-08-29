/**
 * Drive.gs — Cây thư mục lưu trữ trên Drive 5 TB của tài khoản chạy hệ thống.
 *
 * Mỗi hồ sơ có một thư mục riêng:
 *   {Gốc}/{Năm}/{Mã hồ sơ}/
 *       Hợp đồng/
 *       Kịch bản - Tài liệu/
 *       Audio - Hình ảnh/
 *
 * Video không nằm ở đây: video ở kho Drive 20 TB riêng và được đưa vào bằng link.
 */

const THU_MUC_CON = ['Hợp đồng', 'Kịch bản - Tài liệu', 'Audio - Hình ảnh'];

function thuMucGoc_() {
  const id = getCauHinh('DRIVE_ROOT_FOLDER_ID', '');
  if (!id) {
    throw new Error('Chưa đặt thư mục lưu trữ trên Drive. '
      + 'Vào mục Quản trị ➜ Cấu hình để chọn thư mục gốc.');
  }
  try {
    return DriveApp.getFolderById(id);
  } catch (e) {
    throw new Error('Không mở được thư mục gốc đã cấu hình. '
      + 'Có thể thư mục đã bị xoá hoặc đổi quyền — hãy chọn lại ở mục Quản trị ➜ Cấu hình.');
  }
}

/** Tìm thư mục con theo tên, chưa có thì tạo. */
function thuMucCon_(cha, ten) {
  const it = cha.getFoldersByName(ten);
  return it.hasNext() ? it.next() : cha.createFolder(ten);
}

/**
 * Tạo (hoặc tìm lại) thư mục của một hồ sơ. Trả về id.
 * Gọi được nhiều lần mà không sinh thư mục trùng.
 */
function taoThuMucHoSo_(hoSoId, nam) {
  const goc = thuMucGoc_();
  const namF = thuMucCon_(goc, String(nam || new Date().getFullYear()));
  const hoSoF = thuMucCon_(namF, hoSoId);
  THU_MUC_CON.forEach(function (ten) { thuMucCon_(hoSoF, ten); });
  return hoSoF.getId();
}

/** Đường dẫn mở thư mục hồ sơ trên Drive, để hiện nút "Mở thư mục". */
function urlThuMuc_(folderId) {
  if (!folderId) return '';
  try {
    return DriveApp.getFolderById(folderId).getUrl();
  } catch (e) {
    return '';
  }
}
