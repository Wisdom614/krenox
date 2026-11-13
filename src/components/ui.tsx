"use client";

import Image from "next/image";
import Link from "next/link";
import { ReactNode, useEffect, useRef } from "react";

export function Logo({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={`flex items-center gap-3 ${className}`} aria-label="Krenox home">
      <Image src="/krenox-mark.svg" alt="" width={40} height={40} priority />
      <span className="text-xl font-bold tracking-tight">krenox</span>
    </Link>
  );
}

const buttonBase =
  "inline-flex items-center justify-center rounded-full px-6 py-3.5 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60";
const variants = {
  primary: "bg-brand text-white shadow-[0_12px_26px_rgba(13,101,112,.22)] hover:bg-brand-dark",
  secondary: "border border-line-strong bg-white text-brand-ink hover:border-brand",
  danger: "bg-danger text-white hover:bg-[#8a2d2d]",
  ghost: "text-brand-ink underline decoration-line-strong underline-offset-4 hover:decoration-brand",
};
export type ButtonVariant = keyof typeof variants;

export const buttonClass = (variant: ButtonVariant = "primary", extra = "") =>
  `${buttonBase} ${variants[variant]} ${extra}`;

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}

export function Eyebrow({ children, tone = "brand" }: { children: ReactNode; tone?: "brand" | "danger" | "ok" | "muted" | "warn" }) {
  const color = { brand: "text-brand", danger: "text-danger", ok: "text-ok", muted: "text-soft", warn: "text-warn" }[tone];
  return <p className={`text-xs font-bold uppercase tracking-[.16em] ${color}`}>{children}</p>;
}

/**
 * Accessible modal: Escape and backdrop close it, Tab is trapped inside,
 * page scroll is locked and focus returns to the opener on close.
 */
export function Modal({
  titleId,
  onClose,
  children,
  size = "md",
}: {
  titleId: string;
  onClose: () => void;
  children: ReactNode;
  size?: "md" | "lg";
}) {
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () =>
      Array.from(
        panel.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    (focusables().find((el) => el.dataset.autofocus !== undefined) ?? focusables()[0])?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") return onCloseRef.current();
      if (event.key !== "Tab") return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 grid overflow-y-auto bg-ink/55 p-4 backdrop-blur-sm sm:place-items-center sm:p-6"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`my-auto w-full overflow-hidden rounded-[2rem] bg-white shadow-2xl ${size === "lg" ? "max-w-xl" : "max-w-md"}`}
      >
        {children}
      </div>
    </div>
  );
}
