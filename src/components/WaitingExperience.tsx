"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cancelTicket, fetchTicketStatus, postponeTicket, type ApiQueueStatus } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Logo } from "@/components/ui";

const finishedStates = ["completed", "cancelled", "absent", "skipped"];

function stateCopy(status: string, ahead: number) {
  if (status === "called") return { label: "Your turn now", title: "Proceed to your desk", body: "The counter is ready. Please head there now and show your ticket.", tone: "called" };
  if (status === "serving") return { label: "Service in progress", title: "You are being served", body: "Your request is currently being handled at the desk.", tone: "serving" };
  if (status === "skipped" || status === "absent") return { label: "Call window missed", title: "Your ticket was skipped", body: "Please speak to staff if you are still at the facility.", tone: "skipped" };
  if (status === "completed") return { label: "Service completed", title: "All set", body: "Your ticket has been completed. Thank you for using Krenox.", tone: "complete" };
  if (status === "cancelled") return { label: "Ticket cancelled", title: "Your place is released", body: "This ticket is no longer active.", tone: "cancelled" };
  if (ahead <= 2) return { label: "Get ready", title: "Your turn is approaching", body: `Only ${ahead || "no"} ${ahead === 1 ? "person is" : "people are"} ahead. Start making your way to the service area.`, tone: "near" };
  return { label: "You can wait remotely", title: "You are safely in the queue", body: "We will keep this page updated and alert you before your turn.", tone: "waiting" };
}

const toneClasses: Record<string, string> = {
  waiting: "border-amber-300 bg-amber-50 text-amber-950",
  near: "border-amber-400 bg-amber-100 text-amber-950",
  called: "border-mint bg-forest text-white shadow-summons",
  serving: "border-sky-300 bg-sky-50 text-sky-950",
  skipped: "border-rose-300 bg-rose-50 text-rose-950",
  complete: "border-emerald-300 bg-emerald-50 text-emerald-950",
  cancelled: "border-slate-300 bg-slate-50 text-slate-950",
};

