"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Logo, Modal } from "@/components/ui";
import { MockTicket, TicketStatus, clearTicket, getService, organisation } from "@/lib/queue";

const TOTAL_AT_JOIN = 12;

type Props = {
  ticket: MockTicket;
};

// Simulation timeline for testing & review
const timeline: { status: TicketStatus; position: number; currentDesk?: string; servingTicket?: string }[] = [
  { status: "waiting", position: 4, currentDesk: "Desk 1", servingTicket: "R-038" },
  { status: "waiting", position: 3, currentDesk: "Desk 2", servingTicket: "R-039" },
  { status: "waiting", position: 2, currentDesk: "Desk 1", servingTicket: "R-040" },
  { status: "waiting", position: 1, currentDesk: "Desk 2", servingTicket: "R-041" },
  { status: "called", position: 1, currentDesk: "Desk 1", servingTicket: "Your Turn" },
  { status: "serving", position: 1, currentDesk: "Desk 1", servingTicket: "Serving" },
  { status: "completed", position: 0, currentDesk: "Desk 1", servingTicket: "Done" },
];

export default function WaitingExperience({ ticket }: Props) {
  const router = useRouter();
  const service = getService(ticket.serviceId);

  const [showSuccessModal, setShowSuccessModal] = useState(true);
  const [copiedPin, setCopiedPin] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [overrideStatus, setOverrideStatus] = useState<TicketStatus | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  // Auto-dismiss the initial welcome celebration after 4.5 seconds
  useEffect(() => {
    const timer = window.setTimeout(() => setShowSuccessModal(false), 4500);
    return () => window.clearTimeout(timer);
  }, []);

  const currentTimeline = timeline[stepIndex];
  const activeStatus: TicketStatus = overrideStatus ?? currentTimeline.status;
  const currentPosition = currentTimeline.position;

  const ahead = Math.max(currentPosition - 1, 0);
  const progressPercent = Math.min(
    100,
    Math.round(((TOTAL_AT_JOIN - currentPosition) / (TOTAL_AT_JOIN - 1)) * 100)
  );
  const estWaitMinutes = currentPosition <= 2 ? 5 : currentPosition * 3;

  function copyPin() {
    navigator.clipboard?.writeText(ticket.pin);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  }

  function handleCancelTicket() {
    setConfirmCancel(false);
    setOverrideStatus("cancelled");
  }

  function handleExit() {
    clearTicket();
    router.push("/");
  }

  return (
    <main className="min-h-screen bg-[#f3f6f5] text-ink pb-20 selection:bg-brand selection:text-white">
      {/* ── Top Header Navigation ── */}
      <header className="border-b border-line/60 bg-white/80 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4 sm:px-8">
          <Logo />
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-mint px-3 py-1 text-xs font-semibold text-brand-ink">
              <span className="h-2 w-2 rounded-full bg-ok animate-pulse" /> Live Room
            </span>
            <button
              onClick={() => router.push("/")}
              className="text-xs font-semibold text-soft hover:text-ink transition underline underline-offset-4"
            >
              Exit to Home
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 pt-8 sm:px-8">
        {/* ── Status Banner (When Called or Special State) ── */}
        {activeStatus === "called" && (
          <div
            role="alert"
            className="mb-6 rounded-3xl bg-brand p-6 text-white shadow-xl ring-4 ring-brand/20 animate-bounce"
          >
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/20 text-2xl font-bold">
                📢
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#98ebd1]">Now Calling</p>
                <h2 className="text-2xl font-bold">Please proceed to Desk 1</h2>
                <p className="mt-0.5 text-sm text-white/90">
                  Staff member is ready for Ticket <span className="font-mono font-bold">{ticket.ticket}</span>.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeStatus === "serving" && (
          <div className="mb-6 rounded-3xl bg-[#087257] p-5 text-white shadow-lg">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✨</span>
              <div>
                <h3 className="font-bold">You are being served</h3>
                <p className="text-xs text-white/90">Service in progress at Desk 1.</p>
              </div>
            </div>
          </div>
        )}

        {activeStatus === "completed" && (
          <div className="mb-6 rounded-3xl bg-white p-8 text-center shadow-sm border border-line">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-mint text-3xl text-ok mb-4">
              ✓
            </div>
            <h2 className="text-2xl font-bold">Service Completed</h2>
            <p className="mt-2 text-sm text-soft max-w-md mx-auto">
              Your session for {service.name} has concluded. Thank you for using Krenox!
            </p>
            <Button onClick={handleExit} className="mt-6">
              Return to Homepage
            </Button>
          </div>
        )}

        {activeStatus === "cancelled" && (
          <div className="mb-6 rounded-3xl bg-white p-8 text-center shadow-sm border border-danger/20">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#fde8e8] text-3xl text-danger mb-4">
              ✕
            </div>
            <h2 className="text-2xl font-bold text-ink">Ticket Cancelled</h2>
            <p className="mt-2 text-sm text-soft max-w-md mx-auto">
              This ticket has been withdrawn from the queue. You can take a new ticket anytime.
            </p>
            <Button onClick={handleExit} className="mt-6">
              Take a New Ticket
            </Button>
          </div>
        )}

        {/* ── Main Virtual Ticket Pass ── */}
        {activeStatus !== "completed" && activeStatus !== "cancelled" && (
          <div className="overflow-hidden rounded-[2.2rem] border border-white/80 bg-white shadow-[0_20px_60px_rgba(16,42,54,.08)]">
            {/* Pass Header Banner */}
            <div className="bg-[#0b3842] px-6 py-6 text-white sm:px-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-[#8ed8c8]">{organisation.name}</p>
                  <h1 className="mt-1 text-xl font-bold sm:text-2xl">{service.name}</h1>
                  <p className="text-xs text-white/70">Main Campus · Student Services</p>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur">
                    <span className="h-2 w-2 rounded-full bg-[#5fd0b0] animate-pulse" />
                    {activeStatus === "waiting"
                      ? currentPosition <= 2
                        ? "Turn Approaching"
                        : "In Queue"
                      : activeStatus === "called"
                      ? "Called to Desk"
                      : "Serving"}
                  </span>
                  <p className="mt-2 text-xs font-mono tracking-wider text-white/70">
                    Ticket <span className="font-bold text-white text-sm">{ticket.ticket}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Middle Section: Big Gauge & Position Callout */}
            <div className="p-6 sm:p-8">
              <div className="grid gap-6 sm:grid-cols-[1.2fr_.8fr] sm:items-center">
                {/* Position Highlight */}
                <div className="rounded-3xl bg-[#f7f9f8] p-6 text-center sm:text-left border border-line/60">
                  <p className="text-xs font-semibold text-soft">Your Live Position</p>
                  <div className="mt-2 flex items-baseline justify-center sm:justify-start gap-3">
                    <span className="text-6xl sm:text-7xl font-bold tracking-tight text-brand">
                      {currentPosition}
                    </span>
                    <span className="text-sm font-medium text-soft">
                      in line ({TOTAL_AT_JOIN} total joined)
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-brand-ink">
                    {ahead === 0 ? (
                      <span className="font-bold text-ok">🎉 You are next in line!</span>
                    ) : (
                      <>
                        <span className="font-bold text-ink">{ahead}</span> {ahead === 1 ? "person" : "people"} ahead of you
                      </>
                    )}
                  </p>
                </div>

                {/* Estimate & Counter Meta */}
                <div className="grid grid-cols-2 sm:grid-cols-1 gap-3">
                  <div className="rounded-2xl border border-line/80 bg-white p-4">
                    <p className="text-xs font-medium text-soft">Estimated Wait</p>
                    <p className="mt-1 text-2xl font-bold text-ink">~{estWaitMinutes} mins</p>
                    <p className="mt-0.5 text-[11px] text-soft">Dynamic queue calculation</p>
                  </div>
                  <div className="rounded-2xl border border-line/80 bg-white p-4">
                    <p className="text-xs font-medium text-soft">Active Desks</p>
                    <p className="mt-1 text-lg font-bold text-brand-ink">
                      {service.desksOpen} open desks
                    </p>
                    <p className="mt-0.5 text-[11px] text-soft">Currently processing tickets</p>
                  </div>
                </div>
              </div>

              {/* Progress Milestones */}
              <div className="mt-8 border-t border-line/70 pt-6">
                <div className="flex items-center justify-between text-xs font-semibold text-ink">
                  <span>Queue Flow</span>
                  <span className="text-brand">{progressPercent}% closer to desk</span>
                </div>
                <div
                  className="mt-3 h-3 overflow-hidden rounded-full bg-[#e3ece9]"
                  role="progressbar"
                  aria-valuenow={progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-brand transition-all duration-700 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="mt-3 flex justify-between text-[11px] text-soft">
                  <span>Joined at #{TOTAL_AT_JOIN}</span>
                  <span>Currently #{currentPosition}</span>
                  <span>Desk Service</span>
                </div>
              </div>

              {/* Perforated Divider Ticket Notch */}
              <div className="relative my-8 border-t-2 border-dashed border-line">
                <div className="absolute -left-10 -top-3 h-6 w-6 rounded-full bg-[#f3f6f5]" />
                <div className="absolute -right-10 -top-3 h-6 w-6 rounded-full bg-[#f3f6f5]" />
              </div>

              {/* Bottom Pass Details: PIN & Recovery */}
              <div className="grid gap-4 sm:grid-cols-2 items-center">
                <div className="flex items-center justify-between rounded-2xl bg-mint p-4 border border-brand/10">
                  <div>
                    <p className="text-xs font-semibold text-brand">Ticket Recovery PIN</p>
                    <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-ink">
                      {ticket.pin}
                    </p>
                  </div>
                  <button
                    onClick={copyPin}
                    type="button"
                    className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-brand shadow-sm hover:bg-white/80 transition"
                  >
                    {copiedPin ? "Copied! ✓" : "Copy"}
                  </button>
                </div>

                <div className="rounded-2xl bg-[#fafbf9] p-4 border border-line text-xs leading-relaxed text-soft">
                  <p className="font-semibold text-ink">
                    {ticket.reminder ? "📱 WhatsApp Alert Active" : "📱 In-Browser Tracking"}
                  </p>
                  <p className="mt-1">
                    {ticket.reminder && ticket.phone
                      ? `Alerts will ping ${ticket.phone} when only 2 people remain ahead.`
                      : "Keep this browser tab open to follow real-time calls."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Desk Activity Monitor ── */}
        <div className="mt-6 rounded-3xl bg-white p-6 shadow-sm border border-line">
          <div className="flex items-center justify-between border-b border-line/60 pb-4">
            <div>
              <h3 className="font-bold text-ink">Desk Live Activity</h3>
              <p className="text-xs text-soft">Current queue handling by service staff</p>
            </div>
            <span className="text-xs font-semibold text-ok bg-[#e9f7f0] px-2.5 py-1 rounded-full">
              ● All counters active
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-2xl bg-[#f8faf9] p-4 border border-line/50">
              <div>
                <p className="text-xs font-semibold text-soft">Counter Desk 1</p>
                <p className="text-sm font-bold text-ink">Serving Ticket R-039</p>
              </div>
              <span className="text-xs font-medium text-brand">Processing</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-[#f8faf9] p-4 border border-line/50">
              <div>
                <p className="text-xs font-semibold text-soft">Counter Desk 2</p>
                <p className="text-sm font-bold text-ink">Serving Ticket R-040</p>
              </div>
              <span className="text-xs font-medium text-brand">Processing</span>
            </div>
          </div>
        </div>

        {/* ── Demo Testing Controls (Prototype Sandbox) ── */}
        <div className="mt-6 rounded-3xl border border-line/80 bg-white/70 p-5 backdrop-blur">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-soft uppercase tracking-wider">
              Prototype Simulation Controls
            </p>
            <span className="text-[11px] text-soft">Interactive Demo</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2.5">
            <Button
              variant="secondary"
              className="!py-2 !px-4 !text-xs"
              disabled={!!overrideStatus || stepIndex === timeline.length - 1}
              onClick={() => setStepIndex((prev) => prev + 1)}
            >
              Advance Queue ⏭
            </Button>
            <Button
              variant="secondary"
              className="!py-2 !px-4 !text-xs"
              onClick={() => {
                setStepIndex(0);
                setOverrideStatus(null);
              }}
            >
              Reset ↺
            </Button>
            <Button
              variant="secondary"
              className="!py-2 !px-4 !text-xs"
              onClick={() => setOverrideStatus("called")}
            >
              Simulate &quot;Now Calling&quot;
            </Button>
            <Button
              variant="ghost"
              className="!py-2 !px-4 !text-xs !text-danger ml-auto"
              onClick={() => setConfirmCancel(true)}
            >
              Cancel Ticket
            </Button>
          </div>
        </div>
      </div>

      {/* ── Initial Success Celebration Modal ── */}
      {showSuccessModal && (
        <Modal titleId="success-title" onClose={() => setShowSuccessModal(false)} size="md">
          <div className="p-7 text-center">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-mint text-4xl text-ok mb-5 shadow-inner">
              ✓
            </div>
            <p className="text-xs font-bold text-brand uppercase tracking-wider">
              Registration Confirmed
            </p>
            <h2 id="success-title" className="mt-1 text-2xl font-bold text-ink">
              You are in the queue!
            </h2>
            <p className="mt-2 text-sm text-soft leading-relaxed">
              Assigned <span className="font-bold text-ink">{ticket.ticket}</span> for {service.name}.
            </p>

            <div className="mt-6 rounded-2xl bg-[#f7f9f8] p-4 border border-line">
              <p className="text-xs text-soft font-medium">Your Recovery PIN</p>
              <p className="mt-1 font-mono text-3xl font-bold tracking-widest text-brand">
                {ticket.pin}
              </p>
              <p className="mt-1 text-[11px] text-soft">Save this to reopen your ticket anytime.</p>
            </div>

            <Button onClick={() => setShowSuccessModal(false)} className="mt-6 w-full">
              Enter Waiting Room →
            </Button>
          </div>
        </Modal>
      )}

      {/* ── Cancel Ticket Confirmation Modal ── */}
      {confirmCancel && (
        <Modal titleId="cancel-modal-title" onClose={() => setConfirmCancel(false)} size="md">
          <div className="p-7 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#fde8e8] text-2xl text-danger mb-4">
              ✕
            </div>
            <h3 id="cancel-modal-title" className="text-xl font-bold text-ink">
              Leave this queue?
            </h3>
            <p className="mt-2 text-sm text-soft leading-relaxed">
              If you leave now, you will lose ticket <span className="font-bold">{ticket.ticket}</span> and your position #{currentPosition}.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setConfirmCancel(false)}
              >
                Keep My Place
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={handleCancelTicket}
              >
                Cancel Ticket
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
