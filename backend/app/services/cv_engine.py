"""
Computer Vision Engine for EduMentor AI.
Uses OpenCV + MediaPipe Face Mesh (with Iris Tracking) to compute:
- Eye Contact Rate & Gaze Score (Iris landmarks 468-477)
- Head Pose Estimation (Pitch, Yaw, Roll via cv2.solvePnP)
- Head Pose Stability & Real-time Posture Alerts
- Facial Expression & Confidence Score
"""

from __future__ import annotations

import base64
import logging
import math
from typing import Optional, Tuple

import cv2
import numpy as np

from app.schemas.schemas import CVFrameMetrics, HeadPose

logger = logging.getLogger(__name__)

try:
    import mediapipe as mp

    _HAS_MEDIAPIPE = hasattr(mp, "solutions") and hasattr(mp.solutions, "face_mesh")
except Exception:
    mp = None  # type: ignore
    _HAS_MEDIAPIPE = False


# 3D reference model points (in mm) for solvePnP head pose estimation
MODEL_POINTS_3D = np.array(
    [
        (0.0, 0.0, 0.0),          # Nose tip (landmark 1)
        (0.0, -63.6, -12.5),      # Chin (landmark 152)
        (-43.3, 32.7, -26.0),     # Left eye left corner (landmark 33)
        (43.3, 32.7, -26.0),      # Right eye right corner (landmark 263)
        (-28.9, -28.9, -24.1),    # Left mouth corner (landmark 61)
        (28.9, -28.9, -24.1),     # Right mouth corner (landmark 291)
    ],
    dtype=np.float64,
)

POSE_LANDMARK_IDS = [1, 152, 33, 263, 61, 291]

# Iris & Eye landmarks (MediaPipe Face Mesh with refine_landmarks=True)
LEFT_IRIS_IDS = [468, 469, 470, 471, 472]
RIGHT_IRIS_IDS = [473, 474, 475, 476, 477]


def _dist(p1: Tuple[float, float], p2: Tuple[float, float]) -> float:
    return math.hypot(p1[0] - p2[0], p1[1] - p2[1])


