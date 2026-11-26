from fastapi.testclient import TestClient

from app.main import app


def test_health_and_full_session_lifecycle():
    with TestClient(app) as client:
        # 1. Health check
        res = client.get("/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"

        # 2. Create session
        create_res = client.post(
            "/api/sessions",
            json={"topic": "IT Backend", "mode": "interview", "language": "vi"},
        )
        assert create_res.status_code == 201
        session_id = create_res.json()["id"]

        # 3. Connect WebSocket & simulate a turn
        with client.websocket_connect(f"/ws/interview/{session_id}") as ws:
            # Opening status + question
            msg1 = ws.receive_json()
            assert msg1["type"] == "ai_status"
            msg2 = ws.receive_json()
            assert msg2["type"] == "ai_response"
            assert len(msg2["text"]) > 10
            msg3 = ws.receive_json()
            assert msg3["type"] == "ai_status"
            assert msg3["status"] == "listening"

            # Send a user transcript turn
            ws.send_json(
                {
                    "type": "user_transcript",
                    "text": "À em là sinh viên năm cuối, ừm em từng xây dựng hệ thống FastAPI và PostgreSQL phục vụ 2000 người dùng.",
                    "duration_sec": 9.5,
                    "timestamp_sec": 12.0,
                }
            )
            analyzed = ws.receive_json()
            assert analyzed["type"] == "user_transcript_analyzed"
            assert analyzed["data"]["filler_count"] >= 2
            assert analyzed["data"]["wpm"] > 0

            # Receive AI thinking -> speaking -> response -> listening
            types_seen = []
            for _ in range(4):
                m = ws.receive_json()
                types_seen.append(m["type"])
            assert "ai_response" in types_seen

            # End session via WS
            ws.send_json({"type": "end_session"})
            status_eval = ws.receive_json()
            assert status_eval["type"] == "ai_status"
            completed = ws.receive_json()
            assert completed["type"] == "session_completed"
            assert completed["session_id"] == session_id

        # 4. Fetch Analytics Dashboard Report
        report_res = client.get(f"/api/reports/{session_id}")
        assert report_res.status_code == 200
        report = report_res.json()
        assert report["evaluation"] is not None
        assert 0 <= report["evaluation"]["overall_score"] <= 100
        assert len(report["transcripts"]) >= 3
        assert report["session"]["total_filler_words"] >= 2
