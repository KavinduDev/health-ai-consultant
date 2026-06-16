// frontend/src/app/chat/page.tsx

"use client";

import { useState, useEffect } from "react";
import { startChat, sendMessage, ChatResponse } from "@/lib/api";

type ConversationState = "idle" | "loading" | "active" | "done";

export default function ChatPage() {
    const [state, setState] = useState<ConversationState>("loading");
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [currentQuestion, setCurrentQuestion] = useState<string>("");
    const [round, setRound] = useState<number>(0);
    const [userInput, setUserInput] = useState<string>("");
    const [result, setResult] = useState<ChatResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

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

                <textarea
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="Type your answer"
                    className="w-full min-h-[70px] border border-slate-300 rounded-md p-3 text-sm bg-slate-50 text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
                />

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