import Link from "next/link";
import { buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-semibold text-brand-600">404</p>
      <h1 className="text-2xl font-bold text-stone-900">Page not found</h1>
      <Link href="/" className={buttonClass.secondary}>
        Go home
      </Link>
    </main>
  );
}
