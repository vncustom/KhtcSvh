/**
 * js/hoso-tep.js — Phần tệp đính kèm trong trang chi tiết hồ sơ.
 *
 * Ba đường đưa tệp vào hệ thống:
 *   nhỏ hơn ngưỡng  ➜ gửi base64 qua /api/goi
 *   lớn hơn ngưỡng  ➜ xin phiên tải lên rồi gửi từng khối thẳng tới Google
 *   video           ➜ dán link từ kho video
 */

import { goiCanDangNhap as api, gioVn, chu, $ } from './api.js';
import { bao, cho } from './khung.js';

const KHOI = 8 * 1024 * 1024;
const NGUONG_MAC_DINH = 3 * 1024 * 1024;

const BIEU_TUONG = {
  HOP_DONG: '📄', DOC: '📝', AUDIO: '🎵', IMAGE: '🖼️', VIDEO: '🎬'
};

let maHoSo = '';
let trangThai = { duoc_tai_len: false, duoc_xoa: false, nguong_truc_tiep: 3 * 1024 * 1024 };

/* ---------- Nạp và vẽ ---------- */

export async function napTep(hoSoId) {
  maHoSo = hoSoId;

  let d;
  try {
    d = await api('danhSachTep', { ho_so_id: maHoSo });
  } catch (e) {
    bao(e.message, 'loi', 7);
    return;
  }

  trangThai = d;
  veNut();
  veDanhSach(d.tep);
  chu($('demTep'), d.tep.length ? `${d.tep.length} tệp` : '');
}

function veNut() {
  const vung = $('nutTep');
  vung.replaceChildren();
  if (!trangThai.duoc_tai_len) return;

  const taiLen = document.createElement('button');
  taiLen.type = 'button';
  taiLen.className = 'nut nut-chinh';
  taiLen.textContent = 'Tải tệp lên';
  taiLen.addEventListener('click', chonTep);

  const themLink = document.createElement('button');
  themLink.type = 'button';
  themLink.className = 'nut nut-phu';
  themLink.textContent = 'Dán link video';
  themLink.addEventListener('click', () => moHopThoaiLink());

  vung.append(taiLen, themLink);
}

function veDanhSach(ds) {
  const vung = $('dsTep');
  vung.replaceChildren();

  if (!ds.length) {
    const p = document.createElement('p');
    p.className = 'trong';
    p.style.padding = '24px 12px';
    p.textContent = 'Hồ sơ chưa có tệp đính kèm nào.';
    vung.append(p);
    return;
  }

  for (const t of ds) vung.append(veMotTep(t));
}

function veMotTep(t) {
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
  const manh = [t.ten_loai, dungLuong(t.dung_luong)];
  if (t.nguon === 'LINK_NGOAI') manh.push('link ngoài');
  manh.push(gioVn(t.ngay_tao));
  if (t.nguoi_tai) manh.push(t.nguoi_tai);
  phu.textContent = manh.filter(Boolean).join(' · ');

  giua.append(ten, phu);

  if (t.mo_ta) {
    const mo = document.createElement('div');
    mo.className = 'tep-phu';
    mo.style.fontStyle = 'italic';
    mo.textContent = t.mo_ta;
    giua.append(mo);
  }

  const nhan = document.createElement('div');
  nhan.style.cssText = 'display:flex;gap:5px;flex-wrap:wrap;margin-top:5px';
  if (t.cho_doi_tac_xem) nhan.append(chip('Đối tác xem được', 'tot'));
  if (t.nhay_cam) nhan.append(chip('Nhạy cảm', 'canh-bao'));
  if (!t.link_con_song) nhan.append(chip('Link hỏng', 'loi'));
  if (nhan.childElementCount) giua.append(nhan);

  const nut = document.createElement('div');
  nut.className = 'hang-nut';
  nut.style.flex = 'none';

  if (t.link_con_song) {
    nut.append(nutNho('Xem', () => moTrinhXem(t)));
  }

  const moDrive = document.createElement('a');
  moDrive.className = 'nut-nho';
  moDrive.style.textDecoration = 'none';
  moDrive.href = t.url_xem;
  moDrive.target = '_blank';
  moDrive.rel = 'noopener';
  moDrive.textContent = 'Mở Drive';
  nut.append(moDrive);

  if (trangThai.duoc_tai_len) {
    nut.append(nutNho('Sửa', () => moHopThoaiSua(t)));
  }
  if (trangThai.duoc_xoa) {
    nut.append(nutNho('Gỡ', (b) => cho(b, async () => {
      const canhBao = t.nguon === 'DRIVE_HE_THONG'
        ? '\n\nTệp sẽ được chuyển vào thùng rác trên Drive.'
        : '\n\nChỉ gỡ khỏi hồ sơ, tệp gốc trong kho vẫn giữ nguyên.';
      if (!confirm(`Gỡ tệp "${t.ten_hien_thi}"?${canhBao}`)) return;
      await api('xoaTep', { file_id: t.file_id });
      bao('Đã gỡ tệp khỏi hồ sơ.');
      await napTep(maHoSo);
    }), true));
  }

  hang.append(icon, giua, nut);
  return hang;
}

