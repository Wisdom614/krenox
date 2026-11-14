"use client";

import Image from "next/image";
import Link from "next/link";
import { ReactNode, useEffect, useRef } from "react";

export function Logo({
  href = "/",
  className = "",
  size = "md",
  variant = "auto",
  showTagline = true,
}: {
  href?: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "light" | "dark" | "auto";
  showTagline?: boolean;
}) {
  const sizeMap = {
    sm: {
      box: "h-8 w-8 rounded-xl",
      iconSize: 22,
      title: "text-base tracking-tight",
      subtitle: "text-[9px] tracking-wider",
      gap: "gap-2.5",
    },
    md: {
      box: "h-11 w-11 rounded-2xl shadow-sm",
      iconSize: 30,
      title: "text-xl tracking-tight",
      subtitle: "text-[10px] tracking-wider",
      gap: "gap-3",
    },
    lg: {
      box: "h-14 w-14 rounded-2xl shadow-md",
      iconSize: 38,
      title: "text-2xl tracking-tight",
      subtitle: "text-xs tracking-widest",
      gap: "gap-3.5",
    },
    xl: {
      box: "h-16 w-16 rounded-[1.4rem] shadow-lg",
      iconSize: 44,
      title: "text-3xl tracking-tight",
      subtitle: "text-xs tracking-widest",
      gap: "gap-4",
    },
  }[size];

  const colorStyles = {
    auto: "text-current",
    light: "text-white",
    dark: "text-forest-dark",
  }[variant];

  const subtitleColor = {
    auto: "opacity-75",
    light: "text-mint font-semibold",
    dark: "text-forest font-semibold",
  }[variant];

  return (
    <Link
      href={href}
      className={`group inline-flex items-center ${sizeMap.gap} transition-transform active:scale-[0.98] ${colorStyles} ${className}`}
      aria-label="Krenox Virtual Queue Platform"
    >
      <div
        className={`relative grid place-items-center bg-[#06262a] border border-white/20 text-white overflow-hidden transition-all duration-300 group-hover:shadow-[0_8px_24px_rgba(0,245,160,0.25)] group-hover:scale-105 shrink-0 ${sizeMap.box}`}
      >
        <Image
          src="/krenox-mark.svg"
          alt="Krenox Mark"
          width={sizeMap.iconSize}
          height={sizeMap.iconSize}
          priority
          className="object-contain"
        />
      </div>
      <div className="flex flex-col select-none">
        <div className="flex items-center gap-1.5 leading-none">
          <span className={`font-display font-black tracking-tight ${sizeMap.title}`}>
            krenox
          </span>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-mint shadow-[0_0_8px_#00f5a0]" />
        </div>
        {showTagline && (
          <span className={`mt-1 font-bold uppercase leading-none ${sizeMap.subtitle} ${subtitleColor}`}>
            Virtual Queues
          </span>
        )}
      </div>
    </Link>
  );
}

export function LivePulseBadge({
  connected = true,
  className = "",
}: {
  connected?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold backdrop-blur transition-all duration-300 ${
        connected
          ? "bg-mint-soft text-forest border border-mint/40"
          : "bg-status-waiting-bg text-status-waiting border border-status-waiting/30"
      } ${className}`}
    >
      <span className="relative flex h-2 w-2">
        {connected && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-mint opacity-75 animate-ping" />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${
            connected ? "bg-[#00c98c]" : "bg-status-waiting"
          }`}
        />
      </span>
      <span>{connected ? "Live Realtime" : "Reconnecting..."}</span>
    </span>
  );
}

const buttonBase =
  "inline-flex items-center justify-center font-semibold rounded-full px-6 py-3 text-sm transition-all duration-200 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:cursor-not-allowed disabled:opacity-50 select-none";

const variants = {
  primary:
    "bg-forest text-white shadow-md hover:bg-forest-dark hover:shadow-lg active:bg-forest-dark",
  secondary:
    "border border-line-strong bg-white text-ink hover:bg-surface-hover hover:border-forest/40 shadow-sm",
  accent:
    "bg-mint text-forest-dark font-bold shadow-md hover:bg-[#1affb2] active:bg-[#00d697]",
  danger:
    "bg-status-danger text-white hover:bg-[#83102f] shadow-sm",
  ghost:
    "text-ink-muted hover:text-ink hover:bg-black/5 rounded-xl px-4 py-2",
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

export function Eyebrow({
  children,
  tone = "brand",
}: {
  children: ReactNode;
  tone?: "brand" | "danger" | "ok" | "muted" | "warn";
}) {
  const color = {
    brand: "text-forest",
    danger: "text-status-danger",
    ok: "text-status-called",
    muted: "text-ink-subtle",
    warn: "text-status-waiting",
  }[tone];
  return (
    <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${color}`}>
      {children}
    </p>
  );
}

/**
 * Accessible modal with focus trap, escape key, body scroll lock and smooth entrance.
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
      className="fixed inset-0 z-50 grid overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:place-items-center sm:p-6"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`ticket-pop my-auto w-full overflow-hidden rounded-[2rem] bg-white border border-line shadow-2xl ${
          size === "lg" ? "max-w-xl" : "max-w-md"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
