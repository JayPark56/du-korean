import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MISSING_CONFIG_MESSAGE, isSupabaseConfigured } from "@/lib/supabase/config";
import type { Profile } from "@/lib/types";

/** The signed-in user's profile, or null. Deduplicated per request. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  await connection(); // always per-request, never prerendered
  if (!isSupabaseConfigured) throw new Error(MISSING_CONFIG_MESSAGE);

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return null;

  const { data, error } = await supabase.from("users").select("*").eq("id", userId).maybeSingle();
  if (error) throw new Error(`Could not load your profile: ${error.message}`);
  return data;
});

export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect("/dashboard");
  return profile;
}

export async function requireStudent(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role === "admin") redirect("/admin");
  return profile;
}
