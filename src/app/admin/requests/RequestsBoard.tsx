"use client";

import { useState } from "react";
import { formatTimestamp } from "@/lib/schedule";
import type { Profile, TopicRequest } from "@/lib/types";

type Student = Pick<Profile, "id" | "name" | "email" | "korean_level" | "goals">;

export default function RequestsBoard({
  students,
  requests,
  initialFilter,
}: {
  students: Student[];
  requests: TopicRequest[];
  initialFilter: string;
}) {
  const [filter, setFilter] = useState(
    students.some((s) => s.id === initialFilter) ? initialFilter : "all",
  );
  const requestByUser = new Map(requests.map((r) => [r.user_id, r]));

  const visible = students
    .filter((s) => filter === "all" || s.id === filter)
    .sort((a, b) => {
      // Most recently updated requests first; students without one last.
      const ta = requestByUser.get(a.id)?.content ? Date.parse(requestByUser.get(a.id)!.updated_at) : 0;
      const tb = requestByUser.get(b.id)?.content ? Date.parse(requestByUser.get(b.id)!.updated_at) : 0;
      return tb - ta;
    });

  if (students.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center text-stone-500">
        아직 가입한 학생이 없습니다.
      </div>
    );
  }

  const chip = (value: string, label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => setFilter(value)}
      aria-pressed={filter === value}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
        filter === value
          ? "border-brand-600 bg-brand-600 text-white"
          : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:text-stone-900"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-5">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {chip("all", `전체 (${students.length})`)}
        {students.map((s) => chip(s.id, s.name))}
      </div>

      <div className="space-y-4">
        {visible.map((student) => {
          const request = requestByUser.get(student.id);
          return (
            <article
              key={student.id}
              className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] sm:p-6"
            >
              <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="font-bold text-stone-900">{student.name}</h2>
                  <p className="text-xs text-stone-500">
                    {student.korean_level ? `수준: ${student.korean_level}` : "수준 미입력"}
                    {student.goals && ` · 목표: ${student.goals}`}
                  </p>
                </div>
                {request?.content && (
                  <time className="text-xs text-stone-400" dateTime={request.updated_at}>
                    {formatTimestamp(request.updated_at, "ko")} 수정
                  </time>
                )}
              </header>
              {request?.content ? (
                <p className="whitespace-pre-wrap rounded-xl bg-stone-50 p-4 text-[15px] leading-relaxed text-stone-800">
                  {request.content}
                </p>
              ) : (
                <p className="rounded-xl border border-dashed border-stone-200 p-4 text-sm text-stone-400">
                  아직 작성된 요청이 없습니다.
                </p>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
