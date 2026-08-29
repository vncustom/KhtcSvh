/**
 * js/app.js — Bảng điều khiển: số liệu hồ sơ, việc cần làm, hồ sơ gần đây.
 */

import { goiCanDangNhap as api, soVn, chu, $ } from './api.js';
import { dungKhung, coQuyen, bao, cho } from './khung.js';
import { LOP_TRANG_THAI, TEN_TRANG_THAI, tongThoiLuong } from './hoso-chung.js';
import { tien } from './hoso-hopdong.js';

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
  let g;
  try {
    g = await api('moTrang', { trang: 'BANG_DIEU_KHIEN' });
  } catch (e) {
    bao(e.message, 'loi', 7);
    return;
  }

  const me = await dungKhung({ trangHienTai: '/app', toi: g.toi });
  if (!me) return;

  chu($('chaoTen'), me.ho_ten);
  veBangToi(me);
  veQuyen(me);

  const d = g.bang;
  veSoLieu(d);
  veCanLam(d);
  veTheoTrangThai(d.theo_trang_thai);
  veTheoDonVi(d.top_don_vi);
  veMoiNhat(d.moi_nhat);
  veHopDong(d.hop_dong);
  $('nutTaoHoSo').classList.toggle('an', !d.duoc_them);

  nhacTinhTrang(g.tinh_trang);
})();

/* ---------- Ô số liệu ---------- */

function veSoLieu(d) {
  const muc = [
    { so: soVn(d.tong_ho_so), ten: 'Hồ sơ chương trình' },
    { so: tongThoiLuong(d.tong_thoi_luong_giay), ten: 'Tổng thời lượng' },
    { so: soVn(d.so_doi_tac), ten: 'Đối tác hợp tác' },
    {
      so: soVn(d.theo_trang_thai.CHO_DUYET),
      ten: 'Đang chờ duyệt',
      nhan: d.theo_trang_thai.CHO_DUYET > 0
    }
  ];

  const vung = $('oSoLieu');
  vung.replaceChildren();

  for (const m of muc) {
    const div = document.createElement('div');
    div.className = 'o-so';
    if (m.nhan) div.style.borderTopColor = 'var(--canh-bao)';

    const s = document.createElement('div');
    s.className = 'con-so';
    if (m.nhan) s.style.color = 'var(--canh-bao)';
    s.textContent = m.so;

    const t = document.createElement('div');
    t.className = 'ten';
    t.textContent = m.ten;

    div.append(s, t);
    vung.append(div);
  }
}

/* ---------- Việc cần làm ---------- */

function veCanLam(d) {
  const vung = $('caiCanLam');
  vung.replaceChildren();

  const soCho = d.theo_trang_thai.CHO_DUYET;
  if (!soCho || !d.duoc_duyet) return;

  const o = document.createElement('div');
  o.className = 'thong-bao canh-bao';
  o.style.marginBottom = '20px';

  const chuNoi = document.createElement('span');
  chuNoi.style.flex = '1';
  chuNoi.textContent = soCho === 1
    ? 'Có 1 hồ sơ đang chờ bạn duyệt.'
    : `Có ${soVn(soCho)} hồ sơ đang chờ bạn duyệt.`;

  const a = document.createElement('a');
  a.className = 'nut-nho';
  a.style.textDecoration = 'none';
  a.href = '/ho-so?trang_thai=CHO_DUYET';
  a.textContent = 'Xem ngay';

  o.append(chuNoi, a);
  vung.append(o);
}

/* ---------- Hai biểu đồ thanh ---------- */

function veTheoTrangThai(theo) {
  const vung = $('theoTrangThai');
  vung.replaceChildren();

  const tong = Object.values(theo).reduce((a, b) => a + b, 0) || 1;

  for (const [ma, so] of Object.entries(theo)) {
    const a = document.createElement('a');
    a.className = 'thanh-do';
    a.href = '/ho-so?trang_thai=' + ma;

    const nhan = document.createElement('div');
    nhan.className = 'thanh-nhan';
    const ten = document.createElement('span');
    ten.textContent = TEN_TRANG_THAI[ma] || ma;
    const con = document.createElement('span');
    con.className = 'thanh-so';
    con.textContent = soVn(so);
    nhan.append(ten, con);

    const ray = document.createElement('div');
    ray.className = 'thanh-ray';
    const day = document.createElement('div');
    day.className = 'thanh-day muc-' + LOP_TRANG_THAI[ma];
    day.style.width = Math.round((so / tong) * 100) + '%';
    ray.append(day);

    a.append(nhan, ray);
    vung.append(a);
  }
}

function veTheoDonVi(ds) {
  const vung = $('theoDonVi');
  vung.replaceChildren();

  if (!ds.length) {
    const p = document.createElement('p');
    p.className = 'mo-ta';
    p.style.margin = '0';
    p.textContent = 'Chưa có hồ sơ nào để thống kê.';
    vung.append(p);
    return;
  }

  const lonNhat = ds[0].so || 1;

  for (const d of ds) {
    const khoi = document.createElement('div');
    khoi.className = 'thanh-do';

    const nhan = document.createElement('div');
    nhan.className = 'thanh-nhan';
    const ten = document.createElement('span');
    ten.textContent = d.ten;
    const con = document.createElement('span');
    con.className = 'thanh-so';
    con.textContent = soVn(d.so);
    nhan.append(ten, con);

    const ray = document.createElement('div');
    ray.className = 'thanh-ray';
    const day = document.createElement('div');
    day.className = 'thanh-day muc-navy';
    day.style.width = Math.round((d.so / lonNhat) * 100) + '%';
    ray.append(day);

    khoi.append(nhan, ray);
    vung.append(khoi);
  }
}

