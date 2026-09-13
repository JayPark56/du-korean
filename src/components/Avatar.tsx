"use client";

import { useState } from "react";
import { avatarPublicUrl, initialsFor } from "@/lib/avatar";

/** Round profile photo; falls back to name initials when there is no photo or it fails to load. */
export default function Avatar({
  name,
  path,
  src,
  className = "size-10 text-sm",
}: {
  name: string;
  path: string | null | undefined;
  /** Explicit image URL (e.g. an unsaved preview); takes precedence over `path`. */
  src?: string | null;
  /** Size + font size, e.g. "size-24 text-2xl". */
  className?: string;
}) {
  const [failedPath, setFailedPath] = useState<string | null>(null);
  const url = src ?? (path && path !== failedPath ? avatarPublicUrl(path) : null);

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- already a small cropped JPEG from Supabase Storage
      <img
        src={url}
        alt={`${name}'s profile photo`}
        onError={() => {
          if (!src) setFailedPath(path ?? null);
        }}
        className={`shrink-0 rounded-full bg-stone-100 object-cover ${className}`}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={name}
      className={`grid shrink-0 select-none place-items-center rounded-full bg-brand-50 font-bold text-brand-700 ${className}`}
    >
      {initialsFor(name)}
    </span>
  );
}
