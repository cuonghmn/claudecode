# Ý tưởng sản phẩm: App ghi chi tiêu cá nhân "gõ như nhắn tin"

> Tài liệu ý tưởng gửi **Product Owner (PO)**. Copy toàn bộ phần dưới đây.

---

**Gửi PO,**

Tôi là **chủ ý tưởng và cũng là người dùng cuối** của sản phẩm này. Tôi **không phải dân code**. Tôi có một vấn đề hằng ngày và vài ý tưởng muốn biến thành một app nhỏ cho riêng mình.

**Vai trò trong dự án:**

| Vai trò | Ai | Trách nhiệm |
|---|---|---|
| Chủ ý tưởng / Người dùng / Người duyệt | Tôi | Đưa nỗi đau và ý tưởng, trả lời câu hỏi, duyệt phạm vi và bản mẫu, nghiệm thu |
| Product Owner | Bạn | Phân tích, phản biện, chốt phạm vi với tôi, viết backlog trên Jira, ưu tiên và nghiệm thu cùng tôi |
| Delivery team | Nhóm làm sản phẩm | Nhận ticket Jira từ PO: thiết kế, làm, kiểm thử, hướng dẫn cài đặt |

Những gì tôi viết dưới đây là **ý tưởng mở, không phải yêu cầu bắt buộc**. Tôi mong bạn phân tích, phản biện, và đề xuất cách làm đơn giản, hiệu quả nhất trước khi chuyển cho delivery team. Chỗ nào bạn thấy tôi đang làm phức tạp quá, cứ nói thẳng.

## 1. Nỗi đau của tôi

- **Cuối tháng nào cũng hỏi: tiền đi đâu hết?** Lương về, vài tuần sau đã gần hết mà không nhớ đã tiêu vào đâu.
- **Ghi chép mất công nên bỏ dở.** Mở Excel, chọn ngày, gõ số, chọn danh mục… mỗi khoản mất cả phút. Ghi được vài ngày là bỏ.
- **App có sẵn không vừa ý.** Cái thì rườm rà, nhiều tính năng tôi không dùng. Cái thì danh mục cứng nhắc, không đúng cách tôi chi tiêu. Cái thì đòi liên kết ngân hàng, tôi không yên tâm.
- **Ngân sách cứng nhắc.** Tháng nào cũng khác: có tháng đám cưới, tháng Tết, tháng đóng học phí. Đặt một con số cố định thì tháng nào cũng "vượt", rồi tôi mặc kệ luôn.
- **Có số liệu nhưng không biết nên làm gì.** Biểu đồ đẹp, nhưng không ai nói: tháng này tôi đang ổn hay không, nên cắt khoản nào.
- **Tiền để dành bị tính như tiền tiêu.** Chuyển tiền tiết kiệm hay đầu tư mà cũng bị cộng vào "đã chi", nhìn vào thấy sai.

## 2. Điều tôi mong muốn

- Ghi một khoản chi **trong vài giây**, ngay lúc vừa trả tiền, trên điện thoại.
- Lúc nào cũng biết: **tháng này đã chi bao nhiêu, còn được tiêu bao nhiêu**, tiền đang đi vào đâu.
- Cuối tháng (hoặc giữa tháng) có ai đó **nhìn số liệu và nói thẳng** cho tôi nên làm gì.
- Dữ liệu là **của tôi**, tôi xem và mang đi được, không bị khóa trong app nào.
- **Miễn phí hoặc gần như miễn phí** để dùng thử trước.

## 3. Những ý tưởng tôi đang hình dung

Đây là cách tôi đang nghĩ, bạn cứ phân tích và đề xuất lại.

### 3.1. Ghi chép nhanh "như nhắn tin"
- Tôi muốn gõ một câu như nhắn tin cho bạn bè, ví dụ:
  - `trưa phở 55k, grab 32k`
  - `hôm qua siêu thị 650k thẻ`
  - `vé máy bay 1tr2 ck`

  Rồi **AI tự tách** thành từng khoản: mô tả, số tiền, ngày, danh mục, cách trả (tiền mặt, thẻ, chuyển khoản).
- Tôi chỉ cần **xem lại, sửa nếu sai, rồi bấm Lưu**. Tôi không muốn AI tự lưu khi tôi chưa nhìn qua.
- Cách viết của người Việt khá đa dạng, AI cần hiểu được:
  - số tiền: 55k, 55 nghìn, 1tr2, 1 triệu 2, 5tr
  - ngày: hôm nay, hôm qua
  - viết tắt: ck, thẻ
