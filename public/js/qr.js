/**
 * js/qr.js — Sinh mã QR ngay trong trình duyệt.
 *
 * Viết tay thay vì gọi dịch vụ sinh QR bên ngoài, vì nội dung cần mã hoá chính là
 * đường dẫn chia sẻ có token — gửi nó sang máy chủ của bên thứ ba là làm rò rỉ
 * đúng thứ mà phiếu chia sẻ đang bảo vệ.
 *
 * Hỗ trợ chế độ byte (UTF-8), phiên bản 1–15, bốn mức sửa lỗi L/M/Q/H.
 * Đủ xa cho một đường dẫn dài: phiên bản 15 mức M chứa được 412 byte.
 */

/* ---------- Bảng tra ---------- */

/** [số byte sửa lỗi mỗi khối, số khối nhóm 1, số byte dữ liệu nhóm 1, số khối nhóm 2, số byte nhóm 2] */
const BANG_ECC = {
  L: [
    [7, 1, 19, 0, 0], [10, 1, 34, 0, 0], [15, 1, 55, 0, 0], [20, 1, 80, 0, 0],
    [26, 1, 108, 0, 0], [18, 2, 68, 0, 0], [20, 2, 78, 0, 0], [24, 2, 97, 0, 0],
    [30, 2, 116, 0, 0], [18, 2, 68, 2, 69], [20, 4, 81, 0, 0], [24, 2, 92, 2, 93],
    [26, 4, 107, 0, 0], [30, 3, 115, 1, 116], [22, 5, 87, 1, 88]
  ],
  M: [
    [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0],
    [24, 2, 43, 0, 0], [16, 4, 27, 0, 0], [18, 4, 31, 0, 0], [22, 2, 38, 2, 39],
    [22, 3, 36, 2, 37], [26, 4, 43, 1, 44], [30, 1, 50, 4, 51], [22, 6, 36, 2, 37],
    [22, 8, 37, 1, 38], [24, 4, 40, 5, 41], [24, 5, 41, 5, 42]
  ],
  Q: [
    [13, 1, 13, 0, 0], [22, 1, 22, 0, 0], [18, 2, 17, 0, 0], [26, 2, 24, 0, 0],
    [18, 2, 15, 2, 16], [24, 4, 19, 0, 0], [18, 2, 14, 4, 15], [22, 4, 18, 2, 19],
    [20, 4, 16, 4, 17], [24, 6, 19, 2, 20], [28, 4, 22, 4, 23], [26, 4, 20, 6, 21],
    [24, 8, 20, 4, 21], [20, 11, 16, 5, 17], [30, 5, 24, 7, 25]
  ],
  H: [
    [17, 1, 9, 0, 0], [28, 1, 16, 0, 0], [22, 2, 13, 0, 0], [16, 4, 9, 0, 0],
    [22, 2, 11, 2, 12], [28, 4, 15, 0, 0], [26, 4, 13, 1, 14], [26, 4, 14, 2, 15],
    [24, 4, 12, 4, 13], [28, 6, 15, 2, 16], [24, 3, 12, 8, 13], [28, 7, 14, 4, 15],
    [22, 12, 11, 4, 12], [24, 11, 12, 5, 13], [24, 11, 12, 7, 13]
  ]
};

/** Toạ độ tâm các ô căn chỉnh, theo từng phiên bản. */
const TOA_DO_CAN_CHINH = [
  [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42],
  [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62],
  [6, 26, 46, 66], [6, 26, 48, 70]
];

/** Hai bit chỉ mức sửa lỗi trong ô thông tin định dạng. */
const BIT_MUC = { L: 1, M: 0, Q: 3, H: 2 };

/* ---------- Số học trên trường GF(256) ---------- */

const MU = new Uint8Array(512);
const LOGA = new Uint8Array(256);

(function dungBang() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    MU[i] = x;
    LOGA[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;   // đa thức nguyên thuỷ của chuẩn QR
  }
  for (let i = 255; i < 512; i++) MU[i] = MU[i - 255];
})();

function nhanGF(a, b) {
  return (a === 0 || b === 0) ? 0 : MU[LOGA[a] + LOGA[b]];
}

/** Đa thức sinh Reed–Solomon bậc n. */
function daThucSinh(n) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const moi = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      moi[j] ^= g[j];
      moi[j + 1] ^= nhanGF(g[j], MU[i]);
    }
    g = moi;
  }
  return g;
}

