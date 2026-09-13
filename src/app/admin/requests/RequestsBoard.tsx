"use client";

import { useState } from "react";
import Avatar from "@/components/Avatar";
import { addDays, currentWeekStart, formatTimestamp, formatWeekRange } from "@/lib/schedule";
import type { Profile, TopicRequest } from "@/lib/types";

type Student = Pick<Profile, "id" | "name" | "email" | "korean_level" | "goals" | "avatar_url">;

const ALL = "all";

export default function RequestsBoard({
  students,
  requests,
  initialStudent,
}: {
  students: Student[];
  requests: TopicRequest[];
  initialStudent: string;
}) {
  const thisWeek = currentWeekStart();
  const nextWeek = addDays(thisWeek, 7);
  const [week, setWeek] = useState(thisWeek);
  const [student, setStudent] = useState(students.some((s) => s.id === initialStudent) ? initialStudent : ALL);

  if (students.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center text-stone-500">
        아직 가입한 학생이 없습니다.
      </div>
    );
  }

  const studentById = new Map(students.map((s) => [s.id, s]));
  const matchesStudent = (r: TopicRequest) => student === ALL || r.user_id === student;
  const weeks = [...new Set([nextWeek, thisWeek, ...requests.map((r) => r.week_start)])].sort((a, b) =>
    b.localeCompare(a),
  );
  const weekLabel = (w: string) =>
    `${w === thisWeek ? "이번 주 · " : w === nextWeek ? "다음 주 · " : ""}${formatWeekRange(w, "ko")}`;
  const countFor = (w: string) => requests.filter((r) => r.week_start === w && matchesStudent(r)).length;

  const chip = (value: string, label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => setStudent(value)}
      aria-pressed={student === value}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
        student === value
          ? "border-brand-600 bg-brand-600 text-white"
          : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:text-stone-900"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <label className="flex flex-wrap items-center gap-2 text-sm font-medium text-stone-700">
          주차
          <select
            value={week}
            onChange={(e) => setWeek(e.target.value)}
            className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-800 shadow-sm"
          >
            <option value={ALL}>전체 주차</option>
            {weeks.map((w) => (
              <option key={w} value={w}>
                {weekLabel(w)} ({countFor(w)}건)
              </option>
            ))}
          </select>
        </label>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {chip(ALL, `전체 학생 (${students.length})`)}
          {students.map((s) => chip(s.id, s.name))}
        </div>
      </div>

      {week === ALL ? (
        <AllWeeks
          weeks={weeks.filter((w) => countFor(w) > 0)}
          weekLabel={weekLabel}
          requests={requests.filter(matchesStudent)}
          studentById={studentById}
        />
      ) : (
        <div className="space-y-4">
          {students
            .filter((s) => student === ALL || s.id === student)
            .map((s) => ({ s, request: requests.find((r) => r.week_start === week && r.user_id === s.id) }))
            .sort((a, b) => Number(Boolean(b.request)) - Number(Boolean(a.request)))
            .map(({ s, request }) => (
              <RequestCard key={s.id} student={s} request={request} />
            ))}
        </div>
      )}
    </div>
  );
}

function AllWeeks({
  weeks,
  weekLabel,
  requests,
  studentById,
}: {
  weeks: string[];
  weekLabel: (week: string) => string;
  requests: TopicRequest[];
  studentById: Map<string, Student>;
}) {
  if (weeks.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center text-stone-500">
        작성된 요청이 없습니다.
      </p>
    );
  }
  return (
    <div className="space-y-8">
      {weeks.map((w) => (
        <section key={w}>
          <h2 className="mb-3 text-sm font-semibold text-stone-500">{weekLabel(w)}</h2>
          <div className="space-y-4">
            {requests
              .filter((r) => r.week_start === w)
              .sort((a, b) => (studentById.get(a.user_id)?.name ?? "").localeCompare(studentById.get(b.user_id)?.name ?? ""))
              .map((r) => (
                <RequestCard key={r.id} student={studentById.get(r.user_id)} request={r} />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function RequestCard({ student, request }: { student?: Student; request?: TopicRequest }) {
  const name = student?.name ?? "알 수 없는 학생";
  return (
    <article className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] sm:p-6">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={name} path={student?.avatar_url} className="size-9 text-xs" />
          <div className="min-w-0">
            <h3 className="truncate font-bold text-stone-900">{name}</h3>
            <p className="truncate text-xs text-stone-500">
              {student?.korean_level ? `수준: ${student.korean_level}` : "수준 미입력"}
              {student?.goals && ` · 목표: ${student.goals}`}
            </p>
          </div>
        </div>
        {request && (
          <time className="text-xs text-stone-400" dateTime={request.updated_at}>
            {formatTimestamp(request.updated_at, "ko")} 수정
          </time>
        )}
      </header>
      {request ? (
        <div className="rounded-xl bg-stone-50 p-4">
          <p className="text-[15px] font-semibold leading-relaxed text-stone-900">{request.main_topic}</p>
          {request.additional_details && (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-stone-600">
              {request.additional_details}
            </p>
          )}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-stone-200 p-4 text-sm text-stone-400">
          이 주차에 작성된 요청이 없습니다.
        </p>
      )}
    </article>
  );
}
