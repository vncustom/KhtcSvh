/**
 * js/hoso-hopdong.js — Hợp đồng và các đợt thanh toán.
 *
 * Dùng cho cả thẻ hợp đồng trong trang chi tiết hồ sơ lẫn trang hợp đồng toàn đài,
 * nên phần vẽ một hợp đồng và các hộp thoại đều nằm ở đây.
 */

import { goiCanDangNhap as api, soVn, ngayVn, chu, $ } from './api.js';
import { bao, cho } from './khung.js';

export const LOP_TRANG_THAI_HD = {
  DU_THAO: 'cho',
  DANG_HIEU_LUC: 'tot',
  HOAN_THANH: 'cho',
  THANH_LY: 'cho',
  HUY: 'loi'
};

export const LOAI_HOP_DONG = {
  HD_CHINH: 'Hợp đồng chính',
  PHU_LUC: 'Phụ lục hợp đồng',
  NGHIEM_THU: 'Biên bản nghiệm thu',
  THANH_LY: 'Biên bản thanh lý'
};

let maHoSo = '';
let donViTatCa = [];
let duocSua = false;

/* ---------- Nạp cho một hồ sơ ---------- */

export async function napHopDong(hoSoId, danhSachDonVi, coSan) {
  maHoSo = hoSoId;
  donViTatCa = danhSachDonVi || donViTatCa;

  let d = coSan;
  if (d) {
    duocSua = d.duoc_sua;
    veNutHopDong();
    veDanhSachHopDong($('dsHopDong'), d.dong, { hienChuongTrinh: false });
    chu($('demHopDong'), d.tong ? `${d.tong} hợp đồng · ${tien(d.thong_ke.tong_gia_tri)}` : '');
    return;
  }

  try {
    d = await api('hopDongCuaHoSo', { ho_so_id: hoSoId });
  } catch (e) {
    // Đối tác không có quyền xem hợp đồng thì ẩn hẳn thẻ, không báo lỗi đỏ.
    $('khoiHopDong')?.classList.add('an');
    return;
  }

  duocSua = d.duoc_sua;
  veNutHopDong();
  veDanhSachHopDong($('dsHopDong'), d.dong, { hienChuongTrinh: false });

  chu($('demHopDong'), d.tong
    ? `${d.tong} hợp đồng · ${tien(d.thong_ke.tong_gia_tri)}`
    : '');
}

function veNutHopDong() {
  const vung = $('nutHopDong');
  if (!vung) return;
  vung.replaceChildren();
  if (!duocSua) return;

  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'nut nut-chinh';
  b.textContent = 'Thêm hợp đồng';
  b.addEventListener('click', () => moHopThoaiHopDong(null));
  vung.append(b);
}

/* ---------- Vẽ danh sách ---------- */

export function veDanhSachHopDong(vung, ds, tuyChon = {}) {
  vung.replaceChildren();

  if (!ds.length) {
    const p = document.createElement('p');
    p.className = 'trong';
    p.style.padding = '24px 12px';
    p.textContent = tuyChon.chuTrong || 'Chưa có hợp đồng nào.';
    vung.append(p);
    return;
  }

  for (const c of ds) vung.append(veMotHopDong(c, tuyChon));
}

