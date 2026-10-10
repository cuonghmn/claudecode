# 💰 Sổ chi tiêu cá nhân — Google Sheets + Apps Script + AI

> 📚 **Bộ tài liệu cho người dùng:** mở [`docs/index.html`](./docs/index.html) gồm **hướng dẫn cài đặt từng bước** (có nút Copy code) và **hướng dẫn sử dụng tự diễn** trên app thật. Tạo lại sau khi sửa code: `node expense-tracker/mockup/build.js && node expense-tracker/docs/build.js`.

Web app ghi chi tiêu hằng tháng. Dữ liệu nằm trong **Google Sheet của bạn**, giao diện mở được trên điện thoại, và **AI** (tùy chọn: **Gemini miễn phí** để trải nghiệm, **Claude** khi dùng thật) dùng để hiểu câu nhập tự nhiên và nhận xét chi tiêu cuối tháng.

| Tính năng | Mô tả |
|---|---|
| ✍️ Ghi nhanh | Gõ `trưa phở 55k, grab 32k`, app tách thành từng khoản để bạn xác nhận rồi mới lưu |
| 📊 Tổng quan | KPI tháng, chi theo danh mục so với ngân sách, biểu đồ theo ngày, top 5 khoản lớn, dự báo cuối tháng |
| 📜 Lịch sử | Lọc theo tháng/danh mục, tìm kiếm, bấm vào khoản để sửa/xóa |
| 🎯 Ngân sách | Đặt hạn mức tháng cho từng danh mục |
| 🤖 Nhận xét tháng | AI tóm tắt, chỉ điểm bất thường, đề xuất 3 hành động cho tháng tới |

> Không có API key thì app vẫn chạy đầy đủ, chỉ chuyển sang **bộ tách offline** (hiểu `45k`, `1tr2`, `2,5tr`, `1.200.000`, `hôm qua`, `hôm kia`, `05/10`, `ck`, `thẻ`, `momo`, `tiền mặt`) và nhận xét theo quy tắc.

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
3. Quay lại Sheet và **tải lại trang (F5)**: bạn sẽ thấy 3 tab **GiaoDich**, **DanhMuc**, **NganSachThang**, cùng menu **💰 Chi tiêu**.
4. *(Muốn xem thử)* Chạy menu **💰 Chi tiêu → Thêm dữ liệu DEMO**. Xóa bằng **Xóa dữ liệu DEMO**.

### Bước 4 — Deploy web app
1. **Deploy → New deployment** → ⚙️ chọn **Web app**.
2. *Execute as*: **Me** · *Who has access*: **Only myself**.
3. **Deploy**, rồi copy **Web app URL** (`https://script.google.com/macros/s/.../exec`).
4. Trên điện thoại: mở URL bằng Chrome/Safari → **Thêm vào màn hình chính**. Từ đó dùng như một app.

> Mỗi lần sửa code: **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. URL giữ nguyên.

### Bước 5 — Bật AI (tùy chọn)

