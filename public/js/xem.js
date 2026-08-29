/**
 * js/xem.js — Trang tra cứu dành cho đối tác quét mã QR.
 *
 * Trang này chạy không cần đăng nhập, nên chỉ nói chuyện với /api/chiase
 * và không bao giờ giữ token nào trong bộ nhớ trình duyệt: phiên xem nằm
 * trong cookie httpOnly do máy chủ đặt.
 */

import { dat, soVn, ngayVn, chu, $ } from './api.js';
import { giaySangChu } from './hoso-chung.js';

const BIEU_TUONG = { HOP_DONG: '📄', DOC: '📝', AUDIO: '🎵', IMAGE: '🖼️', VIDEO: '🎬' };

const token = new URLSearchParams(location.search).get('t') || '';
let dongHoId = null;

/* ---------- Khởi động ---------- */

(async function batDau() {
  if (!token) return hienLoi('Đường dẫn thiếu mã phiếu chia sẻ.');

  let d;
  try {
    d = await goi('xem', { token });
  } catch (e) {
    return hienLoi(e.message);
  }

  if (!d.hop_le) return hienLoi(d.ly_do);

  chu($('tenChuongTrinh'), d.ten_chuong_trinh);
  chu($('maHoSo'), `Mã hồ sơ: ${d.ho_so_id}`);
  document.title = `${d.ten_chuong_trinh} — Tra cứu hồ sơ HTV`;

  hienBuoc('buocXacThuc');

  if (d.phuong_thuc === 'OTP') {
    chu($('emailChe'), d.email_che);
    $('cachOtp').classList.remove('an');
  } else {
    chu($('nhanMa'), 'Nhập mã PIN 6 chữ số do Ban Kế hoạch – Tài chính cấp');
    $('formMa').classList.remove('an');
    oMa[0].focus();
  }
})();

function goi(viec, than) {
  return dat('/api/chiase?viec=' + viec, than);
}

function hienBuoc(id) {
  for (const b of ['buocTai', 'buocLoi', 'buocXacThuc', 'buocNoiDung']) {
    $(b).classList.toggle('an', b !== id);
  }
}

function hienLoi(thongDiep) {
  chu($('lyDoLoi'), thongDiep);
  hienBuoc('buocLoi');
}

function loi(thongDiep) {
  chu($('baoLoi'), thongDiep);
  $('baoLoi').classList.remove('an');
  $('baoTin').classList.add('an');
}

function tin(thongDiep) {
  chu($('baoTin'), thongDiep);
  $('baoTin').classList.remove('an');
  $('baoLoi').classList.add('an');
}

async function cho(nut, viec) {
  const chuGoc = nut.textContent;
  nut.disabled = true;
  nut.innerHTML = '<span class="quay"></span>';
  nut.append('Đang xử lý…');
  try {
    await viec();
  } catch (e) {
    loi(e.message);
  } finally {
    nut.disabled = false;
    nut.textContent = chuGoc;
  }
}

/* ---------- Gửi mã ---------- */

$('nutGuiMa').addEventListener('click', (ev) => cho(ev.currentTarget, async () => {
  const d = await goi('gui', { token });
  $('cachOtp').classList.add('an');
  $('formMa').classList.remove('an');
  $('nutGuiLai').classList.remove('an');
  tin(`Đã gửi mã tới ${d.email_che}. Mã có hiệu lực trong ít phút.`);
  demNguoc(d.het_han);
  oMa[0].focus();
}));

$('nutGuiLai').addEventListener('click', (ev) => cho(ev.currentTarget, async () => {
  const d = await goi('gui', { token });
  for (const o of oMa) o.value = '';
  oMa[0].focus();
  tin('Đã gửi mã mới.');
  demNguoc(d.het_han);
}));