function veMotHopDong(c, tuyChon) {
  const the = document.createElement('div');
  the.className = 'hd-the';
  if (c.canh_bao_han === 'QUA_HAN') the.classList.add('hd-qua-han');
  else if (c.canh_bao_han === 'SAP_HET_HAN') the.classList.add('hd-sap-han');

  /* Hàng đầu: số hợp đồng, loại, trạng thái */
  const dau = document.createElement('div');
  dau.className = 'hd-dau';

  const so = document.createElement('div');
  so.className = 'hd-so';
  so.textContent = c.so_hop_dong;

  const loai = document.createElement('span');
  loai.className = 'hd-loai';
  loai.textContent = LOAI_HOP_DONG[c.loai] || c.loai;

  const tt = document.createElement('span');
  tt.className = 'trang-thai ' + (LOP_TRANG_THAI_HD[c.trang_thai] || 'cho');
  tt.textContent = c.ten_trang_thai;

  dau.append(so, loai, tt);

  if (c.canh_bao_han) {
    const canh = document.createElement('span');
    canh.className = 'trang-thai ' + (c.canh_bao_han === 'QUA_HAN' ? 'loi' : 'canh-bao');
    canh.textContent = c.canh_bao_han === 'QUA_HAN' ? 'Quá hạn' : 'Sắp hết hạn';
    dau.append(canh);
  }

  const nut = document.createElement('div');
  nut.className = 'hang-nut';
  nut.style.marginLeft = 'auto';
  nut.append(nutNho('Đợt thanh toán', () => moThanhToan(c)));
  if (duocSua) {
    nut.append(nutNho('Sửa', () => moHopThoaiHopDong(c)));
    nut.append(nutNho('Xoá', (b) => cho(b, async () => {
      if (!confirm(`Xoá hợp đồng "${c.so_hop_dong}"?`)) return;
      await api('xoaHopDong', { hop_dong_id: c.hop_dong_id });
      bao('Đã xoá hợp đồng.');
      tuyChon.sauKhiDoi ? tuyChon.sauKhiDoi() : napHopDong(maHoSo);
    }), true));
  }
  dau.append(nut);

  /* Hàng thông tin */
  const luoi = document.createElement('div');
  luoi.className = 'hd-luoi';

  const muc = [];
  if (tuyChon.hienChuongTrinh) muc.push(['Chương trình', c.ten_chuong_trinh]);
  muc.push(
    ['Đơn vị ký', c.ten_don_vi || '—'],
    ['Ngày ký', c.ngay_ky ? ngayVn(c.ngay_ky) : '—'],
    ['Hiệu lực đến', c.ngay_het_han ? ngayVn(c.ngay_het_han) : '—'],
    ['Giá trị', tien(c.gia_tri, c.tien_te)],
    ['Đã trả', tien(c.da_tra, c.tien_te)],
    ['Còn lại', tien(c.con_lai, c.tien_te)]
  );

  for (const [nhan, giaTri] of muc) {
    const o = document.createElement('div');
    const a = document.createElement('div');
    a.className = 'hd-nhan';
    a.textContent = nhan;
    const b = document.createElement('div');
    b.className = 'hd-gia-tri';
    b.textContent = giaTri;
    if (nhan === 'Còn lại' && c.con_lai > 0) b.style.color = 'var(--canh-bao)';
    if (nhan === 'Còn lại' && c.con_lai <= 0 && c.gia_tri > 0) b.style.color = 'var(--tot)';
    o.append(a, b);
    luoi.append(o);
  }

  the.append(dau, luoi);

  /* Thanh tiến độ chi trả */
  if (c.gia_tri > 0) {
    const ray = document.createElement('div');
    ray.className = 'thanh-ray';
    ray.style.marginTop = '10px';
    const day = document.createElement('div');
    day.className = 'thanh-day ' + (c.con_lai <= 0 ? 'muc-tot' : 'muc-navy');
    day.style.width = Math.min(100, Math.round((c.da_tra / c.gia_tri) * 100)) + '%';
    ray.append(day);
    the.append(ray);
  }

  if (c.dot_den_han) {
    const nhac = document.createElement('div');
    nhac.className = 'thong-bao canh-bao';
    nhac.style.marginTop = '10px';
    nhac.textContent = `${c.dot_den_han} đợt thanh toán đã quá ngày dự kiến.`;
    the.append(nhac);
  }

  if (c.ghi_chu) {
    const g = document.createElement('div');
    g.className = 'hd-nhan';
    g.style.marginTop = '8px';
    g.textContent = c.ghi_chu;
    the.append(g);
  }

  return the;
}

/* ---------- Hộp thoại hợp đồng ---------- */

