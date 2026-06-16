from pydantic import BaseModel
from typing import Optional
from enum import Enum

class InputType(str, Enum):
    text = "text"
    voice = "voice"

class ChatRequest(BaseModel):
    session_id: str
    message: str
    input_type: InputType = InputType.text

class ChatResponse(BaseModel):
    session_id: str
    round: int
    message: str
    is_final: bool
    is_emergency: bool = False

class VoiceTranscriptResponse(BaseModel):
    transcript: str
    session_id: str

class SessionSummary(BaseModel):
    session_id: str
    round: int
    is_complete: bool
    history: list[str]