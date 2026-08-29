/**
 * js/quantri.js — Bốn mục quản trị: người dùng, đơn vị, cấu hình, nhật ký.
 * Mục nào hiện ra là do quyền của người đang đăng nhập quyết định.
 */

import { goiCanDangNhap as api, soVn, gioVn, chu, $ } from './api.js';
import { dungKhung, coQuyen, bao, cho } from './khung.js';

const MUC = [
  { ma: 'NguoiDung', ten: 'Người dùng', quyen: 'nguoi_dung.xem', nap: napNguoiDung },
  { ma: 'DonVi', ten: 'Đơn vị & đối tác', quyen: 'don_vi.xem', nap: napDonVi },
  { ma: 'CauHinh', ten: 'Cấu hình', quyen: 'cau_hinh.xem', nap: napCauHinh },
  { ma: 'NhatKy', ten: 'Nhật ký', quyen: 'nhat_ky.xem', nap: napNhatKy }
];

const kho = { nguoiDung: [], donVi: [], cauHinh: [], trangNhatKy: 1 };

/* ---------- Khởi động ---------- */

(async function batDau() {
  const me = await dungKhung({ trangHienTai: '/quan-tri' });
  if (!me) return;

  const duoc = MUC.filter((m) => coQuyen(m.quyen));
  if (!duoc.length) {
    bao('Tài khoản của bạn không có quyền vào mục quản trị.', 'loi', 8);
    return;
  }

  const thanh = $('thanhThe');
  for (const m of duoc) {
    const b = document.createElement('button');
    b.className = 'the-muc';
    b.textContent = m.ten;
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.addEventListener('click', () => moMuc(m.ma));
    b.dataset.ma = m.ma;
    thanh.append(b);
  }

  // Cho phép mở thẳng một mục bằng dấu thăng trên địa chỉ, ví dụ /quan-tri#NhatKy
  const yeuCau = location.hash.slice(1);
  moMuc(duoc.some((m) => m.ma === yeuCau) ? yeuCau : duoc[0].ma);
})();

async function moMuc(ma) {
  document.querySelectorAll('.muc').forEach((s) => s.classList.add('an'));
  document.querySelectorAll('.the-muc').forEach((b) => {
    b.classList.toggle('dang-o', b.dataset.ma === ma);
    b.setAttribute('aria-selected', b.dataset.ma === ma ? 'true' : 'false');
  });

  $('muc' + ma).classList.remove('an');
  history.replaceState(null, '', '#' + ma);

  const muc = MUC.find((m) => m.ma === ma);
  try {
    await muc.nap();
  } catch (e) {
    bao(e.message, 'loi', 7);
  }
}

/* ---------- Tiện ích dựng bảng ---------- */

function o(noiDung, lop) {
  const td = document.createElement('td');
  if (lop) td.className = lop;
  if (noiDung instanceof Node) td.append(noiDung);
  else td.textContent = noiDung ?? '';
  return td;
}

function chip(chu, loai) {
  const s = document.createElement('span');
  s.className = 'trang-thai ' + loai;
  s.textContent = chu;
  return s;
}

function nutNho(chu, viec, nguy) {
  const b = document.createElement('button');
  b.className = 'nut-nho' + (nguy ? ' nguy' : '');
  b.type = 'button';
  b.textContent = chu;
  b.addEventListener('click', () => viec(b));
  return b;
}

function hangNut(...nut) {
  const d = document.createElement('div');
  d.className = 'hang-nut';
  d.append(...nut);
  return d;
}

/* ================= NGƯỜI DÙNG ================= */

async function napNguoiDung() {
  kho.nguoiDung = await api('danhSachNguoiDung');
  if (!kho.donVi.length && coQuyen('don_vi.xem')) {
    kho.donVi = await api('danhSachDonViDayDu');
  }
  veNguoiDung();
}

