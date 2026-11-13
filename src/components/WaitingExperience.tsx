"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Eyebrow, Logo, Modal } from "@/components/ui";
import { MockTicket, TicketStatus, clearTicket, getService, organisation } from "@/lib/queue";

const TOTAL_AT_JOIN = 12;

/** Mock timeline used by the design-preview controls. */
const timeline: { status: TicketStatus; position: number }[] = [
  { status: "waiting", position: 4 },
  { status: "waiting", position: 3 },
  { status: "waiting", position: 2 },
  { status: "waiting", position: 1 },
  { status: "called", position: 1 },
  { status: "serving", position: 1 },
  { status: "completed", position: 1 },
];

type Tone = "ok" | "warn" | "danger" | "muted";
const statusInfo: Record<TicketStatus, { label: string; tone: Tone; title: string; message: string }> = {
  waiting: { label: "Waiting", tone: "ok", title: "You’re in the queue", message: "Keep this page open or come back to it. We’ll show when your turn is approaching." },
  called: { label: "Called", tone: "warn", title: "It’s your turn — please go to the desk", message: "Head to the service desk now. If you do not arrive in time, your ticket may be marked absent." },
  serving: { label: "Being served", tone: "ok", title: "You’re being served", message: "A staff member is helping you now." },
  completed: { label: "Completed", tone: "muted", title: "All done — thank you", message: "Your service is complete. This ticket is now closed." },
  skipped: { label: "Skipped", tone: "danger", title: "Your ticket was skipped", message: "Staff moved on because you were not available. Please speak to the desk or join the queue again." },
  absent: { label: "Marked absent", tone: "danger", title: "You were marked absent", message: "You were not present when called. Please join the queue again if you still need service." },
  cancelled: { label: "Cancelled", tone: "danger", title: "Ticket cancelled", message: "This ticket has been removed from the queue." },
};
const toneClass: Record<Tone, string> = {
  ok: "bg-[#e4f4ed] text-ok",
  warn: "bg-[#fff1d6] text-warn",
  danger: "bg-[#f7e6e6] text-danger",
  muted: "bg-line text-muted",
};