/* ---------- Hồ sơ gần đây ---------- */

function veMoiNhat(ds) {
  const tbody = $('bangMoiNhat');
  tbody.replaceChildren();
  $('chuaCoHoSo').classList.toggle('an', ds.length > 0);

  for (const h of ds) {
    const ma = document.createElement('td');
    ma.className = 'so';
    const code = document.createElement('code');
    code.textContent = h.ho_so_id;
    ma.append(code);

    const tt = document.createElement('td');
    const chip = document.createElement('span');
    chip.className = 'trang-thai ' + LOP_TRANG_THAI[h.trang_thai];
    chip.textContent = h.ten_trang_thai;
    tt.append(chip);

    const xem = document.createElement('td');
    const a = document.createElement('a');
    a.className = 'nut-nho';
    a.style.textDecoration = 'none';
    a.href = '/ho-so-chi-tiet?id=' + encodeURIComponent(h.ho_so_id);
    a.textContent = 'Xem';
    xem.append(a);

    const tr = document.createElement('tr');
    tr.append(ma, o(h.ten_chuong_trinh), o(h.don_vi_chu_quan), o(h.kenh || '—'), tt, xem);
    tbody.append(tr);
  }
}

function o(chuNoi) {
  const td = document.createElement('td');
  td.textContent = chuNoi ?? '';
  return td;
}

/* ---------- Hợp đồng cần chú ý ---------- */

function veHopDong(hd) {
  if (!hd) return;

  if (hd.danh_sach_gap.length) {
    $('khoiHopDong').classList.remove('an');
    const vung = $('hopDongGap');
    vung.replaceChildren();

    for (const c of hd.danh_sach_gap) {
      const a = document.createElement('a');
      a.className = 'moc-gap';
      a.href = '/ho-so-chi-tiet?id=' + encodeURIComponent(c.ho_so_id);

      const trai = document.createElement('div');
      trai.style.minWidth = '0';
      const s = document.createElement('div');
      s.style.cssText = 'font-family:var(--font-mono);font-size:13px;font-weight:500';
      s.textContent = c.so_hop_dong;
      const t = document.createElement('div');
      t.style.cssText = 'font-size:12.5px;color:var(--chu-mo);'
        + 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      t.textContent = c.ten_chuong_trinh;
      trai.append(s, t);

      const chip = document.createElement('span');
      chip.className = 'trang-thai ' + (c.qua_han ? 'loi' : 'canh-bao');
      chip.textContent = (c.qua_han ? 'Quá hạn ' : 'Hết hạn ') + ngayNgan(c.ngay_het_han);

      a.append(trai, chip);
      vung.append(a);
    }
  }

  if (hd.dot_gap.length) {
    $('khoiThanhToan').classList.remove('an');
    const vung = $('dotGap');
    vung.replaceChildren();

    for (const t of hd.dot_gap) {
      const a = document.createElement('a');
      a.className = 'moc-gap';
      a.href = '/hop-dong';

      const trai = document.createElement('div');
      trai.style.minWidth = '0';
      const s = document.createElement('div');
      s.style.cssText = 'font-family:var(--font-mono);font-size:13px;font-weight:500';
      s.textContent = `${t.so_hop_dong} · đợt ${t.dot}`;
      const m = document.createElement('div');
      m.style.cssText = 'font-size:12.5px;color:var(--chu-mo)';
      m.textContent = tien(t.so_tien);
      trai.append(s, m);

      const chip = document.createElement('span');
      chip.className = 'trang-thai ' + (t.qua_han ? 'loi' : 'canh-bao');
      chip.textContent = (t.qua_han ? 'Quá hạn ' : 'Đến hạn ') + ngayNgan(t.ngay_du_kien);

      a.append(trai, chip);
      vung.append(a);
    }
  }
}

function ngayNgan(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

/* ---------- Tài khoản và quyền ---------- */

function veBangToi(me) {
  const dong = [
    ['Tên đăng nhập', me.username],
    ['Email nhận mã', me.email],
    ['Vai trò', me.ten_nhom],
    ['Đơn vị', me.ten_don_vi || '—']
  ];

  const tbody = $('bangToi');
  tbody.replaceChildren();

  for (const [nhan, giaTri] of dong) {
    const tr = document.createElement('tr');
    tr.append(o(nhan), o(giaTri));
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

function nhacTinhTrang(t) {
  if (!t) return;
  if (t.che_do_kiem_tra) {
    bao('Chế độ kiểm tra đang bật — một số API gọi được mà không cần đăng nhập. '
      + 'Hãy tắt trong mục Quản trị ➜ Cấu hình trước khi dùng thật.', 'canh-bao', 9);
  }
  if (t.email_con_lai <= t.email_nguong_canh_bao) {
    bao(`Chỉ còn ${t.email_con_lai} lượt gửi email trong hôm nay.`, 'canh-bao', 8);
  }
}

/* ---------- Nút ---------- */

$('nutTaoHoSo').addEventListener('click', () => { location.href = '/ho-so-sua'; });

$('nutQuenThietBi').addEventListener('click', (ev) => {
  cho(ev.currentTarget, async () => {
    const r = await fetch('/api/quenthietbi', { method: 'POST' }).then((x) => x.json());
    if (!r.ok) throw new Error(r.loi);
    bao(`Đã huỷ ghi nhớ ${r.data.da_huy} thiết bị. Lần sau sẽ phải nhập mã xác thực.`);
  });
});
