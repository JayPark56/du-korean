import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MISSING_CONFIG_MESSAGE, isSupabaseConfigured } from "@/lib/supabase/config";
import type { Profile } from "@/lib/types";

/**
 * "anon" = not signed in. "removed" = signed in but the profile is gone,
 * which happens after the admin deletes the account.
 */
export type ProfileState =
  | { status: "anon" }
  | { status: "removed" }
  | { status: "ok"; profile: Profile };

/** Deduplicated per request. */
export const getProfileState = cache(async (): Promise<ProfileState> => {
  if (!isSupabaseConfigured) throw new Error(MISSING_CONFIG_MESSAGE);
  await connection(); // always per-request, never prerendered

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return { status: "anon" };

  const { data, error } = await supabase.from("users").select("*").eq("id", userId).maybeSingle();
  if (error) throw new Error(`Could not load your profile: ${error.message}`);
  return data ? { status: "ok", profile: data } : { status: "removed" };
});

export async function getProfile(): Promise<Profile | null> {
  const state = await getProfileState();
  return state.status === "ok" ? state.profile : null;
}

export async function requireProfile(): Promise<Profile> {
  const state = await getProfileState();
  if (state.status === "anon") redirect("/login");
  if (state.status === "removed") redirect("/account-removed");
  return state.profile;
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
