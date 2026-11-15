"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import WaitingExperience from "@/components/WaitingExperience";
import { Logo } from "@/components/ui";

export default function WaitingRoute() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const ticketIdFromUrl = searchParams.get("ticketId");

  const [activeId, setActiveId] = useState<string | null>(ticketIdFromUrl);
  const [mounted, setMounted] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState("");
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  useEffect(() => {
    // Purge deprecated prototype key
    try {
      localStorage.removeItem("krenox-prototype-ticket");
    } catch {}

    if (ticketIdFromUrl) {
      setActiveId(ticketIdFromUrl);
    } else {
      try {
        const stored = localStorage.getItem("krenox_active_ticket");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.id) {
            setActiveId(parsed.id);
          }
        }
      } catch {}
    }
    setMounted(true);
  }, [ticketIdFromUrl]);

  if (!mounted) {
    return <main className="min-h-screen bg-[#f8faf9]" aria-busy="true" />;
  }

  // If no ticket identifier exists in URL or localStorage, present the recovery interface
  if (!activeId) {
    return (
      <main className="min-h-screen bg-[#f8faf9] text-ink flex flex-col justify-between selection:bg-mint selection:text-forest-dark">
        <header className="border-b border-line bg-white/90 backdrop-blur sticky top-0 z-30">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 sm:px-6 h-16">
            <Logo size="md" variant="dark" />
            <Link
              href="/"
              className="text-xs font-bold text-soft hover:text-ink transition"
            >
              ← Browse Venues
            </Link>
          </div>
        </header>

        <section className="mx-auto max-w-md w-full px-5 py-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-forest/10 text-forest mx-auto flex items-center justify-center mb-5">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
          </div>

          <span className="text-[11px] font-bold uppercase tracking-wider text-forest block mb-1">
            Ticket Retrieval
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">
            Recover Your Virtual Pass
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-soft leading-relaxed">
            Enter your 6-digit Recovery PIN, Ticket Number (e.g. <span className="font-mono font-bold text-ink">R-040</span>), or phone number to retrieve your live queue position.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const val = recoveryInput.trim();
              if (!val) {
                setRecoveryError("Please enter your PIN, ticket number, or phone.");
                return;
              }
              setActiveId(val);
              router.push(`/waiting?ticketId=${encodeURIComponent(val)}`);
            }}
            className="mt-6 space-y-3"
          >
            <input
              type="text"
              value={recoveryInput}
              onChange={(e) => {
                setRecoveryInput(e.target.value);
                setRecoveryError(null);
              }}
              placeholder="e.g. 151893 or R-040"
              className="w-full h-13 px-4 rounded-2xl border border-line-strong bg-white font-mono text-center text-lg font-black text-ink focus:border-forest focus:ring-4 focus:ring-forest/15 outline-none transition uppercase tracking-wider"
            />
            {recoveryError && (
              <p className="text-xs text-red-600 font-semibold">{recoveryError}</p>
            )}
            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-forest hover:bg-forest-dark text-white font-extrabold text-xs shadow-md transition cursor-pointer"
            >
              Retrieve Live Virtual Ticket →
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-line text-xs text-soft flex items-center justify-center gap-4">
            <Link href="/" className="hover:text-ink font-semibold transition">
              ← Return to Home
            </Link>
          </div>
        </section>

        <footer className="border-t border-line py-5 text-center text-xs text-soft">
          Krenox Multi-Tenant Virtual Queue Dispatch
        </footer>
      </main>
    );
  }

  return <WaitingExperience ticketId={activeId} />;
}
