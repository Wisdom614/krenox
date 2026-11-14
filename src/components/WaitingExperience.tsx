"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button, Logo, Modal } from "@/components/ui";
import { MockTicket, clearTicket, getService, organisation } from "@/lib/queue";
import { ApiQueueStatus, fetchTicketStatus, cancelTicket, postponeTicket } from "@/lib/api";
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
    organisation_name?: string;
    facility_name?: string;
    service_name?: string;
  }>({
    ticket_number: initialTicket?.ticket || "R-040",
    pin: initialTicket?.pin || "123456",
    serviceId: initialTicket?.serviceId || "records",
    customer_name: initialTicket?.name || "Customer",
    masked_phone: initialTicket?.phone || "",
    status: "waiting",
    reminder: initialTicket?.reminder ?? true,
    organisation_name: "University of Buea",
    facility_name: "Student Services · Main Campus",
  });

  const [position, setPosition] = useState<number>(initialTicket ? 3 : 1);
  const [totalWaiting, setTotalWaiting] = useState<number>(10);
  const [openDesks, setOpenDesks] = useState<number>(2);
  const [estWaitMinutes, setEstWaitMinutes] = useState<number>(8);
  const [calledDeskName, setCalledDeskName] = useState<string>("Desk 1");

  const [copiedPin, setCopiedPin] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const [confirmDelay, setConfirmDelay] = useState(false);
  const [delayPositions, setDelayPositions] = useState<number>(3);
  const [isDelaying, setIsDelaying] = useState(false);
  const [delaySuccess, setDelaySuccess] = useState("");
  const [delayError, setDelayError] = useState("");

  const [hasPlayedChime, setHasPlayedChime] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  const prevStatusRef = useRef<string>("waiting");
  const activeTicketId = queryTicketId || ticketData.id;

  // Synthesized harmonic chime when called
  const playCallingChime = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.18); // A5
      gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.85);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.9);

      // Attempt gentle haptic vibration if supported
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([200, 100, 200]);
      }
    } catch {
      // Audio context policy catch
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
        organisation_name: t.organisation_name || prev.organisation_name,
        facility_name: t.facility_name || prev.facility_name,
        service_name: t.service_name || prev.service_name,
      }));

      if (t.position) setPosition(t.position);
      setTotalWaiting(statusRes.total_waiting);
      setOpenDesks(statusRes.open_desks);
      if (t.estimated_wait_minutes) setEstWaitMinutes(t.estimated_wait_minutes);
      if (t.desk_name) setCalledDeskName(t.desk_name);

      // Play alert if called
      if (t.status === "called" && prevStatusRef.current !== "called" && !hasPlayedChime) {
        playCallingChime();
        setHasPlayedChime(true);
      }
      prevStatusRef.current = t.status;
      setIsConnected(true);
    } catch {
      setIsConnected(false);
    }
  }, [activeTicketId, playCallingChime, hasPlayedChime]);

  // Realtime subscription + 3s poll fallback
  useEffect(() => {
    syncLiveStatus();
    const pollInterval = setInterval(() => {
      syncLiveStatus();
    }, 3000);

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
          if (activeTicketId && payload.new && payload.new.id === activeTicketId) {
            syncLiveStatus();
          } else {
            syncLiveStatus();
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [activeTicketId, syncLiveStatus]);

  const service = getService(ticketData.serviceId);
  const ahead = Math.max(position - 1, 0);

  // Calculate clock arrival time (e.g. "10:45 AM")
  const arrivalTimeFormatted = (() => {
    const d = new Date(Date.now() + estWaitMinutes * 60 * 1000);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  })();

  function copyPin() {
    navigator.clipboard?.writeText(ticketData.pin);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  }

  async function handleCancelTicket() {
    setIsCancelling(true);
    setCancelError("");
    try {
      if (activeTicketId) {
        await cancelTicket(activeTicketId, ticketData.pin);
      }
      setConfirmCancel(false);
      setTicketData((prev) => ({ ...prev, status: "cancelled" }));
      clearTicket();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to cancel ticket";
      setCancelError(msg);
    } finally {
      setIsCancelling(false);
    }
  }

  async function handlePostponeTicket() {
    if (!activeTicketId) return;
    setIsDelaying(true);
    setDelayError("");
    setDelaySuccess("");
    try {
      const res = await postponeTicket(activeTicketId, delayPositions, ticketData.pin);
      setDelaySuccess(res.message);
      await syncLiveStatus();
      setTimeout(() => {
        setConfirmDelay(false);
        setDelaySuccess("");
      }, 1600);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delay position";
      setDelayError(msg);
    } finally {
      setIsDelaying(false);
    }
  }

  return (
    <main className="min-h-screen bg-canvas text-ink pb-24 selection:bg-mint selection:text-forest-dark">
      {/* ── Top Navigation Bar ── */}
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4 sm:px-8">
          <Logo />
          <div className="flex items-center gap-3">
            <span className="text-xs text-soft flex items-center gap-1.5 font-medium">
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-ok animate-pulse" : "bg-line-strong"}`} />
              <span>{isConnected ? "Live" : "Offline"}</span>
            </span>
            <button
              onClick={() => router.push("/")}
              className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink hover:border-forest/40 transition"
            >
              Exit
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-5 pt-8 sm:px-8">
        {/* ─────────────────────────────────────────────────────────────
            STATE 1: NOW CALLING (HIGH VELOCITY TAKEOVER)
        ───────────────────────────────────────────────────────────── */}
        {ticketData.status === "called" && (
          <div
            role="alert"
            className="summons-glow mb-8 overflow-hidden rounded-[2.5rem] bg-forest text-white p-7 sm:p-9 border-2 border-mint shadow-summons"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-mint">
                  <span className="h-2 w-2 rounded-full bg-mint animate-ping" />
                  Your Turn Now
                </span>
                <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
                  Proceed to {calledDeskName}
                </h1>
                <p className="mt-2 text-sm text-white/90 leading-relaxed">
                  The counter clerk is ready for Ticket{" "}
                  <span className="font-mono font-bold text-mint text-base">
                    {ticketData.ticket_number}
                  </span>{" "}
                  ({ticketData.customer_name}). Please show this screen at the desk.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-forest-dark/70 border border-white/15 p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">
                  Verification Code
                </p>
                <p className="mt-0.5 font-mono text-2xl font-bold tracking-widest text-mint">
                  {ticketData.pin}
                </p>
              </div>
              <button
                onClick={copyPin}
                type="button"
                className="rounded-xl bg-white/10 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/20 transition"
              >
                {copiedPin ? "Copied! ✓" : "Copy Code"}
              </button>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            STATE 2: SERVING AT DESK
        ───────────────────────────────────────────────────────────── */}
        {ticketData.status === "serving" && (
          <div className="mb-8 rounded-[2rem] bg-status-serving-bg border border-status-serving/30 p-6 sm:p-8 text-ink shadow-sm">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#0369a1] text-white shadow-sm">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#0369a1]">
                  Consultation in Progress
                </span>
                <h2 className="text-xl font-bold text-ink">Currently at {calledDeskName}</h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  Your request for {service.name} is being processed.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            STATE 3: COMPLETED RECEIPT
        ───────────────────────────────────────────────────────────── */}
        {ticketData.status === "completed" && (
          <div className="ticket-pop mb-8 rounded-[2.5rem] bg-surface p-8 sm:p-10 text-center shadow-elevated border border-line">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-surface-sunken text-forest mb-4 border border-line">
              <svg className="w-6 h-6 text-forest" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="font-display text-2xl font-bold text-ink">Service Concluded</h2>
            <p className="mt-2 text-sm text-ink-muted max-w-sm mx-auto leading-relaxed">
              Your consultation at {calledDeskName} for <strong>{service.name}</strong> is complete. Thank you for choosing Krenox!
            </p>
            <div className="mt-7 flex justify-center">
              <Button
                onClick={() => {
                  clearTicket();
                  router.push("/");
                }}
              >
                Return to Home →
              </Button>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            STATE 4: CANCELLED RECEIPT
        ───────────────────────────────────────────────────────────── */}
        {ticketData.status === "cancelled" && (
          <div className="ticket-pop mb-8 rounded-[2.5rem] bg-surface p-8 sm:p-10 text-center shadow-elevated border border-line">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-surface-sunken text-status-danger mb-4 border border-line">
              <svg className="w-6 h-6 text-status-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="font-display text-2xl font-bold text-ink">Ticket Cancelled</h2>
            <p className="mt-2 text-sm text-ink-muted max-w-sm mx-auto leading-relaxed">
              Ticket <span className="font-mono font-bold text-ink">{ticketData.ticket_number}</span> has been cancelled and your spot has been released.
            </p>
            <div className="mt-7 flex justify-center">
              <Button
                onClick={() => {
                  clearTicket();
                  router.push("/");
                }}
              >
                Return to Home →
              </Button>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            STATE 5: ABSENT OR SKIPPED
        ───────────────────────────────────────────────────────────── */}
        {(ticketData.status === "absent" || ticketData.status === "skipped") && (
          <div className="ticket-pop mb-8 rounded-[2.5rem] bg-surface p-8 sm:p-10 text-center shadow-elevated border border-line">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-surface-sunken text-ink-muted mb-4 border border-line">
              <svg className="w-6 h-6 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="font-display text-2xl font-bold text-ink">Call Window Expired</h2>
            <p className="mt-2 text-sm text-ink-muted max-w-sm mx-auto leading-relaxed">
              Ticket <span className="font-mono font-bold text-ink">{ticketData.ticket_number}</span> was called at {calledDeskName}, but was marked absent. If you are physically present, please speak with desk staff to recall your turn.
            </p>
            <div className="mt-7 flex justify-center">
              <Button
                onClick={() => {
                  clearTicket();
                  router.push("/");
                }}
              >
                Return to Home →
              </Button>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            CORE ARTIFACT: DIGITAL BOARDING PASS TICKET
        ───────────────────────────────────────────────────────────── */}
        {ticketData.status !== "completed" && ticketData.status !== "cancelled" && ticketData.status !== "absent" && ticketData.status !== "skipped" && (
          <div className="relative overflow-hidden rounded-[2.5rem] bg-surface border border-line shadow-elevated">
            {/* Ticket Header */}
            <div className="bg-forest px-6 py-6 sm:px-8 text-white relative">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-mint">
                    {ticketData.organisation_name || organisation.name}
                  </p>
                  <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-white">
                    {ticketData.service_name || service.name}
                  </h1>
                  <p className="mt-0.5 text-xs text-white/75">
                    {ticketData.facility_name || organisation.facility}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                    Ticket Number
                  </p>
                  <p className="font-mono text-2xl font-black tracking-wide text-white">
                    {ticketData.ticket_number}
                  </p>
                </div>
              </div>
            </div>

            {/* Perforated Divider Tear Line with Circular Notches */}
            <div className="relative flex items-center bg-surface py-3 px-6 sm:px-8 border-b border-dashed border-line">
              <div
                aria-hidden
                className="absolute -left-3.5 h-7 w-7 rounded-full bg-canvas border border-line"
              />
              <div
                aria-hidden
                className="absolute -right-3.5 h-7 w-7 rounded-full bg-canvas border border-line"
              />
              <div className="flex-1 flex justify-between text-[11px] font-semibold text-ink-subtle uppercase tracking-wider">
                <span>Digital Virtual Pass</span>
                <span>Active Queue</span>
              </div>
            </div>

            {/* Ticket Live Position Body */}
            <div className="p-6 sm:p-8">
              {/* Position Highlight Hero */}
              <div className="rounded-3xl bg-surface-sunken p-6 border border-line">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                    Your Live Position
                  </p>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                    <span className="h-1.5 w-1.5 rounded-full bg-forest animate-pulse" />
                    <strong className="font-semibold text-ink">{totalWaiting}</strong> in queue
                  </span>
                </div>

                <div className="mt-4 flex items-baseline gap-3">
                  <span className="font-mono text-6xl sm:text-7xl font-extrabold tracking-tight text-forest tabular-nums">
                    #{ticketData.status === "called" ? "1" : position}
                  </span>
                  <span className="text-sm font-medium text-ink-muted">
                    {ticketData.status === "called" ? (
                      <strong className="text-status-called">Now Summoned</strong>
                    ) : ahead === 0 ? (
                      <strong className="text-status-called">You are next!</strong>
                    ) : (
                      <>
                        <strong className="text-ink">{ahead}</strong> {ahead === 1 ? "person" : "people"} ahead of you
                      </>
                    )}
                  </span>
                </div>

                {/* 4-Stage Stepping Timeline */}
                <div className="mt-6 pt-5 border-t border-line/80">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-forest">Journey Status</span>
                    <span className="font-mono text-forest">
                      {position <= 1 ? "Counter Desk" : position <= 3 ? "Approaching Turn" : "In Line"}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {[
                      { label: "Joined", done: true },
                      { label: "In Line", done: position <= totalWaiting },
                      { label: "Approaching", done: position <= 3 },
                      { label: "At Desk", done: ticketData.status === "called" || ticketData.status === "serving" },
                    ].map((step, idx) => (
                      <div key={idx} className="flex flex-col gap-1.5">
                        <div
                          className={`h-2 rounded-full transition-colors duration-500 ${
                            step.done ? "bg-forest" : "bg-line"
                          }`}
                        />
                        <span className={`text-[10px] font-semibold text-center ${step.done ? "text-forest" : "text-ink-subtle"}`}>
                          {step.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Real-world Time Estimation Card */}
              <div className="mt-4 grid grid-cols-2 gap-3.5">
                <div className="rounded-2xl border border-line bg-surface p-4 shadow-subtle">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
                    Expected Service
                  </p>
                  <p className="mt-1 font-mono text-xl sm:text-2xl font-bold text-ink tabular-nums">
                    {ticketData.status === "called" ? "Right Now" : arrivalTimeFormatted}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-muted">
                    {ticketData.status === "called" ? "Counter ready" : `~${estWaitMinutes} mins remaining`}
                  </p>
                </div>

                <div className="rounded-2xl border border-line bg-surface p-4 shadow-subtle">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
                    Active Counters
                  </p>
                  <p className="mt-1 font-mono text-xl sm:text-2xl font-bold text-forest tabular-nums">
                    {openDesks} {openDesks === 1 ? "Desk" : "Desks"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-muted">
                    Serving tickets live
                  </p>
                </div>
              </div>

              {/* Security & Recovery Pass Details */}
              <div className="mt-6 rounded-2xl bg-surface-sunken border border-line p-4.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-forest uppercase tracking-wider">
                      Ticket Recovery PIN
                    </p>
                    <p className="mt-0.5 font-mono text-2xl font-bold tracking-widest text-ink tabular-nums">
                      {ticketData.pin}
                    </p>
                  </div>
                  <button
                    onClick={copyPin}
                    type="button"
                    className="rounded-xl border border-line bg-surface px-3.5 py-2 text-xs font-bold text-forest hover:bg-surface-hover shadow-sm transition active:scale-95"
                  >
                    {copiedPin ? "Copied! ✓" : "Copy PIN"}
                  </button>
                </div>

                {/* WhatsApp Status Indicator */}
                <div className="mt-3 pt-3 border-t border-line/80 flex items-center justify-between text-xs">
                  <span className="text-ink-muted flex items-center gap-1.5">
                    <span className="text-status-called font-bold">●</span>
                    {ticketData.reminder ? "WhatsApp Alerts Active" : "In-Browser Tracking"}
                  </span>
                  <span className="font-mono text-ink font-semibold">
                    {ticketData.masked_phone || "Protected"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Customer Control Actions ── */}
        {ticketData.status !== "completed" && ticketData.status !== "cancelled" && ticketData.status !== "absent" && ticketData.status !== "skipped" && (
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-center">
            {ticketData.status === "waiting" && position > 1 && (
              <button
                type="button"
                onClick={() => setConfirmDelay(true)}
                className="text-xs font-semibold text-ink-muted hover:text-ink hover:underline transition underline-offset-4 flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Running late? Delay spot
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setCancelError("");
                setConfirmCancel(true);
              }}
              className="text-xs font-semibold text-status-danger hover:underline transition underline-offset-4"
            >
              Cancel ticket / Leave queue
            </button>
          </div>
        )}
      </div>

      {/* ── Cancel Confirmation Modal ── */}
      {confirmCancel && (
        <Modal titleId="cancel-modal-title" onClose={() => !isCancelling && setConfirmCancel(false)} size="md">
          <div className="p-7 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-status-danger-bg text-status-danger mb-4 border border-status-danger/20">
              <svg className="w-6 h-6 text-status-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 id="cancel-modal-title" className="font-display text-xl font-bold text-ink">
              Leave this queue?
            </h3>
            <p className="mt-2 text-sm text-ink-muted leading-relaxed">
              If you leave now, you will forfeit Ticket{" "}
              <span className="font-mono font-bold text-ink">{ticketData.ticket_number}</span> and
              your position #{position}.
            </p>

            {cancelError && (
              <div className="mt-3 p-3 rounded-xl bg-status-danger-bg text-status-danger text-xs font-medium">
                {cancelError}
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                disabled={isCancelling}
                onClick={() => setConfirmCancel(false)}
              >
                Keep My Place
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                disabled={isCancelling}
                onClick={handleCancelTicket}
              >
                {isCancelling ? "Cancelling..." : "Cancel Ticket"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Delay Turn Modal ── */}
      {confirmDelay && (
        <Modal titleId="delay-modal-title" onClose={() => !isDelaying && setConfirmDelay(false)} size="md">
          <div className="p-7 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-surface-sunken text-forest mb-4 border border-line">
              <svg className="w-6 h-6 text-forest" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 id="delay-modal-title" className="font-display text-xl font-bold text-ink">
              Running Late? Hold Your Spot
            </h3>
            <p className="mt-2 text-sm text-ink-muted leading-relaxed">
              Need extra transit time? You can let a few people pass you without forfeiting your ticket.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3 text-left">
              <button
                type="button"
                onClick={() => setDelayPositions(3)}
                className={`p-3.5 rounded-2xl border text-sm transition ${
                  delayPositions === 3
                    ? "border-forest bg-forest/5 font-bold text-forest shadow-sm"
                    : "border-line bg-surface hover:bg-surface-hover text-ink"
                }`}
              >
                <div className="font-semibold">+3 Positions</div>
                <div className="text-xs text-ink-muted mt-0.5">~6 mins extra</div>
              </button>
              <button
                type="button"
                onClick={() => setDelayPositions(5)}
                className={`p-3.5 rounded-2xl border text-sm transition ${
                  delayPositions === 5
                    ? "border-forest bg-forest/5 font-bold text-forest shadow-sm"
                    : "border-line bg-surface hover:bg-surface-hover text-ink"
                }`}
              >
                <div className="font-semibold">+5 Positions</div>
                <div className="text-xs text-ink-muted mt-0.5">~10 mins extra</div>
              </button>
            </div>

            {delaySuccess && (
              <div className="mt-4 p-3 rounded-xl bg-forest/10 text-forest text-xs font-semibold">
                {delaySuccess}
              </div>
            )}

            {delayError && (
              <div className="mt-4 p-3 rounded-xl bg-status-danger-bg text-status-danger text-xs font-medium">
                {delayError}
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                disabled={isDelaying}
                onClick={() => setConfirmDelay(false)}
              >
                Keep Current Spot
              </Button>
              <Button
                className="flex-1"
                disabled={isDelaying}
                onClick={handlePostponeTicket}
              >
                {isDelaying ? "Updating Line..." : `Postpone by ${delayPositions} Spots`}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
