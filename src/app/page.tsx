"use client";

import { useState } from "react";
import JoinQueueDialog from "@/components/JoinQueueDialog";
import { Button, Eyebrow, Logo } from "@/components/ui";
import { desksLabel, organisation, services } from "@/lib/queue";

const steps = [
  ["01", "Pick a service", "Choose the desk you need from your organisation’s queue page."],
  ["02", "Get your ticket", "Receive a digital ticket and an honest estimate of your wait."],
  ["03", "Arrive with purpose", "Get notified as your turn approaches, then head over."],
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
    <main className="min-h-screen overflow-hidden bg-canvas text-ink">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8" aria-label="Main">
        <Logo />
        <div className="flex items-center gap-4 text-sm font-medium text-muted sm:gap-8">
          <a className="hidden transition hover:text-brand md:block" href="#how-it-works">How it works</a>
          <a className="hidden transition hover:text-brand md:block" href="#services">Services</a>
          <Button variant="secondary" className="!px-5 !py-2.5" title="Staff console coming soon">Staff sign in</Button>
        </div>
      </nav>

      <section className="relative mx-auto grid max-w-7xl gap-14 px-6 pb-20 pt-10 lg:grid-cols-[1.02fr_.98fr] lg:items-center lg:px-8 lg:pb-28 lg:pt-16">
        <div className="relative z-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#e2f1ed] px-3 py-1.5 text-xs font-bold tracking-wide text-brand">
            <span className="h-2 w-2 rounded-full bg-[#23a27b]" /> VIRTUAL QUEUE ACCESS
          </div>
          <h1 className="max-w-2xl text-5xl font-semibold leading-[1.03] tracking-[-0.05em] sm:text-6xl lg:text-7xl">
            Waiting should not <span className="text-brand">hold you back.</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-muted">
            Join the queue from wherever you are. Follow your place in the line, and arrive when it matters.
          </p>
          <div className="mt-9 flex flex-wrap gap-4">
            <Button onClick={() => openQueue()}>Join a queue <span aria-hidden className="ml-2">→</span></Button>
            <a href="#how-it-works" className="inline-flex items-center rounded-full border border-line-strong bg-white px-6 py-3.5 text-sm font-bold text-brand-ink transition hover:border-brand">
              See how it works
            </a>
          </div>
          <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-5 border-t border-line pt-7">
            {[
              ["No app needed", "works in any modern browser"],
              ["Scan or tap", "join through a link or QR code"],
              ["Stay informed", "position and estimated wait"],
            ].map(([title, copy]) => (
              <div key={title}>
                <dt className="text-base font-bold">{title}</dt>
                <dd className="mt-1 text-xs font-medium text-soft">{copy}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative mx-auto w-full max-w-[520px]">
          <div className="absolute -right-10 -top-9 h-40 w-40 rounded-full bg-[#f7cf79]/55 blur-3xl" aria-hidden />
          <div className="absolute -bottom-12 -left-10 h-48 w-48 rounded-full bg-[#b9e2d9]/65 blur-3xl" aria-hidden />
          <div className="relative rounded-[2rem] border border-white/80 bg-white p-5 shadow-[0_24px_70px_rgba(35,74,78,.14)] sm:p-7">
            <div className="flex items-start justify-between">
              <div>
                <Eyebrow tone="muted">Example ticket</Eyebrow>
                <h2 className="mt-1 text-xl font-bold">{organisation.name}</h2>
              </div>
              <span className="rounded-full bg-[#e9f7f0] px-3 py-1.5 text-xs font-bold text-ok">● Waiting</span>
            </div>
            <div className="mt-7 rounded-2xl bg-ink px-6 py-6 text-white">
              <div className="flex items-center justify-between text-sm text-[#b9ced2]">
                <span>Student Records</span>
                <span>Ticket R-042</span>
              </div>
              <div className="mt-6 flex items-end justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-[#a9c3c8]">Your position</p>
                  <p className="mt-1 text-6xl font-semibold tracking-tight">4</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium uppercase tracking-wider text-[#a9c3c8]">Est. wait</p>
                  <p className="mt-1 text-2xl font-semibold">~12 min</p>
                </div>
              </div>
              <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/15" aria-hidden>
                <div className="h-full w-[72%] rounded-full bg-[#5fd0b0]" />
              </div>
            </div>
            <p className="mt-5 text-sm leading-6 text-soft">Reminders can tell you when there are about 3 people ahead. Estimates are predictions, not guarantees.</p>
          </div>
        </div>
      </section>

      <section id="services" className="border-y border-line bg-white py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <Eyebrow>Choose a service</Eyebrow>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Join the line before you arrive.</h2>
            </div>
            <p className="max-w-xs text-sm leading-6 text-soft">Estimates shown are illustrative in this prototype.</p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {services.map((service) => (
              <button key={service.id} type="button" aria-pressed={selected.id === service.id} onClick={() => openQueue(service.id)} className={`rounded-2xl border p-6 text-left transition ${selected.id === service.id ? "border-brand bg-[#f0f8f6] shadow-sm" : "border-line bg-white hover:border-[#9dc8c0]"}`}>
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e0eee9] text-xl text-brand" aria-hidden>{service.icon}</span>
                <h3 className="mt-6 text-lg font-bold">{service.name}</h3>
                <div className="mt-5 flex items-end justify-between">
                  <div>
                    <p className="text-xs text-soft">Estimated wait</p>
                    <p className="mt-1 text-xl font-bold text-brand">{service.waitMinutes} min</p>
                  </div>
                  <p className="text-xs font-medium text-soft">{desksLabel(service.desksOpen)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <Eyebrow>Simple by design</Eyebrow>
        <div className="mt-3 grid gap-10 lg:grid-cols-[.8fr_1.2fr]">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">Your time is valuable.<br />Keep it yours.</h2>
          <ol className="grid gap-7 sm:grid-cols-3">
            {steps.map(([num, title, copy]) => (
              <li key={num} className="border-t border-line-strong pt-5">
                <p className="text-sm font-bold text-brand">{num}</p>
                <h3 className="mt-4 font-bold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-soft">{copy}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="border-t border-line px-6 py-7 text-sm text-soft">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 sm:flex-row">
          <span>© 2026 Krenox. Queue less, live more.</span>
          <span>B.Tech design project · University of Buea</span>
        </div>
      </footer>

      {open && <JoinQueueDialog initialServiceId={selected.id} onClose={() => setOpen(false)} />}
    </main>
  );
}
