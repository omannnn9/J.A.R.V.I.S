"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { setRememberMe } from "@/lib/supabase/storage";
import { useAuth } from "@/lib/auth/AuthProvider";
import { AuthShell, FieldInput, SubmitButton, useShake } from "@/components/auth/AuthShell";

export default function LoginPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const { shake, trigger } = useShake();

  useEffect(() => {
    if (!authLoading && session) router.replace("/");
  }, [authLoading, session, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Enter your email and password");
      trigger();
      return;
    }
    setLoading(true);
    setRememberMe(remember);
    const supabase = getSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      trigger();
      return;
    }
    router.replace("/");
  }

  async function handleForgotPassword() {
    if (!email) {
      setError("Enter your email above first");
      trigger();
      return;
    }
    const supabase = getSupabaseBrowserClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/login` : undefined,
    });
    if (resetError) {
      setError(resetError.message);
      trigger();
    } else {
      setResetSent(true);
    }
  }

  return (
    <AuthShell subtitle="Sign In" hint="Free, forever — no plans, no subscriptions.">
      <form onSubmit={handleSubmit} className={shake ? "animate-shake" : ""}>
        <FieldInput
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <FieldInput
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />

        <div className="mb-4 flex items-center justify-between text-[12px]">
          <label className="flex cursor-pointer items-center gap-2 text-[var(--muted)]">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--accent)]"
            />
            Remember me
          </label>
          <button
            type="button"
            onClick={handleForgotPassword}
            className="text-[var(--accent)] hover:opacity-80"
          >
            Forgot password?
          </button>
        </div>

        {resetSent && (
          <p className="mb-3 text-[12px] text-[var(--green)]">Password reset email sent.</p>
        )}
        <div className="mb-3.5 min-h-[18px] text-[12px] text-[var(--red)]">{error}</div>

        <SubmitButton type="submit" loading={loading}>
          SIGN IN
        </SubmitButton>
      </form>

      <p className="mt-6 text-[12px] text-[var(--muted)]">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-[var(--accent)] hover:opacity-80">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