- Lỡ tay lưu nhầm thì muốn **hoàn tác** ngay.
- Những khoản tôi hay ghi lặp lại (gửi xe, cà phê, Netflix…), có lẽ chỉ cần **chạm 1–2 lần** là xong?
- Đôi khi tôi vẫn muốn **nhập tay** từng ô.
- Đang ghi mà nảy ra một loại chi mới (ví dụ "Thú cưng"), tôi muốn **thêm danh mục ngay lúc đó**, không phải đi cài đặt trước.
- Tôi lo lúc AI lỗi hoặc hết lượt miễn phí thì app không dùng được. Có cách nào để **vẫn ghi được khi không có AI** không?

### 3.2. Xem lại chi tiêu gần đây
- Ngay dưới ô nhập, tôi muốn thấy các khoản vừa ghi **gom theo từng ngày**, mỗi ngày có tổng tiền.
- Chọn nhanh khoảng thời gian: 3 ngày gần đây (tôi nghĩ nên là mặc định), 5 ngày, tuần này, tháng này.
- Bấm vào một khoản để sửa hoặc xóa.

### 3.3. Ngân sách linh hoạt theo tháng
- Mỗi danh mục có một **hạn mức tháng**: Ăn uống, Đi lại, Nhà ở…
- **Mỗi tháng có thể khác nhau.** Tôi hình dung có một mức "mặc định", và tháng nào đặc biệt thì chỉnh riêng tháng đó. Tôi cũng muốn đặt trước được cho các tháng sắp tới (ví dụ tháng sau có đám cưới).
- Khoản chi thuộc danh mục chưa có ngân sách thì cần phân biệt rõ **"trong ngân sách" và "ngoài ngân sách"**, để tôi biết mình đang chi ngoài kế hoạch.
- **Tiết kiệm, đầu tư** là "để dành", không phải "chi tiêu". Nên tách riêng, có mục tiêu riêng, không cộng vào tổng chi.

### 3.4. Màn hình tổng quan
Tôi muốn mở ra là trả lời được ngay mấy câu hỏi:
- Tháng này **đã chi bao nhiêu, còn bao nhiêu** so với ngân sách?
- So với **cùng kỳ tháng trước** thì nhiều hay ít hơn? Tôi muốn so ngày 1–10 tháng này với ngày 1–10 tháng trước, không so với cả tháng trước.
- Cứ tiêu với tốc độ này thì **cuối tháng sẽ vào khoảng bao nhiêu**? Có vượt không?
- **Tiền đi đâu?** Tôi nghĩ một biểu đồ tròn theo danh mục là dễ nhìn nhất.
- Danh mục nào **sắp chạm hoặc đã vượt** hạn mức?
- Những **khoản lớn nhất** tháng này là gì?
- Chi tiêu **hằng ngày bình thường** là bao nhiêu? Tôi muốn tách khỏi các khoản lớn như tiền nhà, để biết mình đang tiêu vặt thế nào.
- Xem lại được các tháng trước. Tôi muốn **chuyển tháng thật nhanh** (kiểu vuốt hoặc chạm vào một dải tháng), không phải bấm lùi từng tháng.

### 3.5. Một nút để AI nhận xét
- Tôi muốn một nút kiểu **"Tạo nhận xét"**. Bấm vào, AI đọc số liệu tháng của tôi và trả lời ngắn gọn, nói thẳng, có con số cụ thể:
  - **Tóm tắt:** đang chi thế nào so với ngân sách và tháng trước, dự báo cuối tháng.
  - **Điểm đáng chú ý:** danh mục vượt, khoản ngoài ngân sách, khoản bất thường.
  - **Hành động tháng tới:** 2–3 việc cụ thể, đo được. Ví dụ: "giữ Ăn uống dưới 3.500.000đ, tối đa 2 lần ăn ngoài mỗi tuần".
- AI chỉ được dựa vào số liệu thật của tôi, **không bịa**.

### 3.6. Lịch sử
- Tìm lại khoản cũ theo tháng, hoặc **từ ngày… đến ngày…**, theo danh mục, hoặc gõ từ khóa.
- Sửa và xóa được, nhưng xóa thì nên có bước chống bấm nhầm.

## 4. Bối cảnh và giới hạn của tôi

