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
  groupStudentsBySlot,
  keysToSlots,
  slotKeysInRange,
  setsEqual,
  slotKey,
  slotsToKeys,
  type Day,
} from "@/lib/schedule";
import { createClient } from "@/lib/supabase/client";
import type { FixedLesson } from "@/lib/types";
import FixLessonDialog from "./FixLessonDialog";
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
  const [fixedLessons, setFixedLessons] = useState<FixedLesson[]>([]);
  const [fixBusy, setFixBusy] = useState<string | null>(null);
  const [fixError, setFixError] = useState<string | null>(null);
  // Which students a lesson is for: asked whenever more than one student overlaps.
  const [picker, setPicker] = useState<
    { kind: "new"; block: RecBlock } | { kind: "edit"; lesson: FixedLesson } | null
  >(null);

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
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("fixed_lessons")
        .select("*")
        .eq("week_start", weekStart);
      if (cancelled) return;
      setFixedLessons(data ?? []);
      setFixError(error?.message ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, weekStart]);

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

  // slot key → ids of every student available then
  const studentsByKey = useMemo(
    () =>
      students && weekData
        ? groupStudentsBySlot(
            students.map((s) => s.id),
            weekData.slotsByUser,
          )
        : new Map<string, string[]>(),
    [students, weekData],
  );

  const nameById = useMemo(() => new Map((students ?? []).map((s) => [s.id, s.name])), [students]);
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

  // Manual only: a lesson is confirmed when the admin presses 픽스.
  async function fixBlock(block: RecBlock, studentIds: string[]) {
    setFixBusy(`${block.day}-${block.start}`);
    setFixError(null);
    const { data, error } = await supabase
      .from("fixed_lessons")
      .insert({
        week_start: weekStart,
        day: block.day,
        start_time: block.start,
        end_time: block.end,
        student_ids: studentIds,
      })
      .select("*")
      .single();
    setFixBusy(null);
    if (error) setFixError(`픽스 실패: ${error.message}`);
    else setFixedLessons((current) => [...current, data]);
  }

  async function updateLessonStudents(lesson: FixedLesson, studentIds: string[]) {
    setFixBusy(lesson.id);
    setFixError(null);
    const { data, error } = await supabase
      .from("fixed_lessons")
      .update({ student_ids: studentIds })
      .eq("id", lesson.id)
      .select("*")
      .single();
    setFixBusy(null);
    if (error) setFixError(`학생 변경 실패: ${error.message}`);
    else setFixedLessons((current) => current.map((l) => (l.id === lesson.id ? data : l)));
  }

  /** Students free for the whole lesson, plus whoever is already on it. */
  function candidatesFor(day: Day, start: string, end: string, current: string[]) {
    const keys = slotKeysInRange(day, start, end);
    const free = (students ?? [])
      .filter((s) => keys.every((key) => (studentsByKey.get(key) ?? []).includes(s.id)))
      .map((s) => s.id);
    return [...new Set([...free, ...current])].map((id) => ({
      id,
      name: nameById.get(id) ?? "삭제된 학생",
    }));
  }

  async function unfixLesson(lesson: FixedLesson) {
    setFixBusy(lesson.id);
    setFixError(null);
    const { error } = await supabase.from("fixed_lessons").delete().eq("id", lesson.id);
    setFixBusy(null);
    if (error) setFixError(`해제 실패: ${error.message}`);
    else setFixedLessons((current) => current.filter((l) => l.id !== lesson.id));
  }

  const fixedKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const lesson of fixedLessons) {
      for (const key of slotKeysInRange(lesson.day as Day, lesson.start_time, lesson.end_time)) keys.add(key);
    }
    return keys;
  }, [fixedLessons]);

  const lessonForBlock = (block: RecBlock) =>
    fixedLessons.find(
      (l) => l.day === block.day && l.start_time === block.start && l.end_time === block.end,
    );

  const sortedFixed = [...fixedLessons].sort(
    (a, b) => DAYS.indexOf(a.day as Day) - DAYS.indexOf(b.day as Day) || a.start_time.localeCompare(b.start_time),
  );

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
        title="픽스된 수업"
        description="추천 시간 옆의 “픽스” 버튼을 누른 수업만 확정됩니다. 확정하면 해당 학생들의 대시보드에도 표시돼요."
      >
        {fixError && (
          <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {fixError}
          </p>
        )}
        {sortedFixed.length === 0 ? (
          <p className="text-sm text-stone-500">아직 픽스된 수업이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {sortedFixed.map((lesson) => {
              const keys = slotKeysInRange(lesson.day as Day, lesson.start_time, lesson.end_time);
              const stillFree = lesson.student_ids.filter((id) =>
                keys.every((key) => (studentsByKey.get(key) ?? []).includes(id)),
              );
              return (
                <li
                  key={lesson.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white font-bold text-amber-700 shadow-sm">
                    {dayLabel(DAYS.indexOf(lesson.day as Day), "ko")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-stone-900">
                      {formatTime(lesson.start_time, "ko")} – {formatTime(lesson.end_time, "ko")}
                    </div>
                    <div className="truncate text-xs text-stone-600">
                      {lesson.student_ids.length === 0
                        ? "학생 없음"
                        : lesson.student_ids.map((id) => nameById.get(id) ?? "삭제된 학생").join(", ")}
                    </div>
                    {stillFree.length !== lesson.student_ids.length && (
                      <div className="mt-0.5 text-xs font-medium text-amber-700">
                        ⚠ 일부 학생의 가능 시간이 바뀌었어요
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPicker({ kind: "edit", lesson })}
                      disabled={fixBusy !== null}
                      className={`${buttonClass.ghost} text-xs`}
                    >
                      학생 변경
                    </button>
                    <button
                      type="button"
                      onClick={() => unfixLesson(lesson)}
                      disabled={fixBusy !== null}
                      className={`${buttonClass.ghost} text-xs`}
                    >
                      {fixBusy === lesson.id && <Spinner className="size-3.5" />}
                      해제
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

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
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-stone-900">
                    {formatTime(block.start, "ko")} – {formatTime(block.end, "ko")}
                  </div>
                  <div className="truncate text-xs text-stone-600">
                    Jay + {block.studentIds.length}명 · {block.studentIds.map((id) => nameById.get(id)).join(", ")}
                  </div>
                </div>
                {lessonForBlock(block) ? (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    픽스됨
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      block.studentIds.length > 1
                        ? setPicker({ kind: "new", block })
                        : fixBlock(block, block.studentIds)
                    }
                    disabled={fixBusy !== null}
                    className={`${buttonClass.secondary} shrink-0 px-3 py-1.5 text-xs`}
                  >
                    {fixBusy === `${block.day}-${block.start}` && <Spinner className="size-3.5" />}
                    픽스
                  </button>
                )}
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
              students={students ?? []}
              studentsByKey={studentsByKey}
              adminSlots={draft}
              recommended={recommendedKeys}
              fixedKeys={fixedKeys}
            />
          )}
        </SectionCard>
      </div>

      {picker && (
        <FixLessonDialog
          title={
            picker.kind === "new"
              ? `${dayLabel(DAYS.indexOf(picker.block.day), "ko")} ${formatTime(picker.block.start, "ko")} – ${formatTime(picker.block.end, "ko")}`
              : `${dayLabel(DAYS.indexOf(picker.lesson.day as Day), "ko")} ${formatTime(picker.lesson.start_time, "ko")} – ${formatTime(picker.lesson.end_time, "ko")}`
          }
          candidates={
            picker.kind === "new"
              ? candidatesFor(picker.block.day, picker.block.start, picker.block.end, picker.block.studentIds)
              : candidatesFor(
                  picker.lesson.day as Day,
                  picker.lesson.start_time,
                  picker.lesson.end_time,
                  picker.lesson.student_ids,
                )
          }
          initialSelected={picker.kind === "new" ? picker.block.studentIds : picker.lesson.student_ids}
          confirmLabel={picker.kind === "new" ? "픽스" : "저장"}
          onCancel={() => setPicker(null)}
          onConfirm={(ids) => {
            const target = picker;
            setPicker(null);
            if (target.kind === "new") fixBlock(target.block, ids);
            else updateLessonStudents(target.lesson, ids);
          }}
        />
      )}
    </div>
  );
}
