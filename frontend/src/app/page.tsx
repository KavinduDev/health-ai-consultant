// frontend/src/app/page.tsx

import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen flex relative">
      <div className="md:hidden absolute inset-0">
        <Image
          src="/stethoscope.webp"
          alt=""
          fill
          className="object-cover opacity-40"
          priority
        />
      </div>

      <div className="hidden md:flex relative w-1/2 items-center justify-center bg-white border-r border-slate-600">
        <Image
          src="/stethoscope.webp"
          alt="Stethoscope and medical equipment"
          fill
          className="object-cover"
          priority
        />
      </div>

      <div className="flex-1 flex items-center justify-center bg-transparent md:bg-white px-4 relative z-10">
        <div className="max-w-lg w-full text-center bg-white/80 backdrop-blur-md rounded-2xl p-8 md:bg-transparent md:backdrop-blur-none md:p-0">
          <div className="w-20 h-20 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-7">
            <svg
              className="w-10 h-10 text-blue-800"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 3v6a4.5 4.5 0 009 0V3M9 13.5v2.25a5.25 5.25 0 1010.5 0V12M19.5 9.75a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"
              />
            </svg>
          </div>

          <h1 className="text-3xl font-medium text-slate-800 mb-3">
            Symptom triage assistant
          </h1>

          <p className="text-base text-slate-600 leading-relaxed mb-8">
            Describe how you&apos;re feeling. Three short questions, then a
            clear direction on which specialist to see.
          </p>

          <Link
            href="/chat"
            className="block w-full bg-blue-700 hover:bg-blue-900 text-white text-base font-medium py-4 rounded-lg transition-colors"
          >
            Start conversation
          </Link>

          <p className="text-sm text-slate-600 mt-5 leading-relaxed">
            This tool does not diagnose conditions. It is not a substitute for
            professional medical advice.
          </p>
        </div>
      </div>
    </main>
  );
}