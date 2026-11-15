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

  const {
    user,
    role,
    displayName,
    organisationName,
    dashboardRoute,
    signIn,
    signOut,
    loading: authLoading,
  } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showDemoOptions, setShowDemoOptions] = useState(false);

  const emailId = useId();
  const passwordId = useId();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const { dashboardRoute: targetRoute } = await signIn(email, password);
      if (redirectUrl) {
        router.push(redirectUrl);
      } else {
        router.push(targetRoute);
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

  // If already authenticated, show smart fast-track card
  if (user && !authLoading) {
    const roleBadgeText =
      role === "super_admin"
        ? "Platform Super Administrator"
        : role === "tenant_admin"
        ? `Organisation Admin · ${organisationName || "Institution Management"}`
        : `Counter Staff · ${organisationName || "Counter Operations"}`;

    return (
      <div className="w-full max-w-md rounded-3xl bg-white p-8 sm:p-10 shadow-xl border border-line-strong text-ink text-center">
        <div className="mb-4 flex justify-center">
          <Logo size="lg" variant="dark" />
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-mint text-forest text-xs font-bold mb-3">
          <span className="w-2 h-2 rounded-full bg-forest animate-pulse" />
          <span>Active Session Detected</span>
        </div>

        <h1 className="text-2xl font-black text-ink tracking-tight">
          Welcome back, {displayName}
        </h1>
        <p className="text-xs text-soft mt-1 font-mono">{user.email}</p>

        <div className="my-5 p-3.5 rounded-2xl bg-surface-sunken border border-line text-xs font-semibold text-ink">
          {roleBadgeText}
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => router.push(redirectUrl || dashboardRoute)}
            className="w-full py-3.5 px-6 rounded-full bg-forest hover:bg-forest-dark text-white font-extrabold text-sm shadow-md transition cursor-pointer"
          >
            Go to Your Dashboard →
          </button>

          <button
            type="button"
            onClick={async () => {
              await signOut();
            }}
            className="w-full py-2.5 px-6 rounded-full border border-line text-xs font-bold text-soft hover:text-ink hover:bg-surface-sunken transition cursor-pointer"
          >
            Sign In with Another Account
          </button>
        </div>

        <div className="mt-8 pt-4 border-t border-line text-center">
          <Link
            href="/"
            className="text-xs font-semibold text-soft hover:text-ink transition underline underline-offset-4"
          >
            ← Return to Public Queues
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-3xl bg-white p-8 sm:p-10 shadow-xl border border-line-strong text-ink">
      {/* Platform Portal Header */}
      <div className="text-center mb-8 flex flex-col items-center">
        <div className="mb-4">
          <Logo size="lg" variant="dark" />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-widest text-forest">
          Staff & Operations Portal
        </span>
        <h1 className="text-2xl font-black text-ink tracking-tight mt-1">
          Authorized Sign In
        </h1>
        <p className="text-xs text-soft mt-1.5 max-w-xs mx-auto leading-relaxed">
          Access your organisation management dashboard or counter operator station.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-red-200 text-red-700 text-xs font-semibold flex items-start gap-2.5">
          <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor={emailId} className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
            Account Email Address
          </label>
          <input
            id={emailId}
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. admin@institution.cm or staff@branch.cm"
            className="w-full px-4 py-3 rounded-xl bg-white border border-line-strong text-ink text-sm font-medium focus:border-forest focus:ring-4 focus:ring-forest/15 focus:outline-none transition"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor={passwordId} className="block text-xs font-bold uppercase tracking-wider text-ink">
              Password
            </label>
            <Link
              href="/setup-account"
              className="text-[11px] font-semibold text-forest hover:underline"
            >
              Have a setup token?
            </Link>
          </div>
          <input
            id={passwordId}
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            className="w-full px-4 py-3 rounded-xl bg-white border border-line-strong text-ink text-sm font-medium focus:border-forest focus:ring-4 focus:ring-forest/15 focus:outline-none transition"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || authLoading}
          className="w-full mt-2 py-3.5 px-6 rounded-full bg-forest hover:bg-forest-dark active:scale-[0.99] text-white font-extrabold text-sm shadow-md transition disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
        >
          {submitting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Authenticating...</span>
            </>
          ) : (
            <span>Sign In to Dashboard →</span>
          )}
        </button>
      </form>

      {/* Role Access Information Box */}
      <div className="mt-6 p-4 rounded-2xl bg-surface-sunken border border-line text-left text-xs space-y-2">
        <div className="flex items-start gap-2">
          <span className="font-bold text-forest">🏢 Organisation Admins:</span>
          <span className="text-soft">Manage service desks, configure branches, and provision counter staff.</span>
        </div>
        <div className="flex items-start gap-2 pt-1 border-t border-line">
          <span className="font-bold text-forest">💻 Counter Staff:</span>
          <span className="text-soft">Call next visitors, serve tickets, and manage physical counter flow.</span>
        </div>
      </div>

      {/* Collapsible Demo Section */}
      <div className="mt-6 pt-4 border-t border-line text-center">
        <button
          type="button"
          onClick={() => setShowDemoOptions(!showDemoOptions)}
          className="text-[11px] font-semibold text-soft hover:text-ink transition flex items-center justify-center gap-1 mx-auto"
        >
          <span>Evaluation Sandbox Credentials</span>
          <span>{showDemoOptions ? "▲" : "▼"}</span>
        </button>

        {showDemoOptions && (
          <div className="mt-3 flex flex-col sm:flex-row gap-2 justify-center">
            <button
              type="button"
              onClick={() => fillCredentials("admin@ubuea.cm", "AdminPassword2026!")}
              className="px-3 py-1.5 rounded-xl bg-mint border border-line-strong text-forest-dark text-xs font-bold hover:bg-[#bbf7d0] transition cursor-pointer"
            >
              Fill Admin (University)
            </button>
            <button
              type="button"
              onClick={() => fillCredentials("staff@ubuea.cm", "StaffPassword2026!")}
              className="px-3 py-1.5 rounded-xl bg-mint border border-line-strong text-forest-dark text-xs font-bold hover:bg-[#bbf7d0] transition cursor-pointer"
            >
              Fill Staff (Counter Op)
            </button>
          </div>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-line text-center space-y-2">
        <p className="text-xs text-soft">
          Need virtual queues for your facility?
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/register-organisation"
            className="text-xs font-bold text-forest hover:underline underline-offset-4"
          >
            Register Organisation →
          </Link>
          <span className="text-soft text-xs">•</span>
          <Link
            href="/register-organisation/status"
            className="text-xs font-semibold text-soft hover:text-ink underline underline-offset-4"
          >
            Track Application
          </Link>
        </div>
      </div>

      <div className="mt-4 text-center">
        <Link
          href="/"
          className="text-xs font-semibold text-soft hover:text-ink transition underline underline-offset-4"
        >
          ← Return to Public Queues
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#f3f6f5] flex flex-col justify-between p-6 selection:bg-mint selection:text-forest-dark">
      <header className="max-w-7xl mx-auto w-full flex items-center justify-between py-2">
        <Logo size="md" variant="dark" />
        <Link
          href="/"
          className="text-xs font-bold text-soft hover:text-ink transition"
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
        <span>Krenox Virtual Queue Platform · Enterprise Multi-Tenant Access</span>
      </footer>
    </main>
  );
}
