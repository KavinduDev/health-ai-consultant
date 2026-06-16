const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface ChatResponse {
  session_id: string;
  round: number;
  message: string;
  is_final: boolean;
  is_emergency: boolean;
}

export interface VoiceTranscriptResponse {
  transcript: string;
  session_id: string;
}

export async function startChat(): Promise<{ session_id: string }> {
  const response = await fetch(`${API_URL}/api/chat/start`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to start chat session");
  }

  return response.json();
}

export async function sendMessage(
  sessionId: string,
  message: string,
  inputType: "text" | "voice" = "text"
): Promise<ChatResponse> {
  const response = await fetch(`${API_URL}/api/chat/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session_id: sessionId,
      message: message,
      input_type: inputType,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to send message");
  }

  return response.json();
}

export async function transcribeVoice(
  sessionId: string,
  audioBlob: Blob
): Promise<VoiceTranscriptResponse> {
  const formData = new FormData();
  formData.append("audio", audioBlob, "recording.webm");

  const response = await fetch(
    `${API_URL}/api/voice/transcribe?session_id=${sessionId}`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to transcribe audio");
  }

  return response.json();
}