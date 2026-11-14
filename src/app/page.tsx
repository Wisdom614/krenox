"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import JoinQueueDialog from "@/components/JoinQueueDialog";
import { Button, Logo } from "@/components/ui";
import { desksLabel, organisation, services } from "@/lib/queue";

const serviceImages: Record<string, string> = {
  records: "/images/service-records.jpg",
  tuition: "/images/service-tuition.jpg",
  advising: "/images/service-advising.jpg",
};

const steps = [
  {
    num: "01",
    title: "Select your service desk",
    copy: "Pick the service counter you need directly from your phone — no need to stand in a hallway.",
  },
  {
    num: "02",
    title: "Receive your live ticket & PIN",
    copy: "Get an assigned ticket number with live queue position and an estimated wait based on active desks.",
  },
  {
    num: "03",
    title: "Arrive right on time",
    copy: "Spend your wait in the library or campus cafeteria. Walk over when your turn is called.",
  },
];

export default function Home() {
  const [selectedId, setSelectedId] = useState(services[0].id);
  const [open, setOpen] = useState(false);
  const selected = services.find((s) => s.id === selectedId) ?? services[0];
  const openQueue = (id?: string) => {
    if (id) setSelectedId(id);
    setOpen(true);
  };

  return (
    <main className="min-h-screen overflow-hidden bg-canvas text-ink selection:bg-brand selection:text-white">
      {/* ───────────── Hero ───────────── */}
      <section className="relative isolate text-white">
        <Image
          src="/images/hero.jpg"
          alt="University campus outdoor seating"
          fill
          priority
          sizes="100vw"
          className="-z-20 object-cover object-[75%_center]"
        />
        {/* Cinematic gradient overlay allowing text contrast on left while keeping right subjects naturally bright */}
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-r from-[#07242c]/95 via-[#08303a]/80 to-transparent max-lg:from-[#07242c]/95 max-lg:via-[#08303a]/85 max-lg:to-[#08303a]/70"
          aria-hidden
        />
        <div
          className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-canvas to-transparent"
          aria-hidden
        />

        {/* Navigation */}
        <nav
          className="relative z-30 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8"
          aria-label="Main"
        >
          <Logo className="text-white" />
          <div className="flex items-center gap-6 text-sm font-medium text-white/90">
            <a className="transition hover:text-white text-sm" href="#services">
              Services
            </a>
            <a className="transition hover:text-white text-sm" href="#how-it-works">
              How it works
            </a>
            <button
              onClick={() => openQueue()}
              className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/15 px-5 py-2 text-sm font-bold text-white backdrop-blur transition hover:bg-white/25 shadow-sm"
            >
              Take a Ticket →
            </button>
          </div>
        </nav>

        {/* Hero Content */}
        <div className="relative mx-auto grid min-h-[620px] max-w-7xl items-center gap-12 px-6 pb-36 pt-10 lg:min-h-[700px] lg:grid-cols-[1.1fr_.9fr] lg:px-8 lg:pb-40">
          <div>
            <h1 className="max-w-2xl text-5xl font-semibold leading-[1.03] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
              Waiting should not <span className="text-[#6ee7b7]">hold you back.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-white/85 sm:text-xl">
              Join the service queue from anywhere on campus. Track your real-time place in line, and step up right when your number is called.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Button
                onClick={() => openQueue()}
                className="!bg-white !text-brand-ink !shadow-[0_16px_36px_rgba(0,0,0,.3)] hover:!bg-[#e8f6f1]"
              >
                Join a queue <span aria-hidden className="ml-2">→</span>
              </Button>
              <a
                href="#how-it-works"
                className="inline-flex items-center rounded-full border border-white/30 px-6 py-3.5 text-sm font-bold text-white backdrop-blur transition hover:bg-white/10"
              >
                See how it works
              </a>
            </div>
          </div>

          {/* Ticket preview widget */}
          <div className="relative w-full max-w-[340px] justify-self-start lg:justify-self-end lg:self-center mt-6 lg:mt-0">
            <div className="rounded-[1.75rem] border border-white/60 bg-white/95 p-5 text-ink shadow-[0_24px_70px_rgba(0,0,0,.35)] backdrop-blur transition duration-300 hover:shadow-[0_30px_90px_rgba(0,0,0,.45)]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-soft">Live Demonstration</p>
                  <h2 className="mt-0.5 text-base font-bold">{organisation.name}</h2>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e9f7f0] px-3 py-1 text-xs font-semibold text-ok">
                  <span className="h-1.5 w-1.5 rounded-full bg-ok animate-pulse" /> In Queue
                </span>
              </div>

              <div className="mt-5 rounded-2xl bg-ink p-5 text-white shadow-inner">
                <div className="flex items-center justify-between text-xs font-medium text-[#b9ced2]">
                  <span>Student Records</span>
                  <span className="font-mono text-sm tracking-wide text-white">Ticket R-042</span>
                </div>
                <div className="mt-5 flex items-end justify-between">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-[#a9c3c8]">Position</p>
                    <p className="mt-0.5 text-5xl font-semibold tracking-tight">4</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-[#a9c3c8]">Est. Wait</p>
                    <p className="mt-0.5 text-2xl font-semibold">~12 min</p>
                  </div>
                </div>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15" aria-hidden>
                  <div className="h-full w-[72%] rounded-full bg-[#5fd0b0] transition-all duration-700" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── Key Highlights Strip ───────────── */}
      <section className="relative z-10 mx-auto -mt-16 max-w-7xl px-6 lg:px-8" aria-label="Key highlights">
        <dl className="grid gap-px overflow-hidden rounded-3xl bg-line shadow-[0_20px_60px_rgba(16,42,54,.1)] sm:grid-cols-3">
          {[
            ["No App Required", "Instant access in any mobile browser by scanning a QR code or visiting a link."],
            ["Accurate Wait Times", "Calculated automatically using current open desks and historical service duration."],
            ["WhatsApp Alerts", "Opt-in to automated SMS / WhatsApp reminders when your turn is close."],
          ].map(([title, copy]) => (
            <div key={title} className="bg-white p-7 transition hover:bg-[#fafbf9]">
              <dt className="text-base font-bold text-ink">{title}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-soft">{copy}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ───────────── Service Counters ───────────── */}
      <section id="services" className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold text-brand">Service Counters</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Available queues today</h2>
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-soft">
            Select a counter below to take a ticket directly.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {services.map((service) => (
            <button
              key={service.id}
              type="button"
              aria-pressed={selected.id === service.id}
              onClick={() => openQueue(service.id)}
              className={`group overflow-hidden rounded-3xl border bg-white text-left transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_50px_rgba(16,42,54,.12)] ${
                selected.id === service.id ? "border-brand ring-2 ring-brand/10 shadow-sm" : "border-line"
              }`}
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={serviceImages[service.id]}
                  alt={service.name}
                  fill
                  sizes="(min-width: 768px) 33vw, 100vw"
                  className="object-cover transition duration-500 group-hover:scale-105"
                />
                <div
                  className="absolute inset-0 bg-gradient-to-t from-[#08303a]/80 via-transparent to-transparent"
                  aria-hidden
                />
                <span className="absolute bottom-4 left-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-brand-ink backdrop-blur">
                  {desksLabel(service.desksOpen)}
                </span>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-ink">{service.name}</h3>
                <div className="mt-4 flex items-end justify-between border-t border-line/60 pt-4">
                  <div>
                    <p className="text-xs text-soft">Estimated wait</p>
                    <p className="mt-0.5 text-2xl font-bold text-brand">~{service.waitMinutes} min</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-brand transition-transform group-hover:translate-x-1">
                    Join line <span>→</span>
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ───────────── How it Works ───────────── */}
      <section id="how-it-works" className="border-y border-line bg-white py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-6 lg:grid-cols-[.9fr_1.1fr] lg:px-8">
          <div className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-[2rem] shadow-[0_24px_70px_rgba(16,42,54,.15)]">
            <Image
              src="/images/how-it-works.jpg"
              alt="A student comfortably checking queue updates on her phone"
              fill
              sizes="(min-width: 1024px) 40vw, 90vw"
              className="object-cover"
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-brand">Effortless Experience</p>
            <h2 className="mt-2 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Designed around your day, not the queue.
            </h2>
            <ol className="mt-10 grid gap-8">
              {steps.map((step) => (
                <li key={step.num} className="flex gap-5">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-mint text-base font-bold text-brand ring-1 ring-line-strong">
                    {step.num}
                  </span>
                  <div>
                    <h3 className="text-lg font-bold text-ink">{step.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-soft">{step.copy}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Button onClick={() => openQueue()} className="mt-10">
              Get started now <span aria-hidden className="ml-2">→</span>
            </Button>
          </div>
        </div>
      </section>

      {/* ───────────── Bottom Call to Action ───────────── */}
      <section className="relative isolate overflow-hidden bg-[#0a3f4a] text-white">
        <Image
          src="/images/hero.jpg"
          alt=""
          fill
          sizes="100vw"
          className="-z-20 object-cover opacity-20"
        />
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-6 py-16 lg:flex-row lg:items-center lg:px-8">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Queue less, live more.</h2>
            <p className="mt-3 max-w-lg text-white/80">
              Instant digital ticketing built for high-traffic institutions.
            </p>
          </div>
          <Button onClick={() => openQueue()} className="!bg-white !text-brand-ink hover:!bg-[#e8f6f1]">
            Join a queue <span aria-hidden className="ml-2">→</span>
          </Button>
        </div>
      </section>

      {/* ───────────── Footer ───────────── */}
      <footer className="px-6 py-8 text-sm text-soft">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <span>© 2026 Krenox · University of Buea B.Tech Software Engineering</span>
          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-ink transition font-medium text-xs text-soft">
              Staff & Admin Portal 🔒
            </Link>
          </div>
        </div>
      </footer>

      {open && <JoinQueueDialog initialServiceId={selected.id} onClose={() => setOpen(false)} />}
    </main>
  );
}
