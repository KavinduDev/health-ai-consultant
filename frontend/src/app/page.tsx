// frontend/src/app/page.tsx

import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-5">
          <svg
            className="w-7 h-7 text-blue-800"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>

        <h1 className="text-xl font-medium text-slate-800 mb-2">
          Symptom triage assistant
        </h1>

        <p className="text-sm text-slate-500 leading-relaxed mb-6">
          Describe how you&apos;re feeling. Three short questions, then a
          clear direction on which specialist to see.
        </p>

        <Link
          href="/chat"
          className="block w-full bg-blue-800 hover:bg-blue-900 text-white text-sm font-medium py-3 rounded-lg transition-colors"
        >
          Start consultation
        </Link>

        <p className="text-xs text-slate-400 mt-4 leading-relaxed">
          This tool does not diagnose conditions. It is not a substitute for
          professional medical advice.
        </p>
      </div>
    </main>
  );
}