export default function WaitingExperience({ ticketId }: { ticketId?: string }) {
  const [loading, setLoading] = useState(Boolean(ticketId));
  const [error, setError] = useState("");
  const [queue, setQueue] = useState<ApiQueueStatus | null>(null);
  const [copied, setCopied] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const previousStatus = useRef<string | undefined>(undefined);
  const [generatedAt] = useState(() => Date.now());

  const sync = useCallback(async () => {
    if (!ticketId) return;
    try {
      const result = await fetchTicketStatus(ticketId);
      setQueue(result);
      setError("");
      setLoading(false);
      setIsConnected(true);
      localStorage.setItem("krenox_active_ticket", JSON.stringify(result.ticket));
      if (result.ticket.status === "called" && previousStatus.current && previousStatus.current !== "called") navigator.vibrate?.([160, 80, 160]);
      previousStatus.current = result.ticket.status;
    } catch (cause) {
      setLoading(false);
      setIsConnected(false);
      setError(cause instanceof Error ? cause.message : "We could not refresh this ticket.");
    }
  }, [ticketId]);

  useEffect(() => {
    const initialSync = window.setTimeout(() => void sync(), 0);
    const poll = window.setInterval(() => void sync(), 8000);
    const channel = supabase.channel(`ticket-${ticketId}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "tickets" }, () => void sync()).subscribe((status) => setIsConnected(status === "SUBSCRIBED"));
    return () => { window.clearTimeout(initialSync); window.clearInterval(poll); void supabase.removeChannel(channel); };
  }, [sync, ticketId]);

  async function copyPin() {
    if (!queue) return;
    await navigator.clipboard?.writeText(queue.ticket.pin);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function leaveQueue() {
    if (!queue || !ticketId || !window.confirm("Leave the queue? Your place will be released.")) return;
    setBusy(true);
    try { await cancelTicket(ticketId, queue.ticket.pin); await sync(); } finally { setBusy(false); }
  }

  async function delayQueue() {
    if (!queue || !ticketId || !window.confirm("Let three people pass you?")) return;
    setBusy(true);
    try { await postponeTicket(ticketId, 3, queue.ticket.pin); await sync(); } finally { setBusy(false); }
  }

  if (loading) return <main className="grid min-h-screen place-items-center bg-canvas p-6 text-center"><p role="status" className="font-semibold text-ink-muted">Loading your live ticket...</p></main>;
  if (!queue) return <main className="grid min-h-screen place-items-center bg-canvas p-6 text-center"><div><h1 className="text-2xl font-bold text-ink">Ticket unavailable</h1><p className="mt-2 text-ink-muted">{error || "This ticket could not be found."}</p><Link className="mt-5 inline-block font-semibold text-forest underline" href="/waiting">Recover a ticket</Link></div></main>;

  const ticket = queue.ticket;
  const ahead = Math.max(queue.customers_ahead, 0);
  const state = stateCopy(ticket.status, ahead);
  const isFinished = finishedStates.includes(ticket.status);
  const isCalled = ticket.status === "called";
  const expected = new Date(generatedAt + (ticket.estimated_wait_minutes || 0) * 60_000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <main className="min-h-screen bg-canvas pb-12 text-ink">
      <header className="border-b border-line bg-canvas/95 backdrop-blur"><div className="mx-auto flex max-w-xl items-center justify-between px-5 py-4"><Logo /><span className="inline-flex items-center gap-2 text-xs font-semibold text-ink-muted"><span className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-600" : "bg-slate-400"}`} />{isConnected ? "Live updates" : "Reconnecting"}</span></div></header>
      <div className="mx-auto max-w-xl px-5 pt-6 sm:pt-8">
        <p role="status" aria-atomic="true" className="sr-only">{state.title}. {ahead} people ahead. Estimated wait {ticket.estimated_wait_minutes || 0} minutes.</p>
        <section className={`rounded-3xl border p-6 sm:p-8 ${toneClasses[state.tone]}`} aria-labelledby="queue-state-title" role={isCalled ? "alert" : undefined}>
          <div className="flex items-start justify-between gap-4"><div><p className={`text-xs font-extrabold uppercase tracking-[0.16em] ${isCalled ? "text-mint" : "opacity-75"}`}>{state.label}</p><h1 id="queue-state-title" className="mt-2 font-display text-3xl font-bold tracking-tight">{isCalled ? `Go to ${ticket.desk_name || "your desk"}` : state.title}</h1><p className={`mt-3 max-w-md text-sm leading-6 ${isCalled ? "text-white/85" : "opacity-85"}`}>{state.body}</p></div><span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/20 text-xl">{isCalled ? "!" : state.tone === "skipped" ? "×" : "•"}</span></div>
        </section>

        {!isFinished && <section className="mt-4 rounded-3xl border border-line bg-surface p-6 shadow-card" aria-labelledby="ticket-summary-title"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-ink-subtle">{ticket.organisation_name || "Krenox"}</p><h2 id="ticket-summary-title" className="mt-1 text-xl font-bold">{ticket.service_name || "Service queue"}</h2><p className="mt-1 text-sm text-ink-muted">{ticket.facility_name || "Service facility"}</p></div><div className="text-right"><p className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">Your ticket</p><p className="font-mono text-2xl font-black text-forest">{ticket.ticket_number}</p></div></div><div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-amber-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-amber-800">Position</p><p className="mt-1 font-mono text-4xl font-black text-amber-950">#{isCalled ? 1 : ticket.position || 1}</p><p className="mt-1 text-xs text-amber-900">{ahead ? `${ahead} ${ahead === 1 ? "person" : "people"} ahead` : "You are next"}</p></div><div className={`rounded-2xl p-4 ${isCalled ? "bg-forest text-white" : "bg-mint-soft text-forest"}`}><p className="text-xs font-bold uppercase tracking-wider opacity-70">{isCalled ? "Desk" : "Expected service"}</p><p className="mt-1 font-mono text-2xl font-black">{isCalled ? ticket.desk_name || "Now" : expected}</p><p className="mt-2 text-xs opacity-80">{isCalled ? "Counter ready" : `About ${ticket.estimated_wait_minutes || 0} min remaining`}</p></div></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-surface-sunken"><div className="h-full rounded-full bg-forest transition-all duration-500" style={{ width: `${Math.min(100, Math.max(8, 100 - ahead * 10))}%` }} /></div><p className="mt-2 text-xs text-ink-muted">{ahead <= 2 ? "Stay nearby - your turn is close." : "You do not need to wait at the counter yet."}</p></section>}

        {!isFinished && <section className="mt-4 rounded-2xl border border-line bg-surface p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold">{ticket.reminder_opt_in ? "WhatsApp alerts are on" : "Browser tracking is on"}</p><p className="mt-0.5 text-xs text-ink-muted">{ticket.reminder_opt_in ? `${ticket.masked_phone || "Your number"} will receive your queue alerts.` : "Keep this page open for live updates."}</p></div><span aria-hidden className={`h-3 w-3 rounded-full ${ticket.reminder_opt_in ? "bg-emerald-600" : "bg-slate-400"}`} /></div></section>}
        {!isFinished && <div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={delayQueue} disabled={busy || isCalled} className="min-h-11 rounded-xl border border-line px-4 text-sm font-bold text-ink-muted disabled:opacity-40">Need more time?</button><button type="button" onClick={leaveQueue} disabled={busy} className="min-h-11 rounded-xl px-4 text-sm font-bold text-status-danger hover:bg-status-danger-bg disabled:opacity-40">Leave queue</button></div>}
        <section className="mt-7 border-t border-line pt-5"><button type="button" onClick={() => setDetailsOpen((open) => !open)} className="flex w-full items-center justify-between text-left text-sm font-bold text-forest" aria-expanded={detailsOpen}>Ticket details <span aria-hidden>{detailsOpen ? "−" : "+"}</span></button>{detailsOpen && <div className="mt-4 rounded-2xl bg-surface-sunken p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-ink-subtle">Recovery PIN</p><p className="mt-1 font-mono text-2xl font-bold tracking-widest">{ticket.pin}</p></div><button type="button" onClick={copyPin} className="min-h-11 rounded-xl border border-line bg-surface px-4 text-sm font-bold text-forest">{copied ? "Copied" : "Copy PIN"}</button></div></div>}</section>
      </div>
    </main>
  );
}
