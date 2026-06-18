# backend/routers/voice.py

from fastapi import APIRouter, UploadFile, File, HTTPException, Response
from models.schemas import VoiceTranscriptResponse
from services import whisper_service, kokoro_service
from pydantic import BaseModel

router = APIRouter()

class SpeechRequest(BaseModel):
    text: str

@router.post("/transcribe", response_model=VoiceTranscriptResponse)
async def transcribe_voice(session_id: str, audio: UploadFile = File(...)):
    if not audio.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="File must be an audio file")

    audio_bytes = await audio.read()

    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file received")

    try:
        transcript = whisper_service.transcribe_audio(audio_bytes, audio.filename)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

    return VoiceTranscriptResponse(
        transcript=transcript,
        session_id=session_id
    )

@router.post("/speak")
def speak_text(request: SpeechRequest):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    try:
        audio_bytes = kokoro_service.generate_speech(request.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Speech generation failed: {str(e)}")

    return Response(content=audio_bytes, media_type="audio/wav")