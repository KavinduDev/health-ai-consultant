// frontend/src/app/chat/page.tsx

"use client";

import { useState, useEffect, useRef } from "react";
import { startChat, sendMessage, ChatResponse, transcribeVoice } from "@/lib/api";

type ConversationState = "idle" | "loading" | "active" | "done";

export default function ChatPage() {
    const [state, setState] = useState<ConversationState>("loading");
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [currentQuestion, setCurrentQuestion] = useState<string>("");
    const [round, setRound] = useState<number>(0);
    const [userInput, setUserInput] = useState<string>("");
    const [result, setResult] = useState<ChatResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    useEffect(() => {
        handleStart();
    }, []);

    async function handleStart() {
        setState("loading");
        setError(null);
        try {
            const data = await startChat();
            setSessionId(data.session_id);
            setCurrentQuestion("What symptoms are you experiencing?");
            setRound(1);
            setState("active");
        } catch (err) {
            setError("Could not start a session. Please try again.");
            setState("idle");
        }
    }

    async function handleSend() {
        if (!sessionId || !userInput.trim()) return;

        setState("loading");
        setError(null);

        try {
            const response = await sendMessage(sessionId, userInput);
            setUserInput("");

            if (response.is_final) {
                setResult(response);
                setState("done");
            } else {
                setCurrentQuestion(response.message);
                setRound(response.round + 1);
                setState("active");
            }
        } catch (err) {
            setError("Something went wrong sending your message. Please try again.");
            setState("active");
        }
    }

    async function startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
                stream.getTracks().forEach((track) => track.stop());
                await handleTranscription(audioBlob);
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            setError("Microphone access was denied or unavailable.");
        }
    }

    function stopRecording() {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
    }

    async function handleTranscription(audioBlob: Blob) {
        if (!sessionId) return;
        setIsTranscribing(true);
        setError(null);

        try {
            const result = await transcribeVoice(sessionId, audioBlob);
            setUserInput(result.transcript);
        } catch (err) {
            setError("Could not transcribe audio. Please try typing instead.");
        } finally {
            setIsTranscribing(false);
        }
    }

    if (state === "done" && result) {
        return (
            <main className="min-h-screen flex items-center justify-center bg-white px-4">
                <div
                    className={`max-w-md w-full rounded-lg p-6 ${result.is_emergency
                        ? "bg-red-50 border border-red-400"
                        : "bg-white border border-slate-200"
                        }`}
                >
                    <p
                        className={`text-sm whitespace-pre-line leading-relaxed ${result.is_emergency ? "text-red-900" : "text-slate-700"
                            }`}
                    >
                        {result.message}
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen flex items-center justify-center bg-white px-4">
            <div className="max-w-md w-full bg-white border border-slate-200 rounded-lg p-6">
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                    Round {round} of 3
                </p>
                <div className="h-1.5 bg-slate-100 rounded-full mb-5 overflow-hidden">
                    <div
                        className="h-full bg-blue-800 transition-all"
                        style={{ width: `${(round / 3) * 100}%` }}
                    />
                </div>

                <p className="text-base text-slate-800 mb-4 leading-relaxed">
                    {currentQuestion}
                </p>

                <div className="flex gap-2 items-stretch">
                    <textarea
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        placeholder={isRecording ? "Listening..." : isTranscribing ? "Transcribing..." : "Type your answer"}
                        className={`flex-1 min-h-[64px] border rounded-md p-3 text-sm resize-none focus:outline-none focus:ring-2 transition-colors ${isRecording
                                ? "bg-red-50 border-red-300 text-red-900 placeholder-red-400 focus:ring-red-200"
                                : "bg-slate-50 border-slate-300 text-slate-800 focus:ring-blue-200"
                            }`}
                    />
                    <button
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={isTranscribing}
                        className={`w-16 rounded-md flex items-center justify-center transition-colors flex-shrink-0 ${isRecording
                                ? "bg-red-600 hover:bg-red-700"
                                : "bg-slate-50 border border-slate-300 hover:bg-slate-100"
                            }`}
                    >
                        {isRecording ? (
                            <div className="w-3 h-3 bg-white rounded-sm" />
                        ) : (
                            <svg
                                className="w-5 h-5 text-blue-800"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m-4 0h8M12 1a3 3 0 00-3 3v7a3 3 0 006 0V4a3 3 0 00-3-3z"
                                />
                            </svg>
                        )}
                    </button>
                </div>

                {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

                <button
                    onClick={handleSend}
                    disabled={state === "loading" || !userInput.trim()}
                    className="w-full mt-4 bg-blue-800 hover:bg-blue-900 disabled:bg-slate-300 text-white text-sm font-medium py-3 rounded-md transition-colors"
                >
                    {state === "loading" ? "Sending..." : "Send"}
                </button>
            </div>
        </main>
    );
}