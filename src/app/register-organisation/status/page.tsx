"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Eyebrow, Logo } from "@/components/ui";
import {
  fetchOrganisationStatus,
  resubmitOrganisationApplication,
  OrganisationApplication,
} from "@/lib/api";

function StatusContent() {
  const searchParams = useSearchParams();
  const initialRef = searchParams.get("ref") || "";

  const [refInput, setRefInput] = useState(initialRef);
  const [app, setApp] = useState<OrganisationApplication | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resubmit state for ACTION_REQUIRED
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [resubmitting, setResubmitting] = useState(false);
  const [resubmitSuccess, setResubmitSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (initialRef) {
      loadStatus(initialRef);
    }
  }, [initialRef]);

  async function loadStatus(reference: string) {
    if (!reference.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOrganisationStatus(reference.trim().toUpperCase());
      setApp(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load status";
      setError(msg);
      setApp(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleResubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!app || !additionalNotes.trim()) return;

    setResubmitting(true);
    setError(null);
    try {
      const res = await resubmitOrganisationApplication(app.registration_ref, {
        additional_info: additionalNotes.trim(),
      });
      setResubmitSuccess(res.message || "Your additional information has been submitted successfully.");
      setAdditionalNotes("");
      loadStatus(app.registration_ref);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Resubmission failed";
      setError(msg);
    } finally {
      setResubmitting(false);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return {
          bg: "bg-status-called-bg text-status-called border-status-called/30",
          label: "Approved & Active",
          dot: "bg-status-called",
        };
      case "PENDING_REVIEW":
        return {
          bg: "bg-status-waiting-bg text-status-waiting border-status-waiting/30",
          label: "Awaiting Administrator Review",
          dot: "bg-status-waiting animate-pulse",
        };
      case "ACTION_REQUIRED":
        return {
          bg: "bg-amber-50 text-amber-800 border-amber-300",
          label: "Action Required / Clarification Needed",
          dot: "bg-amber-500 animate-ping",
        };
      case "REJECTED":
        return {
          bg: "bg-status-danger-bg text-status-danger border-status-danger/30",
          label: "Registration Rejected",
          dot: "bg-status-danger",
        };
      case "SUSPENDED":
        return {
          bg: "bg-rose-100 text-rose-900 border-rose-300",
          label: "Access Suspended",
          dot: "bg-rose-600",
        };
      default:
        return {
          bg: "bg-line text-ink-subtle border-line-strong",
          label: status,
          dot: "bg-ink-subtle",
        };
    }
  };

  return (
    <main className="min-h-screen bg-canvas text-ink pb-24 selection:bg-mint selection:text-forest-dark">
      {/* Header */}
      <header className="border-b border-line bg-canvas/80 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Logo size="md" variant="dark" />
          <Link
            href="/register-organisation"
            className="text-xs font-semibold text-forest hover:underline"
          >
            New Registration →
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 pt-10 sm:pt-14">
        <div className="mb-8">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
            Check Registration Review Status
          </h1>
          <p className="mt-2 text-sm text-ink-muted leading-relaxed">
            Enter your registration reference (e.g. <span className="font-mono font-bold text-ink">KRN-ORG-XXXXX</span>) to view real-time administrative progress.
          </p>
        </div>

        {/* Reference Search Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadStatus(refInput);
          }}
          className="flex gap-2 mb-8"
        >
          <input
            type="text"
            required
            placeholder="KRN-ORG-XXXXX"
            value={refInput}
            onChange={(e) => setRefInput(e.target.value.toUpperCase())}
            className="flex-1 rounded-2xl border border-line-strong bg-white px-4 py-3 font-mono text-sm font-bold text-ink outline-none focus:border-forest focus:ring-4 focus:ring-forest/10"
          />
          <Button type="submit" disabled={loading} className="!px-6">
            {loading ? "Checking..." : "Look Up"}
          </Button>
        </form>

        {error && (
          <div className="mb-6 rounded-2xl bg-status-danger-bg p-4 text-xs font-semibold text-status-danger border border-status-danger/20">
            {error}
          </div>
        )}

        {/* Application Status Card */}
        {app && (
          <div className="ticket-pop rounded-[2.5rem] bg-surface p-7 sm:p-10 border border-line shadow-card space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
                  Organisation Name
                </span>
                <h2 className="font-display text-2xl font-bold text-ink mt-0.5">
                  {app.name}
                </h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  Category: {app.category} · Location: {app.location}
                </p>
              </div>

              {(() => {
                const badge = getStatusBadge(app.status);
                return (
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold border ${badge.bg}`}
                  >
                    <span className={`h-2 w-2 rounded-full ${badge.dot}`} />
                    {badge.label}
                  </span>
                );
              })()}
            </div>

            {/* Metadata Rows */}
            <div className="grid gap-3.5 sm:grid-cols-2 text-xs">
              <div className="rounded-2xl bg-surface-sunken p-4 border border-line">
                <span className="font-bold text-ink-subtle uppercase tracking-wider block">
                  Registration Reference
                </span>
                <span className="font-mono text-base font-bold text-forest mt-1 block">
                  {app.registration_ref}
                </span>
              </div>

              <div className="rounded-2xl bg-surface-sunken p-4 border border-line">
                <span className="font-bold text-ink-subtle uppercase tracking-wider block">
                  Verified Contact
                </span>
                <span className="font-mono text-xs font-bold text-ink mt-1 block">
                  {app.contact_channel.toUpperCase()}: {app.masked_contact_value}
                </span>
              </div>
            </div>

            {/* Status-Specific Feedback Cards */}
            {app.status === "PENDING_REVIEW" && (
              <div className="rounded-2xl bg-status-waiting-bg p-5 border border-status-waiting/30">
                <h3 className="text-sm font-bold text-status-waiting">
                  ⏳ Application Under Active Review
                </h3>
                <p className="mt-1 text-xs text-ink-muted leading-relaxed">
                  Your registration has passed contact verification and is queued for Krenox administrative validation.
                  Expected response window: <strong>~1 hour</strong> from submission.
                </p>
              </div>
            )}

            {app.status === "ACTION_REQUIRED" && (
              <div className="rounded-2xl bg-amber-50 p-5 border border-amber-300">
                <h3 className="text-sm font-bold text-amber-900">
                  ⚠️ Additional Information Required by Administrator
                </h3>
                <p className="mt-1 text-xs text-amber-800 font-medium">
                  {app.status_reason || "Please provide further details regarding your facility address and expected queue service volume."}
                </p>

                {resubmitSuccess ? (
                  <div className="mt-4 p-3 rounded-xl bg-status-called-bg text-status-called text-xs font-bold border border-status-called/30">
                    ✓ {resubmitSuccess}
                  </div>
                ) : (
                  <form onSubmit={handleResubmit} className="mt-4 space-y-3">
                    <label className="block text-xs font-bold text-ink uppercase tracking-wider">
                      Provide Requested Clarification:
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={additionalNotes}
                      onChange={(e) => setAdditionalNotes(e.target.value)}
                      placeholder="Enter the requested information here..."
                      className="w-full rounded-2xl border border-line-strong bg-white p-3.5 text-xs text-ink outline-none focus:border-forest"
                    />
                    <Button type="submit" disabled={resubmitting} className="w-full !py-2.5">
                      {resubmitting ? "Submitting Clarification..." : "Resubmit Application for Review →"}
                    </Button>
                  </form>
                )}
              </div>
            )}

            {app.status === "APPROVED" && (
              <div className="rounded-2xl bg-status-called-bg p-5 border border-status-called/30">
                <h3 className="text-sm font-bold text-status-called">
                  🎉 Organisation Approved
                </h3>
                <p className="mt-1 text-xs text-ink-muted leading-relaxed">
                  Your organisation is fully authorized to operate virtual queues. You can now log in to the operations portal to configure facilities, services, and counters.
                </p>
                <div className="mt-4">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-xs font-bold text-white hover:bg-forest-dark transition"
                  >
                    Go to Operations Portal Login →
                  </Link>
                </div>
              </div>
            )}

            {app.status === "REJECTED" && (
              <div className="rounded-2xl bg-status-danger-bg p-5 border border-status-danger/30">
                <h3 className="text-sm font-bold text-status-danger">
                  ✕ Application Rejected
                </h3>
                <p className="mt-1 text-xs text-status-danger/90 font-medium leading-relaxed">
                  Reason provided by administrator: <strong>{app.status_reason || "Unable to verify institution credentials."}</strong>
                </p>
                <p className="mt-2 text-xs text-ink-muted">
                  If you believe this decision was made in error, please register with corrected information or contact support at <span className="font-mono">support@wisedev.online</span>.
                </p>
              </div>
            )}

            {app.status === "SUSPENDED" && (
              <div className="rounded-2xl bg-rose-100 p-5 border border-rose-300">
                <h3 className="text-sm font-bold text-rose-900">
                  ⛔ Organisation Suspended
                </h3>
                <p className="mt-1 text-xs text-rose-800 leading-relaxed font-medium">
                  Reason: {app.status_reason || "Operational review required"}. Queue creation and ticket processing have been temporarily restricted.
                </p>
              </div>
            )}

            <div className="pt-4 border-t border-line text-center">
              <Link
                href="/"
                className="text-xs font-semibold text-ink-muted hover:text-ink transition underline underline-offset-4"
              >
                ← Return to Platform Home
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function OrganisationStatusPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-canvas" />}>
      <StatusContent />
    </Suspense>
  );
}

