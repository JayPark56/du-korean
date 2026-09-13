import type { ReactNode } from "react";
import Navbar from "@/components/Navbar";
import { requireStudent } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const profile = await requireStudent();

  return (
    <>
      <Navbar
        homeHref="/dashboard"
        user={{ id: profile.id, name: profile.name, avatarPath: profile.avatar_url, bio: profile.bio }}
        profileHref="#profile"
        logoutLabel="Log out"
        links={[
          // In-page tabs (see DashboardTabs); the first is the default.
          { href: "#schedule", label: "Schedule" },
          { href: "#requests", label: "Lesson Requests" },
          { href: "#profile", label: "My Profile" },
        ]}
      />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </>
  );
}
