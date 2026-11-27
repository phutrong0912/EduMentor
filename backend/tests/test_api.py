from fastapi.testclient import TestClient

from app.main import app


def test_health_and_full_session_lifecycle():
    import uuid

    with TestClient(app) as client:
        # 1. Health check (public)
        res = client.get("/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"

        # Unauthenticated session access must be rejected with 401
        assert client.get("/api/sessions").status_code == 401
        assert (
            client.post(
                "/api/sessions",
                json={"topic": "IT Backend", "mode": "interview", "language": "vi"},
            ).status_code
            == 401
        )

        # Register & authenticate user
        email = f"lifecycle_{uuid.uuid4().hex[:8]}@example.com"
        reg = client.post(
            "/api/auth/register",
            json={"email": email, "full_name": "Test User", "password": "password123"},
        )
        assert reg.status_code == 201
        token = reg.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Create session (authenticated)
        create_res = client.post(
            "/api/sessions",
            json={"topic": "IT Backend", "mode": "interview", "language": "vi"},
            headers=headers,
        )
        assert create_res.status_code == 201
        session_id = create_res.json()["id"]

        # Unauthenticated WebSocket connection must be rejected
        with client.websocket_connect(f"/ws/interview/{session_id}") as ws_anon:
            err = ws_anon.receive_json()
            assert err["type"] == "error"

        # 3. Connect WebSocket & simulate a turn
        with client.websocket_connect(
            f"/ws/interview/{session_id}?token={token}"
        ) as ws:
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
        report_res = client.get(f"/api/reports/{session_id}", headers=headers)
        assert report_res.status_code == 200
        report = report_res.json()
        assert report["evaluation"] is not None
        assert 0 <= report["evaluation"]["overall_score"] <= 100
        assert len(report["transcripts"]) >= 3
        assert report["session"]["total_filler_words"] >= 2
        # No camera frames were sent -> eye contact & posture must NOT be fabricated
        assert report["session"]["avg_eye_contact_rate"] == 0.0
        assert report["evaluation"]["scores"]["eye_contact"] == 0.0
        assert report["evaluation"]["scores"]["posture_expression"] == 0.0


def test_auth_ownership_and_ws_reconnect():
    import uuid

    email_a = f"user_a_{uuid.uuid4().hex[:8]}@example.com"
    email_b = f"user_b_{uuid.uuid4().hex[:8]}@example.com"

    with TestClient(app) as client:
        # Register User A & User B
        reg_a = client.post(
            "/api/auth/register",
            json={"email": email_a, "full_name": "User A", "password": "password123"},
        )
        assert reg_a.status_code == 201
        token_a = reg_a.json()["access_token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}

        reg_b = client.post(
            "/api/auth/register",
            json={"email": email_b, "full_name": "User B", "password": "password123"},
        )
        assert reg_b.status_code == 201
        token_b = reg_b.json()["access_token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # /api/auth/me works for valid token, 401 for invalid token
        me_res = client.get("/api/auth/me", headers=headers_a)
        assert me_res.status_code == 200
        assert me_res.json()["email"] == email_a

        bad_me = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid-token"})
        assert bad_me.status_code == 401

        # User A creates a private session (spoofed user_id in body must be ignored)
        sess_res = client.post(
            "/api/sessions",
            json={
                "topic": "IT Frontend",
                "mode": "interview",
                "language": "vi",
                "user_id": "spoofed-id",
            },
            headers=headers_a,
        )
        assert sess_res.status_code == 201
        session_id = sess_res.json()["id"]

        # List isolation: User A sees it; User B does NOT; guest gets 401
        list_a = [s["id"] for s in client.get("/api/sessions", headers=headers_a).json()]
        list_b = [s["id"] for s in client.get("/api/sessions", headers=headers_b).json()]
        assert client.get("/api/sessions").status_code == 401
        assert session_id in list_a
        assert session_id not in list_b

        # Direct access isolation: User B gets 403, guest gets 401
        assert client.get(f"/api/sessions/{session_id}", headers=headers_b).status_code == 403
        assert client.get(f"/api/sessions/{session_id}").status_code == 401
        assert client.get(f"/api/reports/{session_id}", headers=headers_b).status_code == 403
        assert client.delete(f"/api/sessions/{session_id}", headers=headers_b).status_code == 403

        # WebSocket rejects unauthorized user B with 4003 error message
        with client.websocket_connect(f"/ws/interview/{session_id}?token={token_b}") as ws_b:
            err_msg = ws_b.receive_json()
            assert err_msg["type"] == "error"

        # WebSocket allows owner A, then reconnect returns session_sync
        with client.websocket_connect(f"/ws/interview/{session_id}?token={token_a}") as ws_a:
            assert ws_a.receive_json()["type"] == "ai_status"
            assert ws_a.receive_json()["type"] == "ai_response"
            assert ws_a.receive_json()["type"] == "ai_status"

        with client.websocket_connect(f"/ws/interview/{session_id}?token={token_a}") as ws_a2:
            sync_msg = ws_a2.receive_json()
            assert sync_msg["type"] == "session_sync"
            assert len(sync_msg["transcripts"]) == 1
            assert sync_msg["current_question"]

        # Owner A can delete their own session
        assert client.delete(f"/api/sessions/{session_id}", headers=headers_a).status_code == 204