- Tôi dùng chủ yếu trên **điện thoại**, đôi khi trên máy tính.
- Ngôn ngữ **tiếng Việt**, tiền **VNĐ** (định dạng 1.250.000đ).
- Tôi **không biết code**. Cài đặt và cập nhật cần làm được bằng cách làm theo hướng dẫn từng bước.
- Tôi đang nghĩ tới **Google Sheet** để lưu dữ liệu, vì quen và tôi tự mở xem được. Nhưng tôi chưa chắc đó là lựa chọn tốt nhất. Bạn hãy đề xuất.
- Về AI, tôi muốn thử bằng **AI miễn phí** trước (ví dụ Gemini bản miễn phí), sau này có thể chuyển sang Claude. Nếu đổi được AI mà không phải làm lại app thì tốt.
- **Chỉ mình tôi dùng.** Tôi không cần đăng ký tài khoản hay chia sẻ cho người khác.

## 5. Những thứ tôi KHÔNG cần (để tránh làm quá)

- Nhiều người dùng, phân quyền, chia sẻ chi tiêu nhóm
- Liên kết tài khoản ngân hàng, đọc SMS, lưu thông tin thẻ
- Quản lý thu nhập, nợ, đầu tư chi tiết
- App cài từ kho ứng dụng (mở bằng trình duyệt trên điện thoại là đủ, nếu bạn thấy hợp lý)

## 6. Tôi mong PO làm gì

### 6.1. Với tôi (trước khi tạo Jira)
1. **Tóm tắt lại** cách bạn hiểu nỗi đau và mục tiêu của tôi, trong vài dòng.
2. **Phản biện:**
   - Ý tưởng nào thừa, nên bỏ hoặc để sau?
   - Còn thiếu gì quan trọng?
   - Chỗ nào làm đơn giản hơn được?
3. **Đề xuất phạm vi bản đầu tiên (MVP)** và những gì để các bản sau.
4. **Đề xuất hướng nền tảng:** 2–3 phương án (lưu dữ liệu ở đâu, chạy app thế nào, dùng AI nào), mỗi phương án có ưu nhược điểm, chi phí và khuyến nghị. Có thể hỏi ý kiến delivery team về mặt kỹ thuật trước khi trình tôi.
5. **Khi cần tôi quyết định:** hỏi **từng điểm một**, mỗi điểm 2–3 phương án kèm đánh đổi và khuyến nghị. Đừng hỏi dồn một lúc.
6. Gửi tôi **bản tóm tắt sản phẩm (product brief) 1 trang** để duyệt. Tôi duyệt xong thì mới tạo Jira.

### 6.2. Backlog Jira cho delivery team
Cách chia Epic và Story là do bạn quyết. Tôi chỉ gợi ý các nhóm theo trải nghiệm ở mục 3:
- ghi chép nhanh
- xem gần đây
- ngân sách
- tổng quan
- AI nhận xét
- lịch sử
- cài đặt và hướng dẫn

Mỗi ticket tôi mong có:
- **User story:** "Là người dùng, tôi muốn… để…"
- **Bối cảnh / nỗi đau** liên quan (dẫn về mục 1)
- **Tiêu chí nghiệm thu (Acceptance criteria)**, viết kiểu Cho trước / Khi / Thì, kèm ví dụ thật (ví dụ câu nhập "trưa phở 55k, grab 32k" phải ra 2 khoản)
- **Quy tắc nghiệp vụ** nếu có (ví dụ: tiền để dành không tính vào tổng chi)
- **Độ ưu tiên** (MVP hay để sau) và **phụ thuộc** với ticket khác
- **Ngoài phạm vi** của ticket, để delivery team không làm quá

### 6.3. Cách làm tôi mong delivery team theo
- Làm **bản mẫu (mockup) bấm thử được** với dữ liệu giả hợp lý trước, để tôi trải nghiệm và chỉnh, rồi mới làm thật.
- Bàn giao kèm **hướng dẫn cài đặt từng bước** cho người không biết code.
- **Tự kiểm thử** trước khi giao: những câu nhập khó, ngày tháng, số tiền lớn, lúc mất AI, lúc chưa có dữ liệu.
- Mọi câu hỏi về nghiệp vụ đi qua PO. Tôi chỉ cần trả lời PO.

## 7. Tôi sẽ coi là thành công khi

- Ghi một khoản chi mất **dưới 5 giây**.
- Tôi dùng đều đặn **2 tuần liền** mà không bỏ.
- Bất cứ lúc nào mở app, tôi biết **tháng này còn được tiêu bao nhiêu** và **tiền đang đi đâu**.
- Cuối tháng có ít nhất **1 hành động cụ thể** để tháng sau chi tiêu tốt hơn.

**Bước đầu tiên:** bạn làm mục 6.1, bước 1 và 2 nhé. Chưa cần tạo Jira.
