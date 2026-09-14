"use client";

import { useState } from "react";
import {
  DAYS,
  GRID_TEMPLATE_COLUMNS,
  TIMES,
  addMinutes,
  dayLabel,
  formatTime,
  shortDate,
  slotKey,
  weekDates,
} from "@/lib/schedule";

type Hover = { key: string; x: number; y: number };
type Student = { id: string; name: string };

const BRAND_RGB = "155, 58, 75";

/**
 * Overlap of every student's availability. Click a student's name (chip or in the
 * cell details) to show only the times that student picked.
 */
export default function Heatmap({
  weekStart,
  students,
  studentsByKey,
  adminSlots,
  recommended,
}: {
  weekStart: string;
  students: Student[];
  /** slot key → ids of every student available then */
  studentsByKey: Map<string, string[]>;
  adminSlots: Set<string>;
  recommended: Set<string>;
}) {
  const [hover, setHover] = useState<Hover | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const dates = weekDates(weekStart);

  const nameById = new Map(students.map((s) => [s.id, s.name]));
  const focused = students.find((s) => s.id === focusId) ?? null;
  const total = focused ? 1 : students.length;

  const hoursById = new Map<string, number>();
  for (const ids of studentsByKey.values()) {
    for (const id of ids) hoursById.set(id, (hoursById.get(id) ?? 0) + 0.5);
  }

  /** Students shown at a slot: everyone available, or just the focused student. */
  const idsAt = (key: string) => {
    const ids = studentsByKey.get(key) ?? [];
    return focused ? ids.filter((id) => id === focused.id) : ids;
  };
  const isRecommended = (key: string) =>
    focused ? adminSlots.has(key) && idsAt(key).length > 0 : recommended.has(key);

  const slotTitle = (key: string) => {
    const [day, time] = key.split("|");
    const d = DAYS.indexOf(day as (typeof DAYS)[number]);
    return `${dayLabel(d, "ko")} ${shortDate(dates[d])} · ${formatTime(time, "ko")}–${formatTime(addMinutes(time, 30), "ko")}`;
  };

  /** Cell details; `interactive` makes the names clickable (the pinned panel, not the hover tooltip). */
  const detail = (key: string, interactive: boolean) => {
    const ids = studentsByKey.get(key) ?? [];
    const jay = adminSlots.has(key);
    return (
      <>
        <div className="font-semibold">{slotTitle(key)}</div>
        {focused ? (
          <div className="mt-1">
            {focused.name} {ids.includes(focused.id) ? "가능" : "불가"}
          </div>
        ) : (
          <div className="mt-1">
            가능 학생 {ids.length}/{students.length}
            {ids.length > 0 && ": "}
            {ids.map((id, i) => (
              <span key={id}>
                {i > 0 && ", "}
                {interactive ? (
                  <button
                    type="button"
                    onClick={() => setFocusId(id)}
                    className="font-semibold underline decoration-white/40 underline-offset-2 hover:decoration-white"
                  >
                    {nameById.get(id) ?? "알 수 없음"}
                  </button>
                ) : (
                  (nameById.get(id) ?? "알 수 없음")
                )}
              </span>
            ))}
          </div>
        )}
        <div className={jay ? "text-sky-300" : "opacity-60"}>
          Jay {jay ? "가능" : "불가"}
          {isRecommended(key) && (focused ? " · ★ 겹침" : " · ★ 추천")}
        </div>
      </>
    );
  };

  const chip = (id: string | null, label: string, sub?: string) => {
    const active = focusId === id || (id !== null && focused?.id === id) || (id === null && !focused);
    return (
      <button
        key={id ?? "all"}
        type="button"
        onClick={() => setFocusId(id)}
        aria-pressed={active}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
          active
            ? "border-brand-600 bg-brand-600 text-white"
            : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:text-stone-900"
        }`}
      >
        {label}
        {sub && <span className={active ? "text-white/75" : "text-stone-400"}>{sub}</span>}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {students.length > 0 && (
        <div className="space-y-2">
          <div role="group" aria-label="학생별 보기" className="flex flex-wrap gap-2">
            {chip(null, "전체", `${students.length}명`)}
            {students.map((s) => {
              const hours = hoursById.get(s.id) ?? 0;
              return chip(s.id, s.name, hours > 0 ? `${hours}시간` : "미입력");
            })}
          </div>
          <p className="text-xs text-stone-500">
            {focused
              ? `${focused.name}님이 고른 시간만 표시 중이에요. "전체"를 누르면 모두 겹쳐서 볼 수 있어요.`
              : "학생 이름을 누르면 그 학생이 고른 시간만 볼 수 있어요."}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-stone-600">
        {focused ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-5 rounded" style={{ background: `rgba(${BRAND_RGB},0.9)` }} />
            {focused.name} 가능
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-stone-400">0</span>
            <span
              className="h-3 w-24 rounded"
              style={{
                background: `linear-gradient(to right, rgba(${BRAND_RGB},0.08), rgba(${BRAND_RGB},0.9))`,
              }}
            />
            <span className="text-stone-400">{students.length}명</span>
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-sky-500" /> Jay 가능
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-4 rounded shadow-[inset_0_0_0_2px_#1d4ed8]" /> {focused ? "Jay와 겹침" : "추천 시간"}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-stone-200">
        <div
          role="grid"
          aria-label={focused ? `${focused.name} 가능 시간` : "전체 학생 가능 시간 히트맵"}
          className="grid w-full min-w-[520px] bg-white sm:min-w-0"
          style={{ gridTemplateColumns: GRID_TEMPLATE_COLUMNS }}
          onMouseLeave={() => setHover(null)}
        >
          <div className="sticky left-0 z-10 border-b border-stone-200 bg-white" />
          {DAYS.map((day, d) => (
            <div key={day} className="border-b border-l border-stone-200 px-1 py-2 text-center">
              <div className="text-xs font-semibold text-stone-800">{dayLabel(d, "ko")}</div>
              <div className="text-[11px] text-stone-400">{shortDate(dates[d])}</div>
            </div>
          ))}

          {TIMES.map((time) => {
            const onHour = time.endsWith(":00");
            return (
              <div key={time} role="row" className="contents">
                <div className="sticky left-0 z-10 -mt-px whitespace-nowrap bg-white pr-2 text-right text-[10.5px] leading-none text-stone-400">
                  {onHour && <span className="relative -top-1.5">{formatTime(time, "ko")}</span>}
                </div>
                {DAYS.map((day) => {
                  const key = slotKey(day, time);
                  const count = idsAt(key).length;
                  const ratio = total > 0 ? count / total : 0;
                  const isJay = adminSlots.has(key);
                  const isRec = isRecommended(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      role="gridcell"
                      data-slot={key}
                      data-count={count}
                      aria-label={`${slotTitle(key)}, ${focused ? `${focused.name} ${count ? "가능" : "불가"}` : `학생 ${count}명`}${isJay ? ", Jay 가능" : ""}`}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHover({ key, x: rect.left + rect.width / 2, y: rect.top });
                      }}
                      onFocus={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHover({ key, x: rect.left + rect.width / 2, y: rect.top });
                      }}
                      onBlur={() => setHover(null)}
                      onClick={() => setPinned((p) => (p === key ? null : key))}
                      className={`relative h-7 border-l border-stone-200 outline-none transition sm:h-6 ${
                        onHour ? "border-t border-t-stone-200" : "border-t border-t-stone-100"
                      } ${isRec ? "shadow-[inset_0_0_0_2px_#1d4ed8]" : ""} ${
                        pinned === key ? "ring-2 ring-stone-900 ring-inset" : ""
                      } focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-inset`}
                      style={count > 0 ? { backgroundColor: `rgba(${BRAND_RGB}, ${0.1 + ratio * 0.8})` } : undefined}
                    >
                      {count > 0 && !focused && (
                        <span
                          className={`text-[10px] font-semibold ${ratio > 0.5 ? "text-white" : "text-brand-800"}`}
                        >
                          {count}
                        </span>
                      )}
                      {isJay && (
                        <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-sky-500 ring-1 ring-white" />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Desktop hover tooltip */}
      {hover && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 hidden max-w-64 -translate-x-1/2 -translate-y-full rounded-lg bg-stone-900 px-3 py-2 text-xs leading-relaxed text-white shadow-lg md:block"
          style={{ left: hover.x, top: hover.y - 6 }}
        >
          {detail(hover.key, false)}
        </div>
      )}

      {/* Clicked cell details (works on mobile); names here are clickable */}
      <div data-detail="" className="min-h-[4.5rem] rounded-xl bg-stone-900 px-4 py-3 text-xs leading-relaxed text-white">
        {pinned ? (
          detail(pinned, true)
        ) : (
          <span className="opacity-60">칸을 누르면 그 시간에 가능한 학생 이름이 모두 표시됩니다.</span>
        )}
      </div>
    </div>
  );
}
