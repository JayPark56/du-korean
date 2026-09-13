import Link from "next/link";
import type { ReactNode } from "react";
import { MISSING_CONFIG_MESSAGE, isSupabaseConfigured } from "@/lib/supabase/config";

export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
  wide = false,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
  /** Wider card for pages with more text (e.g. sign-up notice). */
  wide?: boolean;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-brand-50/60 via-stone-50 to-stone-50 px-4 py-12">
      <Link href="/" className="mb-8 flex flex-col items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-brand-600 text-xl font-bold text-white shadow-lg shadow-brand-600/20">
          한
        </span>
        <span className="text-xl font-bold tracking-tight text-stone-900">DU Korean Program</span>
      </Link>

      <div className={`w-full ${wide ? "max-w-md" : "max-w-sm"} rounded-2xl border border-stone-200/80 bg-white p-6 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] sm:p-8`}>
        <h1 className="text-xl font-bold tracking-tight text-stone-900">{title}</h1>
        <p className="mt-1 text-sm text-stone-500">{subtitle}</p>

        {!isSupabaseConfigured && (
          <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
            {MISSING_CONFIG_MESSAGE}
          </p>
        )}

        <div className="mt-6">{children}</div>
      </div>

      <p className="mt-6 text-sm text-stone-500">{footer}</p>
    </main>
  );
}
