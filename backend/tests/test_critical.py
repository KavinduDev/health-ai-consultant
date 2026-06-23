# backend/tests/test_critical.py

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch
from main import app

client = TestClient(app)

# ============================================================
# HELPER: dummy Gemini responses for testing without quota
# ============================================================

DUMMY_FOLLOWUP = "Can you tell me more about when this started?"

DUMMY_FINAL = (
    "Possible concern area: General head and neurological symptoms.\n"
    "Recommended specialist: General Practitioner (GP)\n"
    "What to tell the doctor:\n"
    "- Headache present for several hours\n"
    "- Mild associated symptoms reported\n"
    "Disclaimer: This is not medical advice. Please consult a qualified doctor."
)

DUMMY_EMERGENCY = "EMERGENCY: Please call emergency services immediately. Do not wait."


# ============================================================
# SESSION TESTS
# ============================================================

def test_start_chat_creates_session():
    """Starting a chat returns a valid session ID."""
    response = client.post("/api/chat/start")
    assert response.status_code == 200
    data = response.json()
    assert "session_id" in data
    assert len(data["session_id"]) > 0


def test_message_requires_valid_session():
    """Sending a message with a fake session ID returns 404."""
    response = client.post("/api/chat/message", json={
        "session_id": "00000000-0000-0000-0000-000000000000",
        "message": "I have a headache",
        "input_type": "text"
    })
    assert response.status_code == 404


# ============================================================
# NORMAL CONVERSATION FLOW TESTS
# ============================================================

def test_normal_three_round_flow():
    """A safe symptom goes through three rounds and returns is_final=True."""
    with patch("services.gemini_service.generate_response") as mock_gemini:
        mock_gemini.side_effect = [DUMMY_FOLLOWUP, DUMMY_FOLLOWUP, DUMMY_FINAL]

        start = client.post("/api/chat/start")
        session_id = start.json()["session_id"]

        r1 = client.post("/api/chat/message", json={
            "session_id": session_id,
            "message": "I have a mild headache",
            "input_type": "text"
        })
        assert r1.status_code == 200
        assert r1.json()["is_final"] == False
        assert r1.json()["is_emergency"] == False
        assert r1.json()["round"] == 1

        r2 = client.post("/api/chat/message", json={
            "session_id": session_id,
            "message": "It started about 2 hours ago",
            "input_type": "text"
        })
        assert r2.status_code == 200
        assert r2.json()["is_final"] == False
        assert r2.json()["round"] == 2

        r3 = client.post("/api/chat/message", json={
            "session_id": session_id,
            "message": "No other symptoms",
            "input_type": "text"
        })
        assert r3.status_code == 200
        assert r3.json()["is_final"] == True
        assert r3.json()["is_emergency"] == False


# ============================================================
# EMERGENCY DETECTION TESTS (most critical)
# ============================================================

def test_emergency_detected_on_round_1():
    """
    Critical safety test: emergency symptoms should trigger
    is_emergency=True immediately on round 1, not wait until round 3.
    This was a real bug we found and fixed during development.
    """
    with patch("services.gemini_service.generate_response") as mock_gemini:
        mock_gemini.return_value = DUMMY_EMERGENCY

        start = client.post("/api/chat/start")
        session_id = start.json()["session_id"]

        response = client.post("/api/chat/message", json={
            "session_id": session_id,
            "message": "I have crushing chest pain and my left arm is numb",
            "input_type": "text"
        })

        assert response.status_code == 200
        assert response.json()["is_emergency"] == True
        assert response.json()["is_final"] == True


def test_emergency_ends_session():
    """After an emergency is detected, further messages should be rejected."""
    with patch("services.gemini_service.generate_response") as mock_gemini:
        mock_gemini.return_value = DUMMY_EMERGENCY

        start = client.post("/api/chat/start")
        session_id = start.json()["session_id"]

        client.post("/api/chat/message", json={
            "session_id": session_id,
            "message": "I have crushing chest pain",
            "input_type": "text"
        })

        followup = client.post("/api/chat/message", json={
            "session_id": session_id,
            "message": "Actually I feel better now",
            "input_type": "text"
        })

        assert followup.status_code == 400


def test_non_emergency_does_not_trigger_emergency_flag():
    """Safe symptoms should never set is_emergency=True."""
    with patch("services.gemini_service.generate_response") as mock_gemini:
        mock_gemini.side_effect = [DUMMY_FOLLOWUP, DUMMY_FOLLOWUP, DUMMY_FINAL]

        start = client.post("/api/chat/start")
        session_id = start.json()["session_id"]

        for msg in ["mild headache", "2 hours", "no other symptoms"]:
            r = client.post("/api/chat/message", json={
                "session_id": session_id,
                "message": msg,
                "input_type": "text"
            })

        assert r.json()["is_emergency"] == False


# ============================================================
# HEALTH CHECK
# ============================================================

def test_health_check():
    """Backend health endpoint returns ok."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"