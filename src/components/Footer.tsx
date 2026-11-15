"use client";

import Link from "next/link";
import { Logo } from "@/components/ui";

interface FooterProps { className?: string; }

const footerLink = "text-sm leading-6 text-white/65 transition hover:text-mint focus-visible:text-mint";

export function Footer({ className = "" }: FooterProps) {
  return (
    <footer className={`border-t border-white/10 bg-[#041a1d] text-white ${className}`}>
      <div className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
        <div className="grid gap-12 border-b border-white/10 pb-12 md:grid-cols-2 lg:grid-cols-[1.45fr_.8fr_.9fr]">
          <div>
            <Logo variant="light" size="md" showTagline />
            <p className="mt-5 max-w-sm text-sm leading-6 text-white/65">A configurable queue platform for organisations that need customers, service desks and queue information to stay in step.</p>
            <p className="mt-5 text-sm text-mint">Built as a B.Tech. Computer Engineering project at the University of Buea.</p>
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Explore Krenox</h2>
            <ul className="mt-4 space-y-2"><li><Link href="/#platform" className={footerLink}>How the platform works</Link></li><li><Link href="/#directory" className={footerLink}>Find an organisation</Link></li><li><Link href="/#simulation" className={footerLink}>Simulation and evaluation</Link></li><li><Link href="/waiting" className={footerLink}>Recover a ticket</Link></li></ul>
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">For organisations</h2>
            <ul className="mt-4 space-y-2"><li><Link href="/register-organisation" className={footerLink}>Register your organisation</Link></li><li><Link href="/register-organisation/status" className={footerLink}>Track an application</Link></li><li><Link href="/login" className={footerLink}>Staff and admin sign in</Link></li></ul>
          </div>
        </div>
        <div className="flex flex-col gap-2 pt-7 text-sm text-white/45 sm:flex-row sm:items-center sm:justify-between"><p>© 2026 Krenox Platform</p><p>Virtual queue management and simulation evaluation</p></div>
      </div>
    </footer>
  );
}