/* ---------- Tải tệp lên ---------- */

function chonTep() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.multiple = true;
  inp.accept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.webp,.mp3,.wav,.m4a,.aac';
  inp.addEventListener('change', () => {
    if (inp.files.length) moHopThoaiTaiLen([...inp.files]);
  });
  inp.click();
}

function moHopThoaiTaiLen(tepList) {
  const che = taoManChe(`
    <div class="hop-thoai" role="dialog" aria-modal="true" aria-label="Tải tệp lên">
      <div class="hop-thoai-dau">
        <h2>Tải ${tepList.length} tệp lên</h2>
        <button class="nut-x" type="button" data-dong aria-label="Đóng">✕</button>
      </div>
      <div class="hop-thoai-than">
        <div class="truong">
          <label for="tLoai">Loại tệp</label>
          <select class="o-nhap" id="tLoai">
            <option value="DOC">Kịch bản, tài liệu</option>
            <option value="HOP_DONG">Hợp đồng, chứng từ</option>
            <option value="AUDIO">Audio</option>
            <option value="IMAGE">Hình ảnh</option>
          </select>
        </div>
        <div class="truong">
          <label for="tMoTa">Ghi chú</label>
          <input class="o-nhap" id="tMoTa" placeholder="Không bắt buộc">
        </div>
        <label style="display:flex;gap:8px;align-items:flex-start;font-size:13.5px">
          <input type="checkbox" id="tChoDoiTac" style="margin-top:3px" checked>
          <span>Cho đối tác xem được tệp này khi hồ sơ đã duyệt</span>
        </label>
        <p class="goi-y" style="margin:6px 0 0 26px">
          Bật ô này thì tệp được đặt sang chế độ ai có link cũng xem được trên Drive,
          nhưng chặn tải xuống và in. Tắt đi là tệp trở lại riêng tư ngay.
        </p>
        <div id="tTienTrinh" style="margin-top:16px"></div>
      </div>
      <div class="hop-thoai-chan">
        <button class="nut nut-phu" type="button" data-dong>Huỷ</button>
        <button class="nut nut-chinh" type="button" data-gui>Bắt đầu tải</button>
      </div>
    </div>`);

  const nutGui = che.querySelector('[data-gui]');
  nutGui.addEventListener('click', async () => {
    const loai = che.querySelector('#tLoai').value;
    const moTa = che.querySelector('#tMoTa').value;
    const choDoiTac = che.querySelector('#tChoDoiTac').checked;
    const vungTien = che.querySelector('#tTienTrinh');

    nutGui.disabled = true;
    che.querySelectorAll('[data-dong]').forEach((b) => { b.disabled = true; });

    let xong = 0;
    for (const tep of tepList) {
      const thanh = taoThanhTien(vungTien, tep.name);
      try {
        await taiMotTep(tep, { loai, mo_ta: moTa, cho_doi_tac_xem: choDoiTac }, thanh.dat);
        thanh.xong();
        xong++;
      } catch (e) {
        thanh.loi(e.message);
      }
    }

    await napTep(maHoSo);
    if (xong === tepList.length) {
      bao(xong === 1 ? 'Đã tải lên 1 tệp.' : `Đã tải lên ${xong} tệp.`);
      dongManChe(che);
    } else {
      bao(`Tải lên ${xong}/${tepList.length} tệp. Xem chi tiết lỗi trong hộp thoại.`, 'canh-bao', 8);
      che.querySelectorAll('[data-dong]').forEach((b) => { b.disabled = false; });
    }
  });
}

