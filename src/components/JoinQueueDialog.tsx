"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Eyebrow, Modal } from "@/components/ui";
import { desksLabel, getService, isValidPhone, organisation, saveTicket, services } from "@/lib/queue";
import { fetchServices, joinBackendQueue, sendWhatsAppOtp, verifyWhatsAppOtp } from "@/lib/api";

type Props = { initialServiceId: string; onClose: () => void };

const inputClass =
  "mt-2 w-full rounded-xl border border-line-strong px-4 py-3 font-normal outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 aria-[invalid=true]:border-danger";

export default function JoinQueueDialog({ initialServiceId, onClose }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [serviceId, setServiceId] = useState(initialServiceId);
  const [backendServices, setBackendServices] = useState<{ id: string; name: string; prefix: string; avg_duration_minutes: number }[]>([]);
  
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [reminder, setReminder] = useState(true);
  
  // WhatsApp OTP verification states
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [devOtpHint, setDevOtpHint] = useState("");

  const [touched, setTouched] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [generalError, setGeneralError] = useState("");

  useEffect(() => {
    fetchServices().then((svcs) => {
      if (svcs && svcs.length > 0) {
        setBackendServices(svcs);
        // If current serviceId is not in backend list, map to first match
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
    setDevOtpHint("");
    if (!isValidPhone(phone)) {
      setOtpError("Please enter a valid phone number first.");
      return;
    }
    try {
      setIsVerifyingOtp(true);
      const res = await sendWhatsAppOtp(phone);
      setOtpSent(true);
      if (res.dev_code) {
        setDevOtpHint(`Code: ${res.dev_code}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send OTP";
      setOtpError(msg);
    } finally {
      setIsVerifyingOtp(false);
    }
  }

  async function handleVerifyOtp() {
    setOtpError("");
    if (otpCode.trim().length < 6) {
      setOtpError("Please enter the 6-digit code.");
      return;
    }
    try {
      setIsVerifyingOtp(true);
      await verifyWhatsAppOtp(phone, otpCode);
      setIsPhoneVerified(true);
      setOtpSent(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid code";
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
      // Connect to FastAPI + Supabase backend
      const registered = await joinBackendQueue({
        service_id: service.id,
        customer_name: name.trim(),
        customer_phone: reminder ? phone.trim() : undefined,
        reminder_opt_in: reminder,
      });

      // Persist in local storage for instant sync across tabs
      saveTicket({
        ticket: registered.ticket_number,
        pin: registered.pin,
        serviceId: registered.service_id,
        name: registered.customer_name,
        phone: reminder ? phone.trim() : "",
        reminder,
        joinedAt: new Date(registered.joined_at).getTime(),
      });

      router.push(`/waiting?ticketId=${registered.id}`);
    } catch (err: unknown) {
      console.error("Backend error, falling back to local simulation:", err);
      const msg = err instanceof Error ? err.message : "Registration failed";
      setGeneralError(msg);
      setIsJoining(false);
    }
  }

  return (
    <Modal titleId="join-title" onClose={onClose} size="lg">
      <div className="flex items-center justify-between border-b border-line px-6 py-5 sm:px-8">
        <div>
          <Eyebrow>{organisation.name}</Eyebrow>
          <h2 id="join-title" className="mt-1 text-xl font-bold">Join the queue</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close registration"
          className="grid h-10 w-10 place-items-center rounded-full bg-mint text-xl text-brand-ink hover:bg-line transition"
        >
          &times;
        </button>
      </div>

      <form onSubmit={submit} noValidate className="px-6 py-7 sm:px-8">
        <ol className="flex items-center gap-3 text-xs font-bold" aria-label="Progress">
          <StepDot n={1} label="Service" active={step === 1} done={step === 2} />
          <li aria-hidden className="h-px flex-1 bg-line-strong" />
          <StepDot n={2} label="Details & WhatsApp" active={step === 2} done={false} />
        </ol>

        {step === 1 ? (
          <fieldset className="mt-7">
            <legend className="text-sm font-bold">What do you need assistance with?</legend>
            <div className="mt-3 grid gap-3">
              {(backendServices.length > 0 ? backendServices : services).map((item) => (
                <label
                  key={item.id}
                  className={`flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition ${
                    serviceId === item.id ? "border-brand bg-mint shadow-sm" : "border-line hover:border-line-strong"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <input
                      className="accent-brand"
                      type="radio"
                      name="service"
                      checked={serviceId === item.id}
                      onChange={() => setServiceId(item.id)}
                    />
                    <span>
                      <span className="block text-sm font-bold text-ink">{item.name}</span>
                      <span className="block text-xs text-soft">
                        {desksLabel("desksOpen" in item ? Number(item.desksOpen) : 2)}
                      </span>
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-sm font-bold text-brand">
                      ~{"avg_duration_minutes" in item ? item.avg_duration_minutes : 15} min
                    </span>
                    <span className="block text-[11px] text-soft">estimate</span>
                  </span>
                </label>
              ))}
            </div>
            <Button className="mt-6 w-full" onClick={() => setStep(2)}>
              Continue →
            </Button>
          </fieldset>
        ) : (
          <div className="mt-7">
            <div className="flex items-center justify-between rounded-2xl bg-mint px-4 py-3 text-sm">
              <span>
                <span className="font-bold text-ink">{service.name}</span>{" "}
                <span className="text-soft">· Live queue ready</span>
              </span>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="font-bold text-brand underline underline-offset-4"
              >
                Change
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold text-ink">
                Your Full Name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ama N."
                  className={inputClass}
                />
                <FieldError id="name-error" show={touched} message={nameError} />
              </label>

              <label className="text-sm font-bold text-ink">
                WhatsApp Phone Number
                <input
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setIsPhoneVerified(false);
                  }}
                  type="tel"
                  placeholder="+237 6XX XXX XXX"
                  className={inputClass}
                />
                <FieldError id="phone-error" show={touched} message={phoneError} />
              </label>
            </div>

            {/* WhatsApp Verification Widget */}
            <div className="mt-4 rounded-2xl border border-line bg-[#f8faf9] p-4">
              <div className="flex items-start justify-between gap-3">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={reminder}
                    onChange={(e) => setReminder(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-brand"
                  />
                  <div>
                    <span className="block text-sm font-bold text-ink">
                      Send WhatsApp Ticket & Alerts
                    </span>
                    <span className="block text-xs leading-relaxed text-soft">
                      Receive your digital ticket via WhatsApp and get pinged when your turn is close.
                    </span>
                  </div>
                </label>

                {reminder && (
                  <div>
                    {isPhoneVerified ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#e9f7f0] px-3 py-1 text-xs font-bold text-ok">
                        ✓ Verified
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={isVerifyingOtp || !isValidPhone(phone)}
                        className="rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-dark transition disabled:opacity-50"
                      >
                        {isVerifyingOtp ? "Sending..." : "Verify Number"}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* OTP Entry Row */}
              {reminder && otpSent && !isPhoneVerified && (
                <div className="mt-4 border-t border-line/60 pt-3">
                  <p className="text-xs font-medium text-ink">
                    Enter the 6-digit WhatsApp code sent to {phone}:
                  </p>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      maxLength={6}
                      placeholder="e.g. 123456"
                      className="w-36 rounded-xl border border-line-strong px-3 py-2 font-mono text-center text-sm font-bold outline-none focus:border-brand"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyOtp}
                      disabled={isVerifyingOtp}
                      className="rounded-xl bg-ink px-4 py-2 text-xs font-bold text-white hover:bg-ink/80 transition"
                    >
                      Confirm
                    </button>
                    {devOtpHint && (
                      <span className="self-center text-xs font-mono font-bold text-brand bg-white px-2 py-1 rounded-lg border border-brand/20">
                        {devOtpHint}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {otpError && (
                <p className="mt-2 text-xs font-medium text-danger">{otpError}</p>
              )}
            </div>

            {generalError && (
              <div className="mt-4 rounded-xl bg-[#fde8e8] p-3 text-xs font-medium text-danger">
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

function StepDot({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <li className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
      <span
        className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${
          active || done ? "bg-brand text-white" : "bg-line text-soft"
        }`}
      >
        {done ? "✓" : n}
      </span>
      <span className={active ? "text-brand" : "text-soft"}>{label}</span>
    </li>
  );
}

function FieldError({ id, show, message }: { id: string; show: boolean; message: string }) {
  return (
    <span id={id} role="alert" className="mt-1.5 block min-h-4 text-xs font-medium text-danger">
      {show ? message : ""}
    </span>
  );
}
