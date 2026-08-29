/**
 * Schema.gs — Định nghĩa 13 bảng của cơ sở dữ liệu.
 * Mọi thay đổi cấu trúc bắt đầu từ file này; Setup.gs đọc ở đây để tạo tab.
 */

const SCHEMA = {
  CAU_HINH: ['khoa', 'gia_tri', 'mo_ta', 'ngay_cap_nhat', 'nguoi_cap_nhat'],

  NGUOI_DUNG: [
    'user_id', 'username', 'ho_ten', 'email', 'dien_thoai', 'nhom', 'don_vi_id',
    'mat_khau_hash', 'salt', 'buoc_doi_mk', 'bat_2fa', 'trang_thai',
    'lan_dang_nhap_cuoi', 'so_lan_sai', 'khoa_den',
    'ngay_tao', 'ngay_cap_nhat', 'nguoi_cap_nhat'
  ],

  DON_VI: [
    'don_vi_id', 'ten', 'loai', 'ma_so_thue', 'dia_chi', 'nguoi_lien_he',
    'email', 'dien_thoai', 'trang_thai',
    'ngay_tao', 'ngay_cap_nhat', 'nguoi_cap_nhat'
  ],

  HO_SO: [
    'ho_so_id', 'ten_chuong_trinh', 'don_vi_chu_quan_id', 'the_loai', 'kenh',
    'thoi_luong_phut', 'so_tap', 'ngay_phat_song', 'gio_phat_song',
    'ghi_chu_lich', 'mo_ta', 'trang_thai', 'nguoi_duyet', 'ngay_duyet',
    'ly_do_tra_lai', 'drive_folder_id',
    'ngay_tao', 'nguoi_tao', 'ngay_cap_nhat', 'nguoi_cap_nhat'
  ],

  HO_SO_DON_VI: [
    'id', 'ho_so_id', 'don_vi_id', 'vai_tro', 'ghi_chu',
    'ngay_tao', 'nguoi_tao'
  ],

  HOP_DONG: [
    'hop_dong_id', 'ho_so_id', 'so_hop_dong', 'loai', 'don_vi_id',
    'ngay_ky', 'ngay_hieu_luc', 'ngay_het_han', 'gia_tri', 'tien_te',
    'thue_suat', 'trang_thai', 'ghi_chu',
    'ngay_tao', 'nguoi_tao', 'ngay_cap_nhat', 'nguoi_cap_nhat'
  ],

  THANH_TOAN: [
    'id', 'hop_dong_id', 'dot', 'dien_giai', 'so_tien',
    'ngay_du_kien', 'ngay_thuc_te', 'trang_thai', 'chung_tu_file_id',
    'ngay_tao', 'nguoi_tao', 'ngay_cap_nhat', 'nguoi_cap_nhat'
  ],

  TEP_DINH_KEM: [
    'file_id', 'ho_so_id', 'hop_dong_id', 'loai', 'nguon', 'ten_hien_thi',
    'drive_file_id', 'mime', 'dung_luong', 'thoi_luong_giay',
    'phien_ban', 'thay_the_cho', 'mo_ta', 'cho_doi_tac_xem', 'nhay_cam',
    'lan_kiem_tra_cuoi', 'link_con_song',
    'ngay_tao', 'nguoi_tai'
  ],

  PHIEU_CHIA_SE: [
    'share_id', 'ho_so_id', 'don_vi_id', 'email_nhan', 'dien_thoai_nhan',
    'token_hash', 'phuong_thuc_xac_thuc', 'pin_hash', 'pin_salt',
    'ngay_cap', 'het_han', 'so_luot_toi_da', 'so_luot_da_dung',
    'so_lan_sai', 'khoa_den', 'pham_vi_tep', 'trang_thai',
    'nguoi_cap', 'ly_do_thu_hoi', 'ngay_thu_hoi'
  ],

  LUOT_TRUY_CAP: [
    'id', 'share_id', 'ho_so_id', 'thoi_gian', 'ip', 'user_agent',
    'ket_qua', 'tep_da_mo'
  ],

  NHAT_KY: [
    'log_id', 'thoi_gian', 'user_id', 'hanh_dong', 'bang', 'doi_tuong_id',
    'gia_tri_cu', 'gia_tri_moi', 'ip', 'ket_qua', 'chi_tiet'
  ],

  PHIEN: [
    'phien_id', 'user_id', 'token_hash', 'tao_luc', 'het_han',
    'dau_van_tay_thiet_bi', 'tin_cay_den', 'ip', 'trang_thai'
  ],

  DANH_MUC: ['id', 'loai_danh_muc', 'ma', 'ten', 'thu_tu', 'dang_dung'],

  OTP: [
    'otp_id', 'loai', 'doi_tuong_id', 'email', 'ma_hash', 'salt',
    'tao_luc', 'het_han', 'so_lan_thu', 'da_dung', 'ip'
  ]
};

/** Thứ tự tab hiển thị trong file Sheet. */
const THU_TU_TAB = [
  'CAU_HINH', 'DANH_MUC', 'DON_VI', 'NGUOI_DUNG',
  'HO_SO', 'HO_SO_DON_VI', 'HOP_DONG', 'THANH_TOAN', 'TEP_DINH_KEM',
  'PHIEU_CHIA_SE', 'LUOT_TRUY_CAP', 'PHIEN', 'OTP', 'NHAT_KY'
];