class ComputerVisionEngine:
    """Stateless-per-frame MediaPipe + OpenCV analyzer for real-time video frames."""

    def __init__(self) -> None:
        self._face_mesh = None
        if _HAS_MEDIAPIPE:
            try:
                self._face_mesh = mp.solutions.face_mesh.FaceMesh(
                    static_image_mode=False,
                    max_num_faces=1,
                    refine_landmarks=True,  # Enables iris landmarks 468-477
                    min_detection_confidence=0.5,
                    min_tracking_confidence=0.5,
                )
            except Exception as exc:
                logger.warning("Failed to initialize MediaPipe FaceMesh: %s", exc)
                self._face_mesh = None

        self._haar_cascade = None
        if self._face_mesh is None:
            try:
                cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
                self._haar_cascade = cv2.CascadeClassifier(cascade_path)
            except Exception:
                self._haar_cascade = None

    @staticmethod
    def decode_frame(frame_data: str | bytes) -> Optional[np.ndarray]:
        """Decode a base64 data URL / raw base64 string / raw JPEG bytes into a BGR image."""
        if not frame_data:
            return None
        try:
            if isinstance(frame_data, str):
                if "," in frame_data:
                    frame_data = frame_data.split(",", 1)[1]
                raw_bytes = base64.b64decode(frame_data)
            else:
                raw_bytes = frame_data

            if not raw_bytes:
                return None

            np_arr = np.frombuffer(raw_bytes, dtype=np.uint8)
            img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            return img
        except Exception as exc:
            logger.debug("Frame decode error: %s", exc)
            return None

    def analyze_frame(
        self, frame_data: str | bytes, timestamp_sec: float = 0.0
    ) -> CVFrameMetrics:
        """Analyze a single webcam frame and return structured CVFrameMetrics."""
        img = self.decode_frame(frame_data)
        if img is None or img.size == 0:
            return CVFrameMetrics(
                timestamp_sec=timestamp_sec,
                face_detected=False,
                alert="Không thể đọc khung hình từ camera.",
            )

        # Edge case: very dark / covered camera
        if float(np.mean(img)) < 8.0:
            return CVFrameMetrics(
                timestamp_sec=timestamp_sec,
                face_detected=False,
                alert="Camera quá tối hoặc đang bị che. Vui lòng kiểm tra ánh sáng.",
            )

        if self._face_mesh is not None:
            return self._analyze_with_mediapipe(img, timestamp_sec)
        return self._analyze_with_opencv_fallback(img, timestamp_sec)

    def _analyze_with_mediapipe(
        self, img: np.ndarray, timestamp_sec: float
    ) -> CVFrameMetrics:
        h, w, _ = img.shape
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        results = self._face_mesh.process(rgb)

        if not results.multi_face_landmarks:
            return CVFrameMetrics(
                timestamp_sec=timestamp_sec,
                face_detected=False,
                eye_contact=False,
                eye_contact_score=0.0,
                head_stability=0.0,
                expression="unknown",
                confidence_score=0.0,
                alert="Không nhận diện được khuôn mặt. Hãy ngồi chính giữa khung hình.",
            )

        landmarks = results.multi_face_landmarks[0].landmark

        # Normalized bounding box for UI overlay
        xs = [lm.x for lm in landmarks]
        ys = [lm.y for lm in landmarks]
        min_x, max_x = max(0.0, min(xs)), min(1.0, max(xs))
        min_y, max_y = max(0.0, min(ys)), min(1.0, max(ys))
        landmarks_box = {
            "x": round(min_x, 4),
            "y": round(min_y, 4),
            "width": round(max_x - min_x, 4),
            "height": round(max_y - min_y, 4),
        }

        # 1. Head Pose Estimation (Pitch, Yaw, Roll via solvePnP)
        pitch, yaw, roll = self._estimate_head_pose(landmarks, w, h)
        head_stability = self._compute_head_stability(pitch, yaw, roll)

        # 2. Eye Contact (Iris tracking 468-477 + head yaw/pitch alignment)
        eye_contact, eye_contact_score = self._estimate_eye_contact(
            landmarks, w, h, pitch, yaw
        )

        # 3. Facial Expression & Confidence
        expression, confidence_score = self._estimate_expression_and_confidence(
            landmarks, w, h, eye_contact_score, head_stability
        )

        # 4. Real-time non-intrusive posture / gaze alert
        alert = self._generate_alert(pitch, yaw, roll, eye_contact)

        return CVFrameMetrics(
            timestamp_sec=round(timestamp_sec, 2),
            face_detected=True,
            eye_contact=eye_contact,
            eye_contact_score=round(eye_contact_score, 1),
            head_pose=HeadPose(
                pitch=round(pitch, 1),
                yaw=round(yaw, 1),
                roll=round(roll, 1),
            ),
            head_stability=round(head_stability, 1),
            expression=expression,
            confidence_score=round(confidence_score, 1),
            alert=alert,
            landmarks_box=landmarks_box,
        )

    def _estimate_head_pose(
        self, landmarks, w: int, h: int
    ) -> Tuple[float, float, float]:
        image_points = np.array(
            [(landmarks[idx].x * w, landmarks[idx].y * h) for idx in POSE_LANDMARK_IDS],
            dtype=np.float64,
        )
        focal_length = float(w)
        center = (w / 2.0, h / 2.0)
        camera_matrix = np.array(
            [
                [focal_length, 0.0, center[0]],
                [0.0, focal_length, center[1]],
                [0.0, 0.0, 1.0],
            ],
            dtype=np.float64,
        )
        dist_coeffs = np.zeros((4, 1), dtype=np.float64)

        success, rotation_vec, _ = cv2.solvePnP(
            MODEL_POINTS_3D,
            image_points,
            camera_matrix,
            dist_coeffs,
            flags=cv2.SOLVEPNP_ITERATIVE,
        )
        if not success:
            return 0.0, 0.0, 0.0

        rmat, _ = cv2.Rodrigues(rotation_vec)
        angles, _, _, _, _, _ = cv2.RQDecomp3x3(rmat)
        # Normalize angles to degrees within [-90, 90]
        pitch = float(np.clip(angles[0], -90.0, 90.0))
        yaw = float(np.clip(angles[1], -90.0, 90.0))
        roll = float(np.clip(angles[2], -90.0, 90.0))
        return pitch, yaw, roll

    @staticmethod
    def _compute_head_stability(pitch: float, yaw: float, roll: float) -> float:
        # Ideal head pose is near (0, 0, 0)
        deviation = abs(pitch) * 1.1 + abs(yaw) * 1.2 + abs(roll) * 0.8
        score = max(0.0, 100.0 - deviation * 1.6)
        return score

    @staticmethod
    def _estimate_eye_contact(
        landmarks, w: int, h: int, pitch: float, yaw: float
    ) -> Tuple[bool, float]:
        # Verify iris landmarks exist (478 total when refine_landmarks=True)
        if len(landmarks) < 478:
            gaze_ok = abs(yaw) <= 18.0 and abs(pitch) <= 18.0
            score = max(0.0, 100.0 - (abs(yaw) + abs(pitch)) * 2.2)
            return gaze_ok, score

        def pt(idx: int) -> Tuple[float, float]:
            return (landmarks[idx].x * w, landmarks[idx].y * h)

        # Left eye corners: 33 (outer), 133 (inner); Iris center: 468
        l_outer, l_inner, l_iris = pt(33), pt(133), pt(468)
        l_width = max(_dist(l_outer, l_inner), 1e-5)
        l_ratio_x = _dist(l_outer, l_iris) / l_width

        # Right eye corners: 362 (inner), 263 (outer); Iris center: 473
        r_inner, r_outer, r_iris = pt(362), pt(263), pt(473)
        r_width = max(_dist(r_inner, r_outer), 1e-5)
        r_ratio_x = _dist(r_inner, r_iris) / r_width

        avg_ratio_x = (l_ratio_x + r_ratio_x) / 2.0
        # Centered iris is around 0.50
        iris_offset = abs(avg_ratio_x - 0.50)

        # Combine iris centering and head orientation
        iris_score = max(0.0, 100.0 - (iris_offset / 0.25) * 100.0)
        pose_penalty = max(0.0, (abs(yaw) - 12.0) * 2.5) + max(0.0, (abs(pitch) - 12.0) * 2.5)
        eye_contact_score = max(0.0, min(100.0, iris_score - pose_penalty))

        eye_contact = eye_contact_score >= 60.0 and abs(yaw) <= 22.0 and abs(pitch) <= 20.0
        return eye_contact, eye_contact_score

    @staticmethod
    def _estimate_expression_and_confidence(
        landmarks, w: int, h: int, eye_contact_score: float, head_stability: float
    ) -> Tuple[str, float]:
        def pt(idx: int) -> Tuple[float, float]:
            return (landmarks[idx].x * w, landmarks[idx].y * h)

        # Inter-ocular distance for scale normalization
        iod = max(_dist(pt(33), pt(263)), 1e-5)

        # Mouth width (61-291) & openness (13-14)
        mouth_width = _dist(pt(61), pt(291)) / iod
        mouth_open = _dist(pt(13), pt(14)) / iod

        # Smile corner elevation vs mouth center
        mouth_center_y = (landmarks[13].y + landmarks[14].y) / 2.0
        corners_y = (landmarks[61].y + landmarks[291].y) / 2.0
        smile_lift = (mouth_center_y - corners_y) * 100.0  # positive when corners lifted

        # Eyebrow distance (inner brows 107 and 336) for furrow/tension detection
        brow_dist = _dist(pt(107), pt(336)) / iod

        if mouth_width > 0.56 or smile_lift > 0.6:
            expression = "confident_smile"
            expr_bonus = 12.0
        elif mouth_open > 0.14:
            expression = "speaking"
            expr_bonus = 6.0
        elif brow_dist < 0.22:
            expression = "tense"
            expr_bonus = -10.0
        else:
            expression = "neutral"
            expr_bonus = 2.0

        confidence = (
            0.45 * eye_contact_score + 0.40 * head_stability + 15.0 + expr_bonus
        )
        confidence = max(0.0, min(100.0, confidence))
        return expression, confidence

    @staticmethod
    def _generate_alert(
        pitch: float, yaw: float, roll: float, eye_contact: bool
    ) -> Optional[str]:
        if pitch < -20.0:
            return "Bạn đang cúi đầu hơi thấp — hãy nâng tầm mắt hướng về camera."
        if pitch > 22.0:
            return "Bạn đang ngẩng đầu hơi cao — điều chỉnh góc nhìn ngang camera."
        if abs(yaw) > 25.0:
            return "Bạn đang quay đầu sang ngang — hãy nhìn thẳng về phía người phỏng vấn."
        if abs(roll) > 20.0:
            return "Đầu bạn đang nghiêng nhiều — giữ tư thế thẳng và tự tin."
        if not eye_contact:
            return "Hãy duy trì giao tiếp mắt trực tiếp với ống kính camera."
        return None

    def _analyze_with_opencv_fallback(
        self, img: np.ndarray, timestamp_sec: float
    ) -> CVFrameMetrics:
        """Graceful fallback using OpenCV Haar Cascade if MediaPipe is unavailable."""
        h, w, _ = img.shape
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = (
            self._haar_cascade.detectMultiScale(gray, 1.2, 5)
            if self._haar_cascade is not None
            else ()
        )
        if len(faces) == 0:
            return CVFrameMetrics(
                timestamp_sec=timestamp_sec,
                face_detected=False,
                alert="Không nhận diện được khuôn mặt. Hãy ngồi chính giữa khung hình.",
            )

        x, y, fw, fh = max(faces, key=lambda f: f[2] * f[3])
        cx = (x + fw / 2.0) / w
        cy = (y + fh / 2.0) / h
        center_offset = math.hypot(cx - 0.5, cy - 0.45)

        eye_contact_score = max(0.0, min(100.0, 100.0 - center_offset * 140.0))
        eye_contact = eye_contact_score >= 60.0
        head_stability = max(0.0, min(100.0, 95.0 - center_offset * 100.0))

        return CVFrameMetrics(
            timestamp_sec=round(timestamp_sec, 2),
            face_detected=True,
            eye_contact=eye_contact,
            eye_contact_score=round(eye_contact_score, 1),
            head_pose=HeadPose(pitch=0.0, yaw=round((cx - 0.5) * 40.0, 1), roll=0.0),
            head_stability=round(head_stability, 1),
            expression="neutral",
            confidence_score=round(0.5 * eye_contact_score + 0.5 * head_stability, 1),
            alert=None if eye_contact else "Hãy ngồi chính giữa và nhìn thẳng vào camera.",
            landmarks_box={
                "x": round(x / w, 4),
                "y": round(y / h, 4),
                "width": round(fw / w, 4),
                "height": round(fh / h, 4),
            },
        )

    def close(self) -> None:
        if self._face_mesh is not None:
            self._face_mesh.close()


# Singleton instance reused across WebSocket connections
cv_engine = ComputerVisionEngine()
