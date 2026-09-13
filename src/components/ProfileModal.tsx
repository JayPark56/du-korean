"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import AvatarEditor from "@/components/AvatarEditor";
import { Spinner, StatusText, buttonClass, inputClass } from "@/components/ui";
import { saveProfile, type PendingAvatar } from "@/lib/avatar";
import { createClient } from "@/lib/supabase/client";

type Status = { type: "success" | "error"; message: string } | null;

const BIO_MAX = 160;

// Layout-critical dialog styles are inline (and the backdrop is a literal rule)
// so the modal is centered even if a browser still holds an older stylesheet.
const DIALOG_STYLE = {
  margin: "auto",
  padding: 0,
  width: "calc(100% - 2rem)",
  maxWidth: "28rem",
  maxHeight: "calc(100dvh - 2rem)",
} as const;
const BACKDROP_CSS =
  ".profile-modal::backdrop{background:rgba(28,25,23,.4);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}";

/**
 * Admin profile editor (photo + one-line bio). Mount it to open; unmount it to close.
 * Changes are only applied when 저장 is pressed. Every close path calls `onClose`
 * directly instead of relying on the native dialog "close" event.
 */
export default function ProfileModal({
  userId,
  name,
  avatarPath,
  onAvatarChange,
  savedBio,
  onBioSaved,
  onClose,
}: {
  userId: string;
  name: string;
  avatarPath: string | null;
  onAvatarChange: (path: string | null) => void;
  savedBio: string;
  onBioSaved: (bio: string) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [bio, setBio] = useState(savedBio);
  const [pendingAvatar, setPendingAvatar] = useState<PendingAvatar>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const dirty = bio.trim() !== savedBio || pendingAvatar !== null;

  function requestClose() {
    if (saving) return;
    if (dirty && !window.confirm("저장하지 않은 변경사항이 있습니다. 닫을까요?")) return;
    onClose();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const next = bio.trim();
      const newPath = await saveProfile(createClient(), userId, { bio: next }, avatarPath, pendingAvatar);
      if (pendingAvatar) onAvatarChange(newPath);
      setPendingAvatar(null);
      setBio(next);
      onBioSaved(next);
      setStatus({ type: "success", message: "저장되었습니다." });
    } catch (e) {
      setStatus({ type: "error", message: `저장 실패: ${(e as Error).message}` });
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      lang="ko"
      aria-labelledby="profile-modal-title"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          requestClose();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose(); // backdrop click
      }}
      style={DIALOG_STYLE}
      className="profile-modal overflow-y-auto rounded-2xl bg-white text-stone-900 shadow-2xl"
    >
      <style>{BACKDROP_CSS}</style>
      <div className="p-6 sm:p-7">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h2 id="profile-modal-title" className="text-lg font-bold tracking-tight">
            내 프로필
          </h2>
          <button
            type="button"
            onClick={requestClose}
            aria-label="닫기"
            className="grid size-8 place-items-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
          >
            ✕
          </button>
        </div>

        <AvatarEditor
          name={name}
          savedPath={avatarPath}
          pending={pendingAvatar}
          onPendingChange={(next) => {
            setPendingAvatar(next);
            setStatus(null);
          }}
          busy={saving}
          locale="ko"
          avatarClassName="size-20 text-2xl"
        />

        <form onSubmit={onSubmit} className="mt-6 space-y-4 border-t border-stone-100 pt-6">
          <label className="block">
            <span className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-medium text-stone-700">
              한 줄 자기소개
              <span className="text-xs font-normal text-stone-400">
                {bio.length}/{BIO_MAX}
              </span>
            </span>
            <input
              value={bio}
              onChange={(e) => {
                setBio(e.target.value);
                setStatus(null);
              }}
              className={inputClass}
              placeholder="예: DU에서 한국어를 가르치고 있어요"
              maxLength={BIO_MAX}
            />
          </label>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <StatusText status={status} />
            <button type="button" onClick={requestClose} disabled={saving} className={buttonClass.secondary}>
              닫기
            </button>
            <button type="submit" disabled={!dirty || saving} className={buttonClass.primary}>
              {saving && <Spinner />}
              저장
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
