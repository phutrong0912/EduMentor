# EduMentor AI

> **Hệ Thống Đánh Giá Và Hỗ Trợ Luyện Kỹ Năng Phỏng Vấn, Thuyết Trình Đa Phương Thức Ứng Dụng Computer Vision, Speech-To-Text Và LLM**

[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2015%20%7C%20TypeScript-black)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python%203.12-009688)](https://fastapi.tiangolo.com/)
[![MediaPipe](https://img.shields.io/badge/CV-OpenCV%20%2B%20MediaPipe-blue)](https://developers.google.com/mediapipe)
[![Docker](https://img.shields.io/badge/Deploy-Docker%20Compose-2496ED)](https://www.docker.com/)

---

## 1. Giới thiệu tổng quan

**EduMentor AI** là nền tảng Web mô phỏng buổi phỏng vấn xin việc (IT Backend, IT Frontend, Kinh tế) và thuyết trình bảo vệ đồ án trực tiếp qua **Webcam & Microphone**. Hệ thống vận hành theo **Multimodal AI Pipeline** kết hợp 3 trụ cột:

1. **Computer Vision Engine (OpenCV + MediaPipe Face Mesh):** Phân tích real-time 5–10 FPS hướng nhìn của mắt (**Eye Contact** qua Iris landmarks `468–477`), góc nghiêng đầu (**Head Pose: Pitch, Yaw, Roll** qua `cv2.solvePnP`), độ ổn định tư thế và sắc thái biểu cảm.
2. **Speech & NLP Analytics Engine:** Chuyển giọng nói tiếng Việt / tiếng Anh sang văn bản (OpenAI Whisper / Faster-Whisper / Web Speech API), đo tốc độ nói (**WPM** — chuẩn `120–150 WPM`) và phát hiện từ đệm (*"à", "ừm", "thì", "kiểu như", "cơ bản là", "um", "uh", "like", "you know"*...).
3. **LLM Interviewer & Evaluator:** Đóng vai nhà tuyển dụng/hội đồng phản biện (OpenAI `gpt-4o-mini` hoặc Google Gemini `gemini-2.0-flash`, hỗ trợ sẵn chế độ **Demo Offline** khi chưa cấu hình API key), đọc câu hỏi bằng giọng nói **Edge-TTS / OpenAI TTS**, và xuất báo cáo chấm điểm **Structured JSON 4 tiêu chí** kèm lộ trình cải thiện theo cấu trúc **STAR**.

---

## 2. Tính năng nổi bật

- **Phòng luyện phỏng vấn ảo (`/interview`):**
  - Giao diện chia đôi màn hình: Webcam (tùy chọn bật/tắt khung nhận diện Face Mesh, HUD Eye Contact & góc đầu `Pitch/Yaw/Roll`, cảnh báo tư thế nhẹ theo thời gian thực) và AI Interviewer (Avatar, sóng âm, trạng thái AI).
  - Cá nhân hóa câu hỏi bằng cách **dán tóm tắt CV / JD / Đề cương thuyết trình** và chọn **Cấp độ phản biện** (*Thân thiện / Fresher*, *Chuyên nghiệp / Mid*, *Phản biện gắt / Senior*).
  - **Thanh đo âm lượng Mic trực tiếp (Live VU Meter)** giúp kiểm tra trạng thái micro tức thì, kèm khung nhập văn bản dự phòng khi không có micro.
  - Hiển thị phụ đề trực tiếp (**Live Transcript**) với chỉ số WPM và số từ đệm sau mỗi lượt trả lời.
- **Analytics Dashboard (`/dashboard/[id]`):**
  - **Biểu đồ Radar 4 chiều:** *Nội dung · Ngữ điệu & Tốc độ · Tác phong & Biểu cảm · Tương tác mắt*.
  - **Biểu đồ Timeline:** Biến thiên Eye Contact (%) và tốc độ nói (WPM) theo từng phút.
  - **Transcript Review:** Highlight **màu đỏ** các từ đệm và **viền vàng** các đoạn nói quá nhanh (`>160 WPM`) hoặc quá chậm (`<110 WPM`).
  - **Actionable Feedback & STAR Improvements:** Điểm mạnh, điểm cần khắc phục, lộ trình cải thiện và gợi ý viết lại câu trả lời theo cấu trúc STAR.
  - Hỗ trợ **Xuất báo cáo Markdown (`.md`)** và **In / Lưu PDF**.
- **Theo dõi tiến độ & Demo nhanh (`/history`):**
  - Biểu đồ xu hướng tiến bộ đa phiên (Overall Score & Eye Contact %), lọc theo chủ đề, quản lý/xóa phiên.
  - Nút **Tạo báo cáo Demo mẫu (1-click)** tạo sẵn dữ liệu 3 phút phỏng vấn hoàn chỉnh để trình diễn nhanh trước hội đồng.
- **Xác thực người dùng (`/auth`):**
  - Đăng ký / Đăng nhập bằng JWT (`/api/auth/register`, `/api/auth/login`), đồng thời vẫn cho phép trải nghiệm ngay ở chế độ khách.

---

## 3. Kiến trúc hệ thống & Cấu trúc thư mục

```text
EduMentor/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── auth.py          # JWT Register / Login
│   │   │   │   ├── sessions.py      # CRUD phiên + POST /demo
│   │   │   │   └── reports.py       # Báo cáo & chấm điểm lại
│   │   │   └── websockets.py        # WebSocket /ws/interview/{session_id}
│   │   ├── core/
│   │   │   ├── config.py            # Cấu hình Pydantic Settings
│   │   │   ├── database.py          # SQLAlchemy Async (SQLite / PostgreSQL)
│   │   │   └── celery_app.py        # Celery + Redis task queue
│   │   ├── models/models.py         # User, InterviewSession, SessionMetrics, TranscriptItem
│   │   ├── schemas/schemas.py       # Pydantic v2 Schemas & Structured Evaluation JSON
│   │   ├── services/
│   │   │   ├── cv_engine.py         # MediaPipe Face Mesh (Iris + solvePnP Head Pose)
│   │   │   ├── stt_engine.py        # Whisper STT, WPM & Filler Words Detector
│   │   │   ├── tts_engine.py        # Edge-TTS / OpenAI TTS
│   │   │   ├── llm_agent.py         # OpenAI / Gemini Interviewer & Evaluator
│   │   │   └── report_service.py    # Tổng hợp Timeline & báo cáo cuối phiên
│   │   └── main.py                  # FastAPI entry point
│   ├── tests/                       # Unit & Integration tests (pytest)
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx             # Trang chủ
│   │   │   ├── interview/page.tsx   # Phòng phỏng vấn ảo
│   │   │   ├── dashboard/[id]/      # Trang báo cáo & Radar/Timeline charts
│   │   │   ├── history/page.tsx     # Lịch sử & biểu đồ tiến bộ
│   │   │   └── auth/page.tsx        # Đăng nhập / Đăng ký
│   │   ├── components/              # WebcamStream, AiInterviewerCard, AudioLevelMeter, Charts, TranscriptViewer
│   │   ├── hooks/                   # useWebSocket, useMediaRecorder
│   │   ├── lib/api.ts               # REST API client
│   │   └── types/index.ts           # TypeScript interfaces
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml               # PostgreSQL + Redis + Backend + Celery + Frontend
├── Project_spec.md                  # Đặc tả kỹ thuật dự án
└── README.md
```

---

## 4. Hướng dẫn cài đặt và chạy thử

### Cách 1: Chạy trực tiếp trên máy (Local Dev — khuyến nghị khi phát triển)

#### Bước 1: Khởi chạy Backend (FastAPI)
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```
Mở file `backend/.env` và (tùy chọn) điền `GEMINI_API_KEY` hoặc `OPENAI_API_KEY`. Nếu để trống, hệ thống tự động chạy chế độ **Demo Offline** không lỗi.

Chạy server:
```bash
uvicorn app.main:app --reload --port 8000
```
- API Swagger Docs: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/health`

#### Bước 2: Khởi chạy Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
```
- Truy cập ứng dụng tại: `http://localhost:3000`

---

### Cách 2: Chạy toàn bộ bằng Docker Compose (PostgreSQL + Redis + Celery + Full-Stack)

```bash
# (Tùy chọn) cung cấp API key qua biến môi trường
export GEMINI_API_KEY="your-gemini-key"
# hoặc export OPENAI_API_KEY="sk-..."

docker compose up --build
```
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`

---

## 5. API & WebSocket Endpoints chính

| Phương thức | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `GET` | `/health` | Kiểm tra trạng thái server & AI providers đang kích hoạt |
| `POST` | `/api/auth/register` · `/login` | Đăng ký / Đăng nhập trả về JWT |
| `POST` | `/api/sessions` | Tạo phiên phỏng vấn / thuyết trình mới |
| `POST` | `/api/sessions/demo` | Tạo nhanh phiên Demo mẫu kèm dữ liệu CV & Transcript |
| `GET` | `/api/sessions` | Lấy danh sách lịch sử phiên |
| `POST` | `/api/sessions/{id}/end` | Kết thúc phiên và kích hoạt chấm điểm |
| `GET` | `/api/reports/{id}` | Lấy toàn bộ báo cáo (Radar, Timeline, Transcript, Feedback) |
| `WS` | `/ws/interview/{id}` | Streaming real-time `video_frame`, `audio_chunk`, `user_transcript` |

---

## 6. Kiểm thử (Testing)

```bash
# Backend tests (CV edge cases, STT WPM/fillers, WebSocket & API lifecycle)
cd backend
pytest -v

# Frontend typecheck & production build
cd frontend
npx tsc --noEmit && npm run build
```
