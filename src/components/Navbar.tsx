"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";

interface NavbarProps {
  onTakeTicket?: () => void;
  theme?: "light" | "dark" | "transparent";
  className?: string;
  activeTenantName?: string;
}

export function Navbar({ onTakeTicket, theme = "light", className = "", activeTenantName }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const { user, role, dashboardRoute } = useAuth();
  const menuId = useId();
  const isHomepage = pathname === "/";
  const isLight = theme === "light";
  const navText = isLight ? "text-white/80 hover:text-white" : "text-ink-muted hover:text-ink";
  const tenantText = isLight ? "text-white/60" : "text-ink-subtle";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const closeMenu = () => setMobileMenuOpen(false);
  const primaryAction = onTakeTicket
    ? <button type="button" onClick={onTakeTicket} className="nav-primary-action">Take a ticket</button>
    : <Link href="/register-organisation" className="nav-primary-action">Register organisation</Link>;

  return (
    <>
      <header className={`sticky top-0 z-40 w-full border-b transition-[background-color,border-color,box-shadow] duration-200 ${scrolled ? (isLight ? "border-white/10 bg-[#06262a]/95 shadow-lg backdrop-blur-md" : "border-line bg-white/95 shadow-subtle backdrop-blur-md") : "border-transparent bg-transparent"} ${className}`}>
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Logo href="/" variant={isLight ? "light" : "dark"} size="md" showTagline />
            {activeTenantName && <span className={`hidden truncate border-l pl-3 text-xs font-semibold sm:block ${tenantText}`}>{activeTenantName}</span>}
          </div>

          <nav aria-label="Primary navigation" className="hidden items-center gap-6 text-sm font-semibold lg:flex">
            {isHomepage ? <><Link href="#platform" className={`transition-colors ${navText}`}>Platform</Link><Link href="#directory" className={`transition-colors ${navText}`}>Find a queue</Link><Link href="#simulation" className={`transition-colors ${navText}`}>Simulation</Link></> : <Link href="/" className={`transition-colors ${navText}`}>Platform home</Link>}
            <Link href={user ? dashboardRoute : "/login"} className={`transition-colors ${navText}`}>{user ? (role === "tenant_admin" ? "Organisation console" : role === "super_admin" ? "Platform admin" : "Staff console") : "Staff sign in"}</Link>
          </nav>

          <div className="hidden lg:block">{primaryAction}</div>
          <div className="flex items-center lg:hidden"><button type="button" onClick={() => setMobileMenuOpen((open) => !open)} className={`grid h-11 w-11 place-items-center rounded-xl border transition-colors ${isLight ? "border-white/20 bg-white/10 text-white hover:bg-white/20" : "border-line bg-surface text-ink hover:bg-surface-sunken"}`} aria-controls={menuId} aria-expanded={mobileMenuOpen} aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileMenuOpen ? "M6 18 18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} /></svg></button></div>
        </div>
      </header>

      {mobileMenuOpen && typeof document !== "undefined" && createPortal(<div id={menuId} className="fixed inset-0 z-[100] lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
        <button type="button" className="absolute inset-0 h-full w-full cursor-default bg-ink/65 backdrop-blur-sm" aria-label="Close navigation" onClick={closeMenu} />
        <div className="relative mx-auto mt-3 max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-lg overflow-y-auto rounded-3xl border border-line bg-surface p-5 text-ink shadow-elevated">
          <div className="flex items-center justify-between border-b border-line pb-4"><Logo href="/" variant="dark" size="md" showTagline /><button type="button" onClick={closeMenu} className="grid h-11 w-11 place-items-center rounded-xl text-ink-muted transition hover:bg-surface-sunken hover:text-ink" aria-label="Close navigation"><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" /></svg></button></div>
          <nav aria-label="Mobile navigation" className="mt-5 space-y-1"><Link href="/" onClick={closeMenu} className="nav-mobile-link">Platform home</Link><Link href="/#platform" onClick={closeMenu} className="nav-mobile-link">How Krenox works</Link><Link href="/#directory" onClick={closeMenu} className="nav-mobile-link">Find an organisation</Link><Link href="/#simulation" onClick={closeMenu} className="nav-mobile-link">Simulation workspace</Link><div className="my-4 border-t border-line" /><Link href={user ? dashboardRoute : "/login"} onClick={closeMenu} className="nav-mobile-link">{user ? "Open your console" : "Staff and admin sign in"}</Link><Link href="/register-organisation/status" onClick={closeMenu} className="nav-mobile-link">Track an application</Link></nav>
          <div className="mt-6">{onTakeTicket ? <button type="button" onClick={() => { closeMenu(); onTakeTicket(); }} className="nav-primary-action w-full">Take a ticket</button> : <Link href="/register-organisation" onClick={closeMenu} className="nav-primary-action flex w-full">Register organisation</Link>}</div>
        </div>
      </div>, document.body)}
    </>
  );
}
