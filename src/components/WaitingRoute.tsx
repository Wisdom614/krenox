"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import WaitingExperience from "@/components/WaitingExperience";
import { Eyebrow, Logo, buttonClass } from "@/components/ui";
import { useStoredTicket } from "@/lib/queue";

export default function WaitingRoute() {
  const searchParams = useSearchParams();
  const ticketIdFromUrl = searchParams.get("ticketId");
  const storedTicket = useStoredTicket();

  if (storedTicket === undefined && !ticketIdFromUrl) {
    return <main className="min-h-screen bg-canvas" aria-busy="true" />;
  }

  // If no ticket is found in URL and no ticket is stored locally
  if (!storedTicket && !ticketIdFromUrl) {
    return (
      <main className="min-h-screen bg-canvas text-ink flex flex-col justify-between">
        <header className="border-b border-line bg-canvas/80 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4 sm:px-8">
            <Logo />
          </div>
        </header>
        <section className="mx-auto grid max-w-md place-items-center px-6 py-20 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-sunken border border-line text-soft mb-4">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
          </div>
          <p className="text-xs font-semibold text-soft uppercase tracking-wider">No Active Ticket Found</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">
            You are not in a queue yet.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            Join an active service queue from your phone to receive a digital pass, live wait tracking, and real-time arrival notifications.
          </p>
          <Link href="/" className={buttonClass("primary", "mt-7")}>
            View Available Queues →
          </Link>
        </section>
        <footer className="border-t border-line py-6 text-center text-xs text-ink-subtle">
          Krenox Multi-Tenant Virtual Queue Dispatch
        </footer>
      </main>
    );
  }

  return (
    <WaitingExperience
      ticket={storedTicket || undefined}
      ticketId={ticketIdFromUrl || undefined}
    />
  );
}
