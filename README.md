# Cổng quản trị hồ sơ chương trình

Ban Kế hoạch – Tài chính, Đài Phát thanh - Truyền hình TP. Hồ Chí Minh (HTV).

Giao diện HTML thuần trên Vercel · API bằng Google Apps Script · dữ liệu trong Google Sheet · tài liệu trên Google Drive.

**Trạng thái: Giai đoạn 2** — hồ sơ chương trình và quy trình duyệt đã hoạt động. Hợp đồng, tệp đính kèm và phiếu chia sẻ sẽ có ở các giai đoạn sau.

---

## Cấu trúc thư mục

```
public/            Giao diện — HTML, CSS, JS thuần, không có bước biên dịch
  index.html          Đăng nhập: mật khẩu ➜ mã xác thực ➜ đổi mật khẩu lần đầu
  app.html            Bảng điều khiển
  ho-so.html          Danh sách hồ sơ: lọc, tìm kiếm, phân trang
  ho-so-chi-tiet.html Xem một hồ sơ và thực hiện các bước duyệt
  ho-so-sua.html      Biểu mẫu thêm và sửa hồ sơ
  quan-tri.html       Người dùng · Đơn vị · Cấu hình · Nhật ký
  kiem-tra.html       Trang kiểm tra đường truyền của Giai đoạn 0
  css/app.css         Bảng màu navy và các thành phần dùng chung
  js/api.js           Lớp gọi API duy nhất
  js/khung.js         Khung trang dùng chung: người đang đăng nhập, menu, đăng xuất
  js/hoso-chung.js    Hằng số và nhãn dùng chung cho ba trang hồ sơ
  js/dangnhap.js      js/app.js            js/quantri.js       js/kiemtra.js
  js/hoso-danhsach.js js/hoso-chitiet.js   js/hoso-sua.js

api/               Tuyến trung gian chạy trên Vercel (Node)
  goi.js             Cửa chung cho mọi action nghiệp vụ
  dangnhap.js        Bước 1: kiểm mật khẩu, đặt cookie
  otp.js             Bước 2: xác thực mã, gửi lại mã
  dangxuat.js        quenthietbi.js
  _gas.js            Cầu nối tới Apps Script — nơi duy nhất biết GAS_URL
  _phien.js          Ba cookie httpOnly có ký HMAC
  _nhipdo.js         Chặn dội yêu cầu

apps-script/       Mã chạy trên Google Apps Script
  Schema.gs          Định nghĩa 14 bảng
  Config.gs          Tham số hệ thống
  Util.gs            Băm mật khẩu, sinh mã, xử lý chuỗi tiếng Việt
  Repo.gs            Lớp truy cập Sheet, có khoá ghi và bộ đệm
  Log.gs             Nhật ký hệ thống
  Auth.gs            Đăng nhập, OTP, phiên, thiết bị tin cậy
  Mail.gs            Thư OTP và thư mật khẩu mới
  Quyen.gs           Bảng phân quyền của năm vai trò
  NguoiDung.gs       Quản lý tài khoản và đơn vị
  CauHinh.gs         Cấu hình, thư mục Drive, nhật ký
  Drive.gs           Cây thư mục lưu trữ của từng hồ sơ
  HoSo.gs            Hồ sơ chương trình và quy trình duyệt
  Setup.gs           Khởi tạo bảng và dữ liệu mẫu
  Router.gs          Điểm vào doPost

scripts/           Máy chủ chạy thử trên máy, không cần Vercel CLI
  dev.js             Trông chừng và khởi động lại khi mã trong api/ thay đổi
  may-chu.js         Máy chủ HTTP
```

---

## Cài đặt lần đầu

### Bước 1 — Dựng dự án Apps Script

