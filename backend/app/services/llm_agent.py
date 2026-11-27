"""
LLM Interviewer & Evaluator Agent for EduMentor AI.
Supports OpenAI (gpt-4o-mini / gpt-4o), Google Gemini (gemini-2.0-flash),
and an intelligent offline Demo/Mock mode when API keys are not configured.
"""

from __future__ import annotations

import json
import logging
from typing import Dict, List

from app.core.config import settings
from app.schemas.schemas import (
    CriteriaScores,
    EvaluationReport,
    SampleImprovement,
)

logger = logging.getLogger(__name__)

# Structured fallback interview banks per topic (VI & EN)
TOPIC_QUESTIONS_VI: Dict[str, List[str]] = {
    "IT Backend": [
        "Chào bạn! Rất vui được gặp bạn hôm nay. Bạn hãy giới thiệu ngắn gọn về bản thân và một dự án Backend mà bạn tâm đắc nhất nhé?",
        "Trong dự án đó, bạn đã thiết kế cơ sở dữ liệu và xử lý vấn đề hiệu năng hoặc truy vấn chậm như thế nào?",
        "Nếu hệ thống API của bạn đột ngột tăng gấp 10 lần lượng truy cập, bạn sẽ áp dụng chiến lược caching và scaling nào?",
        "Hãy kể về một sự cố production hoặc bug khó nhất bạn từng gặp theo mô hình STAR và cách bạn khắc phục.",
        "Cảm ơn phần chia sẻ của bạn! Bạn có câu hỏi nào dành cho đội ngũ kỹ thuật của công ty không?",
    ],
    "IT Frontend": [
        "Xin chào! Bạn có thể giới thiệu về kinh nghiệm làm Frontend và framework mà bạn sử dụng thành thạo nhất không?",
        "Khi xây dựng một trang web có nhiều dữ liệu thời gian thực, bạn tối ưu hóa hiệu năng render và trải nghiệm người dùng bằng cách nào?",
        "Bạn quản lý state toàn cục và xử lý lỗi bất đồng bộ trong React/Next.js theo hướng nào?",
        "Hãy chia sẻ một lần bạn phải phối hợp với Designer hoặc Backend để giải quyết một yêu cầu UI phức tạp.",
        "Rất tốt! Bạn có muốn đặt câu hỏi gì thêm cho chúng tôi trước khi kết thúc buổi phỏng vấn không?",
    ],
    "Kinh tế": [
        "Chào bạn! Bạn hãy giới thiệu ngắn gọn về định hướng nghề nghiệp của mình trong lĩnh vực Kinh tế - Tài chính nhé?",
        "Hãy phân tích một xu hướng thị trường gần đây mà bạn cho là ảnh hưởng lớn đến doanh nghiệp Việt Nam.",
        "Khi phải thuyết phục một khách hàng hoặc đối tác khó tính, bạn thường xây dựng lập luận dựa trên những dữ liệu nào?",
        "Hãy kể một tình huống bạn làm việc nhóm gặp mâu thuẫn về quan điểm và cách bạn giải quyết để đạt mục tiêu chung.",
        "Cảm ơn bạn đã tham gia buổi phỏng vấn! Bạn có câu hỏi nào dành cho ban tuyển dụng không?",
    ],
    "Thuyết trình tự do": [
        "Chào bạn! Hôm nay bạn sẽ thuyết trình về đề tài gì? Hãy trình bày phần mở đầu và mục tiêu cốt lõi của bài nói nhé.",
        "Điểm nổi bật hoặc đóng góp mới nhất trong đề tài của bạn so với các giải pháp hiện có là gì?",
        "Nếu hội đồng phản biện đặt câu hỏi về hạn chế lớn nhất của giải pháp này, bạn sẽ trả lời ra sao?",
        "Bạn có thể tóm tắt kết quả đạt được và hướng phát triển tiếp theo trong 30 giây được không?",
        "Cảm ơn bài thuyết trình của bạn! Hãy nhấn nút Kết thúc phiên để xem báo cáo phân tích chi tiết nhé.",
    ],
}