**Cách A: Gemini, miễn phí (khuyên dùng để trải nghiệm)**
1. Vào [aistudio.google.com](https://aistudio.google.com), đăng nhập bằng Gmail → **Get API key** → **Create API key**. Không cần thẻ.
2. Apps Script → **Project Settings ⚙️ → Script properties → Add script property**: `GEMINI_API_KEY` = key vừa tạo.
3. Tải lại web app. Cạnh tiêu đề "Ghi chi tiêu" sẽ hiện nhãn **🤖 Gemini**.

> Gói free có giới hạn số lượt/ngày (xem trong AI Studio) và Google có thể dùng dữ liệu gói free để cải thiện model. App chỉ gửi câu bạn gõ và số liệu tổng hợp tháng, không gửi cả Sheet.

**Cách B: Claude (khi dùng thật)**
1. Tạo API key tại [platform.claude.com](https://platform.claude.com) → *API Keys* (cần nạp credit; tính tiền riêng, không dùng chung gói Claude Pro/Max).
2. Thêm `ANTHROPIC_API_KEY` và đặt `AI_PROVIDER` = `claude`.

**Tất cả các cài đặt**

| Property | Giá trị | Ghi chú |
|---|---|---|
| `AI_PROVIDER` | `gemini` / `claude` / `off` | Bỏ trống: tự chọn theo key đang có, ưu tiên Gemini |
| `GEMINI_API_KEY` | key từ AI Studio | |
| `GEMINI_MODEL` | mặc định `gemini-flash-latest` | Luôn trỏ tới bản Flash mới nhất |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | |
| `CLAUDE_MODEL` | mặc định `claude-opus-5-5` | `claude-haiku-4-5` rẻ và nhanh hơn |

Chuyển từ Gemini sang Claude: chỉ cần thêm Claude key và đổi `AI_PROVIDER`, **không sửa code, không deploy lại**.

Nếu AI lỗi (hết hạn mức, hết credit, mất mạng…), app tự chuyển về bộ tách offline và báo cho bạn biết, không làm mất dữ liệu.

---

## Cấu trúc dữ liệu

**Sheet `GiaoDich`**: mỗi dòng là 1 khoản chi. Có thể sửa trực tiếp trên Sheet.

| ID | Ngày | Số tiền | Danh mục | Mô tả | Phương thức | Ghi chú | Tạo lúc |
|---|---|---|---|---|---|---|---|

**Sheet `DanhMuc`**: thêm/đổi tên danh mục, icon, ngân sách, **từ khóa nhận diện** ngay trên Sheet, app tự cập nhật.

| Danh mục | Icon | Ngân sách tháng | Từ khóa | Loại |
|---|---|---|---|---|
| Ăn uống | 🍜 | 4.000.000 | ăn, phở, cafe, trà sữa, siêu thị… | Chi tiêu |
| Tiết kiệm & Đầu tư | 💰 | 3.000.000 (mục tiêu) | tiết kiệm, đầu tư, vàng… | Để dành |

**Loại** = `Chi tiêu` (tính vào tổng chi và ngân sách) hoặc `Để dành` (tiết kiệm/đầu tư: không tính vào tổng chi, theo dõi riêng so với mục tiêu). Đã có Sheet từ bản cũ thì chạy lại **💰 Chi tiêu → Khởi tạo** để thêm cột này.

**Sheet `NganSachThang`**: hạn mức **riêng từng tháng** (chỉ chứa các tháng có chỉnh khác mặc định). Tháng không có dòng nào sẽ dùng "Ngân sách tháng" mặc định ở `DanhMuc`.

| Tháng (yyyy-MM) | Danh mục | Hạn mức |
|---|---|---|
| 2027-01 | Gia đình & Hiếu hỉ | 5.000.000 |

- Trên app: tab **Ngân sách** → chọn tháng ở dải tháng (đặt trước được tối đa 12 tháng tới) → nhập hạn mức. Nút ↺ đưa về mặc định, nút **Dùng làm mặc định** áp dụng các số đã chỉnh cho các tháng sau.
- Khi đổi hạn mức mặc định, app tự ghi lại hạn mức cũ cho các tháng đã qua, nên báo cáo tháng cũ không bị tính lại.

Mẹo: bộ tách offline chọn danh mục theo **từ khóa khớp dài nhất**. Ví dụ `mua cafe` → Ăn uống (`cafe` dài hơn `mua`). Gặp khoản bị xếp sai, chỉ cần thêm từ khóa vào sheet `DanhMuc`.

---

## Bảo mật & chi phí

- Web app để chế độ **Only myself**: chỉ tài khoản Google của bạn mở được.
- API key lưu trong *Script properties*, không nằm trong code hay Sheet.
- AI chỉ nhận: câu bạn vừa gõ (khi phân tích) và số liệu tổng hợp tháng (khi nhận xét). Không gửi cả Sheet.
- Không nhập số thẻ hay số tài khoản vào mô tả.
- Chi phí: Gemini gói free là 0đ trong hạn mức. Claude: mỗi lần tách câu tốn vài trăm token (vài trăm đồng); nhận xét tháng tốn hơn một chút.
- Với các model hỗ trợ, code bật `fallbacks: "default"`: nếu bộ lọc an toàn của Claude từ chối nhầm một yêu cầu, API tự chạy lại bằng model dự phòng.

## Lộ trình mở rộng gợi ý

| Giai đoạn | Tính năng |
|---|---|
| P2 | Khoản chi định kỳ tự động (tiền nhà, Netflix) bằng *time-driven trigger*; email tổng kết ngày 1 hằng tháng |
| P2 | Theo dõi thu nhập và tỷ lệ tiết kiệm |
| P3 | Chụp hóa đơn → AI đọc ảnh; dán SMS/thông báo ngân hàng để tự nhận diện |
