# backend/services/gemini_service.py

import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

# ============================================================
# TEMPORARY TESTING TOGGLE — set to False before real testing
# Used to avoid burning Gemini's daily free quota during
# frontend/UI work that doesn't need real AI responses.
# ============================================================
USE_DUMMY_RESPONSES = False

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not USE_DUMMY_RESPONSES:
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY not found in environment variables")
    client = genai.Client(api_key=GEMINI_API_KEY)


def generate_response(prompt: str) -> str:
    if USE_DUMMY_RESPONSES:
        return _generate_dummy_response(prompt)

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        return response.text.strip()
    except Exception as e:
        raise RuntimeError(f"Gemini API call failed: {str(e)}")


def _generate_dummy_response(prompt: str) -> str:
    if "Provide the triage direction now" in prompt:
        return (
            "Possible concern area: General head and neurological symptoms.\n"
            "Recommended specialist: General Practitioner (GP)\n"
            "What to tell the doctor:\n"
            "- Headache present for several hours\n"
            "- Mild associated symptoms reported\n"
            "- No emergency warning signs identified\n"
            "Disclaimer: This is not medical advice. Please consult a "
            "qualified doctor for proper diagnosis and treatment."
        )
    return "Can you tell me more about when this started and how severe it feels?"