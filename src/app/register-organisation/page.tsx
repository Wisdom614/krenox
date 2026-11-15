"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui";
import { registerOrganisation, verifyOrganisationContact, resendOrganisationCode } from "@/lib/api";

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
  // Step state: 1 = Form, 2 = Verify Code, 3 = Confirmation
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form fields
  const [name, setName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [contactName, setContactName] = useState("");
  const [channel, setChannel] = useState<"whatsapp" | "email">("whatsapp");
  const [contactValue, setContactValue] = useState("");
  const [location, setLocation] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");

  // Verification state
  const [regRef, setRegRef] = useState("");
  const [maskedContact, setMaskedContact] = useState("");
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [copiedRef, setCopiedRef] = useState(false);

  // Progressive cooldown countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

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
      setError("Please fill in all required fields marked with an asterisk (*).");
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
      setResendCooldown(60);
      setResendSuccess(null);
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
        orgName: res.organisation_name || res.name || name.trim() || "Organisation",
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
    if (resendCooldown > 0 || isSubmitting || !regRef) return;
    setError(null);
    setResendSuccess(null);
    setIsSubmitting(true);
    try {
      const res = await resendOrganisationCode({ registration_ref: regRef });
      setResendSuccess(res.message || "A fresh 6-digit verification code has been dispatched.");
      setResendCooldown(res.cooldown_seconds || 60);
      setOtpDigits(["", "", "", "", "", ""]);
      setTimeout(() => otpInputsRef.current[0]?.focus(), 120);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to resend code";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-canvas text-ink selection:bg-mint selection:text-forest-dark">
      {/* ── Top Header ── */}
      <header className="border-b border-line bg-white/90 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Logo size="md" variant="dark" />
          <div className="flex items-center gap-3 sm:gap-6">
            <Link
              href="/register-organisation/status"
              className="text-xs font-semibold text-soft hover:text-ink flex items-center gap-1.5 transition"
            >
              <svg className="w-3.5 h-3.5 text-forest" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <span>Track Application</span>
            </Link>
            <Link
              href="/"
              className="text-xs font-semibold text-soft hover:text-ink hidden sm:inline-block transition"
            >
              Home
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Content Container ── */}
      <div className="mx-auto max-w-6xl px-5 py-9 sm:px-8 sm:py-14">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
          
          {/* ─────────────────────────────────────────────────────────────
              LEFT PANEL: INSTITUTIONAL CONTEXT & ASSURANCES (DESKTOP)
          ───────────────────────────────────────────────────────────── */}
          <aside className="space-y-5 lg:col-span-5 lg:sticky lg:top-24">
            <div className="rounded-[2rem] bg-forest p-7 text-white sm:p-9">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-mint">
                <span className="h-2 w-2 rounded-full bg-mint" />
                <span>Organisation onboarding</span>
              </div>
              <h1 className="mt-5 max-w-md font-display text-3xl font-bold leading-[1.05] tracking-tight text-balance sm:text-4xl">
                Set up the queue your organisation needs.
              </h1>
              <p className="mt-5 max-w-md text-sm leading-6 text-white/75">
                Start with your organisation details. Verify your contact, then we review your application before you configure facilities and services.
              </p>
            </div>

            {/* Stepper (Responsive) */}
            <div className="rounded-3xl border border-line bg-surface p-5 shadow-subtle sm:p-6">
              <span className="block text-sm font-bold text-ink mb-4">
                Your application progress
              </span>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${
                    step >= 1 ? "bg-forest text-white shadow-xs" : "bg-surface-sunken text-soft"
                  }`}>
                    {step > 1 ? "✓" : "1"}
                  </span>
                  <div>
                    <h4 className={`text-xs font-bold ${step === 1 ? "text-forest" : "text-ink"}`}>
                      Organisation Details
                    </h4>
                    <p className="text-xs text-soft">Organisation profile and location</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${
                    step >= 2 ? "bg-forest text-white shadow-xs" : "bg-surface-sunken text-soft"
                  }`}>
                    {step > 2 ? "✓" : "2"}
                  </span>
                  <div>
                    <h4 className={`text-xs font-bold ${step === 2 ? "text-forest" : "text-ink"}`}>
                      Contact Verification
                    </h4>
                    <p className="text-xs text-soft">Confirm your email or WhatsApp contact</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${
                    step === 3 ? "bg-forest text-white shadow-xs" : "bg-surface-sunken text-soft"
                  }`}>
                    3
                  </span>
                  <div>
                    <h4 className={`text-xs font-bold ${step === 3 ? "text-forest" : "text-ink"}`}>
                      Administrative Review
                    </h4>
                    <p className="text-xs text-soft">We review and activate your organisation</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 3 Core Assurances */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-2xl border border-line bg-surface p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-mint text-forest flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-ink">Review status you can track</h4>
                  <p className="text-[11px] text-soft mt-0.5">
                    Keep your reference number to check each stage of your application.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-surface p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-mint text-forest flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-ink">Built around your operation</h4>
                  <p className="text-[11px] text-soft mt-0.5">
                    Add the facilities, desks and service lines your customers actually use.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-surface p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-mint text-forest flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-ink">Verification comes first</h4>
                  <p className="text-[11px] text-soft mt-0.5">
                    We confirm your nominated contact before sending your application for review.
                  </p>
                </div>
              </div>
            </div>
          </aside>

          {/* ─────────────────────────────────────────────────────────────
              RIGHT PANEL: FORM CARD (MOBILE & DESKTOP OPTIMIZED)
          ───────────────────────────────────────────────────────────── */}
          <div className="lg:col-span-7">

            {/* ── STEP 1: FORM ── */}
            {step === 1 && (
              <div className="rounded-[2rem] border border-line bg-surface p-6 shadow-card sm:p-10">
                <div className="mb-6">
                  <p className="text-sm font-bold text-forest">Step 1 of 3</p>
                  <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
                    Tell us about your organisation
                  </h2>
                  <p className="mt-1 text-xs sm:text-sm text-soft leading-relaxed">
                    We only need enough information to identify your organisation and confirm the right contact person.
                  </p>
                </div>

                {error && (
                  <div className="mb-6 rounded-2xl bg-red-50 p-4 text-xs font-semibold text-red-700 border border-red-200 flex items-start gap-2.5">
                    <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleStartRegistration} className="space-y-5">
                  {/* Organisation Name */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                      Organisation / Institution Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      autoComplete="organization"
                      placeholder="e.g. Apex Hospital, Zenith Bank, University of Buea"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-2xl border border-line bg-white px-4 py-3 sm:py-3.5 text-sm font-semibold text-ink placeholder:font-normal placeholder:text-soft outline-none focus:border-forest focus:ring-4 focus:ring-forest/10 transition"
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                      Sector / Operational Category <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full appearance-none rounded-2xl border border-line bg-white px-4 py-3 sm:py-3.5 text-sm font-semibold text-ink outline-none focus:border-forest focus:ring-4 focus:ring-forest/10 transition pr-10"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c} className="text-ink">
                            {c}
                          </option>
                        ))}
                      </select>
                      <svg className="w-4 h-4 text-soft absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* 2-column: Contact Person & City */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                        Contact Person Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        autoComplete="name"
                        placeholder="e.g. Dr. Roland Tanyi"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        className="w-full rounded-2xl border border-line bg-white px-4 py-3 sm:py-3.5 text-sm font-semibold text-ink placeholder:font-normal placeholder:text-soft outline-none focus:border-forest focus:ring-4 focus:ring-forest/10 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                        Branch City / Location <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Buea, Douala, Yaoundé"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full rounded-2xl border border-line bg-white px-4 py-3 sm:py-3.5 text-sm font-semibold text-ink placeholder:font-normal placeholder:text-soft outline-none focus:border-forest focus:ring-4 focus:ring-forest/10 transition"
                      />
                    </div>
                  </div>

                  {/* Verification Channel Segmented Switcher */}
                  <div className="rounded-2xl border border-line bg-[#f8faf9] p-4 sm:p-5 space-y-3.5">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1">
                        Select Verification Method <span className="text-red-500">*</span>
                      </label>
                      <p className="text-[11px] text-soft">
                        Choose which channel receives your 6-digit verification code.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 p-1 bg-white rounded-2xl border border-line">
                      <button
                        type="button"
                        onClick={() => {
                          setChannel("whatsapp");
                          setContactValue("");
                          setError(null);
                        }}
                        className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          channel === "whatsapp"
                            ? "bg-forest text-white shadow-xs"
                            : "text-soft hover:text-ink hover:bg-surface-sunken"
                        }`}
                      >
                        <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86.173.086.275.072.376-.044.101-.116.433-.506.549-.68.116-.173.231-.145.39-.086s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824z" />
                        </svg>
                        <span>WhatsApp Code</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setChannel("email");
                          setContactValue("");
                          setError(null);
                        }}
                        className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          channel === "email"
                            ? "bg-forest text-white shadow-xs"
                            : "text-soft hover:text-ink hover:bg-surface-sunken"
                        }`}
                      >
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span>Email Code</span>
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1.5">
                        {channel === "whatsapp"
                          ? "WhatsApp-Enabled Mobile Number *"
                          : "Official Organisation Email Address *"}
                      </label>
                      <input
                        type={channel === "email" ? "email" : "tel"}
                        required
                        autoComplete={channel === "email" ? "email" : "tel"}
                        placeholder={channel === "whatsapp" ? "+237 6XX XXX XXX" : "admin@organisation.cm"}
                        value={contactValue}
                        onChange={(e) => setContactValue(e.target.value)}
                        className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink placeholder:font-normal placeholder:text-soft outline-none focus:border-forest focus:ring-4 focus:ring-forest/10 transition"
                      />
                      <p className="mt-1.5 text-[11px] text-soft">
                        {channel === "whatsapp"
                          ? "We will dispatch a 6-digit verification code directly to this WhatsApp number."
                          : "We will send your verification code and administrator invitation to this address."}
                      </p>
                    </div>
                  </div>

                  {/* Additional notes */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                      Planned Facilities & Service Lines <span className="text-soft font-normal text-[11px] lowercase">(optional)</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. 3 counter desks planned for Student Admissions & Fee Clearance."
                      value={additionalInfo}
                      onChange={(e) => setAdditionalInfo(e.target.value)}
                      className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium text-ink placeholder:font-normal placeholder:text-soft outline-none focus:border-forest focus:ring-4 focus:ring-forest/10 transition"
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-4 rounded-2xl bg-forest hover:bg-forest-dark active:scale-[0.99] text-white font-extrabold text-sm sm:text-base shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Dispatching Verification Code...</span>
                        </>
                      ) : (
                        <>
                          <span>Proceed to Contact Verification</span>
                          <span>→</span>
                        </>
                      )}
                    </button>
                    <p className="text-center text-[11px] text-soft mt-3">
                      By submitting, you agree to institutional queue governance standards.
                    </p>
                  </div>
                </form>
              </div>
            )}

            {/* ── STEP 2: 6-DIGIT VERIFICATION ── */}
            {step === 2 && (
              <div className="bg-white rounded-3xl p-6 sm:p-10 border border-line shadow-md text-center max-w-xl mx-auto">
                <div className="w-14 h-14 rounded-2xl bg-mint text-forest mx-auto flex items-center justify-center mb-4 shadow-xs">
                  {channel === "whatsapp" ? (
                    <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86.173.086.275.072.376-.044.101-.116.433-.506.549-.68.116-.173.231-.145.39-.086s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824z" />
                    </svg>
                  ) : (
                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>

                <span className="text-[11px] font-bold uppercase tracking-wider text-forest block mb-1">
                  Step 2 of 3 • Identity Verification
                </span>
                <h2 className="text-2xl font-extrabold text-ink tracking-tight">
                  Verify Your {channel === "whatsapp" ? "WhatsApp Number" : "Email Address"}
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-soft leading-relaxed max-w-sm mx-auto">
                  We dispatched a single-use 6-digit code to{" "}
                  <span className="font-mono font-bold text-forest">{maskedContact}</span>.
                </p>

                {resendSuccess && (
                  <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 border border-emerald-200 flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{resendSuccess}</span>
                  </div>
                )}

                {error && (
                  <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700 border border-red-200">
                    {error}
                  </div>
                )}

                {/* 6 Digit Input Boxes */}
                <div className="mt-7 flex items-center justify-center gap-2 sm:gap-3">
                  {otpDigits.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        otpInputsRef.current[i] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      className="h-12 w-11 sm:h-14 sm:w-13 rounded-2xl border border-line-strong bg-white text-center font-mono text-xl sm:text-2xl font-black text-ink focus:border-forest focus:ring-4 focus:ring-forest/15 outline-none transition"
                    />
                  ))}
                </div>

                {/* Actions with progressive countdown */}
                <div className="mt-7 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-soft max-w-sm mx-auto">
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resendCooldown > 0 || isSubmitting}
                    className={`font-semibold transition flex items-center gap-1.5 ${
                      resendCooldown > 0 || isSubmitting
                        ? "text-soft/60 cursor-not-allowed"
                        : "text-forest hover:text-forest-dark underline cursor-pointer"
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>
                      {resendCooldown > 0
                        ? `Resend code in ${resendCooldown}s`
                        : "Resend verification code"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setResendSuccess(null);
                      setStep(1);
                    }}
                    className="hover:text-ink transition cursor-pointer flex items-center gap-1"
                  >
                    <span>← Edit contact details</span>
                  </button>
                </div>

                <div className="mt-8">
                  <button
                    type="button"
                    onClick={() => submitVerificationCode()}
                    disabled={isSubmitting || otpDigits.join("").length < 6}
                    className="w-full py-3.5 rounded-2xl bg-forest hover:bg-forest-dark active:scale-[0.99] text-white font-extrabold text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? "Verifying Code..." : "Confirm & Submit for Review →"}
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 3: APPLICATION SUBMITTED & PENDING REVIEW ── */}
            {step === 3 && confirmationData && (
              <div className="bg-white rounded-3xl p-6 sm:p-10 border border-line shadow-md text-center max-w-xl mx-auto space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-mint text-forest mx-auto flex items-center justify-center shadow-xs">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>

                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold mb-3">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span>Status: PENDING_REVIEW</span>
                  </div>
                  <h2 className="text-2xl font-extrabold text-ink tracking-tight">
                    Registration Successfully Received
                  </h2>
                  <p className="mt-2 text-xs sm:text-sm text-soft leading-relaxed max-w-md mx-auto">
                    Your contact channel has been verified. The Krenox administration team is reviewing your institution application.
                  </p>
                </div>

                {/* Reference Card with Copy Action */}
                <div className="bg-[#f8faf9] rounded-2xl p-5 border border-line text-left space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-soft block">
                        Application Reference Code
                      </span>
                      <span className="font-mono text-lg font-black text-forest">
                        {confirmationData.ref}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== "undefined") {
                          navigator.clipboard?.writeText(confirmationData.ref);
                          setCopiedRef(true);
                          setTimeout(() => setCopiedRef(false), 2000);
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl border border-line bg-white hover:bg-surface-sunken text-xs font-bold text-ink transition shadow-2xs cursor-pointer"
                    >
                      {copiedRef ? "✓ Copied" : "Copy Code"}
                    </button>
                  </div>

                  <div className="pt-3 border-t border-line text-xs space-y-1.5 text-soft">
                    <div className="flex justify-between">
                      <span>Organisation:</span>
                      <strong className="text-ink">{confirmationData.orgName}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Verified Contact:</span>
                      <span className="font-mono font-bold text-ink">{confirmationData.maskedContact}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Expected Decision Window:</span>
                      <strong className="text-forest">{confirmationData.expectedWindow}</strong>
                    </div>
                  </div>
                </div>

                {/* What Happens Next Card */}
                <div className="rounded-2xl border border-line p-4 text-left text-xs space-y-2 bg-white">
                  <span className="font-bold uppercase tracking-wider text-ink block text-[11px]">
                    What Happens Next:
                  </span>
                  <div className="flex items-start gap-2 text-soft">
                    <span className="font-bold text-forest font-mono">1.</span>
                    <span>Admin reviews your submission details against institutional guidelines.</span>
                  </div>
                  <div className="flex items-start gap-2 text-soft">
                    <span className="font-bold text-forest font-mono">2.</span>
                    <span>Upon approval, you receive your official printable A4 QR poster link and setup token on WhatsApp.</span>
                  </div>
                  <div className="flex items-start gap-2 text-soft">
                    <span className="font-bold text-forest font-mono">3.</span>
                    <span>You log into your Dedicated Tenant Dashboard and start calling customers!</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                  <Link
                    href={`/register-organisation/status?ref=${confirmationData.ref}`}
                    className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-forest text-white font-bold text-xs hover:bg-forest-dark transition text-center shadow-xs"
                  >
                    Track Application Status ↗
                  </Link>
                  <Link
                    href="/"
                    className="w-full sm:w-auto py-3 px-5 rounded-xl border border-line bg-white text-soft hover:text-ink font-semibold text-xs transition text-center"
                  >
                    Return Home
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
