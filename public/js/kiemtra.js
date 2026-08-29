/**
 * js/kiemtra.js — Điều khiển trang kiểm tra của Giai đoạn 0.
 */

import { goi, soVn, gioVn, chu } from './api.js';

const $ = (id) => document.getElementById(id);

const el = {
  trangThaiChung: $('trangThaiChung'),
  baoLoi: $('baoLoi'),
  khoiChang: $('khoiChang'),
  chang1: $('chang1'), chang2: $('chang2'), chang3: $('chang3'),
  khoiSoLieu: $('khoiSoLieu'),
  soDonVi: $('soDonVi'), soNguoiDung: $('soNguoiDung'),
  soDanhMuc: $('soDanhMuc'), soEmail: $('soEmail'),
  khoiBang: $('khoiBang'), bangDonVi: $('bangDonVi'),
  ketQuaTho: $('ketQuaTho')
};

/* ---------- Tiện ích giao diện ---------- */

function datTrangThai(loai, chuThich) {
  el.trangThaiChung.className = 'trang-thai ' + loai;
  el.trangThaiChung.innerHTML = '<span class="cham"></span>';
  el.trangThaiChung.append(chuThich);
}

function hienLoi(thongDiep) {
  chu(el.baoLoi, thongDiep);
  el.baoLoi.classList.remove('an');
}

function anLoi() {
  el.baoLoi.classList.add('an');
}

function inThô(nhan, duLieu) {
  el.ketQuaTho.textContent = `# ${nhan} — ${new Date().toLocaleTimeString('vi-VN')}\n`
    + JSON.stringify(duLieu, null, 2);
}

/** Bọc một nút: hiện vòng quay khi đang chạy, bắt lỗi, luôn trả nút về trạng thái cũ. */
function gan(nut, nhan, viec) {
  nut.addEventListener('click', async () => {
    const chuGoc = nut.textContent;
    nut.disabled = true;
    nut.innerHTML = '<span class="quay"></span>';
    nut.append('Đang chạy…');
    anLoi();
    try {
      await viec();
    } catch (e) {
      datTrangThai('loi', 'Có lỗi');
      hienLoi(e.message);
      inThô(nhan + ' — lỗi', { loi: e.message, maLoi: e.maLoi, http: e.http });
    } finally {
      nut.disabled = false;
      nut.textContent = chuGoc;
    }
  });
}

/* ---------- Các phép kiểm tra ---------- */

gan($('nutPing'), 'ping', async () => {
  const d = await goi('ping', { tieng_vong: 'xin chào từ trình duyệt' });

  el.khoiChang.classList.remove('an');
  chu(el.chang1, 'Trình duyệt gọi được /api/goi và nhận phản hồi hợp lệ.');
  chu(el.chang2, `Apps Script trả lời lúc ${gioVn(d.thoi_gian)}.`);

  if (d.da_khoi_tao) {
    chu(el.chang3, `Đã mở được file “${d.ten_file}” với đủ ${d.so_tab} tab.`);
    datTrangThai('tot', 'Thông suốt');
  } else {
    chu(el.chang3, `Mở được file “${d.ten_file}” nhưng còn thiếu ${d.tab_con_thieu.length} tab: `
      + d.tab_con_thieu.join(', ') + '. Hãy chạy hàm khoiTaoCoSoDuLieu() trong Apps Script.');
    datTrangThai('canh-bao', 'Chưa khởi tạo');
  }
  inThô('ping', d);
});

gan($('nutTongQuan'), 'tongQuan', async () => {
  const d = await goi('tongQuan');
  el.khoiSoLieu.classList.remove('an');
  chu(el.soDonVi, soVn(d.don_vi));
  chu(el.soNguoiDung, soVn(d.nguoi_dung));
  chu(el.soDanhMuc, soVn(d.danh_muc));
  chu(el.soEmail, soVn(d.email_con_lai_hom_nay));
  datTrangThai('tot', 'Đọc được dữ liệu');
  inThô('tongQuan', d);
});

gan($('nutGhiThu'), 'ghiThu', async () => {
  const d = await goi('ghiThu', { ghi_chu: 'Ghi thử từ trang kiểm tra Giai đoạn 0' });
  datTrangThai('tot', 'Ghi được dữ liệu');
  inThô('ghiThu', d);
});

gan($('nutDonVi'), 'danhSachDonVi', async () => {
  const ds = await goi('danhSachDonVi');
  el.bangDonVi.replaceChildren();

  for (const d of ds) {
    const tr = document.createElement('tr');
    for (const [giaTri, lop] of [[d.don_vi_id, 'so'], [d.ten, ''], [null, ''], [d.email, '']]) {
      const td = document.createElement('td');
      if (lop) td.className = lop;
      if (giaTri === null) {
        const badge = document.createElement('span');
        badge.className = 'trang-thai ' + (d.loai === 'DOI_TAC' ? 'canh-bao' : 'cho');
        badge.textContent = d.loai === 'DOI_TAC' ? 'Đối tác' : 'Nội bộ';
        td.append(badge);
      } else {
        td.textContent = giaTri;
      }
      tr.append(td);
    }
    el.bangDonVi.append(tr);
  }

  el.khoiBang.classList.remove('an');
  datTrangThai('tot', `${ds.length} đơn vị`);
  inThô('danhSachDonVi', { so_luong: ds.length, mau: ds.slice(0, 3) });
});