function moHopThoaiHopDong(c) {
  const chonDonVi = donViTatCa
    .map((d) => `<option value="${thoat(d.don_vi_id)}">${thoat(d.ten)}</option>`).join('');
  const chonLoai = Object.entries(LOAI_HOP_DONG)
    .map(([ma, ten]) => `<option value="${ma}">${thoat(ten)}</option>`).join('');
  const chonTrangThai = [
    ['DU_THAO', 'Dự thảo'], ['DANG_HIEU_LUC', 'Đang hiệu lực'],
    ['HOAN_THANH', 'Đã hoàn thành'], ['THANH_LY', 'Đã thanh lý'], ['HUY', 'Đã huỷ']
  ].map(([ma, ten]) => `<option value="${ma}">${ten}</option>`).join('');

  const che = taoManChe(`
    <div class="hop-thoai" role="dialog" aria-modal="true" aria-label="Hợp đồng">
      <div class="hop-thoai-dau">
        <h2>${c ? 'Sửa hợp đồng' : 'Thêm hợp đồng'}</h2>
        <button class="nut-x" type="button" data-dong aria-label="Đóng">✕</button>
      </div>
      <div class="hop-thoai-than">
        <div class="luoi c2">
          <div class="truong">
            <label for="cSo">Số hợp đồng *</label>
            <input class="o-nhap" id="cSo" value="${thoat(c?.so_hop_dong || '')}">
          </div>
          <div class="truong">
            <label for="cLoai">Loại</label>
            <select class="o-nhap" id="cLoai">${chonLoai}</select>
          </div>
        </div>
        <div class="truong">
          <label for="cDonVi">Đơn vị ký hợp đồng *</label>
          <select class="o-nhap" id="cDonVi"><option value="">— Chọn đơn vị —</option>${chonDonVi}</select>
        </div>
        <div class="luoi c2">
          <div class="truong">
            <label for="cNgayKy">Ngày ký</label>
            <input class="o-nhap" id="cNgayKy" type="date" value="${thoat(c?.ngay_ky || '')}">
          </div>
          <div class="truong">
            <label for="cHieuLuc">Ngày hiệu lực</label>
            <input class="o-nhap" id="cHieuLuc" type="date" value="${thoat(c?.ngay_hieu_luc || '')}">
          </div>
          <div class="truong">
            <label for="cHetHan">Ngày hết hạn</label>
            <input class="o-nhap" id="cHetHan" type="date" value="${thoat(c?.ngay_het_han || '')}">
          </div>
          <div class="truong">
            <label for="cTrangThai">Trạng thái</label>
            <select class="o-nhap" id="cTrangThai">${chonTrangThai}</select>
          </div>
          <div class="truong">
            <label for="cGiaTri">Giá trị hợp đồng (VND)</label>
            <input class="o-nhap" id="cGiaTri" inputmode="numeric" value="${c ? c.gia_tri : ''}">
            <p class="goi-y" id="cGiaTriChu"></p>
          </div>
          <div class="truong">
            <label for="cThue">Thuế suất (%)</label>
            <input class="o-nhap" id="cThue" inputmode="numeric" value="${c ? c.thue_suat : ''}">
          </div>
        </div>
        <div class="truong">
          <label for="cGhiChu">Ghi chú</label>
          <input class="o-nhap" id="cGhiChu" value="${thoat(c?.ghi_chu || '')}">
        </div>
      </div>
      <div class="hop-thoai-chan">
        <button class="nut nut-phu" type="button" data-dong>Huỷ</button>
        <button class="nut nut-chinh" type="button" data-luu>${c ? 'Lưu thay đổi' : 'Thêm hợp đồng'}</button>
      </div>
    </div>`);

  if (c) {
    che.querySelector('#cLoai').value = c.loai;
    che.querySelector('#cDonVi').value = c.don_vi_id;
    che.querySelector('#cTrangThai').value = c.trang_thai;
  }

  const oGiaTri = che.querySelector('#cGiaTri');
  const veChu = () => {
    const n = Number(String(oGiaTri.value).replace(/\D/g, ''));
    che.querySelector('#cGiaTriChu').textContent = n ? tien(n) : '';
  };
  oGiaTri.addEventListener('input', veChu);
  veChu();

  const nutLuu = che.querySelector('[data-luu]');
  nutLuu.addEventListener('click', () => cho(nutLuu, async () => {
    await api('luuHopDong', {
      hop_dong_id: c?.hop_dong_id,
      ho_so_id: c?.ho_so_id || maHoSo,
      so_hop_dong: che.querySelector('#cSo').value,
      loai: che.querySelector('#cLoai').value,
      don_vi_id: che.querySelector('#cDonVi').value,
      ngay_ky: che.querySelector('#cNgayKy').value,
      ngay_hieu_luc: che.querySelector('#cHieuLuc').value,
      ngay_het_han: che.querySelector('#cHetHan').value,
      gia_tri: Number(String(oGiaTri.value).replace(/\D/g, '')) || 0,
      thue_suat: Number(String(che.querySelector('#cThue').value).replace(/[^\d.]/g, '')) || 0,
      trang_thai: che.querySelector('#cTrangThai').value,
      ghi_chu: che.querySelector('#cGhiChu').value
    });
    bao(c ? 'Đã lưu hợp đồng.' : 'Đã thêm hợp đồng.');
    dongManChe(che);
    lamMoi();
  }));
}

/* ---------- Đợt thanh toán ---------- */

