"use client";

import { useRef, useState, type ChangeEvent } from "react";
import Avatar from "@/components/Avatar";
import { Spinner, buttonClass } from "@/components/ui";
import type { PendingAvatar } from "@/lib/avatar";
import { blobToDataUrl, toSquareJpeg } from "@/lib/image";
import type { Locale } from "@/lib/schedule";

const MAX_PHOTO_BYTES = 15 * 1024 * 1024; // before cropping/compression

const TEXT = {
  en: {
    upload: "Upload photo",
    change: "Change photo",
    remove: "Remove",
    undo: "Undo",
    hint: "JPG, PNG, or WebP. Cropped to a square.",
    pending: "Not saved yet. Click Save to apply.",
    notImage: "Please choose an image file.",
    tooLarge: "That image is too large (max 15 MB).",
  },
  ko: {
    upload: "사진 올리기",
    change: "사진 변경",
    remove: "삭제",
    undo: "되돌리기",
    hint: "JPG, PNG, WebP · 정사각형으로 잘려요",
    pending: "아직 저장되지 않았어요. 저장을 눌러 적용하세요.",
    notImage: "이미지 파일을 선택해 주세요.",
    tooLarge: "이미지가 너무 큽니다 (최대 15MB).",
  },
} satisfies Record<Locale, Record<string, string>>;

/**
 * Round profile photo with change / remove / undo. Nothing is uploaded here:
 * the choice is reported through `onPendingChange` and applied by the parent's Save.
 */
export default function AvatarEditor({
  name,
  savedPath,
  pending,
  onPendingChange,
  busy = false,
  locale = "en",
  avatarClassName = "size-20 text-2xl sm:size-24",
}: {
  name: string;
  savedPath: string | null;
  pending: PendingAvatar;
  onPendingChange: (pending: PendingAvatar) => void;
  /** Parent is saving; disables the controls and shows a spinner. */
  busy?: boolean;
  locale?: Locale;
  avatarClassName?: string;
}) {
  const t = TEXT[locale];
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const hasPhoto = pending?.kind === "upload" || (pending?.kind !== "remove" && Boolean(savedPath));
  const disabled = busy || processing;

  async function onPhotoChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow choosing the same file again
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) return setError(t.notImage);
    if (file.size > MAX_PHOTO_BYTES) return setError(t.tooLarge);

    setProcessing(true);
    try {
      const photo = await toSquareJpeg(file);
      onPendingChange({ kind: "upload", photo, previewUrl: await blobToDataUrl(photo) });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0">
        <Avatar
          name={name}
          path={pending?.kind === "remove" ? null : savedPath}
          src={pending?.kind === "upload" ? pending.previewUrl : null}
          className={avatarClassName}
        />
        {disabled && (
          <div className="absolute inset-0 grid place-items-center rounded-full bg-white/70">
            <Spinner className="size-6 text-brand-600" />
          </div>
        )}
      </div>
      <div className="min-w-0 space-y-2">
        <p className="truncate font-semibold text-stone-900">{name}</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={disabled}
            className={buttonClass.secondary}
          >
            {hasPhoto ? t.change : t.upload}
          </button>
          {hasPhoto && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                onPendingChange(savedPath ? { kind: "remove" } : null);
              }}
              disabled={disabled}
              className={buttonClass.ghost}
            >
              {t.remove}
            </button>
          )}
          {pending && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                onPendingChange(null);
              }}
              disabled={disabled}
              className={buttonClass.ghost}
            >
              {t.undo}
            </button>
          )}
        </div>
        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : pending ? (
          <p className="text-xs font-medium text-amber-600">{t.pending}</p>
        ) : (
          <p className="text-xs text-stone-400">{t.hint}</p>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onPhotoChosen}
          className="hidden"
        />
      </div>
    </div>
  );
}
