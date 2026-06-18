// frontend/src/components/Header.tsx

import Link from "next/link";

interface HeaderProps {
  disableNavigation?: boolean;
}

export default function Header({ disableNavigation = false }: HeaderProps) {
  const content = (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
        <svg
          className="w-4 h-4 text-blue-800"
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
      <p className="text-sm font-medium text-slate-800">Symptom triage assistant</p>
    </div>
  );

  return (
    <header className="flex items-center gap-2.5 px-6 py-3.5 border-b border-slate-200 bg-white">
      {disableNavigation ? content : <Link href="/">{content}</Link>}
    </header>
  );
}