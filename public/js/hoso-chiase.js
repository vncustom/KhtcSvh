/**
 * js/hoso-chiase.js — Cấp và theo dõi phiếu chia sẻ cho đối tác.
 *
 * Bảng dữ liệu chỉ giữ bản băm của token và PIN, nhưng bản gốc được cất riêng
 * ở Script Properties, nên cán bộ mở lại phiếu để in hay gửi lại lúc nào cũng được.
 * Thu hồi phiếu là xoá luôn bản gốc đó.
 */

import { goiCanDangNhap as api, gioVn, ngayVn, chu, $ } from './api.js';
import { bao, cho } from './khung.js';
import { taoSvgQR } from './qr.js';

let maHoSo = '';
let tenHoSo = '';
let donViDoiTac = [];

/* ---------- Nạp ---------- */

export async function napChiaSe(hoSoId, ten, doiTac) {
  maHoSo = hoSoId;
  tenHoSo = ten || '';
  if (doiTac) donViDoiTac = doiTac;

  let d;
  try {
    d = await api('danhSachPhieu', { ho_so_id: hoSoId });
  } catch (e) {
    $('khoiChiaSe')?.classList.add('an');
    return;
  }

  veNut(d);
  veDanhSach(d);
  chu($('demChiaSe'), d.phieu.length ? `${d.phieu.length} phiếu` : '');
}

function veNut(d) {
  const vung = $('nutChiaSe');
  vung.replaceChildren();
  if (!d.duoc_cap) return;

  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'nut nut-chinh';
  b.textContent = 'Cấp phiếu chia sẻ';
  b.addEventListener('click', moHopThoaiCap);
  vung.append(b);
}

function veDanhSach(d) {
  const vung = $('dsChiaSe');
  vung.replaceChildren();

  if (!d.ho_so_da_duyet) {
    const p = document.createElement('div');
    p.className = 'thong-bao';
    p.style.cssText = 'background:var(--mat-2);border-color:var(--duong);color:var(--chu-nhat)';
    p.textContent = 'Chỉ cấp được phiếu chia sẻ sau khi hồ sơ đã duyệt.';
    vung.append(p);
  }

  if (!d.phieu.length) {
    const p = document.createElement('p');
    p.className = 'trong';
    p.style.padding = '20px 12px';
    p.textContent = 'Hồ sơ chưa cấp phiếu chia sẻ nào.';
    vung.append(p);
    return;
  }

  for (const p of d.phieu) vung.append(veMotPhieu(p, d));
}

function veMotPhieu(p, d) {
  const the = document.createElement('div');
  the.className = 'hd-the';
  if (!p.con_hieu_luc) the.style.borderLeftColor = 'var(--chu-mo)';

  const dau = document.createElement('div');
  dau.className = 'hd-dau';

  const ten = document.createElement('div');
  ten.style.cssText = 'font-size:14px;font-weight:500';
  ten.textContent = p.ten_don_vi;

  const cach = document.createElement('span');
  cach.className = 'hd-loai';
  cach.textContent = p.phuong_thuc === 'PIN' ? 'Xác thực bằng PIN' : 'Xác thực bằng mã gửi email';

  const tt = document.createElement('span');
  tt.className = 'trang-thai ' + (p.trang_thai === 'THU_HOI' ? 'loi'
    : p.het_han_roi ? 'cho' : 'tot');
  tt.textContent = p.trang_thai === 'THU_HOI' ? 'Đã thu hồi'
    : p.het_han_roi ? 'Đã hết hạn' : 'Đang hiệu lực';

  dau.append(ten, cach, tt);

  if (p.so_lan_that_bai > 0) {
    const canh = document.createElement('span');
    canh.className = 'trang-thai canh-bao';
    canh.textContent = `${p.so_lan_that_bai} lần nhập sai`;
    dau.append(canh);
  }

  const nut = document.createElement('div');
  nut.className = 'hang-nut';
  nut.style.marginLeft = 'auto';
  if (p.xem_lai_duoc) {
    nut.append(nutNho('Xem phiếu', (b) => cho(b, async () => {
      const r = await api('xemLaiPhieu', { share_id: p.share_id });
      moPhieuVuaCap(r, true);
    })));
  }
  nut.append(nutNho('Lượt truy cập', () => moLuot(p)));

  if (d.duoc_thu_hoi && p.con_hieu_luc) {
    nut.append(nutNho('Thu hồi', (b) => cho(b, async () => {
      const lyDo = prompt('Lý do thu hồi phiếu của ' + p.ten_don_vi + ':', '');
      if (lyDo === null) return;
      await api('thuHoiPhieu', { share_id: p.share_id, ly_do: lyDo });
      bao('Đã thu hồi phiếu. Mọi phiên xem đang mở đều bị cắt.');
      napChiaSe(maHoSo, tenHoSo);
    }), true));
  }
  dau.append(nut);

  const luoi = document.createElement('div');
  luoi.className = 'hd-luoi';

  const muc = [
    ['Gửi tới', p.email_nhan || '—'],
    ['Ngày cấp', ngayVn(p.ngay_cap)],
    ['Hết hạn', ngayVn(p.het_han)],
    ['Lượt đã xem', p.so_luot_toi_da
      ? `${p.so_luot_da_dung} / ${p.so_luot_toi_da}`
      : String(p.so_luot_da_dung)],
    ['Xem gần nhất', p.lan_xem_cuoi ? gioVn(p.lan_xem_cuoi) : 'Chưa xem'],
    ['Người cấp', p.nguoi_cap]
  ];

  for (const [nhan, giaTri] of muc) {
    const o = document.createElement('div');
    const a = document.createElement('div');
    a.className = 'hd-nhan';
    a.textContent = nhan;
    const b = document.createElement('div');
    b.className = 'hd-gia-tri';
    b.textContent = giaTri;
    o.append(a, b);
    luoi.append(o);
  }

  the.append(dau, luoi);

  if (p.ly_do_thu_hoi) {
    const g = document.createElement('div');
    g.className = 'hd-nhan';
    g.style.marginTop = '8px';
    g.textContent = 'Lý do thu hồi: ' + p.ly_do_thu_hoi;
    the.append(g);
  }

  return the;
}

