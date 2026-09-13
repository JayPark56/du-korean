"use client";

import { useEffect, useMemo, useState } from "react";
import AvailabilityGrid from "@/components/AvailabilityGrid";
import WeekSwitcher from "@/components/WeekSwitcher";
import { SectionCard, Skeleton, Spinner, StatusText, buttonClass } from "@/components/ui";
import {
  addDays,
  currentWeekStart,
  keysToSlots,
  setsEqual,
  slotsToKeys,
} from "@/lib/schedule";
import { createClient } from "@/lib/supabase/client";

type Status = { type: "success" | "error"; message: string } | null;
type WeekData = { week: string; jaySlots: Set<string>; error: string | null };

export default function ScheduleSection({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const weekStart = useMemo(() => addDays(currentWeekStart(), offset * 7), [offset]);

  const [weekData, setWeekData] = useState<WeekData | null>(null);
  const [draft, setDraft] = useState<Set<string>>(() => new Set());
  const [saved, setSaved] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const loading = open && weekData?.week !== weekStart;
  const dirty = !setsEqual(draft, saved);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        // RLS returns only this student's row and Jay's row.
        const { data, error } = await supabase
          .from("availability")
          .select("user_id, available_slots")
          .eq("week_start", weekStart);
        if (cancelled) return;
        const rows = data ?? [];
        const mine = slotsToKeys(rows.find((r) => r.user_id === userId)?.available_slots);
        const jay = new Set<string>();
        rows
          .filter((r) => r.user_id !== userId)
          .forEach((r) => slotsToKeys(r.available_slots).forEach((k) => jay.add(k)));
        setWeekData({ week: weekStart, jaySlots: jay, error: error?.message ?? null });
        setDraft(mine);
        setSaved(mine);
      } catch {
        if (!cancelled) {
          setWeekData({ week: weekStart, jaySlots: new Set(), error: "Network error." });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, weekStart, userId, supabase, reloadKey]);

  // Warn before leaving the page with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function changeWeek(next: number) {
    if (dirty && !window.confirm("You have unsaved changes for this week. Discard them?")) return;
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
          { user_id: userId, week_start: weekStart, available_slots: keysToSlots(draft) },
          { onConflict: "user_id,week_start" },
        );
      if (error) throw new Error(error.message);
      setSaved(new Set(draft));
      setStatus({ type: "success", message: "Availability saved." });
    } catch (e) {
      setStatus({ type: "error", message: `Could not save: ${(e as Error).message}` });
    } finally {
      setSaving(false);
    }
  }

  const jaySlots = weekData?.week === weekStart ? weekData.jaySlots : new Set<string>();
  const overlapCount = [...draft].filter((k) => jaySlots.has(k)).length;

  return (
    <SectionCard
      id="schedule"
      title="Schedule"
      description="Mark every time you could meet. Times Jay is also free are outlined in blue."
      action={
        !open && (
          <button type="button" onClick={() => setOpen(true)} className={buttonClass.primary}>
            Select Your Availability
          </button>
        )
      }
    >
      {!open ? (
        <p className="text-sm text-stone-500">
          Open the grid to choose your available times for this week or upcoming weeks.
        </p>
      ) : (
        <div className="space-y-4">
          <WeekSwitcher weekStart={weekStart} offset={offset} onOffsetChange={changeWeek} />

          {weekData?.error && weekData.week === weekStart ? (
            <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
              Could not load availability: {weekData.error}{" "}
              <button
                type="button"
                className="font-semibold underline"
                onClick={() => {
                  setWeekData(null);
                  setReloadKey((k) => k + 1);
                }}
              >
                Retry
              </button>
            </div>
          ) : loading ? (
            <Skeleton className="h-[640px] w-full sm:h-[560px]" />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-stone-600">
                <Legend swatch="bg-emerald-500" label="You're available" />
                <Legend swatch="bg-sky-50 shadow-[inset_0_0_0_2px_#60a5fa]" label="Jay is available" />
                <Legend
                  swatch="bg-emerald-500 shadow-[inset_0_0_0_2px_#1d4ed8] text-white"
                  label="Recommended (both free)"
                  star
                />
              </div>
              {jaySlots.size === 0 && (
                <p className="rounded-lg bg-stone-100 px-3 py-2 text-xs text-stone-600">
                  Jay hasn&apos;t posted availability for this week yet — recommended times will
                  appear once they do.
                </p>
              )}

              <AvailabilityGrid
                weekStart={weekStart}
                selected={draft}
                onChange={(next) => {
                  setDraft(next);
                  setStatus(null);
                }}
                highlighted={jaySlots}
              />
              <p className="text-xs text-stone-400">
                <span className="hidden sm:inline">Click a cell, or click and drag to select many.</span>
                <span className="sm:hidden">Tap a cell, or press and hold, then drag to select many.</span>{" "}
                Start on a green cell to erase.
              </p>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-4">
                <div className="text-sm text-stone-600">
                  <strong className="text-stone-900">{draft.size / 2}</strong> hours selected
                  {jaySlots.size > 0 && (
                    <>
                      {" · "}
                      <strong className="text-blue-700">{overlapCount / 2}</strong> overlap with Jay
                    </>
                  )}
                  {dirty && <span className="ml-2 text-amber-600">• Unsaved changes</span>}
                </div>
                <div className="flex items-center gap-2">
                  <StatusText status={status} />
                  <button
                    type="button"
                    className={buttonClass.ghost}
                    onClick={() => setDraft(new Set())}
                    disabled={draft.size === 0 || saving}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    className={buttonClass.primary}
                    onClick={save}
                    disabled={!dirty || saving}
                  >
                    {saving && <Spinner />}
                    Save
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </SectionCard>
  );
}

function Legend({ swatch, label, star }: { swatch: string; label: string; star?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`grid size-4 place-items-center rounded text-[9px] ${swatch}`}>
        {star && "★"}
      </span>
      {label}
    </span>
  );
}