function veNguoiDung() {
  const tu = $('timNguoiDung').value.toLowerCase().trim();
  const nhom = $('locNhom').value;

  const ds = kho.nguoiDung.filter((u) => {
    if (nhom && u.nhom !== nhom) return false;
    if (!tu) return true;
    return `${u.ho_ten} ${u.username} ${u.ten_don_vi} ${u.email}`.toLowerCase().includes(tu);
  });

  const tbody = $('bangNguoiDung');
  tbody.replaceChildren();
  $('trongNguoiDung').classList.toggle('an', ds.length > 0);

  for (const u of ds) {
    const ten = document.createElement('div');
    const d1 = document.createElement('div');
    d1.style.fontWeight = '500';
    d1.textContent = u.ho_ten;
    const d2 = document.createElement('div');
    d2.style.cssText = 'font-size:12.5px;color:var(--chu-mo)';
    d2.textContent = '@' + u.username;
    ten.append(d1, d2);

    const tt = u.trang_thai !== 'HOAT_DONG'
      ? chip('Đã khoá', 'loi')
      : u.dang_khoa ? chip('Khoá tạm', 'canh-bao')
      : u.buoc_doi_mk ? chip('Chờ đổi MK', 'cho')
      : chip('Hoạt động', 'tot');

    const nut = [];
    if (coQuyen('nguoi_dung.sua')) {
      nut.push(nutNho('Sửa', () => moHopThoaiNguoiDung(u)));
      nut.push(nutNho('Đặt lại MK', (b) => cho(b, async () => {
        if (!confirm(`Đặt lại mật khẩu cho ${u.ho_ten}?`)) return;
        const r = await api('datLaiMatKhau', { user_id: u.user_id });
        hienMatKhauTam(u, r);
        await napNguoiDung();
      })));
      if (u.dang_khoa) {
        nut.push(nutNho('Gỡ khoá', (b) => cho(b, async () => {
          await api('moKhoaNguoiDung', { user_id: u.user_id });
          bao('Đã gỡ khoá tạm.');
          await napNguoiDung();
        })));
      }
      if (u.username !== 'admin') {
        nut.push(nutNho(u.trang_thai === 'HOAT_DONG' ? 'Khoá' : 'Mở lại', (b) => cho(b, async () => {
          await api('doiTrangThaiNguoiDung', { user_id: u.user_id });
          bao('Đã đổi trạng thái tài khoản.');
          await napNguoiDung();
        }), u.trang_thai === 'HOAT_DONG'));
      }
    }

    const tr = document.createElement('tr');
    tr.append(
      o(ten), o(chip(u.ten_nhom, u.nhom === 'ADMIN' ? 'canh-bao' : 'cho')),
      o(u.ten_don_vi || '—'), o(u.email),
      o(u.lan_dang_nhap_cuoi ? gioVn(u.lan_dang_nhap_cuoi) : 'Chưa từng', 'so'),
      o(tt), o(hangNut(...nut))
    );
    tbody.append(tr);
  }
}

$('timNguoiDung').addEventListener('input', veNguoiDung);
$('locNhom').addEventListener('change', veNguoiDung);
$('nutThemNguoiDung').addEventListener('click', () => moHopThoaiNguoiDung(null));

