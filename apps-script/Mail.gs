/**
 * Mail.gs — Gửi thư. Tài khoản Gmail cá nhân chỉ có 100 thư mỗi ngày,
 * nên mọi nơi gọi đều phải kiểm tra hạn mức trước.
 */

function tenHeThong_() {
  return getCauHinh('TEN_HE_THONG', 'Cổng quản trị hồ sơ chương trình — Ban Kế hoạch – Tài chính HTV');
}

function guiMailOtp_(user, ma, soPhut) {
  const tieuDe = 'Mã xác thực đăng nhập: ' + ma;
  const noiDung = khungMail_(
    'Mã xác thực đăng nhập',
    '<p style="margin:0 0 16px">Xin chào <strong>' + thoat_(user.ho_ten) + '</strong>,</p>'
    + '<p style="margin:0 0 20px">Mã xác thực để đăng nhập vào hệ thống của bạn là:</p>'
    + oMa_(ma)
    + '<p style="margin:20px 0 0;font-size:14px;color:#4a5a70">Mã có hiệu lực trong '
    + soPhut + ' phút và chỉ dùng được một lần.</p>'
    + '<p style="margin:16px 0 0;font-size:14px;color:#4a5a70">Nếu bạn không thực hiện thao tác '
    + 'đăng nhập nào, hãy bỏ qua thư này và báo ngay cho quản trị viên hệ thống.</p>'
  );

  MailApp.sendEmail({
    to: user.email,
    subject: tieuDe,
    htmlBody: noiDung,
    body: 'Ma xac thuc dang nhap: ' + ma + ' (hieu luc ' + soPhut + ' phut).',
    name: 'Ban Kế hoạch – Tài chính HTV'
  });
}

function guiMailMatKhauMoi_(user, matKhau) {
  MailApp.sendEmail({
    to: user.email,
    subject: 'Mật khẩu mới cho tài khoản ' + user.username,
    htmlBody: khungMail_(
      'Mật khẩu đã được đặt lại',
      '<p style="margin:0 0 16px">Xin chào <strong>' + thoat_(user.ho_ten) + '</strong>,</p>'
      + '<p style="margin:0 0 20px">Quản trị viên vừa đặt lại mật khẩu cho tài khoản '
      + '<strong>' + thoat_(user.username) + '</strong>. Mật khẩu tạm thời của bạn là:</p>'
      + oMa_(matKhau)
      + '<p style="margin:20px 0 0;font-size:14px;color:#4a5a70">Hệ thống sẽ yêu cầu bạn đổi '
      + 'mật khẩu ngay ở lần đăng nhập kế tiếp.</p>'
    ),
    body: 'Mat khau tam thoi: ' + matKhau,
    name: 'Ban Kế hoạch – Tài chính HTV'
  });
}

/* ---------- Khung thư dùng chung ---------- */

function khungMail_(tieuDe, than) {
  return ''
    + '<div style="margin:0;padding:24px 12px;background:#f4f6f9;'
    + 'font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">'
    + '<div style="max-width:520px;margin:0 auto;background:#ffffff;'
    + 'border:1px solid #d4dbe5;border-radius:6px;overflow:hidden">'

    + '<div style="background:#0d2748;border-bottom:3px solid #b3862f;padding:18px 24px">'
    + '<div style="color:rgba(255,255,255,.85);font-size:12px;letter-spacing:1.4px;'
    + 'text-transform:uppercase;font-weight:600">Đài Phát thanh - Truyền hình TP. Hồ Chí Minh</div>'
    + '<div style="color:#a8bcd8;font-size:11px;letter-spacing:1.1px;'
    + 'text-transform:uppercase;margin-top:2px">Ban Kế hoạch – Tài chính</div>'
    + '</div>'

    + '<div style="padding:24px">'
    + '<h1 style="margin:0 0 18px;font-size:19px;color:#0d2748;font-weight:600">'
    + thoat_(tieuDe) + '</h1>'
    + '<div style="font-size:15px;line-height:1.6;color:#0f1b2b">' + than + '</div>'
    + '</div>'

    + '<div style="padding:14px 24px;background:#eaeef4;border-top:1px solid #d4dbe5;'
    + 'font-size:12px;color:#7b8aa0">Thư tự động từ ' + thoat_(tenHeThong_())
    + '. Vui lòng không trả lời thư này.</div>'

    + '</div></div>';
}

function oMa_(ma) {
  return '<div style="text-align:center;margin:0"><span style="display:inline-block;'
    + 'font-family:Consolas,Menlo,monospace;font-size:30px;font-weight:600;letter-spacing:8px;'
    + 'color:#0d2748;background:#f4f6f9;border:1px solid #d4dbe5;border-radius:6px;'
    + 'padding:14px 20px 14px 28px">' + thoat_(ma) + '</span></div>';
}

/** Thoát ký tự HTML — dữ liệu người dùng không bao giờ ghép thẳng vào thư. */
function thoat_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