export default function WaitingExperience({ ticket }: { ticket: MockTicket }) {
  const router = useRouter();
  const service = getService(ticket.serviceId);
  const [showSuccess, setShowSuccess] = useState(true);
  const [step, setStep] = useState(0);
  const [override, setOverride] = useState<TicketStatus | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowSuccess(false), 2600);
    return () => window.clearTimeout(timer);
  }, []);

  const current = timeline[step];
  const status: TicketStatus = override ?? current.status;
  const position = current.position;
  const info = statusInfo[status];
  const isActive = status === "waiting" || status === "called" || status === "serving";
  const ahead = Math.max(position - 1, 0);
  const progress = Math.round(((TOTAL_AT_JOIN - position) / (TOTAL_AT_JOIN - 1)) * 100);
  const estimate = position <= 2 ? 5 : position * 3;
  const reset = () => { setStep(0); setOverride(null); };

  function leave() {
    router.push("/");
  }
  function cancelTicket() {
    setConfirmCancel(false);
    setOverride("cancelled");
  }
  function finishAndClear() {
    clearTicket();
    router.push("/");
  }

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-6 sm:px-8">
        <Logo />
        <span className="rounded-full bg-[#fff4df] px-3 py-1.5 text-xs font-bold text-[#7a5812]">Prototype preview</span>
      </header>

      <div className="mx-auto max-w-3xl px-5 pb-14 sm:px-8">
        {showSuccess && (
          <section className="mb-10 flex min-h-[500px] flex-col items-center justify-center text-center" aria-live="polite">
            <div className="waiting-check grid h-24 w-24 place-items-center rounded-full bg-[#dff3ea] text-5xl text-ok" aria-hidden>✓</div>
            <div className="mt-8"><Eyebrow tone="ok">Ticket {ticket.ticket} created</Eyebrow></div>
            <h1 className="mt-3 max-w-md text-4xl font-semibold tracking-tight sm:text-5xl">You’re successfully in the queue{ticket.name ? `, ${ticket.name.split(" ")[0]}` : ""}!</h1>
            <p className="mt-4 max-w-sm leading-7 text-muted">Your {service.name} ticket is ready. Keep the recovery PIN below in case you close this page.</p>
            <div className="mt-7 w-full max-w-sm rounded-2xl border border-[#cde1db] bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-[.15em] text-soft">Ticket recovery PIN</p>
              <p className="mt-2 font-mono text-4xl font-bold tracking-[.25em] text-brand">{ticket.pin}</p>
              <p className="mt-3 text-xs leading-5 text-muted">Separate from your ticket number. Store it safely.</p>
            </div>
            <Button className="mt-8" onClick={() => setShowSuccess(false)}>View my queue status</Button>
          </section>
        )}

        <section className={`transition-all duration-700 ${showSuccess ? "pointer-events-none h-0 translate-y-6 overflow-hidden opacity-0" : "translate-y-0 opacity-100"}`} aria-hidden={showSuccess}>
          <div className="border-b border-line pb-7">
            <Eyebrow>{organisation.name} · Student Services</Eyebrow>
            <div className="mt-3 flex items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">Your waiting room</h1>
                <p className="mt-2 text-sm text-muted">{service.name} · Main Campus</p>
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${toneClass[info.tone]}`} role="status">● {info.label}</span>
            </div>
          </div>

          {status === "called" && (
            <div className="pulse-ring mt-7 rounded-2xl bg-brand p-6 text-white" role="alert">
              <p className="text-xs font-bold uppercase tracking-[.16em] text-[#bfe3e0]">Now calling</p>
              <p className="mt-2 text-2xl font-semibold">{ticket.ticket} — please go to the service desk</p>
            </div>
          )}

          {isActive && status === "waiting" ? (
            <div className="py-9 text-center">
              <p className="text-xs font-bold uppercase tracking-[.16em] text-soft">Your queue position</p>
              <div className="mt-3 flex items-baseline justify-center gap-2">
                <span className="text-8xl font-semibold tracking-[-.08em] text-brand">{position}</span>
                <span className="text-lg font-medium text-muted">of {TOTAL_AT_JOIN}</span>
              </div>
              <p className="mt-3 text-base font-medium text-brand-ink" aria-live="polite">
                {ahead === 0 ? "You are next" : `${ahead} ${ahead === 1 ? "customer" : "customers"} ahead of you`}
              </p>
            </div>
          ) : (
            <div className="py-9 text-center">
              <h2 className="mx-auto max-w-md text-3xl font-semibold tracking-tight">{info.title}</h2>
              <p className="mx-auto mt-3 max-w-md leading-7 text-muted">{info.message}</p>
            </div>
          )}

          {status === "waiting" && (
            <>
              <div className="border-y border-line py-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold">Queue progress</span>
                  <span className="font-medium text-muted">{progress}% from your joining position</span>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#dceae7]" role="progressbar" aria-label="Progress from your joining position" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full bg-brand transition-[width] duration-700 ease-out" style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-3 text-sm leading-6 text-soft">This shows your position improving since you joined. It does not predict when service will finish.</p>
              </div>
              <div className="grid grid-cols-2 gap-4 py-7">
                <Fact label="Ticket" value={ticket.ticket} />
                <Fact label="Estimated wait" value={`~${estimate} min`} note="A prediction, not a guarantee" />
              </div>
              <div className="rounded-2xl bg-mint p-5">
                <p className="font-bold">{position <= 2 ? "Your turn is approaching" : "A quick heads-up"}</p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {ticket.reminder
                    ? `We’ll send a WhatsApp reminder to ${ticket.phone || "your number"} when you are close to the front. Notifications depend on an external service and may be delayed.`
                    : "You chose not to receive reminders, so keep an eye on this page."}
                </p>
              </div>
            </>
          )}

          {!isActive && (
            <div className="grid grid-cols-2 gap-4 border-t border-line py-7">
              <Fact label="Ticket" value={ticket.ticket} />
              <Fact label="Service" value={service.name} />
            </div>
          )}

          <div className="mt-8 border-t border-line pt-6">
            <Eyebrow tone="warn">Design preview controls</Eyebrow>
            <div className="mt-3 flex flex-wrap gap-3">
              <Button variant="secondary" className="!py-3" disabled={!!override || step === timeline.length - 1} onClick={() => setStep((s) => s + 1)}>Advance queue</Button>
              <Button variant="secondary" className="!py-3" disabled={!!override} onClick={() => setOverride("skipped")}>Mark skipped</Button>
              <Button variant="secondary" className="!py-3" disabled={!!override} onClick={() => setOverride("absent")}>Mark absent</Button>
              <Button variant="secondary" className="!py-3" onClick={reset}>Reset mock data</Button>
            </div>
            <p className="mt-3 text-xs leading-5 text-soft">These controls only demonstrate each ticket state. They are not real-time updates.</p>
          </div>

          <div className="mt-10 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
            {isActive ? (
              <>
                <Button variant="ghost" onClick={leave} className="!px-0 !py-0 self-start">Leave this page</Button>
                {status === "waiting" && <Button variant="ghost" className="!px-0 !py-0 self-start !text-danger" onClick={() => setConfirmCancel(true)}>Cancel ticket</Button>}
              </>
            ) : (
              <Button onClick={finishAndClear}>Return to Krenox</Button>
            )}
          </div>
        </section>
      </div>

      {confirmCancel && (
        <Modal titleId="cancel-title" onClose={() => setConfirmCancel(false)}>
          <div className="p-7">
            <Eyebrow tone="danger">Cancel ticket</Eyebrow>
            <h2 id="cancel-title" className="mt-3 text-2xl font-semibold tracking-tight">Leave this queue?</h2>
            <p className="mt-3 leading-7 text-muted">You will lose your place in line. This is a prototype confirmation; in production cancelling is a server-validated action.</p>
            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row">
              <Button variant="secondary" onClick={() => setConfirmCancel(false)} data-autofocus>Keep my ticket</Button>
              <Button variant="danger" onClick={cancelTicket}>Cancel ticket</Button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}

function Fact({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[.14em] text-soft">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
      {note && <p className="mt-1 text-xs text-soft">{note}</p>}
    </div>
  );
}
