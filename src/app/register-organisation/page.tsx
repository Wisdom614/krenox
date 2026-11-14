"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Eyebrow, Logo } from "@/components/ui";
import { registerOrganisation, verifyOrganisationContact } from "@/lib/api";

const CATEGORIES = [
  "Healthcare & Medical Facilities",
  "Higher Education & Universities",
  "Banking & Financial Services",
  "Government & Public Sector",
  "Commercial & Retail Services",
  "Logistics & Customer Support",
  "Other Institutions",
];

export default function RegisterOrganisationPage() {
  const router = useRouter();

  // Step state: 1 = Form, 2 = Verify Code, 3 = Confirmation
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form fields
  const [name, setName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [contactName, setContactName] = useState("");
  const [channel, setChannel] = useState<"email" | "whatsapp">("whatsapp");
  const [contactValue, setContactValue] = useState("");
  const [location, setLocation] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");

  // Verification state
  const [regRef, setRegRef] = useState("");
  const [maskedContact, setMaskedContact] = useState("");
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Confirmation payload
  const [confirmationData, setConfirmationData] = useState<{
    ref: string;
    orgName: string;
    channel: string;
    maskedContact: string;
    status: string;
    expectedWindow: string;
  } | null>(null);

  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  async function handleStartRegistration(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !contactName.trim() || !contactValue.trim() || !location.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await registerOrganisation({
        name: name.trim(),
        category,
        contact_name: contactName.trim(),
        contact_channel: channel,
        contact_value: contactValue.trim(),
        location: location.trim(),
        additional_info: additionalInfo.trim() || undefined,
      });

      setRegRef(res.registration_ref);
      setMaskedContact(res.masked_contact || res.masked_contact_value || res.contact_value || "");
      setStep(2);
      setTimeout(() => otpInputsRef.current[0]?.focus(), 150);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registration request failed";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleDigitChange(index: number, val: string) {
    if (val.length > 1) {
      const pasted = val.replace(/\D/g, "").slice(0, 6);
      if (pasted.length > 0) {
        const next = [...otpDigits];
        for (let i = 0; i < 6; i++) next[i] = pasted[i] || "";
        setOtpDigits(next);
        otpInputsRef.current[Math.min(pasted.length, 5)]?.focus();
        if (pasted.length === 6) {
          submitVerificationCode(pasted);
        }
      }
      return;
    }

    const clean = val.replace(/\D/g, "");
    const next = [...otpDigits];
    next[index] = clean;
    setOtpDigits(next);

    if (clean && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }

    const fullCode = next.join("");
    if (fullCode.length === 6) {
      submitVerificationCode(fullCode);
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  }

  async function submitVerificationCode(codeString?: string) {
    const code = codeString || otpDigits.join("");
    if (code.length < 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const res = await verifyOrganisationContact({
        registration_ref: regRef,
        code,
      });

      setConfirmationData({
        ref: res.registration_ref,
        orgName: res.organisation_name || res.name || "Organisation",
        channel: res.contact_channel,
        maskedContact: res.masked_contact || res.masked_contact_value || res.contact_value || "",
        status: res.status,
        expectedWindow: res.expected_review_window || res.expected_review_within || "Within 1 hour",
      });
      setStep(3);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Verification code failed";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendCode() {
    setError(null);
    setIsSubmitting(true);
    try {
      await registerOrganisation({
        name: name.trim(),
        category,
        contact_name: contactName.trim(),
        contact_channel: channel,
        contact_value: contactValue.trim(),
        location: location.trim(),
        additional_info: additionalInfo.trim() || undefined,
      });
      setError("A new verification code has been dispatched.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to resend code";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-canvas text-ink pb-24 selection:bg-mint selection:text-forest-dark">
      {/* ── Top Header ── */}
      <header className="border-b border-line bg-canvas/80 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Logo size="md" variant="dark" />
          <div className="flex items-center gap-4">
            <Link
              href="/register-organisation/status"
              className="text-xs font-semibold text-soft hover:text-ink transition"
            >
              Track Application
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 pt-10 sm:pt-14">
        {/* Step Indicator */}
        <div className="mb-8">
          <ol className="flex items-center justify-between text-xs font-bold" aria-label="Registration stages">
            <li className={`flex items-center gap-2 ${step >= 1 ? "text-forest" : "text-ink-subtle"}`}>
              <span
                className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${
                  step >= 1 ? "bg-forest text-white" : "bg-line text-ink-subtle"
                }`}
              >
                1
              </span>
              <span>Organisation Details</span>
            </li>
            <li aria-hidden className={`h-px flex-1 mx-3 ${step >= 2 ? "bg-forest" : "bg-line"}`} />
            <li className={`flex items-center gap-2 ${step >= 2 ? "text-forest" : "text-ink-subtle"}`}>
              <span
                className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${
                  step >= 2 ? "bg-forest text-white" : "bg-line text-ink-subtle"
                }`}
              >
                2
              </span>
              <span>Contact Verification</span>
            </li>
            <li aria-hidden className={`h-px flex-1 mx-3 ${step >= 3 ? "bg-forest" : "bg-line"}`} />
            <li className={`flex items-center gap-2 ${step === 3 ? "text-forest" : "text-ink-subtle"}`}>
              <span
                className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${
                  step === 3 ? "bg-forest text-white" : "bg-line text-ink-subtle"
                }`}
              >
                3
              </span>
              <span>Review Submission</span>
            </li>
          </ol>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            STEP 1: REGISTRATION FORM
        ───────────────────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="ticket-pop rounded-[2.5rem] bg-surface p-7 sm:p-10 border border-line shadow-card">
            <div className="mb-6">
              <Eyebrow tone="brand">Organisation Onboarding</Eyebrow>
              <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                Register Your Organisation
              </h1>
              <p className="mt-2 text-sm text-ink-muted leading-relaxed">
                Provide your institution details. Once your contact channel is verified, our team will review your application within 1 hour.
              </p>
            </div>

            {error && (
              <div className="mb-6 rounded-2xl bg-status-danger-bg p-4 text-xs font-semibold text-status-danger border border-status-danger/20">
                {error}
              </div>
            )}

            <form onSubmit={handleStartRegistration} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                  Organisation / Institution Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Hospital, Zenith Bank, University of Buea"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-2xl border border-line-strong bg-white px-4 py-3.5 text-sm font-medium text-ink outline-none focus:border-forest focus:ring-4 focus:ring-forest/10 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                  Organisation Category / Type *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-2xl border border-line-strong bg-white px-4 py-3.5 text-sm font-semibold text-ink outline-none focus:border-forest transition"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                    Contact Person Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Roland Tanyi"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full rounded-2xl border border-line-strong bg-white px-4 py-3.5 text-sm font-medium text-ink outline-none focus:border-forest focus:ring-4 focus:ring-forest/10 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                    Primary Location / Branch City *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Buea, Douala, Yaounde"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full rounded-2xl border border-line-strong bg-white px-4 py-3.5 text-sm font-medium text-ink outline-none focus:border-forest focus:ring-4 focus:ring-forest/10 transition"
                  />
                </div>
              </div>

              {/* Preferred Verification Channel Toggle */}
              <div className="rounded-2xl border border-line bg-surface-sunken p-4.5">
                <p className="text-xs font-bold uppercase tracking-wider text-ink mb-2">
                  Select Contact Verification Method *
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setChannel("whatsapp");
                      setContactValue("");
                      setError(null);
                    }}
                    className={`flex items-center justify-center gap-2 rounded-xl p-3 text-xs font-bold transition-all ${
                      channel === "whatsapp"
                        ? "bg-forest text-white shadow-sm"
                        : "bg-surface border border-line text-ink hover:bg-surface-hover"
                    }`}
                  >
                    <span>💬</span>
                    <span>WhatsApp Code</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setChannel("email");
                      setContactValue("");
                      setError(null);
                    }}
                    className={`flex items-center justify-center gap-2 rounded-xl p-3 text-xs font-bold transition-all ${
                      channel === "email"
                        ? "bg-forest text-white shadow-sm"
                        : "bg-surface border border-line text-ink hover:bg-surface-hover"
                    }`}
                  >
                    <span>✉️</span>
                    <span>Email Code</span>
                  </button>
                </div>

                <div className="mt-4">
                  <label className="block text-xs font-semibold text-ink-muted mb-1.5">
                    {channel === "whatsapp"
                      ? "WhatsApp-Enabled Mobile Number (Format: +237 6XX XXX XXX)"
                      : "Official Organisation Email Address"}
                  </label>
                  <input
                    type={channel === "email" ? "email" : "tel"}
                    required
                    placeholder={channel === "whatsapp" ? "+237 671 234 567" : "admin@organisation.cm"}
                    value={contactValue}
                    onChange={(e) => setContactValue(e.target.value)}
                    className="w-full rounded-2xl border border-line-strong bg-white px-4 py-3 text-sm font-medium text-ink outline-none focus:border-forest transition"
                  />
                  <p className="mt-1 text-[11px] text-ink-subtle">
                    We will send a single-use 6-digit code to this channel to verify ownership.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                  Additional Details / Expected Queue Capacity (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. 3 planned service counters with ~150 visitors per day."
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  className="w-full rounded-2xl border border-line-strong bg-white px-4 py-3 text-sm font-medium text-ink outline-none focus:border-forest transition"
                />
              </div>

              <Button type="submit" disabled={isSubmitting} className="w-full !py-3.5 !text-base">
                {isSubmitting ? "Sending Verification Code..." : "Proceed to Contact Verification →"}
              </Button>
            </form>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            STEP 2: 6-DIGIT CODE VERIFICATION
        ───────────────────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="ticket-pop rounded-[2.5rem] bg-surface p-7 sm:p-10 border border-line shadow-card text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-mint-soft text-2xl text-forest mb-4 border border-mint/40">
              {channel === "whatsapp" ? "💬" : "✉️"}
            </div>
            <Eyebrow tone="brand">Verification Required</Eyebrow>
            <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">
              Verify Your {channel === "whatsapp" ? "WhatsApp Number" : "Email Address"}
            </h2>
            <p className="mt-2 text-sm text-ink-muted max-w-md mx-auto leading-relaxed">
              We sent a 6-digit verification code to <span className="font-mono font-bold text-forest">{maskedContact}</span>.
              Enter it below to complete verification.
            </p>

            {error && (
              <div className="mt-4 rounded-xl bg-status-danger-bg p-3 text-xs font-semibold text-status-danger border border-status-danger/20">
                {error}
              </div>
            )}

            <div className="mt-7 flex items-center justify-center gap-2 sm:gap-3">
              {otpDigits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    otpInputsRef.current[i] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className="h-12 w-11 sm:w-12 rounded-2xl border border-line-strong bg-white text-center font-mono text-xl font-bold text-ink focus:border-forest focus:ring-4 focus:ring-forest/15 outline-none transition"
                />
              ))}
            </div>

            <div className="mt-7 flex items-center justify-between text-xs text-ink-muted max-w-xs mx-auto">
              <button
                type="button"
                onClick={handleResendCode}
                disabled={isSubmitting}
                className="font-bold text-forest underline hover:opacity-80"
              >
                Resend Code
              </button>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-ink-subtle hover:text-ink"
              >
                Edit Contact Details
              </button>
            </div>

            <div className="mt-8">
              <Button
                onClick={() => submitVerificationCode()}
                disabled={isSubmitting || otpDigits.join("").length < 6}
                className="w-full !py-3.5"
              >
                {isSubmitting ? "Verifying Code..." : "Confirm & Submit Application →"}
              </Button>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            STEP 3: REGISTRATION RECEIVED & PENDING REVIEW
        ───────────────────────────────────────────────────────────── */}
        {step === 3 && confirmationData && (
          <div className="ticket-pop rounded-[2.5rem] bg-surface p-7 sm:p-10 border border-line shadow-elevated">
            <div className="text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-mint-soft text-3xl text-forest mb-4 border border-mint/40">
                ✓
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-status-waiting-bg px-3.5 py-1 text-xs font-bold text-status-waiting border border-status-waiting/30">
                <span className="h-2 w-2 rounded-full bg-status-waiting animate-pulse" />
                Status: PENDING_REVIEW
              </span>
              <h1 className="mt-3 font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                Your organisation registration has been received successfully.
              </h1>
              <p className="mt-3 text-sm text-ink-muted leading-relaxed max-w-lg mx-auto">
                Your contact information has been verified, and your registration has been forwarded to the Krenox administration team for review. We expect to get back to you within 1 hour.
              </p>
            </div>

            {/* Application Overview Card */}
            <div className="mt-8 rounded-3xl bg-surface-sunken p-6 border border-line space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-subtle">
                  Registration Reference
                </span>
                <span className="font-mono text-base font-bold text-forest">
                  {confirmationData.ref}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-line pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-subtle">
                  Organisation Name
                </span>
                <span className="text-sm font-bold text-ink">
                  {confirmationData.orgName}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-line pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-subtle">
                  Verified Contact
                </span>
                <span className="font-mono text-xs font-bold text-ink">
                  {confirmationData.channel.toUpperCase()}: {confirmationData.maskedContact}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-subtle">
                  Expected Response Target
                </span>
                <span className="text-xs font-bold text-status-called">
                  ~1 Hour Response
                </span>
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                href={`/register-organisation/status?ref=${confirmationData.ref}`}
                className="flex-1 text-center rounded-full bg-forest px-6 py-3.5 text-sm font-bold text-white hover:bg-forest-dark transition"
              >
                Track Review Status Live →
              </Link>
              <Link
                href="/"
                className="flex-1 text-center rounded-full border border-line bg-surface px-6 py-3.5 text-sm font-bold text-ink hover:bg-surface-hover transition"
              >
                Return to Homepage
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

