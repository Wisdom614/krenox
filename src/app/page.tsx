"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Logo } from "@/components/ui";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { fetchPublicDirectory, PublicOrganisationSummary } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  const [organisations, setOrganisations] = useState<PublicOrganisationSummary[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [selectedOrgSlug, setSelectedOrgSlug] = useState<string>("");

  // Customer Express Card State
  const [customerTab, setCustomerTab] = useState<"join" | "track">("join");
  const [ticketSearchInput, setTicketSearchInput] = useState("");
  const [activeStoredTicket, setActiveStoredTicket] = useState<{ id: string; ticket_number: string } | null>(null);

  // Simulation tab interactive state
  const [simTraffic, setSimTraffic] = useState<"normal" | "peak" | "rush">("peak");

  useEffect(() => {
    fetchPublicDirectory()
      .then((orgs) => {
        setOrganisations(orgs);
        if (orgs.length > 0) {
          setSelectedOrgSlug(orgs[0].slug);
        }
      })
      .catch((err) => console.error("Failed to load organisations:", err))
      .finally(() => setLoadingOrgs(false));

    // Check localStorage for active ticket
    try {
      const stored = localStorage.getItem("krenox_active_ticket");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.id && parsed?.status === "waiting") {
          setActiveStoredTicket(parsed);
        }
      }
    } catch {
      // Ignore storage error
    }
  }, []);

  function handleTrackTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!ticketSearchInput.trim()) return;
    router.push(`/wait?ticketId=${encodeURIComponent(ticketSearchInput.trim())}`);
  }

  function handleGoToQueue() {
    if (selectedOrgSlug) {
      router.push(`/q/${selectedOrgSlug}`);
    }
  }

  // Simulation metrics data matrix
  const simMetrics = {
    normal: {
      physicalWait: "28 min",
      virtualWait: "8 min",
      reduction: "71%",
      congestion: "Low (~15 people)",
      utilization: "78%",
    },
    peak: {
      physicalWait: "65 min",
      virtualWait: "14 min",
      reduction: "78%",
      congestion: "Extreme (80+ in lobby)",
      utilization: "94%",
    },
    rush: {
      physicalWait: "110 min",
      virtualWait: "22 min",
      reduction: "80%",
      congestion: "Critical Overflow",
      utilization: "98%",
    },
  }[simTraffic];

  return (
    <main className="min-h-screen overflow-hidden bg-canvas text-ink selection:bg-mint selection:text-forest-dark">
      {/* ───────────── Multi-Tenant Platform Hero ───────────── */}
      <section className="relative isolate text-white">
        <Image
          src="/images/hero.jpg"
          alt="People waiting outdoors comfortably on their mobile phones"
          fill
          priority
          sizes="100vw"
          className="-z-20 object-cover object-[75%_center]"
        />
        {/* Deep forest gradient overlay ensuring high readability */}
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-r from-[#032522]/95 via-[#063b36]/90 to-[#063b36]/70 max-lg:from-[#032522]/95 max-lg:via-[#063b36]/95"
          aria-hidden
        />
        <div
          className="absolute inset-x-0 bottom-0 -z-10 h-36 bg-gradient-to-t from-canvas to-transparent"
          aria-hidden
        />

        {/* Dedicated Responsive Navbar Component */}
        <Navbar theme="light" />

        {/* Hero Content */}
        <div className="relative mx-auto grid min-h-[640px] max-w-7xl items-center gap-12 px-6 pb-36 pt-8 lg:min-h-[720px] lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:pb-44">
          <div>
            <h1 className="max-w-2xl font-display text-5xl font-bold leading-[1.04] tracking-tight sm:text-6xl lg:text-7xl">
              Eliminate physical lines. <span className="text-mint">Streamline customer flow.</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/85 sm:text-xl">
              Enable customers to join virtual queues remotely from their phones, receive WhatsApp arrival updates, and arrive right when their counter is ready — backed by rigorous simulation evaluation.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link
                href="/register-organisation"
                className="inline-flex items-center justify-center rounded-full bg-mint px-8 py-3.5 text-sm font-extrabold text-forest-dark shadow-[0_16px_36px_rgba(0,0,0,0.3)] transition hover:bg-[#1affb2] hover:scale-105 active:scale-95 cursor-pointer"
              >
                Register Your Organisation <span aria-hidden className="ml-2">→</span>
              </Link>
              <a
                href="#simulation"
                className="inline-flex items-center rounded-full border border-white/30 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15 active:scale-95"
              >
                See Simulation Evaluation ↓
              </a>
            </div>

            {/* Quick trust metrics */}
            <div className="mt-10 flex items-center gap-6 text-xs text-white/80">
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-mint shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
                <span>1-Hour Admin Review Target</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-mint shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
                <span>Zero App Downloads</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-mint shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
                <span>WhatsApp Arrival Alerts</span>
              </div>
            </div>
          </div>

          {/* Right Column: Customer Express Lane Card */}
          <div className="relative w-full max-w-md justify-self-start lg:justify-self-end lg:self-center">
            <div className="rounded-[2.2rem] border border-white/20 bg-surface/95 p-6 sm:p-7 text-ink shadow-[0_24px_70px_rgba(0,0,0,0.35)] backdrop-blur transition duration-300">
              <div className="border-b border-line pb-4">
                <h2 className="text-base font-bold text-ink">Visiting a Service Today?</h2>
                <p className="text-xs text-soft mt-0.5">Select a destination or track your ticket</p>
              </div>

              {/* Stored Active Ticket Banner (if present) */}
              {activeStoredTicket && (
                <div className="mt-4 p-3 rounded-2xl bg-mint-soft border border-mint/40 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-forest">Active Ticket on Device</p>
                    <p className="text-xs font-black text-ink">{activeStoredTicket.ticket_number}</p>
                  </div>
                  <Link
                    href={`/wait?ticketId=${activeStoredTicket.id}`}
                    className="px-3 py-1.5 rounded-xl bg-forest text-white text-xs font-bold hover:bg-forest-dark transition"
                  >
                    View Status →
                  </Link>
                </div>
              )}

              {/* Express Lane Tabs */}
              <div className="mt-4 grid grid-cols-2 p-1 bg-surface-sunken rounded-2xl border border-line text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setCustomerTab("join")}
                  className={`py-2 rounded-xl transition ${
                    customerTab === "join"
                      ? "bg-white text-forest shadow-xs"
                      : "text-soft hover:text-ink"
                  }`}
                >
                  Join a Queue
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerTab("track")}
                  className={`py-2 rounded-xl transition ${
                    customerTab === "track"
                      ? "bg-white text-forest shadow-xs"
                      : "text-soft hover:text-ink"
                  }`}
                >
                  Track Existing Ticket
                </button>
              </div>

              {/* Tab 1: Join Organisation Queue */}
              {customerTab === "join" ? (
                <div className="mt-5 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-ink mb-1.5">
                      Select Institution / Service Center
                    </label>
                    {loadingOrgs ? (
                      <div className="py-3 px-4 rounded-2xl bg-surface-sunken text-xs text-soft animate-pulse">
                        Loading active organisations...
                      </div>
                    ) : organisations.length === 0 ? (
                      <div className="p-3.5 rounded-2xl bg-surface-sunken border border-line text-xs text-soft">
                        <p className="font-semibold text-ink">No organisations listed yet.</p>
                        <p className="mt-1">
                          Register your institution to configure facilities, counters, and issue live digital tickets.
                        </p>
                        <Link
                          href="/register-organisation"
                          className="mt-2.5 inline-flex items-center gap-1 font-bold text-forest hover:underline"
                        >
                          Register Organisation →
                        </Link>
                      </div>
                    ) : (
                      <select
                        value={selectedOrgSlug}
                        onChange={(e) => setSelectedOrgSlug(e.target.value)}
                        className="w-full px-4 py-3 rounded-2xl border border-line bg-surface-sunken focus:bg-white focus:outline-none focus:border-forest text-xs font-bold text-ink"
                      >
                        {organisations.map((org) => (
                          <option key={org.id} value={org.slug}>
                            {org.name} ({org.category})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="p-3.5 rounded-2xl bg-forest/5 border border-line text-xs text-soft">
                    <p className="leading-relaxed">
                      Select your destination to view available service lines, open counters, and take a digital ticket from your phone.
                    </p>
                  </div>

                  <button
                    onClick={handleGoToQueue}
                    disabled={!selectedOrgSlug || organisations.length === 0}
                    className="w-full rounded-2xl bg-forest px-4 py-3.5 text-center text-xs font-extrabold text-white transition hover:bg-forest-dark active:scale-98 shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Open Service Queue Desks</span>
                    <span>→</span>
                  </button>
                </div>
              ) : (
                /* Tab 2: Track Existing Ticket */
                <form onSubmit={handleTrackTicket} className="mt-5 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-ink mb-1.5">
                      Ticket ID or Reference
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. KRX-101 or Ticket UUID"
                      value={ticketSearchInput}
                      onChange={(e) => setTicketSearchInput(e.target.value)}
                      required
                      className="w-full px-4 py-3 rounded-2xl border border-line bg-surface-sunken focus:bg-white focus:outline-none focus:border-forest text-xs font-bold text-ink"
                    />
                    <p className="text-[11px] text-soft mt-1">
                      Check your place in line and real-time wait estimate.
                    </p>
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-forest px-4 py-3.5 text-center text-xs font-extrabold text-white transition hover:bg-forest-dark active:scale-98 shadow-sm flex items-center justify-center gap-2"
                  >
                    <span>Track Ticket Status</span>
                    <span>→</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── Active Organisations Showcase ───────────── */}
      <section className="relative z-10 mx-auto -mt-20 max-w-7xl px-6 lg:px-8">
        <div className="rounded-3xl bg-white p-8 shadow-card border border-line">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-ink">
                Active Institutions on Krenox
              </h2>
            </div>
            <Link
              href="/register-organisation"
              className="text-xs font-bold text-forest hover:underline flex items-center gap-1 shrink-0"
            >
              <span>Onboard Your Facility</span>
              <span>→</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {organisations.map((org) => (
              <Link
                key={org.id}
                href={`/q/${org.slug}`}
                className="group p-5 rounded-2xl bg-surface-sunken border border-line hover:border-forest hover:bg-white transition-all shadow-2xs hover:shadow-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-soft font-semibold uppercase tracking-wider">
                    {org.category}
                  </span>
                  <span className="text-xs text-soft group-hover:text-forest transition-colors">
                    Take Ticket →
                  </span>
                </div>
                <h3 className="font-bold text-sm text-ink group-hover:text-forest transition-colors mb-1">
                  {org.name}
                </h3>
                <p className="text-xs text-soft flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-soft shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{org.location || "Central Campus / Main Location"}</span>
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── Discrete-Event Simulation & Evaluation Core (B.Tech Research) ───────────── */}
      <section id="simulation" className="mx-auto max-w-7xl px-6 py-28 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl text-ink">
            Simulation-Based Waiting-Time Evaluation
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-ink-muted">
            Krenox is engineered with an integrated discrete-event simulation component that models queue arrivals, service desks, and customer behavior under M/M/c and M/G/c stochastic conditions to prove waiting-time reduction.
          </p>

          {/* Traffic Condition Switcher */}
          <div className="mt-8 inline-flex items-center p-1 rounded-2xl bg-surface-sunken border border-line">
            {[
              { id: "normal", label: "Normal Traffic" },
              { id: "peak", label: "Peak Load (Rush Hour)" },
              { id: "rush", label: "Extreme Bottleneck" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setSimTraffic(t.id as "normal" | "peak" | "rush")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                  simTraffic === t.id
                    ? "bg-forest text-white shadow-xs"
                    : "text-soft hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Simulation Comparison Matrix */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {/* Traditional Queue Card */}
          <div className="bg-white rounded-3xl p-8 border border-line relative overflow-hidden">
            <div className="flex items-center justify-between mb-6 border-b border-line pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-red-600">
                  Conventional Baseline
                </span>
                <h3 className="text-lg font-black text-ink mt-1">Physical Lobby Queue</h3>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center border border-red-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-soft">Average Physical Wait</span>
                <span className="font-mono font-bold text-red-600 text-base">
                  {simMetrics.physicalWait}
                </span>
              </div>
              <div className="w-full bg-surface-sunken h-2 rounded-full overflow-hidden">
                <div className="bg-red-500 h-full w-[85%]" />
              </div>

              <div className="flex justify-between items-center text-sm pt-2">
                <span className="text-soft">Lobby Congestion Density</span>
                <span className="font-bold text-ink text-xs">{simMetrics.congestion}</span>
              </div>

              <div className="flex justify-between items-center text-sm pt-2">
                <span className="text-soft">Counter Idle Loss</span>
                <span className="font-bold text-amber-600 text-xs">High (Customer search delay)</span>
              </div>
            </div>

            <div className="mt-8 p-4 rounded-2xl bg-surface-sunken text-xs text-soft border border-line">
              Customers must physically stand in congested lobbies. High customer frustration, no predictive ETA, and risk of abandonment.
            </div>
          </div>

          {/* Krenox Virtual Queue Card */}
          <div className="bg-[#06262a] text-white rounded-3xl p-8 shadow-xl border border-mint/30 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-48 h-48 bg-mint/10 rounded-full blur-3xl" />

            <div className="flex items-center justify-between mb-6 border-b border-white/15 pb-4 relative z-10">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-mint">
                  Krenox Solution
                </span>
                <h3 className="text-lg font-black text-white mt-1">Virtual Distributed Queue</h3>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-mint/20 text-mint flex items-center justify-center border border-mint/30">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>

            <div className="space-y-4 relative z-10">
              <div className="flex justify-between items-center text-sm">
                <span className="text-white/80">Average Physical Wait</span>
                <div className="text-right">
                  <span className="font-mono font-black text-mint text-xl">
                    {simMetrics.virtualWait}
                  </span>
                  <span className="ml-2 text-xs font-bold text-mint">
                    (-{simMetrics.reduction})
                  </span>
                </div>
              </div>
              <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
                <div className="bg-mint h-full w-[22%]" />
              </div>

              <div className="flex justify-between items-center text-sm pt-2">
                <span className="text-white/80">Lobby Congestion</span>
                <span className="font-bold text-mint text-xs">Zero (Remote waiting anywhere)</span>
              </div>

              <div className="flex justify-between items-center text-sm pt-2">
                <span className="text-white/80">Desk Utilization Rate</span>
                <span className="font-mono font-bold text-white text-xs">{simMetrics.utilization}</span>
              </div>
            </div>

            <div className="mt-8 p-4 rounded-2xl bg-white/10 text-xs text-white/90 border border-white/10 relative z-10">
              Customers wait remotely anywhere on campus or city. Automated WhatsApp notifications summon them 2 people ahead, guaranteeing zero wasted desk time.
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── How It Works for Organisations & Customers ───────────── */}
      <section id="how-it-works" className="border-y border-line bg-surface py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl text-ink">
              How Organisations Deploy Virtual Queues
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Register & Verify",
                copy: "Submit your organisation details with email or WhatsApp. Complete instant contact verification and receive administrator approval within 1 hour.",
              },
              {
                step: "02",
                title: "Configure & Print Posters",
                copy: "Set up facilities, service categories, and staff counters. Print ready-made QR code posters to place at lobby entrances and service points.",
              },
              {
                step: "03",
                title: "Dispatch & Serve",
                copy: "Customers scan with their phones to join. Desk officers call, serve, and transfer tickets seamlessly from their staff console.",
              },
            ].map((s) => (
              <div key={s.step} className="bg-white rounded-3xl p-8 border border-line shadow-xs">
                <span className="w-12 h-12 rounded-2xl bg-forest text-mint font-mono font-black flex items-center justify-center text-lg mb-6 shadow-sm">
                  {s.step}
                </span>
                <h3 className="text-lg font-bold text-ink mb-2">{s.title}</h3>
                <p className="text-xs leading-relaxed text-soft">{s.copy}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 text-center">
            <Link
              href="/register-organisation"
              className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-forest text-white font-extrabold text-sm hover:bg-forest-dark transition shadow-md"
            >
              Start Free Organisation Onboarding →
            </Link>
          </div>
        </div>
      </section>

      {/* ───────────── Bottom Institutional Call to Action ───────────── */}
      <section className="relative isolate overflow-hidden bg-forest text-white">
        <Image
          src="/images/hero.jpg"
          alt=""
          fill
          sizes="100vw"
          className="-z-20 object-cover opacity-15"
        />
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-6 py-16 lg:flex-row lg:items-center lg:px-8">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl text-white">
              Queue less, live more.
            </h2>
            <p className="mt-2 max-w-lg text-white/80 text-sm">
              Deploy configurable virtual queuing for your university, hospital, port, or customer service center in under an hour.
            </p>
          </div>
          <Link
            href="/register-organisation"
            className="inline-flex items-center justify-center rounded-full bg-mint px-8 py-3.5 text-sm font-bold text-forest-dark shadow-md hover:bg-[#1affb2] transition"
          >
            Register Your Organisation →
          </Link>
        </div>
      </section>

      {/* ───────────── Proper Professional Footer ───────────── */}
      <Footer />
    </main>
  );
}
