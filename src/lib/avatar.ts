import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/config";
import type { Database } from "@/lib/types";

export const AVATAR_BUCKET = "avatars";

/** A photo change picked in the UI but not saved yet. `previewUrl` is a data: URL. */
export type PendingAvatar = { kind: "upload"; photo: Blob; previewUrl: string } | { kind: "remove" } | null;

type Client = SupabaseClient<Database>;
type UserUpdate = Database["public"]["Tables"]["users"]["Update"];

/** Public URL for a path stored in users.avatar_url. */
export function avatarPublicUrl(path: string) {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/${encoded}`;
}

/** "Alice Kim" → "AK", "박재" → "박", "" → "?" */
export function initialsFor(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = [...words[0]][0] ?? "";
  const last = words.length > 1 ? ([...words[words.length - 1]][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Best-effort delete; a leftover file is harmless. */
async function removeAvatarFile(supabase: Client, path: string | null) {
  if (!path) return;
  try {
    await supabase.storage.from(AVATAR_BUCKET).remove([path]);
  } catch {
    // ignore
  }
}

/**
 * Saves profile fields and a pending photo change with a single row update.
 * Uploads the new photo first, rolls the upload back if the update fails,
 * and deletes the replaced photo afterwards. Returns the avatar path now stored.
 */
export async function saveProfile(
  supabase: Client,
  userId: string,
  fields: UserUpdate,
  currentPath: string | null,
  pending: PendingAvatar,
): Promise<string | null> {
  const update: UserUpdate = { ...fields };
  let uploadedPath: string | null = null;

  if (pending?.kind === "upload") {
    uploadedPath = `${userId}/${Date.now()}.jpg`; // new name each time, so caches never show an old photo
    const { error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(uploadedPath, pending.photo, { contentType: "image/jpeg", cacheControl: "3600", upsert: false });
    if (error) throw new Error(error.message);
    update.avatar_url = uploadedPath;
  } else if (pending?.kind === "remove") {
    update.avatar_url = null;
  }

  const { error } = await supabase.from("users").update(update).eq("id", userId);
  if (error) {
    await removeAvatarFile(supabase, uploadedPath);
    throw new Error(error.message);
  }

  if (!pending) return currentPath;
  await removeAvatarFile(supabase, currentPath);
  return uploadedPath;
}
