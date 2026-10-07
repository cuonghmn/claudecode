# 💰 Sổ chi tiêu cá nhân — Google Sheets + Apps Script + Claude

Web app ghi chi tiêu hằng tháng. Dữ liệu nằm trong **Google Sheet của bạn**, giao diện mở được trên điện thoại, và **Claude** (tùy chọn) dùng để hiểu câu nhập tự nhiên và nhận xét chi tiêu cuối tháng.

| Tính năng | Mô tả |
|---|---|
| ✍️ Ghi nhanh | Gõ `trưa phở 55k, grab 32k`, app tách thành từng khoản để bạn xác nhận rồi mới lưu |
| 📊 Tổng quan | KPI tháng, chi theo danh mục so với ngân sách, biểu đồ theo ngày, top 5 khoản lớn, dự báo cuối tháng |
| 📜 Lịch sử | Lọc theo tháng/danh mục, tìm kiếm, bấm vào khoản để sửa/xóa |
| 🎯 Ngân sách | Đặt hạn mức tháng cho từng danh mục |
| 🤖 Nhận xét tháng | Claude tóm tắt, chỉ điểm bất thường, đề xuất 3 hành động cho tháng tới |

> Không có API key Claude thì app vẫn chạy đầy đủ, chỉ chuyển sang **bộ tách offline** (hiểu `45k`, `1tr2`, `2,5tr`, `1.200.000`, `hôm qua`, `hôm kia`, `05/10`, `ck`, `thẻ`, `momo`, `tiền mặt`) và nhận xét theo quy tắc.

---

## Cài đặt (khoảng 10 phút)

### Bước 1 — Tạo Google Sheet
1. Vào [sheets.new](https://sheets.new), đặt tên, ví dụ **Chi tiêu cá nhân**.
2. Menu **Tiện ích mở rộng → Apps Script**.

### Bước 2 — Dán code
Trong trình soạn thảo Apps Script:
1. Mở file `Code.gs` có sẵn, **xóa hết** nội dung rồi dán toàn bộ [`Code.gs`](./Code.gs).
2. Bấm **＋ → HTML**, đặt tên đúng là `Index` (không gõ `.html`), dán toàn bộ [`Index.html`](./Index.html).
3. *(Tùy chọn)* **Project Settings ⚙️** → tick *Show "appsscript.json" manifest file* → dán [`appsscript.json`](./appsscript.json) để đặt múi giờ Việt Nam và giới hạn quyền truy cập.
4. Bấm 💾 **Lưu**.

### Bước 3 — Khởi tạo Sheet
1. Ở thanh trên cùng chọn hàm **`setup`** → **Run**.
2. Lần đầu Google sẽ hỏi quyền: **Review permissions** → chọn tài khoản → *Advanced* → *Go to … (unsafe)* → **Allow**. Đây là script của chính bạn, chạy trên tài khoản của bạn.
3. Quay lại Sheet, bạn sẽ thấy 2 tab **GiaoDich** và **DanhMuc**, cùng menu **💰 Chi tiêu**.
4. *(Muốn xem thử)* Chạy menu **💰 Chi tiêu → Thêm dữ liệu DEMO**. Xóa bằng **Xóa dữ liệu DEMO**.

### Bước 4 — Deploy web app
1. **Deploy → New deployment** → ⚙️ chọn **Web app**.
2. *Execute as*: **Me** · *Who has access*: **Only myself**.
3. **Deploy**, rồi copy **Web app URL** (`https://script.google.com/macros/s/.../exec`).
4. Trên điện thoại: mở URL bằng Chrome/Safari → **Thêm vào màn hình chính**. Từ đó dùng như một app.

> Mỗi lần sửa code: **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. URL giữ nguyên.

### Bước 5 — Bật Claude (tùy chọn)
1. Tạo API key tại [platform.claude.com](https://platform.claude.com) → *API Keys*.
2. Apps Script → **Project Settings ⚙️ → Script properties → Add script property**:

| Property | Giá trị | Bắt buộc |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Có, để bật Claude |
| `CLAUDE_MODEL` | Mặc định `claude-opus-5-5`. Đổi sang `claude-sonnet-5-5` hoặc `claude-haiku-4-5` nếu muốn rẻ và nhanh hơn | Không |

3. Tải lại web app. Ô nhập sẽ hiện **🤖 Claude đang bật**.

Nếu Claude lỗi (hết credit, mất mạng…), app tự chuyển về bộ tách offline và báo cho bạn biết, không làm mất dữ liệu.

---

## Cấu trúc dữ liệu

**Sheet `GiaoDich`**: mỗi dòng là 1 khoản chi. Có thể sửa trực tiếp trên Sheet.

| ID | Ngày | Số tiền | Danh mục | Mô tả | Phương thức | Ghi chú | Tạo lúc |
|---|---|---|---|---|---|---|---|

**Sheet `DanhMuc`**: thêm/đổi tên danh mục, icon, ngân sách, **từ khóa nhận diện** ngay trên Sheet, app tự cập nhật.

| Danh mục | Icon | Ngân sách tháng | Từ khóa |
|---|---|---|---|
| Ăn uống | 🍜 | 4.000.000 | ăn, phở, cafe, trà sữa, siêu thị… |

Mẹo: bộ tách offline chọn danh mục theo **từ khóa khớp dài nhất**. Ví dụ `mua cafe` → Ăn uống (`cafe` dài hơn `mua`). Gặp khoản bị xếp sai, chỉ cần thêm từ khóa vào sheet `DanhMuc`.

---

## Bảo mật & chi phí

- Web app để chế độ **Only myself**: chỉ tài khoản Google của bạn mở được.
- API key lưu trong *Script properties*, không nằm trong code hay Sheet.
- Claude chỉ nhận: câu bạn vừa gõ (khi phân tích) và số liệu tổng hợp tháng (khi nhận xét). Không gửi cả Sheet.
- Không nhập số thẻ hay số tài khoản vào mô tả.
- Chi phí Claude: mỗi lần tách câu chỉ tốn vài trăm token, chi phí rất nhỏ. Nhận xét tháng tốn nhiều hơn một chút.
- Với các model hỗ trợ, code bật `fallbacks: "default"`: nếu bộ lọc an toàn của Claude từ chối nhầm một yêu cầu, API tự chạy lại bằng model dự phòng.

## Lộ trình mở rộng gợi ý

| Giai đoạn | Tính năng |
|---|---|
| P2 | Khoản chi định kỳ tự động (tiền nhà, Netflix) bằng *time-driven trigger*; email tổng kết ngày 1 hằng tháng |
| P2 | Theo dõi thu nhập và tỷ lệ tiết kiệm |
| P3 | Chụp hóa đơn → Claude đọc ảnh; dán SMS/thông báo ngân hàng để tự nhận diện |
