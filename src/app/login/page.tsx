"use client";

import { useState, useId, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect");

  const { signIn, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const emailId = useId();
  const passwordId = useId();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const { role } = await signIn(email, password);
      if (redirectUrl) {
        router.push(redirectUrl);
      } else if (role === "admin") {
        router.push("/admin");
      } else {
        router.push("/staff");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      setError(msg);
      setSubmitting(false);
    }
  }

  function fillCredentials(demoEmail: string, demoPass: string) {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  }

  return (
    <div className="w-full max-w-md rounded-3xl bg-white p-8 sm:p-10 shadow-xl border border-line-strong text-ink">
      {/* Institutional Seal & Header */}
      <div className="text-center mb-8">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-brand text-white flex items-center justify-center font-black text-xl shadow-md mb-3">
          UB
        </div>
        <span className="text-[11px] font-bold uppercase tracking-widest text-brand">
          University of Buea
        </span>
        <h1 className="text-2xl font-extrabold text-ink tracking-tight mt-1">
          Staff & Admin Portal
        </h1>
        <p className="text-xs text-soft mt-1">
          Sign in to operate service desks or manage campus virtual queues.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-danger/30 text-danger text-xs font-semibold flex items-start gap-2.5">
          <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor={emailId} className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
            Staff Email / Institutional ID
          </label>
          <input
            id={emailId}
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. staff@ubuea.cm"
            className="w-full px-4 py-3 rounded-xl bg-white border border-line-strong text-ink text-sm font-medium focus:border-brand focus:outline-none transition-colors"
          />
        </div>

        <div>
          <label htmlFor={passwordId} className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
            Password
          </label>
          <input
            id={passwordId}
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            className="w-full px-4 py-3 rounded-xl bg-white border border-line-strong text-ink text-sm font-medium focus:border-brand focus:outline-none transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || authLoading}
          className="w-full mt-2 py-3.5 px-6 rounded-full bg-brand hover:bg-brand-dark text-white font-bold text-sm shadow-md transition-all disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Verifying Credentials...</span>
            </>
          ) : (
            <span>Access Portal →</span>
          )}
        </button>
      </form>

      {/* Demo Credentials Quick-Fill Pills */}
      <div className="mt-8 pt-6 border-t border-line text-center">
        <p className="text-[11px] font-bold uppercase tracking-wider text-soft mb-2.5">
          One-Click Demo Credentials
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button
            type="button"
            onClick={() => fillCredentials("admin@ubuea.cm", "AdminPassword2026!")}
            className="px-3 py-1.5 rounded-xl bg-mint border border-line-strong text-brand text-xs font-bold hover:bg-[#dcefe9] transition-colors"
          >
            ⚡ Fill Admin (Registrar)
          </button>
          <button
            type="button"
            onClick={() => fillCredentials("staff@ubuea.cm", "StaffPassword2026!")}
            className="px-3 py-1.5 rounded-xl bg-mint border border-line-strong text-brand text-xs font-bold hover:bg-[#dcefe9] transition-colors"
          >
            ⚡ Fill Staff (Counter Op)
          </button>
        </div>
      </div>

      <div className="mt-6 text-center">
        <Link
          href="/"
          className="text-xs font-semibold text-soft hover:text-ink transition underline underline-offset-4"
        >
          ← Return to Public Student Home
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#f3f6f5] flex flex-col justify-between p-6">
      <header className="max-w-7xl mx-auto w-full flex items-center justify-between py-2">
        <Logo />
        <Link
          href="/"
          className="text-xs font-semibold text-soft hover:text-ink transition underline underline-offset-4"
        >
          Public Queue ↗
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center py-10">
        <Suspense fallback={<div className="text-xs text-soft font-semibold">Loading portal...</div>}>
          <LoginForm />
        </Suspense>
      </div>

      <footer className="text-center text-xs text-soft py-4">
        <span>Krenox Virtual Queue System · B.Tech Software Engineering Project</span>
      </footer>
    </main>
  );
}
