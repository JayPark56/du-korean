"use client";

import { useState, type FormEvent } from "react";
import { SectionCard, Spinner, StatusText, buttonClass, inputClass } from "@/components/ui";
import { addDays, currentWeekStart, formatTimestamp, formatWeekRange } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/client";
import type { TopicRequest } from "@/lib/types";

type Status = { type: "success" | "error"; message: string } | null;
type Draft = { main: string; details: string };

const MAIN_MAX = 300;
const DETAILS_MAX = 5000;

export default function LessonRequestSection({
  userId,
  initialRequests,
}: {
  userId: string;
  /** All of this student's requests, any order. */
  initialRequests: TopicRequest[];
}) {
  const thisWeek = currentWeekStart();
  const editableWeeks = [thisWeek, addDays(thisWeek, 7)];

  const [requests, setRequests] = useState(initialRequests);
  const [week, setWeek] = useState(thisWeek);
  // Unsaved edits per week, so switching weeks doesn't lose them.
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const savedFor = (w: string) => requests.find((r) => r.week_start === w);
  const draftFor = (w: string): Draft =>
    drafts[w] ?? { main: savedFor(w)?.main_topic ?? "", details: savedFor(w)?.additional_details ?? "" };
  const isDirty = (w: string) => {
    const draft = draftFor(w);
    return draft.main !== (savedFor(w)?.main_topic ?? "") || draft.details !== (savedFor(w)?.additional_details ?? "");
  };

  const saved = savedFor(week);
  const draft = draftFor(week);
  const dirty = isDirty(week);
  const pastRequests = requests
    .filter((r) => r.week_start < thisWeek)
    .sort((a, b) => b.week_start.localeCompare(a.week_start));

  function updateDraft(patch: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [week]: { ...draft, ...patch } }));
    setStatus(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const main = draft.main.trim();
    const details = draft.details.trim();
    if (!main) {
      setStatus({ type: "error", message: "Please enter what you'd like to focus on." });
      return;
    }

    setSaving(true);
    setStatus(null);
    try {
      const { data, error } = await createClient()
        .from("topic_requests")
        .upsert(
          { user_id: userId, week_start: week, main_topic: main, additional_details: details },
          { onConflict: "user_id,week_start" },
        )
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      setRequests((current) => [...current.filter((r) => r.week_start !== data.week_start), data]);
      setDrafts((current) => {
        const next = { ...current };
        delete next[week];
        return next;
      });
      setStatus({ type: "success", message: "Request saved. Jay will see it." });
    } catch (e) {
      setStatus({ type: "error", message: `Could not save: ${(e as Error).message}` });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard title="Lesson Requests" description="Tell Jay what to cover each week. Only you and Jay can see this.">
      <form onSubmit={onSubmit} className="space-y-5">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">Week</span>
          <select
            value={week}
            onChange={(e) => {
              setWeek(e.target.value);
              setStatus(null);
            }}
            className={`${inputClass} sm:w-auto sm:min-w-72`}
          >
            {editableWeeks.map((w, i) => (
              <option key={w} value={w}>
                {i === 0 ? "This week" : "Next week"} · {formatWeekRange(w, "en")}
                {isDirty(w) ? " (unsaved)" : savedFor(w) ? " ✓" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-medium text-stone-700">
            <span>
              What would you like to focus on? <span className="text-brand-600">*</span>
            </span>
            <span className="text-xs font-normal text-stone-400">
              {draft.main.length}/{MAIN_MAX}
            </span>
          </span>
          <input
            value={draft.main}
            onChange={(e) => updateDraft({ main: e.target.value })}
            required
            maxLength={MAIN_MAX}
            className={inputClass}
            placeholder="e.g. Ordering food at a restaurant"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-medium text-stone-700">
            <span>
              Any additional details or requests? <span className="font-normal text-stone-400">(optional)</span>
            </span>
            <span className="text-xs font-normal text-stone-400">
              {draft.details.length}/{DETAILS_MAX}
            </span>
          </span>
          <textarea
            value={draft.details}
            onChange={(e) => updateDraft({ details: e.target.value })}
            maxLength={DETAILS_MAX}
            rows={5}
            className={`${inputClass} min-h-32 resize-y leading-relaxed`}
            placeholder="e.g. I'd like to practice polite speech and review 을/를 vs 이/가."
          />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-stone-400">
            {saved ? `Last saved ${formatTimestamp(saved.updated_at, "en")}` : "Not submitted for this week yet"}
            {saved?.read_at && (
              <span className="ml-2 font-medium text-emerald-600">
                Jay read this ✓ {formatTimestamp(saved.read_at, "en")}
              </span>
            )}
          </p>
          <div className="flex items-center gap-3">
            {dirty && !saving && <span className="text-sm text-amber-600">Unsaved changes</span>}
            <StatusText status={status} />
            <button type="submit" disabled={!dirty || saving} className={buttonClass.primary}>
              {saving && <Spinner />}
              Save
            </button>
          </div>
        </div>
      </form>

      {pastRequests.length > 0 && (
        <div className="mt-8 border-t border-stone-100 pt-6">
          <h3 className="mb-3 text-sm font-semibold text-stone-900">Past requests</h3>
          <ul className="space-y-3">
            {pastRequests.map((r) => (
              <li key={r.id} className="rounded-xl bg-stone-50 p-4">
                <p className="text-xs text-stone-400">
                  {formatWeekRange(r.week_start, "en")}
                  {r.read_at && <span className="ml-2 font-medium text-emerald-600">Jay read this ✓</span>}
                </p>
                <p className="mt-1 font-semibold text-stone-900">{r.main_topic}</p>
                {r.additional_details && (
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-stone-600">
                    {r.additional_details}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}
