"use client";

import Link from "next/link";
import { useEffect } from "react";
import { buttonClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

/**
 * Shown when someone still has a session but no profile — i.e. the admin
 * deleted the account. Signs the leftover session out so /login works again.
 */
export default function AccountRemoved() {
  useEffect(() => {
    createClient().auth.signOut();
  }, []);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-brand-600 text-xl font-bold text-white">
        한
      </span>
      <h1 className="text-xl font-bold text-stone-900">This account is no longer active</h1>
      <p className="max-w-sm text-sm leading-relaxed text-stone-500">
        Your DU Korean Program account has been removed. If this seems wrong, please contact Jay.
      </p>
      <Link href="/login" className={buttonClass.secondary}>
        Back to log in
      </Link>
    </main>
  );
}
