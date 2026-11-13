"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button, Logo, Modal } from "@/components/ui";
import { MockTicket, clearTicket, getService, organisation } from "@/lib/queue";
import { ApiQueueStatus, fetchTicketStatus } from "@/lib/api";
import { supabase } from "@/lib/supabase";

type Props = {
  ticket?: MockTicket;
  ticketId?: string;
};

export default function WaitingExperience({ ticket: initialTicket, ticketId: queryTicketId }: Props) {
  const router = useRouter();

  // Active ticket metadata
  const [ticketData, setTicketData] = useState<{
    id?: string;
    ticket_number: string;
    pin: string;
    serviceId: string;
    customer_name: string;
    masked_phone?: string;
    status: string;
    reminder: boolean;
  }>({
    ticket_number: initialTicket?.ticket || "R-040",
    pin: initialTicket?.pin || "123456",
    serviceId: initialTicket?.serviceId || "records",
    customer_name: initialTicket?.name || "Student",
    masked_phone: initialTicket?.phone || "",
    status: "waiting",
    reminder: initialTicket?.reminder ?? true,
  });

  const [position, setPosition] = useState<number>(initialTicket ? 3 : 1);
  const [totalWaiting, setTotalWaiting] = useState<number>(10);
  const [openDesks, setOpenDesks] = useState<number>(2);
  const [estWaitMinutes, setEstWaitMinutes] = useState<number>(8);
  const [calledDeskName, setCalledDeskName] = useState<string>("Desk 1");

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [hasPlayedChime, setHasPlayedChime] = useState(false);

  const prevStatusRef = useRef<string>("waiting");
  const activeTicketId = queryTicketId || ticketData.id;

  // Audio Chime notification when status transitions to "called"
  const playCallingChime = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.85);
    } catch {
      // Audio context might be restricted before user gesture
    }
  }, []);

  // Poll server for exact position calculations
  const syncLiveStatus = useCallback(async () => {
    if (!activeTicketId) return;
    try {
      const statusRes: ApiQueueStatus = await fetchTicketStatus(activeTicketId);
      const t = statusRes.ticket;
      
      setTicketData((prev) => ({
        ...prev,
        id: t.id,
        ticket_number: t.ticket_number,
        pin: t.pin,
        customer_name: t.customer_name,
        masked_phone: t.masked_phone || prev.masked_phone,
        status: t.status,
      }));

      if (t.position) setPosition(t.position);
      setTotalWaiting(statusRes.total_waiting);
      setOpenDesks(statusRes.open_desks);
      if (t.estimated_wait_minutes) setEstWaitMinutes(t.estimated_wait_minutes);

      // Play alert if called
      if (t.status === "called" && prevStatusRef.current !== "called" && !hasPlayedChime) {
        playCallingChime();
        setHasPlayedChime(true);
      }
      prevStatusRef.current = t.status;
    } catch {
      // Silent catch on offline
    }
  }, [activeTicketId, playCallingChime, hasPlayedChime]);

  // Initial load
  useEffect(() => {
    if (activeTicketId) {
      syncLiveStatus();
    }
  }, [activeTicketId, syncLiveStatus]);

  // Smart Realtime: Supabase WebSocket channel + Polling fallback
  useEffect(() => {
    // 1. Polling interval every 3 seconds to keep position accurate as other tickets advance
    const pollInterval = setInterval(() => {
      syncLiveStatus();
    }, 3000);

    // 2. Supabase Realtime WebSocket for instantaneous updates
    const channel = supabase
      .channel("tickets-realtime-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tickets",
        },
        (payload) => {
          // If our ticket specifically was updated (e.g. called to desk)
          if (activeTicketId && payload.new && payload.new.id === activeTicketId) {
            syncLiveStatus();
          } else {
            // If any ticket in queue was completed, recalculate positions immediately
            syncLiveStatus();
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [activeTicketId, syncLiveStatus]);

  const service = getService(ticketData.serviceId);
  const ahead = Math.max(position - 1, 0);
  const progressPercent = Math.min(
    100,
    Math.max(10, Math.round(((totalWaiting - position) / Math.max(totalWaiting - 1, 1)) * 100))
  );

  function copyPin() {
    navigator.clipboard?.writeText(ticketData.pin);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  }

  function handleCancelTicket() {
    setConfirmCancel(false);
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
            <span className="inline-flex items-center gap-1.5 rounded-full bg-mint px-3 py-1 text-xs font-semibold text-brand-ink">
              <span className="h-2 w-2 rounded-full bg-ok animate-pulse" /> Live Realtime Connected
            </span>
            <button
              onClick={() => router.push("/")}
              className="text-xs font-semibold text-soft hover:text-ink transition underline underline-offset-4"
            >
              Exit
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 pt-8 sm:px-8">
        {/* ── Status Banner: When Called ── */}
        {ticketData.status === "called" && (
          <div
            role="alert"
            className="mb-6 rounded-3xl bg-brand p-6 text-white shadow-xl ring-4 ring-brand/20 animate-bounce"
          >
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/20 text-3xl font-bold">
                📢
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#98ebd1]">Now Calling</p>
                <h2 className="text-2xl font-bold sm:text-3xl">Please proceed to {calledDeskName}</h2>
                <p className="mt-1 text-sm text-white/90">
                  Staff member is ready for Ticket <span className="font-mono font-bold text-white text-base">{ticketData.ticket_number}</span>.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Status Banner: Serving ── */}
        {ticketData.status === "serving" && (
          <div className="mb-6 rounded-3xl bg-[#087257] p-6 text-white shadow-lg">
            <div className="flex items-center gap-3">
              <span className="text-3xl">✨</span>
              <div>
                <h3 className="font-bold text-lg">You are being served</h3>
                <p className="text-xs text-white/90">Service currently in progress at {calledDeskName}.</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Status Banner: Completed ── */}
        {ticketData.status === "completed" && (
          <div className="mb-6 rounded-3xl bg-white p-8 text-center shadow-sm border border-line">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-mint text-3xl text-ok mb-4">
              ✓
            </div>
            <h2 className="text-2xl font-bold">Service Completed</h2>
            <p className="mt-2 text-sm text-soft max-w-md mx-auto">
              Your session for {service.name} has concluded. Thank you for using Krenox!
            </p>
            <Button onClick={() => { clearTicket(); router.push("/"); }} className="mt-6">
              Return to Homepage
            </Button>
          </div>
        )}

        {/* ── Main Virtual Ticket Pass ── */}
        {ticketData.status !== "completed" && (
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
                    {ticketData.status === "waiting"
                      ? position <= 2
                        ? "Turn Approaching"
                        : "In Queue"
                      : ticketData.status === "called"
                      ? "Called to Desk"
                      : "Serving"}
                  </span>
                  <p className="mt-2 text-xs font-mono tracking-wider text-white/70">
                    Ticket <span className="font-bold text-white text-sm">{ticketData.ticket_number}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Middle Section: Big Gauge & Position Callout */}
            <div className="p-6 sm:p-8">
              <div className="grid gap-6 sm:grid-cols-[1.2fr_.8fr] sm:items-center">
                {/* Position Highlight */}
                <div className="rounded-3xl bg-[#f7f9f8] p-6 text-center sm:text-left border border-line/60">
                  <p className="text-xs font-semibold text-soft">Your Live Queue Position</p>
                  <div className="mt-2 flex items-baseline justify-center sm:justify-start gap-3">
                    <span className="text-6xl sm:text-7xl font-bold tracking-tight text-brand">
                      {ticketData.status === "called" ? "1" : position}
                    </span>
                    <span className="text-sm font-medium text-soft">
                      in line ({totalWaiting} total joined)
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-brand-ink">
                    {ticketData.status === "called" ? (
                      <span className="font-bold text-ok">🎉 It is your turn now! Step up to the counter.</span>
                    ) : ahead === 0 ? (
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
                    <p className="mt-1 text-2xl font-bold text-ink">
                      {ticketData.status === "called" ? "Now" : `~${estWaitMinutes} mins`}
                    </p>
                    <p className="mt-0.5 text-[11px] text-soft">Dynamic realtime calculation</p>
                  </div>
                  <div className="rounded-2xl border border-line/80 bg-white p-4">
                    <p className="text-xs font-medium text-soft">Active Desks</p>
                    <p className="mt-1 text-lg font-bold text-brand-ink">
                      {openDesks} open desks
                    </p>
                    <p className="mt-0.5 text-[11px] text-soft">Processing tickets live</p>
                  </div>
                </div>
              </div>

              {/* Progress Bar Flow */}
              <div className="mt-8 border-t border-line/70 pt-6">
                <div className="flex items-center justify-between text-xs font-semibold text-ink">
                  <span>Queue Flow</span>
                  <span className="text-brand">
                    {ticketData.status === "called" ? "100% (At Counter)" : `${progressPercent}% closer to desk`}
                  </span>
                </div>
                <div
                  className="mt-3 h-3 overflow-hidden rounded-full bg-[#e3ece9]"
                  role="progressbar"
                  aria-valuenow={ticketData.status === "called" ? 100 : progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-brand transition-all duration-700 ease-out"
                    style={{ width: `${ticketData.status === "called" ? 100 : progressPercent}%` }}
                  />
                </div>
                <div className="mt-3 flex justify-between text-[11px] text-soft">
                  <span>Joined Queue</span>
                  <span>Currently #{position}</span>
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
                      {ticketData.pin}
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
                    {ticketData.reminder ? "📱 WhatsApp Alert Active" : "📱 In-Browser Tracking"}
                  </p>
                  <p className="mt-1">
                    {ticketData.masked_phone ? (
                      <>Alerts sent to <span className="font-mono font-bold text-ink">{ticketData.masked_phone}</span>.</>
                    ) : (
                      "Your number is safely masked and alerts are active."
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Cancel / Leave Option ── */}
        {ticketData.status !== "completed" && (
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => setConfirmCancel(true)}
              className="text-xs font-bold text-danger hover:underline transition"
            >
              Cancel this ticket / Leave queue
            </button>
          </div>
        )}
      </div>

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
              If you leave now, you will forfeit ticket <span className="font-bold">{ticketData.ticket_number}</span> and your spot #{position}.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setConfirmCancel(false)}
              >
                Keep My Spot
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
