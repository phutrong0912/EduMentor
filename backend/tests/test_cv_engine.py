import base64
import cv2
import numpy as np

from app.services.cv_engine import cv_engine


def test_corrupted_frame_returns_safe_metrics():
    metrics = cv_engine.analyze_frame("not-valid-base64!!!", timestamp_sec=1.5)
    assert metrics.face_detected is False
    assert metrics.alert is not None


def test_dark_frame_returns_lighting_alert():
    black_img = np.zeros((240, 320, 3), dtype=np.uint8)
    ok, buf = cv2.imencode(".jpg", black_img)
    assert ok
    b64 = base64.b64encode(buf.tobytes()).decode("ascii")
    metrics = cv_engine.analyze_frame(b64, timestamp_sec=2.0)
    assert metrics.face_detected is False
    assert "tối" in (metrics.alert or "").lower()


def test_blank_bright_frame_no_face():
    bright_img = np.full((240, 320, 3), 200, dtype=np.uint8)
    ok, buf = cv2.imencode(".jpg", bright_img)
    assert ok
    b64 = base64.b64encode(buf.tobytes()).decode("ascii")
    metrics = cv_engine.analyze_frame(b64, timestamp_sec=3.0)
    assert metrics.face_detected is False
    assert metrics.eye_contact is False