async function moThanhToan(c) {
  let d;
  try {
    d = await api('chiTietHopDong', { hop_dong_id: c.hop_dong_id });
  } catch (e) {
    return bao(e.message, 'loi', 6);
  }

  const che = taoManChe(`
    <div class="hop-thoai" style="max-width:720px" role="dialog" aria-modal="true"
         aria-label="Đợt thanh toán">
      <div class="hop-thoai-dau">
        <h2>Đợt thanh toán — ${thoat(c.so_hop_dong)}</h2>
        <button class="nut-x" type="button" data-dong aria-label="Đóng">✕</button>
      </div>
      <div class="hop-thoai-than">
        <div class="luoi c3" style="margin-bottom:16px">
          <div class="o-so"><div class="con-so" style="font-size:18px">${tien(c.gia_tri)}</div><div class="ten">Giá trị hợp đồng</div></div>
          <div class="o-so"><div class="con-so" style="font-size:18px">${tien(c.da_tra)}</div><div class="ten">Đã thanh toán</div></div>
          <div class="o-so"><div class="con-so" style="font-size:18px">${tien(c.con_lai)}</div><div class="ten">Còn lại</div></div>
        </div>
        <div class="bang-bao">
          <table>
            <thead><tr><th>Đợt</th><th>Diễn giải</th><th>Số tiền</th>
              <th>Dự kiến</th><th>Thực tế</th><th>Trạng thái</th><th></th></tr></thead>
            <tbody id="bangDot"></tbody>
          </table>
        </div>
      </div>
      <div class="hop-thoai-chan">
        <button class="nut nut-phu" type="button" data-dong>Đóng</button>
        ${d.duoc_sua ? '<button class="nut nut-chinh" type="button" data-them>Thêm đợt</button>' : ''}
      </div>
    </div>`);

  veBangDot(che, c, d);

  che.querySelector('[data-them]')?.addEventListener('click', () => {
    dongManChe(che);
    moHopThoaiDot(c, null);
  });
}

function veBangDot(che, c, d) {
  const tbody = che.querySelector('#bangDot');
  tbody.replaceChildren();

  if (!d.thanh_toan.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 7;
    td.className = 'trong';
    td.textContent = 'Hợp đồng chưa chia đợt thanh toán.';
    tr.append(td);
    tbody.append(tr);
    return;
  }

  for (const t of d.thanh_toan) {
    const tt = document.createElement('td');
    const chip = document.createElement('span');
    chip.className = 'trang-thai ' + (t.trang_thai === 'DA_TT' ? 'tot' : t.qua_han ? 'loi' : 'cho');
    chip.textContent = t.qua_han && t.trang_thai === 'CHUA_TT' ? 'Quá hạn' : t.ten_trang_thai;
    tt.append(chip);

    const nut = document.createElement('td');
    if (d.duoc_sua) {
      const hang = document.createElement('div');
      hang.className = 'hang-nut';
      hang.append(nutNho('Sửa', () => { dongManChe(che); moHopThoaiDot(c, t); }));
      hang.append(nutNho('Xoá', (b) => cho(b, async () => {
        if (!confirm(`Xoá đợt ${t.dot}?`)) return;
        await api('xoaThanhToan', { id: t.id });
        bao('Đã xoá đợt thanh toán.');
        dongManChe(che);
        lamMoi();
      }), true));
      nut.append(hang);
    }

    const tr = document.createElement('tr');
    tr.append(
      o(t.dot, 'so'), o(t.dien_giai || '—'), o(tien(t.so_tien), 'so'),
      o(t.ngay_du_kien ? ngayVn(t.ngay_du_kien) : '—', 'so'),
      o(t.ngay_thuc_te ? ngayVn(t.ngay_thuc_te) : '—', 'so'),
      tt, nut
    );
    tbody.append(tr);
  }
}