/** Byte sửa lỗi cho một khối dữ liệu. */
function maSuaLoi(duLieu, soByte) {
  const g = daThucSinh(soByte);
  const du = new Array(soByte).fill(0);

  for (const byte of duLieu) {
    const heSo = byte ^ du[0];
    du.shift();
    du.push(0);
    if (heSo !== 0) {
      for (let i = 0; i < soByte; i++) du[i] ^= nhanGF(g[i + 1], heSo);
    }
  }
  return du;
}

/* ---------- Đóng gói dữ liệu ---------- */

function chonPhienBan(soByte, muc) {
  for (let v = 1; v <= 15; v++) {
    const [ec, k1, d1, k2, d2] = BANG_ECC[muc][v - 1];
    const sucChua = k1 * d1 + k2 * d2;
    // 4 bit chỉ chế độ + 8 hoặc 16 bit chỉ độ dài.
    const phuPhi = v <= 9 ? 2 : 3;
    if (soByte + phuPhi <= sucChua) return v;
  }
  throw new Error('Nội dung quá dài để tạo mã QR (tối đa phiên bản 15).');
}

function taoChuoiBit(byteData, phienBan, muc) {
  const [ec, k1, d1, k2, d2] = BANG_ECC[muc][phienBan - 1];
  const tongDuLieu = k1 * d1 + k2 * d2;

  const bit = [];
  const day = (giaTri, soBit) => {
    for (let i = soBit - 1; i >= 0; i--) bit.push((giaTri >> i) & 1);
  };

  day(0b0100, 4);                                   // chế độ byte
  day(byteData.length, phienBan <= 9 ? 8 : 16);     // độ dài
  for (const b of byteData) day(b, 8);

  // Dấu kết thúc, tối đa 4 bit.
  const conLai = tongDuLieu * 8 - bit.length;
  day(0, Math.min(4, conLai));

  // Bù cho tròn byte.
  while (bit.length % 8 !== 0) bit.push(0);

  // Bù thêm bằng hai byte lặp lại theo chuẩn.
  const byte = [];
  for (let i = 0; i < bit.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bit[i + j];
    byte.push(v);
  }
  const buThem = [0xec, 0x11];
  let k = 0;
  while (byte.length < tongDuLieu) byte.push(buThem[k++ % 2]);

  return byte;
}

/** Chia khối, tính mã sửa lỗi rồi trộn xen kẽ theo đúng chuẩn. */
function xepKhoi(byteDuLieu, phienBan, muc) {
  const [soEc, k1, d1, k2, d2] = BANG_ECC[muc][phienBan - 1];

  const khoiDuLieu = [];
  const khoiEc = [];
  let vt = 0;

  for (let i = 0; i < k1 + k2; i++) {
    const doDai = i < k1 ? d1 : d2;
    const khoi = byteDuLieu.slice(vt, vt + doDai);
    vt += doDai;
    khoiDuLieu.push(khoi);
    khoiEc.push(maSuaLoi(khoi, soEc));
  }

  const ra = [];
  const daiNhat = Math.max(d1, d2);
  for (let i = 0; i < daiNhat; i++) {
    for (const khoi of khoiDuLieu) if (i < khoi.length) ra.push(khoi[i]);
  }
  for (let i = 0; i < soEc; i++) {
    for (const khoi of khoiEc) ra.push(khoi[i]);
  }
  return ra;
}

/* ---------- Dựng lưới ---------- */

function luoiTrong(kichThuoc) {
  return Array.from({ length: kichThuoc }, () => new Array(kichThuoc).fill(null));
}

function datOTim(luoi, hang, cot) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const y = hang + r;
      const x = cot + c;
      if (y < 0 || y >= luoi.length || x < 0 || x >= luoi.length) continue;
      const trong = (r >= 0 && r <= 6 && (c === 0 || c === 6))
        || (c >= 0 && c <= 6 && (r === 0 || r === 6))
        || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
      luoi[y][x] = trong;
    }
  }
}

function datOCanChinh(luoi, hang, cot) {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      luoi[hang + r][cot + c] = Math.max(Math.abs(r), Math.abs(c)) !== 1;
    }
  }
}

