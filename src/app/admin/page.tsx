"use client";

import { useEffect, useState, useCallback, useId } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import {
  fetchAdminOverview,
  toggleServiceActive,
  toggleDeskOpen,
  createService,
  createDesk,
  AdminOverview,
  ApiService,
  AdminDesk,
} from "@/lib/api";

export default function AdminPage() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"services" | "desks" | "posters">("services");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);

  // QR Station State
  const [selectedServiceForPoster, setSelectedServiceForPoster] = useState<string>("all");
  const [baseUrl, setBaseUrl] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return window.location.origin;
    }
    return "";
  });
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [showPosterModal, setShowPosterModal] = useState<boolean>(false);

  // New Service Modal
  const [showNewServiceModal, setShowNewServiceModal] = useState<boolean>(false);
  const [newServiceName, setNewServiceName] = useState<string>("");
  const [newServicePrefix, setNewServicePrefix] = useState<string>("");
  const [newServiceDuration, setNewServiceDuration] = useState<number>(15);
  const [newServiceError, setNewServiceError] = useState<string | null>(null);
  const [newServiceSubmitting, setNewServiceSubmitting] = useState<boolean>(false);

  // New Desk Modal
  const [showNewDeskModal, setShowNewDeskModal] = useState<boolean>(false);
  const [newDeskName, setNewDeskName] = useState<string>("");
  const [newDeskError, setNewDeskError] = useState<string | null>(null);
  const [newDeskSubmitting, setNewDeskSubmitting] = useState<boolean>(false);

  // Unique IDs for accessibility
  const baseUrlInputId = useId();
  const posterServiceSelectId = useId();
  const serviceNameInputId = useId();
  const servicePrefixInputId = useId();
  const serviceDurationInputId = useId();
  const deskNameInputId = useId();

  // Load Data
  const loadOverview = useCallback(async () => {
    try {
      const overview = await fetchAdminOverview();
      setData(overview);
      setLastRefreshed(new Date());
      setError(null);
    } catch (err) {
      console.error("Failed to load admin overview:", err);
      setError("Unable to connect to the administration server. Please verify backend connectivity.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const overview = await fetchAdminOverview();
        if (active) {
          setData(overview);
          setLastRefreshed(new Date());
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          console.error("Failed to load admin overview:", err);
          setError("Unable to connect to the administration server. Please verify backend connectivity.");
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Generate QR Code whenever selected service or baseUrl changes
  useEffect(() => {
    let active = true;
    if (!baseUrl) return;

    let targetUrl = baseUrl;
    if (selectedServiceForPoster !== "all") {
      targetUrl = `${baseUrl}/?serviceId=${selectedServiceForPoster}`;
    }

    QRCode.toDataURL(targetUrl, {
      width: 480,
      margin: 2,
      color: {
        dark: "#084d56",
        light: "#ffffff",
      },
      errorCorrectionLevel: "H",
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error("QR Code generation error:", err);
      });

    return () => {
      active = false;
    };
  }, [selectedServiceForPoster, baseUrl]);

  // Handlers
  async function handleToggleService(service: ApiService) {
    if (actionPending) return;
    setActionPending(`service-${service.id}`);
    try {
      await toggleServiceActive(service.id, !service.is_active);
      await loadOverview();
    } catch (err) {
      alert("Failed to update service state: " + String(err));
    } finally {
      setActionPending(null);
    }
  }

  async function handleToggleDesk(desk: AdminDesk) {
    if (actionPending) return;
    setActionPending(`desk-${desk.id}`);
    try {
      await toggleDeskOpen(desk.id, !desk.is_open);
      await loadOverview();
    } catch (err) {
      alert("Failed to update desk state: " + String(err));
    } finally {
      setActionPending(null);
    }
  }

  async function handleCreateService(e: React.FormEvent) {
    e.preventDefault();
    if (!newServiceName.trim() || !newServicePrefix.trim()) {
      setNewServiceError("Please provide both name and a 1-3 letter prefix");
      return;
    }
    const defaultFacilityId = data?.services[0]?.facility_id || "4d998b27-0a60-4918-9215-5d025a809887";

    setNewServiceSubmitting(true);
    setNewServiceError(null);
    try {
      await createService({
        facility_id: defaultFacilityId,
        name: newServiceName.trim(),
        prefix: newServicePrefix.trim().toUpperCase(),
        avg_duration_minutes: Number(newServiceDuration) || 15,
      });
      setShowNewServiceModal(false);
      setNewServiceName("");
      setNewServicePrefix("");
      setNewServiceDuration(15);
      await loadOverview();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create service";
      setNewServiceError(message);
    } finally {
      setNewServiceSubmitting(false);
    }
  }

  async function handleCreateDesk(e: React.FormEvent) {
    e.preventDefault();
    if (!newDeskName.trim()) {
      setNewDeskError("Please provide a desk name or number");
      return;
    }
    const defaultFacilityId = data?.desks[0]?.facility_id || "4d998b27-0a60-4918-9215-5d025a809887";

    setNewDeskSubmitting(true);
    setNewDeskError(null);
    try {
      await createDesk({
        facility_id: defaultFacilityId,
        name: newDeskName.trim(),
      });
      setShowNewDeskModal(false);
      setNewDeskName("");
      await loadOverview();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create desk";
      setNewDeskError(message);
    } finally {
      setNewDeskSubmitting(false);
    }
  }

  function openPosterForService(serviceId: string) {
    setSelectedServiceForPoster(serviceId);
    setShowPosterModal(true);
  }

  const selectedServiceObj = data?.services.find((s) => s.id === selectedServiceForPoster);

  return (
    <div className="min-h-screen bg-[#081018] text-[#e2e8f0]">
      {/* ── Top Navigation Bar ── */}
      <header className="border-b border-[#1a2d47] bg-[#0c1524]/90 backdrop-blur-md sticky top-0 z-40 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2.5 font-bold tracking-tight text-white hover:opacity-90 transition-opacity"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#0d6570] to-[#00c9a7] flex items-center justify-center text-white shadow-sm font-black text-sm">
                K
              </div>
              <span className="text-lg">Krenox</span>
            </Link>
            <span className="text-[#334b6e] text-sm">/</span>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest font-mono font-semibold px-2 py-0.5 rounded bg-[#10253f] text-[#38bdf8] border border-[#1e3e6b]">
                Admin Console
              </span>
              <span className="text-xs text-[#7188a8] hidden sm:inline">
                University of Buea
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-1.5 text-xs text-[#7188a8]">
              <span className="w-2 h-2 rounded-full bg-[#00c9a7] animate-pulse"></span>
              <span>
                {lastRefreshed
                  ? `Synced ${lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                  : "Connecting..."}
              </span>
            </div>

            <button
              onClick={() => loadOverview()}
              disabled={loading}
              className="p-2 rounded-lg bg-[#111d2e] border border-[#1a2d47] text-[#94a3b8] hover:text-white hover:border-[#38bdf8] transition-all text-xs flex items-center gap-1.5 disabled:opacity-50"
              title="Refresh Data"
            >
              <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <Link
              href="/staff"
              className="text-xs px-3 py-1.5 rounded-lg bg-[#111d2e] border border-[#1a2d47] text-[#94a3b8] hover:text-[#00c9a7] hover:border-[#00c9a7]/40 transition-colors font-medium"
            >
              Staff Desk →
            </Link>

            <Link
              href="/simulation"
              className="text-xs px-3 py-1.5 rounded-lg bg-[#111d2e] border border-[#1a2d47] text-[#94a3b8] hover:text-[#38bdf8] hover:border-[#38bdf8]/40 transition-colors font-medium"
            >
              SimPy Simulation →
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Content Container ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 no-print">
        {/* Header Title Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Queue Operations & Dispatch Admin
            </h1>
            <p className="text-sm text-[#7188a8] mt-1 max-w-2xl">
              Control live service lines, manage counter availability, monitor real-time student foot-traffic, and print physical QR code posters for campus kiosks.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedServiceForPoster("all");
                setShowPosterModal(true);
              }}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#0d6570] to-[#00c9a7] text-white font-semibold text-xs sm:text-sm shadow-md hover:brightness-110 transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              <span>Print QR Posters</span>
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-[#2a131a] border border-[#a43838]/50 text-[#fca5a5] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 flex-shrink-0 text-[#f87171]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-xs sm:text-sm">{error}</span>
            </div>
            <button
              onClick={() => loadOverview()}
              className="text-xs underline hover:text-white ml-3 font-semibold"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── KPI Telemetry Grid ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-8">
          {/* Total Tickets */}
          <div className="p-4 rounded-xl bg-[#0c1524] border border-[#1a2d47] relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-[#7188a8] mb-1">
              <span>Total Tickets</span>
              <span className="font-mono text-[10px] text-[#38bdf8] uppercase">Today</span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
              {data?.stats.total_tickets ?? "—"}
            </div>
            <div className="text-[11px] text-[#557078] mt-1">Registrar & Student Affairs</div>
            <div className="absolute top-0 right-0 w-16 h-16 bg-[#38bdf8]/5 rounded-bl-full pointer-events-none" />
          </div>

          {/* Active Waiting */}
          <div className="p-4 rounded-xl bg-[#0c1524] border border-[#1a2d47] relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-[#7188a8] mb-1">
              <span>Waiting in Line</span>
              <span className="w-2 h-2 rounded-full bg-[#f59e0b] animate-ping" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#f59e0b] font-mono">
              {data?.stats.waiting ?? "—"}
            </div>
            <div className="text-[11px] text-[#557078] mt-1">Students relaxing outside</div>
            <div className="absolute top-0 right-0 w-16 h-16 bg-[#f59e0b]/5 rounded-bl-full pointer-events-none" />
          </div>

          {/* Serving */}
          <div className="p-4 rounded-xl bg-[#0c1524] border border-[#1a2d47] relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-[#7188a8] mb-1">
              <span>Now at Desks</span>
              <span className="w-2 h-2 rounded-full bg-[#00c9a7]" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#00c9a7] font-mono">
              {data?.stats.serving ?? "—"}
            </div>
            <div className="text-[11px] text-[#557078] mt-1">Currently in consultation</div>
            <div className="absolute top-0 right-0 w-16 h-16 bg-[#00c9a7]/5 rounded-bl-full pointer-events-none" />
          </div>

          {/* Completed */}
          <div className="p-4 rounded-xl bg-[#0c1524] border border-[#1a2d47] relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-[#7188a8] mb-1">
              <span>Completed</span>
              <span className="font-mono text-[10px] text-[#00c9a7]">Processed</span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
              {data?.stats.completed ?? "—"}
            </div>
            <div className="text-[11px] text-[#557078] mt-1">Successfully handled</div>
            <div className="absolute top-0 right-0 w-16 h-16 bg-[#00c9a7]/5 rounded-bl-full pointer-events-none" />
          </div>

          {/* Absent / Skipped */}
          <div className="col-span-2 lg:col-span-1 p-4 rounded-xl bg-[#0c1524] border border-[#1a2d47] relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-[#7188a8] mb-1">
              <span>No-Show / Absent</span>
              <span className="font-mono text-[10px] text-[#f43f5e]">Attrition</span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#f43f5e] font-mono">
              {data?.stats.absent_or_skipped ?? "—"}
            </div>
            <div className="text-[11px] text-[#557078] mt-1">
              {data?.stats.total_tickets
                ? `${Math.round(((data.stats.absent_or_skipped || 0) / data.stats.total_tickets) * 100)}% rate`
                : "0% rate"}
            </div>
            <div className="absolute top-0 right-0 w-16 h-16 bg-[#f43f5e]/5 rounded-bl-full pointer-events-none" />
          </div>
        </div>

        {/* ── Navigation Tabs ── */}
        <div className="flex items-center gap-2 border-b border-[#1a2d47] mb-6">
          <button
            onClick={() => setActiveTab("services")}
            className={`px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "services"
                ? "border-[#00c9a7] text-[#00c9a7] bg-[#0c1524]"
                : "border-transparent text-[#7188a8] hover:text-white"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span>Service Lines ({data?.services.length ?? 0})</span>
          </button>

          <button
            onClick={() => setActiveTab("desks")}
            className={`px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "desks"
                ? "border-[#00c9a7] text-[#00c9a7] bg-[#0c1524]"
                : "border-transparent text-[#7188a8] hover:text-white"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span>Counters & Desks ({data?.desks.length ?? 0})</span>
          </button>

          <button
            onClick={() => setActiveTab("posters")}
            className={`px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "posters"
                ? "border-[#00c9a7] text-[#00c9a7] bg-[#0c1524]"
                : "border-transparent text-[#7188a8] hover:text-white"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span>QR Code Posters</span>
          </button>
        </div>

        {/* ── TAB 1: SERVICE LINES ── */}
        {activeTab === "services" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[#7188a8]">
                Pause or resume virtual queue ticket registration for specific departments.
              </p>
              <button
                onClick={() => setShowNewServiceModal(true)}
                className="px-3 py-1.5 rounded-lg bg-[#111d2e] border border-[#1e3e6b] text-[#38bdf8] text-xs font-semibold hover:bg-[#1e3e6b]/40 transition-colors flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Add Service Line</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data?.services.map((service) => (
                <div
                  key={service.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    service.is_active
                      ? "bg-[#0c1524] border-[#1a2d47]"
                      : "bg-[#090f19] border-[#182333] opacity-75"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold text-sm px-2 py-0.5 rounded-md bg-[#10253f] text-[#38bdf8] border border-[#1e3e6b]">
                        [{service.prefix}]
                      </span>
                      <h3 className="font-bold text-white text-base leading-tight">
                        {service.name}
                      </h3>
                    </div>

                    <span
                      className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-bold ${
                        service.is_active
                          ? "bg-[#087257]/20 text-[#00c9a7] border border-[#087257]/40"
                          : "bg-[#a43838]/20 text-[#f87171] border border-[#a43838]/40"
                      }`}
                    >
                      {service.is_active ? "Accepting Tickets" : "Queue Paused"}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-[#7188a8] mb-5">
                    <div className="flex items-center justify-between">
                      <span>Avg. Handling Duration:</span>
                      <span className="text-white font-mono font-semibold">
                        {service.avg_duration_minutes} mins
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Facility:</span>
                      <span className="text-[#94a3b8]">
                        {service.facilities?.name || "Student Services"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Location:</span>
                      <span className="text-[#94a3b8]">
                        {service.facilities?.location || "Main Campus"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-[#1a2d47]">
                    <button
                      onClick={() => handleToggleService(service)}
                      disabled={actionPending === `service-${service.id}`}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                        service.is_active
                          ? "bg-[#2a131a] border border-[#a43838]/40 text-[#fca5a5] hover:bg-[#a43838]/40"
                          : "bg-[#082b26] border border-[#087257]/40 text-[#5eead4] hover:bg-[#087257]/40"
                      }`}
                    >
                      {actionPending === `service-${service.id}` ? (
                        <span className="animate-pulse">Updating...</span>
                      ) : service.is_active ? (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Pause Queue</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Resume Queue</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => openPosterForService(service.id)}
                      className="py-2 px-3 rounded-lg bg-[#111d2e] border border-[#1a2d47] text-[#38bdf8] hover:text-white hover:border-[#38bdf8] transition-all text-xs font-semibold flex items-center gap-1"
                      title="Generate QR Poster for this service"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                      </svg>
                      <span>QR</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 2: SERVICE COUNTERS & DESKS ── */}
        {activeTab === "desks" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[#7188a8]">
                Open or close individual staff physical desks for serving tickets.
              </p>
              <button
                onClick={() => setShowNewDeskModal(true)}
                className="px-3 py-1.5 rounded-lg bg-[#111d2e] border border-[#1e3e6b] text-[#38bdf8] text-xs font-semibold hover:bg-[#1e3e6b]/40 transition-colors flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Add Counter</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {data?.desks.map((desk) => (
                <div
                  key={desk.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    desk.is_open
                      ? "bg-[#0c1524] border-[#1a2d47]"
                      : "bg-[#090f19] border-[#182333] opacity-75"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-[#10253f] border border-[#1e3e6b] flex items-center justify-center text-[#38bdf8] font-mono font-bold text-sm">
                      {desk.name.replace(/[^0-9]/g, "") || "D"}
                    </div>
                    <span
                      className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-bold ${
                        desk.is_open
                          ? "bg-[#087257]/20 text-[#00c9a7] border border-[#087257]/40"
                          : "bg-[#a43838]/20 text-[#f87171] border border-[#a43838]/40"
                      }`}
                    >
                      {desk.is_open ? "Open / Active" : "Closed"}
                    </span>
                  </div>

                  <h3 className="font-bold text-white text-base mb-1">{desk.name}</h3>
                  <p className="text-xs text-[#7188a8] mb-4">
                    Counter station for student consultations
                  </p>

                  <button
                    onClick={() => handleToggleDesk(desk)}
                    disabled={actionPending === `desk-${desk.id}`}
                    className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                      desk.is_open
                        ? "bg-[#2a131a] border border-[#a43838]/40 text-[#fca5a5] hover:bg-[#a43838]/40"
                        : "bg-[#082b26] border border-[#087257]/40 text-[#5eead4] hover:bg-[#087257]/40"
                    }`}
                  >
                    {actionPending === `desk-${desk.id}` ? (
                      <span className="animate-pulse">Updating...</span>
                    ) : desk.is_open ? (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span>Close Counter</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Open Counter</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 3: QR CODE POSTERS STATION ── */}
        {activeTab === "posters" && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-[#0c1524] border border-[#1a2d47]">
              <h2 className="text-lg font-bold text-white mb-2">Printable Queue Entry Station</h2>
              <p className="text-xs sm:text-sm text-[#7188a8] mb-6 max-w-3xl">
                Generate high-resolution printable posters to stick at entrance halls, building bulletin boards, and counter stations. Students scan the QR code with their camera to immediately receive a virtual ticket and live WhatsApp dispatch notifications.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Control Panel */}
                <div className="space-y-4">
                  <div>
                    <label htmlFor={posterServiceSelectId} className="block text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-1.5">
                      Target Service
                    </label>
                    <select
                      id={posterServiceSelectId}
                      value={selectedServiceForPoster}
                      onChange={(e) => setSelectedServiceForPoster(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#111d2e] border border-[#1a2d47] text-white text-xs focus:border-[#00c9a7] focus:outline-none"
                    >
                      <option value="all">Campus Kiosk (All Services)</option>
                      {data?.services.map((s) => (
                        <option key={s.id} value={s.id}>
                          [{s.prefix}] {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor={baseUrlInputId} className="block text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-1.5">
                      Base Kiosk URL
                    </label>
                    <input
                      id={baseUrlInputId}
                      type="text"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder="e.g. https://krenox.online"
                      className="w-full px-3 py-2 rounded-xl bg-[#111d2e] border border-[#1a2d47] text-white text-xs font-mono focus:border-[#00c9a7] focus:outline-none"
                    />
                    <p className="text-[10px] text-[#557078] mt-1">
                      Target address embedded inside the QR code.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => setShowPosterModal(true)}
                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#0d6570] to-[#00c9a7] text-white font-bold text-xs sm:text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      <span>Preview & Print Poster (A4)</span>
                    </button>
                  </div>
                </div>

                {/* Live Preview Card */}
                <div className="md:col-span-2 p-6 rounded-xl bg-white text-[#102a36] flex flex-col items-center justify-center text-center shadow-xl border border-gray-200">
                  <div className="text-[11px] font-bold tracking-widest text-[#084d56] uppercase mb-1">
                    University of Buea
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-[#102a36] mb-1">
                    {selectedServiceObj ? selectedServiceObj.name : "Digital Queue Station"}
                  </h3>
                  <p className="text-xs text-[#557078] max-w-sm mb-4">
                    Scan with your smartphone camera to join the queue and receive WhatsApp alerts when your turn arrives.
                  </p>

                  {/* QR Code Container */}
                  <div className="p-3 bg-white border-2 border-[#0d6570] rounded-2xl shadow-inner mb-4">
                    {qrDataUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={qrDataUrl}
                        alt="Krenox Queue QR Code"
                        className="w-48 h-48 sm:w-56 sm:h-56 object-contain"
                      />
                    ) : (
                      <div className="w-48 h-48 flex items-center justify-center text-xs text-gray-400">
                        Generating QR...
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 w-full max-w-md text-left text-[11px] text-[#557078] border-t border-gray-100 pt-3">
                    <div>
                      <div className="font-bold text-[#102a36]">1. Scan</div>
                      <div>Point phone camera</div>
                    </div>
                    <div>
                      <div className="font-bold text-[#102a36]">2. Register</div>
                      <div>Enter name & phone</div>
                    </div>
                    <div>
                      <div className="font-bold text-[#102a36]">3. Relax</div>
                      <div>Get WhatsApp alert</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── PRINTABLE POSTER MODAL & PRINT VIEW ── */}
      {showPosterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          {/* Controls bar outside print area */}
          <div className="fixed top-4 right-4 z-50 flex items-center gap-3 no-print">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#0d6570] to-[#00c9a7] text-white font-bold text-xs sm:text-sm shadow-xl hover:brightness-110 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>Print A4 Poster</span>
            </button>

            <button
              onClick={() => setShowPosterModal(false)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Printable Poster (White paper format) */}
          <div className="printable-poster w-full max-w-2xl bg-white text-[#102a36] rounded-3xl p-8 sm:p-12 shadow-2xl relative my-8 flex flex-col items-center text-center border border-gray-200">
            {/* UB Seal Header */}
            <div className="w-16 h-16 rounded-2xl bg-[#084d56] text-white flex items-center justify-center font-black text-2xl shadow-md mb-3">
              UB
            </div>

            <div className="text-xs uppercase tracking-widest font-bold text-[#084d56] mb-1">
              University of Buea • Student Services
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#102a36] tracking-tight mb-2">
              {selectedServiceObj ? selectedServiceObj.name : "Student Digital Queue Station"}
            </h1>

            <p className="text-sm sm:text-base text-[#557078] max-w-lg mb-6 leading-relaxed">
              Skip the crowded physical waiting lines. Scan the QR code below to take your digital ticket and receive real-time alerts directly on WhatsApp.
            </p>

            {/* QR Code Big Container */}
            <div className="p-4 bg-white border-4 border-[#084d56] rounded-3xl shadow-lg mb-6">
              {qrDataUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={qrDataUrl}
                  alt="Krenox Queue Ticket QR"
                  className="w-64 h-64 sm:w-80 sm:h-80 object-contain"
                />
              )}
            </div>

            <div className="font-mono text-xs text-[#084d56] font-semibold bg-[#eff7f5] px-4 py-1.5 rounded-full border border-[#c3d4d1] mb-8">
              {selectedServiceForPoster === "all"
                ? baseUrl
                : `${baseUrl}/?serviceId=${selectedServiceForPoster}`}
            </div>

            {/* 3 Step Instruction Box */}
            <div className="grid grid-cols-3 gap-4 w-full border-t-2 border-b-2 border-gray-100 py-6 mb-6 text-left">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-[#084d56] text-white font-bold flex items-center justify-center text-sm flex-shrink-0">
                  1
                </div>
                <div>
                  <h4 className="font-bold text-xs text-[#102a36]">Scan Code</h4>
                  <p className="text-[11px] text-[#557078]">
                    Open your smartphone camera or WhatsApp
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-[#084d56] text-white font-bold flex items-center justify-center text-sm flex-shrink-0">
                  2
                </div>
                <div>
                  <h4 className="font-bold text-xs text-[#102a36]">Take Ticket</h4>
                  <p className="text-[11px] text-[#557078]">
                    Provide your name and WhatsApp number
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-[#084d56] text-white font-bold flex items-center justify-center text-sm flex-shrink-0">
                  3
                </div>
                <div>
                  <h4 className="font-bold text-xs text-[#102a36]">Relax & Enter</h4>
                  <p className="text-[11px] text-[#557078]">
                    We message you when your desk is ready
                  </p>
                </div>
              </div>
            </div>

            {/* Privacy & Anti-Crowding Notice */}
            <div className="text-[11px] text-[#557078] max-w-md">
              <p>
                <strong>Privacy Protected:</strong> Your phone number is masked and protected according to academic data privacy standards. Please maintain physical distancing while waiting.
              </p>
              <p className="text-[10px] text-gray-400 mt-2 font-mono">
                Powered by Krenox Virtual Queue Engine • University of Buea B.Tech Project
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD SERVICE MODAL ── */}
      {showNewServiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm no-print">
          <div className="w-full max-w-md rounded-2xl bg-[#0c1524] border border-[#1a2d47] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white text-base">Add New Service Line</h3>
              <button
                onClick={() => setShowNewServiceModal(false)}
                className="text-[#7188a8] hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {newServiceError && (
              <div className="mb-4 p-3 rounded-lg bg-[#2a131a] border border-[#a43838]/50 text-[#fca5a5] text-xs">
                {newServiceError}
              </div>
            )}

            <form onSubmit={handleCreateService} className="space-y-4">
              <div>
                <label htmlFor={serviceNameInputId} className="block text-xs font-semibold text-[#94a3b8] mb-1">
                  Service Name
                </label>
                <input
                  id={serviceNameInputId}
                  type="text"
                  required
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  placeholder="e.g. Clearance & Graduation"
                  className="w-full px-3 py-2 rounded-xl bg-[#111d2e] border border-[#1a2d47] text-white text-xs focus:border-[#00c9a7] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={servicePrefixInputId} className="block text-xs font-semibold text-[#94a3b8] mb-1">
                    Ticket Prefix (1-3 chars)
                  </label>
                  <input
                    id={servicePrefixInputId}
                    type="text"
                    required
                    maxLength={3}
                    value={newServicePrefix}
                    onChange={(e) => setNewServicePrefix(e.target.value)}
                    placeholder="e.g. C"
                    className="w-full px-3 py-2 rounded-xl bg-[#111d2e] border border-[#1a2d47] text-white text-xs uppercase font-mono focus:border-[#00c9a7] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor={serviceDurationInputId} className="block text-xs font-semibold text-[#94a3b8] mb-1">
                    Avg. Duration (mins)
                  </label>
                  <input
                    id={serviceDurationInputId}
                    type="number"
                    min={1}
                    max={120}
                    value={newServiceDuration}
                    onChange={(e) => setNewServiceDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-[#111d2e] border border-[#1a2d47] text-white text-xs font-mono focus:border-[#00c9a7] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewServiceModal(false)}
                  className="px-3 py-2 rounded-xl text-xs text-[#7188a8] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newServiceSubmitting}
                  className="px-4 py-2 rounded-xl bg-[#00c9a7] text-[#081018] font-bold text-xs hover:brightness-110 disabled:opacity-50"
                >
                  {newServiceSubmitting ? "Creating..." : "Save Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ADD DESK MODAL ── */}
      {showNewDeskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm no-print">
          <div className="w-full max-w-md rounded-2xl bg-[#0c1524] border border-[#1a2d47] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white text-base">Add Service Desk / Counter</h3>
              <button
                onClick={() => setShowNewDeskModal(false)}
                className="text-[#7188a8] hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {newDeskError && (
              <div className="mb-4 p-3 rounded-lg bg-[#2a131a] border border-[#a43838]/50 text-[#fca5a5] text-xs">
                {newDeskError}
              </div>
            )}

            <form onSubmit={handleCreateDesk} className="space-y-4">
              <div>
                <label htmlFor={deskNameInputId} className="block text-xs font-semibold text-[#94a3b8] mb-1">
                  Counter Name / Number
                </label>
                <input
                  id={deskNameInputId}
                  type="text"
                  required
                  value={newDeskName}
                  onChange={(e) => setNewDeskName(e.target.value)}
                  placeholder="e.g. Desk 3 (Academic Advisory)"
                  className="w-full px-3 py-2 rounded-xl bg-[#111d2e] border border-[#1a2d47] text-white text-xs focus:border-[#00c9a7] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewDeskModal(false)}
                  className="px-3 py-2 rounded-xl text-xs text-[#7188a8] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newDeskSubmitting}
                  className="px-4 py-2 rounded-xl bg-[#00c9a7] text-[#081018] font-bold text-xs hover:brightness-110 disabled:opacity-50"
                >
                  {newDeskSubmitting ? "Creating..." : "Save Counter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