TOPIC_QUESTIONS_EN: Dict[str, List[str]] = {
    "IT Backend": [
        "Hello! Welcome to the interview. Could you briefly introduce yourself and highlight a backend project you are most proud of?",
        "How did you design the database schema and optimize slow queries in that project?",
        "If your API traffic suddenly spiked 10x, what caching and horizontal scaling strategies would you apply?",
        "Tell me about a tough production bug you solved using the STAR method.",
        "Thank you for your answers! Do you have any questions for our engineering team?",
    ],
    "IT Frontend": [
        "Hi there! Could you tell me about your frontend background and the frameworks you enjoy working with most?",
        "How do you optimize rendering performance and Core Web Vitals on data-heavy web apps?",
        "What is your approach to state management and error handling in Next.js or React?",
        "Describe a challenging UI/UX problem you solved in collaboration with designers or backend engineers.",
        "Great job! Do you have any questions for us before we wrap up?",
    ],
    "Kinh tế": [
        "Welcome! Please introduce yourself and share your career goals in business or economics.",
        "What recent market trend do you think will have the biggest impact on businesses this year?",
        "How do you structure a data-driven pitch to persuade a skeptical stakeholder?",
        "Share an example of resolving a disagreement in a team project to deliver results on time.",
        "Thank you! Do you have any questions for the hiring panel?",
    ],
    "Thuyết trình tự do": [
        "Welcome! Please introduce your presentation topic and the core problem you are solving.",
        "What makes your approach stand out compared to existing solutions?",
        "How would you respond if a committee member challenged the biggest limitation of your work?",
        "Could you summarize your key findings and future work in 30 seconds?",
        "Thank you for presenting! Click End Session whenever you are ready to view your analytics report.",
    ],
}


