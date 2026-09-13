import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import AdminSchedule from "./AdminSchedule";

export const metadata: Metadata = { title: "스케줄 관리 · DU Korean Program" };

export default async function AdminSchedulePage() {
  const profile = await requireAdmin();
  return (
    <>
      <PageHeader
        title="스케줄 관리"
        subtitle="내 가능 시간을 설정하고, 학생들과 겹치는 최적의 수업 시간을 찾아보세요."
      />
      <AdminSchedule adminId={profile.id} />
    </>
  );
}
