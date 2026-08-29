/**
 * js/nhap-excel.js — Nhập nhiều hồ sơ từ phiếu Excel của đơn vị.
 *
 * Ba bước: chọn phiếu ➜ đối chiếu từng dòng ➜ tạo hồ sơ.
 */

import { goiCanDangNhap as api, soVn, ngayVn, chu, $ } from './api.js';
import { dungKhung, coQuyen, bao, cho } from './khung.js';
import { giaySangChu } from './hoso-chung.js';

const TRAN_FILE = 3 * 1024 * 1024;

let ketQuaDoc = null;
let danhMuc = {};
let donViTatCa = [];
let locHienTai = '';

(async function batDau() {
  const me = await dungKhung({ trangHienTai: '/ho-so' });
  if (!me) return;

  if (!coQuyen('ho_so.them')) {
    chu($('tomTatDoc'), 'Tài khoản của bạn không có quyền tạo hồ sơ.');
    $('buocChon').classList.add('an');
    return;
  }

  [danhMuc, donViTatCa] = await Promise.all([api('layDanhMuc'), api('danhSachDonViDayDu')]);
})();

/* ---------- Bước 1: chọn phiếu ---------- */

const vungTha = $('vungTha');

vungTha.addEventListener('click', chonFile);
vungTha.addEventListener('dragover', (ev) => {
  ev.preventDefault();
  vungTha.classList.add('dang-keo');
});
vungTha.addEventListener('dragleave', () => vungTha.classList.remove('dang-keo'));
vungTha.addEventListener('drop', (ev) => {
  ev.preventDefault();
  vungTha.classList.remove('dang-keo');
  const f = ev.dataTransfer.files[0];
  if (f) doc(f);
});

function chonFile() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.xlsx';
  inp.addEventListener('change', () => { if (inp.files[0]) doc(inp.files[0]); });
  inp.click();
}

async function doc(file) {
  $('loiChon').classList.add('an');

  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return loiChon('Chỉ nhận file .xlsx. Nếu phiếu đang ở dạng .xls, hãy mở và lưu lại thành .xlsx.');
  }
  if (file.size > TRAN_FILE) {
    return loiChon(`Phiếu nặng ${(file.size / 1024 / 1024).toFixed(1)} MB, vượt mức 3 MB. `
      + 'Hãy xoá bớt hình ảnh hoặc định dạng thừa trong file.');
  }

  vungTha.classList.add('dang-doc');
  vungTha.replaceChildren();
  const quay = document.createElement('div');
  quay.className = 'quay';
  quay.style.cssText = 'width:22px;height:22px;border-color:rgba(13,39,72,.2);border-top-color:var(--navy-800)';
  const chuNoi = document.createElement('div');
  chuNoi.textContent = 'Đang đọc phiếu…';
  vungTha.append(quay, chuNoi);

  try {
    const b64 = await docBase64(file);
    ketQuaDoc = await api('docFileExcel', { ten: file.name, du_lieu: b64 });
    veXemTruoc();
  } catch (e) {
    veLaiVungTha();
    loiChon(e.message);
  }
}

function loiChon(thongDiep) {
  chu($('loiChon'), thongDiep);
  $('loiChon').classList.remove('an');
}

function veLaiVungTha() {
  vungTha.classList.remove('dang-doc');
  vungTha.replaceChildren();
  const a = document.createElement('div');
  a.style.cssText = 'font-size:32px;line-height:1';
  a.textContent = '📋';
  const b = document.createElement('div');
  b.style.fontWeight = '500';
  b.textContent = 'Kéo phiếu Excel vào đây';
  const c = document.createElement('div');
  c.style.cssText = 'font-size:13px;color:var(--chu-mo)';
  c.textContent = 'hoặc bấm để chọn từ máy';
  vungTha.append(a, b, c);
}

function docBase64(tep) {
  return new Promise((giai, tuChoi) => {
    const r = new FileReader();
    r.onload = () => giai(String(r.result).split(',')[1] || '');
    r.onerror = () => tuChoi(new Error('Không đọc được file từ máy của bạn.'));
    r.readAsDataURL(tep);
  });
}

/* ---------- Bước 2: đối chiếu ---------- */

