"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import Avatar from "@/components/Avatar";
import ProfileModal from "@/components/ProfileModal";
import { selectHashTab, useHash } from "@/lib/hashTabs";
import type { Locale } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "./ui";

/** `href` is a route ("/admin") or an in-page hash tab ("#schedule"). `badge` shows a red dot. */
type NavLink = { href: string; label: string; badge?: boolean };
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
  /** Where the avatar/name goes (route or hash tab). Without it, clicking opens the profile modal. */
  profileHref?: string;
  locale?: Locale;
}) {
  const pathname = usePathname();
  const hash = useHash();
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

  // Hash tabs: the first one is active when the hash matches none of them.
  const hashTabs = links.filter((link) => link.href.startsWith("#")).map((link) => link.href);
  const activeHash = hashTabs.includes(hash) ? hash : hashTabs[0];

  const isActive = (href: string) => {
    if (href.startsWith("#")) return href === activeHash;
    return href === homeHref ? pathname === href : pathname.startsWith(href);
  };

  const renderLink = (href: string, className: string, children: ReactNode, extra?: { title?: string }) =>
    href.startsWith("#") ? (
      <a
        href={href}
        title={extra?.title}
        aria-current={isActive(href) ? "page" : undefined}
        onClick={(e) => {
          e.preventDefault();
          selectHashTab(href);
        }}
        className={className}
      >
        {children}
      </a>
    ) : (
      <Link href={href} title={extra?.title} aria-current={isActive(href) ? "page" : undefined} className={className}>
        {children}
      </Link>
    );

  // Red dot for unseen changes; hidden while that page is open. Inline styles so it
  // renders even with an outdated stylesheet.
  const linkContent = (link: NavLink) => (
    <>
      {link.label}
      {link.badge && !isActive(link.href) && (
        <span
          role="img"
          aria-label={locale === "ko" ? "새 변경사항" : "New changes"}
          data-badge=""
          style={{
            position: "absolute",
            top: 4,
            right: 2,
            width: 8,
            height: 8,
            borderRadius: 9999,
            background: "#ef4444",
            boxShadow: "0 0 0 2px #fff",
          }}
        />
      )}
    </>
  );

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
            <span key={link.href} className="contents">
              {renderLink(
                link.href,
                `relative rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive(link.href)
                    ? "bg-brand-50 text-brand-700"
                    : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                }`,
                linkContent(link),
              )}
            </span>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {profileHref ? (
            renderLink(profileHref, profileTriggerClass, profileTriggerContent, { title: profileLabel })
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
          <span key={link.href} className="contents">
            {renderLink(
              link.href,
              `relative shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                isActive(link.href) ? "bg-brand-50 text-brand-700" : "text-stone-600 hover:bg-stone-100"
              }`,
              linkContent(link),
            )}
          </span>
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