/* ---------- Cấp phiếu ---------- */

function moHopThoaiCap() {
  const chonDonVi = donViDoiTac
    .map((d) => `<option value="${thoat(d.don_vi_id)}" data-email="${thoat(d.email || '')}">`
      + `${thoat(d.ten)}</option>`).join('');

  const che = taoManChe(`
    <div class="hop-thoai" role="dialog" aria-modal="true" aria-label="Cấp phiếu chia sẻ">
      <div class="hop-thoai-dau">
        <h2>Cấp phiếu chia sẻ</h2>
        <button class="nut-x" type="button" data-dong aria-label="Đóng">✕</button>
      </div>
      <div class="hop-thoai-than">
        <div class="truong">
          <label for="sDonVi">Đối tác nhận phiếu *</label>
          <select class="o-nhap" id="sDonVi"><option value="">— Chọn đối tác —</option>${chonDonVi}</select>
        </div>
        <div class="truong">
          <label for="sCach">Cách đối tác xác thực</label>
          <select class="o-nhap" id="sCach">
            <option value="OTP">Gửi mã về email của đối tác</option>
            <option value="PIN">Cấp mã PIN riêng cho phiếu này</option>
          </select>
          <p class="goi-y" id="sGoiY">
            Mã gửi email an toàn hơn: không có mã nào tồn tại sẵn để lộ.
            Dùng PIN khi đối tác không có email ổn định.
          </p>
        </div>
        <div class="truong" id="oEmail">
          <label for="sEmail">Email nhận mã</label>
          <input class="o-nhap" id="sEmail" type="email" placeholder="Lấy theo email của đơn vị">
        </div>
        <div class="luoi c2">
          <div class="truong">
            <label for="sNgay">Hiệu lực (ngày)</label>
            <input class="o-nhap" id="sNgay" inputmode="numeric" value="90">
          </div>
          <div class="truong">
            <label for="sLuot">Giới hạn lượt xem</label>
            <input class="o-nhap" id="sLuot" inputmode="numeric" value="0" placeholder="0">
            <p class="goi-y">Để 0 nghĩa là không giới hạn.</p>
          </div>
        </div>
        <div class="thong-bao" style="background:var(--mat-2);border-color:var(--duong);
             color:var(--chu-nhat);font-size:13px">
          Đối tác chỉ xem được những tệp đã đánh dấu <strong>Đối tác xem được</strong>
          ở mục Tài liệu đính kèm.
        </div>
      </div>
      <div class="hop-thoai-chan">
        <button class="nut nut-phu" type="button" data-dong>Huỷ</button>
        <button class="nut nut-chinh" type="button" data-cap>Cấp phiếu</button>
      </div>
    </div>`);

  const selDonVi = che.querySelector('#sDonVi');
  const oEmail = che.querySelector('#sEmail');
  selDonVi.addEventListener('change', () => {
    oEmail.placeholder = selDonVi.selectedOptions[0]?.dataset.email || 'Đơn vị chưa có email';
  });

  che.querySelector('#sCach').addEventListener('change', (ev) => {
    che.querySelector('#oEmail').classList.toggle('an', ev.target.value === 'PIN');
  });

  const nutCap = che.querySelector('[data-cap]');
  nutCap.addEventListener('click', () => cho(nutCap, async () => {
    const r = await api('capPhieuChiaSe', {
      ho_so_id: maHoSo,
      don_vi_id: selDonVi.value,
      phuong_thuc: che.querySelector('#sCach').value,
      email_nhan: oEmail.value,
      so_ngay: Number(String(che.querySelector('#sNgay').value).replace(/\D/g, '')) || 90,
      so_luot_toi_da: Number(String(che.querySelector('#sLuot').value).replace(/\D/g, '')) || 0
    });
    dongManChe(che);
    moPhieuVuaCap(r);
    napChiaSe(maHoSo, tenHoSo);
  }));
}

