"use client";

import { useState, useEffect, useId, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { fetchSetupInfo, completeAccountSetup, SetupInfo } from "@/lib/api";

function SetupAccountForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlToken = searchParams.get("ref") || searchParams.get("token") || "";

  const { signIn } = useAuth();

  const [tokenInput, setTokenInput] = useState(urlToken);
  const [activeToken, setActiveToken] = useState(urlToken);
  const [setupInfo, setSetupInfo] = useState<SetupInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [setupSuccess, setSetupSuccess] = useState(false);

  const emailId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();
  const manualTokenId = useId();

  // Load setup metadata whenever activeToken changes
  useEffect(() => {
    if (!activeToken) return;
    let active = true;
    setLoadingInfo(true);
    setInfoError(null);

    fetchSetupInfo(activeToken)
      .then((data) => {
        if (active) {
          setSetupInfo(data);
          if (data.suggested_email) {
            setEmail(data.suggested_email);
          }
          setLoadingInfo(false);
        }
      })
      .catch((err) => {
        if (active) {
          setInfoError(err instanceof Error ? err.message : "Invalid or expired setup token.");
          setSetupInfo(null);
          setLoadingInfo(false);
        }
      });

    return () => {
      active = false;
    };
  }, [activeToken]);

  function handleManualTokenSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    setActiveToken(tokenInput.trim());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!setupInfo || !activeToken) {
      setSubmitError("No active setup session found.");
      return;
    }

    if (!email.trim() || !email.includes("@")) {
      setSubmitError("Please enter a valid administrator email address.");
      return;
    }

    if (password.length < 8) {
      setSubmitError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError("Passwords do not match. Please re-enter.");
      return;
    }

    setSubmitting(true);

    try {
      await completeAccountSetup({
        token: activeToken,
        email: email.trim(),
        password,
      });

      setSetupSuccess(true);

      // Attempt automatic sign in
      try {
        await signIn(email.trim(), password);
        setTimeout(() => {
          router.push("/admin");
        }, 1500);
      } catch (authErr) {
        console.error("Auto sign-in notice:", authErr);
        setTimeout(() => {
          router.push(`/login?email=${encodeURIComponent(email)}&setup=complete`);
        }, 2000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Account setup failed. Please try again.";
      setSubmitError(msg);
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-lg rounded-3xl bg-white p-8 sm:p-10 shadow-xl border border-line-strong text-ink">
      {/* Header Badge */}
      <div className="text-center mb-8">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-forest text-white flex items-center justify-center shadow-md mb-3">
          <span className="font-display font-black text-2xl">K</span>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-widest text-forest">
          Tenant Onboarding
        </span>
        <h1 className="text-2xl font-black text-ink tracking-tight mt-1">
          Administrator Account Setup
        </h1>
        <p className="text-xs text-soft mt-1">
          Configure your login credentials to access your organization dashboard.
        </p>
      </div>

      {/* Case 1: No token provided yet */}
      {!activeToken && (
        <form onSubmit={handleManualTokenSubmit} className="space-y-4">
          <div className="p-4 rounded-2xl bg-surface-sunken border border-line text-xs">
            <p className="font-bold text-ink mb-1">Enter your setup token</p>
            <p className="text-soft">
              Please paste the one-time activation token dispatched to your verified email or WhatsApp.
            </p>
          </div>

          <div>
            <label htmlFor={manualTokenId} className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
              Setup Token
            </label>
            <input
              id={manualTokenId}
              type="text"
              required
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="e.g. krn_setup_..."
              className="w-full px-4 py-3 rounded-xl bg-white border border-line-strong text-ink font-mono text-xs focus:border-brand focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 rounded-full bg-forest hover:bg-forest-dark text-white font-bold text-xs shadow-md transition"
          >
            Validate Setup Token →
          </button>
        </form>
      )}

      {/* Case 2: Loading info */}
      {activeToken && loadingInfo && (
        <div className="py-12 text-center text-xs text-soft space-y-2">
          <div className="w-6 h-6 border-2 border-forest border-t-transparent rounded-full animate-spin mx-auto" />
          <p>Verifying your organization token...</p>
        </div>
      )}

      {/* Case 3: Token Invalid or Expired */}
      {activeToken && infoError && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-rose-50 border border-danger/30 text-danger text-xs font-semibold">
            <p className="font-bold mb-0.5">Token Verification Error</p>
            <p>{infoError}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveToken("");
              setTokenInput("");
            }}
            className="w-full py-2.5 px-4 rounded-full bg-surface-sunken border border-line-strong text-ink text-xs font-bold hover:bg-white transition"
          >
            Enter a different token
          </button>
        </div>
      )}

      {/* Case 4: Setup Successful */}
      {setupSuccess && (
        <div className="py-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl font-black mx-auto">
            ✓
          </div>
          <h2 className="text-xl font-extrabold text-ink">Account Configured!</h2>
          <p className="text-xs text-soft max-w-sm mx-auto leading-relaxed">
            Your administrator credentials have been created. We are redirecting you to your Krenox Operations Dashboard...
          </p>
          <div className="pt-2">
            <Link
              href="/admin"
              className="inline-block py-2.5 px-6 rounded-full bg-forest text-white font-bold text-xs shadow-md"
            >
              Open Operations Dashboard →
            </Link>
          </div>
        </div>
      )}

      {/* Case 5: Setup Form */}
      {activeToken && setupInfo && !setupSuccess && (
        <div className="space-y-6">
          {/* Tenant Verified Callout */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-emerald-900 text-sm">{setupInfo.organisation_name}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                Approved Tenant
              </span>
            </div>
            <p className="text-emerald-800/80">
              Contact: {setupInfo.contact_name} ({setupInfo.contact_channel}: {setupInfo.masked_contact})
            </p>
            <p className="text-[11px] text-emerald-700 mt-1 font-mono">
              Reference: {setupInfo.registration_ref} • Location: {setupInfo.location}
            </p>
          </div>

          {submitError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-danger/30 text-danger text-xs font-semibold">
              {submitError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor={emailId} className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                Administrator Login Email
              </label>
              <input
                id={emailId}
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. director@hospital.cm"
                className="w-full px-4 py-3 rounded-xl bg-white border border-line-strong text-ink text-xs font-semibold focus:border-brand focus:outline-none"
              />
              <p className="text-[11px] text-soft mt-1">
                You will use this email address to sign into the Krenox Operations Portal.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor={passwordId} className="block text-xs font-bold uppercase tracking-wider text-ink">
                  Administrator Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] font-semibold text-soft hover:text-ink transition"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <input
                id={passwordId}
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full px-4 py-3 rounded-xl bg-white border border-line-strong text-ink text-xs font-medium focus:border-brand focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor={confirmPasswordId} className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                Confirm Password
              </label>
              <input
                id={confirmPasswordId}
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-type password"
                className="w-full px-4 py-3 rounded-xl bg-white border border-line-strong text-ink text-xs font-medium focus:border-brand focus:outline-none"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-4 rounded-full bg-forest hover:bg-forest-dark text-white font-bold text-xs disabled:opacity-50 shadow-md transition flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Configuring Account...</span>
                  </>
                ) : (
                  <span>Complete Setup & Access Console →</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Footer Return Link */}
      <div className="mt-8 pt-4 border-t border-line text-center">
        <Link
          href="/login"
          className="text-xs font-semibold text-soft hover:text-ink transition underline underline-offset-4"
        >
          Already set up? Return to Portal Login
        </Link>
      </div>
    </div>
  );
}

export default function SetupAccountPage() {
  return (
    <main className="min-h-screen bg-[#f3f6f5] flex flex-col justify-between p-6">
      <header className="max-w-7xl mx-auto w-full flex items-center justify-between py-2">
        <Logo size="md" variant="dark" />
        <Link
          href="/"
          className="text-xs font-semibold text-soft hover:text-ink transition underline underline-offset-4"
        >
          Public Queue ↗
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center py-10">
        <Suspense fallback={<div className="text-xs text-soft font-semibold">Loading setup portal...</div>}>
          <SetupAccountForm />
        </Suspense>
      </div>

      <footer className="text-center text-xs text-soft py-4">
        <span>Krenox Virtual Queue Platform · Enterprise Onboarding & Setup</span>
      </footer>
    </main>
  );
}