export async function taiMotTep(tep, tuyChon, datTien, hoSoId) {
  const ho = hoSoId || maHoSo;
  if (tep.size > (trangThai.nguong_truc_tiep || NGUONG_MAC_DINH)) {
    return taiTheoPhien(tep, tuyChon, datTien, ho);
  }

  datTien(10);
  const b64 = await docBase64(tep);
  datTien(40);

  await api('taiLenTep', {
    ho_so_id: ho,
    ten: tep.name,
    mime: tep.type || 'application/octet-stream',
    du_lieu: b64,
    ...tuyChon
  });
  datTien(100);
}

/** Tệp lớn: xin phiên rồi gửi từng khối thẳng tới Google. */
async function taiTheoPhien(tep, tuyChon, datTien, hoSoId) {
  const ho = hoSoId || maHoSo;
  const phien = await api('moPhienTaiLen', {
    ho_so_id: ho,
    ten: tep.name,
    mime: tep.type || 'application/octet-stream',
    kich_thuoc: tep.size,
    loai: tuyChon.loai
  });

  let daGui = 0;
  let ketQua = null;

  while (daGui < tep.size) {
    const het = Math.min(daGui + KHOI, tep.size);
    const khoi = tep.slice(daGui, het);

    let res;
    try {
      res = await fetch(phien.dia_chi_phien, {
        method: 'PUT',
        headers: { 'Content-Range': `bytes ${daGui}-${het - 1}/${tep.size}` },
        body: khoi
      });
    } catch {
      throw new Error('Trình duyệt không gửi được dữ liệu thẳng lên Google. '
        + 'Hãy tải tệp lên Drive rồi dùng nút “Dán link video” để đưa vào hồ sơ.');
    }

    // 308 nghĩa là Google đã nhận khối này và chờ khối tiếp theo.
    if (res.status === 308) {
      daGui = het;
      datTien(Math.round((daGui / tep.size) * 95));
      continue;
    }

    if (res.ok) {
      ketQua = await res.json();
      daGui = tep.size;
      break;
    }

    throw new Error(`Google từ chối khối dữ liệu (mã ${res.status}).`);
  }

  if (!ketQua?.id) throw new Error('Tải xong nhưng Google không trả về mã tệp.');

  datTien(98);
  await api('hoanTatTaiLen', {
    ho_so_id: ho,
    drive_file_id: ketQua.id,
    ...tuyChon
  });
  datTien(100);
}

function docBase64(tep) {
  return new Promise((giai, tuChoi) => {
    const doc = new FileReader();
    doc.onload = () => giai(String(doc.result).split(',')[1] || '');
    doc.onerror = () => tuChoi(new Error('Không đọc được tệp từ máy của bạn.'));
    doc.readAsDataURL(tep);
  });
}

/* ---------- Dán link ---------- */

