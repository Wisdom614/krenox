"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Logo } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import {
  ApiService,
  StaffQueueState,
  callNextTicket,
  fetchServices,
  fetchStaffQueue,
  updateTicketStatus,
} from "@/lib/api";

export default function StaffPage() {
  const router = useRouter();
  const { user, role, loading: authLoading, signOut } = useAuth();

  const [services, setServices] = useState<ApiService[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [deskName, setDeskName] = useState<string>("Desk 1");
  const [queueState, setQueueState] = useState<StaffQueueState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Route Guard: enforce authentication
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/staff");
    }
  }, [authLoading, user, router]);

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

  // Poll queue state every 3.5 seconds
  const refreshQueue = useCallback(async () => {
    if (!selectedServiceId || !user) return;
    try {
      const data = await fetchStaffQueue(selectedServiceId);
      setQueueState(data);
      setErrorMessage("");
    } catch {
      // Keep previous state if network hiccup
    }
  }, [selectedServiceId, user]);

  useEffect(() => {
    let active = true;
    if (selectedServiceId && user) {
      fetchStaffQueue(selectedServiceId)
        .then((data) => {
          if (active) {
            setQueueState(data);
            setErrorMessage("");
          }
        })
        .catch(() => {});
    }

    const interval = setInterval(() => {
      if (selectedServiceId && active && user) {
        fetchStaffQueue(selectedServiceId)
          .then((data) => {
            if (active) {
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
  }, [selectedServiceId, user]);

  async function handleCallNext() {
    if (!selectedServiceId) return;
    setIsLoading(true);
    setActionMessage("");
    setErrorMessage("");
    try {
      const res = await callNextTicket(selectedServiceId, deskName);
      setActionMessage(`📢 ${res.message} (WhatsApp alert sent!)`);
      await refreshQueue();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error calling next ticket";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStatusChange(ticketId: string, status: string) {
    setIsLoading(true);
    setActionMessage("");
    setErrorMessage("");
    try {
      await updateTicketStatus(ticketId, status);
      setActionMessage(`Updated ticket status to "${status}".`);
      await refreshQueue();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error updating status";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }

  if (authLoading || !user) {
    return (
      <main className="min-h-screen bg-[#f3f6f5] flex items-center justify-center p-6 text-center">
        <div className="p-8 rounded-3xl bg-white border border-line-strong shadow-lg max-w-sm w-full">
          <div className="w-12 h-12 rounded-2xl bg-brand text-white flex items-center justify-center font-bold text-lg mx-auto mb-3 animate-pulse">
            UB
          </div>
          <h2 className="text-base font-bold text-ink">Verifying Operator Clearance...</h2>
          <p className="text-xs text-soft mt-1">Authenticating credentials with University server</p>
        </div>
      </main>
    );
  }

  const selectedService = services.find((s) => s.id === selectedServiceId);

  return (
    <main className="min-h-screen bg-[#f3f6f5] text-ink pb-20 selection:bg-brand selection:text-white">
      {/* ── Top Bar ── */}
      <header className="border-b border-line/70 bg-white sticky top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Logo />
            <span className="rounded-full bg-ink px-3 py-1 text-xs font-bold text-white">
              Staff Console
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Desk Selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="desk-select" className="text-xs font-semibold text-soft">My Counter:</label>
              <select
                id="desk-select"
                value={deskName}
                onChange={(e) => setDeskName(e.target.value)}
                className="rounded-xl border border-line-strong bg-white px-3 py-1.5 text-xs font-bold text-ink outline-none focus:border-brand"
              >
                <option value="Desk 1">Desk 1</option>
                <option value="Desk 2">Desk 2</option>
                <option value="Desk 3">Desk 3</option>
                <option value="Counter A">Counter A</option>
              </select>
            </div>
            {role === "admin" && (
              <Link
                href="/admin"
                className="text-xs font-semibold text-soft hover:text-brand transition"
              >
                Admin & Kiosks
              </Link>
            )}
            <Link
              href="/simulation"
              className="text-xs font-semibold text-soft hover:text-brand transition"
            >
              Simulation
            </Link>

            <div className="flex items-center gap-2.5 pl-3 border-l border-line">
              <div className="text-right hidden sm:block">
                <div className="text-[11px] font-bold text-ink leading-tight">{user.email}</div>
                <div className="text-[10px] text-brand font-bold uppercase tracking-wider">
                  {role === "admin" ? "Administrator" : "Counter Operator"}
                </div>
              </div>
              <button
                onClick={async () => {
                  await signOut();
                  router.push("/login");
                }}
                className="px-3 py-1.5 rounded-full text-xs font-bold text-danger bg-rose-50 hover:bg-rose-100 border border-danger/30 transition-colors"
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
                    ? "bg-brand text-white shadow-md"
                    : "bg-white text-soft border border-line hover:border-brand"
                }`}
              >
                {svc.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-6 text-xs text-soft">
            <span>
              Waiting:{" "}
              <strong className="text-sm font-bold text-ink">
                {queueState?.total_waiting ?? 0}
              </strong>
            </span>
            <span>
              Completed Today:{" "}
              <strong className="text-sm font-bold text-ok">
                {queueState?.total_completed ?? 0}
              </strong>
            </span>
          </div>
        </div>

        {/* ── Notification Feedback Banners ── */}
        {actionMessage && (
          <div className="mt-4 rounded-2xl bg-[#e9f7f0] p-4 text-xs font-bold text-ok border border-ok/20">
            {actionMessage}
          </div>
        )}
        {errorMessage && (
          <div className="mt-4 rounded-2xl bg-[#fde8e8] p-4 text-xs font-bold text-danger border border-danger/20">
            {errorMessage}
          </div>
        )}

        {/* ── Main Operations Grid ── */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.3fr]">
          {/* LEFT: Current Desk Action & Now Calling */}
          <div>
            <div className="rounded-[2rem] border border-white/80 bg-white p-6 sm:p-8 shadow-sm">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div>
                  <h2 className="text-lg font-bold text-ink">{deskName} Operator</h2>
                  <p className="text-xs text-soft">{selectedService?.name}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e9f7f0] px-3 py-1 text-xs font-bold text-ok">
                  <span className="h-2 w-2 rounded-full bg-ok animate-pulse" /> Active Operator
                </span>
              </div>

              {/* Call Next Button Hero */}
              <div className="my-8 text-center">
                <Button
                  onClick={handleCallNext}
                  disabled={isLoading || (queueState?.total_waiting ?? 0) === 0}
                  className="!px-10 !py-5 !text-lg !bg-brand hover:!bg-brand-dark !shadow-[0_16px_40px_rgba(13,101,112,.3)] transition-all active:scale-95 w-full sm:w-auto"
                >
                  📢 Call Next Ticket
                </Button>
                <p className="mt-3 text-xs text-soft">
                  Fires instantaneous WhatsApp message to customer&apos;s phone.
                </p>
              </div>

              {/* Currently Serving or Called at this Queue */}
              <div className="border-t border-line pt-6">
                <h3 className="text-xs font-bold text-soft uppercase tracking-wider mb-4">
                  Tickets Currently Called / In Service
                </h3>

                {queueState?.serving && queueState.serving.length > 0 ? (
                  <div className="grid gap-3">
                    {queueState.serving.map((t) => (
                      <div
                        key={t.id}
                        className="rounded-2xl border border-brand/20 bg-mint p-4 transition"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-mono text-xl font-bold text-brand">
                              {t.ticket_number}
                            </span>
                            <p className="text-xs font-medium text-ink mt-0.5">
                              {t.customer_name}{" "}
                              {t.customer_phone && (
                                <span className="text-soft font-mono">({t.customer_phone})</span>
                              )}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              t.status === "called"
                                ? "bg-[#fff1d6] text-warn animate-pulse"
                                : "bg-[#e4f4ed] text-ok"
                            }`}
                          >
                            ● {t.status.toUpperCase()}
                          </span>
                        </div>

                        {/* Status Change Buttons */}
                        <div className="mt-4 flex flex-wrap gap-2 border-t border-brand/10 pt-3">
                          {t.status === "called" && (
                            <button
                              onClick={() => handleStatusChange(t.id, "serving")}
                              className="rounded-xl bg-ok px-3 py-1.5 text-xs font-bold text-white hover:bg-ok/80 transition"
                            >
                              Arrived / Start Serving
                            </button>
                          )}
                          <button
                            onClick={() => handleStatusChange(t.id, "completed")}
                            className="rounded-xl bg-brand px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-dark transition"
                          >
                            Mark Completed ✓
                          </button>
                          <button
                            onClick={() => handleStatusChange(t.id, "skipped")}
                            className="rounded-xl bg-white border border-line px-3 py-1.5 text-xs font-bold text-soft hover:text-ink transition"
                          >
                            Skip
                          </button>
                          <button
                            onClick={() => handleStatusChange(t.id, "absent")}
                            className="rounded-xl bg-white border border-danger/30 px-3 py-1.5 text-xs font-bold text-danger hover:bg-[#fde8e8] transition"
                          >
                            Absent
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl bg-[#fafbf9] p-6 text-center text-xs text-soft border border-line/60">
                    No tickets currently called. Click &quot;Call Next Ticket&quot; when ready.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: Live Waiting List (FIFO) */}
          <div>
            <div className="rounded-[2rem] border border-white/80 bg-white p-6 sm:p-8 shadow-sm">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div>
                  <h2 className="text-lg font-bold text-ink">Upcoming Waiting Queue</h2>
                  <p className="text-xs text-soft">First-In First-Out (FIFO) service order</p>
                </div>
                <span className="font-mono text-xs font-bold text-brand bg-mint px-3 py-1 rounded-full">
                  {queueState?.waiting.length ?? 0} in line
                </span>
              </div>

              <div className="mt-4">
                {queueState?.waiting && queueState.waiting.length > 0 ? (
                  <div className="divide-y divide-line/60">
                    {queueState.waiting.map((t, idx) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between py-4 hover:bg-[#fafbf9] px-2 rounded-xl transition"
                      >
                        <div className="flex items-center gap-4">
                          <span className="grid h-8 w-8 place-items-center rounded-xl bg-mint text-xs font-bold text-brand font-mono">
                            #{idx + 1}
                          </span>
                          <div>
                            <span className="font-mono text-base font-bold text-ink">
                              {t.ticket_number}
                            </span>
                            <p className="text-xs text-soft">
                              {t.customer_name} · Joined{" "}
                              {new Date(t.joined_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-bold text-soft bg-[#f3f6f5] px-2.5 py-1 rounded-lg">
                            PIN: {t.pin}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-16 text-center">
                    <p className="text-sm font-semibold text-soft">Queue is currently empty!</p>
                    <p className="mt-1 text-xs text-soft">
                      New tickets taken by students on their phones will appear here automatically.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

