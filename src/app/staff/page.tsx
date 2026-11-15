"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Logo, Modal } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import {
  ApiService,
  StaffQueueState,
  AdminDesk,
  ApiTicket,
  callNextTicket,
  fetchServices,
  fetchStaffQueue,
  updateTicketStatus,
  fetchStaffDesks,
  toggleStaffDesk,
  transferTicket,
  recallTicket,
} from "@/lib/api";

export default function StaffPage() {
  const router = useRouter();
  const { user, role, loading: authLoading, signOut } = useAuth();

  const [services, setServices] = useState<ApiService[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");

  // Counter Desk State
  const [desks, setDesks] = useState<AdminDesk[]>([]);
  const [selectedDeskId, setSelectedDeskId] = useState<string>("");
  const [deskName, setDeskName] = useState<string>("Desk 1");
  const [isDeskOpen, setIsDeskOpen] = useState<boolean>(true);

  // Queue Telemetry State
  const [queueState, setQueueState] = useState<StaffQueueState | null>(null);
  const [recentlyDismissed, setRecentlyDismissed] = useState<ApiTicket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Transfer Ticket Modal State
  const [transferModal, setTransferModal] = useState<{
    isOpen: boolean;
    ticket: ApiTicket | null;
    targetServiceId: string;
    priority: "normal" | "urgent";
    reason: string;
    submitting: boolean;
    error: string;
  }>({
    isOpen: false,
    ticket: null,
    targetServiceId: "",
    priority: "normal",
    reason: "",
    submitting: false,
    error: "",
  });

  const prevWaitingCountRef = useRef<number>(0);

  // Synthesized harmonic chime for staff when new ticket joins
  const playQueueAlertSound = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.12); // E5
      gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.45);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch {
      // Audio policy catch
    }
  }, []);

  // Route Guard: enforce authentication
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/staff");
    }
  }, [authLoading, user, router]);

  // Load configured desks
  useEffect(() => {
    if (!user) return;
    fetchStaffDesks()
      .then((loadedDesks) => {
        if (loadedDesks && loadedDesks.length > 0) {
          setDesks(loadedDesks);
          const savedDeskId = typeof window !== "undefined" ? localStorage.getItem("krenox_staff_desk_id") : null;
          const matched = (savedDeskId ? loadedDesks.find((d) => d.id === savedDeskId) : null) || loadedDesks[0];
          setSelectedDeskId(matched.id);
          setDeskName(matched.name);
          setIsDeskOpen(matched.is_open);
        }
      })
      .catch(() => {});
  }, [user]);

  // Load available services
  useEffect(() => {
    if (!user) return;
    fetchServices().then((svcs) => {
      if (svcs && svcs.length > 0) {
        setServices(svcs);
        setSelectedServiceId(svcs[0].id);
      }
    });
  }, [user]);

  // Desk switch handler
  function handleDeskChange(newDeskId: string) {
    setSelectedDeskId(newDeskId);
    const found = desks.find((d) => d.id === newDeskId);
    if (found) {
      setDeskName(found.name);
      setIsDeskOpen(found.is_open);
      if (typeof window !== "undefined") {
        localStorage.setItem("krenox_staff_desk_id", found.id);
      }
    }
  }

  // Toggle desk open/closed
  async function handleToggleDesk() {
    if (!selectedDeskId) return;
    try {
      const res = await toggleStaffDesk(selectedDeskId);
      setIsDeskOpen(res.is_open);
      setDesks((prev) =>
        prev.map((d) => (d.id === selectedDeskId ? { ...d, is_open: res.is_open } : d))
      );
      setActionMessage(`Counter ${deskName} is now ${res.is_open ? "OPEN and ready" : "CLOSED"}.`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to toggle desk state");
    }
  }

  // Refresh queue state
  const refreshQueue = useCallback(async () => {
    if (!selectedServiceId || !user) return;
    try {
      const data = await fetchStaffQueue(selectedServiceId);
      if (data) {
        const currentCount = data.waiting.length;
        if (prevWaitingCountRef.current > 0 && currentCount > prevWaitingCountRef.current) {
          playQueueAlertSound();
        }
        prevWaitingCountRef.current = currentCount;
        setQueueState(data);
        setErrorMessage("");
      }
    } catch {
      // Keep previous state if network hiccup
    }
  }, [selectedServiceId, user, playQueueAlertSound]);

  // Polling loop
  useEffect(() => {
    let active = true;
    if (selectedServiceId && user) {
      fetchStaffQueue(selectedServiceId)
        .then((data) => {
          if (active && data) {
            setQueueState(data);
            prevWaitingCountRef.current = data.waiting.length;
            setErrorMessage("");
          }
        })
        .catch(() => {});
    }

    const interval = setInterval(() => {
      if (selectedServiceId && active && user) {
        fetchStaffQueue(selectedServiceId)
          .then((data) => {
            if (active && data) {
              const currentCount = data.waiting.length;
              if (prevWaitingCountRef.current > 0 && currentCount > prevWaitingCountRef.current) {
                playQueueAlertSound();
              }
              prevWaitingCountRef.current = currentCount;
              setQueueState(data);
              setErrorMessage("");
            }
          })
          .catch(() => {});
      }
    }, 3500);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [selectedServiceId, user, playQueueAlertSound]);

  async function handleCallNext() {
    if (!selectedServiceId) return;
    setIsLoading(true);
    setActionMessage("");
    setErrorMessage("");
    try {
      const res = await callNextTicket(selectedServiceId, deskName, selectedDeskId);
      setActionMessage(`${res.message} — WhatsApp notification sent.`);
      await refreshQueue();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error calling next ticket";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStatusChange(ticket: ApiTicket, status: string) {
    setIsLoading(true);
    setActionMessage("");
    setErrorMessage("");
    try {
      await updateTicketStatus(ticket.id, status);
      if (status === "skipped" || status === "absent") {
        setRecentlyDismissed((prev) => [ticket, ...prev.filter((t) => t.id !== ticket.id)].slice(0, 5));
      }
      setActionMessage(`Updated ticket ${ticket.ticket_number} status to "${status}".`);
      await refreshQueue();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error updating status";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRecall(ticket: ApiTicket) {
    setIsLoading(true);
    setActionMessage("");
    setErrorMessage("");
    try {
      const res = await recallTicket(ticket.id, deskName);
      setRecentlyDismissed((prev) => prev.filter((t) => t.id !== ticket.id));
      setActionMessage(res.message);
      await refreshQueue();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to recall ticket";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }

  function openTransferModal(ticket: ApiTicket) {
    const otherServices = services.filter((s) => s.id !== selectedServiceId);
    setTransferModal({
      isOpen: true,
      ticket,
      targetServiceId: otherServices.length > 0 ? otherServices[0].id : "",
      priority: "normal",
      reason: "",
      submitting: false,
      error: "",
    });
  }

  async function handleTransferSubmit() {
    if (!transferModal.ticket || !transferModal.targetServiceId) return;
    setTransferModal((prev) => ({ ...prev, submitting: true, error: "" }));
    try {
      const res = await transferTicket(
        transferModal.ticket.id,
        transferModal.targetServiceId,
        transferModal.reason,
        transferModal.priority
      );
      setActionMessage(res.message);
      setTransferModal({
        isOpen: false,
        ticket: null,
        targetServiceId: "",
        priority: "normal",
        reason: "",
        submitting: false,
        error: "",
      });
      await refreshQueue();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to transfer ticket";
      setTransferModal((prev) => ({ ...prev, submitting: false, error: msg }));
    }
  }

  if (authLoading || !user) {
    return (
      <main className="min-h-screen bg-[#f3f6f5] flex items-center justify-center p-6 text-center">
        <div className="p-8 rounded-3xl bg-white border border-line shadow-lg max-w-sm w-full">
          <div className="w-12 h-12 rounded-2xl bg-forest text-mint flex items-center justify-center font-bold text-lg mx-auto mb-3 animate-pulse">
            KX
          </div>
          <h2 className="text-base font-bold text-ink">Verifying Operator Clearance...</h2>
          <p className="text-xs text-ink-muted mt-1">Authenticating session credentials</p>
        </div>
      </main>
    );
  }

  const selectedService = services.find((s) => s.id === selectedServiceId);
  const otherServices = services.filter((s) => s.id !== selectedServiceId);

  return (
    <main className="min-h-screen bg-[#f3f6f5] text-ink pb-20 selection:bg-forest selection:text-white">
      {/* ── Top Bar ── */}
      <header className="border-b border-line/70 bg-white sticky top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Logo size="md" variant="dark" />
            <span className="text-line-strong hidden sm:inline">/</span>
            <span className="text-xs font-bold text-ink tracking-tight uppercase">
              Staff Operations Console
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Dynamic Desk Selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="desk-select" className="text-xs font-semibold text-ink-muted">
                Active Counter:
              </label>
              <select
                id="desk-select"
                value={selectedDeskId}
                onChange={(e) => handleDeskChange(e.target.value)}
                className="rounded-xl border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink outline-none focus:border-forest"
              >
                {desks.length > 0 ? (
                  desks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} {d.is_open ? "· Open" : "· Closed"}
                    </option>
                  ))
                ) : (
                  <option value="">Desk 1</option>
                )}
              </select>

              {/* Desk Open/Closed Toggle */}
              <button
                type="button"
                onClick={handleToggleDesk}
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition ${
                  isDeskOpen
                    ? "bg-forest/10 text-forest border-forest/30 hover:bg-forest/20"
                    : "bg-surface-sunken text-ink-muted border-line hover:text-ink"
                }`}
                title={isDeskOpen ? "Click to close this desk" : "Click to open this desk"}
              >
                {isDeskOpen ? "Desk Open" : "Desk Closed"}
              </button>
            </div>

            {role === "tenant_admin" && (
              <Link
                href="/tenant-admin"
                className="text-xs font-bold text-forest bg-forest/10 hover:bg-forest/20 px-3 py-1.5 rounded-xl transition"
              >
                🏢 Organisation Admin →
              </Link>
            )}

            {role === "super_admin" && (
              <Link
                href="/admin"
                className="text-xs font-bold text-forest bg-forest/10 hover:bg-forest/20 px-3 py-1.5 rounded-xl transition"
              >
                ⚙️ Super Admin →
              </Link>
            )}

            <div className="flex items-center gap-2.5 pl-3 border-l border-line">
              <div className="text-right hidden sm:block">
                <div className="text-[11px] font-bold text-ink leading-tight">{user.email}</div>
                <div className="text-[10px] text-forest font-bold uppercase tracking-wider">
                  {role === "tenant_admin"
                    ? "Organisation Admin"
                    : role === "super_admin"
                    ? "Platform Admin"
                    : "Counter Operator"}
                </div>
              </div>
              <button
                onClick={async () => {
                  await signOut();
                  router.push("/login");
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-status-danger hover:bg-status-danger-bg transition"
                title="Sign Out"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 pt-8">
        {/* ── Service Tabs ── */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          <div className="flex flex-wrap gap-2">
            {services.map((svc) => (
              <button
                key={svc.id}
                onClick={() => setSelectedServiceId(svc.id)}
                className={`rounded-2xl px-5 py-2.5 text-sm font-bold transition ${
                  selectedServiceId === svc.id
                    ? "bg-forest text-white shadow-sm"
                    : "bg-white text-ink-muted border border-line hover:border-forest hover:text-ink"
                }`}
              >
                {svc.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-6 text-xs text-ink-muted">
            <span>
              Waiting:{" "}
              <strong className="text-sm font-bold text-ink font-mono">
                {queueState?.total_waiting ?? 0}
              </strong>
            </span>
            <span>
              Completed Today:{" "}
              <strong className="text-sm font-bold text-forest font-mono">
                {queueState?.total_completed ?? 0}
              </strong>
            </span>
          </div>
        </div>

        {/* ── Feedback Banners ── */}
        {actionMessage && (
          <div className="mt-4 rounded-2xl bg-[#e9f7f0] p-4 text-xs font-bold text-forest border border-forest/20 flex items-center justify-between">
            <span>{actionMessage}</span>
            <button onClick={() => setActionMessage("")} className="text-forest hover:opacity-70 text-sm">
              ✕
            </button>
          </div>
        )}
        {errorMessage && (
          <div className="mt-4 rounded-2xl bg-status-danger-bg p-4 text-xs font-bold text-status-danger border border-status-danger/20 flex items-center justify-between">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage("")} className="text-status-danger hover:opacity-70 text-sm">
              ✕
            </button>
          </div>
        )}

        {/* ── Main Operations Grid ── */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.3fr]">
          {/* LEFT: Current Desk Action & Now Calling */}
          <div>
            <div className="rounded-[2rem] border border-line bg-white p-6 sm:p-8 shadow-sm">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div>
                  <h2 className="text-lg font-bold text-ink">{deskName} Station</h2>
                  <p className="text-xs text-ink-muted">{selectedService?.name}</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-forest">
                  <span className={`h-2 w-2 rounded-full ${isDeskOpen ? "bg-forest animate-pulse" : "bg-line-strong"}`} />
                  <span>{isDeskOpen ? "Station Active" : "Station Offline"}</span>
                </div>
              </div>

              {/* Call Next Button Hero */}
              <div className="my-8 text-center">
                <Button
                  onClick={handleCallNext}
                  disabled={isLoading || (queueState?.total_waiting ?? 0) === 0 || !isDeskOpen}
                  className="!px-10 !py-5 !text-lg !bg-forest hover:!bg-forest-dark !shadow-lg transition-all active:scale-95 w-full sm:w-auto"
                >
                  Call Next Ticket
                </Button>
                <p className="mt-3 text-xs text-ink-muted">
                  Calls oldest waiting ticket and dispatches instant WhatsApp summons with counter destination.
                </p>
              </div>

              {/* Currently Serving or Called at this Queue */}
              <div className="border-t border-line pt-6">
                <h3 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-4">
                  Tickets Currently Called or In Consultation
                </h3>

                {queueState?.serving && queueState.serving.length > 0 ? (
                  <div className="grid gap-3">
                    {queueState.serving.map((t) => (
                      <div
                        key={t.id}
                        className="rounded-2xl border border-line bg-surface-sunken p-4.5 transition"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-mono text-xl font-bold text-forest">
                              {t.ticket_number}
                            </span>
                            <p className="text-xs font-medium text-ink mt-0.5">
                              {t.customer_name}{" "}
                              {t.customer_phone && (
                                <span className="text-ink-muted font-mono">({t.customer_phone})</span>
                              )}
                            </p>
                          </div>
                          <span
                            className={`text-xs font-bold uppercase tracking-wider ${
                              t.status === "called"
                                ? "text-amber-700 animate-pulse"
                                : "text-forest"
                            }`}
                          >
                            ● {t.status}
                          </span>
                        </div>

                        {/* Status Change Buttons */}
                        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
                          {t.status === "called" && (
                            <button
                              onClick={() => handleStatusChange(t, "serving")}
                              className="rounded-xl bg-forest px-3 py-1.5 text-xs font-semibold text-white hover:bg-forest-dark transition"
                            >
                              Arrived / Begin Service
                            </button>
                          )}
                          <button
                            onClick={() => handleStatusChange(t, "completed")}
                            className="rounded-xl bg-forest/15 px-3 py-1.5 text-xs font-semibold text-forest hover:bg-forest/25 transition"
                          >
                            Conclude Service
                          </button>
                          <button
                            onClick={() => openTransferModal(t)}
                            className="rounded-xl bg-white border border-line px-3 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink hover:border-forest transition"
                          >
                            Transfer Ticket
                          </button>
                          <button
                            onClick={() => handleStatusChange(t, "skipped")}
                            className="rounded-xl bg-white border border-line px-3 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink transition"
                          >
                            Skip
                          </button>
                          <button
                            onClick={() => handleStatusChange(t, "absent")}
                            className="rounded-xl bg-white border border-status-danger/30 px-3 py-1.5 text-xs font-semibold text-status-danger hover:bg-status-danger-bg transition"
                          >
                            Absent / No-Show
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl bg-surface-sunken p-6 text-center text-xs text-ink-muted border border-line">
                    No tickets currently called. Click &quot;Call Next Ticket&quot; when your desk is ready.
                  </div>
                )}
              </div>

              {/* Recently Skipped / Absent Recall Tray */}
              {recentlyDismissed.length > 0 && (
                <div className="border-t border-line mt-6 pt-5">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-2">
                    Recently Skipped / Absent (Quick Recall)
                  </h4>
                  <div className="divide-y divide-line/60">
                    {recentlyDismissed.map((t) => (
                      <div key={t.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-mono font-bold text-ink">{t.ticket_number}</span> ·{" "}
                          <span className="text-ink-muted">{t.customer_name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRecall(t)}
                          className="text-xs font-semibold text-forest hover:underline"
                        >
                          Recall to {deskName} ↺
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Live Waiting List (FIFO) */}
          <div>
            <div className="rounded-[2rem] border border-line bg-white p-6 sm:p-8 shadow-sm">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div>
                  <h2 className="text-lg font-bold text-ink">Upcoming Waiting Queue</h2>
                  <p className="text-xs text-ink-muted">First-In First-Out (FIFO) service sequence</p>
                </div>
                <span className="font-mono text-xs font-bold text-forest">
                  {queueState?.waiting.length ?? 0} waiting
                </span>
              </div>

              <div className="mt-4">
                {queueState?.waiting && queueState.waiting.length > 0 ? (
                  <div className="divide-y divide-line/60">
                    {queueState.waiting.map((t, idx) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between py-4 hover:bg-surface-sunken/60 px-3 rounded-xl transition"
                      >
                        <div className="flex items-center gap-4">
                          <span className="grid h-8 w-8 place-items-center rounded-xl bg-forest/10 text-xs font-bold text-forest font-mono">
                            #{idx + 1}
                          </span>
                          <div>
                            <span className="font-mono text-base font-bold text-ink">
                              {t.ticket_number}
                            </span>
                            <p className="text-xs text-ink-muted">
                              {t.customer_name} · Joined{" "}
                              {new Date(t.joined_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => openTransferModal(t)}
                            className="text-[11px] font-semibold text-ink-muted hover:text-forest transition"
                            title="Reroute ticket to another counter or department"
                          >
                            Transfer
                          </button>
                          <span className="text-xs font-mono font-medium text-ink-muted bg-surface-sunken px-2.5 py-1 rounded-lg border border-line">
                            PIN: {t.pin}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-16 text-center">
                    <p className="text-sm font-semibold text-ink-muted">Queue is currently clear.</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      New customer registrations will appear here in real time.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Transfer Ticket Modal ── */}
      {transferModal.isOpen && transferModal.ticket && (
        <Modal
          titleId="transfer-modal-title"
          onClose={() => !transferModal.submitting && setTransferModal((prev) => ({ ...prev, isOpen: false }))}
          size="md"
        >
          <div className="p-7">
            <h3 id="transfer-modal-title" className="font-display text-xl font-bold text-ink">
              Transfer Ticket {transferModal.ticket.ticket_number}
            </h3>
            <p className="mt-1 text-xs text-ink-muted">
              Redirect customer {transferModal.ticket.customer_name} to a different department or counter.
            </p>

            {transferModal.error && (
              <div className="mt-4 p-3 rounded-xl bg-status-danger-bg text-status-danger text-xs font-medium">
                {transferModal.error}
              </div>
            )}

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-ink block mb-1">
                  Destination Service Line:
                </label>
                <select
                  value={transferModal.targetServiceId}
                  onChange={(e) => setTransferModal((prev) => ({ ...prev, targetServiceId: e.target.value }))}
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs font-medium text-ink outline-none focus:border-forest"
                >
                  {otherServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.avg_duration_minutes}m avg duration)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-ink block mb-1">
                  Queue Priority:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTransferModal((prev) => ({ ...prev, priority: "normal" }))}
                    className={`p-3 rounded-xl border text-xs text-left transition ${
                      transferModal.priority === "normal"
                        ? "border-forest bg-forest/5 font-bold text-forest"
                        : "border-line text-ink-muted hover:text-ink"
                    }`}
                  >
                    <div>Standard FIFO</div>
                    <div className="text-[10px] text-ink-muted mt-0.5">Joins regular waiting line</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransferModal((prev) => ({ ...prev, priority: "urgent" }))}
                    className={`p-3 rounded-xl border text-xs text-left transition ${
                      transferModal.priority === "urgent"
                        ? "border-forest bg-forest/5 font-bold text-forest"
                        : "border-line text-ink-muted hover:text-ink"
                    }`}
                  >
                    <div>Urgent / Front-of-Line</div>
                    <div className="text-[10px] text-ink-muted mt-0.5">Prioritized next at desk</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-ink block mb-1">
                  Transfer Note / Reason (Optional):
                </label>
                <input
                  type="text"
                  value={transferModal.reason}
                  onChange={(e) => setTransferModal((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder="e.g., Needs financial clearance before course registration"
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-2 text-xs text-ink outline-none focus:border-forest"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                disabled={transferModal.submitting}
                onClick={() => setTransferModal((prev) => ({ ...prev, isOpen: false }))}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                disabled={transferModal.submitting || !transferModal.targetServiceId}
                onClick={handleTransferSubmit}
              >
                {transferModal.submitting ? "Transferring..." : "Confirm Transfer"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
