"use client";

import Image from "next/image";
import { useState } from "react";
import JoinQueueDialog from "@/components/JoinQueueDialog";
import { Button, Eyebrow, Logo } from "@/components/ui";
import { desksLabel, organisation, services } from "@/lib/queue";

const serviceImages: Record<string, string> = {
  records: "/images/service-records.jpg",
  tuition: "/images/service-tuition.jpg",
  advising: "/images/service-advising.jpg",
};

const steps = [
  ["01", "Pick a service", "Choose the desk you need from your organisation’s queue page."],
  ["02", "Get your ticket", "Receive a digital ticket and an estimate of your wait."],
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
      {/* ───────────── Hero ───────────── */}
      <section className="relative isolate text-white">
        <Image src="/images/hero.jpg" alt="" fill priority sizes="100vw" className="-z-20 object-cover object-[72%_center]" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#08303a]/95 via-[#0a3f4a]/80 to-[#0a3f4a]/20 max-lg:from-[#08303a]/90 max-lg:via-[#08303a]/80 max-lg:to-[#08303a]/70" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-canvas to-transparent" aria-hidden />

        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8" aria-label="Main">
          <Logo className="text-white" />
          <div className="flex items-center gap-4 text-sm font-medium text-white/85 sm:gap-8">
            <a className="hidden transition hover:text-white md:block" href="#services">Services</a>
            <a className="hidden transition hover:text-white md:block" href="#how-it-works">How it works</a>
            <Button variant="secondary" className="!border-white/40 !bg-white/10 !px-5 !py-2.5 !text-white backdrop-blur hover:!bg-white/20" title="Staff console coming soon">Staff sign in</Button>
          </div>
        </nav>

        <div className="relative mx-auto grid min-h-[620px] max-w-7xl items-center gap-10 px-6 pb-36 pt-10 lg:min-h-[700px] lg:grid-cols-[1.1fr_.9fr] lg:px-8 lg:pb-40">
          <div>
            <h1 className="max-w-2xl text-5xl font-semibold leading-[1.03] tracking-[-0.05em] sm:text-6xl lg:text-7xl">
              Waiting should not <span className="text-[#7fe0c4]">hold you back.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-white/85">
              Join the queue from wherever you are. Follow your place in the line, and arrive when it matters.
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <Button onClick={() => openQueue()} className="!bg-white !text-brand-ink !shadow-[0_14px_30px_rgba(0,0,0,.25)] hover:!bg-[#e8f6f1]">
                Join a queue <span aria-hidden className="ml-2">→</span>
              </Button>
              <a href="#how-it-works" className="inline-flex items-center rounded-full border border-white/40 px-6 py-3.5 text-sm font-bold text-white backdrop-blur transition hover:bg-white/10">
                See how it works
              </a>
            </div>
          </div>

          {/* Example ticket */}
          <div className="relative w-full max-w-[340px] justify-self-start lg:-mt-24 lg:justify-self-end lg:self-start">
            <div className="rounded-[1.75rem] border border-white/70 bg-white/95 p-4 text-ink shadow-[0_24px_70px_rgba(0,0,0,.3)] backdrop-blur">
              <div className="flex items-start justify-between">
                <div>
                  <Eyebrow tone="muted">Example ticket</Eyebrow>
                  <h2 className="mt-1 text-lg font-bold">{organisation.name}</h2>
                </div>
                <span className="rounded-full bg-[#e9f7f0] px-3 py-1.5 text-xs font-bold text-ok">● Waiting</span>
              </div>
              <div className="mt-5 rounded-2xl bg-ink px-5 py-5 text-white">
                <div className="flex items-center justify-between text-sm text-[#b9ced2]">
                  <span>Student Records</span>
                  <span>Ticket R-042</span>
                </div>
                <div className="mt-5 flex items-end justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-[#a9c3c8]">Your position</p>
                    <p className="mt-1 text-5xl font-semibold tracking-tight">4</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium uppercase tracking-wider text-[#a9c3c8]">Est. wait</p>
                    <p className="mt-1 text-2xl font-semibold">~12 min</p>
                  </div>
                </div>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15" aria-hidden>
                  <div className="h-full w-[72%] rounded-full bg-[#5fd0b0]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── Benefits strip ───────────── */}
      <section className="relative z-10 mx-auto -mt-16 max-w-7xl px-6 lg:px-8" aria-label="Benefits">
        <dl className="grid gap-px overflow-hidden rounded-3xl bg-line shadow-[0_20px_60px_rgba(16,42,54,.12)] sm:grid-cols-3">
          {[
            ["No app needed", "Works in any modern browser on your phone."],
            ["Scan or tap", "Join through a shared link or a QR code."],
            ["Stay informed", "See your position and an estimated wait."],
          ].map(([title, copy]) => (
            <div key={title} className="bg-white px-7 py-6">
              <dt className="text-base font-bold">{title}</dt>
              <dd className="mt-1 text-sm leading-6 text-soft">{copy}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ───────────── Services ───────────── */}
      <section id="services" className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <Eyebrow>Choose a service</Eyebrow>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Join the line before you arrive.</h2>
          </div>
          <p className="max-w-xs text-sm leading-6 text-soft">Estimates shown are illustrative in this prototype.</p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {services.map((service) => (
            <button key={service.id} type="button" aria-pressed={selected.id === service.id} onClick={() => openQueue(service.id)} className={`group overflow-hidden rounded-3xl border bg-white text-left transition hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(16,42,54,.14)] ${selected.id === service.id ? "border-brand shadow-sm" : "border-line"}`}>
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image src={serviceImages[service.id]} alt="" fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover transition duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#08303a]/70 via-transparent to-transparent" aria-hidden />
                <span className="absolute bottom-4 left-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-brand-ink backdrop-blur">{desksLabel(service.desksOpen)}</span>
              </div>
              <div className="p-6">
                <h3 className="text-lg font-bold">{service.name}</h3>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <p className="text-xs text-soft">Estimated wait</p>
                    <p className="mt-1 text-xl font-bold text-brand">~{service.waitMinutes} min</p>
                  </div>
                  <span className="text-sm font-bold text-brand">Join <span aria-hidden>→</span></span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ───────────── How it works ───────────── */}
      <section id="how-it-works" className="border-y border-line bg-white py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-6 lg:grid-cols-[.85fr_1.15fr] lg:px-8">
          <div className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-[2rem] shadow-[0_24px_70px_rgba(16,42,54,.18)]">
            <Image src="/images/how-it-works.jpg" alt="A student relaxing outside a campus building while checking her phone" fill sizes="(min-width: 1024px) 40vw, 90vw" className="object-cover" />
          </div>
          <div>
            <Eyebrow>Simple by design</Eyebrow>
            <h2 className="mt-3 text-4xl font-semibold leading-tight tracking-tight">Your time is valuable.<br />Keep it yours.</h2>
            <ol className="mt-10 grid gap-8">
              {steps.map(([num, title, copy]) => (
                <li key={num} className="flex gap-5">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-mint text-sm font-bold text-brand ring-1 ring-line-strong">{num}</span>
                  <div>
                    <h3 className="font-bold">{title}</h3>
                    <p className="mt-1.5 text-sm leading-6 text-soft">{copy}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Button onClick={() => openQueue()} className="mt-10">Join a queue <span aria-hidden className="ml-2">→</span></Button>
          </div>
        </div>
      </section>

      {/* ───────────── Closing call to action ───────────── */}
      <section className="relative isolate overflow-hidden bg-[#0a3f4a] text-white">
        <Image src="/images/hero.jpg" alt="" fill sizes="100vw" className="-z-20 object-cover opacity-25" />
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-6 py-16 lg:flex-row lg:items-center lg:px-8">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Queue less, live more.</h2>
            <p className="mt-3 max-w-lg text-white/80">Get a digital ticket in under a minute and spend your wait where it suits you.</p>
          </div>
          <Button onClick={() => openQueue()} className="!bg-white !text-brand-ink hover:!bg-[#e8f6f1]">Join a queue <span aria-hidden className="ml-2">→</span></Button>
        </div>
      </section>

      <footer className="px-6 py-7 text-sm text-soft">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 sm:flex-row">
          <span>© 2026 Krenox. Queue less, live more.</span>
          <span>B.Tech design project · University of Buea</span>
        </div>
      </footer>

      {open && <JoinQueueDialog initialServiceId={selected.id} onClose={() => setOpen(false)} />}
    </main>
  );
}