function moHopThoaiLink() {
  const che = taoManChe(`
    <div class="hop-thoai" role="dialog" aria-modal="true" aria-label="Dán link tệp">
      <div class="hop-thoai-dau">
        <h2>Dán link từ Drive</h2>
        <button class="nut-x" type="button" data-dong aria-label="Đóng">✕</button>
      </div>
      <div class="hop-thoai-than">
        <div class="truong">
          <label for="lLink">Đường dẫn chia sẻ *</label>
          <input class="o-nhap" id="lLink" placeholder="https://drive.google.com/file/d/…/view">
          <p class="goi-y">
            Hệ thống sẽ mở tệp để đọc tên và dung lượng thật, nên tệp phải đang được chia sẻ.
          </p>
        </div>
        <div class="truong">
          <label for="lLoai">Loại tệp</label>
          <select class="o-nhap" id="lLoai">
            <option value="VIDEO">Video</option>
            <option value="DOC">Kịch bản, tài liệu</option>
            <option value="HOP_DONG">Hợp đồng, chứng từ</option>
            <option value="AUDIO">Audio</option>
            <option value="IMAGE">Hình ảnh</option>
          </select>
        </div>
        <div class="truong">
          <label for="lTen">Tên hiển thị</label>
          <input class="o-nhap" id="lTen" placeholder="Để trống sẽ lấy tên gốc trên Drive">
        </div>
        <div class="truong">
          <label for="lMoTa">Ghi chú</label>
          <input class="o-nhap" id="lMoTa" placeholder="Không bắt buộc">
        </div>
        <label style="display:flex;gap:8px;align-items:flex-start;font-size:13.5px;margin-bottom:10px">
          <input type="checkbox" id="lChoDoiTac" style="margin-top:3px" checked>
          <span>Cho đối tác xem được tệp này khi hồ sơ đã duyệt</span>
        </label>
        <label style="display:flex;gap:8px;align-items:flex-start;font-size:13.5px">
          <input type="checkbox" id="lNhayCam" style="margin-top:3px">
          <span>Đánh dấu nhạy cảm — nội dung chưa phát sóng, cần để chế độ riêng tư ở kho video</span>
        </label>
      </div>
      <div class="hop-thoai-chan">
        <button class="nut nut-phu" type="button" data-dong>Huỷ</button>
        <button class="nut nut-chinh" type="button" data-gui>Thêm vào hồ sơ</button>
      </div>
    </div>`);

  const nutGui = che.querySelector('[data-gui]');
  nutGui.addEventListener('click', () => cho(nutGui, async () => {
    const link = che.querySelector('#lLink').value.trim();
    if (!link) return bao('Vui lòng dán đường dẫn.', 'canh-bao');

    await api('themLinkTep', {
      ho_so_id: maHoSo,
      link,
      loai: che.querySelector('#lLoai').value,
      ten: che.querySelector('#lTen').value,
      mo_ta: che.querySelector('#lMoTa').value,
      cho_doi_tac_xem: che.querySelector('#lChoDoiTac').checked,
      nhay_cam: che.querySelector('#lNhayCam').checked
    });

    bao('Đã thêm tệp vào hồ sơ.');
    dongManChe(che);
    await napTep(maHoSo);
  }));
}

/* ---------- Sửa thông tin tệp ---------- */

function moHopThoaiSua(t) {
  const che = taoManChe(`
    <div class="hop-thoai" role="dialog" aria-modal="true" aria-label="Sửa thông tin tệp">
      <div class="hop-thoai-dau">
        <h2>Sửa thông tin tệp</h2>
        <button class="nut-x" type="button" data-dong aria-label="Đóng">✕</button>
      </div>
      <div class="hop-thoai-than">
        <div class="truong">
          <label for="sTen">Tên hiển thị</label>
          <input class="o-nhap" id="sTen">
        </div>
        <div class="truong">
          <label for="sMoTa">Ghi chú</label>
          <input class="o-nhap" id="sMoTa">
        </div>
        <label style="display:flex;gap:8px;align-items:flex-start;font-size:13.5px;margin-bottom:10px">
          <input type="checkbox" id="sChoDoiTac" style="margin-top:3px">
          <span>Cho đối tác xem được tệp này khi hồ sơ đã duyệt</span>
        </label>
        <label style="display:flex;gap:8px;align-items:flex-start;font-size:13.5px">
          <input type="checkbox" id="sNhayCam" style="margin-top:3px">
          <span>Đánh dấu nhạy cảm</span>
        </label>
      </div>
      <div class="hop-thoai-chan">
        <button class="nut nut-phu" type="button" data-dong>Huỷ</button>
        <button class="nut nut-chinh" type="button" data-gui>Lưu</button>
      </div>
    </div>`);

  che.querySelector('#sTen').value = t.ten_hien_thi || '';
  che.querySelector('#sMoTa').value = t.mo_ta || '';
  che.querySelector('#sChoDoiTac').checked = t.cho_doi_tac_xem;
  che.querySelector('#sNhayCam').checked = t.nhay_cam;

  const nutGui = che.querySelector('[data-gui]');
  nutGui.addEventListener('click', () => cho(nutGui, async () => {
    await api('capNhatTep', {
      file_id: t.file_id,
      ten_hien_thi: che.querySelector('#sTen').value,
      mo_ta: che.querySelector('#sMoTa').value,
      cho_doi_tac_xem: che.querySelector('#sChoDoiTac').checked,
      nhay_cam: che.querySelector('#sNhayCam').checked
    });
    bao('Đã lưu thông tin tệp.');
    dongManChe(che);
    await napTep(maHoSo);
  }));
}