function moHopThoaiNguoiDung(u) {
  const chonDonVi = kho.donVi
    .map((d) => `<option value="${d.don_vi_id}">${thoat(d.ten)}</option>`)
    .join('');

  moHopThoai({
    tieuDe: u ? 'Sửa tài khoản' : 'Thêm tài khoản',
    than: `
      <div class="truong">
        <label for="fHoTen">Họ tên hoặc tên đơn vị *</label>
        <input class="o-nhap" id="fHoTen" value="${thoat(u?.ho_ten || '')}">
      </div>
      ${u ? '' : `
      <div class="truong">
        <label for="fUsername">Tên đăng nhập</label>
        <input class="o-nhap" id="fUsername" placeholder="Để trống sẽ tự sinh từ họ tên">
        <p class="goi-y">Chỉ chữ thường và số, dấu tiếng Việt sẽ được bỏ tự động.</p>
      </div>`}
      <div class="truong">
        <label for="fEmail">Email nhận mã xác thực *</label>
        <input class="o-nhap" id="fEmail" type="email" value="${thoat(u?.email || '')}">
      </div>
      <div class="truong">
        <label for="fDienThoai">Điện thoại</label>
        <input class="o-nhap" id="fDienThoai" value="${thoat(u?.dien_thoai || '')}">
      </div>
      <div class="truong">
        <label for="fNhom">Vai trò *</label>
        <select class="o-nhap" id="fNhom">
          <option value="ADMIN">Quản trị hệ thống</option>
          <option value="KHTC">Ban Kế hoạch – Tài chính</option>
          <option value="DON_VI">Đơn vị chủ quản</option>
          <option value="DOI_TAC">Đối tác</option>
        </select>
      </div>
      <div class="truong">
        <label for="fDonVi">Đơn vị</label>
        <select class="o-nhap" id="fDonVi"><option value="">— Không gắn đơn vị —</option>${chonDonVi}</select>
      </div>
      <label style="display:flex;gap:8px;align-items:center;font-size:13.5px">
        <input type="checkbox" id="fBat2fa" ${u?.bat_2fa === false ? '' : 'checked'}>
        <span>Bắt buộc mã xác thực khi đăng nhập</span>
      </label>`,
    khiMo: () => {
      if (u) {
        $('fNhom').value = u.nhom;
        $('fDonVi').value = u.don_vi_id || '';
      }
    },
    tenLuu: u ? 'Lưu thay đổi' : 'Tạo tài khoản',
    luu: async () => {
      const r = await api('luuNguoiDung', {
        user_id: u?.user_id,
        ho_ten: $('fHoTen').value,
        username: u ? undefined : $('fUsername').value,
        email: $('fEmail').value,
        dien_thoai: $('fDienThoai').value,
        nhom: $('fNhom').value,
        don_vi_id: $('fDonVi').value,
        bat_2fa: $('fBat2fa').checked
      });
      await napNguoiDung();
      if (r.mat_khau_tam) hienMatKhauTam({ ho_ten: $('fHoTen').value, username: r.username }, r);
      else bao('Đã lưu tài khoản.');
    }
  });
}

function hienMatKhauTam(u, r) {
  moHopThoai({
    tieuDe: 'Mật khẩu tạm thời',
    than: `
      <p style="margin:0 0 14px;font-size:14px">
        Mật khẩu tạm cho <strong>${thoat(u.ho_ten)}</strong>
        (<code>${thoat(u.username || '')}</code>). Chỉ hiện một lần.
      </p>
      <div class="khoi-ma" style="text-align:center;font-size:20px;letter-spacing:2px">${thoat(r.mat_khau_tam)}</div>
      <p style="margin:14px 0 0;font-size:13.5px;color:var(--chu-nhat)">
        ${r.da_gui_mail
          ? 'Mật khẩu đã được gửi tới email của tài khoản.'
          : 'Chưa gửi được email (có thể đã hết hạn mức trong ngày). Hãy bàn giao mật khẩu trực tiếp.'}
        Người dùng sẽ phải đổi mật khẩu ngay ở lần đăng nhập đầu.
      </p>`,
    tenLuu: null
  });
}

/* ================= ĐƠN VỊ ================= */

async function napDonVi() {
  kho.donVi = await api('danhSachDonViDayDu');
  veDonVi();
}