function demNguoc(hetHan) {
  clearInterval(dongHoId);
  const dich = new Date(hetHan).getTime();
  const nut = $('nutGuiLai');
  nut.disabled = true;

  const ve = () => {
    const con = Math.max(0, Math.round((dich - Date.now()) / 1000));
    const p = String(Math.floor(con / 60)).padStart(2, '0');
    const g = String(con % 60).padStart(2, '0');
    chu($('dongHo'), con ? `Mã hết hạn sau ${p}:${g}` : 'Mã đã hết hạn');
    if (con <= 240) nut.disabled = false;
    if (!con) clearInterval(dongHoId);
  };
  ve();
  dongHoId = setInterval(ve, 1000);
}

/* ---------- Ô nhập mã ---------- */

const oMa = [...$('oMa').querySelectorAll('input')];

oMa.forEach((o, i) => {
  o.addEventListener('input', () => {
    o.value = o.value.replace(/\D/g, '').slice(0, 1);
    if (o.value && i < oMa.length - 1) oMa[i + 1].focus();
  });
  o.addEventListener('keydown', (ev) => {
    if (ev.key === 'Backspace' && !o.value && i > 0) oMa[i - 1].focus();
  });
  o.addEventListener('paste', (ev) => {
    const so = (ev.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!so) return;
    ev.preventDefault();
    so.split('').forEach((c, k) => { if (oMa[k]) oMa[k].value = c; });
    oMa[Math.min(so.length, 5)].focus();
  });
});

$('formMa').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const ma = oMa.map((o) => o.value).join('');
  if (ma.length !== 6) return loi('Vui lòng nhập đủ 6 chữ số.');

  cho($('formMa').querySelector('[type=submit]'), async () => {
    const d = await goi('xacthuc', { token, ma });
    clearInterval(dongHoId);
    veNoiDung(d.noi_dung);
  });
});

/* ---------- Hiển thị hồ sơ ---------- */

function veNoiDung(nd) {
  hienBuoc('buocNoiDung');
  document.title = `${nd.ten_chuong_trinh} — Hồ sơ HTV`;

  chu($('ndTen'), nd.ten_chuong_trinh);
  chu($('ndMa'), `Mã hồ sơ: ${nd.ho_so_id}` + (nd.ma_don_vi ? ` · Mã đơn vị: ${nd.ma_don_vi}` : ''));

  const dong = [
    ['Đơn vị chủ quản', nd.don_vi_chu_quan],
    ['Thể loại', nd.the_loai || '—'],
    ['Kênh phát sóng', nd.kenh || '—'],
    ['Thời lượng', nd.thoi_luong_giay ? giaySangChu(nd.thoi_luong_giay) : '—'],
    ['Ngày phát sóng', nd.ngay_phat_song ? ngayVn(nd.ngay_phat_song) : '—'],
    ['Giờ phát sóng', nd.gio_phat_song || '—'],
    ['Ghi chú lịch', nd.ghi_chu_lich || '—']
  ];

  const tbody = $('ndBang');
  tbody.replaceChildren();
  for (const [nhan, giaTri] of dong) {
    const tr = document.createElement('tr');
    const a = document.createElement('td');
    a.textContent = nhan;
    const b = document.createElement('td');
    b.textContent = giaTri;
    tr.append(a, b);
    tbody.append(tr);
  }

  chu($('ndMoTa'), nd.mo_ta || '');
  chu($('ndHetHan'), nd.het_han_phieu
    ? `Quyền truy cập này có hiệu lực đến ${ngayVn(nd.het_han_phieu)}.` : '');

  veTep(nd.tep, nd.duoc_tai);
}

/** Ghi lại việc đối tác mở hay tải tệp. Ghi hỏng cũng không được cản việc xem. */
function ghiLuot(viec, tenTep) {
  goi('motep', { viec, ten_tep: tenTep }).catch(() => {});
}

