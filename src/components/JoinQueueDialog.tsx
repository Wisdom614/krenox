"use client";

import { FormEvent, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button, Eyebrow, Modal } from "@/components/ui";
import { desksLabel, getService, isValidPhone, organisation, saveTicket, services } from "@/lib/queue";
import { fetchServices, joinBackendQueue, sendWhatsAppOtp, verifyWhatsAppOtp } from "@/lib/api";

type Props = { initialServiceId: string; onClose: () => void };

const inputClass =
  "mt-2 w-full rounded-2xl border border-line-strong bg-white px-4 py-3.5 text-sm font-medium text-ink outline-none transition duration-200 placeholder:text-ink-subtle focus:border-forest focus:ring-4 focus:ring-forest/10 aria-[invalid=true]:border-status-danger";

export default function JoinQueueDialog({ initialServiceId, onClose }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [serviceId, setServiceId] = useState(initialServiceId);
  const [backendServices, setBackendServices] = useState<{ id: string; name: string; prefix: string; avg_duration_minutes: number }[]>([]);
  
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [reminder, setReminder] = useState(true);
  const [notifyThreshold, setNotifyThreshold] = useState<number>(2);
  
  // WhatsApp OTP verification states
  const [otpSent, setOtpSent] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [otpError, setOtpError] = useState("");

  const [touched, setTouched] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [generalError, setGeneralError] = useState("");

  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    fetchServices().then((svcs) => {
      if (svcs && svcs.length > 0) {
        setBackendServices(svcs);
        if (!svcs.some((s) => s.id === serviceId)) {
          setServiceId(svcs[0].id);
        }
      }
    });
  }, [serviceId]);

  const service = backendServices.find((s) => s.id === serviceId) || getService(serviceId);
  const nameError = name.trim().length < 2 ? "Please enter your name." : "";
  const phoneError = reminder && !isValidPhone(phone) ? "Enter a valid phone number (+237...)" : "";

  async function handleSendOtp() {
    setOtpError("");
    if (!isValidPhone(phone)) {
      setOtpError("Please enter a valid phone number first (e.g. +237 671 234 567).");
      return;
    }
    try {
      setIsVerifyingOtp(true);
      await sendWhatsAppOtp(phone);
      setOtpSent(true);
      // Auto-focus first digit
      setTimeout(() => otpInputsRef.current[0]?.focus(), 100);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send OTP";
      setOtpError(msg);
    } finally {
      setIsVerifyingOtp(false);
    }
  }

  function handleOtpDigitChange(index: number, val: string) {
    // Handle paste of full 6-digit code
    if (val.length > 1) {
      const pasted = val.replace(/\D/g, "").slice(0, 6);
      if (pasted.length > 0) {
        const nextDigits = [...otpDigits];
        for (let i = 0; i < 6; i++) {
          nextDigits[i] = pasted[i] || "";
        }
        setOtpDigits(nextDigits);
        const focusIdx = Math.min(pasted.length, 5);
        otpInputsRef.current[focusIdx]?.focus();
        if (pasted.length === 6) {
          triggerVerification(pasted);
        }
      }
      return;
    }

    const cleanChar = val.replace(/\D/g, "");
    const nextDigits = [...otpDigits];
    nextDigits[index] = cleanChar;
    setOtpDigits(nextDigits);

    if (cleanChar && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }

    const fullCode = nextDigits.join("");
    if (fullCode.length === 6) {
      triggerVerification(fullCode);
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  }

  async function triggerVerification(code: string) {
    setOtpError("");
    try {
      setIsVerifyingOtp(true);
      await verifyWhatsAppOtp(phone, code);
      setIsPhoneVerified(true);
      setOtpSent(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid code. Please re-check.";
      setOtpError(msg);
    } finally {
      setIsVerifyingOtp(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    setGeneralError("");

    if (nameError || phoneError) return;
    if (reminder && !isPhoneVerified) {
      setOtpError("Please verify your WhatsApp number to activate queue alerts.");
      return;
    }

    setIsJoining(true);
    try {
      const registered = await joinBackendQueue({
        service_id: service.id,
        customer_name: name.trim(),
        customer_phone: reminder ? phone.trim() : undefined,
        reminder_opt_in: reminder,
        notify_threshold: notifyThreshold,
      });

      saveTicket({
        ticket: registered.ticket_number,
        pin: registered.pin,
        serviceId: registered.service_id,
        name: registered.customer_name,
        phone: registered.masked_phone || "",
        reminder,
        joinedAt: new Date(registered.joined_at).getTime(),
      });

      router.push(`/waiting?ticketId=${registered.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      setGeneralError(msg);
      setIsJoining(false);
    }
  }

  return (
    <Modal titleId="join-title" onClose={onClose} size="lg">
      <div className="flex items-center justify-between border-b border-line bg-canvas px-6 py-5 sm:px-8">
        <div>
          <p className="text-xs font-semibold text-forest uppercase tracking-wider">
            {("facilities" in service && (service as unknown as { facilities?: { organisations?: { name?: string } } }).facilities?.organisations?.name) || "Virtual Queue"}
          </p>
          <h2 id="join-title" className="mt-1 text-xl font-bold text-ink">
            Join the Virtual Queue
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close registration"
          className="grid h-9 w-9 place-items-center rounded-full bg-surface text-lg text-ink-muted border border-line hover:text-ink hover:border-forest/40 transition"
        >
          &times;
        </button>
      </div>

      <form onSubmit={submit} noValidate className="px-6 py-6 sm:px-8">
        {/* Progress tracker */}
        <ol className="flex items-center gap-3 text-xs font-semibold" aria-label="Registration steps">
          <StepIndicator n={1} label="Service Counter" active={step === 1} done={step === 2} />
          <li aria-hidden className="h-px flex-1 bg-line" />
          <StepIndicator n={2} label="Customer & WhatsApp" active={step === 2} done={false} />
        </ol>

        {step === 1 ? (
          <fieldset className="mt-6">
            <legend className="text-sm font-bold text-ink">
              Select the service counter you need assistance with:
            </legend>
            <div className="mt-3.5 grid gap-3">
              {(backendServices.length > 0 ? backendServices : services).map((item) => {
                const isSelected = serviceId === item.id;
                return (
                  <label
                    key={item.id}
                    className={`flex cursor-pointer items-center justify-between rounded-2xl border p-4.5 transition-all duration-200 ${
                      isSelected
                        ? "border-forest bg-forest text-white shadow-md"
                        : "border-line bg-surface hover:border-forest/40 hover:bg-surface-hover"
                    }`}
                  >
                    <span className="flex items-center gap-3.5">
                      <input
                        className="accent-mint h-4 w-4"
                        type="radio"
                        name="service"
                        checked={isSelected}
                        onChange={() => setServiceId(item.id)}
                      />
                      <span>
                        <span className={`block text-sm font-bold ${isSelected ? "text-white" : "text-ink"}`}>
                          {item.name}
                        </span>
                        <span className={`block text-xs ${isSelected ? "text-white/80" : "text-ink-muted"}`}>
                          {desksLabel("desksOpen" in item ? Number(item.desksOpen) : 2)}
                        </span>
                      </span>
                    </span>
                    <span className="text-right">
                      <span className={`block font-mono text-sm font-bold ${isSelected ? "text-mint" : "text-forest"}`}>
                        ~{"avg_duration_minutes" in item ? item.avg_duration_minutes : 15} min
                      </span>
                      <span className={`block text-[11px] ${isSelected ? "text-white/70" : "text-ink-subtle"}`}>
                        est. wait
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <Button className="mt-6 w-full" onClick={() => setStep(2)}>
              Continue to Customer Details →
            </Button>
          </fieldset>
        ) : (
          <div className="mt-6">
            <div className="flex items-center justify-between rounded-2xl bg-forest/5 border border-forest/15 px-4 py-3 text-sm">
              <span>
                <span className="font-bold text-forest">{service.name}</span>{" "}
                <span className="text-ink-muted">· Live line active</span>
              </span>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs font-bold text-forest underline underline-offset-4 hover:opacity-80"
              >
                Change Service
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                Your Full Name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Fru"
                  className={inputClass}
                />
                <FieldError id="name-error" show={touched} message={nameError} />
              </label>

              <label className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                WhatsApp Phone
                <input
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setIsPhoneVerified(false);
                    setOtpSent(false);
                  }}
                  type="tel"
                  placeholder="+237 6XX XXX XXX"
                  className={inputClass}
                />
                <FieldError id="phone-error" show={touched} message={phoneError} />
              </label>
            </div>

            {/* Privacy Shield Pill */}
            <div className="mt-2 flex items-center gap-2.5 rounded-xl bg-surface-sunken border border-line px-3.5 py-2 text-xs text-ink-muted">
              <span className="text-forest font-bold">🔒</span>
              <span><strong>Campus Privacy:</strong> Your phone number is strictly encrypted and never visible on public monitors or tickets.</span>
            </div>

            {/* WhatsApp Verification & Proximity Settings */}
            <div className="mt-4 rounded-2xl border border-line bg-surface p-4.5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={reminder}
                    onChange={(e) => setReminder(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-forest"
                  />
                  <div>
                    <span className="block text-sm font-bold text-ink">
                      WhatsApp Digital Pass & Live Alert
                    </span>
                    <span className="block text-xs leading-relaxed text-ink-muted mt-0.5">
                      Receive your ticket directly in WhatsApp with a heads-up chime before your turn.
                    </span>
                  </div>
                </label>

                {reminder && (
                  <div className="shrink-0">
                    {isPhoneVerified ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-status-called-bg px-3 py-1 text-xs font-bold text-status-called border border-status-called/20">
                        ✓ Verified
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={isVerifyingOtp || !isValidPhone(phone)}
                        className="rounded-full bg-forest px-3.5 py-1.5 text-xs font-bold text-white hover:bg-forest-dark transition disabled:opacity-40"
                      >
                        {isVerifyingOtp ? "Sending..." : "Verify Number"}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 6-Digit OTP Entry Boxes */}
              {reminder && otpSent && !isPhoneVerified && (
                <div className="mt-4 border-t border-line pt-4">
                  <p className="text-xs font-semibold text-ink">
                    Enter the 6-digit WhatsApp code sent to <span className="font-mono font-bold text-forest">{phone}</span>:
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2 max-w-xs">
                    {otpDigits.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => { otpInputsRef.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpDigitChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        className="h-11 w-11 rounded-xl border border-line-strong bg-white text-center font-mono text-lg font-bold text-ink focus:border-forest focus:ring-2 focus:ring-forest/20 outline-none transition"
                      />
                    ))}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={isVerifyingOtp}
                      className="font-bold text-forest underline hover:opacity-80"
                    >
                      Resend code
                    </button>
                    <span className="text-ink-subtle">Auto-verifies upon 6 digits</span>
                  </div>
                </div>
              )}

              {/* Threshold Selector */}
              {reminder && isPhoneVerified && (
                <div className="mt-4 border-t border-line pt-3">
                  <label htmlFor="threshold-select" className="block text-xs font-bold text-ink mb-1.5">
                    When should we alert you before your turn?
                  </label>
                  <select
                    id="threshold-select"
                    value={notifyThreshold}
                    onChange={(e) => setNotifyThreshold(Number(e.target.value))}
                    className="w-full rounded-xl border border-line-strong bg-surface-sunken px-3.5 py-2 text-xs font-semibold text-ink outline-none focus:border-forest"
                  >
                    <option value={1}>When 1 person is ahead (Immediate next)</option>
                    <option value={2}>When 2 people are ahead (~5 mins away)</option>
                    <option value={3}>When 3 people are ahead (~10 mins away)</option>
                    <option value={5}>When 5 people are ahead (~15 mins away)</option>
                  </select>
                </div>
              )}

              {otpError && (
                <p className="mt-2 text-xs font-semibold text-status-danger">{otpError}</p>
              )}
            </div>

            {generalError && (
              <div className="mt-4 rounded-xl bg-status-danger-bg p-3.5 text-xs font-semibold text-status-danger border border-status-danger/20">
                {generalError}
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <Button variant="secondary" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                type="submit"
                disabled={isJoining || (reminder && !isPhoneVerified)}
                className="flex-1"
              >
                {isJoining ? "Generating Ticket..." : "Get Digital Ticket →"}
              </Button>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}

function StepIndicator({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <li className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
      <span
        className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold transition-colors ${
          active || done ? "bg-forest text-white" : "bg-line text-ink-subtle"
        }`}
      >
        {done ? "✓" : n}
      </span>
      <span className={active ? "font-bold text-forest" : "text-ink-subtle"}>{label}</span>
    </li>
  );
}

function FieldError({ id, show, message }: { id: string; show: boolean; message: string }) {
  return (
    <span id={id} role="alert" className="mt-1 block min-h-4 text-[11px] font-semibold text-status-danger">
      {show ? message : ""}
    </span>
  );
}
