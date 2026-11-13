"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Eyebrow, Modal } from "@/components/ui";
import { createMockTicket, desksLabel, getService, isValidPhone, organisation, saveTicket, services } from "@/lib/queue";

type Props = { initialServiceId: string; onClose: () => void };

const inputClass =
  "mt-2 w-full rounded-xl border border-line-strong px-4 py-3 font-normal outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 aria-[invalid=true]:border-danger";

export default function JoinQueueDialog({ initialServiceId, onClose }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [serviceId, setServiceId] = useState(getService(initialServiceId).id);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [reminder, setReminder] = useState(true);
  const [touched, setTouched] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const service = getService(serviceId);
  const nameError = name.trim().length < 2 ? "Please enter your name." : "";
  const phoneError = reminder && !isValidPhone(phone) ? "Enter a valid number, e.g. +237 6XX XXX XXX." : "";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    if (nameError || phoneError) return;
    setIsJoining(true);
    saveTicket(createMockTicket({ serviceId, name: name.trim(), phone: reminder ? phone.trim() : "", reminder }));
    router.push("/waiting");
  }

  return (
    <Modal titleId="join-title" onClose={onClose} size="lg">
      <div className="flex items-center justify-between border-b border-line px-6 py-5 sm:px-8">
        <div>
          <Eyebrow>{organisation.name}</Eyebrow>
          <h2 id="join-title" className="mt-1 text-xl font-bold">Join the queue</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close queue registration" className="grid h-10 w-10 place-items-center rounded-full bg-mint text-xl text-brand-ink hover:bg-line">
          &times;
        </button>
      </div>

      <form onSubmit={submit} noValidate className="px-6 py-7 sm:px-8">
        <ol className="flex items-center gap-3 text-xs font-bold" aria-label="Progress">
          <StepDot n={1} label="Service" active={step === 1} done={step === 2} />
          <li aria-hidden className="h-px flex-1 bg-line-strong" />
          <StepDot n={2} label="Details" active={step === 2} done={false} />
        </ol>

        {step === 1 ? (
          <fieldset className="mt-7">
            <legend className="text-sm font-bold">What do you need help with?</legend>
            <div className="mt-3 grid gap-3">
              {services.map((item) => (
                <label key={item.id} className={`flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand ${serviceId === item.id ? "border-brand bg-mint" : "border-line hover:border-line-strong"}`}>
                  <span className="flex items-center gap-3">
                    <input className="accent-brand" type="radio" name="service" checked={serviceId === item.id} onChange={() => setServiceId(item.id)} />
                    <span>
                      <span className="block text-sm font-bold">{item.name}</span>
                      <span className="block text-xs text-soft">{desksLabel(item.desksOpen)}</span>
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-sm font-bold text-brand">~{item.waitMinutes} min</span>
                    <span className="block text-[11px] text-soft">estimate</span>
                  </span>
                </label>
              ))}
            </div>
            <Button className="mt-6 w-full" onClick={() => setStep(2)} data-autofocus>Continue</Button>
          </fieldset>
        ) : (
          <div className="mt-7">
            <div className="flex items-center justify-between rounded-2xl bg-mint px-4 py-3 text-sm">
              <span><span className="font-bold">{service.name}</span> <span className="text-soft">· ~{service.waitMinutes} min</span></span>
              <button type="button" onClick={() => setStep(1)} className="font-bold text-brand underline underline-offset-4">Change</button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold">
                Your name
                <input data-autofocus value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="e.g. Ama N." aria-invalid={touched && !!nameError} aria-describedby="name-error" className={inputClass} />
                <FieldError id="name-error" show={touched} message={nameError} />
              </label>
              <label className="text-sm font-bold">
                WhatsApp number {reminder && <span className="text-brand" aria-hidden>*</span>}
                <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="+237 6XX XXX XXX" aria-invalid={touched && !!phoneError} aria-describedby="phone-error" className={inputClass} />
                <FieldError id="phone-error" show={touched} message={phoneError} />
              </label>
            </div>

            <label className="mt-5 flex cursor-pointer gap-3 rounded-2xl bg-[#f3f7f6] p-4">
              <input className="mt-0.5 h-4 w-4 accent-brand" type="checkbox" checked={reminder} onChange={(e) => setReminder(e.target.checked)} />
              <span>
                <span className="block text-sm font-bold text-brand-ink">Send me WhatsApp reminders</span>
                <span className="mt-1 block text-xs leading-5 text-muted">Get a message when you are about 3 people from the front. Optional — your ticket works without it.</span>
              </span>
            </label>

            <p className="mt-4 text-xs leading-5 text-soft">Prototype only: a browser-local mock ticket and PIN are created for design review.</p>
            <div className="mt-6 flex gap-3">
              <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
              <Button type="submit" disabled={isJoining} className="flex-1">{isJoining ? "Creating your ticket…" : "Get my digital ticket →"}</Button>
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
      <span className={`grid h-7 w-7 place-items-center rounded-full ${active || done ? "bg-brand text-white" : "bg-line text-soft"}`}>{done ? "✓" : n}</span>
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
