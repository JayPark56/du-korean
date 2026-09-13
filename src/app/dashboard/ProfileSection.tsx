"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import AvatarEditor from "@/components/AvatarEditor";
import { SectionCard, Spinner, StatusText, buttonClass, inputClass } from "@/components/ui";
import { saveProfile, type PendingAvatar } from "@/lib/avatar";
import { createClient } from "@/lib/supabase/client";

type Status = { type: "success" | "error"; message: string } | null;

const BIO_MAX = 160;

export default function ProfileSection({
  userId,
  name,
  initialLevel,
  initialGoals,
  initialBio,
  initialAvatarPath,
}: {
  userId: string;
  name: string;
  initialLevel: string;
  initialGoals: string;
  initialBio: string;
  initialAvatarPath: string | null;
}) {
  const router = useRouter();
  const [level, setLevel] = useState(initialLevel);
  const [goals, setGoals] = useState(initialGoals);
  const [bio, setBio] = useState(initialBio);
  const [saved, setSaved] = useState({ level: initialLevel, goals: initialGoals, bio: initialBio });
  const [avatarPath, setAvatarPath] = useState(initialAvatarPath);
  const [pendingAvatar, setPendingAvatar] = useState<PendingAvatar>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const dirty =
    level !== saved.level || goals !== saved.goals || bio !== saved.bio || pendingAvatar !== null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const next = { level: level.trim(), goals: goals.trim(), bio: bio.trim() };
      const newPath = await saveProfile(
        createClient(),
        userId,
        { korean_level: next.level, goals: next.goals, bio: next.bio },
        avatarPath,
        pendingAvatar,
      );
      setLevel(next.level);
      setGoals(next.goals);
      setBio(next.bio);
      setSaved(next);
      if (pendingAvatar) {
        setAvatarPath(newPath);
        setPendingAvatar(null);
        router.refresh(); // update the photo in the navbar
      }
      setStatus({ type: "success", message: "Profile saved." });
    } catch (e) {
      setStatus({ type: "error", message: `Could not save: ${(e as Error).message}` });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      title="My Profile"
      description="Help Jay tailor your lessons. You can update these anytime."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="mb-6 border-b border-stone-100 pb-6">
          <AvatarEditor
            name={name}
            savedPath={avatarPath}
            pending={pendingAvatar}
            onPendingChange={(next) => {
              setPendingAvatar(next);
              setStatus(null);
            }}
            busy={saving}
          />
        </div>

        <label className="block">
          <span className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-medium text-stone-700">
            One-line Bio
            <span className="text-xs font-normal text-stone-400">
              {bio.length}/{BIO_MAX}
            </span>
          </span>
          <input
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className={inputClass}
            placeholder="e.g. Sophomore who loves K-dramas and tteokbokki"
            maxLength={BIO_MAX}
          />
        </label>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">Korean Level</span>
            <input
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className={inputClass}
              placeholder="e.g. TOPIK 1, A2/B1"
              maxLength={200}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">Goals</span>
            <textarea
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              className={`${inputClass} min-h-[46px] resize-y`}
              rows={2}
              placeholder="e.g. Basic conversation by summer"
              maxLength={2000}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {dirty && !saving && <span className="text-sm text-amber-600">Unsaved changes</span>}
          <StatusText status={status} />
          <button type="submit" disabled={!dirty || saving} className={buttonClass.primary}>
            {saving && <Spinner />}
            Save
          </button>
        </div>
      </form>
    </SectionCard>
  );
}