function moHopThoaiDot(c, t) {
  const che = taoManChe(`
    <div class="hop-thoai" role="dialog" aria-modal="true" aria-label="Đợt thanh toán">
      <div class="hop-thoai-dau">
        <h2>${t ? 'Sửa đợt ' + t.dot : 'Thêm đợt thanh toán'}</h2>
        <button class="nut-x" type="button" data-dong aria-label="Đóng">✕</button>
      </div>
      <div class="hop-thoai-than">
        <div class="luoi c2">
          <div class="truong">
            <label for="dDot">Đợt số</label>
            <input class="o-nhap" id="dDot" inputmode="numeric" value="${t ? t.dot : ''}"
                   placeholder="Để trống sẽ tự đánh số">
          </div>
          <div class="truong">
            <label for="dSoTien">Số tiền (VND) *</label>
            <input class="o-nhap" id="dSoTien" inputmode="numeric" value="${t ? t.so_tien : ''}">
            <p class="goi-y" id="dSoTienChu"></p>
          </div>
        </div>
        <div class="truong">
          <label for="dDienGiai">Diễn giải</label>
          <input class="o-nhap" id="dDienGiai" value="${thoat(t?.dien_giai || '')}"
                 placeholder="Ví dụ: Tạm ứng 30% sau khi ký">
        </div>
        <div class="luoi c2">
          <div class="truong">
            <label for="dDuKien">Ngày dự kiến</label>
            <input class="o-nhap" id="dDuKien" type="date" value="${thoat(t?.ngay_du_kien || '')}">
          </div>
          <div class="truong">
            <label for="dThucTe">Ngày thực tế</label>
            <input class="o-nhap" id="dThucTe" type="date" value="${thoat(t?.ngay_thuc_te || '')}">
          </div>
        </div>
        <div class="truong">
          <label for="dTrangThai">Trạng thái</label>
          <select class="o-nhap" id="dTrangThai">
            <option value="CHUA_TT">Chưa thanh toán</option>
            <option value="DA_TT">Đã thanh toán</option>
            <option value="HUY">Đã huỷ</option>
          </select>
          <p class="goi-y">Chọn “Đã thanh toán” thì phải điền ngày thực tế.</p>
        </div>
      </div>
      <div class="hop-thoai-chan">
        <button class="nut nut-phu" type="button" data-dong>Huỷ</button>
        <button class="nut nut-chinh" type="button" data-luu>${t ? 'Lưu' : 'Thêm đợt'}</button>
      </div>
    </div>`);

  if (t) che.querySelector('#dTrangThai').value = t.trang_thai;

  const oTien = che.querySelector('#dSoTien');
  const veChu = () => {
    const n = Number(String(oTien.value).replace(/\D/g, ''));
    che.querySelector('#dSoTienChu').textContent = n ? tien(n) : '';
  };
  oTien.addEventListener('input', veChu);
  veChu();

  const nutLuu = che.querySelector('[data-luu]');
  nutLuu.addEventListener('click', () => cho(nutLuu, async () => {
    const r = await api('luuThanhToan', {
      id: t?.id,
      hop_dong_id: c.hop_dong_id,
      dot: Number(String(che.querySelector('#dDot').value).replace(/\D/g, '')) || 0,
      so_tien: Number(String(oTien.value).replace(/\D/g, '')) || 0,
      dien_giai: che.querySelector('#dDienGiai').value,
      ngay_du_kien: che.querySelector('#dDuKien').value,
      ngay_thuc_te: che.querySelector('#dThucTe').value,
      trang_thai: che.querySelector('#dTrangThai').value
    });

    if (r.vuot_gia_tri > 0) {
      bao(`Đã lưu, nhưng tổng các đợt vượt giá trị hợp đồng ${tien(r.vuot_gia_tri)}.`,
        'canh-bao', 9);
    } else {
      bao('Đã lưu đợt thanh toán.');
    }
    dongManChe(che);
    lamMoi();
  }));
}

/* ---------- Dùng chung ---------- */

let hamLamMoi = null;
export function datHamLamMoi(f) { hamLamMoi = f; }
function lamMoi() {
  if (hamLamMoi) hamLamMoi();
  else if (maHoSo) napHopDong(maHoSo);
}

export function datDonVi(ds) { donViTatCa = ds; }
export function datDuocSua(v) { duocSua = v; }

export function tien(so, tienTe) {
  return soVn(Math.round(Number(so || 0))) + ' ' + (tienTe || 'VND');
}

function o(noiDung, lop) {
  const td = document.createElement('td');
  if (lop) td.className = lop;
  td.textContent = noiDung ?? '';
  return td;
}

function nutNho(chuNoi, viec, nguy) {
  const b = document.createElement('button');
  b.className = 'nut-nho' + (nguy ? ' nguy' : '');
  b.type = 'button';
  b.textContent = chuNoi;
  b.addEventListener('click', () => viec(b));
  return b;
}

function taoManChe(html) {
  const che = document.createElement('div');
  che.className = 'man-che';
  che.innerHTML = html;

  const dong = () => dongManChe(che);
  che.querySelectorAll('[data-dong]').forEach((b) => b.addEventListener('click', dong));
  che.addEventListener('click', (ev) => { if (ev.target === che) dong(); });
  che._esc = (ev) => { if (ev.key === 'Escape') dong(); };
  document.addEventListener('keydown', che._esc);

  ($('vungHopThoai') || document.body).append(che);
  che.querySelector('input, select, button')?.focus();
  return che;
}

function dongManChe(che) {
  document.removeEventListener('keydown', che._esc);
  che.remove();
}

function thoat(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
