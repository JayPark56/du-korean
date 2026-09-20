import { redirect } from "next/navigation";
import { getProfileState } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function Home() {
  if (!isSupabaseConfigured) redirect("/login");
  const state = await getProfileState();
  if (state.status === "anon") redirect("/login");
  if (state.status === "removed") redirect("/account-removed");
  redirect(state.profile.role === "admin" ? "/admin" : "/dashboard");
}