/** Màn hình bàn giao: mã QR, đường dẫn và mã PIN của phiếu. */
function moPhieuVuaCap(r, xemLai) {
  const duongDan = `${location.origin}/xem?t=${r.token}`;
  let svg;
  try {
    svg = taoSvgQR(duongDan, { muc: 'M', oPx: 4, vien: 3 });
  } catch (e) {
    svg = `<p class="thong-bao loi">Không tạo được mã QR: ${thoat(e.message)}</p>`;
  }

  const che = taoManChe(`
    <div class="hop-thoai" style="max-width:560px" role="dialog" aria-modal="true"
         aria-label="Phiếu chia sẻ vừa cấp">
      <div class="hop-thoai-dau">
        <h2>${xemLai ? 'Phiếu của' : 'Phiếu đã cấp cho'} ${thoat(r.ten_don_vi)}</h2>
        <button class="nut-x" type="button" data-dong aria-label="Đóng">✕</button>
      </div>
      <div class="hop-thoai-than">
        <div class="thong-bao ${xemLai ? 'tot' : 'canh-bao'}" style="margin-bottom:16px">
          ${xemLai
            ? 'Đây là đúng đường dẫn và mã đã cấp trước đây. Mở lại phiếu có ghi vào nhật ký hồ sơ.'
            : 'Hãy sao chép hoặc in ngay để bàn giao. Sau này vẫn mở lại được bằng nút “Xem phiếu”.'}
        </div>

        <div id="vungQR" style="text-align:center;margin-bottom:16px">${svg}</div>

        <div class="truong">
          <label for="sLink">Đường dẫn chia sẻ</label>
          <input class="o-nhap" id="sLink" readonly value="${thoat(duongDan)}"
                 style="font-family:var(--font-mono);font-size:12px">
        </div>

        ${r.pin ? `
        <div class="truong">
          <label>Mã PIN cấp cho đối tác</label>
          <div class="khoi-ma" style="text-align:center;font-size:26px;letter-spacing:8px">${thoat(r.pin)}</div>
          <p class="goi-y">Gửi mã này qua kênh tách biệt với hợp đồng — đừng in kèm lên giấy.</p>
        </div>` : `
        <div class="thong-bao tot">
          Khi quét mã, đối tác bấm nhận mã xác thực gửi về ${thoat(r.email_nhan)}.
        </div>`}

        <p style="margin:14px 0 0;font-size:13px;color:var(--chu-mo)">
          Hiệu lực đến ${ngayVn(r.het_han)}.
        </p>
      </div>
      <div class="hop-thoai-chan">
        <button class="nut nut-phu" type="button" data-chep>Sao chép đường dẫn</button>
        <button class="nut nut-chinh" type="button" data-in>In phiếu QR</button>
      </div>
    </div>`);

  che.querySelector('[data-chep]').addEventListener('click', async (ev) => {
    try {
      await navigator.clipboard.writeText(duongDan);
      ev.target.textContent = 'Đã sao chép';
    } catch {
      che.querySelector('#sLink').select();
      bao('Trình duyệt chặn sao chép tự động. Đường dẫn đã được bôi đen, hãy nhấn Ctrl+C.',
        'canh-bao', 7);
    }
  });

  che.querySelector('[data-in]').addEventListener('click', () => inPhieu(r, svg));
}

