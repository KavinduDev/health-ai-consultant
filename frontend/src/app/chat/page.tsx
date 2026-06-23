// frontend/src/app/chat/page.tsx

"use client";

import { useState, useEffect, useRef } from "react";
import { startChat, sendMessage, transcribeVoice, speakText, ChatResponse } from "@/lib/api";
import Header from "@/components/Header";
import Link from "next/link";

// ============================================================
// TYPES
// ============================================================
type ConversationState = "idle" | "loading" | "active" | "done";
type SpeechStage = "idle" | "analyzing" | "preparing" | "almost_there" | "ready";

const SPEECH_GENERATION_ESTIMATE_MS = 35000;
const ALMOST_THERE_THRESHOLD_MS = 24000;

interface ParsedResult {
  concernArea: string;
  specialist: string;
  talkingPoints: string[];
  disclaimer: string;
}

// ============================================================
// HELPER: parses the raw final-result text from Gemini into
// structured fields (concern area, specialist, bullet points,
// disclaimer). Returns null if the text doesn't match the
// expected format, so the UI can fall back to plain text.
// ============================================================
function parseResultMessage(message: string): ParsedResult | null {
  const concernMatch = message.match(/Possible concern area:\s*(.+)/);
  const specialistMatch = message.match(/Recommended specialist:\s*(.+)/);
  const disclaimerMatch = message.match(/Disclaimer:\s*([\s\S]+)/);

  const bulletLines = message
    .split("\n")
    .filter((line) => line.trim().startsWith("-"))
    .map((line) => line.trim().replace(/^-\s*/, ""));

  if (!concernMatch || !specialistMatch || bulletLines.length === 0) {
    return null;
  }

  return {
    concernArea: concernMatch[1].trim(),
    specialist: specialistMatch[1].trim(),
    talkingPoints: bulletLines,
    disclaimer: disclaimerMatch ? disclaimerMatch[1].trim() : "",
  };
}

