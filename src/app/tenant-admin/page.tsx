"use client";

import { useEffect, useState, useCallback, useId } from "react";
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

export default function TenantAdminPage() {
  const router = useRouter();
  const { user, role, loading: authLoading, signOut } = useAuth();

  const [data, setData] = useState<TenantDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "facilities" | "services" | "desks" | "staff" | "poster" | "profile"
  >("facilities");
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string>("");

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
  const [qrHostMode, setQrHostMode] = useState<"lan" | "localhost" | "custom">("lan");
  const [customHost, setCustomHost] = useState<string>("");

  const effectiveOrigin =
    qrHostMode === "lan" && data?.local_ip
      ? `http://${data.local_ip}:3000`
      : qrHostMode === "custom" && customHost
      ? customHost.trim()
      : typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000";

  const fullPublicUrl = data ? `${effectiveOrigin}${data.organisation.public_url}` : "";

  // Generate QR Code dynamically whenever the public URL or host changes
  useEffect(() => {
    if (!fullPublicUrl) return;
    QRCode.toDataURL(fullPublicUrl, { width: 360, margin: 2 }, (err, url) => {
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

  return (
    <main className="min-h-screen bg-[#f3f6f5] text-ink pb-24 selection:bg-forest selection:text-white">
      {/* ── Top Header ── */}
      <header className="border-b border-line/70 bg-white sticky top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Logo size="md" variant="dark" />
            <span className="text-line-strong hidden sm:inline">/</span>
            <div>
              <span className="text-xs font-bold text-ink tracking-tight">
                {data.organisation.name}
              </span>
              <span className="text-[10px] text-ink-muted block uppercase tracking-wider">
                {data.organisation.category} · Tenant Console
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={data.organisation.public_url}
              target="_blank"
              className="hidden md:inline-flex items-center gap-1.5 text-xs font-semibold text-forest hover:underline"
            >
              Live Customer Queue ↗
            </Link>

            <Link
              href="/staff"
              className="text-xs font-semibold text-ink-muted hover:text-forest transition px-2.5 py-1 rounded-lg border border-line"
            >
              Open Staff Counter
            </Link>

            {role === "super_admin" && (
              <Link
                href="/admin"
                className="text-xs font-semibold text-ink-muted hover:text-forest transition hidden sm:inline"
              >
                Platform Admin
              </Link>
            )}

            <div className="flex items-center gap-2 pl-3 border-l border-line">
              <span className="text-xs font-mono font-medium text-ink-muted hidden sm:inline">
                {user?.email}
              </span>
              <button
                onClick={async () => {
                  await signOut();
                  router.push("/login");
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-status-danger hover:bg-status-danger-bg transition"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Venue Hero Strip ── */}
      <section className="bg-forest text-white py-8 px-6">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mint">
              <span className="h-2 w-2 rounded-full bg-mint" />
              Verified Multi-Tenant Node
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white mt-1">
              {data.organisation.name}
            </h1>
            <p className="text-xs text-white/80 mt-1 max-w-xl">
              {data.organisation.location || "Central Operations"} · Public Slug:{" "}
              <span className="font-mono text-mint">/q/{data.organisation.slug}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={copyPublicLink}
              className="rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 text-xs font-bold text-white transition active:scale-95"
            >
              {copiedLink ? "Link Copied! ✓" : "Copy Customer Link"}
            </button>
            <button
              onClick={() => setActiveTab("poster")}
              className="rounded-xl bg-mint text-forest-dark hover:bg-mint-soft px-4 py-2 text-xs font-bold transition shadow-sm"
            >
              Print Entrance QR Poster
            </button>
          </div>
        </div>
      </section>

      {/* ── Telemetry Ribbon ── */}
      <div className="mx-auto max-w-7xl px-6 -mt-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          <div className="rounded-2xl border border-line bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Waiting Now</p>
            <p className="text-2xl font-mono font-bold text-ink mt-0.5">{data.metrics.waiting}</p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">At Counters</p>
            <p className="text-2xl font-mono font-bold text-forest mt-0.5">{data.metrics.serving}</p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Completed Today</p>
            <p className="text-2xl font-mono font-bold text-ink mt-0.5">{data.metrics.completed}</p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Active Counters</p>
            <p className="text-2xl font-mono font-bold text-ink mt-0.5">
              {data.metrics.open_desks} / {data.metrics.total_desks}
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4 shadow-sm col-span-2 sm:col-span-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Total Facilities</p>
            <p className="text-2xl font-mono font-bold text-ink mt-0.5">{data.facilities.length}</p>
          </div>
        </div>
      </div>

      {/* ── Main Workspace ── */}
      <div className="mx-auto max-w-7xl px-6 pt-8">
        {/* Feedback Messages */}
        {successMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-forest/10 text-forest text-xs font-bold border border-forest/20 flex items-center justify-between">
            <span>{successMessage}</span>
            <button onClick={() => setSuccessMessage("")} className="text-forest hover:opacity-75">✕</button>
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-status-danger-bg text-status-danger text-xs font-bold border border-status-danger/20 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-status-danger hover:opacity-75">✕</button>
          </div>
        )}

        {/* Tab Controls */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line pb-4 mb-8">
          <button
            onClick={() => setActiveTab("facilities")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "facilities"
                ? "bg-forest text-white"
                : "bg-white text-ink-muted border border-line hover:text-ink hover:border-forest"
            }`}
          >
            Facilities & Branches ({data.facilities.length})
          </button>
          <button
            onClick={() => setActiveTab("services")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "services"
                ? "bg-forest text-white"
                : "bg-white text-ink-muted border border-line hover:text-ink hover:border-forest"
            }`}
          >
            Service Lines ({data.services.length})
          </button>
          <button
            onClick={() => setActiveTab("desks")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "desks"
                ? "bg-forest text-white"
                : "bg-white text-ink-muted border border-line hover:text-ink hover:border-forest"
            }`}
          >
            Counter Desks ({data.desks.length})
          </button>
          <button
            onClick={() => setActiveTab("staff")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "staff"
                ? "bg-forest text-white"
                : "bg-white text-ink-muted border border-line hover:text-ink hover:border-forest"
            }`}
          >
            Counter Staff ({data.staff.length})
          </button>
          <button
            onClick={() => setActiveTab("poster")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "poster"
                ? "bg-forest text-white"
                : "bg-white text-ink-muted border border-line hover:text-ink hover:border-forest"
            }`}
          >
            Entrance Poster & QR
          </button>
          <button
            onClick={() => setActiveTab("profile")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "profile"
                ? "bg-forest text-white"
                : "bg-white text-ink-muted border border-line hover:text-ink hover:border-forest"
            }`}
          >
            Organisation Settings
          </button>
        </div>

        {/* ── TAB 1: FACILITIES ── */}
        {activeTab === "facilities" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-ink">Operational Facilities & Branches</h2>
                <p className="text-xs text-ink-muted">
                  Physical buildings, campuses, or branch locations managed under this organisation.
                </p>
              </div>
              <Button onClick={() => setShowFacilityModal(true)}>+ Add New Facility</Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.facilities.map((fac) => {
                const facServices = data.services.filter((s) => s.facility_id === fac.id);
                const facDesks = data.desks.filter((d) => d.facility_id === fac.id);

                return (
                  <div key={fac.id} className="rounded-2xl border border-line bg-white p-6 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-base text-ink">{fac.name}</h3>
                        <p className="text-xs text-ink-muted mt-0.5">
                          {fac.location || "Primary Location"}
                        </p>
                      </div>
                      <span className="font-mono text-xs text-forest font-bold bg-forest/10 px-2 py-0.5 rounded">
                        Active
                      </span>
                    </div>

                    <div className="mt-5 pt-4 border-t border-line text-xs flex justify-between text-ink-muted">
                      <span>Services: <strong className="text-ink">{facServices.length}</strong></span>
                      <span>Counters: <strong className="text-ink">{facDesks.length}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── TAB 2: SERVICES ── */}
        {activeTab === "services" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-ink">Queue Service Lines</h2>
                <p className="text-xs text-ink-muted">
                  Configured customer services, ticket prefixes, and average service durations.
                </p>
              </div>
              <Button onClick={() => setShowServiceModal(true)}>+ Add Service Line</Button>
            </div>

            <div className="rounded-2xl border border-line bg-white overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-sunken border-b border-line text-ink-muted font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-5 py-3.5">Service Name</th>
                      <th className="px-5 py-3.5">Prefix</th>
                      <th className="px-5 py-3.5">Facility</th>
                      <th className="px-5 py-3.5">Avg Duration</th>
                      <th className="px-5 py-3.5">Operational Status</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.services.map((svc) => {
                      const fac = data.facilities.find((f) => f.id === svc.facility_id);
                      return (
                        <tr key={svc.id} className="hover:bg-surface-sunken/40 transition">
                          <td className="px-5 py-4 font-bold text-ink">{svc.name}</td>
                          <td className="px-5 py-4 font-mono font-bold text-forest">{svc.prefix}</td>
                          <td className="px-5 py-4 text-ink-muted">{fac?.name || "Main Facility"}</td>
                          <td className="px-5 py-4 font-mono">{svc.avg_duration_minutes} mins</td>
                          <td className="px-5 py-4">
                            <span
                              className={`text-xs font-semibold ${
                                svc.is_active ? "text-forest" : "text-ink-muted"
                              }`}
                            >
                              ● {svc.is_active ? "Active" : "Paused"}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              disabled={actionPending === `service-${svc.id}`}
                              onClick={() => handleToggleService(svc.id, svc.is_active)}
                              className="text-xs font-semibold text-ink-muted hover:text-forest hover:underline"
                            >
                              {svc.is_active ? "Pause Queue" : "Resume Queue"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: COUNTER DESKS ── */}
        {activeTab === "desks" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-ink">Physical & Virtual Counter Desks</h2>
                <p className="text-xs text-ink-muted">
                  Workstations where staff operators summon and serve customer tickets.
                </p>
              </div>
              <Button onClick={() => setShowDeskModal(true)}>+ Add Counter Desk</Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {data.desks.map((d) => {
                const fac = data.facilities.find((f) => f.id === d.facility_id);
                return (
                  <div key={d.id} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-base text-ink">{d.name}</h3>
                      <span
                        className={`text-xs font-semibold ${
                          d.is_open ? "text-forest" : "text-ink-muted"
                        }`}
                      >
                        {d.is_open ? "● Open" : "○ Closed"}
                      </span>
                    </div>
                    <p className="text-xs text-ink-muted mt-1">{fac?.name || "Main Facility"}</p>

                    <div className="mt-4 pt-3 border-t border-line flex justify-end">
                      <button
                        type="button"
                        disabled={actionPending === `desk-${d.id}`}
                        onClick={() => handleToggleDesk(d.id, d.is_open)}
                        className="text-xs font-semibold text-forest hover:underline"
                      >
                        {d.is_open ? "Close Desk" : "Open Desk"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── TAB 4: COUNTER STAFF ── */}
        {activeTab === "staff" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-ink">Counter Staff Operators</h2>
                <p className="text-xs text-ink-muted">
                  Authorised personnel permitted to log into the staff calling console (`/staff`).
                </p>
              </div>
              <Button onClick={() => setShowStaffModal(true)}>+ Provision Staff User</Button>
            </div>

            <div className="rounded-2xl border border-line bg-white overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-sunken border-b border-line text-ink-muted font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-5 py-3.5">Operator Name</th>
                    <th className="px-5 py-3.5">Email / Sign-In</th>
                    <th className="px-5 py-3.5">Assigned Role</th>
                    <th className="px-5 py-3.5">Created Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.staff.length > 0 ? (
                    data.staff.map((s) => (
                      <tr key={s.id} className="hover:bg-surface-sunken/40 transition">
                        <td className="px-5 py-4 font-bold text-ink">{s.name}</td>
                        <td className="px-5 py-4 font-mono text-ink-muted">{s.email}</td>
                        <td className="px-5 py-4 uppercase font-bold text-[10px] text-forest">
                          {s.role}
                        </td>
                        <td className="px-5 py-4 text-ink-muted font-mono">
                          {s.created_at ? new Date(s.created_at).toLocaleDateString() : "-"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-5 py-10 text-center text-ink-muted">
                        No additional staff accounts provisioned yet. Click &quot;+ Provision Staff User&quot; to invite operators.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 5: PRINTABLE ENTRANCE POSTER ── */}
        {activeTab === "poster" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
              <div>
                <h2 className="text-lg font-bold text-ink">Physical Entrance Poster Template</h2>
                <p className="text-xs text-ink-muted">
                  Print this clean A4 sheet to mount at the entrance door or reception desk of your facility.
                </p>
              </div>
              <Button onClick={() => window.print()}>Print A4 Poster 🖨</Button>
            </div>

            {/* Network / Host Selector Tray (Screen Only) */}
            <div className="max-w-xl mx-auto bg-surface-sunken border border-line rounded-2xl p-4 text-xs space-y-3 print:hidden">
              <div className="flex items-center justify-between">
                <span className="font-bold text-ink uppercase tracking-wider text-[11px]">
                  Poster Link Host
                </span>
                <span className="text-ink-muted text-[11px]">
                  Configure whether phones scan via Wi-Fi IP or Localhost
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={qrHostMode}
                  onChange={(e) => setQrHostMode(e.target.value as "lan" | "localhost" | "custom")}
                  className="px-3 py-1.5 rounded-xl border border-line bg-white text-ink text-xs font-semibold focus:outline-none focus:border-forest"
                >
                  <option value="lan">
                    📱 Phone Wi-Fi ({data.local_ip || "192.168.1.242"}:3000)
                  </option>
                  <option value="localhost">💻 Localhost (localhost:3000)</option>
                  <option value="custom">🌐 Custom Domain / Ngrok</option>
                </select>

                {qrHostMode === "custom" && (
                  <input
                    type="url"
                    placeholder="https://krenox.cm or https://xyz.ngrok-free.app"
                    value={customHost}
                    onChange={(e) => setCustomHost(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-xl border border-line bg-white text-ink text-xs font-mono"
                  />
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-line/60">
                <span className="font-mono text-forest font-bold truncate mr-2">
                  {fullPublicUrl}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={copyPublicLink}
                    className="px-3 py-1 rounded-lg border border-line bg-white hover:bg-surface-sunken text-ink font-semibold transition"
                  >
                    {copiedLink ? "✓ Copied" : "Copy Link"}
                  </button>
                  <a
                    href={fullPublicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1 rounded-lg bg-forest text-white font-bold hover:bg-forest-dark transition"
                  >
                    Open ↗
                  </a>
                </div>
              </div>
            </div>

            {/* Poster Card (styled for screen and @media print) */}
            <div className="mx-auto max-w-xl bg-white border-2 border-forest rounded-3xl p-8 sm:p-12 text-center shadow-lg print:border-none print:shadow-none print:max-w-full">
              <div className="inline-flex items-center gap-2 mb-4">
                <Logo size="lg" variant="dark" />
              </div>

              <h1 className="text-3xl font-display font-extrabold text-ink">
                {data.organisation.name}
              </h1>
              <p className="text-sm font-semibold text-forest uppercase tracking-wider mt-1">
                Virtual Queue Entry Point
              </p>
              <p className="text-xs text-ink-muted mt-0.5">
                {data.organisation.location || "Campus Service Area"}
              </p>

              {/* QR Code Container */}
              <div className="my-8 mx-auto w-64 h-64 bg-[#f8faf9] border-2 border-dashed border-forest/30 rounded-2xl flex items-center justify-center p-3">
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrDataUrl} alt="Queue QR Code" className="w-full h-full object-contain" />
                ) : (
                  <p className="text-xs text-ink-muted">Generating QR Code...</p>
                )}
              </div>

              {/* Instructions */}
              <div className="rounded-2xl bg-surface-sunken border border-line p-5 text-left text-xs space-y-2.5">
                <p className="font-bold text-ink uppercase tracking-wider text-[11px]">
                  How to take a ticket:
                </p>
                <div className="flex items-start gap-2 text-ink-muted">
                  <span className="font-bold text-forest font-mono">1.</span>
                  <span>Point your smartphone camera at this QR code to open our queue dispatcher.</span>
                </div>
                <div className="flex items-start gap-2 text-ink-muted">
                  <span className="font-bold text-forest font-mono">2.</span>
                  <span>Choose your required service and receive your live digital ticket.</span>
                </div>
                <div className="flex items-start gap-2 text-ink-muted">
                  <span className="font-bold text-forest font-mono">3.</span>
                  <span>Wait comfortably anywhere. We will ping you on your phone when your counter is ready.</span>
                </div>
              </div>

              <div className="mt-8 text-[11px] text-ink-muted font-mono">
                Direct Web URL:{" "}
                <span className="font-bold text-forest underline">
                  {fullPublicUrl}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 6: PROFILE ── */}
        {activeTab === "profile" && (
          <div className="max-w-2xl bg-white border border-line rounded-2xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-lg font-bold text-ink mb-1">Organisation Settings</h2>
            <p className="text-xs text-ink-muted mb-6">
              Update institutional metadata visible on public customer dispatch screens.
            </p>

            <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-ink block mb-1">Institution / Venue Name:</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs text-ink outline-none focus:border-forest font-medium"
                />
              </div>

              <div>
                <label className="font-semibold text-ink block mb-1">Campus / City Location:</label>
                <input
                  type="text"
                  value={profileLocation}
                  onChange={(e) => setProfileLocation(e.target.value)}
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs text-ink outline-none focus:border-forest font-medium"
                />
              </div>

              <div>
                <label className="font-semibold text-ink block mb-1">Public Description / Guidelines:</label>
                <textarea
                  rows={3}
                  value={profileNotes}
                  onChange={(e) => setProfileNotes(e.target.value)}
                  placeholder="e.g. Please bring your original student ID card and receipt of tuition fee payment."
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-2 text-xs text-ink outline-none focus:border-forest font-medium"
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

      {/* ── New Facility Modal ── */}
      {showFacilityModal && (
        <Modal
          titleId="facility-modal-title"
          onClose={() => setShowFacilityModal(false)}
          size="md"
        >
          <form onSubmit={handleCreateFacility} className="p-7">
            <h3 id="facility-modal-title" className="font-display text-xl font-bold text-ink">
              Add Operational Facility
            </h3>
            <p className="text-xs text-ink-muted mt-1">
              Establish a new building, campus annex, or branch office.
            </p>

            <div className="mt-5 space-y-4 text-xs">
              <div>
                <label htmlFor={facilityNameId} className="font-semibold text-ink block mb-1">
                  Facility Name:
                </label>
                <input
                  id={facilityNameId}
                  type="text"
                  required
                  placeholder="e.g. Faculty of Science Annex"
                  value={facilityName}
                  onChange={(e) => setFacilityName(e.target.value)}
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs text-ink outline-none focus:border-forest"
                />
              </div>

              <div>
                <label htmlFor={facilityLocationId} className="font-semibold text-ink block mb-1">
                  Location / Address (Optional):
                </label>
                <input
                  id={facilityLocationId}
                  type="text"
                  placeholder="e.g. Block C, Second Floor"
                  value={facilityLocation}
                  onChange={(e) => setFacilityLocation(e.target.value)}
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs text-ink outline-none focus:border-forest"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setShowFacilityModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={facilitySubmitting}>
                {facilitySubmitting ? "Creating..." : "Establish Facility"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── New Service Modal ── */}
      {showServiceModal && (
        <Modal
          titleId="service-modal-title"
          onClose={() => setShowServiceModal(false)}
          size="md"
        >
          <form onSubmit={handleCreateService} className="p-7">
            <h3 id="service-modal-title" className="font-display text-xl font-bold text-ink">
              Create Service Line
            </h3>
            <p className="text-xs text-ink-muted mt-1">
              Configure a dedicated service category and ticket prefix.
            </p>

            <div className="mt-5 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-ink block mb-1">Facility:</label>
                <select
                  value={serviceFacilityId}
                  onChange={(e) => setServiceFacilityId(e.target.value)}
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs text-ink outline-none focus:border-forest"
                >
                  {data.facilities.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor={serviceNameId} className="font-semibold text-ink block mb-1">
                  Service Name:
                </label>
                <input
                  id={serviceNameId}
                  type="text"
                  required
                  placeholder="e.g. Transcript Verification"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs text-ink outline-none focus:border-forest"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={servicePrefixId} className="font-semibold text-ink block mb-1">
                    Ticket Prefix:
                  </label>
                  <input
                    id={servicePrefixId}
                    type="text"
                    required
                    maxLength={4}
                    placeholder="e.g. TR"
                    value={servicePrefix}
                    onChange={(e) => setServicePrefix(e.target.value)}
                    className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs text-ink outline-none focus:border-forest font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="font-semibold text-ink block mb-1">Avg Minutes:</label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={serviceDuration}
                    onChange={(e) => setServiceDuration(Number(e.target.value))}
                    className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs text-ink outline-none focus:border-forest font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setShowServiceModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={serviceSubmitting}>
                {serviceSubmitting ? "Creating..." : "Save Service Line"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── New Desk Modal ── */}
      {showDeskModal && (
        <Modal
          titleId="desk-modal-title"
          onClose={() => setShowDeskModal(false)}
          size="md"
        >
          <form onSubmit={handleCreateDesk} className="p-7">
            <h3 id="desk-modal-title" className="font-display text-xl font-bold text-ink">
              Add Counter Desk
            </h3>
            <p className="text-xs text-ink-muted mt-1">
              Add an operational desk for counter staff summoning.
            </p>

            <div className="mt-5 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-ink block mb-1">Facility:</label>
                <select
                  value={deskFacilityId}
                  onChange={(e) => setDeskFacilityId(e.target.value)}
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs text-ink outline-none focus:border-forest"
                >
                  {data.facilities.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor={deskNameId} className="font-semibold text-ink block mb-1">
                  Counter Name:
                </label>
                <input
                  id={deskNameId}
                  type="text"
                  required
                  placeholder="e.g. Counter 3 or Desk B"
                  value={deskName}
                  onChange={(e) => setDeskName(e.target.value)}
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs text-ink outline-none focus:border-forest"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setShowDeskModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={deskSubmitting}>
                {deskSubmitting ? "Creating..." : "Create Desk"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── New Staff Modal ── */}
      {showStaffModal && (
        <Modal
          titleId="staff-modal-title"
          onClose={() => setShowStaffModal(false)}
          size="md"
        >
          <form onSubmit={handleCreateStaff} className="p-7">
            <h3 id="staff-modal-title" className="font-display text-xl font-bold text-ink">
              Provision Counter Operator Account
            </h3>
            <p className="text-xs text-ink-muted mt-1">
              Provide credentials for your service desk clerk to access the Staff Console.
            </p>

            <div className="mt-5 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-ink block mb-1">Staff Member Full Name:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Marie Claire"
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs text-ink outline-none focus:border-forest"
                />
              </div>

              <div>
                <label className="font-semibold text-ink block mb-1">Staff Work Email:</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. marie@ubuea.cm"
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs text-ink outline-none focus:border-forest"
                />
              </div>

              <div>
                <label className="font-semibold text-ink block mb-1">Assigned Password:</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs text-ink outline-none focus:border-forest"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setShowStaffModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={staffSubmitting}>
                {staffSubmitting ? "Provisioning..." : "Create Account"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </main>
  );
}

