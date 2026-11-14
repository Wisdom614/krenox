"use client";

import Link from "next/link";
import { Logo } from "@/components/ui";

interface FooterProps {
  className?: string;
}

export function Footer({ className = "" }: FooterProps) {
  return (
    <footer className={`bg-[#041a1d] text-white border-t border-white/10 ${className}`}>
      {/* ── Main Footer Grid ── */}
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-12 pb-16 border-b border-white/10">
          {/* Column 1 & 2: Brand & Positioning */}
          <div className="lg:col-span-2 space-y-4">
            <Logo variant="light" size="md" showTagline={true} />
            <p className="text-xs text-white/75 leading-relaxed max-w-sm pt-2">
              Configurable multi-tenant virtual queue management system designed to eliminate physical waiting lines in high-traffic institutions, supported by discrete-event simulation evaluation.
            </p>

            <div className="flex items-center gap-2 text-xs text-mint">
              <span className="w-1.5 h-1.5 rounded-full bg-mint" />
              <span>Operational Multi-Tenant Dispatch</span>
            </div>

            <div className="pt-2 text-[11px] text-white/50">
              Department of Computer Engineering · University of Buea
            </div>
          </div>

          {/* Column 3: Platform Capabilities */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-4">
              Platform Features
            </h4>
            <ul className="space-y-2.5 text-xs text-white/70">
              <li>
                <a href="#how-it-works" className="hover:text-mint transition-colors">
                  Virtual Ticket Dispatch
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-mint transition-colors">
                  WhatsApp Arrival Alerts
                </a>
              </li>
              <li>
                <span className="text-white/70">Multi-Facility Isolation</span>
              </li>
              <li>
                <span className="text-white/70">Counter Operator Consoles</span>
              </li>
              <li>
                <span className="text-white/70">Tamper-Evident Audit Logs</span>
              </li>
            </ul>
          </div>

          {/* Column 4: Research & Evaluation */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-4">
              Simulation Core
            </h4>
            <ul className="space-y-2.5 text-xs text-white/70">
              <li>
                <a href="#simulation" className="hover:text-mint transition-colors">
                  Discrete-Event Modeling
                </a>
              </li>
              <li>
                <a href="#simulation" className="hover:text-mint transition-colors">
                  M/M/c & M/G/c Stochastic Queues
                </a>
              </li>
              <li>
                <a href="#simulation" className="hover:text-mint transition-colors">
                  Wait-Time Reduction Data
                </a>
              </li>
              <li>
                <span className="text-white/70">Counter Utilization Metrics</span>
              </li>
              <li>
                <span className="text-white/70">Lobby Congestion Density</span>
              </li>
            </ul>
          </div>

          {/* Column 5: Organisations & Governance */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-4">
              For Organisations
            </h4>
            <ul className="space-y-2.5 text-xs text-white/70">
              <li>
                <Link
                  href="/register-organisation"
                  className="hover:text-mint transition-colors"
                >
                  Register Organisation
                </Link>
              </li>
              <li>
                <Link
                  href="/register-organisation/status"
                  className="hover:text-mint transition-colors"
                >
                  Track Application Status
                </Link>
              </li>
              <li>
                <span className="text-white/70">1-Hour Administrative Review</span>
              </li>
              <li>
                <span className="text-white/70">Email & WhatsApp Verification</span>
              </li>
              <li>
                <span className="text-white/70">Printable QR Code Posters</span>
              </li>
            </ul>
          </div>
        </div>

        {/* ── Sub-Footer Bottom Bar ── */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/50">
          <div className="flex items-center gap-2">
            <span>© 2026 Krenox Platform. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6">
            <span>B.Tech Final Engineering Project</span>
            <span>·</span>
            <span className="font-mono text-[11px] text-white/40">v1.2.0-multi-tenant</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

