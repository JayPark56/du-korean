"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import Avatar from "@/components/Avatar";
import ProfileModal from "@/components/ProfileModal";
import type { Locale } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "./ui";

type NavLink = { href: string; label: string };
export type NavUser = { id: string; name: string; avatarPath: string | null; bio: string };

export default function Navbar({
  homeHref,
  links,
  user,
  logoutLabel,
  badge,
  profileHref,
  locale = "en",
}: {
  homeHref: string;
  links: NavLink[];
  user: NavUser;
  logoutLabel: string;
  badge?: string;
  /** Where the avatar/name links to. Without it, clicking opens the profile modal. */
  profileHref?: string;
  locale?: Locale;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);
  // Edits made in the modal show up immediately, before the server props refresh.
  const [avatarOverride, setAvatarOverride] = useState<string | null | undefined>(undefined);
  const [bio, setBio] = useState(user.bio);
  const avatarPath = avatarOverride === undefined ? user.avatarPath : avatarOverride;

  async function signOut() {
    setSigningOut(true);
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  function closeProfile() {
    setProfileOpen(false);
    // Return focus like a native dialog close would. Wait a frame: while the modal
    // is still mounted, everything outside it is inert and can't take focus.
    requestAnimationFrame(() => profileTriggerRef.current?.focus());
  }

  const isActive = (href: string) => {
    const path = href.split("#")[0];
    if (href.includes("#")) return false;
    return path === homeHref ? pathname === path : pathname.startsWith(path);
  };

  const profileLabel = locale === "ko" ? "내 프로필 수정" : "My profile";
  const profileTriggerClass =
    "flex items-center gap-2 rounded-full p-0.5 transition hover:bg-stone-100 sm:pr-3";
  const profileTriggerContent = (
    <>
      <Avatar name={user.name} path={avatarPath} className="size-8 text-xs" />
      <span className="hidden max-w-40 truncate text-sm font-medium text-stone-700 sm:inline">
        {user.name}
      </span>
    </>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href={homeHref} className="flex shrink-0 items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            한
          </span>
          <span className="text-[15px] font-bold tracking-tight text-stone-900">
            DU Korean Program
          </span>
          {badge && (
            <span className="hidden rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 sm:inline">
              {badge}
            </span>
          )}
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive(link.href)
                  ? "bg-brand-50 text-brand-700"
                  : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {profileHref ? (
            <Link href={profileHref} title={profileLabel} className={profileTriggerClass}>
              {profileTriggerContent}
            </Link>
          ) : (
            <button
              ref={profileTriggerRef}
              type="button"
              onClick={() => setProfileOpen(true)}
              title={profileLabel}
              aria-haspopup="dialog"
              aria-expanded={profileOpen}
              className={profileTriggerClass}
            >
              {profileTriggerContent}
            </button>
          )}
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="inline-flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50 hover:text-stone-900 disabled:opacity-50"
          >
            {signingOut && <Spinner className="size-3.5" />}
            {logoutLabel}
          </button>
        </div>
      </div>

      {/* Mobile: links in a scrollable row under the header */}
      <nav className="flex gap-1 overflow-x-auto border-t border-stone-100 px-3 py-1.5 md:hidden">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              isActive(link.href) ? "bg-brand-50 text-brand-700" : "text-stone-600 hover:bg-stone-100"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      {profileOpen && (
        <ProfileModal
          userId={user.id}
          name={user.name}
          avatarPath={avatarPath}
          onAvatarChange={(path) => {
            setAvatarOverride(path);
            router.refresh();
          }}
          savedBio={bio}
          onBioSaved={setBio}
          onClose={closeProfile}
        />
      )}
    </header>
  );
}
