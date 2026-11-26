# EduMentor AI

**Hệ Thống Đánh Giá Và Hỗ Trợ Luyện Kỹ Năng Phỏng Vấn, Thuyết Trình Đa Phương Thức Ứng Dụng Computer Vision Và Speech-To-Text**

## Kiến trúc & Công nghệ

- **Frontend:** Next.js 15 (App Router, TypeScript), TailwindCSS, Recharts (Radar Chart & Timeline Chart), Lucide-React, MediaRecorder & Web Speech API.
- **Backend:** Python 3.12, FastAPI, WebSockets (`/ws/interview/{session_id}`), SQLAlchemy 2.0 Async, Celery + Redis.
- **Computer Vision Engine:** OpenCV (`opencv-python-headless`) + MediaPipe Face Mesh (`refine_landmarks=True` — Iris Tracking `468-477`, Head Pose `solvePnP` Pitch/Yaw/Roll, Facial Expression).
- **Speech & LLM Engine:** OpenAI Whisper / Faster-Whisper STT, tính tốc độ nói (WPM), bắt từ đệm tiếng Việt & tiếng Anh, Edge-TTS / OpenAI TTS, OpenAI / Google Gemini Structured JSON Evaluator (có chế độ Demo Offline tự động khi chưa cấu hình API key).
- **Database:** PostgreSQL (Docker/Production) hoặc SQLite Async (Local Dev mặc định).

---

## Cách chạy dự án

### Cách 1: Chạy trực tiếp trên máy (Local Dev — nhanh nhất)

#### 1. Khởi chạy Backend (FastAPI)
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# (Tùy chọn) điền OPENAI_API_KEY hoặc GEMINI_API_KEY vào .env
uvicorn app.main:app --reload --port 8000
```
API docs sẽ mở tại: `http://localhost:8000/docs`

#### 2. Khởi chạy Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
```
Truy cập ứng dụng tại: `http://localhost:3000`

### Cách 2: Chạy toàn bộ bằng Docker Compose (PostgreSQL + Redis + Celery + Backend + Frontend)
```bash
# (Tùy chọn) export OPENAI_API_KEY=sk-... hoặc GEMINI_API_KEY=...
docker compose up --build
```

---

## Kiểm thử (Testing)
```bash
cd backend
pytest -v
```