/** Phiếu QR để dán kèm hợp đồng giấy. */
function inPhieu(r, svg) {
  const cua = window.open('', '_blank', 'width=760,height=900');
  if (!cua) {
    return bao('Trình duyệt đã chặn cửa sổ in. Hãy cho phép mở cửa sổ mới rồi thử lại.',
      'canh-bao', 8);
  }

  cua.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8">
    <title>Phiếu QR ${thoat(maHoSo)}</title>
    <style>
      body { font-family: "Segoe UI", Arial, sans-serif; margin: 0; padding: 28px; color: #0f1b2b; }
      .khung { border: 1.5px solid #0d2748; border-radius: 6px; max-width: 520px; margin: 0 auto; }
      .dau { background: #0d2748; color: #fff; padding: 14px 18px; border-bottom: 3px solid #b3862f; }
      .dai { font-size: 11px; letter-spacing: 1.3px; text-transform: uppercase; font-weight: 600; }
      .ban { font-size: 10px; letter-spacing: 1.1px; text-transform: uppercase; color: #a8bcd8; margin-top: 2px; }
      .than { padding: 20px 18px; text-align: center; }
      .ten { font-size: 16px; font-weight: 600; margin: 0 0 4px; }
      .ma { font-family: Consolas, monospace; font-size: 12px; color: #4a5a70; margin-bottom: 16px; }
      .qr svg { display: block; margin: 0 auto; }
      .dan { font-size: 12px; color: #4a5a70; margin-top: 14px; line-height: 1.6; }
      .chan { border-top: 1px solid #d4dbe5; padding: 10px 18px; font-size: 10.5px; color: #7b8aa0; text-align: center; }
      @media print { body { padding: 0; } }
    </style></head><body>
    <div class="khung">
      <div class="dau">
        <div class="dai">Đài Phát thanh - Truyền hình TP. Hồ Chí Minh</div>
        <div class="ban">Ban Kế hoạch – Tài chính · Phiếu tra cứu hồ sơ</div>
      </div>
      <div class="than">
        <p class="ten">${thoat(tenHoSo)}</p>
        <div class="ma">Mã hồ sơ: ${thoat(maHoSo)}</div>
        <div class="qr">${svg}</div>
        <div class="dan">
          Quét mã để tra cứu hồ sơ chương trình.<br>
          Cấp cho: <strong>${thoat(r.ten_don_vi)}</strong><br>
          Hiệu lực đến ${ngayVn(r.het_han)}
          ${r.phuong_thuc === 'PIN'
            ? '<br>Nhập mã PIN đã được cấp riêng để mở nội dung.'
            : '<br>Mã xác thực sẽ được gửi tới email đã đăng ký của đơn vị.'}
        </div>
      </div>
      <div class="chan">Phiếu do hệ thống sinh tự động — không ghi mã PIN lên phiếu này.</div>
    </div>
    </body></html>`);

  cua.document.close();
  cua.focus();
  setTimeout(() => cua.print(), 300);
}

/* ---------- Lượt truy cập ---------- */

function moLuot(p) {
  const hang = p.luot.length
    ? p.luot.map((l) => `<tr>
        <td class="so">${gioVn(l.thoi_gian)}</td>
        <td class="so">${thoat(l.ip || '—')}</td>
        <td>${thoat(nhanKetQua(l.ket_qua))}</td>
        <td>${thoat(l.tep_da_mo || '')}</td></tr>`).join('')
    : '<tr><td colspan="4" class="trong">Chưa có lượt truy cập nào.</td></tr>';

  taoManChe(`
    <div class="hop-thoai" style="max-width:680px" role="dialog" aria-modal="true"
         aria-label="Lượt truy cập">
      <div class="hop-thoai-dau">
        <h2>Lượt truy cập — ${thoat(p.ten_don_vi)}</h2>
        <button class="nut-x" type="button" data-dong aria-label="Đóng">✕</button>
      </div>
      <div class="hop-thoai-than">
        <div class="bang-bao">
          <table>
            <thead><tr><th>Thời gian</th><th>Địa chỉ IP</th><th>Kết quả</th><th>Tệp đã mở</th></tr></thead>
            <tbody>${hang}</tbody>
          </table>
        </div>
      </div>
      <div class="hop-thoai-chan">
        <button class="nut nut-phu" type="button" data-dong>Đóng</button>
      </div>
    </div>`);
}

function nhanKetQua(k) {
  if (k === 'THANH_CONG') return 'Xác thực thành công';
  if (k === 'SAI_MA') return 'Nhập sai mã';
  if (k === 'MO_TEP') return 'Mở tệp';
  return k;
}

/* ---------- Mảnh dùng chung ---------- */

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
