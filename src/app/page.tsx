import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function Home() {
  if (!isSupabaseConfigured) redirect("/login");
  const profile = await getProfile();
  if (!profile) redirect("/login");
  redirect(profile.role === "admin" ? "/admin" : "/dashboard");
}
