import type { ReactNode } from "react";
import Navbar from "@/components/Navbar";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const profile = await requireAdmin();

  return (
    <div lang="ko">
      <Navbar
        homeHref="/admin"
        user={{ id: profile.id, name: profile.name, avatarPath: profile.avatar_url, bio: profile.bio }}
        locale="ko"
        logoutLabel="로그아웃"
        badge="관리자"
        links={[
          { href: "/admin", label: "학생 목록" },
          { href: "/admin/schedule", label: "스케줄 관리" },
          { href: "/admin/requests", label: "수업 요청" },
        ]}
      />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
