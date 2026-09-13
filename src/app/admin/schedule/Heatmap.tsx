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

const BRAND_RGB = "155, 58, 75";

export default function Heatmap({
  weekStart,
  totalStudents,
  studentsByKey,
  nameById,
  adminSlots,
  recommended,
}: {
  weekStart: string;
  totalStudents: number;
  studentsByKey: Map<string, string[]>;
  nameById: Map<string, string>;
  adminSlots: Set<string>;
  recommended: Set<string>;
}) {
  const [hover, setHover] = useState<Hover | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const dates = weekDates(weekStart);

  const describe = (key: string) => {
    const [day, time] = key.split("|");
    const d = DAYS.indexOf(day as (typeof DAYS)[number]);
    const ids = studentsByKey.get(key) ?? [];
    return {
      title: `${dayLabel(d, "ko")} ${shortDate(dates[d])} · ${formatTime(time, "ko")}–${formatTime(addMinutes(time, 30), "ko")}`,
      names: ids.map((id) => nameById.get(id) ?? "알 수 없음"),
      jay: adminSlots.has(key),
      recommended: recommended.has(key),
    };
  };

  const detail = (key: string) => {
    const info = describe(key);
    return (
      <>
        <div className="font-semibold">{info.title}</div>
        <div className="mt-1">
          가능 학생 {info.names.length}/{totalStudents}
          {info.names.length > 0 && `: ${info.names.join(", ")}`}
        </div>
        <div className={info.jay ? "text-sky-300" : "opacity-60"}>
          Jay {info.jay ? "가능" : "불가"}
          {info.recommended && " · ★ 추천"}
        </div>
      </>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-stone-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="text-stone-400">0</span>
          <span
            className="h-3 w-24 rounded"
            style={{
              background: `linear-gradient(to right, rgba(${BRAND_RGB},0.08), rgba(${BRAND_RGB},0.9))`,
            }}
          />
          <span className="text-stone-400">{totalStudents}명</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-sky-500" /> Jay 가능
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-4 rounded shadow-[inset_0_0_0_2px_#1d4ed8]" /> 추천 시간
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-stone-200">
        <div
          role="grid"
          aria-label="전체 학생 가능 시간 히트맵"
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
                  const count = studentsByKey.get(key)?.length ?? 0;
                  const ratio = totalStudents > 0 ? count / totalStudents : 0;
                  const isJay = adminSlots.has(key);
                  const isRec = recommended.has(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      role="gridcell"
                      aria-label={`${describe(key).title}, 학생 ${count}명${isJay ? ", Jay 가능" : ""}`}
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
                      {count > 0 && (
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
          {detail(hover.key)}
        </div>
      )}

      {/* Tapped cell details (works on mobile) */}
      <div className="min-h-[4.5rem] rounded-xl bg-stone-900 px-4 py-3 text-xs leading-relaxed text-white">
        {pinned ? detail(pinned) : <span className="opacity-60">칸을 탭하면 가능한 학생 이름이 표시됩니다.</span>}
      </div>
    </div>
  );
}