function veDonVi() {
  const tu = $('timDonVi').value.toLowerCase().trim();
  const loai = $('locLoai').value;

  const ds = kho.donVi.filter((d) => {
    if (loai && d.loai !== loai) return false;
    if (!tu) return true;
    return `${d.ten} ${d.email} ${d.nguoi_lien_he}`.toLowerCase().includes(tu);
  });

  const tbody = $('bangDonVi');
  tbody.replaceChildren();

  for (const d of ds) {
    const nut = coQuyen('don_vi.sua') ? [nutNho('Sửa', () => moHopThoaiDonVi(d))] : [];
    const tr = document.createElement('tr');
    tr.append(
      o(d.ten),
      o(chip(d.loai === 'DOI_TAC' ? 'Đối tác' : 'Nội bộ', d.loai === 'DOI_TAC' ? 'canh-bao' : 'cho')),
      o(d.nguoi_lien_he || '—'), o(d.email || '—'), o(d.dien_thoai || '—'),
      o(hangNut(...nut))
    );
    tbody.append(tr);
  }
}

$('timDonVi').addEventListener('input', veDonVi);
$('locLoai').addEventListener('change', veDonVi);
$('nutThemDonVi').addEventListener('click', () => moHopThoaiDonVi(null));

function moHopThoaiDonVi(d) {
  moHopThoai({
    tieuDe: d ? 'Sửa đơn vị' : 'Thêm đơn vị',
    than: `
      <div class="truong">
        <label for="gTen">Tên đơn vị *</label>
        <input class="o-nhap" id="gTen" value="${thoat(d?.ten || '')}">
      </div>
      <div class="truong">
        <label for="gLoai">Loại *</label>
        <select class="o-nhap" id="gLoai">
          <option value="NOI_BO">Đơn vị nội bộ của Đài</option>
          <option value="DOI_TAC">Đối tác bên ngoài</option>
        </select>
      </div>
      <div class="truong">
        <label for="gLienHe">Người liên hệ</label>
        <input class="o-nhap" id="gLienHe" value="${thoat(d?.nguoi_lien_he || '')}">
      </div>
      <div class="truong">
        <label for="gEmail">Email đầu mối</label>
        <input class="o-nhap" id="gEmail" type="email" value="${thoat(d?.email || '')}">
        <p class="goi-y">Với đối tác, đây là nơi nhận mã xác thực khi quét mã QR.</p>
      </div>
      <div class="truong">
        <label for="gDienThoai">Điện thoại</label>
        <input class="o-nhap" id="gDienThoai" value="${thoat(d?.dien_thoai || '')}">
      </div>
      <div class="truong">
        <label for="gMst">Mã số thuế</label>
        <input class="o-nhap" id="gMst" value="${thoat(d?.ma_so_thue || '')}">
      </div>
      <div class="truong">
        <label for="gDiaChi">Địa chỉ</label>
        <input class="o-nhap" id="gDiaChi" value="${thoat(d?.dia_chi || '')}">
      </div>`,
    khiMo: () => { if (d) $('gLoai').value = d.loai; },
    tenLuu: d ? 'Lưu thay đổi' : 'Tạo đơn vị',
    luu: async () => {
      await api('luuDonVi', {
        don_vi_id: d?.don_vi_id,
        ten: $('gTen').value, loai: $('gLoai').value,
        nguoi_lien_he: $('gLienHe').value, email: $('gEmail').value,
        dien_thoai: $('gDienThoai').value, ma_so_thue: $('gMst').value,
        dia_chi: $('gDiaChi').value
      });
      await napDonVi();
      bao('Đã lưu đơn vị.');
    }
  });
}

/* ================= CẤU HÌNH ================= */

