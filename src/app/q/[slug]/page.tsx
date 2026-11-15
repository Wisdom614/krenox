"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Logo } from "@/components/ui";
import { Footer } from "@/components/Footer";
import { saveTicketPin } from "@/lib/ticket-credentials";
import WaitingExperience from "@/components/WaitingExperience";
import {
  fetchPublicTenantQueues,
  joinQueue,
  PublicTenantQueuesResponse,
  PublicTenantService,
  PublicTenantFacility,
  ApiTicket,
} from "@/lib/api";

export default function TenantQueuePage() {
  const params = useParams();
  const slug = (params?.slug as string) || "";
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PublicTenantQueuesResponse | null>(null);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("");

  // Ticket creation modal state
  const [selectedService, setSelectedService] = useState<PublicTenantService | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [reminderOptIn, setReminderOptIn] = useState(true);
  const [notifyThreshold, setNotifyThreshold] = useState<number>(2);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Active ticket view
  const [activeTicket, setActiveTicket] = useState<ApiTicket | null>(null);

  // Existing ticket quick lookup state
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupInput, setLookupInput] = useState("");

  const loadData = useCallback(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    fetchPublicTenantQueues(slug)
      .then((res) => {
        setData(res);
        if (res.facilities.length > 0) {
          setSelectedFacilityId((prev) => prev || res.facilities[0].id);
        }
      })
      .catch((err) => {
        setError(err.message || "Unable to load organisation queues.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [slug]);

  // Load public queue details for this tenant
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Check if a saved active ticket exists in local storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("krenox_active_ticket");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.id && parsed?.status === "waiting") {
          setActiveTicket(parsed);
        }
      }
    } catch {
      // Local storage read error
    }
  }, []);

  async function handleJoinQueue(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedService) return;
    if (!customerPhone.trim()) {
      setJoinError("Phone number is required for digital ticket dispatch.");
      return;
    }

    setJoining(true);
    setJoinError(null);

    try {
      const ticket = await joinQueue({
        service_id: selectedService.id,
        customer_name: customerName.trim() || "Visitor",
        customer_phone: customerPhone.trim(),
        reminder_opt_in: reminderOptIn,
        notify_threshold: notifyThreshold,
      });

      // Persist active ticket
      const { pin, ...publicTicket } = ticket;
      saveTicketPin(ticket.id, pin);
      localStorage.setItem("krenox_active_ticket", JSON.stringify(publicTicket));
      setActiveTicket(publicTicket);
      setSelectedService(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to join queue. Please try again.";
      setJoinError(msg);
    } finally {
      setJoining(false);
    }
  }

  function handleLookupTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!lookupInput.trim()) return;
    router.push(`/waiting?ticketId=${encodeURIComponent(lookupInput.trim())}`);
  }

  // If customer has an active ticket, show the live waiting experience
  if (activeTicket) {
    return (
      <div className="min-h-screen bg-[#f3f6f5]">
        <div className="bg-[#041a1d] text-white py-3 px-4 border-b border-white/10 sticky top-0 z-40">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-mint animate-pulse" />
              <span>Active Digital Ticket · {data?.organisation.name || "Queue"}</span>
            </div>
            <button
              onClick={() => {
                localStorage.removeItem("krenox_active_ticket");
                setActiveTicket(null);
              }}
              className="text-xs text-mint hover:underline font-bold"
            >
              Take Another Ticket
            </button>
          </div>
        </div>
        <WaitingExperience ticketId={activeTicket.id} />
      </div>
    );
  }

  const activeFacility: PublicTenantFacility | undefined =
    data?.facilities.find((f) => f.id === selectedFacilityId) || data?.facilities[0];

  const totalWaitingAll =
    data?.facilities.reduce(
      (acc, fac) => acc + fac.services.reduce((sAcc, s) => sAcc + s.waiting_count, 0),
      0
    ) || 0;

  const totalOpenDesks =
    data?.facilities.reduce(
      (acc, fac) => Math.max(acc, ...fac.services.map((s) => s.open_desks)),
      1
    ) || 1;

  return (
    <main className="min-h-screen bg-[#f8faf9] text-ink selection:bg-brand selection:text-white flex flex-col justify-between">
      <div>
        {/* ── Sleek, Collision-Free Mobile Navigation ── */}
        <header className="border-b border-line/80 bg-white sticky top-0 z-30 shadow-xs">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 sm:px-6 h-16">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-bold text-soft hover:text-ink transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Krenox</span>
            </Link>

            <span className="text-xs text-soft font-medium">Live Queue Dispatch</span>
          </div>
        </header>

        {/* ── Main Container ── */}
        <div className="mx-auto max-w-4xl px-4 sm:px-6 pt-6 sm:pt-8 pb-12">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-10 h-10 rounded-full border-3 border-line border-t-forest animate-spin mb-4" />
              <p className="text-xs font-bold text-soft">Connecting to live counters...</p>
            </div>
          ) : error || !data ? (
            /* Error Card */
            <div className="bg-white rounded-3xl p-8 sm:p-12 text-center max-w-md mx-auto shadow-sm border border-line">
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-200">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-lg font-black text-ink mb-2">Venue Not Available</h2>
              <p className="text-xs text-soft mb-6 leading-relaxed">
                {error || "This organisation queue link is inactive or awaiting administrative review."}
              </p>
              <Link
                href="/"
                className="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-forest text-white font-bold text-xs hover:bg-forest-dark transition"
              >
                Browse Active Queues →
              </Link>
            </div>
          ) : (
            <>
              {/* ── Redesigned Venue Identity Card ── */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-line shadow-sm mb-6 relative overflow-hidden">
                {/* Subtle top accent bar */}
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-forest via-mint to-forest" />

                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                  <div>
                    <p className="text-xs text-soft font-semibold uppercase tracking-wider mb-1">
                      {data.organisation.category}
                    </p>

                    <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight mb-2">
                      {data.organisation.name}
                    </h1>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-soft">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-soft shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>{data.organisation.location || "Central Location"}</span>
                      </div>
                      <span>•</span>
                      <div className="flex items-center gap-1.5 font-semibold text-ink">
                        <svg className="w-3.5 h-3.5 text-forest shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span>{activeFacility?.name || "Main Facility"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Scannable Real-time Counter Stats */}
                  <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-surface-sunken border border-line shrink-0 sm:min-w-[220px]">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-soft block">
                        Waiting in Line
                      </span>
                      <span className="font-mono text-xl font-extrabold text-ink tabular-nums">
                        {totalWaitingAll}{" "}
                        <span className="text-xs font-normal text-soft">people</span>
                      </span>
                    </div>

                    <div className="border-l border-line pl-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-soft block">
                        Open Counters
                      </span>
                      <span className="font-mono text-xl font-extrabold text-forest tabular-nums">
                        {totalOpenDesks}{" "}
                        <span className="text-xs font-normal text-soft">active</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Facility Selector Tabs (when multiple facilities exist) */}
                {data.facilities.length > 1 && (
                  <div className="mt-6 pt-5 border-t border-line flex items-center gap-2 overflow-x-auto pb-1">
                    <span className="text-xs font-bold text-soft mr-2 shrink-0">Facility:</span>
                    {data.facilities.map((fac) => (
                      <button
                        key={fac.id}
                        onClick={() => setSelectedFacilityId(fac.id)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                          selectedFacilityId === fac.id
                            ? "bg-forest text-white shadow-xs"
                            : "bg-surface-sunken text-soft hover:text-ink"
                        }`}
                      >
                        {fac.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Section Title ── */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-ink">
                    Available Service Counters
                  </h2>
                  <p className="text-xs text-soft">
                    Tap a counter below to take a virtual ticket and receive WhatsApp arrival updates.
                  </p>
                </div>

                <button
                  onClick={loadData}
                  className="p-2 rounded-xl text-soft hover:text-ink hover:bg-white border border-transparent hover:border-line transition"
                  title="Refresh Queue Status"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>

              {/* ── Service Lines or Professional Empty State ── */}
              {activeFacility && activeFacility.services.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeFacility.services.map((service) => (
                    <div
                      key={service.id}
                      className="bg-white rounded-3xl p-5 sm:p-6 border border-line hover:border-forest/40 transition-all shadow-xs hover:shadow-md flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="w-9 h-9 rounded-xl bg-surface-sunken text-forest font-bold flex items-center justify-center text-xs border border-line">
                            {service.prefix}
                          </span>

                          <span className="text-xs text-soft font-medium">
                            ~{service.avg_duration_minutes}m avg
                          </span>
                        </div>

                        <h3 className="text-base font-extrabold text-ink mb-1">
                          {service.name}
                        </h3>

                        <div className="flex items-center gap-2 text-xs text-soft mt-2 mb-6">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              service.waiting_count > 0 ? "bg-amber-500 animate-pulse" : "bg-ok"
                            }`}
                          />
                          <span className="font-semibold text-ink">
                            {service.waiting_count === 0
                              ? "No line currently"
                              : `${service.waiting_count} waiting`}
                          </span>
                          <span>•</span>
                          <span>
                            {service.est_wait_minutes === 0
                              ? "Walk right up"
                              : `~${service.est_wait_minutes} min wait`}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedService(service);
                          setJoinError(null);
                        }}
                        className="w-full py-3 rounded-full bg-forest text-white font-extrabold text-xs hover:bg-forest-dark active:scale-[0.98] transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                      >
                        <span>Take Digital Ticket</span>
                        <span>→</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                /* ── Professional, Reassuring Empty State ── */
                <div className="bg-white rounded-3xl p-8 sm:p-12 border border-line shadow-xs text-center max-w-lg mx-auto">
                  <div className="w-14 h-14 rounded-2xl bg-surface-sunken text-soft flex items-center justify-center mx-auto mb-4 border border-line">
                    <svg className="w-7 h-7 text-soft" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>

                  <h3 className="text-base sm:text-lg font-extrabold text-ink mb-2">
                    Counters Currently Closed or In Recess
                  </h3>
                  <p className="text-xs text-soft leading-relaxed max-w-sm mx-auto mb-6">
                    {data.organisation.name} has not published active ticket queues for this counter today. Desk staff will activate counters during service hours.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      onClick={loadData}
                      className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-forest text-white font-bold text-xs hover:bg-forest-dark transition flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>Check Again</span>
                    </button>

                    <Link
                      href="/"
                      className="w-full sm:w-auto px-6 py-2.5 rounded-full border border-line bg-surface-sunken text-soft hover:text-ink font-bold text-xs transition text-center"
                    >
                      Return to Krenox
                    </Link>
                  </div>
                </div>
              )}

              {/* ── Existing Ticket Quick-Lookup Drawer ── */}
              <div className="mt-8 bg-white rounded-3xl p-5 border border-line shadow-xs">
                <button
                  type="button"
                  onClick={() => setLookupOpen(!lookupOpen)}
                  className="w-full flex items-center justify-between text-xs font-bold text-ink cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-forest" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                    </svg>
                    <span>Already have a ticket for this venue?</span>
                  </div>
                  <span className="text-soft font-normal text-[11px]">
                    {lookupOpen ? "Hide ▲" : "Track Ticket ▼"}
                  </span>
                </button>

                {lookupOpen && (
                  <form onSubmit={handleLookupTicket} className="mt-4 pt-4 border-t border-line flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Enter Recovery PIN (e.g. 151893) or Ticket (e.g. R-040)"
                      value={lookupInput}
                      onChange={(e) => setLookupInput(e.target.value)}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-line bg-surface-sunken text-xs font-bold font-mono uppercase focus:bg-white focus:outline-none focus:border-forest"
                    />
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-forest text-white font-bold text-xs hover:bg-forest-dark transition"
                    >
                      Track
                    </button>
                  </form>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-line text-xs text-soft">
                <p>
                  Automated notifications will be sent to your phone when your ticket is close to being summoned.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Take Ticket Modal ── */}
      {selectedService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-[2rem] p-6 sm:p-8 shadow-2xl border border-line relative animate-in zoom-in-95 duration-150 text-ink">
            <button
              onClick={() => setSelectedService(null)}
              className="absolute top-5 right-5 p-2 rounded-full text-soft hover:bg-surface-sunken hover:text-ink transition cursor-pointer"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 mb-5">
              <span className="w-10 h-10 rounded-2xl bg-mint-soft text-forest font-black flex items-center justify-center text-sm border border-mint/40">
                {selectedService.prefix}
              </span>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-soft">
                  Joining Queue
                </span>
                <h3 className="text-base font-black text-ink">{selectedService.name}</h3>
              </div>
            </div>

            {joinError && (
              <div className="mb-4 p-3 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                {joinError}
              </div>
            )}

            <form onSubmit={handleJoinQueue} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">
                  Your Full Name <span className="text-soft font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-line bg-surface-sunken focus:bg-white focus:outline-none focus:border-forest text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 670000000 or 237670000000"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-line bg-surface-sunken focus:bg-white focus:outline-none focus:border-forest text-sm font-medium"
                />
                <p className="text-[11px] text-soft mt-1">
                  We use this number to send real-time WhatsApp arrival updates.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">
                  Arrival Alert Threshold
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: 1, label: "1 person ahead" },
                    { val: 2, label: "2 people (Best)" },
                    { val: 4, label: "4 people ahead" },
                  ].map((opt) => (
                    <button
                      type="button"
                      key={opt.val}
                      onClick={() => setNotifyThreshold(opt.val)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition ${
                        notifyThreshold === opt.val
                          ? "bg-mint border-forest text-forest-dark font-black"
                          : "bg-surface-sunken border-line text-soft hover:text-ink"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-ink">
                  <input
                    type="checkbox"
                    checked={reminderOptIn}
                    onChange={(e) => setReminderOptIn(e.target.checked)}
                    className="w-4 h-4 rounded text-forest focus:ring-forest"
                  />
                  <span>Send me digital pass & WhatsApp arrival updates</span>
                </label>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedService(null)}
                  className="flex-1 py-3 rounded-full border border-line text-xs font-bold text-soft hover:bg-surface-sunken transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joining}
                  className="flex-1 py-3 rounded-full bg-forest text-white text-xs font-extrabold hover:bg-forest-dark transition flex items-center justify-center gap-2 shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {joining ? "Generating Ticket..." : "Get Digital Ticket →"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Proper Footer ── */}
      <Footer className="mt-16" />
    </main>
  );
}
