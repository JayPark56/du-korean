"use client";

import { useEffect, useMemo, useState } from "react";
import AvailabilityGrid from "@/components/AvailabilityGrid";
import WeekSwitcher from "@/components/WeekSwitcher";
import { SectionCard, Skeleton, Spinner, StatusText, buttonClass } from "@/components/ui";
import {
  DAYS,
  TIMES,
  addDays,
  addMinutes,
  currentWeekStart,
  dayLabel,
  formatTime,
  keysToSlots,
  setsEqual,
  slotKey,
  slotsToKeys,
  type Day,
} from "@/lib/schedule";
import { createClient } from "@/lib/supabase/client";
import Heatmap from "./Heatmap";

type Status = { type: "success" | "error"; message: string } | null;
type Student = { id: string; name: string };
type WeekData = { week: string; slotsByUser: Map<string, Set<string>>; error: string | null };
type RecBlock = { day: Day; start: string; end: string; studentIds: string[] };

export default function AdminSchedule({ adminId }: { adminId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [offset, setOffset] = useState(0);
  const weekStart = useMemo(() => addDays(currentWeekStart(), offset * 7), [offset]);

  const [students, setStudents] = useState<Student[] | null>(null);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [weekData, setWeekData] = useState<WeekData | null>(null);
  const [draft, setDraft] = useState<Set<string>>(() => new Set());
  const [saved, setSaved] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [minStudents, setMinStudents] = useState<number | null>(null);

  const loading = weekData?.week !== weekStart || students === null;
  const dirty = !setsEqual(draft, saved);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, name")
        .eq("role", "student")
        .order("name");
      if (cancelled) return;
      if (error) setStudentsError(error.message);
      else setStudents(data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("availability")
        .select("user_id, available_slots")
        .eq("week_start", weekStart);
      if (cancelled) return;
      const slotsByUser = new Map((data ?? []).map((r) => [r.user_id, slotsToKeys(r.available_slots)]));
      const mine = slotsByUser.get(adminId) ?? new Set<string>();
      setWeekData({ week: weekStart, slotsByUser, error: error?.message ?? null });
      setDraft(mine);
      setSaved(mine);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, weekStart, adminId]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function changeWeek(next: number) {
    if (dirty && !window.confirm("저장하지 않은 변경사항이 있습니다. 다른 주로 이동할까요?")) return;
    setStatus(null);
    setOffset(next);
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const { error } = await supabase
        .from("availability")
        .upsert(
          { user_id: adminId, week_start: weekStart, available_slots: keysToSlots(draft) },
          { onConflict: "user_id,week_start" },
        );
      if (error) throw new Error(error.message);
      setSaved(new Set(draft));
      setStatus({ type: "success", message: "저장되었습니다." });
    } catch (e) {
      setStatus({ type: "error", message: `저장 실패: ${(e as Error).message}` });
    } finally {
      setSaving(false);
    }
  }

  // slot key → ids of students available then
  const studentsByKey = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!students || !weekData) return map;
    for (const student of students) {
      weekData.slotsByUser.get(student.id)?.forEach((key) => {
        map.set(key, [...(map.get(key) ?? []), student.id]);
      });
    }
    return map;
  }, [students, weekData]);

  const totalStudents = students?.length ?? 0;
  const required = Math.min(Math.max(minStudents ?? totalStudents, 1), Math.max(totalStudents, 1));

  // Jay (current draft) + at least `required` students, merged into blocks with the same group.
  const { recommendedKeys, blocks } = useMemo(() => {
    const recommendedKeys = new Set<string>();
    const blocks: RecBlock[] = [];
    for (const day of DAYS) {
      let current: (RecBlock & { signature: string }) | null = null;
      for (const time of TIMES) {
        const key = slotKey(day, time);
        const ids = studentsByKey.get(key) ?? [];
        if (!draft.has(key) || ids.length < required || totalStudents === 0) {
          current = null;
          continue;
        }
        recommendedKeys.add(key);
        const signature = ids.join(",");
        if (current && current.signature === signature) {
          current.end = addMinutes(time, 30);
        } else {
          current = { day, start: time, end: addMinutes(time, 30), studentIds: ids, signature };
          blocks.push(current);
        }
      }
    }
    return { recommendedKeys, blocks };
  }, [draft, studentsByKey, required, totalStudents]);

  const nameById = useMemo(() => new Map((students ?? []).map((s) => [s.id, s.name])), [students]);
  const submittedCount = students?.filter((s) => (weekData?.slotsByUser.get(s.id)?.size ?? 0) > 0).length ?? 0;

  const loadError = studentsError ?? (weekData?.week === weekStart ? weekData.error : null);

  return (
    <div className="space-y-6">
      <div className="sticky top-[6.5rem] z-20 -mx-1 rounded-2xl bg-stone-50/90 px-1 py-2 backdrop-blur md:top-16">
        <WeekSwitcher weekStart={weekStart} offset={offset} onOffsetChange={changeWeek} locale="ko" />
      </div>

      {loadError && (
        <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          데이터를 불러오지 못했습니다: {loadError}
        </div>
      )}

      <SectionCard
        title="추천 수업 시간"
        description="내 가능 시간(저장 전 변경사항 포함)과 학생들의 가능 시간이 겹치는 구간입니다."
        action={
          totalStudents > 1 && (
            <label className="flex items-center gap-2 text-sm text-stone-600">
              Jay +
              <select
                value={required}
                onChange={(e) => setMinStudents(Number(e.target.value))}
                className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-sm font-medium text-stone-800"
              >
                {Array.from({ length: totalStudents }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n === totalStudents ? `학생 전원 (${n}명)` : `최소 ${n}명`}
                  </option>
                ))}
              </select>
            </label>
          )
        }
      >
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : totalStudents === 0 ? (
          <p className="text-sm text-stone-500">아직 가입한 학생이 없습니다.</p>
        ) : draft.size === 0 ? (
          <p className="text-sm text-stone-500">아래에서 내 가능 시간을 먼저 선택해 주세요.</p>
        ) : blocks.length === 0 ? (
          <p className="text-sm text-stone-500">
            조건에 맞는 시간이 없습니다.
            {required > 1 && " 최소 인원을 줄여 보세요."}
            {submittedCount < totalStudents &&
              ` (이번 주 시간을 입력한 학생: ${submittedCount}/${totalStudents}명)`}
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {blocks.map((block) => (
              <li
                key={`${block.day}-${block.start}`}
                className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white font-bold text-blue-700 shadow-sm">
                  {dayLabel(DAYS.indexOf(block.day), "ko")}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-stone-900">
                    {formatTime(block.start, "ko")} – {formatTime(block.end, "ko")}
                  </div>
                  <div className="truncate text-xs text-stone-600">
                    Jay + {block.studentIds.length}명 · {block.studentIds.map((id) => nameById.get(id)).join(", ")}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SectionCard
          title="내 가능 시간"
          description="클릭하거나 드래그해서 가능한 시간을 표시하세요. 학생들에게 추천 시간으로 보입니다."
        >
          {loading ? (
            <Skeleton className="h-[560px] w-full" />
          ) : (
            <div className="space-y-4">
              <AvailabilityGrid
                weekStart={weekStart}
                selected={draft}
                onChange={(next) => {
                  setDraft(next);
                  setStatus(null);
                }}
                locale="ko"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-stone-600">
                  <strong className="text-stone-900">{draft.size / 2}</strong>시간 선택됨
                  {dirty && <span className="ml-2 text-amber-600">• 저장되지 않음</span>}
                </span>
                <div className="flex items-center gap-2">
                  <StatusText status={status} />
                  <button
                    type="button"
                    className={buttonClass.ghost}
                    onClick={() => setDraft(new Set())}
                    disabled={draft.size === 0 || saving}
                  >
                    전체 해제
                  </button>
                  <button
                    type="button"
                    className={buttonClass.primary}
                    onClick={save}
                    disabled={!dirty || saving}
                  >
                    {saving && <Spinner />}
                    저장
                  </button>
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="전체 스케줄 오버뷰"
          description={
            loading
              ? "학생들의 가능 시간을 겹쳐 보여줍니다."
              : `색이 진할수록 가능한 학생이 많습니다. 이번 주 입력 ${submittedCount}/${totalStudents}명`
          }
        >
          {loading ? (
            <Skeleton className="h-[560px] w-full" />
          ) : (
            <Heatmap
              weekStart={weekStart}
              totalStudents={totalStudents}
              studentsByKey={studentsByKey}
              nameById={nameById}
              adminSlots={draft}
              recommended={recommendedKeys}
            />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