export default function ChatPage() {
  // ============================================================
  // STATE
  // ============================================================
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
  const [speechStage, setSpeechStage] = useState<SpeechStage>("idle");
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [showCallConfirm, setShowCallConfirm] = useState(false);

  // ============================================================
  // AUTO-START: begin the session the moment this page loads,
  // no manual "Begin" button needed.
  // ============================================================
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

  // ============================================================
  // CORE CHAT LOOP: sends the user's answer, decides whether
  // to show the next question or the final result.
  // ============================================================
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
        playResponseAudio(response.message);
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

  // ============================================================
  // VOICE OUTPUT: converts the final result text to speech via
  // Kokoro, moving through analyzing -> preparing -> almost_there
  // -> ready stages, used to drive the staged loading screen.
  // ============================================================
  async function playResponseAudio(text: string) {
    setSpeechStage("analyzing");
    await new Promise((resolve) => setTimeout(resolve, 600));

    try {
      setSpeechStage("preparing");
      const almostThereTimer = setTimeout(
        () => setSpeechStage("almost_there"),
        ALMOST_THERE_THRESHOLD_MS
      );

      const audioBlob = await speakText(text);
      clearTimeout(almostThereTimer);

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      setSpeechStage("ready");
      setIsAudioPlaying(true);

      audio.onended = () => {
        setSpeechStage("idle");
        setIsAudioPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      audio.play();
    } catch (err) {
      setSpeechStage("idle");
      setIsAudioPlaying(false);
    }
  }

  // ============================================================
  // VOICE INPUT: browser microphone recording via MediaRecorder,
  // sent to Whisper for transcription once recording stops.
  // ============================================================
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

  // ============================================================
  // RENDER: DONE STATE (round 3 reached, or emergency detected)
  // ============================================================
  if (state === "done" && result) {
    const isPreparingSpeech =
      speechStage === "analyzing" ||
      speechStage === "preparing" ||
      speechStage === "almost_there";

    // --------------------------------------------------------
    // SCREEN 1: Staged loading screen while Kokoro generates
    // audio for the final result (voice-originated only).
    // --------------------------------------------------------
    if (isPreparingSpeech) {
      return (
        <main className="min-h-screen flex items-center justify-center bg-white pl-17 pr-2 md:px-4 pb-48 md:pb-0">
          <div className="bg-white rounded-lg p-8 md:p-20 max-w-2xl w-full text-center">
            {/* Traveling dot animation */}
            <div className="relative w-full max-w-xs md:max-w-4xl h-4 mx-auto mb-10 md:mb-14 overflow-hidden">
              <div className="absolute w-3 h-3 rounded-full bg-blue-800 animate-travel-dot" style={{ animationDelay: "0s" }} />
              <div className="absolute w-3 h-3 rounded-full bg-blue-800 animate-travel-dot" style={{ animationDelay: "0.73s" }} />
              <div className="absolute w-3 h-3 rounded-full bg-blue-800 animate-travel-dot" style={{ animationDelay: "1.46s" }} />
            </div>

            {/* Three-step checklist */}
            <div className="flex flex-col gap-4 md:gap-5 max-w-md mx-auto">
              {/* Step 1: Analyzing symptoms */}
              <div className="flex items-center gap-4 md:gap-5 p-2">
                {speechStage === "analyzing" ? (
                  <div className="w-6 h-6 md:w-8 md:h-8 border-4 border-slate-300 border-t-blue-800 rounded-full animate-spin flex-shrink-0" />
                ) : (
                  <svg className="w-6 h-6 md:w-8 md:h-8 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                <p className="text-base md:text-lg text-left text-slate-700 font-medium">
                  Analyzing symptoms
                </p>
              </div>

              {/* Step 2: Preparing result */}
              <div className="flex items-center gap-4 md:gap-5 p-2">
                {speechStage === "preparing" ? (
                  <div className="w-6 h-6 md:w-8 md:h-8 border-4 border-slate-300 border-t-blue-800 rounded-full animate-spin flex-shrink-0" />
                ) : speechStage === "almost_there" ? (
                  <svg className="w-6 h-6 md:w-8 md:h-8 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <div className="w-6 h-6 md:w-8 md:h-8 rounded-full border-2 border-slate-200 flex-shrink-0" />
                )}
                <p className={`text-base md:text-lg text-left ${speechStage === "analyzing" ? "text-slate-400" : "text-slate-700 font-medium"}`}>
                  Preparing result
                </p>
              </div>

              {/* Step 3: Finishing up (was "Almost there") */}
              <div className="flex items-center gap-4 md:gap-5 p-2">
                {speechStage === "almost_there" ? (
                  <div className="w-6 h-6 md:w-8 md:h-8 border-4 border-slate-300 border-t-blue-800 rounded-full animate-spin flex-shrink-0" />
                ) : (
                  <div className="w-6 h-6 md:w-8 md:h-8 rounded-full border-2 border-slate-200 flex-shrink-0" />
                )}
                <p className={`text-base md:text-lg text-left ${speechStage === "almost_there" ? "text-slate-700 font-medium" : "text-slate-400"}`}>
                  Finishing up
                </p>
              </div>
            </div>

            <p className="text-sm md:text-base text-slate-400 mt-10 md:mt-14 text-left max-w-md mx-auto pl-0 md:pl-12">
              This can take less than a minute.
            </p>
          </div>
        </main>
      );
    }

    const parsed = parseResultMessage(result.message);

    // --------------------------------------------------------
    // SCREEN 2: Emergency result. Deliberately distinct styling
    // (red), single focused action, no secondary navigation.
    // --------------------------------------------------------
    if (result.is_emergency) {
      return (
        <>
          <Header disableNavigation={isAudioPlaying} />
          <main className="min-h-screen flex items-center justify-center bg-white px-3 md:px-4 pb-60 md:pb-0">
            <div className="max-w-2xl w-full rounded-lg p-6 md:p-12 mb-8 md:mb-12 bg-red-50 border border-red-400">
              <div className="flex items-center gap-3 md:gap-4 mb-5 md:mb-8">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-red-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 md:w-6 md:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-lg md:text-xl font-medium text-red-900">This may be an emergency</p>
              </div>

              <p className="text-sm md:text-base leading-relaxed text-red-900 mb-6">
                {parsed ? parsed.disclaimer || result.message : result.message}
              </p>

              <div className="bg-white/60 rounded-md p-4 mb-6 space-y-2">
                <p className="text-xs uppercase tracking-wide text-red-700 font-medium">Emergency contacts</p>
                <p className="text-sm text-red-900">Ambulance: <span className="font-medium">1990</span></p>
                <p className="text-sm text-red-900">Police emergency: <span className="font-medium">119</span></p>
                <p className="text-sm text-red-900">Nearest hospital: <span className="font-medium">National Hospital, 0.8 km away</span></p>
                <p className="text-sm text-red-900">Estimated arrival time: <span className="font-medium">6–9 minutes</span></p>
              </div>

              {showCallConfirm ? (
                <div className="space-y-2">
                  <p className="text-sm text-red-900 font-medium mb-2">Which service do you need?</p>
                  <a href="tel:1990" className="block w-full bg-red-600 hover:bg-red-700 text-white text-center py-3 md:py-4 rounded-md text-sm md:text-base font-medium">
                    Call Ambulance (1990)
                  </a>
                  <a href="tel:119" className="block w-full bg-red-600 hover:bg-red-700 text-white text-center py-3 md:py-4 rounded-md text-sm md:text-base font-medium">
                    Call Police (119)
                  </a>
                  <button onClick={() => setShowCallConfirm(false)} className="block w-full text-center text-red-700 text-sm py-2">
                    Cancel
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowCallConfirm(true)} className="w-full bg-red-600 hover:bg-red-700 text-white text-center py-3 md:py-4 rounded-md text-sm md:text-base font-medium">
                  Call emergency services
                </button>
              )}
            </div>
          </main>
        </>
      );
    }
    // --------------------------------------------------------
    // SCREEN 3: Normal (non-emergency) result. Structured card
    // with parsed sections, falls back to plain text if parsing
    // fails. Includes "Start a new Conversation" link, disabled
    // while voice is still playing.
    // --------------------------------------------------------
    return (
      <>
        <Header disableNavigation={isAudioPlaying} />
        <main className="min-h-screen flex items-center justify-center bg-white px-3 md:px-4 pb-90 md:pb-0">
          <div className="max-w-2xl w-full rounded-lg p-5 md:p-8 my-6 bg-white border border-slate-400">
            {parsed ? (
              <>
                <div className="flex items-center gap-3 md:gap-4 mb-5 md:mb-8">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 md:w-6 md:h-6 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-lg md:text-xl font-medium text-slate-800">Assessment complete</p>
                </div>

                <p className="text-xs md:text-sm uppercase tracking-wide text-slate-500 mb-2">Possible concern area</p>
                <p className="text-sm md:text-base text-slate-800 mb-4 md:mb-6">{parsed.concernArea}</p>

                <p className="text-xs md:text-sm uppercase tracking-wide text-slate-500 mb-2">Recommended specialist</p>
                <p className="text-base md:text-lg font-medium text-blue-800 mb-4 md:mb-6">{parsed.specialist}</p>

                <p className="text-xs md:text-sm uppercase tracking-wide text-slate-500 mb-3">What to tell the doctor</p>
                <ul className="list-disc pl-5 mb-4 md:mb-6 space-y-2 md:space-y-2.5">
                  {parsed.talkingPoints.map((point, i) => (
                    <li key={i} className="text-sm md:text-base text-slate-800">{point}</li>
                  ))}
                </ul>

                {parsed.disclaimer && (
                  <div className="bg-slate-50 rounded-md p-3 md:p-4 text-xs md:text-sm text-slate-500 leading-relaxed mb-4">
                    {parsed.disclaimer}
                  </div>
                )}

                {isAudioPlaying ? (
                  <div className="block w-full text-center bg-slate-300 text-white text-sm md:text-base font-medium py-3 rounded-md cursor-not-allowed">
                    Start a new Conversation
                  </div>
                ) : (
                  <Link
                    href="/"
                    className="block w-full text-center bg-blue-800 hover:bg-blue-900 text-white text-sm md:text-base font-medium py-3 rounded-md transition-colors"
                  >
                    Start a new Conversation
                  </Link>
                )}
              </>
            ) : (
              // Fallback: parsing failed, show raw message instead
              <>
                <p className="text-sm whitespace-pre-line leading-relaxed text-slate-700 mb-6">
                  {result.message}
                </p>
                {isAudioPlaying ? (
                  <div className="block w-full text-center bg-slate-300 text-white text-sm md:text-base font-medium py-3 rounded-md cursor-not-allowed">
                    Start a new Conversation
                  </div>
                ) : (
                  <Link
                    href="/"
                    className="block w-full text-center bg-blue-800 hover:bg-blue-900 text-white text-sm md:text-base font-medium py-3 rounded-md transition-colors"
                  >
                    Start a new Conversation
                  </Link>
                )}
              </>
            )}
          </div>
        </main>
      </>
    );
  }

  // ============================================================
  // RENDER: ACTIVE STATE (rounds 1-3, asking questions)
  // ============================================================
  return (
    <>
      <Header />
      <main className="min-h-screen flex items-start justify-center bg-white px-4 pt-8 md:pt-28">
        <div className="max-w-4xl md:min-h-[500px] mb-8 w-full bg-white border border-slate-200 rounded-lg p-6 md:p-16">
          {/* Round indicator + progress bar */}
          <p className="text-xs md:text-sm uppercase tracking-wide text-slate-500 mb-3">
            Round {round} of 3
          </p>
          <div className="h-2 bg-slate-100 rounded-full mb-6 overflow-hidden">
            <div
              className="h-full bg-blue-800 transition-all"
              style={{ width: `${(round / 3) * 100}%` }}
            />
          </div>

          {/* Current question */}
          <p className="text-lg md:text-xl text-slate-800 mb-6 md:mb-12 leading-relaxed">
            {currentQuestion}
          </p>

          {/* Text input + voice record button */}
          <div className="flex gap-3 md:min-h-[200px] items-stretch mt-6">
            <textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              maxLength={500}
              placeholder={isRecording ? "Listening...tap again to stop" : isTranscribing ? "Transcribing...please wait" : "Type your answer"}
              className={`flex-1 min-h-[100px] md:min-h-[88px] border rounded-md p-3 md:p-4 text-sm md:text-base resize-none focus:outline-none focus:ring-2 transition-colors ${isRecording
                ? "bg-red-50 border-red-300 text-red-900 placeholder-red-400 focus:ring-red-200"
                : "bg-slate-50 border-slate-300 text-slate-800 focus:ring-blue-200"
                }`}
            />
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isTranscribing}
              className={`w-14 md:w-20 rounded-md flex items-center justify-center transition-colors flex-shrink-0 ${isRecording
                ? "bg-red-600 hover:bg-red-700"
                : "bg-slate-50 border border-slate-300 hover:bg-slate-100"
                }`}
            >
              {isRecording ? (
                <div className="w-3 h-3 bg-white rounded-sm" />
              ) : (
                <svg
                  className="w-4 h-4 md:w-5 md:h-5 text-blue-800"
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

          {/* Inline error message */}
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={state === "loading" || !userInput.trim()}
            className="w-full mt-6 bg-blue-800 hover:bg-blue-900 disabled:bg-slate-300 text-white text-sm md:text-base font-medium py-3 md:py-4 rounded-md transition-colors"
          >
            {state === "loading" ? "Sending..." : "Send"}
          </button>
        </div>
      </main>
    </>
  );
}