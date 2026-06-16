# backend/routers/chat.py

from fastapi import APIRouter, HTTPException
from models.schemas import ChatRequest, ChatResponse
from services import session_service, gemini_service
from prompts.triage_prompt import get_followup_prompt, get_final_prompt

router = APIRouter()

@router.post("/start")
def start_chat():
    session_id = session_service.create_session()
    return {"session_id": session_id}

@router.post("/message", response_model=ChatResponse)
def send_message(request: ChatRequest):
    session = session_service.get_session(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired")

    if session["is_complete"]:
        raise HTTPException(status_code=400, detail="This conversation has already ended")

    session_service.add_message(request.session_id, "user", request.message)
    current_round = session["round"]

    history = [m["content"] for m in session["history"] if m["role"] == "user"]

    if current_round == 1:
        prompt = get_followup_prompt(1, symptoms=history[0])
    elif current_round == 2:
        prompt = get_followup_prompt(2, round_1=history[0], round_2=history[1])
    else:
        prompt = get_final_prompt(
            round_1=history[0],
            round_2=history[1],
            round_3=history[2]
        )

    bot_message = gemini_service.generate_response(prompt)

    is_emergency = bot_message.strip().startswith("EMERGENCY")
    is_final = is_emergency or current_round >= 3

    if is_emergency or is_final:
        session["is_complete"] = True

    return ChatResponse(
        session_id=request.session_id,
        round=current_round,
        message=bot_message,
        is_final=is_final,
        is_emergency=is_emergency
    )