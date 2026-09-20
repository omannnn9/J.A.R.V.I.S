"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { setRememberMe } from "@/lib/supabase/storage";
import { useAuth } from "@/lib/auth/AuthProvider";
import { AuthShell, FieldInput, SubmitButton, useShake } from "@/components/auth/AuthShell";

export default function SignupPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkEmail, setCheckEmail] = useState(false);
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
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      trigger();
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match");
      trigger();
      return;
    }
    setLoading(true);
    setRememberMe(true);
    const supabase = getSupabaseBrowserClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name || "Sir" },
        emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/` : undefined,
      },
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      trigger();
      return;
    }
    if (data.session) {
      router.replace("/");
    } else {
      setCheckEmail(true);
    }
  }

  if (checkEmail) {
    return (
      <AuthShell subtitle="Almost there">
        <p className="text-[13px] leading-relaxed text-[var(--text)]">
          We sent a confirmation link to <strong>{email}</strong>. Open it to activate your
          account, then sign in.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-[12px] font-semibold text-[var(--accent)] hover:opacity-80"
        >
          Back to sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell subtitle="Create Account" hint="Free, forever — no plans, no subscriptions.">
      <form onSubmit={handleSubmit} className={shake ? "animate-shake" : ""}>
        <FieldInput
          id="name"
          label="Your name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What should JARVIS call you?"
        />
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
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
        />
        <FieldInput
          id="confirm"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
        />

        <div className="mb-3.5 min-h-[18px] text-[12px] text-[var(--red)]">{error}</div>

        <SubmitButton type="submit" loading={loading}>
          CREATE ACCOUNT
        </SubmitButton>
      </form>

      <p className="mt-6 text-[12px] text-[var(--muted)]">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-[var(--accent)] hover:opacity-80">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
