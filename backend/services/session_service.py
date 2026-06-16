import uuid
from datetime import datetime, timedelta
from models.schemas import SessionSummary

sessions: dict = {}

SESSION_TIMEOUT_MINUTES = 30
MAX_ROUNDS = 3

def create_session() -> str:
    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        "round": 0,
        "history": [],
        "created_at": datetime.utcnow(),
        "is_complete": False
    }
    return session_id

def get_session(session_id: str) -> dict | None:
    session = sessions.get(session_id)
    if not session:
        return None
    if datetime.utcnow() - session["created_at"] > timedelta(minutes=SESSION_TIMEOUT_MINUTES):
        delete_session(session_id)
        return None
    return session

def add_message(session_id: str, role: str, content: str) -> bool:
    session = get_session(session_id)
    if not session:
        return False
    session["history"].append({
        "role": role,
        "content": content,
        "timestamp": datetime.utcnow().isoformat()
    })
    session["round"] += 1
    if session["round"] >= MAX_ROUNDS:
        session["is_complete"] = True
    return True

def delete_session(session_id: str) -> None:
    sessions.pop(session_id, None)

def get_session_summary(session_id: str) -> SessionSummary | None:
    session = get_session(session_id)
    if not session:
        return None
    return SessionSummary(
        session_id=session_id,
        round=session["round"],
        is_complete=session["is_complete"],
        history=[m["content"] for m in session["history"]]
    )