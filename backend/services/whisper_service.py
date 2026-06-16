# backend/services/whisper_service.py

import whisper
import tempfile
import os

model = whisper.load_model("base")

def transcribe_audio(audio_file_bytes: bytes, filename: str) -> str:
    suffix = os.path.splitext(filename)[1] or ".wav"
    
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_file_bytes)
        tmp_path = tmp.name

    try:
        result = model.transcribe(tmp_path)
        return result["text"].strip()
    finally:
        os.remove(tmp_path)