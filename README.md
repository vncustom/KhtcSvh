# Cổng quản trị hồ sơ chương trình

Ban Kế hoạch – Tài chính, Đài Phát thanh - Truyền hình TP. Hồ Chí Minh (HTV).

Giao diện HTML thuần trên Vercel · API bằng Google Apps Script · dữ liệu trong Google Sheet · tài liệu trên Google Drive.

**Trạng thái: Giai đoạn 4 hoàn tất** — hồ sơ, quy trình duyệt, tệp đính kèm, nhập từ Excel, hợp đồng – thanh toán, và phiếu chia sẻ kèm mã QR đều đã hoạt động.

---

## Cấu trúc thư mục

```
public/            Giao diện — HTML, CSS, JS thuần, không có bước biên dịch
  index.html          Đăng nhập: mật khẩu ➜ mã xác thực ➜ đổi mật khẩu lần đầu
  app.html            Bảng điều khiển
  ho-so.html          Danh sách hồ sơ: lọc, tìm kiếm, phân trang
  ho-so-chi-tiet.html Xem một hồ sơ và thực hiện các bước duyệt
  ho-so-sua.html      Biểu mẫu thêm và sửa hồ sơ
  nhap-excel.html     Nhập nhiều hồ sơ từ phiếu Excel của đơn vị
  hop-dong.html       Hợp đồng toàn đài: lọc, cảnh báo hạn, tiến độ chi trả
  xem.html            Trang tra cứu công khai cho đối tác quét mã QR
  quan-tri.html       Người dùng · Đơn vị · Cấu hình · Nhật ký
  kiem-tra.html       Trang kiểm tra đường truyền của Giai đoạn 0
  css/app.css         Bảng màu navy và các thành phần dùng chung
  js/api.js           Lớp gọi API duy nhất
  js/khung.js         Khung trang dùng chung: người đang đăng nhập, menu, đăng xuất
  js/hoso-chung.js    Hằng số và nhãn dùng chung cho ba trang hồ sơ
  js/dangnhap.js      js/app.js            js/quantri.js       js/kiemtra.js
  js/hoso-danhsach.js js/hoso-chitiet.js   js/hoso-sua.js      js/hoso-tep.js
  js/nhap-excel.js    js/hoso-hopdong.js   js/hopdong-danhsach.js
  js/hoso-chiase.js   js/xem.js            js/qr.js

api/               Tuyến trung gian chạy trên Vercel (Node)
  goi.js             Cửa chung cho mọi action nghiệp vụ
  chiase.js          Cửa công khai cho đối tác quét mã QR
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
  Tep.gs             Tệp đính kèm: tải lên, dán link, kiểm tra link
  NhapExcel.gs       Đọc phiếu Excel và tạo hồ sơ hàng loạt
  HopDong.gs         Hợp đồng, phụ lục, biên bản và các đợt thanh toán
  ChiaSe.gs          Phiếu chia sẻ, xác thực đối tác, nhật ký truy cập
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
3. Tạo đủ 18 file trong dự án và dán nội dung tương ứng từ thư mục `apps-script/`.
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
nhưng không bảo vệ được video. Tệp video chưa phát sóng nên đánh dấu **nhạy cảm** khi dán link,
và để chế độ riêng tư ở kho video.

**Phiên tải lên cần được thử với tệp thật.** Đường tải tệp lớn gửi dữ liệu thẳng từ trình duyệt
tới Google. Cách này đang được dùng phổ biến, nhưng nếu trình duyệt bị chặn thì hệ thống sẽ báo
rõ và hướng dẫn tải lên Drive rồi dán link. Hãy thử một tệp khoảng 10 MB để xác nhận.

---

## Nâng cấp lên Giai đoạn 3

1. **Thêm file `Tep`** vào dự án Apps Script. Dán đè `Router` bằng bản mới.
2. **Triển khai lại**: Deploy ➜ Manage deployments ➜ bấm bút chì ➜ Version: **New version** ➜ Deploy.
3. *(Nên làm)* Đặt lịch kiểm tra link hằng đêm: trong trình soạn thảo Apps Script,
   mở **Triggers** ➜ **Add Trigger** ➜ hàm `kiemTraLinkHangDem`, nguồn **Time-driven**,
   loại **Day timer**, khung giờ 1–2 giờ sáng.

Không cần chạy lại `khoiTaoCoSoDuLieu` vì cấu trúc bảng không đổi.

---

## Tệp đính kèm

| Trường hợp | Cách làm | Nơi lưu |
|---|---|---|
| Tài liệu, hợp đồng, ảnh, audio dưới 3 MB | Bấm **Tải tệp lên** | Drive 5 TB của hệ thống |
| Các tệp trên 3 MB, tối đa 512 MB | Bấm **Tải tệp lên** — trình duyệt tự chuyển sang phiên tải lên | Drive 5 TB của hệ thống |
| Video | Bấm **Dán link video** | Kho video 20 TB, hồ sơ chỉ giữ mã tệp |

Ngưỡng 3 MB đến từ hàm serverless của Vercel: thân yêu cầu tối đa 4,5 MB, mà mã hoá base64
làm dữ liệu phình thêm một phần ba. Tệp lớn hơn được gửi thẳng từ trình duyệt tới Google
theo từng khối 8 MB, không đi qua Vercel lẫn Apps Script.

Khi dán link, hệ thống mở tệp trên Drive để đọc **tên và dung lượng thật**, rồi lưu mã tệp
chứ không lưu chuỗi URL. Nhờ vậy link đổi dạng vẫn không mất tệp, và có thể kiểm tra được
tệp còn sống hay không.

**Tệp nào đối tác xem được** do người phụ trách tích chọn từng tệp. Không tích thì đối tác
không thấy, kể cả khi hồ sơ đã duyệt.

**Xem tệp** dùng trình xem nhúng của Drive, không hiện đường dẫn tệp gốc trong trang.
Đây là một trong các biện pháp giảm rò rỉ đã nêu ở kế hoạch, vì video để chế độ
"bất kỳ ai có link".

---

## Quy trình duyệt hồ sơ

```
NHAP  ──gửi duyệt──▶  CHO_DUYET  ──duyệt──▶  DA_DUYET  ──▶  LUU_TRU
  ▲                       │                                     │
  └──────trả lại──────────┘                └────mở lại──────────┘
