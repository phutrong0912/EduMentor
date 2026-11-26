# PROJECT SPECIFICATION: EduMentor AI
**Hệ Thống Đánh Giá Và Hỗ Trợ Luyện Kỹ Năng Phỏng Vấn, Thuyết Trình Đa Phương Thức Ứng Dụng Computer Vision Và Speech-To-Text**

---

## 1. SYSTEM ROLE & INSTRUCTIONS FOR AI AGENT (ANTIGRAVITY)
Bạn là một **Senior Full-Stack & AI Engineer**. Nhiệm vụ của bạn là hỗ trợ phát triển toàn diện hệ thống **EduMentor AI** dựa trên bản đặc tả kỹ thuật dưới đây.
- **Nguyên tắc làm việc:**
  1. Tuân thủ nghiêm ngặt kiến trúc và Tech Stack đã định nghĩa.
  2. Code phải sạch, có tính mô-đun hóa cao (modular), có type hints (Python) và TypeScript (Next.js).
  3. Xử lý bất đồng bộ (Async/Await) triệt để cho các luồng Streaming (WebSockets/WebRTC) để đảm bảo độ trễ thấp (low-latency).
  4. Luôn kiểm tra kỹ các edge-cases khi xử lý video/audio real-time (mất kết nối, không nhận diện được khuôn mặt, micro bị tắt).
  5. Khi được yêu cầu tạo một module, hãy cung cấp đầy đủ cấu trúc thư mục, code hoàn chỉnh và hướng dẫn cài đặt/chạy thử.

---

## 2. PROJECT OVERVIEW (TỔNG QUAN DỰ ÁN)
- **Tên hệ thống:** EduMentor AI
- **Mục tiêu cốt lõi:** Xây dựng nền tảng Web cho phép người dùng mô phỏng buổi phỏng vấn hoặc thuyết trình qua Webcam và Microphone trực tiếp. Hệ thống sử dụng **Multimodal AI Pipeline** (Computer Vision + Speech-to-Text + LLM) để theo dõi, chấm điểm theo thời gian thực và xuất báo cáo trực quan hóa (Dashboard).
- **Đối tượng sử dụng:** Sinh viên luyện phỏng vấn xin việc (ngành IT/Kinh tế) hoặc luyện thuyết trình bảo vệ đồ án.

---

## 3. TECH STACK & ARCHITECTURE (CÔNG NGHỆ & KIẾN TRÚC)

### 3.1. Công nghệ sử dụng
- **Frontend:** Next.js (App Router, TypeScript), TailwindCSS, Recharts / Chart.js (vẽ biểu đồ Radar), Lucide-React (icons), WebRTC / MediaRecorder API.
- **Backend API & Streaming:** Python 3.10+, FastAPI, WebSockets (`websockets` / FastAPI WebSocket).
- **Task Queue (Xử lý bất đồng bộ nặng):** Celery + Redis (dùng cho việc tổng hợp báo cáo sau phiên hoặc xử lý file audio/video dài).
- **Computer Vision Engine:** OpenCV (`opencv-python-headless`), MediaPipe (`mediapipe` - Face Mesh, Iris Tracking, Head Pose Estimation).
- **Speech & NLP Engine:**
  - Speech-to-Text (STT): OpenAI Whisper API hoặc Faster-Whisper (local) / Google Cloud STT.
  - Text-to-Speech (TTS): OpenAI TTS / Edge-TTS (giả lập giọng nói AI Interviewer).
  - LLM Evaluator: OpenAI API (`gpt-4o-mini` / `gpt-4o`) hoặc Google Gemini API (`gemini-1.5-flash` / `gemini-2.0-flash`).
- **Database & Storage:** PostgreSQL (SQLAlchemy / Prisma) hoặc Firebase (Firestore + Storage) lưu thông tin User, Session, Metrics, Transcript.

### 3.2. Luồng xử lý dữ liệu (Multimodal Pipeline)
1. **Capture Layer (Frontend):** Thu thập luồng Video (frames) và Audio (chunks) từ trình duyệt của người dùng.
2. **Streaming Layer:** Gửi Video frames (base64/binary) và Audio chunks qua **WebSocket** về FastAPI Backend.
3. **Parallel Processing Layer (Backend):**
   - *CV Worker:* Nhận frame -> MediaPipe phân tích hướng mắt (Gaze), góc nghiêng đầu (Head Pose), biểu cảm -> Trả về JSON metric real-time cho Frontend hiển thị cảnh báo nhẹ (nếu cần) và lưu log.
   - *Audio/STT Worker:* Nhận audio -> Chuyển thành văn bản (Transcript) -> Tính tốc độ nói (WPM), đếm từ đệm (Filler words).