async function napCauHinh() {
  const [ds, tt] = await Promise.all([api('layCauHinh'), api('tinhTrangHeThong')]);
  kho.cauHinh = ds;

  const tbody = $('bangCauHinh');
  tbody.replaceChildren();

  for (const c of ds) {
    const inp = document.createElement('input');
    inp.className = 'o-nhap';
    inp.value = c.gia_tri ?? '';
    inp.dataset.khoa = c.khoa;
    if (c.khoa === 'DRIVE_ROOT_FOLDER_ID') inp.readOnly = true;

    const ma = document.createElement('code');
    ma.textContent = c.khoa;

    const tr = document.createElement('tr');
    tr.append(o(ma), o(inp), o(c.mo_ta || ''));
    tbody.append(tr);
  }

  const bangTt = $('bangTinhTrang');
  bangTt.replaceChildren();

  const dong = [
    ['Email còn lại hôm nay', `${soVn(tt.email_con_lai)} / 100`],
    ['Tài khoản', soVn(tt.so_nguoi_dung)],
    ['Đơn vị & đối tác', soVn(tt.so_don_vi)],
    ['Hồ sơ', soVn(tt.so_ho_so)],
    ['Phiên đang mở', soVn(tt.phien_dang_mo)],
    ['Thiết bị tin cậy', soVn(tt.thiet_bi_tin_cay)],
    ['Chế độ kiểm tra', tt.che_do_kiem_tra ? 'Đang bật' : 'Đã tắt']
  ];

  for (const [nhan, giaTri] of dong) {
    const tr = document.createElement('tr');
    const a = o(nhan);
    a.style.color = 'var(--chu-nhat)';
    const b = o(giaTri, 'so');
    b.style.fontWeight = '500';
    if (nhan === 'Email còn lại hôm nay' && tt.email_con_lai <= tt.email_nguong_canh_bao) {
      b.style.color = 'var(--canh-bao)';
    }
    if (nhan === 'Chế độ kiểm tra' && tt.che_do_kiem_tra) b.style.color = 'var(--canh-bao)';
    tr.append(a, b);
    bangTt.append(tr);
  }

  const vung = $('thuMucHienTai');
  vung.replaceChildren();
  if (tt.thu_muc_goc) {
    const d = document.createElement('div');
    d.className = 'thong-bao tot';
    d.textContent = 'Đang dùng: ' + tt.thu_muc_goc.ten;
    vung.append(d);
  } else {
    const d = document.createElement('div');
    d.className = 'thong-bao canh-bao';
    d.textContent = 'Chưa đặt thư mục gốc. Hồ sơ sẽ không tạo được thư mục lưu tài liệu.';
    vung.append(d);
  }
}

$('nutLuuCauHinh').addEventListener('click', (ev) => cho(ev.currentTarget, async () => {
  const thayDoi = {};
  document.querySelectorAll('#bangCauHinh input[data-khoa]').forEach((i) => {
    if (!i.readOnly) thayDoi[i.dataset.khoa] = i.value;
  });
  const r = await api('luuCauHinh', { thay_doi: thayDoi });
  bao(r.da_luu.length ? `Đã lưu ${r.da_luu.length} tham số.` : 'Không có thay đổi nào.');
  await napCauHinh();
}));

$('nutKiemTraThuMuc').addEventListener('click', (ev) => cho(ev.currentTarget, async () => {
  const kq = await api('kiemTraThuMuc', { id_hoac_link: $('oThuMuc').value });
  const vung = $('ketQuaThuMuc');
  vung.replaceChildren();

  const d = document.createElement('div');
  d.className = 'thong-bao ' + (kq.ghi_duoc ? 'tot' : 'loi');
  d.textContent = kq.ghi_duoc
    ? `Mở được thư mục “${kq.ten}” và ghi được vào đó. Có thể lưu.`
    : `Mở được thư mục “${kq.ten}” nhưng không ghi được. Hãy chia sẻ với quyền Người chỉnh sửa.`;
  vung.append(d);

  $('nutLuuThuMuc').disabled = !kq.ghi_duoc;
}));

$('nutLuuThuMuc').addEventListener('click', (ev) => cho(ev.currentTarget, async () => {
  const kq = await api('luuThuMucGoc', { id_hoac_link: $('oThuMuc').value });
  bao(`Đã đặt thư mục gốc: ${kq.ten}`);
  $('oThuMuc').value = '';
  $('nutLuuThuMuc').disabled = true;
  $('ketQuaThuMuc').replaceChildren();
  await napCauHinh();
}));

