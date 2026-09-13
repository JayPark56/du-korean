import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import SignupForm from "./SignupForm";

export const metadata: Metadata = { title: "Sign up · DU Korean Program" };

export default function SignupPage() {
  return (
    <AuthShell
      wide
      title="Create your account"
      subtitle="Join the DU Korean Program."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-brand-700 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <div className="mb-6 divide-y divide-brand-100 rounded-xl bg-brand-50 px-4 py-2 text-[15px] leading-relaxed text-stone-700">
        <div className="py-3">
          <h2 className="mb-1 text-sm font-semibold text-brand-700">Why an account?</h2>
          <p>This account is just so I can keep track of your schedule and lesson preferences.</p>
        </div>
        <div className="py-3">
          <h2 className="mb-1 text-sm font-semibold text-brand-700">Your password is private</h2>
          <p>
            I won&apos;t be able to see your password or any login details, so feel free to pick
            something simple and easy to remember!
          </p>
        </div>
      </div>
      <SignupForm />
    </AuthShell>
  );
}