function veXemTruoc() {
  const d = ketQuaDoc;

  if (!d.tong_dong) {
    veLaiVungTha();
    return loiChon('Phiếu không có dòng nào đọc được. Kiểm tra lại cột TÊN CHƯƠNG TRÌNH.');
  }

  $('buocChon').classList.add('an');
  $('buocXem').classList.remove('an');

  const coCanhBao = d.dong.filter((x) => x.canh_bao.length).length;
  chu($('tomTatDoc'),
    `Đọc được ${soVn(d.tong_dong)} dòng`
    + (coCanhBao ? `, trong đó ${soVn(coCanhBao)} dòng cần xem lại.` : '. Không có dòng nào cần xem lại.')
    + (d.cham_nguong ? ' Phiếu dài hơn mức tối đa nên chỉ lấy 300 dòng đầu.' : ''));

  // Đơn vị chủ quản
  const sel = $('fDonVi');
  sel.replaceChildren();
  const trong = document.createElement('option');
  trong.value = '';
  trong.textContent = '— Chọn đơn vị —';
  sel.append(trong);

  for (const dv of donViTatCa.filter((x) => x.loai === 'NOI_BO')) {
    const o = document.createElement('option');
    o.value = dv.don_vi_id;
    o.textContent = dv.ten;
    sel.append(o);
  }

  const dv = d.don_vi_doan_duoc;
  if (dv?.khop) {
    sel.value = dv.don_vi_id;
    chu($('goiYDonVi'), `Nhận ra từ dòng "ĐƠN VỊ: ${dv.ten_trong_file}" trong phiếu.`);
  } else if (dv) {
    chu($('goiYDonVi'), `Phiếu ghi "${dv.ten_trong_file}" nhưng không khớp đơn vị nào. Hãy chọn thủ công.`);
  } else {
    chu($('goiYDonVi'), 'Phiếu không có dòng "ĐƠN VỊ:". Hãy chọn thủ công.');
  }

  veCanhBaoChung(d);
  veLocDong(d.dong);
  veBang(d.dong);
}

function veCanhBaoChung(d) {
  const vung = $('canhBaoChung');
  vung.replaceChildren();

  if (d.cot_thieu.length) {
    const o = document.createElement('div');
    o.className = 'thong-bao loi';
    o.textContent = 'Phiếu thiếu cột bắt buộc: ' + d.cot_thieu.join(', ');
    vung.append(o);
  }

  const la = d.gia_tri_la.filter((x) => x.startsWith('kenh:')).map((x) => x.slice(5));
  if (la.length) {
    const o = document.createElement('div');
    o.className = 'thong-bao canh-bao';
    o.style.marginTop = '8px';
    o.textContent = 'Kênh chưa có trong danh mục: ' + la.join(', ')
      + '. Hồ sơ vẫn tạo được, giá trị được giữ nguyên như trong phiếu.';
    vung.append(o);
  }
}

function veLocDong(ds) {
  const vung = $('locDong');
  vung.replaceChildren();

  const coCanhBao = ds.filter((x) => x.canh_bao.length).length;
  const muc = [
    ['', 'Tất cả', ds.length],
    ['canh_bao', 'Cần xem lại', coCanhBao],
    ['co_link', 'Có link video', ds.filter((x) => x.link).length]
  ];

  for (const [ma, ten, so] of muc) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'vien-loc' + (locHienTai === ma ? ' dang-o' : '');
    b.append(ten);
    const dem = document.createElement('span');
    dem.className = 'dem';
    dem.textContent = soVn(so);
    b.append(dem);
    b.addEventListener('click', () => { locHienTai = ma; veLocDong(ds); veBang(ds); });
    vung.append(b);
  }
}

function veBang(ds) {
  const tbody = $('bangDong');
  tbody.replaceChildren();

  const hien = ds.filter((x) => {
    if (locHienTai === 'canh_bao') return x.canh_bao.length;
    if (locHienTai === 'co_link') return !!x.link;
    return true;
  });

  for (const d of hien) {
    const tr = document.createElement('tr');
    if (d.canh_bao.length) tr.style.background = 'var(--canh-bao-nen)';

    const oChon = document.createElement('td');
    const chon = document.createElement('input');
    chon.type = 'checkbox';
    chon.checked = d.chon !== false;
    chon.setAttribute('aria-label', 'Chọn dòng ' + d.dong_excel);
    chon.addEventListener('change', () => { d.chon = chon.checked; });
    oChon.append(chon);

    const ghiChu = document.createElement('td');
    if (d.canh_bao.length) {
      ghiChu.style.cssText = 'font-size:12.5px;color:var(--canh-bao)';
      ghiChu.textContent = d.canh_bao.join('; ');
    } else if (d.link) {
      ghiChu.style.cssText = 'font-size:12.5px;color:var(--tot)';
      ghiChu.textContent = 'Có link video';
    } else {
      ghiChu.textContent = '';
    }

    tr.append(
      oChon,
      o(d.dong_excel, 'so'),
      o(d.ma_don_vi, 'so'),
      o(d.ten_chuong_trinh),
      o(tenDanhMuc('THE_LOAI', d.the_loai)),
      o(tenDanhMuc('KENH', d.kenh)),
      o(d.ngay_phat_song ? ngayVn(d.ngay_phat_song) + (d.gio_phat_song ? ' · ' + d.gio_phat_song : '') : '—', 'so'),
      o(d.thoi_luong_giay ? giaySangChu(d.thoi_luong_giay) : '—', 'so'),
      o(d.ten_file || '—'),
      ghiChu
    );
    tbody.append(tr);
  }
}