```

| Bước | Ai làm được |
|---|---|
| Gửi duyệt | Đơn vị chủ quản của hồ sơ · các đơn vị được gửi duyệt hộ · Ban KH-TC · Quản trị |
| Duyệt · Trả lại · Lưu trữ · Mở lại | Đơn vị chủ quản của hồ sơ · Ban KH-TC · Quản trị |

Hai dòng trên điều khiển bằng tham số ở **Quản trị ➜ Cấu hình**:

| Tham số | Mặc định | Ý nghĩa |
|---|---|---|
| `DON_VI_GUI_DUYET_HO` | Trung tâm Phát hình - Tư liệu | Đơn vị được gửi duyệt hộ hồ sơ của đơn vị khác. Nhiều đơn vị thì ngăn bằng dấu chấm phẩy. |
| `DON_VI_CHU_QUAN_DUOC_DUYET` | BAT | Cho đơn vị chủ quản tự duyệt hồ sơ của mình. Đặt `TAT` nếu muốn chỉ Ban KH-TC được duyệt. |

Trả lại bắt buộc nhập lý do; lý do được gửi email cho đơn vị chủ quản và ghi vào nhật ký hồ sơ.

Đơn vị chủ quản sửa một hồ sơ **đã duyệt** thì hồ sơ tự quay về *Chờ duyệt* — biểu mẫu
báo trước điều này. Ban KH-TC sửa thì không, vì họ duyệt được ngay.

Đối tác chỉ thấy hồ sơ **đã duyệt** và có gán đơn vị của mình.

---

## Nhập hồ sơ từ phiếu Excel

Vào **Hồ sơ chương trình ➜ Nhập từ Excel**, hoặc mục **Nhập từ Excel** trên thanh điều hướng.

Hệ thống đọc phiếu yêu cầu lưu file mà đơn vị gửi sang, đúng như mẫu đang dùng:

| Cột trong phiếu | Vào trường |
|---|---|
| ID | Mã chương trình của đơn vị |
| TÊN CHƯƠNG TRÌNH | Tên chương trình *(bắt buộc)* |
| THỂ LOẠI | Thể loại |
| NGÀY PHÁT SÓNG | Ngày phát sóng |
| KÊNH PHÁT SÓNG | Kênh |
| GIỜ PHÁT SÓNG | Giờ phát sóng |
| THỜI LƯỢNG CT | Thời lượng *(bắt buộc)* |
| NỘI DUNG ĐỀ NGHỊ | Nội dung chương trình |
| TÊN FILE | Tên file, đồng thời là tên hiển thị của video |
| LINK | Link video, tự tạo thành tệp đính kèm |

Cột được nhận theo **tên ở dòng tiêu đề**, không theo thứ tự, và dòng tiêu đề được dò tự động
nên phần đầu phiếu dài ngắn thế nào cũng được. Đơn vị chủ quản đọc từ dòng `ĐƠN VỊ: …`,
vẫn sửa lại được trước khi tạo.

Trước khi tạo, màn hình hiện toàn bộ dòng đọc được để đối chiếu, kèm cảnh báo cho dòng
thiếu thời lượng hay có kênh lạ. Bỏ tích những dòng không muốn nhập.

Hồ sơ nhập vào ở trạng thái **Nháp**. Mỗi lần tối đa 300 dòng, file tối đa 3 MB.

Thời lượng nhập theo dạng **phút:giây** (`13:44`) — đúng như trong phiếu. Quá 60 phút
thì viết `giờ:phút:giây`.

---

## Hợp đồng và thanh toán

Xem toàn đài ở mục **Hợp đồng** trên thanh điều hướng, hoặc xem theo từng hồ sơ
ở thẻ *Hợp đồng & thanh toán* trong trang chi tiết hồ sơ.

**Vòng đời hợp đồng:** Dự thảo → Đang hiệu lực → Đã hoàn thành → Đã thanh lý. Hợp đồng
bỏ dở thì chuyển sang *Đã huỷ*, đừng xoá — hệ thống cũng từ chối xoá hợp đồng đã có
đợt chi trả, để không mất dấu vết tiền bạc.

**Các đợt thanh toán** nằm trong hộp thoại riêng của từng hợp đồng: số đợt, diễn giải,
số tiền, ngày dự kiến và ngày thực tế. Đánh dấu *Đã thanh toán* thì bắt buộc có ngày thực tế.
Nếu tổng các đợt vượt giá trị hợp đồng, hệ thống vẫn lưu nhưng báo rõ phần vượt.

**Cảnh báo tự động**, ngưỡng 30 ngày:

| Trên bảng điều khiển | Nội dung |
|---|---|
| Hợp đồng cần chú ý | Đang hiệu lực mà sắp hết hạn, hoặc đã quá hạn chưa chuyển trạng thái |
| Đợt thanh toán đến hạn | Đợt chưa chi trả đã tới hoặc quá ngày dự kiến |

Cả hai khối chỉ hiện khi thật sự có việc cần làm, và **lọc theo phạm vi vai trò** —
đơn vị chủ quản chỉ thấy hợp đồng của hồ sơ đơn vị mình, đối tác chỉ thấy hợp đồng
ký với chính mình.

**Kiểm tra khi lưu:** số hợp đồng phải là duy nhất; ngày ký ≤ ngày hiệu lực ≤ ngày hết hạn;
giá trị không âm.

---

## Phiếu chia sẻ cho đối tác

Đây là phần thay thế cơ chế mã PIN tĩnh của bản demo. Mở thẻ **Chia sẻ cho đối tác**
trong trang chi tiết hồ sơ.

**Cách hoạt động.** Mỗi đối tác được cấp một phiếu riêng, gồm token ngẫu nhiên 128 bit
mà hệ thống chỉ lưu bản băm, hạn hiệu lực, giới hạn lượt xem và nút thu hồi. Mã QR in lên
hợp đồng chứa đường dẫn `…/xem?t=<token>`. Quét mã chỉ mở được màn hình xác thực,
chưa thấy nội dung gì.

**Hai cách xác thực,** chọn khi cấp phiếu:

| Cách | Khi nào dùng |
|---|---|
| Gửi mã về email đối tác | Mặc định. Không có mã nào tồn tại sẵn để lộ — bản photo hợp đồng lọt ra ngoài cũng vô dụng. |
| Cấp mã PIN riêng cho phiếu | Khi đối tác không có email ổn định. PIN sinh riêng từng phiếu, gửi qua kênh tách biệt với hợp đồng. |

**Mở lại phiếu lúc nào cũng được** bằng nút *Xem phiếu*. Bảng dữ liệu chỉ giữ bản băm
của token và PIN; bản gốc cất riêng ở **Script Properties** — nơi người đọc file Sheet
không với tới. Thu hồi phiếu là xoá luôn bản gốc đó. Mỗi lần mở lại đều ghi vào nhật ký hồ sơ.

**Đối tác chỉ thấy tệp đã đánh dấu** *Đối tác xem được* ở mục Tài liệu đính kèm.
Ô này được **tích sẵn** khi tải tệp hoặc dán link, vì đó là trường hợp thường gặp.
Tệp mở bằng trình xem nhúng của Drive, trang không in đường dẫn tệp gốc.

### Quyền xem tệp trên Drive

Đối tác quét mã QR không đăng nhập Google, nên tệp để riêng tư sẽ hiện màn hình
*"Đăng nhập vào Tài khoản Google"* thay vì nội dung. Vì vậy khi bật ô *Đối tác xem được*,
hệ thống tự đặt tệp trên Drive sang chế độ **ai có link cũng xem được**, đồng thời
**chặn tải xuống, in và sao chép**. Tắt ô đó là tệp trở lại riêng tư ngay.

Đây là đánh đổi cần biết rõ: trong lúc ô được bật, ai có đường dẫn Drive của tệp đều xem
được mà không cần qua phiếu chia sẻ. Cách giảm thiểu: chỉ bật cho tệp thật sự cần gửi
đối tác, và tắt đi khi xong việc.

Tệp dạng link ngoài nằm ở tài khoản Drive khác nên hệ thống không đổi quyền được —
quyền của chúng do bên kho video quyết định.

Nếu nghi ngờ quyền trên Drive lệch so với dữ liệu trong Sheet, chạy hàm
`raSoatQuyenTep()` trong trình soạn thảo Apps Script để đặt lại cho khớp.

**Theo dõi và thu hồi.** Mỗi lần xác thực hay mở tệp đều ghi lại thời gian, địa chỉ IP
và kết quả. Nhập sai 5 lần thì phiếu tự khoá 15 phút. Bấm Thu hồi là cắt luôn mọi phiên
xem đang mở.

### Về bộ sinh mã QR

Mã QR được sinh ngay trong trình duyệt bằng `public/js/qr.js` — viết tay, không phụ thuộc
thư viện ngoài. Lý do không gọi dịch vụ sinh QR trên mạng: nội dung cần mã hoá chính là
đường dẫn có token, gửi nó sang máy chủ bên thứ ba là làm rò rỉ đúng thứ mà phiếu
đang bảo vệ.

Bộ sinh hỗ trợ chế độ byte (UTF-8), phiên bản 1–15, bốn mức sửa lỗi. Đã đối chiếu với
thư viện `qrcode` chuẩn (44 trường hợp khớp tuyệt đối từng ô) và giải mã ngược bằng
`jsQR` (48/48 lượt đọc ra đúng chuỗi gốc).

---

## Giai đoạn tiếp theo

**Giai đoạn 5 — Báo cáo và bàn giao.** Xuất Excel và PDF, báo cáo theo đơn vị và theo kênh;
kiểm thử phân quyền và bảo mật; tài liệu hướng dẫn cho ba nhóm người dùng.
