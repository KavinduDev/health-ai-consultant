from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import chat, voice

app = FastAPI(
    title="Health AI Consultant",
    description="AI-powered symptom triage system",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://your-vercel-app.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(voice.router, prefix="/api/voice", tags=["voice"])

@app.get("/health")
def health_check():
    return {"status": "ok"}