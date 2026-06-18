# backend/services/kokoro_service.py

import io
import numpy as np
from kokoro import KPipeline
import soundfile as sf

pipeline = KPipeline(lang_code='a')

def generate_speech(text: str) -> bytes:
    generator = pipeline(text, voice='af_heart', speed=0.85)

    audio_segments = []
    for _, _, audio in generator:
        audio_segments.append(audio)

    full_audio = np.concatenate(audio_segments)

    audio_buffer = io.BytesIO()
    sf.write(audio_buffer, full_audio, 24000, format='WAV')
    audio_buffer.seek(0)

    return audio_buffer.read()