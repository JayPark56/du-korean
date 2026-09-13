import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DashboardTabs from "./DashboardTabs";
import LessonRequestSection from "./LessonRequestSection";
import ProfileSection from "./ProfileSection";
import ScheduleSection from "./ScheduleSection";

export const metadata: Metadata = { title: "Dashboard · DU Korean Program" };

export default async function DashboardPage() {
  const profile = await requireStudent();
  const supabase = await createClient();
  const { data: requests, error } = await supabase
    .from("topic_requests")
    .select("*")
    .eq("user_id", profile.id)
    .order("week_start", { ascending: false });
  if (error) throw new Error(`Could not load your lesson requests: ${error.message}`);

  const firstName = profile.name.split(" ")[0] || profile.name;

  return (
    <>
      <PageHeader
        title={`안녕하세요, ${firstName}!`}
        subtitle="Set your availability, keep your goals up to date, and tell Jay what you'd like to learn."
      />
      <DashboardTabs
        schedule={<ScheduleSection userId={profile.id} />}
        requests={<LessonRequestSection userId={profile.id} initialRequests={requests ?? []} />}
        profile={
          <ProfileSection
            userId={profile.id}
            name={profile.name}
            initialLevel={profile.korean_level}
            initialGoals={profile.goals}
            initialBio={profile.bio}
            initialAvatarPath={profile.avatar_url}
          />
        }
      />
    </>
  );
}
