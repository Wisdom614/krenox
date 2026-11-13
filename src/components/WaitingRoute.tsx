"use client";

import Link from "next/link";
import WaitingExperience from "@/components/WaitingExperience";
import { Eyebrow, Logo, buttonClass } from "@/components/ui";
import { useStoredTicket } from "@/lib/queue";

export default function WaitingRoute() {
  const ticket = useStoredTicket();

  if (ticket === undefined) return <main className="min-h-screen bg-canvas" aria-busy="true" />;

  if (ticket === null) {
    return (
      <main className="min-h-screen bg-canvas text-ink">
        <header className="mx-auto max-w-3xl px-5 py-6 sm:px-8"><Logo /></header>
        <section className="mx-auto grid max-w-md place-items-center px-5 pt-20 text-center">
          <Eyebrow tone="muted">No active ticket</Eyebrow>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">You are not in a queue yet.</h1>
          <p className="mt-4 leading-7 text-muted">Join a queue to get a digital ticket. If you closed this page earlier, ticket recovery will be available in the full product.</p>
          <Link href="/" className={buttonClass("primary", "mt-8")}>Join a queue</Link>
        </section>
      </main>
    );
  }

  return <WaitingExperience ticket={ticket} />;
}
