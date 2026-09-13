import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AdminSeenArea } from "@/lib/types";

export type AdminBadges = Record<AdminSeenArea, boolean>;

const NO_BADGES: AdminBadges = { schedule: false, requests: false };

/**
 * Red-dot state for the admin navbar: an area is "new" when any student row
 * was updated after the admin last opened that page.
 */
export async function getAdminBadges(adminId: string): Promise<AdminBadges> {
  const supabase = await createClient();
  const latest = (table: "availability" | "topic_requests") =>
    supabase
      .from(table)
      .select("updated_at")
      .neq("user_id", adminId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

  const [seenRes, scheduleRes, requestsRes] = await Promise.all([
    supabase.from("admin_seen").select("area, seen_at").eq("admin_id", adminId),
    latest("availability"),
    latest("topic_requests"),
  ]);
  // Badges are a nicety; never break the admin pages over them (e.g. SQL not re-run yet).
  if (seenRes.error || scheduleRes.error || requestsRes.error) return NO_BADGES;

  const seenAt = new Map((seenRes.data ?? []).map((row) => [row.area, row.seen_at]));
  const isNewer = (updatedAt: string | undefined, area: AdminSeenArea) => {
    if (!updatedAt) return false;
    const seen = seenAt.get(area);
    return !seen || Date.parse(updatedAt) > Date.parse(seen);
  };

  return {
    schedule: isNewer(scheduleRes.data?.updated_at, "schedule"),
    requests: isNewer(requestsRes.data?.updated_at, "requests"),
  };
}