/** Mã BCH cho ô thông tin định dạng. */
function bitDinhDang(muc, mask) {
  const so = (BIT_MUC[muc] << 3) | mask;
  let bch = so << 10;
  for (let i = 4; i >= 0; i--) {
    if (bch & (1 << (i + 10))) bch ^= 0x537 << i;
  }
  return ((so << 10) | bch) ^ 0x5412;
}

/** Mã BCH cho ô thông tin phiên bản, chỉ dùng từ phiên bản 7 trở lên. */
function bitPhienBan(v) {
  let bch = v << 12;
  for (let i = 5; i >= 0; i--) {
    if (bch & (1 << (i + 12))) bch ^= 0x1f25 << i;
  }
  return (v << 12) | bch;
}

const HAM_MASK = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0
];

function dungLuoi(byteCuoi, phienBan, muc, mask) {
  const n = phienBan * 4 + 17;
  const luoi = luoiTrong(n);

  datOTim(luoi, 0, 0);
  datOTim(luoi, 0, n - 7);
  datOTim(luoi, n - 7, 0);

  // Vạch nhịp
  for (let i = 8; i < n - 8; i++) {
    const v = i % 2 === 0;
    luoi[6][i] = v;
    luoi[i][6] = v;
  }

  // Ô căn chỉnh, bỏ những vị trí đè lên ô tìm
  const toaDo = TOA_DO_CAN_CHINH[phienBan - 1];
  for (const r of toaDo) {
    for (const c of toaDo) {
      const gocTim = (r === 6 && c === 6) || (r === 6 && c === n - 7) || (r === n - 7 && c === 6);
      if (!gocTim) datOCanChinh(luoi, r, c);
    }
  }

  luoi[n - 8][8] = true;   // ô tối cố định

  // Chừa chỗ cho thông tin định dạng
  for (let i = 0; i < 9; i++) {
    if (luoi[8][i] === null) luoi[8][i] = false;
    if (luoi[i][8] === null) luoi[i][8] = false;
  }
  for (let i = 0; i < 8; i++) {
    if (luoi[8][n - 1 - i] === null) luoi[8][n - 1 - i] = false;
    if (luoi[n - 1 - i][8] === null) luoi[n - 1 - i][8] = false;
  }

  // Chừa chỗ cho thông tin phiên bản
  if (phienBan >= 7) {
    for (let i = 0; i < 18; i++) {
      const r = Math.floor(i / 3);
      const c = i % 3;
      luoi[r][n - 11 + c] = false;
      luoi[n - 11 + c][r] = false;
    }
  }

  // Rải dữ liệu theo đường ngoằn ngoèo từ góc dưới bên phải
  const daDat = luoi.map((h) => h.map((o) => o !== null));
  let bitVt = 0;
  const layBit = () => {
    if (bitVt >= byteCuoi.length * 8) return false;
    const b = byteCuoi[bitVt >> 3];
    const v = ((b >> (7 - (bitVt & 7))) & 1) === 1;
    bitVt++;
    return v;
  };

  let len = false;
  for (let cot = n - 1; cot > 0; cot -= 2) {
    if (cot === 6) cot--;                    // cột vạch nhịp không chứa dữ liệu
    for (let i = 0; i < n; i++) {
      const hang = len ? i : n - 1 - i;
      for (let j = 0; j < 2; j++) {
        const c = cot - j;
        if (daDat[hang][c]) continue;
        const bit = layBit();
        luoi[hang][c] = HAM_MASK[mask](hang, c) ? !bit : bit;
      }
    }
    len = !len;
  }

  // Ghi thông tin định dạng
  const dd = bitDinhDang(muc, mask);
  for (let i = 0; i < 15; i++) {
    const b = ((dd >> i) & 1) === 1;
    if (i < 6) luoi[i][8] = b;
    else if (i < 8) luoi[i + 1][8] = b;
    else if (i === 8) luoi[8][7] = b;
    else luoi[8][14 - i] = b;

    if (i < 8) luoi[8][n - 1 - i] = b;
    else luoi[n - 15 + i][8] = b;
  }

  // Ghi thông tin phiên bản
  if (phienBan >= 7) {
    const pb = bitPhienBan(phienBan);
    for (let i = 0; i < 18; i++) {
      const b = ((pb >> i) & 1) === 1;
      const r = Math.floor(i / 3);
      const c = i % 3;
      luoi[r][n - 11 + c] = b;
      luoi[n - 11 + c][r] = b;
    }
  }

  return luoi;
}