function tenDanhMuc(loai, ma) {
  if (!ma) return '—';
  const m = (danhMuc[loai] || []).find((x) => x.ma === ma);
  return m ? m.ten : ma;
}

function o(noiDung, lop) {
  const td = document.createElement('td');
  if (lop) td.className = lop;
  td.textContent = noiDung ?? '';
  return td;
}

$('chonTatCa').addEventListener('change', (ev) => {
  for (const d of ketQuaDoc.dong) d.chon = ev.target.checked;
  veBang(ketQuaDoc.dong);
});

$('nutChonLai').addEventListener('click', quayVeChon);
$('nutNhapTiep').addEventListener('click', quayVeChon);

function quayVeChon() {
  ketQuaDoc = null;
  locHienTai = '';
  $('buocXem').classList.add('an');
  $('buocXong').classList.add('an');
  $('buocChon').classList.remove('an');
  veLaiVungTha();
}

/* ---------- Bước 3: tạo ---------- */

$('nutTao').addEventListener('click', (ev) => cho(ev.currentTarget, async () => {
  const donVi = $('fDonVi').value;
  if (!donVi) return bao('Vui lòng chọn đơn vị chủ quản.', 'canh-bao');

  const dong = ketQuaDoc.dong.filter((d) => d.chon !== false && d.thoi_luong_giay > 0);
  const boQua = ketQuaDoc.dong.filter((d) => d.chon !== false && !d.thoi_luong_giay).length;

  if (!dong.length) {
    return bao('Không có dòng nào đủ điều kiện. Dòng thiếu thời lượng sẽ bị bỏ qua.', 'canh-bao', 7);
  }

  const nhac = boQua
    ? `\n\n${boQua} dòng thiếu thời lượng sẽ bị bỏ qua.`
    : '';
  if (!confirm(`Tạo ${dong.length} hồ sơ ở trạng thái Nháp?${nhac}`)) return;

  const r = await api('taoHangLoat', { don_vi_chu_quan_id: donVi, dong });

  $('buocXem').classList.add('an');
  $('buocXong').classList.remove('an');
  veKetQua(r, boQua);
}));

function veKetQua(r, boQua) {
  const vung = $('ketQua');
  vung.replaceChildren();

  const chinh = document.createElement('div');
  chinh.className = 'thong-bao tot';
  chinh.textContent = `Đã tạo ${soVn(r.da_tao)} hồ sơ, từ mã ${r.ma_dau} đến ${r.ma_cuoi}. `
    + 'Tất cả đang ở trạng thái Nháp.';
  vung.append(chinh);

  if (r.link_da_gan) {
    const l = document.createElement('div');
    l.className = r.link_hong ? 'thong-bao canh-bao' : 'thong-bao tot';
    l.style.marginTop = '8px';
    l.textContent = r.link_hong
      ? `Gắn ${r.link_da_gan} link video, trong đó ${r.link_hong} link không mở được — `
        + 'các tệp này được đánh dấu link hỏng trong hồ sơ.'
      : `Đã gắn ${r.link_da_gan} link video.`
        + (r.da_kiem_chung_link ? '' : ' Số link nhiều nên chưa kiểm chứng, kịch bản chạy đêm sẽ kiểm giúp.');
    vung.append(l);
  }

  if (boQua) {
    const b = document.createElement('div');
    b.className = 'thong-bao canh-bao';
    b.style.marginTop = '8px';
    b.textContent = `${boQua} dòng bị bỏ qua vì thiếu thời lượng.`;
    vung.append(b);
  }
}
