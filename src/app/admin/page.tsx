import type { Metadata } from "next";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import { PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { currentWeekStart, formatTimestamp, slotsToKeys } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "학생 목록 · DU Korean Program" };

export default async function AdminStudentsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const weekStart = currentWeekStart();

  const [studentsRes, requestsRes, availabilityRes] = await Promise.all([
    supabase.from("users").select("*").eq("role", "student").order("name"),
    supabase.from("topic_requests").select("*"),
    supabase.from("availability").select("user_id, available_slots").eq("week_start", weekStart),
  ]);
  const error = studentsRes.error ?? requestsRes.error ?? availabilityRes.error;
  if (error) throw new Error(`데이터를 불러오지 못했습니다: ${error.message}`);

  const students = studentsRes.data ?? [];
  const requestByUser = new Map((requestsRes.data ?? []).map((r) => [r.user_id, r]));
  const hoursByUser = new Map(
    (availabilityRes.data ?? []).map((a) => [a.user_id, slotsToKeys(a.available_slots).size / 2]),
  );

  return (
    <>
      <PageHeader title="학생 목록" subtitle={`등록된 학생 ${students.length}명`} />

      {students.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center text-stone-500">
          아직 가입한 학생이 없습니다. 학생들에게 회원가입 링크(<code>/signup</code>)를 공유하세요.
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {students.map((student) => {
            const request = requestByUser.get(student.id);
            const hours = hoursByUser.get(student.id) ?? 0;
            return (
              <article
                key={student.id}
                className="flex flex-col rounded-2xl border border-stone-200/80 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] transition hover:shadow-[0_1px_3px_rgba(0,0,0,0.06),0_12px_28px_-12px_rgba(0,0,0,0.14)]"
              >
                <div className="mb-4 flex items-center gap-3">
                  <Avatar name={student.name} path={student.avatar_url} className="size-14 text-lg" />
                  <div className="min-w-0">
                    <h2 className="truncate font-bold text-stone-900">{student.name}</h2>
                    <a
                      href={`mailto:${student.email}`}
                      className="block truncate text-sm text-stone-500 hover:text-brand-700"
                    >
                      {student.email}
                    </a>
                  </div>
                </div>

                {student.bio && (
                  <p className="-mt-1 mb-4 rounded-xl bg-brand-50/60 px-3 py-2 text-sm text-stone-700">
                    “{student.bio}”
                  </p>
                )}

                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-xs font-semibold text-stone-400">한국어 수준</dt>
                    <dd className="mt-0.5 text-stone-800">{student.korean_level || <Empty />}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-stone-400">목표</dt>
                    <dd className="mt-0.5 whitespace-pre-wrap text-stone-800">{student.goals || <Empty />}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-stone-400">최근 수업 요청</dt>
                    <dd className="mt-1">
                      {request?.content ? (
                        <p className="line-clamp-4 whitespace-pre-wrap rounded-xl bg-stone-50 p-3 text-stone-700">
                          {request.content}
                        </p>
                      ) : (
                        <Empty />
                      )}
                      {request?.content && (
                        <p className="mt-1 text-xs text-stone-400">
                          {formatTimestamp(request.updated_at, "ko")} 수정
                        </p>
                      )}
                    </dd>
                  </div>
                </dl>

                <div className="mt-auto flex items-center justify-between gap-2 pt-5 text-xs">
                  <span
                    className={`rounded-full px-2.5 py-1 font-medium ${
                      hours > 0 ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"
                    }`}
                  >
                    {hours > 0 ? `이번 주 ${hours}시간 가능` : "이번 주 시간 미입력"}
                  </span>
                  <Link
                    href={`/admin/requests?student=${student.id}`}
                    className="font-semibold text-brand-700 hover:underline"
                  >
                    요청 보기 →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

function Empty() {
  return <span className="text-stone-400">미입력</span>;
}
