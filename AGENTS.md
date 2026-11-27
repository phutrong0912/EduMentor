# AGENTS.md — Quy tắc phát triển & kiểm thử tự động (EduMentor AI)

Tài liệu này định nghĩa các quy tắc bắt buộc cho AI Agent khi chỉnh sửa mã nguồn trong dự án **EduMentor AI**.

---

## 1. Quy tắc kiểm tra sau khi sửa mã nguồn

### Khi chỉnh sửa code trong `backend/`
Sau mỗi lần thay đổi mã nguồn trong thư mục `backend/`, **bắt buộc** tự động chạy kiểm thử và kiểm tra cú pháp/import:

1. **Chạy bộ unit & integration tests (`pytest`):**
   ```bash
   cd backend && .venv/bin/pytest -v
   ```
   *(Nếu virtual environment đã được kích hoạt hoặc chạy trong Docker, dùng `pytest -v`.)*

2. **Kiểm tra cú pháp & import Python** (đặc biệt khi thay đổi cấu trúc module, schema hoặc chưa có test bao phủ):
   ```bash
   cd backend && .venv/bin/python -m compileall -q app tests && .venv/bin/python -c "import app.main"
   ```

### Khi chỉnh sửa code trong `frontend/`
Sau mỗi lần thay đổi mã nguồn trong thư mục `frontend/`, **bắt buộc** tự động chạy build hoặc lint để đảm bảo không có lỗi TypeScript/Next.js:

1. **Chạy production build (khuyến nghị kiểm tra đầy đủ TypeScript + Next.js bundling):**
   ```bash
   cd frontend && npm run build
   ```
2. **Hoặc chạy lint (và kiểm tra type nếu cần):**
   ```bash
   cd frontend && npm run lint
   ```
   *(Có thể kết hợp thêm `npx tsc --noEmit` để kiểm tra kiểu dữ liệu nhanh.)*

### Khi chỉnh sửa đồng thời cả `backend/` và `frontend/`
- Chạy đầy đủ kiểm tra cho **cả hai** phần (`backend/` và `frontend/`) trước khi báo hoàn thành.

---

## 2. Quy trình tự động xử lý lỗi (Fix-Until-Pass Loop)

Nếu bất kỳ lệnh kiểm thử, kiểm tra import/syntax, lint hoặc build nào thất bại:

1. **Đọc kỹ toàn bộ log lỗi** (traceback, dòng code lỗi, type error, failed assertions).
2. **Xác định nguyên nhân gốc rễ** và tiến hành sửa mã nguồn trực tiếp.
3. **Chạy lại lệnh kiểm tra** tương ứng sau khi sửa.
4. **Lặp lại quy trình** cho đến khi toàn bộ các bước kiểm tra **pass hoàn toàn (exit code 0)** trước khi kết thúc công việc và báo cáo cho người dùng.

---

## 3. Lưu ý chung cho dự án

- Tuân thủ kiến trúc và quy ước trong `Project_spec.md` và `README.md`.
- Giữ code rõ ràng, có type hints (Python) và TypeScript strict typing (`frontend/`).
- Không bỏ qua test thất bại hoặc dùng workaround che giấu lỗi biên dịch/type chỉ để build pass.