/* ---------- Trình xem nhúng ---------- */

function moTrinhXem(t) {
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
  dau.append(h2, x);

  const than = document.createElement('div');
  than.className = 'hop-thoai-than';
  than.style.padding = '0';

  // Dùng trình xem nhúng của Drive: người xem không nhận được đường dẫn tệp gốc.
  const khung = document.createElement('iframe');
  khung.src = t.url_nhung;
  khung.title = t.ten_hien_thi;
  khung.style.cssText = `width:100%;border:0;display:block;height:${t.loai === 'AUDIO' ? '80px' : '520px'}`;
  khung.setAttribute('allow', 'autoplay');
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

/* ---------- Mảnh giao diện dùng chung ---------- */

function taoManChe(html) {
  const che = document.createElement('div');
  che.className = 'man-che';
  che.innerHTML = html;

  const dong = () => dongManChe(che);
  che.querySelectorAll('[data-dong]').forEach((b) => b.addEventListener('click', dong));
  che.addEventListener('click', (ev) => { if (ev.target === che) dong(); });
  che._esc = (ev) => { if (ev.key === 'Escape') dong(); };
  document.addEventListener('keydown', che._esc);

  $('vungHopThoai').append(che);
  che.querySelector('input, select, button')?.focus();
  return che;
}

function dongManChe(che) {
  document.removeEventListener('keydown', che._esc);
  che.remove();
}

export function taoThanhTien(vung, ten) {
  const khoi = document.createElement('div');
  khoi.style.marginBottom = '10px';

  const nhan = document.createElement('div');
  nhan.className = 'thanh-nhan';
  const tenEl = document.createElement('span');
  tenEl.textContent = ten;
  const phanTram = document.createElement('span');
  phanTram.className = 'thanh-so';
  phanTram.textContent = '0%';
  nhan.append(tenEl, phanTram);

  const ray = document.createElement('div');
  ray.className = 'thanh-ray';
  const day = document.createElement('div');
  day.className = 'thanh-day muc-navy';
  day.style.width = '0%';
  ray.append(day);

  khoi.append(nhan, ray);
  vung.append(khoi);

  return {
    dat: (p) => { day.style.width = p + '%'; phanTram.textContent = p + '%'; },
    xong: () => {
      day.style.width = '100%';
      day.className = 'thanh-day muc-tot';
      phanTram.textContent = 'Xong';
      phanTram.style.color = 'var(--tot)';
    },
    loi: (thongDiep) => {
      day.style.width = '100%';
      day.className = 'thanh-day muc-loi';
      phanTram.textContent = 'Lỗi';
      phanTram.style.color = 'var(--loi)';
      const p = document.createElement('div');
      p.style.cssText = 'font-size:12.5px;color:var(--loi);margin-top:4px';
      p.textContent = thongDiep;
      khoi.append(p);
    }
  };
}

function chip(chuNoi, loai) {
  const s = document.createElement('span');
  s.className = 'trang-thai ' + loai;
  s.style.textTransform = 'none';
  s.textContent = chuNoi;
  return s;
}

function nutNho(chuNoi, viec, nguy) {
  const b = document.createElement('button');
  b.className = 'nut-nho' + (nguy ? ' nguy' : '');
  b.type = 'button';
  b.textContent = chuNoi;
  b.addEventListener('click', () => viec(b));
  return b;
}

function dungLuong(byte) {
  const n = Number(byte || 0);
  if (!n) return '';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
  return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}
