"use client";

import { useState, type FormEvent } from "react";
import { SectionCard, Spinner, StatusText, buttonClass, inputClass } from "@/components/ui";
import { formatTimestamp } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/client";

type Status = { type: "success" | "error"; message: string } | null;
const MAX_LENGTH = 5000;

export default function LessonRequestSection({
  userId,
  initialContent,
  initialUpdatedAt,
}: {
  userId: string;
  initialContent: string;
  initialUpdatedAt: string | null;
}) {
  const [content, setContent] = useState(initialContent);
  const [savedContent, setSavedContent] = useState(initialContent);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const dirty = content !== savedContent;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const { data, error } = await createClient()
        .from("topic_requests")
        .upsert({ user_id: userId, content }, { onConflict: "user_id" })
        .select("content, updated_at")
        .single();
      if (error) throw new Error(error.message);
      setSavedContent(data.content);
      setUpdatedAt(data.updated_at);
      setStatus({ type: "success", message: "Request saved. Jay will see it." });
    } catch (e) {
      setStatus({ type: "error", message: `Could not save: ${(e as Error).message}` });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      id="requests"
      title="Lesson Requests"
      description="Only you and Jay can see this."
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">
            What topics would you like to learn? What would be helpful for your next session?
          </span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className={`${inputClass} min-h-40 resize-y leading-relaxed`}
            placeholder="e.g. Ordering at a restaurant, reviewing 을/를 vs 이/가, K-drama phrases…"
            maxLength={MAX_LENGTH}
          />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-stone-400">
            {content.length}/{MAX_LENGTH}
            {updatedAt && ` · Last saved ${formatTimestamp(updatedAt, "en")}`}
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
    </SectionCard>
  );
}
