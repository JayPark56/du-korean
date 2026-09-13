import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Log in · DU Korean Program" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  // Only allow same-site relative redirects.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to manage your Korean lessons."
      footer={
        <>
          New here?{" "}
          <Link href="/signup" className="font-semibold text-brand-700 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm next={safeNext} initialError={error} />
    </AuthShell>
  );
}