4. **Evaluation & Agent Layer (LLM):**
   - Trong lúc phỏng vấn: Dựa vào câu trả lời vừa transcript được, LLM sinh câu hỏi phản biện/tiếp nối -> TTS đọc thành tiếng.
   - Kết thúc phiên: LLM tổng hợp toàn bộ Transcript + CV Metrics -> Chấm điểm 4 tiêu chí và xuất lộ trình cải thiện.

---

## 4. CORE MODULES & ALGORITHMS (CHI TIẾT TÍNH NĂNG)

### Module 1: Virtual Interview Room (Frontend - Next.js)
- Giao diện chia màn hình: Khung hiển thị Webcam người dùng (có overlay khung nhận diện tùy chọn) và Avatar/Sóng âm của AI Interviewer.
- Bộ điều khiển: Chọn chủ đề (IT Backend, IT Frontend, Kinh tế, Thuyết trình tự do), Bật/Tắt Mic & Cam, Bắt đầu/Kết thúc phiên.
- Hiển thị phụ đề (Live Transcript) và trạng thái AI (Đang nghe, Đang suy nghĩ, Đang nói).

### Module 2: Computer Vision Engine (Backend - Python/MediaPipe)
Trích xuất các chỉ số từ mỗi frame (xử lý ở mức 5-10 FPS để tối ưu hiệu năng):
- **Eye Contact Rate (%):** Sử dụng MediaPipe Face Mesh (đặc biệt là Iris landmarks: `468-477`) để tính toán tỷ lệ người dùng nhìn thẳng vào camera so với nhìn đi chỗ khác.
- **Head Pose Stability (Độ ổn định tư thế):** Tính toán góc `Pitch`, `Yaw`, `Roll` của đầu thông qua `solvePnP` của OpenCV. Cảnh báo nếu cúi đầu quá thấp hoặc quay ngang quá lâu.
- **Facial Expression / Confidence:** Phân tích độ mở của miệng, nụ cười, nhíu mày dựa trên tỷ lệ khoảng cách giữa các điểm landmarks khuôn mặt.

### Module 3: Speech & NLP Engine (Backend - Python)
- **Speech-to-Text (STT):** Chuyển đổi giọng nói tiếng Việt / tiếng Anh sang văn bản kèm theo timestamp từng từ/câu.
- **Speaking Rate (WPM - Words Per Minute):**
  $$\text{WPM} = \frac{\text{Tổng số từ nói được}}{\text{Tổng thời gian nói (phút)}}$$
  *(Ngưỡng chuẩn tham khảo: 120 - 150 WPM)*.
- **Filler Words Detection (Phát hiện từ đệm):** Sử dụng Regex kết hợp NLP để đếm tần suất xuất hiện các từ như: *"à", "ừm", "thì", "là", "kiểu như", "cơ bản là", "um", "uh", "like", "you know"*.

### Module 4: LLM Interviewer & Evaluator
- **Role:** Đóng vai nhà tuyển dụng chuyên nghiệp.
- **Prompting Logic:**
  - *Chế độ hội thoại:* Nhận lịch sử chat + câu trả lời mới nhất -> Trả về câu hỏi tiếp theo ngắn gọn, tự nhiên (dưới 3 câu) để tối ưu tốc độ TTS.
  - *Chế độ chấm điểm (Output JSON Schema bắt buộc):* Đánh giá trên thang điểm 100 cho 4 khía cạnh:
    1. **Nội dung (Content):** Độ liên quan, tính logic, cấu trúc STAR (nếu phỏng vấn).
    2. **Ngữ điệu & Tốc độ (Tone & Pace):** Dựa trên WPM và số lượng từ đệm.
    3. **Tác phong & Biểu cảm (Posture & Expression):** Dựa trên Head Pose và sắc thái.
    4. **Tương tác mắt (Eye Contact):** Dựa trên tỷ lệ nhìn vào camera.

