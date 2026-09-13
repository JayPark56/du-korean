"use client";

import Link from "next/link";
import { buttonClass } from "@/components/ui";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-semibold text-brand-600">Something went wrong · 오류가 발생했습니다</p>
      <h1 className="max-w-lg text-lg font-semibold text-stone-900">{error.message || "Unexpected error"}</h1>
      {error.digest && <p className="text-xs text-stone-400">Error ID: {error.digest}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => retry()} className={buttonClass.primary}>
          Try again
        </button>
        <Link href="/" className={buttonClass.secondary}>
          Home
        </Link>
      </div>
    </main>
  );
}
