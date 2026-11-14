"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui";

interface NavbarProps {
  onTakeTicket?: () => void;
  theme?: "light" | "dark" | "transparent";
  className?: string;
  activeTenantName?: string;
}

export function Navbar({
  onTakeTicket,
  theme = "light",
  className = "",
  activeTenantName,
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  // Scroll detection for sticky header backdrop
  useEffect(() => {
    function handleScroll() {
      if (window.scrollY > 20) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  // Close mobile menu on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Theme styling definitions
  const isLight = theme === "light";
  const textMuted = isLight ? "text-white/80 hover:text-white" : "text-soft hover:text-ink";

  return (
    <>
      <header
        className={`sticky top-0 z-40 w-full transition-all duration-300 ${
          scrolled
            ? isLight
              ? "bg-[#06262a]/95 backdrop-blur-md border-b border-white/10 shadow-lg"
              : "bg-white/95 backdrop-blur-md border-b border-line shadow-sm"
            : "bg-transparent"
        } ${className}`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 h-20">
          {/* Brand Logo & Optional Tenant Context */}
          <div className="flex items-center gap-3">
            <Logo
              href="/"
              variant={isLight ? "light" : "dark"}
              size="md"
              showTagline={true}
            />
            {activeTenantName && (
              <span className="hidden sm:inline-block text-xs font-semibold text-soft">
                {activeTenantName}
              </span>
            )}
          </div>

          {/* Desktop Direct Navigation Links (No finicky hover dropdowns) */}
          <nav className="hidden lg:flex items-center gap-7 text-sm font-semibold">
            {pathname === "/" ? (
              <>
                <a href="#how-it-works" className={`transition-colors ${textMuted}`}>
                  How It Works
                </a>
                <a href="#simulation" className={`transition-colors ${textMuted}`}>
                  Simulation Evaluation
                </a>
              </>
            ) : (
              <Link href="/" className={`transition-colors ${textMuted}`}>
                Home
              </Link>
            )}

            <Link
              href="/register-organisation"
              className={`transition-colors ${textMuted}`}
            >
              Register Organisation
            </Link>

            <Link
              href="/register-organisation/status"
              className={`transition-colors ${textMuted}`}
            >
              Track Application
            </Link>
          </nav>

          {/* Desktop Right Action CTA */}
          <div className="hidden lg:flex items-center gap-4">
            {onTakeTicket ? (
              <button
                onClick={onTakeTicket}
                className="inline-flex items-center justify-center rounded-full border border-mint/50 bg-mint px-6 py-2.5 text-sm font-bold text-forest-dark shadow-[0_8px_20px_rgba(0,245,160,0.25)] backdrop-blur transition-all duration-200 hover:bg-[#1affb2] hover:scale-105 active:scale-95 cursor-pointer"
              >
                Take a Ticket →
              </button>
            ) : (
              <Link
                href="/register-organisation"
                className="inline-flex items-center justify-center rounded-full border border-mint/50 bg-mint px-6 py-2.5 text-sm font-bold text-forest-dark shadow-[0_8px_20px_rgba(0,245,160,0.25)] backdrop-blur transition-all duration-200 hover:bg-[#1affb2] hover:scale-105 active:scale-95 cursor-pointer"
              >
                Register Free →
              </Link>
            )}
          </div>

          {/* Mobile Action & Hamburger Bar */}
          <div className="flex items-center gap-2.5 lg:hidden">
            {onTakeTicket && (
              <button
                onClick={onTakeTicket}
                className="px-4 py-2 rounded-full bg-mint text-forest-dark text-xs font-black shadow-md hover:bg-[#1affb2] active:scale-95 transition-all"
              >
                Take Ticket →
              </button>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`p-2.5 rounded-xl border transition-colors ${
                isLight
                  ? "border-white/20 text-white bg-white/10 hover:bg-white/20"
                  : "border-line text-ink bg-surface-sunken hover:bg-surface-hover"
              }`}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile Drawer / Slide-Over Navigation ── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-ink/80 backdrop-blur-md transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer Menu Panel */}
          <div className="fixed inset-x-0 top-0 max-h-[92vh] overflow-y-auto bg-surface border-b border-line-strong p-6 shadow-2xl rounded-b-[2.5rem] text-ink animate-in slide-in-from-top-4 duration-200">
            <div className="flex items-center justify-between border-b border-line pb-4 mb-6">
              <Logo
                href="/"
                variant="dark"
                size="md"
                showTagline={true}
              />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-xl text-soft hover:text-ink hover:bg-surface-sunken"
                aria-label="Close navigation"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Primary Action Button inside Drawer */}
            {onTakeTicket && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onTakeTicket();
                }}
                className="w-full py-4 rounded-full bg-forest text-white font-extrabold text-sm shadow-lg hover:bg-forest-dark active:scale-[0.98] transition flex items-center justify-center gap-2 mb-6"
              >
                <span>Take a Digital Queue Ticket Now</span>
                <span>→</span>
              </button>
            )}

            {/* Navigation Links List */}
            <div className="space-y-1">
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-3.5 rounded-2xl hover:bg-surface-sunken font-bold text-sm text-ink transition"
              >
                <span>Platform Home</span>
                <span className="text-soft">↗</span>
              </Link>

              {pathname === "/" ? (
                <>
                  <a
                    href="#how-it-works"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between p-3.5 rounded-2xl hover:bg-surface-sunken font-bold text-sm text-ink transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <svg className="w-4 h-4 text-forest" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>How It Works</span>
                    </div>
                    <span className="text-soft">↓</span>
                  </a>

                  <a
                    href="#simulation"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between p-3.5 rounded-2xl hover:bg-surface-sunken font-bold text-sm text-ink transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <svg className="w-4 h-4 text-forest" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span>Simulation Evaluation</span>
                    </div>
                    <span className="text-soft">↓</span>
                  </a>
                </>
              ) : null}

              <div className="pt-3 pb-1 border-t border-line my-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-soft px-3.5">
                  Organisations & Facilities
                </span>
              </div>

              <Link
                href="/register-organisation"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-3.5 rounded-2xl hover:bg-mint-soft text-forest font-bold text-sm transition"
              >
                <div className="flex items-center gap-2.5">
                  <svg className="w-4 h-4 text-forest" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span>Register an Organisation</span>
                </div>
              </Link>

              <Link
                href="/register-organisation/status"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-3.5 rounded-2xl hover:bg-surface-sunken font-bold text-sm text-ink transition"
              >
                <div className="flex items-center gap-2.5">
                  <svg className="w-4 h-4 text-soft" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span>Track Application Status</span>
                </div>
                <span className="text-soft">→</span>
              </Link>
            </div>

            <div className="mt-8 pt-4 border-t border-line text-center text-xs text-soft">
              <p>Krenox Virtual Queue Platform</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