/* ================= NHẬT KÝ ================= */

async function napNhatKy() {
  const d = await api('xemNhatKy', {
    trang: kho.trangNhatKy,
    moi_trang: 50,
    tu_khoa: $('timNhatKy').value,
    hanh_dong: $('locHanhDong').value
  });

  const chon = $('locHanhDong');
  if (chon.options.length <= 1) {
    for (const h of d.hanh_dong_co) {
      if (!h) continue;
      const opt = document.createElement('option');
      opt.value = h;
      opt.textContent = h;
      chon.append(opt);
    }
  }

  const tbody = $('bangNhatKy');
  tbody.replaceChildren();

  for (const r of d.dong) {
    const tr = document.createElement('tr');
    tr.append(
      o(gioVn(r.thoi_gian), 'so'),
      o(r.nguoi),
      o(r.hanh_dong),
      o(r.chi_tiet || '—'),
      o(r.ip || '—', 'so'),
      o(chip(r.ket_qua === 'THANH_CONG' ? 'Thành công' : 'Thất bại',
             r.ket_qua === 'THANH_CONG' ? 'tot' : 'loi'))
    );
    tbody.append(tr);
  }

  chu($('tongNhatKy'), `${soVn(d.tong)} bản ghi`);
  chu($('soTrang'), `Trang ${d.trang} / ${d.so_trang}`);
  $('nutTruoc').disabled = d.trang <= 1;
  $('nutSau').disabled = d.trang >= d.so_trang;
}

let hoanTim = null;
$('timNhatKy').addEventListener('input', () => {
  clearTimeout(hoanTim);
  hoanTim = setTimeout(() => { kho.trangNhatKy = 1; napNhatKy().catch((e) => bao(e.message, 'loi')); }, 350);
});

$('locHanhDong').addEventListener('change', () => {
  kho.trangNhatKy = 1;
  napNhatKy().catch((e) => bao(e.message, 'loi'));
});

$('nutTruoc').addEventListener('click', () => { kho.trangNhatKy--; napNhatKy(); });
$('nutSau').addEventListener('click', () => { kho.trangNhatKy++; napNhatKy(); });

/* ================= HỘP THOẠI ================= */

function moHopThoai({ tieuDe, than, khiMo, tenLuu, luu }) {
  const che = document.createElement('div');
  che.className = 'man-che';
  che.innerHTML = `
    <div class="hop-thoai" role="dialog" aria-modal="true" aria-label="${thoat(tieuDe)}">
      <div class="hop-thoai-dau">
        <h2>${thoat(tieuDe)}</h2>
        <button class="nut-x" type="button" data-dong aria-label="Đóng">✕</button>
      </div>
      <div class="hop-thoai-than">${than}</div>
      <div class="hop-thoai-chan">
        <button class="nut nut-phu" type="button" data-dong>${tenLuu ? 'Huỷ' : 'Đóng'}</button>
        ${tenLuu ? `<button class="nut nut-chinh" type="button" data-luu>${thoat(tenLuu)}</button>` : ''}
      </div>
    </div>`;

  const dong = () => { che.remove(); document.removeEventListener('keydown', esc); };
  const esc = (ev) => { if (ev.key === 'Escape') dong(); };

  che.querySelectorAll('[data-dong]').forEach((b) => b.addEventListener('click', dong));
  che.addEventListener('click', (ev) => { if (ev.target === che) dong(); });
  document.addEventListener('keydown', esc);

  const nutLuu = che.querySelector('[data-luu]');
  if (nutLuu) {
    nutLuu.addEventListener('click', () => cho(nutLuu, async () => {
      await luu();
      dong();
    }));
  }

  $('vungHopThoai').append(che);
  khiMo?.();
  che.querySelector('input, select, textarea, button')?.focus();
}

/** Thoát ký tự HTML cho những chỗ buộc phải ghép chuỗi khi dựng hộp thoại. */
function thoat(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
