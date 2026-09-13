"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Spinner, buttonClass, inputClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD = 6;

export default function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return setError("Please enter your name.");
    if (password.length < MIN_PASSWORD) {
      return setError(`Password must be at least ${MIN_PASSWORD} characters.`);
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error } = await createClient().auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { name: name.trim() },
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      });
      if (error) {
        setError(
          /already registered/i.test(error.message)
            ? "An account with this email already exists. Try logging in."
            : error.message,
        );
        setLoading(false);
        return;
      }
      // With "Confirm email" disabled in Supabase, a session comes back immediately.
      if (data.session) {
        router.replace("/");
        router.refresh();
        return;
      }
      setNeedsConfirmation(true);
      setLoading(false);
    } catch {
      setError("Could not reach the server. Please try again.");
      setLoading(false);
    }
  }

  if (needsConfirmation) {
    return (
      <div className="rounded-xl bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-800">
        <p className="font-semibold">Check your inbox</p>
        <p className="mt-1">
          We sent a confirmation link to <strong>{email}</strong>. Click it to activate your
          account, then log in.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-stone-700">Name</span>
        <input
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          placeholder="Your full name"
          maxLength={80}
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-stone-700">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          placeholder="koreanisfun@du.edu"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-stone-700">Password</span>
        <input
          type="password"
          required
          autoComplete="new-password"
          minLength={MIN_PASSWORD}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
        <span className="mt-1 block text-xs text-stone-400">At least {MIN_PASSWORD} characters</span>
      </label>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button type="submit" disabled={loading} className={`${buttonClass.primary} w-full`}>
        {loading && <Spinner />}
        Sign up
      </button>
    </form>
  );
}
