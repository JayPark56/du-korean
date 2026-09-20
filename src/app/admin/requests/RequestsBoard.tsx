"use client";

import { useState } from "react";
import Avatar from "@/components/Avatar";
import { Spinner } from "@/components/ui";
import { addDays, currentWeekStart, formatTimestamp, formatWeekRange } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/client";
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
  const [unreadOnly, setUnreadOnly] = useState(false);
  // Read ticks are manual; keep them local so the list doesn't have to reload.
  const [readOverrides, setReadOverrides] = useState<Record<string, string | null>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);

  if (students.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center text-stone-500">
        아직 가입한 학생이 없습니다.
      </div>
    );
  }

  const readAtOf = (request: TopicRequest) =>
    request.id in readOverrides ? readOverrides[request.id] : request.read_at;

  async function toggleRead(request: TopicRequest) {
    const nextRead = !readAtOf(request);
    setBusyId(request.id);
    setReadError(null);
    const { error } = await createClient().rpc("set_request_read", {
      request_id: request.id,
      is_read: nextRead,
    });
    setBusyId(null);
    if (error) setReadError(`읽음 표시 실패: ${error.message}`);
    else setReadOverrides((current) => ({ ...current, [request.id]: nextRead ? new Date().toISOString() : null }));
  }

  const studentById = new Map(students.map((s) => [s.id, s]));
  const matches = (r: TopicRequest) =>
    (student === ALL || r.user_id === student) && (!unreadOnly || !readAtOf(r));
  const weeks = [...new Set([nextWeek, thisWeek, ...requests.map((r) => r.week_start)])].sort((a, b) =>
    b.localeCompare(a),
  );
  const weekLabel = (w: string) =>
    `${w === thisWeek ? "이번 주 · " : w === nextWeek ? "다음 주 · " : ""}${formatWeekRange(w, "ko")}`;
  const countFor = (w: string) => requests.filter((r) => r.week_start === w && matches(r)).length;
  const unreadCount = requests.filter((r) => !readAtOf(r)).length;

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

  const card = (s: Student | undefined, request: TopicRequest | undefined) => (
    <RequestCard
      key={request?.id ?? s?.id}
      student={s}
      request={request}
      readAt={request ? readAtOf(request) : null}
      busy={busyId === request?.id}
      onToggleRead={request ? () => toggleRead(request) : undefined}
    />
  );

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
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
          <button
            type="button"
            onClick={() => setUnreadOnly((v) => !v)}
            aria-pressed={unreadOnly}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
              unreadOnly
                ? "border-amber-500 bg-amber-500 text-white"
                : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:text-stone-900"
            }`}
          >
            안 읽은 요청만 {unreadCount > 0 && `(${unreadCount})`}
          </button>
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {chip(ALL, `전체 학생 (${students.length})`)}
          {students.map((s) => chip(s.id, s.name))}
        </div>
      </div>

      {readError && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {readError}
        </p>
      )}

      {week === ALL ? (
        (() => {
          const shownWeeks = weeks.filter((w) => countFor(w) > 0);
          if (shownWeeks.length === 0) {
            return (
              <p className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center text-stone-500">
                {unreadOnly ? "안 읽은 요청이 없습니다." : "작성된 요청이 없습니다."}
              </p>
            );
          }
          return (
            <div className="space-y-8">
              {shownWeeks.map((w) => (
                <section key={w}>
                  <h2 className="mb-3 text-sm font-semibold text-stone-500">{weekLabel(w)}</h2>
                  <div className="space-y-4">
                    {requests
                      .filter((r) => r.week_start === w && matches(r))
                      .sort((a, b) =>
                        (studentById.get(a.user_id)?.name ?? "").localeCompare(studentById.get(b.user_id)?.name ?? ""),
                      )
                      .map((r) => card(studentById.get(r.user_id), r))}
                  </div>
                </section>
              ))}
            </div>
          );
        })()
      ) : (
        <div className="space-y-4">
          {students
            .filter((s) => student === ALL || s.id === student)
            .map((s) => ({ s, request: requests.find((r) => r.week_start === week && r.user_id === s.id) }))
            .filter(({ request }) => (unreadOnly ? request && !readAtOf(request) : true))
            .sort((a, b) => Number(Boolean(b.request)) - Number(Boolean(a.request)))
            .map(({ s, request }) => card(s, request))}
          {unreadOnly && !students.some((s) => requests.some((r) => r.week_start === week && r.user_id === s.id && !readAtOf(r))) && (
            <p className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center text-stone-500">
              이 주차에는 안 읽은 요청이 없습니다.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function RequestCard({
  student,
  request,
  readAt,
  busy,
  onToggleRead,
}: {
  student?: Student;
  request?: TopicRequest;
  readAt: string | null;
  busy: boolean;
  onToggleRead?: () => void;
}) {
  const name = student?.name ?? "알 수 없는 학생";
  return (
    <article className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] sm:p-6">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={name} path={student?.avatar_url} className="size-9 text-xs" />
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 truncate font-bold text-stone-900">
              {name}
              {request && !readAt && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  안 읽음
                </span>
              )}
            </h3>
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
        <>
          <div className="rounded-xl bg-stone-50 p-4">
            <p className="text-[15px] font-semibold leading-relaxed text-stone-900">{request.main_topic}</p>
            {request.additional_details && (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-stone-600">
                {request.additional_details}
              </p>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
            {readAt && (
              <span className="text-xs text-emerald-700">
                읽음 ✓ {formatTimestamp(readAt, "ko")}
              </span>
            )}
            <button
              type="button"
              onClick={onToggleRead}
              disabled={busy}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
                readAt
                  ? "border-stone-200 bg-white text-stone-500 hover:text-stone-900"
                  : "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
              }`}
            >
              {busy && <Spinner className="size-3.5" />}
              {readAt ? "읽음 취소" : "읽음 표시"}
            </button>
          </div>
        </>
      ) : (
        <p className="rounded-xl border border-dashed border-stone-200 p-4 text-sm text-stone-400">
          이 주차에 작성된 요청이 없습니다.
        </p>
      )}
    </article>
  );
}