1. Mở [script.google.com](https://script.google.com) **bằng tài khoản Google có gói 5 TB** (tài khoản này sẽ sở hữu toàn bộ tệp Drive và hạn mức email).
2. Bấm **Dự án mới**. Đặt tên: `HTV KHTC API`.
3. Tạo đủ 14 file trong dự án và dán nội dung tương ứng từ thư mục `apps-script/`.
   Trong trình soạn thảo, dấu `.gs` được thêm tự động — chỉ cần gõ tên `Schema`, `Config`, …
4. Mở **Project Settings** ➜ tích **Show "appsscript.json" manifest file**, rồi dán nội dung
   `apps-script/appsscript.json` đè lên file manifest.

### Bước 2 — Khai báo Script Properties

**Project Settings ➜ Script Properties ➜ Add script property:**

| Khoá | Giá trị |
|---|---|
| `SPREADSHEET_ID` | `1KqVLXJ5WbZiqOvmE3YRF3YfHR9ULJHWIZ8hHDfjKAJ0` |

Mật khẩu khởi tạo sẽ được sinh ngẫu nhiên và in ra Execution log ở Bước 3.
Nếu muốn tự đặt, thêm trước các khoá `ADMIN_MK_KHOI_TAO`, `DON_VI_MK_KHOI_TAO`, `DOI_TAC_MK_KHOI_TAO`.

### Bước 3 — Khởi tạo cơ sở dữ liệu

Chạy lần lượt ba hàm, mỗi lần chọn tên hàm ở thanh trên rồi bấm **Run**:

| Hàm | Việc nó làm |
|---|---|
| `xemAppKey` | Sinh khoá dùng chung giữa Vercel và Apps Script. **Chép giá trị in ra.** |
| `khoiTaoCoSoDuLieu` | Tạo 14 tab, nạp danh mục, 20 đơn vị nội bộ, 2 đối tác, 23 tài khoản. **Chép ba mật khẩu in ở cuối log.** |
| `taoThuMucGoc` | Tạo thư mục `HTV_KHTC_HoSo` trên My Drive và ghi ID vào bảng cấu hình. |

Lần chạy đầu Google sẽ hỏi cấp quyền — chọn tài khoản, bấm **Advanced ➜ Go to HTV KHTC API (unsafe)**, rồi **Allow**.
Cảnh báo này là bình thường với dự án Apps Script chưa qua thẩm định của Google.

Chạy lại các hàm này nhiều lần vẫn an toàn: thứ đã có sẽ được bỏ qua, không tạo trùng.

### Bước 4 — Triển khai Web App

**Deploy ➜ New deployment ➜ Select type: Web app**

| Mục | Chọn |
|---|---|
| Execute as | **Me** |
| Who has access | **Anyone** |

Bấm **Deploy** rồi chép **Web app URL** (kết thúc bằng `/exec`).

> "Anyone" ở đây không có nghĩa là ai cũng dùng được hệ thống. Mọi yêu cầu vẫn phải kèm
> đúng `APP_KEY`, và khoá đó chỉ nằm trong biến môi trường phía máy chủ.

### Bước 5 — Biến môi trường trên máy

```bash
cp .env.example .env.local
```

Điền ba giá trị vào `.env.local`:

- `GAS_URL` — Web app URL ở Bước 4
- `GAS_APP_KEY` — kết quả của `xemAppKey`
- `SESSION_SECRET` — sinh bằng lệnh: `npm run bimat`

`.env.local` đã nằm trong `.gitignore` nên không bị đẩy lên GitHub.

### Bước 6 — Chạy thử

```bash
npm run dev
```

Mở <http://localhost:3000/kiem-tra> rồi bấm lần lượt bốn nút. Cả bốn đều xanh nghĩa là
đường truyền đã thông: trình duyệt → tuyến trung gian → Apps Script → Google Sheet.

Sau đó mở <http://localhost:3000> để đăng nhập.

---

## Đưa lên Vercel

1. Đẩy mã nguồn lên GitHub (kho riêng tư).
2. Trên Vercel: **Add New ➜ Project ➜ Import** kho vừa tạo.
3. Framework Preset để **Other**. Không cần lệnh build.
4. **Environment Variables** — khai báo đúng ba biến trong `.env.local`:
   `GAS_URL`, `GAS_APP_KEY`, `SESSION_SECRET`.
5. **Deploy**.

Mỗi lần đẩy mã lên GitHub, Vercel tự phát hành bản mới.

---

## Những điều cần nhớ

**Không có bí mật nào nằm trong mã nguồn.** `GAS_URL`, `APP_KEY`, `SESSION_SECRET` và mật khẩu
đều ở Script Properties hoặc biến môi trường. Kiểm tra lại điều này trước mỗi lần đẩy lên GitHub.

**Mật khẩu chỉ lưu dạng băm.** Bảng `NGUOI_DUNG` không có cột mật khẩu dạng chữ thường.
Admin không xem được mật khẩu của ai, chỉ đặt lại được.

**Trần 100 email mỗi ngày.** Tài khoản Gmail cá nhân chỉ gửi được 100 thư/ngày qua Apps Script,
gói Google One 5 TB không nâng con số này. Xem `email_con_lai_hom_nay` ở trang kiểm tra.

**Tắt chế độ kiểm tra khi chạy thật.** Trang `/kiem-tra` gọi được API mà không cần đăng nhập.
Đặt `CHE_DO_KIEM_TRA = TAT` trong mục Quản trị ➜ Cấu hình để khoá lại. Bảng điều khiển
sẽ nhắc nếu bạn quên.

**File Sheet là cửa sau.** Ai có quyền mở file đều sửa được dữ liệu, vượt qua mọi kiểm tra của
ứng dụng. Chỉ chia sẻ file cho tài khoản chạy hệ thống và một người dự phòng.

**Video không nằm trong hệ thống.** Video ở kho Drive 20 TB riêng, đưa vào bằng link chia sẻ.
Vì các link đó để chế độ "bất kỳ ai có link", phiếu chia sẻ bảo vệ được hợp đồng và tài liệu
nhưng không bảo vệ được video.

---

## Nâng cấp lên Giai đoạn 2

1. **Thêm 2 file mới** vào dự án Apps Script: `Drive`, `HoSo`.
   Dán đè `Quyen`, `Repo` và `Router` bằng bản mới.
2. **Triển khai lại**: Deploy ➜ Manage deployments ➜ bấm bút chì ➜ Version: **New version** ➜ Deploy.
   Bỏ qua bước này thì hệ thống báo *Không có action "danhSachHoSo"*.
3. Vào mục **Quản trị ➜ Cấu hình**, kiểm tra đã có thư mục gốc trên Drive.
   Thiếu thư mục thì không tạo được hồ sơ.

Lần này không cần chạy lại `khoiTaoCoSoDuLieu` vì cấu trúc bảng không đổi.

---

## Quy trình duyệt hồ sơ

```
NHAP  ──gửi duyệt──▶  CHO_DUYET  ──duyệt──▶  DA_DUYET  ──▶  LUU_TRU
  ▲                       │                                     │
  └──────trả lại──────────┘                └────mở lại──────────┘
```

| Bước | Ai làm được |
|---|---|
| Gửi duyệt | Đơn vị chủ quản, Ban KH-TC, Quản trị |
| Duyệt · Trả lại · Lưu trữ · Mở lại | Ban KH-TC, Quản trị |

Trả lại bắt buộc nhập lý do; lý do được gửi email cho đơn vị chủ quản và ghi vào nhật ký hồ sơ.

Đơn vị chủ quản sửa một hồ sơ **đã duyệt** thì hồ sơ tự quay về *Chờ duyệt* — biểu mẫu
báo trước điều này. Ban KH-TC sửa thì không, vì họ duyệt được ngay.

Đối tác chỉ thấy hồ sơ **đã duyệt** và có gán đơn vị của mình.

---

## Giai đoạn tiếp theo

**Giai đoạn 3 — Tệp đính kèm.** Tải tài liệu, audio, ảnh vào Drive 5 TB;
dán link video từ kho 20 TB và kiểm chứng link; xem trước PDF, phát video và audio.
