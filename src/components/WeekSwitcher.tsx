"use client";

import { formatWeekRange, tzAbbreviation, type Locale } from "@/lib/schedule";

const MAX_WEEKS_AHEAD = 8;

export default function WeekSwitcher({
  weekStart,
  offset,
  onOffsetChange,
  locale = "en",
}: {
  weekStart: string;
  offset: number;
  onOffsetChange: (offset: number) => void;
  locale?: Locale;
}) {
  const label =
    offset === 0
      ? locale === "ko" ? "이번 주" : "This week"
      : offset === 1
        ? locale === "ko" ? "다음 주" : "Next week"
        : locale === "ko" ? `${offset}주 후` : `In ${offset} weeks`;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="inline-flex items-center rounded-xl border border-stone-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => onOffsetChange(offset - 1)}
          disabled={offset <= 0}
          aria-label={locale === "ko" ? "이전 주" : "Previous week"}
          className="grid size-8 place-items-center rounded-lg text-stone-600 transition hover:bg-stone-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          ‹
        </button>
        <div className="min-w-36 px-2 text-center">
          <div className="text-sm font-semibold text-stone-900">{label}</div>
          <div className="text-xs text-stone-500">{formatWeekRange(weekStart, locale)}</div>
        </div>
        <button
          type="button"
          onClick={() => onOffsetChange(offset + 1)}
          disabled={offset >= MAX_WEEKS_AHEAD}
          aria-label={locale === "ko" ? "다음 주" : "Next week"}
          className="grid size-8 place-items-center rounded-lg text-stone-600 transition hover:bg-stone-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          ›
        </button>
      </div>
      <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
        {locale === "ko" ? `덴버 시간 (${tzAbbreviation(weekStart)})` : `Denver time (${tzAbbreviation(weekStart)})`}
      </span>
    </div>
  );
}
