"use client";

import { useEffect, useState, useCallback, useId } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Logo } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import {
  fetchAdminOverview,
  toggleServiceActive,
  toggleDeskOpen,
  createService,
  createDesk,
  fetchAdminOrganisationApplications,
  reviewOrganisationApplication,
  fetchOrganisationAuditTrail,
  regenerateSetupToken,
  AdminOverview,
  ApiService,
  AdminDesk,
  OrganisationApplication,
  OrganisationAuditEntry,
} from "@/lib/api";

export default function AdminPage() {
  const router = useRouter();
  const { user, role, loading: authLoading, signOut } = useAuth();

  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"services" | "desks" | "posters" | "organisations" | "audit">("services");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);

  // Organisation Approval Workflow State
  const [orgApplications, setOrgApplications] = useState<OrganisationApplication[]>([]);
  const [auditLogs, setAuditLogs] = useState<OrganisationAuditEntry[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState<boolean>(false);
  const [orgFilter, setOrgFilter] = useState<string>("ALL");
  const [reviewModal, setReviewModal] = useState<{
    isOpen: boolean;
    app: OrganisationApplication | null;
    action: "approve" | "reject" | "request_info" | "suspend";
    reason: string;
    facilityName: string;
    submitting: boolean;
    error: string | null;
  }>({
    isOpen: false,
    app: null,
    action: "approve",
    reason: "",
    facilityName: "Main Facility",
    submitting: false,
    error: null,
  });

  // Route Guard: enforce admin authorization
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push("/login?redirect=/admin");
      } else if (role !== "super_admin") {
        router.push("/staff");
      }
    }
  }, [authLoading, user, role, router]);

  // QR Station State
  const [selectedServiceForPoster, setSelectedServiceForPoster] = useState<string>("all");
  const [selectedOrgSlug, setSelectedOrgSlug] = useState<string>("");
  const [qrHostMode, setQrHostMode] = useState<"lan" | "localhost" | "custom">("lan");
  const [customHost, setCustomHost] = useState<string>("");
  const [copiedTargetUrl, setCopiedTargetUrl] = useState<boolean>(false);
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
    if (!user || role !== "super_admin") return;
    try {
      const overview = await fetchAdminOverview();
      setData(overview);
      setLastRefreshed(new Date());
      setError(null);
    } catch (err) {
      console.error("Failed to load admin overview:", err);
      const msg = err instanceof Error ? err.message : "Unable to connect to the administration server.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user, role]);

  const loadOrganisations = useCallback(async () => {
    if (!user || role !== "super_admin") return;
    setLoadingOrgs(true);
    try {
      const [apps, logs] = await Promise.all([
        fetchAdminOrganisationApplications(),
        fetchOrganisationAuditTrail(),
      ]);
      setOrgApplications(apps);
      setAuditLogs(logs);
    } catch (e) {
      console.error("Failed to load organisation workflow data:", e);
    } finally {
      setLoadingOrgs(false);
    }
  }, [user, role]);

  useEffect(() => {
    if (user && role === "super_admin") {
      loadOrganisations();
    }
  }, [user, role, loadOrganisations]);

  async function handleReviewSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reviewModal.app) return;
    if (reviewModal.action !== "approve" && !reviewModal.reason.trim()) {
      setReviewModal((m) => ({ ...m, error: "A detailed explanation/reason is required." }));
      return;
    }
    setReviewModal((m) => ({ ...m, submitting: true, error: null }));
    try {
      await reviewOrganisationApplication(reviewModal.app.id, {
        action: reviewModal.action,
        reason: reviewModal.reason.trim() || undefined,
        initial_facility_name: reviewModal.action === "approve" ? reviewModal.facilityName : undefined,
      });
      setReviewModal((m) => ({ ...m, isOpen: false, submitting: false }));
      await loadOrganisations();
      await loadOverview();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Review operation failed";
      setReviewModal((m) => ({ ...m, submitting: false, error: msg }));
    }
  }

  useEffect(() => {
    let active = true;
    if (user && role === "super_admin") {
      fetchAdminOverview()
        .then((overview) => {
          if (active) {
            setData(overview);
            setLastRefreshed(new Date());
            setError(null);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (active) {
            console.error("Failed to load admin overview:", err);
            setError("Unable to connect to the administration server. Please verify backend connectivity.");
            setLoading(false);
          }
        });
    }
    return () => {
      active = false;
    };
  }, [user, role]);

  // Generate QR Code pointing directly to tenant customer dispatch: /q/[orgSlug]
  const activeOrg =
    data?.organisations?.find((o) => o.slug === selectedOrgSlug) ||
    data?.organisations?.[0] ||
    (data?.services?.[0]?.facilities?.organisations
      ? {
          name: data.services[0].facilities.organisations.name,
          slug: data.services[0].facilities.organisations.slug,
        }
      : null);

  const activeOrgSlug =
    activeOrg?.slug ||
    (user?.user_metadata?.organisation_slug as string) ||
    "buea-bojongo-police";

  const activeOrgName = activeOrg?.name || "Campus Virtual Queue";

  const effectiveBaseUrl =
    qrHostMode === "lan" && data?.local_ip
      ? `http://${data.local_ip}:3000`
      : qrHostMode === "custom" && customHost
      ? customHost.trim()
      : baseUrl || "http://localhost:3000";

  const targetUrl =
    selectedServiceForPoster !== "all"
      ? `${effectiveBaseUrl}/q/${activeOrgSlug}?serviceId=${selectedServiceForPoster}`
      : `${effectiveBaseUrl}/q/${activeOrgSlug}`;

  useEffect(() => {
    let active = true;
    if (!targetUrl) return;

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
  }, [targetUrl]);

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

  if (authLoading || !user || role !== "super_admin") {
    return (
      <main className="min-h-screen bg-[#f3f6f5] flex items-center justify-center p-6 text-center">
        <div className="p-8 rounded-3xl bg-white border border-line-strong shadow-lg max-w-sm w-full">
          <div className="w-12 h-12 rounded-2xl bg-brand text-white flex items-center justify-center font-bold text-lg mx-auto mb-3 animate-pulse">
            UB
          </div>
          <h2 className="text-base font-bold text-ink">Verifying Administrator Clearance...</h2>
          <p className="text-xs text-soft mt-1">Checking cryptographic supervisor authorization</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f3f6f5] text-ink pb-20 selection:bg-brand selection:text-white">
      {/* ── Top Bar ── */}
      <header className="border-b border-line/70 bg-white sticky top-0 z-30 shadow-xs no-print">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Logo size="md" variant="dark" />
            <span className="text-soft hidden sm:inline">/</span>
            <span className="text-xs font-bold text-ink hidden sm:inline">
              Admin Console
            </span>
            <span className="text-soft hidden sm:inline">·</span>
            <span className="text-xs font-medium text-soft hidden sm:inline">
              {(user?.user_metadata?.institution_name as string) || (user?.user_metadata?.organisation_name as string) || "System Administrator"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 text-xs text-soft font-medium">
              <span className="w-2 h-2 rounded-full bg-ok animate-pulse" />
              <span>
                {lastRefreshed
                  ? `Synced ${lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                  : "Connecting..."}
              </span>
            </div>

            <button
              onClick={() => loadOverview()}
              disabled={loading}
              className="p-2 rounded-xl bg-mint border border-line-strong text-brand hover:bg-[#dcefe9] transition-all text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
              title="Refresh Data"
            >
              <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <Link
              href="/tenant-admin"
              className="text-xs font-bold text-brand hover:underline transition"
            >
              Organisation Workspace →
            </Link>

            <Link
              href="/staff"
              className="text-xs font-semibold text-soft hover:text-brand transition"
            >
              Staff Desk →
            </Link>

            <Link
              href="/simulation"
              className="text-xs font-semibold text-soft hover:text-brand transition"
            >
              Simulation →
            </Link>

            <div className="flex items-center gap-2.5 pl-3 border-l border-line">
              <div className="text-right hidden sm:block">
                <div className="text-[11px] font-bold text-ink leading-tight">{user.email}</div>
                <div className="text-[10px] text-brand font-bold uppercase tracking-wider">
                  Administrator
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

      {/* ── Main Content Container ── */}
      <div className="max-w-7xl mx-auto px-6 pt-8 no-print">
        {/* Header Title Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-brand">
              Organization Telemetry & Kiosk Dispatch
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight mt-1">
              Queue Operations & Dispatch Admin
            </h1>
            <p className="text-sm text-soft mt-1.5 max-w-2xl leading-relaxed">
              Control live service lines, manage counter availability, monitor real-time student foot-traffic, and print physical QR code posters for campus kiosks.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedServiceForPoster("all");
                setShowPosterModal(true);
              }}
              className="px-5 py-3 rounded-full bg-brand hover:bg-brand-dark text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2"
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
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-danger/30 text-danger flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 flex-shrink-0 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-xs sm:text-sm font-semibold">{error}</span>
            </div>
            <button
              onClick={() => loadOverview()}
              className="text-xs underline hover:text-ink ml-3 font-bold"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── KPI Telemetry Grid ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {/* Total Tickets */}
          <div className="p-5 rounded-2xl bg-white border border-line-strong shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-soft mb-1">
              <span>Total Tickets</span>
              <span className="font-mono text-[10px] text-brand uppercase bg-mint px-2 py-0.5 rounded-full">Today</span>
            </div>
            <div className="text-3xl font-extrabold text-ink font-mono mt-1">
              {data?.stats.total_tickets ?? "—"}
            </div>
            <div className="text-xs text-soft mt-1">Registrar & Student Affairs</div>
          </div>

          {/* Active Waiting */}
          <div className="p-5 rounded-2xl bg-white border border-line-strong shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-soft mb-1">
              <span>Waiting in Line</span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
            </div>
            <div className="text-3xl font-extrabold text-amber-600 font-mono mt-1">
              {data?.stats.waiting ?? "—"}
            </div>
            <div className="text-xs text-soft mt-1">Students relaxing outside</div>
          </div>

          {/* Serving */}
          <div className="p-5 rounded-2xl bg-white border border-line-strong shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-soft mb-1">
              <span>Now at Desks</span>
              <span className="w-2.5 h-2.5 rounded-full bg-ok" />
            </div>
            <div className="text-3xl font-extrabold text-ok font-mono mt-1">
              {data?.stats.serving ?? "—"}
            </div>
            <div className="text-xs text-soft mt-1">Currently in consultation</div>
          </div>

          {/* Completed */}
          <div className="p-5 rounded-2xl bg-white border border-line-strong shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-soft mb-1">
              <span>Completed</span>
              <span className="font-mono text-[10px] text-ok bg-emerald-50 px-2 py-0.5 rounded-full">Processed</span>
            </div>
            <div className="text-3xl font-extrabold text-brand font-mono mt-1">
              {data?.stats.completed ?? "—"}
            </div>
            <div className="text-xs text-soft mt-1">Successfully handled</div>
          </div>

          {/* Absent / Skipped */}
          <div className="col-span-2 lg:col-span-1 p-5 rounded-2xl bg-white border border-line-strong shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-soft mb-1">
              <span>No-Show / Absent</span>
              <span className="font-mono text-[10px] text-danger bg-rose-50 px-2 py-0.5 rounded-full">Attrition</span>
            </div>
            <div className="text-3xl font-extrabold text-danger font-mono mt-1">
              {data?.stats.absent_or_skipped ?? "—"}
            </div>
            <div className="text-xs text-soft mt-1">
              {data?.stats.total_tickets
                ? `${Math.round(((data.stats.absent_or_skipped || 0) / data.stats.total_tickets) * 100)}% rate`
                : "0% rate"}
            </div>
          </div>
        </div>

        {/* ── Navigation Tabs ── */}
        <div className="flex items-center gap-2 border-b border-line pb-px mb-6">
          <button
            onClick={() => setActiveTab("services")}
            className={`px-5 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "services"
                ? "border-brand text-brand bg-white rounded-t-xl"
                : "border-transparent text-soft hover:text-ink"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span>Service Lines ({data?.services.length ?? 0})</span>
          </button>

          <button
            onClick={() => setActiveTab("desks")}
            className={`px-5 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "desks"
                ? "border-brand text-brand bg-white rounded-t-xl"
                : "border-transparent text-soft hover:text-ink"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span>Counters & Desks ({data?.desks.length ?? 0})</span>
          </button>

          <button
            onClick={() => setActiveTab("posters")}
            className={`px-5 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "posters"
                ? "border-brand text-brand bg-white rounded-t-xl"
                : "border-transparent text-soft hover:text-ink"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span>QR Code Posters</span>
          </button>

          <button
            onClick={() => setActiveTab("organisations")}
            className={`px-5 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "organisations"
                ? "border-brand text-brand bg-white rounded-t-xl"
                : "border-transparent text-soft hover:text-ink"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span>Organisation Approvals</span>
            {orgApplications.filter((a) => a.status === "PENDING_REVIEW").length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white animate-pulse">
                {orgApplications.filter((a) => a.status === "PENDING_REVIEW").length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("audit")}
            className={`px-5 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "audit"
                ? "border-brand text-brand bg-white rounded-t-xl"
                : "border-transparent text-soft hover:text-ink"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Audit Trail</span>
          </button>
        </div>

        {/* ── TAB 1: SERVICE LINES ── */}
        {activeTab === "services" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-soft font-medium">
                Pause or resume virtual queue ticket registration for specific departments.
              </p>
              <button
                onClick={() => setShowNewServiceModal(true)}
                className="px-4 py-2 rounded-xl bg-white border border-line-strong text-brand text-xs font-bold hover:bg-mint transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Add Service Line</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {data?.services.map((service) => (
                <div
                  key={service.id}
                  className={`p-6 rounded-3xl border transition-all bg-white shadow-xs ${
                    service.is_active ? "border-line-strong" : "border-line opacity-80"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-mint text-brand border border-line-strong">
                        [{service.prefix}]
                      </span>
                      <h3 className="font-bold text-ink text-base leading-tight">
                        {service.name}
                      </h3>
                    </div>

                    <span
                      className={`text-[10px] font-mono uppercase px-2.5 py-1 rounded-full font-bold ${
                        service.is_active
                          ? "bg-emerald-50 text-ok border border-ok/30"
                          : "bg-rose-50 text-danger border border-danger/30"
                      }`}
                    >
                      {service.is_active ? "Accepting Tickets" : "Queue Paused"}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs text-soft mb-6 bg-[#f8faf9] p-3.5 rounded-2xl border border-line">
                    <div className="flex items-center justify-between">
                      <span>Avg. Handling Duration:</span>
                      <span className="text-ink font-mono font-bold">
                        {service.avg_duration_minutes} mins
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Facility:</span>
                      <span className="text-ink font-medium">
                        {service.facilities?.name || "Student Services"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Location:</span>
                      <span className="text-ink font-medium">
                        {service.facilities?.location || "Main Campus"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-line">
                    <button
                      onClick={() => handleToggleService(service)}
                      disabled={actionPending === `service-${service.id}`}
                      className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        service.is_active
                          ? "bg-rose-50 border border-danger/30 text-danger hover:bg-rose-100"
                          : "bg-emerald-50 border border-ok/30 text-ok hover:bg-emerald-100"
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
                      className="py-2.5 px-4 rounded-xl bg-white border border-line-strong text-brand hover:border-brand hover:bg-mint transition-all text-xs font-bold flex items-center gap-1 shadow-xs"
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
              <p className="text-xs text-soft font-medium">
                Open or close individual staff physical desks for serving tickets.
              </p>
              <button
                onClick={() => setShowNewDeskModal(true)}
                className="px-4 py-2 rounded-xl bg-white border border-line-strong text-brand text-xs font-bold hover:bg-mint transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Add Counter</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {data?.desks.map((desk) => (
                <div
                  key={desk.id}
                  className={`p-6 rounded-3xl border transition-all bg-white shadow-xs ${
                    desk.is_open ? "border-line-strong" : "border-line opacity-80"
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-mint border border-line-strong flex items-center justify-center text-brand font-mono font-extrabold text-base">
                      {desk.name.replace(/[^0-9]/g, "") || "D"}
                    </div>
                    <span
                      className={`text-[10px] font-mono uppercase px-2.5 py-1 rounded-full font-bold ${
                        desk.is_open
                          ? "bg-emerald-50 text-ok border border-ok/30"
                          : "bg-rose-50 text-danger border border-danger/30"
                      }`}
                    >
                      {desk.is_open ? "Open / Active" : "Closed"}
                    </span>
                  </div>

                  <h3 className="font-bold text-ink text-lg mb-1">{desk.name}</h3>
                  <p className="text-xs text-soft mb-5">
                    Counter station for student consultations
                  </p>

                  <button
                    onClick={() => handleToggleDesk(desk)}
                    disabled={actionPending === `desk-${desk.id}`}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      desk.is_open
                        ? "bg-rose-50 border border-danger/30 text-danger hover:bg-rose-100"
                        : "bg-emerald-50 border border-ok/30 text-ok hover:bg-emerald-100"
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
            <div className="p-8 rounded-3xl bg-white border border-line-strong shadow-xs">
              <h2 className="text-xl font-extrabold text-ink mb-1.5">Printable Queue Entry Station</h2>
              <p className="text-xs sm:text-sm text-soft mb-8 max-w-3xl leading-relaxed">
                Generate high-resolution printable posters to stick at entrance halls, building bulletin boards, and counter stations. Students scan the QR code with their camera to immediately receive a virtual ticket and live WhatsApp dispatch notifications.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Control Panel */}
                <div className="space-y-5 bg-[#f8faf9] p-6 rounded-2xl border border-line">
                  <div>
                    <label htmlFor={posterServiceSelectId} className="block text-xs font-bold text-ink uppercase tracking-wider mb-2">
                      Target Service
                    </label>
                    <select
                      id={posterServiceSelectId}
                      value={selectedServiceForPoster}
                      onChange={(e) => setSelectedServiceForPoster(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-line-strong text-ink text-xs font-semibold focus:border-brand focus:outline-none"
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
                    <label htmlFor={baseUrlInputId} className="block text-xs font-bold text-ink uppercase tracking-wider mb-2">
                      Base Kiosk URL
                    </label>
                    <input
                      id={baseUrlInputId}
                      type="text"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder="e.g. https://krenox.online"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-line-strong text-ink text-xs font-mono focus:border-brand focus:outline-none"
                    />
                    <p className="text-[11px] text-soft mt-1.5">
                      Target URL encoded into the scannable QR code.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => setShowPosterModal(true)}
                      className="w-full py-3 px-4 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-md"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      <span>Preview & Print Poster (A4)</span>
                    </button>
                  </div>
                </div>

                {/* Live Preview Card */}
                <div className="md:col-span-2 p-8 rounded-2xl bg-white text-ink flex flex-col items-center justify-center text-center shadow-md border-2 border-dashed border-line-strong">
                  <div className="text-xs font-extrabold tracking-widest text-brand uppercase mb-1">
                    University of Buea
                  </div>
                  <h3 className="text-2xl font-black text-ink mb-1">
                    {selectedServiceObj ? selectedServiceObj.name : "Digital Queue Station"}
                  </h3>
                  <p className="text-xs text-soft max-w-sm mb-5 leading-relaxed">
                    Scan with your smartphone camera to join the queue and receive WhatsApp alerts when your turn arrives.
                  </p>

                  {/* QR Code Container */}
                  <div className="p-3 bg-white border-2 border-brand rounded-2xl shadow-sm mb-4">
                    {qrDataUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={qrDataUrl}
                        alt="Krenox Queue QR Code"
                        className="w-48 h-48 sm:w-56 sm:h-56 object-contain"
                      />
                    ) : (
                      <div className="w-48 h-48 flex items-center justify-center text-xs text-soft">
                        Generating QR...
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3 w-full max-w-md text-left text-xs text-soft border-t border-line pt-4">
                    <div>
                      <div className="font-bold text-ink">1. Scan</div>
                      <div>Point phone camera</div>
                    </div>
                    <div>
                      <div className="font-bold text-ink">2. Register</div>
                      <div>Enter name & phone</div>
                    </div>
                    <div>
                      <div className="font-bold text-ink">3. Relax</div>
                      <div>Get WhatsApp alert</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 4: ORGANISATION APPROVALS ── */}
        {activeTab === "organisations" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-extrabold text-ink">Organisation Onboarding & Approval Queue</h3>
                <p className="text-xs text-soft mt-0.5">
                  Review applicant tenant credentials, verify contact identity, and control operational activation.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadOrganisations}
                  disabled={loadingOrgs}
                  className="px-3.5 py-2 rounded-xl bg-white border border-line-strong text-ink text-xs font-semibold hover:bg-surface-sunken transition flex items-center gap-1.5 shadow-xs"
                >
                  <svg className={`w-3.5 h-3.5 ${loadingOrgs ? "animate-spin text-brand" : "text-soft"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>{loadingOrgs ? "Refreshing..." : "Refresh Queue"}</span>
                </button>
                <Link
                  href="/register-organisation"
                  target="_blank"
                  className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-dark text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  <span>Public Registration Form ↗</span>
                </Link>
              </div>
            </div>

            {/* Metrics Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <button
                onClick={() => setOrgFilter("ALL")}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  orgFilter === "ALL"
                    ? "bg-white border-brand shadow-xs ring-2 ring-brand/10"
                    : "bg-surface-sunken border-line hover:border-line-strong"
                }`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-soft">Total Applications</p>
                <p className="text-2xl font-black text-ink font-mono mt-1">{orgApplications.length}</p>
              </button>

              <button
                onClick={() => setOrgFilter("PENDING_REVIEW")}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  orgFilter === "PENDING_REVIEW"
                    ? "bg-amber-50/70 border-amber-500 shadow-xs ring-2 ring-amber-500/20"
                    : "bg-surface-sunken border-line hover:border-line-strong"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Pending Review</p>
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                </div>
                <p className="text-2xl font-black text-amber-900 font-mono mt-1">
                  {orgApplications.filter((a) => a.status === "PENDING_REVIEW").length}
                </p>
              </button>

              <button
                onClick={() => setOrgFilter("ACTION_REQUIRED")}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  orgFilter === "ACTION_REQUIRED"
                    ? "bg-orange-50/70 border-orange-500 shadow-xs ring-2 ring-orange-500/20"
                    : "bg-surface-sunken border-line hover:border-line-strong"
                }`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-orange-700">Action Required</p>
                <p className="text-2xl font-black text-orange-900 font-mono mt-1">
                  {orgApplications.filter((a) => a.status === "ACTION_REQUIRED").length}
                </p>
              </button>

              <button
                onClick={() => setOrgFilter("APPROVED")}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  orgFilter === "APPROVED"
                    ? "bg-emerald-50/70 border-emerald-500 shadow-xs ring-2 ring-emerald-500/20"
                    : "bg-surface-sunken border-line hover:border-line-strong"
                }`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Approved</p>
                <p className="text-2xl font-black text-emerald-900 font-mono mt-1">
                  {orgApplications.filter((a) => a.status === "APPROVED").length}
                </p>
              </button>

              <button
                onClick={() => setOrgFilter("REJECTED")}
                className={`p-4 rounded-2xl border text-left transition-all col-span-2 sm:col-span-1 ${
                  orgFilter === "REJECTED"
                    ? "bg-rose-50/70 border-rose-500 shadow-xs ring-2 ring-rose-500/20"
                    : "bg-surface-sunken border-line hover:border-line-strong"
                }`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Rejected / Suspended</p>
                <p className="text-2xl font-black text-rose-900 font-mono mt-1">
                  {orgApplications.filter((a) => a.status === "REJECTED" || a.status === "SUSPENDED").length}
                </p>
              </button>
            </div>

            {/* Application Cards List */}
            {orgApplications.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-3xl border border-line-strong">
                <p className="text-sm font-semibold text-soft">No organisation registration applications found.</p>
                <p className="text-xs text-soft mt-1">New registrations from the public portal will appear here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {orgApplications
                  .filter((app) => {
                    if (orgFilter === "ALL") return true;
                    if (orgFilter === "REJECTED") return app.status === "REJECTED" || app.status === "SUSPENDED";
                    return app.status === orgFilter;
                  })
                  .map((app) => {
                    const isPending = app.status === "PENDING_REVIEW";
                    const isActionReq = app.status === "ACTION_REQUIRED";
                    const isApproved = app.status === "APPROVED";
                    const isSuspended = app.status === "SUSPENDED";

                    return (
                      <div
                        key={app.id}
                        className={`p-6 rounded-3xl bg-white border transition-all shadow-xs ${
                          isPending
                            ? "border-amber-300 ring-2 ring-amber-400/20"
                            : isActionReq
                            ? "border-orange-300"
                            : isApproved
                            ? "border-line-strong"
                            : "border-rose-200 opacity-90"
                        }`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 border-b border-line pb-4 mb-4">
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-lg font-black text-ink">{app.name}</h4>
                              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-mint text-forest border border-mint/40">
                                {app.category}
                              </span>
                              <span className="font-mono text-xs font-bold text-soft px-2 py-0.5 rounded-md bg-surface-sunken border border-line">
                                {app.registration_ref}
                              </span>
                            </div>
                            <p className="text-xs text-soft">
                              Submitted: {new Date(app.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                              {app.reviewed_at && (
                                <span className="ml-2">
                                  • Reviewed: {new Date(app.reviewed_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                                  {app.reviewed_by ? ` by ${app.reviewed_by}` : ""}
                                </span>
                              )}
                            </p>
                          </div>

                          <div>
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide border ${
                                isPending
                                  ? "bg-amber-100 text-amber-900 border-amber-300"
                                  : isActionReq
                                  ? "bg-orange-100 text-orange-900 border-orange-300"
                                  : isApproved
                                  ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                                  : isSuspended
                                  ? "bg-slate-200 text-slate-800 border-slate-300"
                                  : "bg-rose-100 text-rose-900 border-rose-300"
                              }`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              {app.status.replace("_", " ")}
                            </span>
                          </div>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs mb-4">
                          <div className="p-3 rounded-2xl bg-surface-sunken border border-line">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-soft">Contact Person</p>
                            <p className="font-bold text-ink mt-0.5">{app.contact_name}</p>
                            <div className="flex items-center gap-1.5 mt-1 text-soft font-mono">
                              {app.contact_channel === "whatsapp" ? (
                                <span className="text-emerald-600 font-bold">WhatsApp:</span>
                              ) : (
                                <span className="text-brand font-bold">Email:</span>
                              )}
                              <span>{app.masked_contact_value || app.contact_value}</span>
                              {app.contact_verified && (
                                <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-bold">
                                  ✓ Verified
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="p-3 rounded-2xl bg-surface-sunken border border-line">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-soft">Operating Location</p>
                            <p className="font-bold text-ink mt-0.5">{app.location}</p>
                            <p className="text-[11px] text-soft mt-1">Tenant Slug: <code className="font-mono text-ink">{app.slug}</code></p>
                          </div>

                          <div className="p-3 rounded-2xl bg-surface-sunken border border-line">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-soft">
                              {isApproved ? "Account Setup Status" : "Review Response Window"}
                            </p>
                            {isApproved ? (
                              app.is_account_setup ? (
                                <p className="font-bold text-emerald-700 mt-0.5">
                                  ✓ Configured ({app.admin_email || "Active"})
                                </p>
                              ) : (
                                <p className="font-bold text-amber-600 mt-0.5">
                                  Pending Setup (Token Active)
                                </p>
                              )
                            ) : (
                              <p className="font-bold text-ink mt-0.5">{app.expected_review_window || "Within 1 hour"}</p>
                            )}
                            <p className="text-[11px] text-soft mt-1">
                              {isApproved
                                ? (app.is_account_setup ? "Credentials active for login" : "Setup link dispatched to applicant")
                                : "Automated email/WhatsApp notifications"}
                            </p>
                          </div>
                        </div>

                        {/* Status Notes Callout */}
                        {app.status_reason && (
                          <div className="mb-4 p-3.5 rounded-2xl bg-surface-sunken border-l-4 border-l-brand border border-line text-xs">
                            <p className="font-bold text-ink">Administrative Decision Note:</p>
                            <p className="text-soft mt-0.5">{app.status_reason}</p>
                          </div>
                        )}

                        {app.additional_info && (
                          <div className="mb-4 p-3.5 rounded-2xl bg-surface-sunken border border-line text-xs">
                            <p className="font-bold text-ink">Applicant Submitted Details:</p>
                            <p className="text-soft mt-0.5">{app.additional_info}</p>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-line">
                          {isPending && (
                            <>
                              <button
                                onClick={() =>
                                  setReviewModal({
                                    isOpen: true,
                                    app,
                                    action: "approve",
                                    reason: "",
                                    facilityName: `${app.name} Main Facility`,
                                    submitting: false,
                                    error: null,
                                  })
                                }
                                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span>Approve Organisation</span>
                              </button>

                              <button
                                onClick={() =>
                                  setReviewModal({
                                    isOpen: true,
                                    app,
                                    action: "request_info",
                                    reason: "",
                                    facilityName: "",
                                    submitting: false,
                                    error: null,
                                  })
                                }
                                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                                <span>Request Information</span>
                              </button>

                              <button
                                onClick={() =>
                                  setReviewModal({
                                    isOpen: true,
                                    app,
                                    action: "reject",
                                    reason: "",
                                    facilityName: "",
                                    submitting: false,
                                    error: null,
                                  })
                                }
                                className="px-4 py-2 rounded-xl bg-rose-50 border border-rose-300 text-rose-700 hover:bg-rose-100 font-bold text-xs flex items-center gap-1.5 transition"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <span>Reject</span>
                              </button>
                            </>
                          )}

                          {isActionReq && (
                            <>
                              <button
                                onClick={() =>
                                  setReviewModal({
                                    isOpen: true,
                                    app,
                                    action: "approve",
                                    reason: "",
                                    facilityName: `${app.name} Main Facility`,
                                    submitting: false,
                                    error: null,
                                  })
                                }
                                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition"
                              >
                                <span>Approve Organisation</span>
                              </button>

                              <button
                                onClick={() =>
                                  setReviewModal({
                                    isOpen: true,
                                    app,
                                    action: "reject",
                                    reason: "",
                                    facilityName: "",
                                    submitting: false,
                                    error: null,
                                  })
                                }
                                className="px-4 py-2 rounded-xl bg-rose-50 border border-rose-300 text-rose-700 hover:bg-rose-100 font-bold text-xs transition"
                              >
                                <span>Reject</span>
                              </button>
                            </>
                          )}

                          {isApproved && (
                            <div className="flex flex-wrap items-center gap-2">
                              {app.setup_url && !app.is_account_setup && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(app.setup_url || "");
                                    alert("Account Setup Link copied to clipboard!\n\n" + app.setup_url);
                                  }}
                                  className="px-3.5 py-2 rounded-xl bg-mint text-forest font-bold text-xs flex items-center gap-1.5 border border-mint/50 hover:bg-[#1affb2] transition shadow-xs"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                  </svg>
                                  <span>Copy Setup Link</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const res = await regenerateSetupToken(app.id);
                                    await loadOrganisations();
                                    alert("New setup token generated and link created:\n\n" + res.setup_url);
                                  } catch (err) {
                                    alert("Failed to regenerate setup token: " + String(err));
                                  }
                                }}
                                className="px-3 py-2 rounded-xl bg-surface-sunken border border-line-strong text-ink text-xs font-semibold hover:bg-white transition"
                                title="Regenerate single-use setup link"
                              >
                                <span>{app.is_account_setup ? "Regenerate Admin Invite" : "New Setup Token"}</span>
                              </button>

                              <button
                                onClick={() =>
                                  setReviewModal({
                                    isOpen: true,
                                    app,
                                    action: "suspend",
                                    reason: "",
                                    facilityName: "",
                                    submitting: false,
                                    error: null,
                                  })
                                }
                                className="px-3.5 py-2 rounded-xl bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-xs flex items-center gap-1.5 transition"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                                <span>Suspend Operations</span>
                              </button>
                            </div>
                          )}

                          {isSuspended && (
                            <button
                              onClick={() =>
                                setReviewModal({
                                  isOpen: true,
                                  app,
                                  action: "approve",
                                  reason: "Re-activated following administrative clearance",
                                  facilityName: `${app.name} Main Facility`,
                                  submitting: false,
                                  error: null,
                                })
                              }
                              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition"
                            >
                              <span>Re-Approve Access</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 5: AUDIT TRAIL ── */}
        {activeTab === "audit" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-ink">Administrative & Onboarding Audit Trail</h3>
                <p className="text-xs text-soft mt-0.5">
                  Immutable chronological record of onboarding state transitions, actor attributions, and administrative actions.
                </p>
              </div>
              <button
                onClick={loadOrganisations}
                disabled={loadingOrgs}
                className="px-3.5 py-2 rounded-xl bg-white border border-line-strong text-ink text-xs font-semibold hover:bg-surface-sunken transition flex items-center gap-1.5 shadow-xs"
              >
                <span>{loadingOrgs ? "Refreshing..." : "Refresh Audit Logs"}</span>
              </button>
            </div>

            <div className="bg-white rounded-3xl border border-line-strong overflow-hidden shadow-xs">
              {auditLogs.length === 0 ? (
                <div className="p-12 text-center text-xs text-soft">
                  No governance audit records logged yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-sunken border-b border-line text-[11px] font-bold uppercase tracking-wider text-soft">
                      <tr>
                        <th className="px-5 py-3.5">Timestamp</th>
                        <th className="px-5 py-3.5">Reference</th>
                        <th className="px-5 py-3.5">Action</th>
                        <th className="px-5 py-3.5">Actor</th>
                        <th className="px-5 py-3.5">Transition</th>
                        <th className="px-5 py-3.5">Reason / Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-mint/10 transition-colors">
                          <td className="px-5 py-3.5 font-mono text-soft whitespace-nowrap">
                            {new Date(log.created_at || log.timestamp || Date.now()).toLocaleString(undefined, { dateStyle: "short", timeStyle: "medium" })}
                          </td>
                          <td className="px-5 py-3.5 font-mono font-bold text-brand whitespace-nowrap">
                            {log.registration_ref}
                          </td>
                          <td className="px-5 py-3.5 font-semibold text-ink whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-md bg-surface-sunken border border-line font-mono text-[11px]">
                              {log.action}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-medium text-ink whitespace-nowrap">
                            {log.actor}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span className="font-mono text-[11px]">
                              <span className="text-soft">{log.previous_status || "—"}</span>
                              <span className="mx-1.5 text-brand font-bold">→</span>
                              <span className="font-bold text-ink">{log.new_status}</span>
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-soft max-w-xs truncate">
                            {log.reason || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── PRINTABLE POSTER MODAL & PRINT VIEW ── */}
      {showPosterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/70 backdrop-blur-xs overflow-y-auto">
          {/* Controls bar outside print area */}
          <div className="fixed top-4 right-4 z-50 flex items-center gap-3 no-print">
            <button
              onClick={() => window.print()}
              className="px-5 py-2.5 rounded-full bg-brand hover:bg-brand-dark text-white font-bold text-xs sm:text-sm shadow-xl flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>Print A4 Poster</span>
            </button>

            <button
              onClick={() => setShowPosterModal(false)}
              className="p-2 rounded-full bg-white text-ink hover:bg-mint transition-colors shadow-md"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="w-full max-w-2xl my-8 flex flex-col items-center">
            {/* ── Top QR Target Config Tray (Hidden during printing) ── */}
            <div className="w-full bg-[#08282b] text-white p-4 rounded-3xl mb-4 border border-white/10 shadow-xl no-print space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <span className="font-bold text-mint uppercase tracking-wider text-[11px]">
                  QR Target Configuration
                </span>
                <span className="text-white/60 text-[11px]">
                  Select network mode so phone cameras can reach your kiosk
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Organisation Selector */}
                {data?.organisations && data.organisations.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-semibold text-white/80 mb-1">
                      Organisation:
                    </label>
                    <select
                      value={activeOrgSlug}
                      onChange={(e) => setSelectedOrgSlug(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-semibold focus:outline-none focus:border-mint"
                    >
                      {data.organisations.map((org) => (
                        <option key={org.id} value={org.slug} className="text-ink">
                          {org.name} (/q/{org.slug})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Connection Mode */}
                <div>
                  <label className="block text-[11px] font-semibold text-white/80 mb-1">
                    Scan Host Mode:
                  </label>
                  <select
                    value={qrHostMode}
                    onChange={(e) => setQrHostMode(e.target.value as "lan" | "localhost" | "custom")}
                    className="w-full px-3 py-1.5 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-semibold focus:outline-none focus:border-mint"
                  >
                    <option value="lan" className="text-ink">
                      📱 Phone Wi-Fi ({data?.local_ip || "192.168.1.242"}:3000)
                    </option>
                    <option value="localhost" className="text-ink">
                      💻 Localhost (localhost:3000)
                    </option>
                    <option value="custom" className="text-ink">
                      🌐 Custom Domain / Ngrok
                    </option>
                  </select>
                </div>
              </div>

              {qrHostMode === "custom" && (
                <div>
                  <label className="block text-[11px] font-semibold text-white/80 mb-1">
                    Custom Base URL:
                  </label>
                  <input
                    type="url"
                    placeholder="https://krenox.cm or https://xyz.ngrok-free.app"
                    value={customHost}
                    onChange={(e) => setCustomHost(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-mono focus:outline-none focus:border-mint"
                  />
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-white/10 text-[11px]">
                <div className="flex items-center gap-2 font-mono text-mint truncate">
                  <span className="w-2 h-2 rounded-full bg-mint animate-pulse shrink-0" />
                  <span className="truncate">{targetUrl}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(targetUrl);
                      setCopiedTargetUrl(true);
                      setTimeout(() => setCopiedTargetUrl(false), 2000);
                    }}
                    className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold transition"
                  >
                    {copiedTargetUrl ? "✓ Copied" : "Copy URL"}
                  </button>
                  <a
                    href={targetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1 rounded-lg bg-mint text-forest-dark font-bold hover:bg-mint-dark transition"
                  >
                    Open in Tab ↗
                  </a>
                </div>
              </div>
            </div>

            {/* Printable Poster (White paper format) */}
            <div className="printable-poster w-full bg-white text-ink rounded-3xl p-8 sm:p-12 shadow-2xl relative flex flex-col items-center text-center border border-line-strong">
              {/* Institution Seal Badge */}
              <div className="w-16 h-16 rounded-2xl bg-brand text-white flex items-center justify-center font-black text-2xl shadow-md mb-3 tracking-wider">
                {activeOrgName
                  .split(" ")
                  .map((w) => w[0])
                  .filter(Boolean)
                  .slice(0, 3)
                  .join("")
                  .toUpperCase() || "UB"}
              </div>

              <div className="text-xs uppercase tracking-widest font-bold text-brand mb-1">
                {activeOrgName} • Virtual Queue Entry Point
              </div>

              <h1 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight mb-2">
                {selectedServiceObj ? selectedServiceObj.name : "Digital Queue Station"}
              </h1>

              <p className="text-sm sm:text-base text-soft max-w-lg mb-6 leading-relaxed">
                Skip the crowded physical waiting lines. Scan the QR code below with your phone camera to take your digital ticket and track your spot in real time.
              </p>

              {/* QR Code Big Container */}
              <div className="p-4 bg-white border-4 border-brand rounded-3xl shadow-md mb-6">
                {qrDataUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={qrDataUrl}
                    alt="Krenox Queue Ticket QR"
                    className="w-64 h-64 sm:w-80 sm:h-80 object-contain"
                  />
                )}
              </div>

              {/* Verified Web URL */}
              <div className="font-mono text-xs text-brand font-bold bg-mint px-4 py-2 rounded-xl border border-line-strong mb-6 max-w-full truncate">
                {targetUrl}
              </div>

              {/* 3 Step Instruction Box */}
              <div className="grid grid-cols-3 gap-4 w-full border-t border-b border-line py-6 mb-6 text-left">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand text-white font-bold flex items-center justify-center text-sm flex-shrink-0">
                    1
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-ink">Scan Code</h4>
                    <p className="text-[11px] text-soft">
                      Open phone camera or QR scanner
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand text-white font-bold flex items-center justify-center text-sm flex-shrink-0">
                    2
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-ink">Take Ticket</h4>
                    <p className="text-[11px] text-soft">
                      Provide name & WhatsApp number
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand text-white font-bold flex items-center justify-center text-sm flex-shrink-0">
                    3
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-ink">Relax & Enter</h4>
                    <p className="text-[11px] text-soft">
                      We message you when ready
                    </p>
                  </div>
                </div>
              </div>

              {/* Privacy & Anti-Crowding Notice */}
              <div className="text-[11px] text-soft max-w-md">
                <p>
                  <strong className="text-ink">Anti-Crowding System:</strong> Please step away from the entrance door while waiting. You can monitor your live position on your phone.
                </p>
                <p className="text-[10px] text-muted mt-2 font-mono">
                  Powered by Krenox Virtual Queue Engine • University of Buea B.Tech Project
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD SERVICE MODAL ── */}
      {showNewServiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/70 backdrop-blur-xs no-print">
          <div className="w-full max-w-md rounded-3xl bg-white border border-line-strong p-6 sm:p-8 shadow-2xl text-ink">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-extrabold text-ink text-lg">Add New Service Line</h3>
              <button
                onClick={() => setShowNewServiceModal(false)}
                className="text-soft hover:text-ink p-1 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {newServiceError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-danger/30 text-danger text-xs font-semibold">
                {newServiceError}
              </div>
            )}

            <form onSubmit={handleCreateService} className="space-y-4">
              <div>
                <label htmlFor={serviceNameInputId} className="block text-xs font-bold text-ink mb-1.5 uppercase tracking-wider">
                  Service Name
                </label>
                <input
                  id={serviceNameInputId}
                  type="text"
                  required
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  placeholder="e.g. Clearance & Graduation"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-line-strong text-ink text-xs font-medium focus:border-brand focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={servicePrefixInputId} className="block text-xs font-bold text-ink mb-1.5 uppercase tracking-wider">
                    Prefix (1-3 chars)
                  </label>
                  <input
                    id={servicePrefixInputId}
                    type="text"
                    required
                    maxLength={3}
                    value={newServicePrefix}
                    onChange={(e) => setNewServicePrefix(e.target.value)}
                    placeholder="e.g. C"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-line-strong text-ink text-xs uppercase font-mono font-bold focus:border-brand focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor={serviceDurationInputId} className="block text-xs font-bold text-ink mb-1.5 uppercase tracking-wider">
                    Avg. Duration (mins)
                  </label>
                  <input
                    id={serviceDurationInputId}
                    type="number"
                    min={1}
                    max={120}
                    value={newServiceDuration}
                    onChange={(e) => setNewServiceDuration(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-line-strong text-ink text-xs font-mono font-bold focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewServiceModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-soft hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newServiceSubmitting}
                  className="px-5 py-2.5 rounded-full bg-brand hover:bg-brand-dark text-white font-bold text-xs disabled:opacity-50 shadow-sm"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/70 backdrop-blur-xs no-print">
          <div className="w-full max-w-md rounded-3xl bg-white border border-line-strong p-6 sm:p-8 shadow-2xl text-ink">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-extrabold text-ink text-lg">Add Service Counter / Desk</h3>
              <button
                onClick={() => setShowNewDeskModal(false)}
                className="text-soft hover:text-ink p-1 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {newDeskError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-danger/30 text-danger text-xs font-semibold">
                {newDeskError}
              </div>
            )}

            <form onSubmit={handleCreateDesk} className="space-y-4">
              <div>
                <label htmlFor={deskNameInputId} className="block text-xs font-bold text-ink mb-1.5 uppercase tracking-wider">
                  Counter Name / Number
                </label>
                <input
                  id={deskNameInputId}
                  type="text"
                  required
                  value={newDeskName}
                  onChange={(e) => setNewDeskName(e.target.value)}
                  placeholder="e.g. Desk 3 (Academic Advisory)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-line-strong text-ink text-xs font-medium focus:border-brand focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewDeskModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-soft hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newDeskSubmitting}
                  className="px-5 py-2.5 rounded-full bg-brand hover:bg-brand-dark text-white font-bold text-xs disabled:opacity-50 shadow-sm"
                >
                  {newDeskSubmitting ? "Creating..." : "Save Counter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ORGANISATION REVIEW MODAL ── */}
      {reviewModal.isOpen && reviewModal.app && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/70 backdrop-blur-xs no-print">
          <div className="w-full max-w-lg rounded-3xl bg-white border border-line-strong p-6 sm:p-8 shadow-2xl text-ink">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="font-mono text-[10px] font-bold text-soft bg-surface-sunken px-2 py-0.5 rounded border border-line">
                  {reviewModal.app.registration_ref}
                </span>
                <h3 className="font-extrabold text-ink text-lg mt-1">
                  {reviewModal.action === "approve"
                    ? "Approve Organisation Registration"
                    : reviewModal.action === "reject"
                    ? "Reject Organisation Registration"
                    : reviewModal.action === "request_info"
                    ? "Request Additional Information"
                    : "Suspend Operational Access"}
                </h3>
              </div>
              <button
                onClick={() => setReviewModal((m) => ({ ...m, isOpen: false }))}
                className="text-soft hover:text-ink p-1 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4 p-3 rounded-2xl bg-surface-sunken border border-line text-xs">
              <p className="font-bold text-ink">{reviewModal.app.name}</p>
              <p className="text-soft mt-0.5">
                Contact: {reviewModal.app.contact_name} ({reviewModal.app.contact_channel}: {reviewModal.app.masked_contact_value || reviewModal.app.contact_value})
              </p>
            </div>

            {reviewModal.error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-danger/30 text-danger text-xs font-semibold">
                {reviewModal.error}
              </div>
            )}

            <form onSubmit={handleReviewSubmit} className="space-y-4">
              {reviewModal.action === "approve" && (
                <div>
                  <label className="block text-xs font-bold text-ink mb-1.5 uppercase tracking-wider">
                    Initial Facility Name
                  </label>
                  <input
                    type="text"
                    required
                    value={reviewModal.facilityName}
                    onChange={(e) =>
                      setReviewModal((m) => ({ ...m, facilityName: e.target.value }))
                    }
                    placeholder="e.g. Main Facility or Head Office"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-line-strong text-ink text-xs font-medium focus:border-brand focus:outline-none"
                  />
                  <p className="text-[11px] text-soft mt-1">
                    This facility will be provisioned automatically for the tenant.
                  </p>
                  <p className="text-[11px] text-emerald-800 bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200 mt-2.5 leading-relaxed">
                    ⚡ <strong>Automated Account Activation:</strong> Krenox will generate a secure one-time setup token and link, allowing the applicant to configure their administrator credentials and access their dashboard.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-ink mb-1.5 uppercase tracking-wider">
                  {reviewModal.action === "approve"
                    ? "Approval Note (Optional)"
                    : reviewModal.action === "reject"
                    ? "Mandatory Rejection Reason"
                    : reviewModal.action === "request_info"
                    ? "Information Required from Applicant"
                    : "Mandatory Reason for Suspension"}
                </label>
                <textarea
                  required={reviewModal.action !== "approve"}
                  rows={3}
                  value={reviewModal.reason}
                  onChange={(e) =>
                    setReviewModal((m) => ({ ...m, reason: e.target.value }))
                  }
                  placeholder={
                    reviewModal.action === "approve"
                      ? "e.g. Verified official identity documentation."
                      : reviewModal.action === "reject"
                      ? "e.g. Incomplete operational credentials or duplicate entry."
                      : reviewModal.action === "request_info"
                      ? "e.g. Please provide your business registration certificate or website URL."
                      : "e.g. Temporary administrative suspension pending compliance check."
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-line-strong text-ink text-xs font-medium focus:border-brand focus:outline-none resize-none"
                />
                <p className="text-[11px] text-soft mt-1">
                  This note will be logged in the immutable audit trail and dispatched to the applicant via {reviewModal.app.contact_channel}.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-line">
                <button
                  type="button"
                  onClick={() => setReviewModal((m) => ({ ...m, isOpen: false }))}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-soft hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reviewModal.submitting}
                  className={`px-5 py-2.5 rounded-full font-bold text-xs disabled:opacity-50 text-white shadow-sm transition ${
                    reviewModal.action === "approve"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : reviewModal.action === "request_info"
                      ? "bg-amber-500 hover:bg-amber-600"
                      : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {reviewModal.submitting
                    ? "Processing..."
                    : reviewModal.action === "approve"
                    ? "Confirm Approval"
                    : reviewModal.action === "request_info"
                    ? "Send Clarification Request"
                    : reviewModal.action === "reject"
                    ? "Confirm Rejection"
                    : "Confirm Suspension"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
