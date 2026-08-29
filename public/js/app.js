/**
 * js/app.js — Bảng điều khiển. Giai đoạn 1 mới hiển thị thông tin phiên và quyền;
 * các ô số liệu về hồ sơ sẽ có nội dung thật ở Giai đoạn 2.
 */

import { goiCanDangNhap, soVn, gioVn, chu, $ } from './api.js';
import { dungKhung, coQuyen, bao, cho, toi } from './khung.js';

const NHAN_QUYEN = {
  '*': 'Toàn quyền',
  'ho_so.xem_tat_ca': 'Xem mọi hồ sơ',
  'ho_so.xem_don_vi': 'Xem hồ sơ đơn vị mình',
  'ho_so.xem_duoc_gan': 'Xem hồ sơ được gán',
  'ho_so.xem_theo_phieu': 'Xem theo phiếu chia sẻ',
  'ho_so.them': 'Tạo hồ sơ',
  'ho_so.sua_tat_ca': 'Sửa mọi hồ sơ',
  'ho_so.sua_don_vi': 'Sửa hồ sơ đơn vị mình',
  'ho_so.xoa': 'Xoá hồ sơ',
  'ho_so.duyet': 'Duyệt hồ sơ',
  'ho_so.gui_duyet': 'Gửi duyệt',
  'hop_dong.xem': 'Xem hợp đồng',
  'hop_dong.xem_cua_minh': 'Xem hợp đồng của mình',
  'hop_dong.sua': 'Sửa hợp đồng',
  'tep.xem': 'Xem tệp',
  'tep.tai_len': 'Tải tệp lên',
  'tep.xoa': 'Xoá tệp',
  'chia_se.cap': 'Cấp phiếu chia sẻ',
  'chia_se.thu_hoi': 'Thu hồi phiếu',
  'chia_se.xem': 'Xem phiếu chia sẻ',
  'chia_se.de_nghi': 'Đề nghị chia sẻ',
  'don_vi.xem': 'Xem đơn vị',
  'don_vi.sua': 'Sửa đơn vị',
  'nguoi_dung.xem': 'Xem người dùng',
  'nhat_ky.xem': 'Xem nhật ký',
  'bao_cao.xem': 'Xem báo cáo'
};

(async function batDau() {
  const me = await dungKhung({ trangHienTai: '/app' });
  if (!me) return;

  chu($('chaoTen'), me.ho_ten);
  veBangToi(me);
  veQuyen(me);

  if (coQuyen('cau_hinh.xem')) await veSoLieu();
})();

function veBangToi(me) {
  const dong = [
    ['Tên đăng nhập', me.username],
    ['Họ tên', me.ho_ten],
    ['Email nhận mã', me.email],
    ['Vai trò', me.ten_nhom],
    ['Đơn vị', me.ten_don_vi || '—']
  ];

  const tbody = $('bangToi');
  tbody.replaceChildren();

  for (const [nhan, giaTri] of dong) {
    const tr = document.createElement('tr');
    const th = document.createElement('td');
    th.style.cssText = 'width:40%;color:var(--chu-nhat)';
    th.textContent = nhan;
    const td = document.createElement('td');
    td.style.fontWeight = '500';
    td.textContent = giaTri;
    tr.append(th, td);
    tbody.append(tr);
  }
}

function veQuyen(me) {
  const vung = $('dsQuyen');
  vung.replaceChildren();

  for (const q of me.quyen) {
    const chip = document.createElement('span');
    chip.className = 'trang-thai ' + (q === '*' ? 'tot' : 'cho');
    chip.style.textTransform = 'none';
    chip.textContent = NHAN_QUYEN[q] || q;
    chip.title = q;
    vung.append(chip);
  }
}

async function veSoLieu() {
  let d;
  try {
    d = await goiCanDangNhap('tinhTrangHeThong');
  } catch (e) {
    bao(e.message, 'loi', 6);
    return;
  }

  const o = [
    { so: soVn(d.so_nguoi_dung), ten: 'Tài khoản' },
    { so: soVn(d.so_don_vi), ten: 'Đơn vị & đối tác' },
    { so: soVn(d.phien_dang_mo), ten: 'Phiên đang mở' },
    {
      so: soVn(d.email_con_lai),
      ten: 'Email còn lại hôm nay',
      canhBao: d.email_con_lai <= d.email_nguong_canh_bao
    }
  ];

  const vung = $('oSoLieu');
  vung.replaceChildren();

  for (const m of o) {
    const div = document.createElement('div');
    div.className = 'o-so';
    if (m.canhBao) div.style.borderTopColor = 'var(--canh-bao)';

    const s = document.createElement('div');
    s.className = 'con-so';
    if (m.canhBao) s.style.color = 'var(--canh-bao)';
    s.textContent = m.so;

    const t = document.createElement('div');
    t.className = 'ten';
    t.textContent = m.ten;

    div.append(s, t);
    vung.append(div);
  }

  if (d.che_do_kiem_tra) {
    bao('Chế độ kiểm tra đang bật — một số API gọi được mà không cần đăng nhập. '
      + 'Hãy tắt trong mục Quản trị trước khi dùng thật.', 'canh-bao', 9);
  }
}

$('nutQuenThietBi').addEventListener('click', (ev) => {
  cho(ev.currentTarget, async () => {
    const r = await fetch('/api/quenthietbi', { method: 'POST' }).then((x) => x.json());
    if (!r.ok) throw new Error(r.loi);
    bao(`Đã huỷ ghi nhớ ${r.data.da_huy} thiết bị. Lần sau sẽ phải nhập mã xác thực.`);
  });
});