class LLMAgent:
    """Handles conversational interviewing and 4-criteria structured evaluation."""

    def get_opening_question(
        self,
        topic: str,
        mode: str,
        language: str = "vi",
        difficulty: str = "medium",
        custom_context: str | None = None,
    ) -> str:
        if custom_context and custom_context.strip():
            snippet = custom_context.strip().splitlines()[0][:100]
            if language == "en":
                return (
                    f"Welcome! I reviewed your profile/context ('{snippet}...'). "
                    f"To kick off this {difficulty}-level {topic} session, could you walk me through your most impactful achievement related to this?"
                )
            return (
                f"Chào bạn! Tôi đã xem qua thông tin CV/đề cương bạn gửi ('{snippet}...'). "
                f"Để mở đầu buổi luyện tập {topic} mức độ {difficulty}, bạn hãy giới thiệu ngắn gọn về điểm nổi bật nhất của mình nhé?"
            )
        bank = TOPIC_QUESTIONS_VI if language == "vi" else TOPIC_QUESTIONS_EN
        questions = bank.get(topic) or bank["Thuyết trình tự do"]
        return questions[0]

    async def generate_next_question(
        self,
        topic: str,
        mode: str,
        language: str,
        history: List[Dict[str, str]],
        difficulty: str = "medium",
        custom_context: str | None = None,
    ) -> str:
        """Generate a concise (< 3 sentences) natural follow-up question."""
        provider = settings.active_llm_provider

        system_prompt = self._build_interviewer_system_prompt(
            topic, mode, language, difficulty, custom_context
        )
        if provider == "openai" and settings.OPENAI_API_KEY:
            reply = await self._call_openai_chat(system_prompt, history)
            if reply:
                return reply
        elif provider == "gemini" and settings.GEMINI_API_KEY:
            reply = await self._call_gemini_chat(system_prompt, history)
            if reply:
                return reply

        return self._fallback_next_question(topic, language, history)

    async def evaluate_session(
        self,
        topic: str,
        mode: str,
        language: str,
        transcripts: List[Dict],
        cv_summary: Dict[str, float],
        speech_summary: Dict[str, float],
    ) -> EvaluationReport:
        """Generate a structured 4-criteria EvaluationReport (0-100 scale)."""
        provider = settings.active_llm_provider

        prompt = self._build_evaluation_prompt(
            topic, mode, language, transcripts, cv_summary, speech_summary
        )

        raw_json: str | None = None
        if provider == "openai" and settings.OPENAI_API_KEY:
            raw_json = await self._call_openai_json(prompt)
        elif provider == "gemini" and settings.GEMINI_API_KEY:
            raw_json = await self._call_gemini_json(prompt)

        if raw_json:
            try:
                parsed = json.loads(raw_json)
                return EvaluationReport.model_validate(parsed)
            except Exception as exc:
                logger.warning("Failed to parse LLM evaluation JSON, using heuristic evaluator: %s", exc)

        return self._heuristic_evaluation(
            topic, language, transcripts, cv_summary, speech_summary
        )

    @staticmethod
    def _build_interviewer_system_prompt(
        topic: str,
        mode: str,
        language: str,
        difficulty: str = "medium",
        custom_context: str | None = None,
    ) -> str:
        lang_label = "Vietnamese" if language == "vi" else "English"
        role_desc = (
            "a professional HR/Technical Interviewer"
            if mode == "interview"
            else "an academic thesis defense committee member"
        )
        difficulty_guidance = {
            "easy": "Be encouraging and supportive, asking foundational questions suitable for an intern or fresher.",
            "medium": "Be balanced and professional, probing practical implementation details and trade-offs.",
            "hard": "Be rigorous and challenging like a Senior/Staff panel, asking sharp follow-up questions about edge cases, scale, and measurable impact.",
        }.get(difficulty, "")

        context_block = (
            f" Candidate CV / Job Description / Outline provided:\n{custom_context.strip()[:1500]}\n"
            "Tailor your questions specifically to this context."
            if custom_context and custom_context.strip()
            else ""
        )

        return (
            f"You are {role_desc} conducting a live session on the topic '{topic}'. "
            f"{difficulty_guidance}{context_block} "
            f"Respond strictly in {lang_label}. "
            "Acknowledge the candidate's latest answer briefly and ask ONE sharp, natural follow-up question. "
            "Keep your entire response under 3 short sentences so Text-to-Speech latency stays low. "
            "Do not use markdown bullet points or emojis."
        )

    @staticmethod
    def _build_evaluation_prompt(
        topic: str,
        mode: str,
        language: str,
        transcripts: List[Dict],
        cv_summary: Dict[str, float],
        speech_summary: Dict[str, float],
    ) -> str:
        lang_label = "Vietnamese" if language == "vi" else "English"
        transcript_text = "\n".join(
            f"[{t.get('speaker', 'user').upper()} | {t.get('wpm', 0)} WPM | fillers={t.get('filler_count', 0)}]: {t.get('text', '')}"
            for t in transcripts
        )
        return (
            f"Evaluate this {mode} session on '{topic}'. Write all feedback strictly in {lang_label}.\n\n"
            f"COMPUTER VISION METRICS:\n{json.dumps(cv_summary, ensure_ascii=False)}\n\n"
            f"SPEECH METRICS:\n{json.dumps(speech_summary, ensure_ascii=False)}\n\n"
            f"TRANSCRIPT:\n{transcript_text or '(No speech recorded)'}\n\n"
            "Return ONLY a valid JSON object matching this exact schema:\n"
            "{\n"
            '  "overall_score": <float 0-100>,\n'
            '  "scores": {\n'
            '    "content": <float 0-100>,\n'
            '    "tone_pace": <float 0-100>,\n'
            '    "posture_expression": <float 0-100>,\n'
            '    "eye_contact": <float 0-100>\n'
            "  },\n"
            '  "summary": "<2-3 sentence executive summary>",\n'
            '  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],\n'
            '  "weaknesses": ["<weakness 1>", "<weakness 2>"],\n'
            '  "actionable_feedback": ["<step 1>", "<step 2>", "<step 3>"],\n'
            '  "sample_improvements": [\n'
            '    {"original_excerpt": "<quote from user>", "improved_suggestion": "<better STAR answer>", "reason": "<why>"}\n'
            "  ]\n"
            "}"
        )

    async def _call_openai_chat(
        self, system_prompt: str, history: List[Dict[str, str]]
    ) -> str:
        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            messages = [{"role": "system", "content": system_prompt}]
            for item in history[-10:]:
                role = "assistant" if item.get("speaker") == "ai" else "user"
                messages.append({"role": role, "content": item.get("text", "")})

            resp = await client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=messages,
                temperature=0.7,
                max_tokens=160,
            )
            return (resp.choices[0].message.content or "").strip()
        except Exception as exc:
            logger.error("OpenAI chat error: %s", exc)
            return ""

    async def _call_openai_json(self, prompt: str) -> str | None:
        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            resp = await client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": "You are an expert interview coach. Return valid JSON only."},
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.3,
            )
            return resp.choices[0].message.content
        except Exception as exc:
            logger.error("OpenAI evaluation error: %s", exc)
            return None

    async def _call_gemini_chat(
        self, system_prompt: str, history: List[Dict[str, str]]
    ) -> str:
        try:
            import asyncio
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            convo = "\n".join(
                f"{'Interviewer' if h.get('speaker') == 'ai' else 'Candidate'}: {h.get('text', '')}"
                for h in history[-10:]
            )
            prompt = f"Conversation so far:\n{convo}\n\nProvide the interviewer's next concise response:"

            def _run() -> str:
                resp = client.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        temperature=0.7,
                        max_output_tokens=160,
                    ),
                )
                return (resp.text or "").strip()

            return await asyncio.to_thread(_run)
        except Exception as exc:
            logger.error("Gemini chat error: %s", exc)
            return ""

    async def _call_gemini_json(self, prompt: str) -> str | None:
        try:
            import asyncio
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=settings.GEMINI_API_KEY)

            def _run() -> str:
                resp = client.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.3,
                    ),
                )
                return (resp.text or "").strip()

            return await asyncio.to_thread(_run)
        except Exception as exc:
            logger.error("Gemini evaluation error: %s", exc)
            return None

    @staticmethod
    def _fallback_next_question(
        topic: str, language: str, history: List[Dict[str, str]]
    ) -> str:
        bank = TOPIC_QUESTIONS_VI if language == "vi" else TOPIC_QUESTIONS_EN
        questions = bank.get(topic) or bank["Thuyết trình tự do"]
        ai_turns = sum(1 for h in history if h.get("speaker") == "ai")
        idx = min(ai_turns, len(questions) - 1)
        return questions[idx]

    @staticmethod
    def _heuristic_evaluation(
        topic: str,
        language: str,
        transcripts: List[Dict],
        cv_summary: Dict[str, float],
        speech_summary: Dict[str, float],
    ) -> EvaluationReport:
        """Metric-driven evaluation when LLM API keys are not set."""
        user_turns = [t for t in transcripts if t.get("speaker") == "user"]
        total_words = sum(int(t.get("word_count", 0)) for t in user_turns)
        avg_wpm = float(speech_summary.get("avg_wpm", 0.0))
        total_fillers = int(speech_summary.get("total_filler_words", 0))

        # Collect actual filler words used in this session
        detected_fillers: List[str] = []
        for turn in user_turns:
            for fw in turn.get("filler_words") or []:
                if fw not in detected_fillers:
                    detected_fillers.append(str(fw))

        camera_used = bool(cv_summary.get("camera_used", cv_summary.get("face_detected_frames", 0) > 0))
        eye_rate = float(cv_summary.get("avg_eye_contact_rate", 0.0)) if camera_used else 0.0
        head_stability = float(cv_summary.get("avg_head_stability", 0.0)) if camera_used else 0.0
        confidence = float(cv_summary.get("avg_confidence", 0.0)) if camera_used else 0.0

        # 1. Eye Contact Score (honest 0 if camera was not used)
        eye_score = round(min(100.0, max(0.0, eye_rate)), 1) if camera_used else 0.0

        # 2. Posture & Expression Score (honest 0 if camera was not used)
        posture_score = (
            round(min(100.0, max(0.0, 0.55 * head_stability + 0.45 * confidence)), 1)
            if camera_used
            else 0.0
        )

        # 3. Tone & Pace Score (benchmark 120-150 WPM, penalize filler ratio)
        if total_words == 0 or avg_wpm <= 0:
            tone_pace_score = 0.0
        else:
            if 120.0 <= avg_wpm <= 150.0:
                pace_score = 92.0
            else:
                dist = min(abs(avg_wpm - 120.0), abs(avg_wpm - 150.0))
                pace_score = max(40.0, 90.0 - dist * 0.7)
            filler_ratio = (total_fillers / max(total_words, 1)) * 100.0
            tone_pace_score = round(max(25.0, min(100.0, pace_score - filler_ratio * 2.5)), 1)

        # 4. Content Score (depth & completeness heuristic based on actual turns/words)
        if total_words == 0:
            content_score = 0.0
        elif total_words < 25:
            content_score = 52.0
        elif total_words < 60:
            content_score = 68.0
        elif total_words < 140:
            content_score = 80.0
        else:
            content_score = 88.0

        # Overall score weighted over actually measured dimensions
        if camera_used and total_words > 0:
            overall = round(
                0.35 * content_score
                + 0.25 * tone_pace_score
                + 0.20 * posture_score
                + 0.20 * eye_score,
                1,
            )
        elif total_words > 0:
            overall = round(0.58 * content_score + 0.42 * tone_pace_score, 1)
        elif camera_used:
            overall = round(0.50 * posture_score + 0.50 * eye_score, 1)
        else:
            overall = 0.0

        topic_star_vi = {
            "IT Backend": "Trong dự án gần nhất, em chịu trách nhiệm tối ưu API và truy vấn cơ sở dữ liệu (Action), giúp giảm 35% thời gian phản hồi dưới tải thực tế (Result).",
            "IT Frontend": "Trong dự án web gần đây, em tái cấu trúc state và tối ưu render danh sách lớn (Action), giúp cải thiện điểm hiệu năng tải trang lên trên 90 (Result).",
            "Kinh tế": "Trong dự án phân tích thị trường, em xây dựng bộ chỉ số theo dõi chuyển đổi theo từng phân khúc (Action), giúp đội ngũ đề xuất phương án tăng hiệu quả chiến dịch thêm 18% (Result).",
        }
        topic_star_en = {
            "IT Backend": "In my recent project, I redesigned the core API and database indexing (Action), cutting p95 latency by 35% under production load (Result).",
            "IT Frontend": "In my recent web app, I refactored state updates and virtualized large lists (Action), lifting Core Web Vitals performance above 90 (Result).",
            "Kinh tế": "In my market analysis project, I segmented conversion funnels with clear KPIs (Action), helping the team improve campaign efficiency by 18% (Result).",
        }

        sample_improvements: List[SampleImprovement] = []
        if user_turns:
            shortest_or_first = user_turns[0]["text"][:160]
            if language == "en":
                sample_improvements.append(
                    SampleImprovement(
                        original_excerpt=shortest_or_first,
                        improved_suggestion=topic_star_en.get(
                            topic,
                            "Clearly state the context (Situation), your specific responsibility (Task), concrete steps taken (Action), and a measurable outcome (Result).",
                        ),
                        reason="Applies the STAR structure with concrete ownership and measurable impact.",
                    )
                )
            else:
                sample_improvements.append(
                    SampleImprovement(
                        original_excerpt=shortest_or_first,
                        improved_suggestion=topic_star_vi.get(
                            topic,
                            "Trình bày rõ bối cảnh (Situation), vai trò trực tiếp của bạn (Task), các bước hành động cụ thể (Action) và kết quả có số liệu minh chứng (Result).",
                        ),
                        reason="Áp dụng cấu trúc STAR kèm vai trò cụ thể và số liệu giúp câu trả lời thuyết phục hơn.",
                    )
                )

        if language == "en":
            strengths: List[str] = []
            weaknesses: List[str] = []
            actions: List[str] = []

            if camera_used:
                if head_stability >= 70:
                    strengths.append(f"Maintained steady head posture ({head_stability:.0f}% stability).")
                else:
                    weaknesses.append(f"Head posture stability was low ({head_stability:.0f}%); try sitting centered and steady.")
                if eye_rate >= 70:
                    strengths.append(f"Strong camera eye contact ({eye_rate:.0f}%).")
                else:
                    weaknesses.append(f"Eye contact rate was {eye_rate:.0f}% (target >= 70%).")
            else:
                weaknesses.append("Camera was disabled or no face was detected, so eye contact and posture could not be scored.")
                actions.append("Enable your webcam in a well-lit area to receive real-time Eye Contact and Head Pose feedback.")

            if total_words > 0:
                if 120 <= avg_wpm <= 150:
                    strengths.append(f"Speaking pace ({avg_wpm:.0f} WPM) is right inside the ideal 120–150 WPM range.")
                elif avg_wpm > 150:
                    weaknesses.append(f"Speaking pace was fast ({avg_wpm:.0f} WPM); slow down slightly for clarity.")
                else:
                    weaknesses.append(f"Speaking pace was slow ({avg_wpm:.0f} WPM); practice smoother phrasing.")

                if total_fillers == 0:
                    strengths.append("Zero filler words detected across your responses.")
                else:
                    filler_preview = ", ".join(f"'{w}'" for w in detected_fillers[:3])
                    weaknesses.append(f"Detected {total_fillers} filler word(s) ({filler_preview}).")
                    actions.append("Pause silently for 1 second instead of using filler words when thinking.")
            else:
                weaknesses.append("No spoken or typed answers were recorded during this session.")

            if not strengths:
                strengths.append("Completed the practice session setup and flow.")
            actions.append("Structure experience answers with STAR (Situation, Task, Action, Result) and concrete numbers.")

            cam_summary = (
                f"eye contact reached {eye_rate:.0f}%."
                if camera_used
                else "camera was off so visual metrics were not measured."
            )
            return EvaluationReport(
                overall_score=overall,
                scores=CriteriaScores(
                    content=content_score,
                    tone_pace=tone_pace_score,
                    posture_expression=posture_score,
                    eye_contact=eye_score,
                ),
                summary=(
                    f"You completed the {topic} session with an overall score of {overall}/100. "
                    f"Recorded {len(user_turns)} answer(s) ({total_words} words, {avg_wpm:.0f} WPM, {total_fillers} filler words); "
                    f"{cam_summary}"
                ),
                strengths=strengths,
                weaknesses=weaknesses,
                actionable_feedback=actions,
                sample_improvements=sample_improvements,
            )

        # Vietnamese feedback
        strengths_vi: List[str] = []
        weaknesses_vi: List[str] = []
        actions_vi: List[str] = []

        if camera_used:
            if head_stability >= 70:
                strengths_vi.append(
                    f"Tư thế đầu ổn định ({head_stability:.0f}%), tạo tác phong chuyên nghiệp trước ống kính."
                )
            else:
                weaknesses_vi.append(
                    f"Độ ổn định tư thế đầu mới đạt {head_stability:.0f}% — nên giữ khung hình ổn định và hướng thẳng camera."
                )
            if eye_rate >= 70:
                strengths_vi.append(
                    f"Tỷ lệ giao tiếp mắt đạt {eye_rate:.0f}% (vượt ngưỡng chuẩn 70%)."
                )
            else:
                weaknesses_vi.append(
                    f"Tỷ lệ giao tiếp mắt đạt {eye_rate:.0f}%, thấp hơn ngưỡng khuyến nghị 70%."
                )
                actions_vi.append("Giữ ánh mắt hướng vào ống kính camera khi nhấn mạnh các luận điểm quan trọng.")
        else:
            weaknesses_vi.append("Camera chưa bật hoặc chưa nhận diện được khuôn mặt nên chưa thể chấm điểm ánh mắt và tác phong.")
            actions_vi.append("Bật webcam ở nơi đủ sáng để hệ thống phân tích Eye Contact và tư thế đầu chính xác.")

        if total_words > 0:
            if 120 <= avg_wpm <= 150:
                strengths_vi.append(f"Tốc độ nói trung bình {avg_wpm:.0f} WPM nằm trong ngưỡng lý tưởng (120–150 WPM).")
            elif avg_wpm > 150:
                weaknesses_vi.append(f"Tốc độ nói hơi nhanh ({avg_wpm:.0f} WPM), cần nhấn nhá và ngắt nhịp rõ hơn.")
                actions_vi.append("Chậm lại nhẹ về ngưỡng 120–150 WPM và nghỉ ngắn giữa các ý chính.")
            else:
                weaknesses_vi.append(f"Tốc độ nói hơi chậm ({avg_wpm:.0f} WPM), có thể luyện trình bày trôi chảy hơn.")
                actions_vi.append("Luyện tập dàn ý trước khi nói để duy trì nhịp nói ổn định 120–150 WPM.")

            if total_fillers == 0:
                strengths_vi.append("Không phát hiện từ đệm trong toàn bộ câu trả lời — diễn đạt rất gọn gàng.")
            else:
                filler_preview = ", ".join(f"'{w}'" for w in detected_fillers[:3])
                weaknesses_vi.append(f"Phát hiện {total_fillers} từ đệm ({filler_preview}) làm giảm độ tự tin khi trình bày.")
                actions_vi.append("Tập ngắt nghỉ im lặng 1 giây khi suy nghĩ thay vì chèn các từ đệm.")

            if total_words >= 60:
                strengths_vi.append(f"Nội dung trả lời có độ sâu ({total_words} từ qua {len(user_turns)} lượt trả lời).")
            else:
                weaknesses_vi.append("Câu trả lời còn khá ngắn, nên mở rộng thêm bối cảnh và ví dụ thực tế.")
        else:
            weaknesses_vi.append("Chưa ghi nhận câu trả lời nào trong phiên này.")

        if not strengths_vi:
            strengths_vi.append("Đã hoàn tất thiết lập và quy trình phiên luyện tập.")
        actions_vi.append("Áp dụng cấu trúc STAR (Tình huống - Nhiệm vụ - Hành động - Kết quả) kèm số liệu định lượng.")

        cam_summary_vi = (
            f"tỷ lệ giao tiếp mắt đạt {eye_rate:.0f}%."
            if camera_used
            else "camera không hoạt động nên chỉ số hình ảnh chưa được ghi nhận."
        )
        return EvaluationReport(
            overall_score=overall,
            scores=CriteriaScores(
                content=content_score,
                tone_pace=tone_pace_score,
                posture_expression=posture_score,
                eye_contact=eye_score,
            ),
            summary=(
                f"Bạn đã hoàn thành phiên luyện tập chủ đề {topic} với tổng điểm {overall}/100. "
                f"Hệ thống ghi nhận {len(user_turns)} lượt trả lời ({total_words} từ, {avg_wpm:.0f} WPM, {total_fillers} từ đệm); "
                f"{cam_summary_vi}"
            ),
            strengths=strengths_vi,
            weaknesses=weaknesses_vi,
            actionable_feedback=actions_vi,
            sample_improvements=sample_improvements,
        )


llm_agent = LLMAgent()
