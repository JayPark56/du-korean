import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import MarkSeen from "../MarkSeen";
import RequestsBoard from "./RequestsBoard";

export const metadata: Metadata = { title: "수업 요청 · DU Korean Program" };

export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  await requireAdmin();
  const { student } = await searchParams;
  const supabase = await createClient();

  const [studentsRes, requestsRes] = await Promise.all([
    supabase
      .from("users")
      .select("id, name, email, korean_level, goals, avatar_url")
      .eq("role", "student")
      .order("name"),
    supabase.from("topic_requests").select("*").order("week_start", { ascending: false }),
  ]);
  const error = studentsRes.error ?? requestsRes.error;
  if (error) throw new Error(`데이터를 불러오지 못했습니다: ${error.message}`);

  return (
    <>
      <MarkSeen area="requests" />
      <PageHeader title="수업 요청 모아보기" subtitle="학생들이 주차별로 배우고 싶은 내용입니다." />
      <RequestsBoard
        students={studentsRes.data ?? []}
        requests={requestsRes.data ?? []}
        initialStudent={student ?? "all"}
      />
    </>
  );
}