function veTep(ds, duocTai) {
  chu($('ndSoTep'), ds.length
    ? `${ds.length} tệp được chia sẻ với đơn vị của bạn.`
    : 'Hồ sơ này chưa chia sẻ tệp nào.');

  const vung = $('ndTep');
  vung.replaceChildren();

  for (const t of ds) {
    const hang = document.createElement('div');
    hang.className = 'tep-hang';

    const icon = document.createElement('div');
    icon.className = 'tep-icon';
    icon.textContent = BIEU_TUONG[t.loai] || '📎';

    const giua = document.createElement('div');
    giua.style.minWidth = '0';
    const ten = document.createElement('div');
    ten.className = 'tep-ten';
    ten.textContent = t.ten_hien_thi;
    const phu = document.createElement('div');
    phu.className = 'tep-phu';
    phu.textContent = [t.ten_loai, dungLuong(t.dung_luong), t.mo_ta].filter(Boolean).join(' · ');
    giua.append(ten, phu);

    const nut = document.createElement('div');
    nut.className = 'hang-nut';
    nut.style.marginLeft = 'auto';

    const xem = document.createElement('button');
    xem.type = 'button';
    xem.className = 'nut-nho';
    xem.textContent = 'Xem';
    xem.addEventListener('click', () => moTep(t));
    nut.append(xem);

    if (duocTai && t.url_tai) {
      // Dùng thẻ liên kết chứ không phải nút, để trình duyệt tự lo phần tải xuống.
      const tai = document.createElement('a');
      tai.className = 'nut-nho';
      tai.style.textDecoration = 'none';
      tai.href = t.url_tai;
      tai.target = '_blank';
      tai.rel = 'noopener';
      tai.textContent = 'Tải xuống';
      tai.addEventListener('click', () => {
        ghiLuot('TAI_TEP', t.ten_hien_thi);
      });
      nut.append(tai);
    }

    hang.append(icon, giua, nut);
    vung.append(hang);
  }
}

/**
 * Mở tệp bằng trình xem nhúng của Drive. Không in đường dẫn tệp gốc ra trang,
 * để người xem không chép được link mang đi nơi khác.
 */
function moTep(t) {
  ghiLuot('MO_TEP', t.ten_hien_thi);

  const che = document.createElement('div');
  che.className = 'man-che';

  const hop = document.createElement('div');
  hop.className = 'hop-thoai';
  hop.style.maxWidth = t.loai === 'AUDIO' ? '520px' : '900px';
  hop.setAttribute('role', 'dialog');
  hop.setAttribute('aria-modal', 'true');

  const dau = document.createElement('div');
  dau.className = 'hop-thoai-dau';
  const h2 = document.createElement('h2');
  h2.textContent = t.ten_hien_thi;
  h2.style.cssText = 'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
  const x = document.createElement('button');
  x.className = 'nut-x';
  x.type = 'button';
  x.textContent = '✕';
  x.setAttribute('aria-label', 'Đóng');

  if (t.url_tai) {
    const tai = document.createElement('a');
    tai.className = 'nut-nho';
    tai.style.cssText = 'text-decoration:none;margin-left:auto';
    tai.href = t.url_tai;
    tai.target = '_blank';
    tai.rel = 'noopener';
    tai.textContent = 'Tải xuống';
    tai.addEventListener('click', () => ghiLuot('TAI_TEP', t.ten_hien_thi));
    dau.append(h2, tai, x);
  } else {
    dau.append(h2, x);
  }

  const than = document.createElement('div');
  than.className = 'hop-thoai-than';
  than.style.padding = '0';

  const khung = document.createElement('iframe');
  khung.src = t.url_nhung;
  khung.title = t.ten_hien_thi;
  khung.style.cssText = `width:100%;border:0;display:block;height:${t.loai === 'AUDIO' ? '80px' : '520px'}`;
  than.append(khung);

  hop.append(dau, than);
  che.append(hop);

  const dong = () => { che.remove(); document.removeEventListener('keydown', esc); };
  const esc = (ev) => { if (ev.key === 'Escape') dong(); };
  x.addEventListener('click', dong);
  che.addEventListener('click', (ev) => { if (ev.target === che) dong(); });
  document.addEventListener('keydown', esc);

  $('vungXem').append(che);
}

function dungLuong(byte) {
  const n = Number(byte || 0);
  if (!n) return '';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
  return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}
