"use client";

import { useEffect, useState, useCallback, useId, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Button, Logo, Modal } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import {
  fetchTenantDashboard,
  createTenantFacility,
  createTenantService,
  createTenantDesk,
  createTenantStaff,
  updateTenantProfile,
  toggleServiceActive,
  toggleDeskOpen,
  TenantDashboardData,
  TenantFacility,
  TenantStaff,
  ApiService,
  AdminDesk,
} from "@/lib/api";

type TabId = "overview" | "facilities" | "services" | "desks" | "staff" | "poster" | "profile";

const NAV_ITEMS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  {
    id: "overview",
    label: "Overview",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    id: "facilities",
    label: "Facilities",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    id: "services",
    label: "Service Lines",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    id: "desks",
    label: "Counter Desks",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: "staff",
    label: "Staff Operators",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    id: "poster",
    label: "QR Poster",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
      </svg>
    ),
  },
  {
    id: "profile",
    label: "Settings",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function TenantAdminPage() {
  const router = useRouter();
  const { user, role, loading: authLoading, signOut } = useAuth();

  const [data, setData] = useState<TenantDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Modals state
  const [showFacilityModal, setShowFacilityModal] = useState(false);
  const [facilityName, setFacilityName] = useState("");
  const [facilityLocation, setFacilityLocation] = useState("");
  const [facilitySubmitting, setFacilitySubmitting] = useState(false);

  const [showServiceModal, setShowServiceModal] = useState(false);
  const [serviceFacilityId, setServiceFacilityId] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [servicePrefix, setServicePrefix] = useState("");
  const [serviceDuration, setServiceDuration] = useState(15);
  const [serviceSubmitting, setServiceSubmitting] = useState(false);

  const [showDeskModal, setShowDeskModal] = useState(false);
  const [deskFacilityId, setDeskFacilityId] = useState("");
  const [deskName, setDeskName] = useState("");
  const [deskSubmitting, setDeskSubmitting] = useState(false);

  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffSubmitting, setStaffSubmitting] = useState(false);

  const [profileName, setProfileName] = useState("");
  const [profileLocation, setProfileLocation] = useState("");
  const [profileNotes, setProfileNotes] = useState("");
  const [profileSubmitting, setProfileSubmitting] = useState(false);

  // QR Poster state
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const posterRef = useRef<HTMLDivElement>(null);

  const fullPublicUrl = data
    ? `${typeof window !== "undefined" ? window.location.origin : "https://krenox.vercel.app"}${data.organisation.public_url}`
    : "";

  // Generate QR Code
  useEffect(() => {
    if (!fullPublicUrl) return;
    QRCode.toDataURL(fullPublicUrl, {
      width: 400,
      margin: 2,
      color: { dark: "#084d56", light: "#ffffff" },
      errorCorrectionLevel: "H",
    }, (err, url) => {
      if (!err && url) setQrDataUrl(url);
    });
  }, [fullPublicUrl]);

  // Accessible IDs
  const facilityNameId = useId();
  const facilityLocationId = useId();
  const serviceNameId = useId();
  const servicePrefixId = useId();
  const deskNameId = useId();

  // Enforce authentication
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/tenant-admin");
    }
  }, [authLoading, user, router]);

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetchTenantDashboard();
      setData(res);
      setProfileName(res.organisation.name);
      setProfileLocation(res.organisation.location || "");
      if (res.facilities.length > 0) {
        setServiceFacilityId(res.facilities[0].id);
        setDeskFacilityId(res.facilities[0].id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load organisation dashboard");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  function copyPublicLink() {
    if (fullPublicUrl) {
      navigator.clipboard?.writeText(fullPublicUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  }

  async function handleDownloadPoster() {
    if (!posterRef.current || !data) return;
    setDownloading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(posterRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      const link = document.createElement("a");
      link.download = `krenox-poster-${data.organisation.slug}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setDownloading(false);
    }
  }

  // ── Facility Handlers ──
  async function handleCreateFacility(e: React.FormEvent) {
    e.preventDefault();
    if (!data || !facilityName.trim()) return;
    setFacilitySubmitting(true);
    try {
      await createTenantFacility(data.organisation.id, {
        name: facilityName.trim(),
        location: facilityLocation.trim() || undefined,
      });
      setFacilityName("");
      setFacilityLocation("");
      setShowFacilityModal(false);
      setSuccessMessage("New facility established successfully.");
      await loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create facility");
    } finally {
      setFacilitySubmitting(false);
    }
  }

  // ── Service Handlers ──
  async function handleCreateService(e: React.FormEvent) {
    e.preventDefault();
    if (!data || !serviceName.trim() || !servicePrefix.trim() || !serviceFacilityId) return;
    setServiceSubmitting(true);
    try {
      await createTenantService(data.organisation.id, {
        facility_id: serviceFacilityId,
        name: serviceName.trim(),
        prefix: servicePrefix.trim().toUpperCase(),
        avg_duration_minutes: Number(serviceDuration) || 15,
      });
      setServiceName("");
      setServicePrefix("");
      setShowServiceModal(false);
      setSuccessMessage("Service line configured successfully.");
      await loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create service");
    } finally {
      setServiceSubmitting(false);
    }
  }

  async function handleToggleService(serviceId: string, currentActive: boolean) {
    setActionPending(`service-${serviceId}`);
    try {
      await toggleServiceActive(serviceId, !currentActive);
      await loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to toggle service");
    } finally {
      setActionPending(null);
    }
  }

  // ── Desk Handlers ──
  async function handleCreateDesk(e: React.FormEvent) {
    e.preventDefault();
    if (!data || !deskName.trim() || !deskFacilityId) return;
    setDeskSubmitting(true);
    try {
      await createTenantDesk(data.organisation.id, {
        facility_id: deskFacilityId,
        name: deskName.trim(),
      });
      setDeskName("");
      setShowDeskModal(false);
      setSuccessMessage("New service counter created.");
      await loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create desk");
    } finally {
      setDeskSubmitting(false);
    }
  }

  async function handleToggleDesk(deskId: string, currentOpen: boolean) {
    setActionPending(`desk-${deskId}`);
    try {
      await toggleDeskOpen(deskId, !currentOpen);
      await loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to toggle desk");
    } finally {
      setActionPending(null);
    }
  }

  // ── Staff Handlers ──
  async function handleCreateStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!data || !staffEmail.trim() || !staffPassword.trim() || !staffName.trim()) return;
    setStaffSubmitting(true);
    try {
      await createTenantStaff(data.organisation.id, {
        name: staffName.trim(),
        email: staffEmail.trim(),
        password: staffPassword.trim(),
      });
      setStaffName("");
      setStaffEmail("");
      setStaffPassword("");
      setShowStaffModal(false);
      setSuccessMessage("Staff operator account provisioned.");
      await loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create staff account");
    } finally {
      setStaffSubmitting(false);
    }
  }

  // ── Profile Handlers ──
  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    setProfileSubmitting(true);
    try {
      await updateTenantProfile(data.organisation.id, {
        name: profileName.trim(),
        location: profileLocation.trim(),
        additional_info: profileNotes.trim() || undefined,
      });
      setSuccessMessage("Organisation profile updated.");
      await loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setProfileSubmitting(false);
    }
  }

  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-[#f3f6f5] flex items-center justify-center p-6 text-center">
        <div className="p-8 rounded-3xl bg-white border border-line shadow-lg max-w-sm w-full">
          <div className="w-12 h-12 rounded-2xl bg-forest text-mint flex items-center justify-center font-bold text-lg mx-auto mb-3 animate-pulse">
            KX
          </div>
          <h2 className="text-base font-bold text-ink">Loading Organisation Dashboard...</h2>
          <p className="text-xs text-ink-muted mt-1">Retrieving tenant facilities and counters</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-[#f3f6f5] flex items-center justify-center p-6 text-center">
        <div className="p-8 rounded-3xl bg-white border border-line shadow-lg max-w-md w-full">
          <h2 className="text-lg font-bold text-status-danger">Organisation Workspace Error</h2>
          <p className="text-xs text-ink-muted mt-2">{error || "Unable to load tenant workspace."}</p>
          <Button className="mt-4" onClick={() => router.push("/")}>Return to Home</Button>
        </div>
      </main>
    );
  }

  const metrics = [
    { label: "Waiting Now", value: data.metrics.waiting, color: "text-amber-600" },
    { label: "At Counters", value: data.metrics.serving, color: "text-forest" },
    { label: "Completed Today", value: data.metrics.completed, color: "text-ink" },
    { label: "Active Desks", value: `${data.metrics.open_desks}/${data.metrics.total_desks}`, color: "text-ink" },
    { label: "Facilities", value: data.facilities.length, color: "text-ink" },
    { label: "Services", value: data.services.length, color: "text-ink" },
  ];

  return (
    <div className="min-h-screen bg-[#f0f4f3] flex flex-col selection:bg-forest selection:text-white">

      {/* ── TOP HEADER BAR ── */}
      <header className="h-16 border-b border-line bg-white sticky top-0 z-40 flex items-center px-4 lg:px-6 gap-4">
        {/* Mobile hamburger */}
        <button
          className="lg:hidden p-2 rounded-xl hover:bg-surface-sunken transition text-ink"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle sidebar"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="flex items-center gap-3 min-w-0">
          <Logo size="sm" variant="dark" />
          <div className="hidden sm:block h-6 w-px bg-line" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink leading-tight truncate">{data.organisation.name}</p>
            <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-widest hidden sm:block">
              {data.organisation.category} · Organisation Admin
            </p>
          </div>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <Link
            href={data.organisation.public_url}
            target="_blank"
            className="hidden md:inline-flex items-center gap-1.5 text-xs font-semibold text-forest border border-forest/30 hover:bg-forest/5 px-3 py-1.5 rounded-lg transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Live Queue
          </Link>

          <Link
            href="/staff"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-ink bg-surface-sunken hover:bg-line/60 border border-line px-3 py-1.5 rounded-lg transition"
          >
            Staff Console
          </Link>

          <div className="flex items-center gap-2 pl-3 border-l border-line">
            <div className="hidden md:block text-right">
              <p className="text-xs font-semibold text-ink leading-tight">{user?.user_metadata?.contact_name || user?.email?.split("@")[0]}</p>
              <p className="text-[10px] text-ink-muted">{user?.email}</p>
            </div>
            <button
              onClick={async () => { await signOut(); router.push("/login"); }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-status-danger hover:bg-red-700 transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── SIDEBAR OVERLAY (mobile) ── */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── SIDEBAR ── */}
        <aside
          className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-line flex flex-col transition-transform duration-200 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
          style={{ top: "64px", height: "calc(100vh - 64px)" }}
        >
          {/* Org identity block */}
          <div className="px-4 py-5 border-b border-line">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-forest text-white font-black flex items-center justify-center text-sm flex-shrink-0">
                {data.organisation.name.split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink leading-tight truncate">{data.organisation.name}</p>
                <p className="text-[10px] text-ink-muted truncate">{data.organisation.location || "Main Campus"}</p>
              </div>
            </div>
            {/* Live status pill */}
            <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-forest">
              <span className="w-2 h-2 rounded-full bg-forest animate-pulse" />
              Operational · {data.metrics.waiting} in queue
            </div>
          </div>

          {/* Nav links */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition ${
                  activeTab === item.id
                    ? "bg-forest text-white shadow-sm"
                    : "text-ink-muted hover:text-ink hover:bg-surface-sunken"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.id === "facilities" && (
                  <span className={`ml-auto text-xs font-bold px-1.5 py-0.5 rounded ${activeTab === item.id ? "bg-white/20 text-white" : "bg-surface-sunken text-ink-muted"}`}>
                    {data.facilities.length}
                  </span>
                )}
                {item.id === "services" && (
                  <span className={`ml-auto text-xs font-bold px-1.5 py-0.5 rounded ${activeTab === item.id ? "bg-white/20 text-white" : "bg-surface-sunken text-ink-muted"}`}>
                    {data.services.length}
                  </span>
                )}
                {item.id === "desks" && (
                  <span className={`ml-auto text-xs font-bold px-1.5 py-0.5 rounded ${activeTab === item.id ? "bg-white/20 text-white" : "bg-surface-sunken text-ink-muted"}`}>
                    {data.desks.length}
                  </span>
                )}
                {item.id === "staff" && (
                  <span className={`ml-auto text-xs font-bold px-1.5 py-0.5 rounded ${activeTab === item.id ? "bg-white/20 text-white" : "bg-surface-sunken text-ink-muted"}`}>
                    {data.staff.length}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Footer quick links */}
          <div className="px-4 py-4 border-t border-line space-y-2">
            <Link
              href={data.organisation.public_url}
              target="_blank"
              className="flex items-center gap-2 text-xs font-semibold text-forest hover:underline"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View Public Queue Page
            </Link>
            <Link
              href={`/poster/${data.organisation.slug}`}
              target="_blank"
              className="flex items-center gap-2 text-xs font-semibold text-ink-muted hover:text-ink"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Entrance Poster
            </Link>
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 overflow-y-auto">
          {/* Page header strip */}
          <div className="bg-white border-b border-line px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-ink leading-tight">
                  {NAV_ITEMS.find(n => n.id === activeTab)?.label}
                </h1>
                <p className="text-xs text-ink-muted mt-0.5">
                  {activeTab === "overview" && "Live operations telemetry and quick actions for your organisation."}
                  {activeTab === "facilities" && "Physical buildings, campuses, or branch locations managed under this organisation."}
                  {activeTab === "services" && "Configured customer services, ticket prefixes, and average service durations."}
                  {activeTab === "desks" && "Workstations where staff operators summon and serve customer tickets."}
                  {activeTab === "staff" && "Authorised personnel permitted to log into the staff calling console."}
                  {activeTab === "poster" && "Download a print-ready A4 QR poster to mount at your facility entrance."}
                  {activeTab === "profile" && "Update institutional metadata visible on public customer dispatch screens."}
                </p>
              </div>

              {/* CTA per tab */}
              {activeTab === "facilities" && (
                <Button onClick={() => setShowFacilityModal(true)}>
                  <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Add Facility
                </Button>
              )}
              {activeTab === "services" && (
                <Button onClick={() => setShowServiceModal(true)}>
                  <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Add Service
                </Button>
              )}
              {activeTab === "desks" && (
                <Button onClick={() => setShowDeskModal(true)}>
                  <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Add Desk
                </Button>
              )}
              {activeTab === "staff" && (
                <Button onClick={() => setShowStaffModal(true)}>
                  <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Add Staff
                </Button>
              )}
              {activeTab === "overview" && (
                <button
                  onClick={loadDashboard}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-forest text-white hover:bg-forest-dark transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
              )}
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Feedback banners */}
            {successMessage && (
              <div className="p-4 rounded-2xl bg-forest/10 text-forest text-xs font-bold border border-forest/20 flex items-center justify-between">
                <span>{successMessage}</span>
                <button onClick={() => setSuccessMessage("")} className="text-forest hover:opacity-75 ml-4">✕</button>
              </div>
            )}
            {error && (
              <div className="p-4 rounded-2xl bg-red-50 text-red-700 text-xs font-bold border border-red-200 flex items-center justify-between">
                <span>{error}</span>
                <button onClick={() => setError(null)} className="text-red-700 hover:opacity-75 ml-4">✕</button>
              </div>
            )}

            {/* ── TAB: OVERVIEW ── */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Metrics grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                  {metrics.map((m) => (
                    <div key={m.label} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted mb-1">{m.label}</p>
                      <p className={`text-3xl font-mono font-extrabold ${m.color}`}>{m.value}</p>
                    </div>
                  ))}
                </div>

                {/* Quick action cards */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div
                    onClick={() => setActiveTab("facilities")}
                    className="rounded-2xl border border-line bg-white p-6 cursor-pointer hover:border-forest hover:shadow-md transition group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-forest/10 text-forest flex items-center justify-center mb-3 group-hover:bg-forest group-hover:text-white transition">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    </div>
                    <h3 className="font-bold text-sm text-ink">Manage Facilities</h3>
                    <p className="text-xs text-ink-muted mt-1">{data.facilities.length} location{data.facilities.length !== 1 ? "s" : ""} registered</p>
                  </div>

                  <div
                    onClick={() => setActiveTab("services")}
                    className="rounded-2xl border border-line bg-white p-6 cursor-pointer hover:border-forest hover:shadow-md transition group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-forest/10 text-forest flex items-center justify-center mb-3 group-hover:bg-forest group-hover:text-white transition">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    </div>
                    <h3 className="font-bold text-sm text-ink">Service Lines</h3>
                    <p className="text-xs text-ink-muted mt-1">{data.services.length} service{data.services.length !== 1 ? "s" : ""} configured</p>
                  </div>

                  <div
                    onClick={() => setActiveTab("desks")}
                    className="rounded-2xl border border-line bg-white p-6 cursor-pointer hover:border-forest hover:shadow-md transition group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-forest/10 text-forest flex items-center justify-center mb-3 group-hover:bg-forest group-hover:text-white transition">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </div>
                    <h3 className="font-bold text-sm text-ink">Counter Desks</h3>
                    <p className="text-xs text-ink-muted mt-1">{data.metrics.open_desks} of {data.metrics.total_desks} desks open now</p>
                  </div>

                  <div
                    onClick={() => setActiveTab("staff")}
                    className="rounded-2xl border border-line bg-white p-6 cursor-pointer hover:border-forest hover:shadow-md transition group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-forest/10 text-forest flex items-center justify-center mb-3 group-hover:bg-forest group-hover:text-white transition">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </div>
                    <h3 className="font-bold text-sm text-ink">Staff Operators</h3>
                    <p className="text-xs text-ink-muted mt-1">{data.staff.length} operator{data.staff.length !== 1 ? "s" : ""} provisioned</p>
                  </div>

                  <div
                    onClick={() => setActiveTab("poster")}
                    className="rounded-2xl border border-line bg-white p-6 cursor-pointer hover:border-forest hover:shadow-md transition group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-forest/10 text-forest flex items-center justify-center mb-3 group-hover:bg-forest group-hover:text-white transition">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    </div>
                    <h3 className="font-bold text-sm text-ink">Download QR Poster</h3>
                    <p className="text-xs text-ink-muted mt-1">Print-ready A4 for your entrance</p>
                  </div>

                  <Link
                    href={data.organisation.public_url}
                    target="_blank"
                    className="rounded-2xl border border-line bg-white p-6 cursor-pointer hover:border-forest hover:shadow-md transition group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-forest/10 text-forest flex items-center justify-center mb-3 group-hover:bg-forest group-hover:text-white transition">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </div>
                    <h3 className="font-bold text-sm text-ink">Live Queue Page</h3>
                    <p className="text-xs text-ink-muted mt-1 font-mono">/q/{data.organisation.slug}</p>
                  </Link>
                </div>
              </div>
            )}

            {/* ── TAB: FACILITIES ── */}
            {activeTab === "facilities" && (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {data.facilities.length === 0 && (
                  <div className="col-span-full rounded-2xl border-2 border-dashed border-line bg-white p-12 text-center">
                    <p className="text-sm font-semibold text-ink-muted">No facilities yet.</p>
                    <p className="text-xs text-ink-muted mt-1">Add your first building, campus, or branch.</p>
                    <Button className="mt-4" onClick={() => setShowFacilityModal(true)}>+ Add Facility</Button>
                  </div>
                )}
                {data.facilities.map((fac) => {
                  const facServices = data.services.filter((s) => s.facility_id === fac.id);
                  const facDesks = data.desks.filter((d) => d.facility_id === fac.id);
                  const openDesks = facDesks.filter(d => d.is_open).length;
                  return (
                    <div key={fac.id} className="rounded-2xl border border-line bg-white p-6 shadow-sm hover:shadow-md transition">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-bold text-base text-ink truncate">{fac.name}</h3>
                          <p className="text-xs text-ink-muted mt-0.5">{fac.location || "Primary Location"}</p>
                        </div>
                        <span className="text-xs font-bold text-forest bg-forest/10 px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0">Active</span>
                      </div>

                      <div className="mt-5 pt-4 border-t border-line grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-xl font-mono font-bold text-ink">{facServices.length}</p>
                          <p className="text-[10px] text-ink-muted uppercase tracking-wider">Services</p>
                        </div>
                        <div>
                          <p className="text-xl font-mono font-bold text-ink">{facDesks.length}</p>
                          <p className="text-[10px] text-ink-muted uppercase tracking-wider">Desks</p>
                        </div>
                        <div>
                          <p className="text-xl font-mono font-bold text-forest">{openDesks}</p>
                          <p className="text-[10px] text-ink-muted uppercase tracking-wider">Open</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── TAB: SERVICES ── */}
            {activeTab === "services" && (
              <div className="rounded-2xl border border-line bg-white overflow-hidden shadow-sm">
                {data.services.length === 0 ? (
                  <div className="p-12 text-center">
                    <p className="text-sm font-semibold text-ink-muted">No service lines yet.</p>
                    <p className="text-xs text-ink-muted mt-1">Create your first queue service and ticket prefix.</p>
                    <Button className="mt-4" onClick={() => setShowServiceModal(true)}>+ Add Service Line</Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-surface-sunken border-b border-line text-ink-muted font-bold uppercase tracking-wider text-[11px]">
                        <tr>
                          <th className="px-6 py-4">Service Name</th>
                          <th className="px-6 py-4">Prefix</th>
                          <th className="px-6 py-4">Facility</th>
                          <th className="px-6 py-4">Avg Duration</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {data.services.map((svc) => {
                          const fac = data.facilities.find((f) => f.id === svc.facility_id);
                          return (
                            <tr key={svc.id} className="hover:bg-surface-sunken/40 transition">
                              <td className="px-6 py-4 font-bold text-ink">{svc.name}</td>
                              <td className="px-6 py-4">
                                <span className="font-mono font-bold text-forest bg-forest/10 px-2 py-0.5 rounded">{svc.prefix}</span>
                              </td>
                              <td className="px-6 py-4 text-ink-muted text-sm">{fac?.name || "Main Facility"}</td>
                              <td className="px-6 py-4 font-mono text-sm text-ink-muted">{svc.avg_duration_minutes} min</td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${svc.is_active ? "text-forest" : "text-ink-muted"}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${svc.is_active ? "bg-forest" : "bg-line-strong"}`} />
                                  {svc.is_active ? "Active" : "Paused"}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button
                                  disabled={actionPending === `service-${svc.id}`}
                                  onClick={() => handleToggleService(svc.id, svc.is_active)}
                                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${svc.is_active ? "bg-amber-50 text-amber-700 hover:bg-amber-100" : "bg-forest/10 text-forest hover:bg-forest/20"}`}
                                >
                                  {actionPending === `service-${svc.id}` ? "..." : svc.is_active ? "Pause" : "Resume"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: COUNTER DESKS ── */}
            {activeTab === "desks" && (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {data.desks.length === 0 && (
                  <div className="col-span-full rounded-2xl border-2 border-dashed border-line bg-white p-12 text-center">
                    <p className="text-sm font-semibold text-ink-muted">No counter desks yet.</p>
                    <p className="text-xs text-ink-muted mt-1">Add workstations for your staff operators.</p>
                    <Button className="mt-4" onClick={() => setShowDeskModal(true)}>+ Add Counter Desk</Button>
                  </div>
                )}
                {data.desks.map((d) => {
                  const fac = data.facilities.find((f) => f.id === d.facility_id);
                  return (
                    <div key={d.id} className={`rounded-2xl border bg-white p-5 shadow-sm transition ${d.is_open ? "border-forest/40" : "border-line"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-base text-ink">{d.name}</h3>
                          <p className="text-xs text-ink-muted mt-0.5">{fac?.name || "Main Facility"}</p>
                        </div>
                        <span className={`flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${d.is_open ? "bg-forest/10 text-forest" : "bg-surface-sunken text-ink-muted"}`}>
                          {d.is_open ? "Open" : "Closed"}
                        </span>
                      </div>

                      <div className="mt-4 pt-3 border-t border-line flex justify-end">
                        <button
                          disabled={actionPending === `desk-${d.id}`}
                          onClick={() => handleToggleDesk(d.id, d.is_open)}
                          className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${d.is_open ? "bg-red-50 text-red-700 hover:bg-red-100" : "bg-forest/10 text-forest hover:bg-forest/20"}`}
                        >
                          {actionPending === `desk-${d.id}` ? "..." : d.is_open ? "Close Desk" : "Open Desk"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── TAB: STAFF ── */}
            {activeTab === "staff" && (
              <div className="rounded-2xl border border-line bg-white overflow-hidden shadow-sm">
                {data.staff.length === 0 ? (
                  <div className="p-12 text-center">
                    <p className="text-sm font-semibold text-ink-muted">No staff operators yet.</p>
                    <p className="text-xs text-ink-muted mt-1">Provision accounts for your counter staff.</p>
                    <Button className="mt-4" onClick={() => setShowStaffModal(true)}>+ Add Staff Operator</Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-surface-sunken border-b border-line text-ink-muted font-bold uppercase tracking-wider text-[11px]">
                        <tr>
                          <th className="px-6 py-4">Operator Name</th>
                          <th className="px-6 py-4">Email / Sign-In</th>
                          <th className="px-6 py-4">Role</th>
                          <th className="px-6 py-4">Created</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {data.staff.map((s) => (
                          <tr key={s.id} className="hover:bg-surface-sunken/40 transition">
                            <td className="px-6 py-4 font-bold text-ink">{s.name}</td>
                            <td className="px-6 py-4 font-mono text-sm text-ink-muted">{s.email}</td>
                            <td className="px-6 py-4">
                              <span className="text-xs font-bold uppercase text-forest bg-forest/10 px-2.5 py-1 rounded-full">{s.role}</span>
                            </td>
                            <td className="px-6 py-4 text-sm text-ink-muted">
                              {s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: QR POSTER ── */}
            {activeTab === "poster" && (
              <div className="grid lg:grid-cols-2 gap-6 items-start">
                {/* Controls panel */}
                <div className="space-y-4">
                  <div className="rounded-2xl border border-line bg-white p-6 shadow-sm space-y-4">
                    <h3 className="font-bold text-sm text-ink">Poster Link</h3>
                    <div className="p-3 rounded-xl bg-surface-sunken border border-line font-mono text-xs text-forest font-bold break-all">
                      {fullPublicUrl}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={copyPublicLink}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-line text-xs font-bold text-ink hover:bg-surface-sunken transition"
                      >
                        {copiedLink ? "✓ Copied!" : "Copy Link"}
                      </button>
                      <a
                        href={fullPublicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 px-4 py-2.5 rounded-xl bg-forest text-white text-xs font-bold text-center hover:bg-forest-dark transition"
                      >
                        Open Queue ↗
                      </a>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-line bg-white p-6 shadow-sm space-y-4">
                    <h3 className="font-bold text-sm text-ink">Download Options</h3>
                    <p className="text-xs text-ink-muted">The poster is generated at 3× resolution — suitable for crisp A4 printing at ~300 dpi.</p>
                    <button
                      onClick={handleDownloadPoster}
                      disabled={downloading}
                      className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-forest text-white font-bold text-sm hover:bg-forest-dark transition disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {downloading ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download A4 Poster (PNG)
                        </>
                      )}
                    </button>
                    <Link
                      href={`/poster/${data.organisation.slug}`}
                      target="_blank"
                      className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-line text-xs font-bold text-ink hover:bg-surface-sunken transition"
                    >
                      Open Full Poster Page ↗
                    </Link>
                  </div>
                </div>

                {/* Poster preview */}
                <div ref={posterRef} className="rounded-3xl border-2 border-forest bg-white p-10 text-center shadow-lg">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-forest text-white font-black text-xl mb-4">
                    {data.organisation.name.split(" ").map(w => w[0]).filter(Boolean).slice(0, 3).join("").toUpperCase()}
                  </div>
                  <p className="text-xs uppercase tracking-widest font-bold text-forest mb-1">
                    {data.organisation.name} · Virtual Queue Entry Point
                  </p>
                  <h2 className="text-3xl font-extrabold text-ink mt-1 mb-2">Student &amp; Visitor Digital Queue</h2>
                  <p className="text-sm text-ink-muted mb-6 max-w-xs mx-auto">
                    Scan the QR code below with your smartphone to take a digital ticket and track your spot live.
                  </p>

                  <div className="inline-block p-4 border-4 border-forest rounded-3xl mb-6">
                    {qrDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={qrDataUrl} alt="Queue QR Code" className="w-52 h-52 object-contain" />
                    ) : (
                      <div className="w-52 h-52 flex items-center justify-center text-xs text-ink-muted">Generating QR...</div>
                    )}
                  </div>

                  <p className="font-mono text-xs text-forest font-bold">{fullPublicUrl}</p>
                </div>
              </div>
            )}

            {/* ── TAB: PROFILE / SETTINGS ── */}
            {activeTab === "profile" && (
              <div className="max-w-2xl bg-white border border-line rounded-2xl p-8 shadow-sm">
                <form onSubmit={handleUpdateProfile} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-ink mb-1.5">Institution / Venue Name</label>
                    <input
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-forest font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-ink mb-1.5">Campus / City Location</label>
                    <input
                      type="text"
                      value={profileLocation}
                      onChange={(e) => setProfileLocation(e.target.value)}
                      className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-forest font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-ink mb-1.5">Public Description / Guidelines</label>
                    <textarea
                      rows={4}
                      value={profileNotes}
                      onChange={(e) => setProfileNotes(e.target.value)}
                      placeholder="e.g. Please bring your original student ID card and receipt of tuition fee payment."
                      className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-forest font-medium resize-none"
                    />
                  </div>

                  <div className="pt-4 border-t border-line flex justify-end">
                    <Button type="submit" disabled={profileSubmitting}>
                      {profileSubmitting ? "Saving..." : "Save Settings"}
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ── MODALS ── */}

      {showFacilityModal && (
        <Modal titleId="facility-modal-title" onClose={() => setShowFacilityModal(false)} size="md">
          <form onSubmit={handleCreateFacility} className="p-7">
            <h3 id="facility-modal-title" className="font-display text-xl font-bold text-ink">Add Operational Facility</h3>
            <p className="text-xs text-ink-muted mt-1">Establish a new building, campus annex, or branch office.</p>
            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor={facilityNameId} className="block text-sm font-semibold text-ink mb-1.5">Facility Name</label>
                <input id={facilityNameId} type="text" required placeholder="e.g. Faculty of Science Annex" value={facilityName} onChange={(e) => setFacilityName(e.target.value)} className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-forest" />
              </div>
              <div>
                <label htmlFor={facilityLocationId} className="block text-sm font-semibold text-ink mb-1.5">Location / Address (Optional)</label>
                <input id={facilityLocationId} type="text" placeholder="e.g. Block C, Second Floor" value={facilityLocation} onChange={(e) => setFacilityLocation(e.target.value)} className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-forest" />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowFacilityModal(false)}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={facilitySubmitting}>{facilitySubmitting ? "Creating..." : "Establish Facility"}</Button>
            </div>
          </form>
        </Modal>
      )}

      {showServiceModal && (
        <Modal titleId="service-modal-title" onClose={() => setShowServiceModal(false)} size="md">
          <form onSubmit={handleCreateService} className="p-7">
            <h3 id="service-modal-title" className="font-display text-xl font-bold text-ink">Create Service Line</h3>
            <p className="text-xs text-ink-muted mt-1">Configure a dedicated service category and ticket prefix.</p>
            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-ink mb-1.5">Facility</label>
                <select value={serviceFacilityId} onChange={(e) => setServiceFacilityId(e.target.value)} className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-forest">
                  {data.facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor={serviceNameId} className="block text-sm font-semibold text-ink mb-1.5">Service Name</label>
                <input id={serviceNameId} type="text" required placeholder="e.g. Transcript Verification" value={serviceName} onChange={(e) => setServiceName(e.target.value)} className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-forest" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={servicePrefixId} className="block text-sm font-semibold text-ink mb-1.5">Ticket Prefix</label>
                  <input id={servicePrefixId} type="text" required maxLength={4} placeholder="e.g. TR" value={servicePrefix} onChange={(e) => setServicePrefix(e.target.value)} className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-forest font-mono uppercase" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-ink mb-1.5">Avg Minutes</label>
                  <input type="number" min={1} max={120} value={serviceDuration} onChange={(e) => setServiceDuration(Number(e.target.value))} className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-forest font-mono" />
                </div>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowServiceModal(false)}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={serviceSubmitting}>{serviceSubmitting ? "Creating..." : "Save Service Line"}</Button>
            </div>
          </form>
        </Modal>
      )}

      {showDeskModal && (
        <Modal titleId="desk-modal-title" onClose={() => setShowDeskModal(false)} size="md">
          <form onSubmit={handleCreateDesk} className="p-7">
            <h3 id="desk-modal-title" className="font-display text-xl font-bold text-ink">Add Counter Desk</h3>
            <p className="text-xs text-ink-muted mt-1">Add an operational desk for counter staff summoning.</p>
            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-ink mb-1.5">Facility</label>
                <select value={deskFacilityId} onChange={(e) => setDeskFacilityId(e.target.value)} className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-forest">
                  {data.facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor={deskNameId} className="block text-sm font-semibold text-ink mb-1.5">Counter Name</label>
                <input id={deskNameId} type="text" required placeholder="e.g. Counter 3 or Desk B" value={deskName} onChange={(e) => setDeskName(e.target.value)} className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-forest" />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowDeskModal(false)}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={deskSubmitting}>{deskSubmitting ? "Creating..." : "Create Desk"}</Button>
            </div>
          </form>
        </Modal>
      )}

      {showStaffModal && (
        <Modal titleId="staff-modal-title" onClose={() => setShowStaffModal(false)} size="md">
          <form onSubmit={handleCreateStaff} className="p-7">
            <h3 id="staff-modal-title" className="font-display text-xl font-bold text-ink">Provision Counter Operator</h3>
            <p className="text-xs text-ink-muted mt-1">Provide credentials for your service desk clerk to access the Staff Console.</p>
            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-ink mb-1.5">Staff Member Full Name</label>
                <input type="text" required placeholder="e.g. Marie Claire" value={staffName} onChange={(e) => setStaffName(e.target.value)} className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-forest" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink mb-1.5">Staff Work Email</label>
                <input type="email" required placeholder="e.g. marie@ubuea.cm" value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-forest" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink mb-1.5">Assigned Password</label>
                <input type="password" required minLength={8} placeholder="At least 8 characters" value={staffPassword} onChange={(e) => setStaffPassword(e.target.value)} className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-forest" />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowStaffModal(false)}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={staffSubmitting}>{staffSubmitting ? "Provisioning..." : "Create Account"}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