### Module 5: Analytics Dashboard (Frontend - Next.js)
- **Biểu đồ Radar (Radar Chart):** Trực quan hóa 4 trục điểm số (Nội dung – Ngữ điệu – Tác phong – Tương tác mắt).
- **Timeline Chart:** Biểu đồ đường thể hiện sự biến thiên của Eye Contact và Tốc độ nói theo từng phút của buổi phỏng vấn.
- **Transcript Review:** Hiển thị lại toàn bộ đoạn hội thoại, highlight màu đỏ các **từ đệm (filler words)** và màu vàng các đoạn nói quá nhanh/chậm.
- **Actionable Feedback:** Danh sách điểm mạnh, điểm yếu và gợi ý cách trả lời hay hơn từ LLM.

---

## 5. PROPOSED DIRECTORY STRUCTURE (CẤU TRÚC THƯ MỤC ĐỀ XUẤT)

```text
edumentor-ai/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes/          # REST endpoints (auth, sessions, reports)
│   │   │   └── websockets.py    # WebSocket handler cho video/audio stream
│   │   ├── core/
│   │   │   ├── config.py        # Env variables, API keys
│   │   │   └── database.py      # PostgreSQL connection
│   │   ├── services/
│   │   │   ├── cv_engine.py     # MediaPipe Gaze & Head Pose logic
│   │   │   ├── stt_engine.py    # Whisper STT, WPM & Filler words logic
│   │   │   ├── llm_agent.py     # Gemini/OpenAI Interviewer & Evaluator
│   │   │   └── tts_engine.py    # Text-to-Speech generator
│   │   ├── models/              # SQLAlchemy DB models
│   │   ├── schemas/             # Pydantic schemas
│   │   └── main.py              # FastAPI entry point
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx         # Landing page
│   │   │   ├── interview/       # Phòng luyện phỏng vấn (WebRTC + WS)
│   │   │   └── dashboard/[id]/  # Trang báo cáo kết quả & Radar chart
│   │   ├── components/
│   │   │   ├── WebcamStream.tsx
│   │   │   ├── RadarScoreChart.tsx
│   │   │   └── TranscriptViewer.tsx
│   │   ├── hooks/               # Custom hooks (useWebSocket, useMediaRecorder)
│   │   └── types/               # TypeScript interfaces
│   ├── package.json
│   └── tailwind.config.ts
└── docker-compose.yml
```

---

## 6. EXECUTION ROADMAP (LỘ TRÌNH TRIỂN KHAI CHO AGENT)
Khi tôi yêu cầu bắt đầu code, hãy thực hiện tuần tự theo từng giai đoạn (Phase) sau, xác nhận hoàn thành từng Phase trước khi sang Phase tiếp theo:

- **Phase 1: Project Setup & Database Schema**
  - Khởi tạo cấu trúc thư mục `backend` (FastAPI) và `frontend` (Next.js).
  - Thiết kế Database Models (`User`, `InterviewSession`, `SessionMetrics`, `TranscriptItem`).
- **Phase 2: Computer Vision Engine (`cv_engine.py`)**
  - Viết module nhận ảnh (OpenCV frame), chạy MediaPipe Face Mesh để tính Eye Contact, Head Pose (Pitch/Yaw/Roll) và trả về JSON metrics.
- **Phase 3: Speech & NLP Engine (`stt_engine.py` & `llm_agent.py`)**
  - Tích hợp Whisper STT, viết hàm tính WPM và bắt từ đệm tiếng Việt/Anh.
  - Xây dựng LLM Agent với Structured Output (JSON) để sinh câu hỏi và chấm điểm 4 tiêu chí.
- **Phase 4: Real-time Streaming Backend (`websockets.py`)**
  - Kết nối WebSocket nhận luồng frame + audio chunk từ client, điều phối qua CV Engine và Speech Engine.
- **Phase 5: Frontend Virtual Interview Room**
  - Xây dựng UI phòng phỏng vấn, truy cập Camera/Mic, gửi dữ liệu qua WebSocket và phát âm thanh phản hồi từ AI.
- **Phase 6: Analytics Dashboard**
  - Xây dựng trang báo cáo với biểu đồ Radar 4 chiều, biểu đồ Timeline và trình xem Transcript có highlight lỗi từ đệm.