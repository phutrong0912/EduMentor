from app.services.stt_engine import (
    analyze_speech_text,
    compute_wpm,
    detect_filler_words,
    summarize_filler_breakdown,
)


def test_detect_vietnamese_and_english_fillers():
    text = "À, cơ bản là em làm backend, ừm kiểu như dùng FastAPI, you know, um khá nhanh."
    fillers = detect_filler_words(text)
    assert "à" in fillers
    assert "cơ bản là" in fillers
    assert "ừm" in fillers
    assert "kiểu như" in fillers
    assert "you know" in fillers
    assert "um" in fillers


def test_compute_wpm_classification():
    wpm_normal, status_normal = compute_wpm(135, 60.0)
    assert wpm_normal == 135.0
    assert status_normal == "normal"

    _, status_slow = compute_wpm(80, 60.0)
    assert status_slow == "slow"

    _, status_fast = compute_wpm(190, 60.0)
    assert status_fast == "fast"


def test_analyze_speech_text_and_breakdown():
    res = analyze_speech_text("À thì em thiết kế hệ thống microservices cho dự án tốt nghiệp.", 10.0)
    assert res.word_count == 12
    assert res.filler_count >= 2
    breakdown = summarize_filler_breakdown([res.filler_words])
    assert sum(breakdown.values()) == res.filler_count