/* ---------- Chấm điểm để chọn mặt nạ ---------- */

function chamDiem(luoi) {
  const n = luoi.length;
  let diem = 0;

  // Quy tắc 1: chuỗi cùng màu từ 5 ô trở lên
  for (let i = 0; i < n; i++) {
    for (const ngang of [true, false]) {
      let dem = 1;
      for (let j = 1; j < n; j++) {
        const a = ngang ? luoi[i][j] : luoi[j][i];
        const b = ngang ? luoi[i][j - 1] : luoi[j - 1][i];
        if (a === b) dem++;
        else {
          if (dem >= 5) diem += dem - 2;
          dem = 1;
        }
      }
      if (dem >= 5) diem += dem - 2;
    }
  }

  // Quy tắc 2: khối 2×2 cùng màu
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const v = luoi[r][c];
      if (v === luoi[r][c + 1] && v === luoi[r + 1][c] && v === luoi[r + 1][c + 1]) diem += 3;
    }
  }

  // Quy tắc 3: hoa văn dễ nhầm với ô tìm
  const mau1 = [true, false, true, true, true, false, true, false, false, false, false];
  const mau2 = [false, false, false, false, true, false, true, true, true, false, true];
  const khop = (lay) => {
    let d = 0;
    for (let i = 0; i + 11 <= n; i++) {
      let a = true, b = true;
      for (let k = 0; k < 11; k++) {
        if (lay(i + k) !== mau1[k]) a = false;
        if (lay(i + k) !== mau2[k]) b = false;
      }
      if (a) d += 40;
      if (b) d += 40;
    }
    return d;
  };
  for (let i = 0; i < n; i++) {
    diem += khop((j) => luoi[i][j]);
    diem += khop((j) => luoi[j][i]);
  }

  // Quy tắc 4: lệch cân bằng đen trắng
  let den = 0;
  for (const hang of luoi) for (const o of hang) if (o) den++;
  const tiLe = (den * 100) / (n * n);
  diem += Math.floor(Math.abs(tiLe - 50) / 5) * 10;

  return diem;
}

/* ---------- Giao diện dùng ngoài ---------- */

/**
 * Sinh lưới QR cho một chuỗi. Trả về mảng hai chiều các giá trị đúng/sai,
 * đúng nghĩa là ô tối.
 */
export function taoLuoiQR(noiDung, muc = 'M') {
  if (!BANG_ECC[muc]) throw new Error('Mức sửa lỗi phải là L, M, Q hoặc H.');

  const byte = Array.from(new TextEncoder().encode(String(noiDung)));
  if (!byte.length) throw new Error('Nội dung mã QR đang trống.');

  const phienBan = chonPhienBan(byte.length, muc);
  const duLieu = taoChuoiBit(byte, phienBan, muc);
  const cuoi = xepKhoi(duLieu, phienBan, muc);

  // Thử cả tám mặt nạ, giữ cái ít điểm phạt nhất — đúng như chuẩn yêu cầu.
  let totNhat = null;
  let diemTot = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const luoi = dungLuoi(cuoi, phienBan, muc, mask);
    const diem = chamDiem(luoi);
    if (diem < diemTot) {
      diemTot = diem;
      totNhat = luoi;
    }
  }
  return totNhat;
}

/** Vẽ mã QR thành chuỗi SVG, tiện cho việc hiển thị lẫn in ra giấy. */
export function taoSvgQR(noiDung, { muc = 'M', vien = 4, oPx = 4, mauToi = '#000', mauSang = '#fff' } = {}) {
  const luoi = taoLuoiQR(noiDung, muc);
  const n = luoi.length;
  const canh = (n + vien * 2) * oPx;

  let duong = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (luoi[r][c]) duong += `M${(c + vien) * oPx} ${(r + vien) * oPx}h${oPx}v${oPx}h-${oPx}z`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canh}" height="${canh}" `
    + `viewBox="0 0 ${canh} ${canh}" shape-rendering="crispEdges" role="img" `
    + `aria-label="Mã QR">`
    + `<rect width="${canh}" height="${canh}" fill="${mauSang}"/>`
    + `<path d="${duong}" fill="${mauToi}"/></svg>`;
}
