"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AdminSeenArea } from "@/lib/types";

/** Records that the admin opened this page, then refreshes so the navbar dot clears. */
export default function MarkSeen({ area }: { area: AdminSeenArea }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    createClient()
      .rpc("mark_admin_seen", { seen_area: area })
      .then(({ error }) => {
        if (!cancelled && !error) router.refresh();
      });
    return () => {
      cancelled = true;
    };
  }, [area, router]);

  return null;
}
