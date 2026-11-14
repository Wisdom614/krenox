"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { fetchPublicTenantQueues, PublicTenantQueuesResponse } from "@/lib/api";

type Props = {
  params: Promise<{ slug: string }>;
};

export default function OrganisationPosterPage({ params }: Props) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;

  const [data, setData] = useState<PublicTenantQueuesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    let active = true;
    if (!slug) return;

    fetchPublicTenantQueues(slug)
      .then((res) => {
        if (active) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || "Failed to load organisation poster");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [slug]);

  // Generate QR Code
  useEffect(() => {
    if (!data) return;

    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://krenox.vercel.app";

    const targetUrl = `${origin}/q/${data.organisation.slug}`;

    QRCode.toDataURL(targetUrl, {
      width: 480,
      margin: 2,
      color: {
        dark: "#084d56",
        light: "#ffffff",
      },
      errorCorrectionLevel: "H",
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("QR Code generation error:", err));
  }, [data]);

  const targetUrl = data
    ? `${typeof window !== "undefined" ? window.location.origin : "https://krenox.vercel.app"}/q/${data.organisation.slug}`
    : "";

  const sealInitials = data
    ? data.organisation.name
        .split(" ")
        .map((w) => w[0])
        .filter(Boolean)
        .slice(0, 3)
        .join("")
        .toUpperCase()
    : "KRN";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#041a1d] text-white flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-mint border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-white/80">Loading official poster...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#041a1d] text-white flex items-center justify-center p-6">
        <div className="max-w-md bg-white/5 border border-white/10 rounded-3xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-coral/20 text-coral flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <h2 className="text-lg font-bold">Poster Not Available</h2>
          <p className="text-xs text-white/60 leading-relaxed">
            {error || "Organisation could not be found or has not been approved."}
          </p>
          <Link
            href="/"
            className="inline-block px-5 py-2.5 rounded-full bg-mint text-forest-dark font-bold text-xs hover:bg-mint-dark transition"
          >
            Return to Krenox
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a2327] py-6 sm:py-12 px-4 print:p-0 print:bg-white text-ink">
      {/* ── SCREEN CONTROLS BAR (Hidden in print) ── */}
      <div className="max-w-2xl mx-auto mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/10 backdrop-blur-md p-4 rounded-3xl border border-white/15 text-white no-print shadow-xl">
        <div className="flex items-center gap-3">
          <Link
            href={`/q/${slug}`}
            className="text-xs font-semibold text-mint hover:underline flex items-center gap-1"
          >
            ← Live Queue
          </Link>
          <span className="text-white/30">|</span>
          <span className="text-xs font-bold truncate max-w-[200px]">
            {data.organisation.name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                navigator.clipboard?.writeText(window.location.href);
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
              }
            }}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold transition"
          >
            {copiedLink ? "✓ Link Copied" : "Copy Poster Link"}
          </button>

          <button
            onClick={() => window.print()}
            className="px-5 py-2 rounded-xl bg-mint hover:bg-mint-dark text-forest-dark font-bold text-xs sm:text-sm shadow-md flex items-center gap-1.5 transition"
          >
            <span>Print A4 Poster 🖨</span>
          </button>
        </div>
      </div>

      {/* ── PRINTABLE POSTER CONTAINER (A4 standard format) ── */}
      <div className="printable-a4-sheet max-w-2xl mx-auto bg-white rounded-3xl p-8 sm:p-14 shadow-2xl relative border border-line-strong flex flex-col items-center text-center print:shadow-none print:border-none print:p-8 print:max-w-full">
        {/* Organisation Seal Badge */}
        <div className="w-16 h-16 rounded-2xl bg-[#084d56] text-white flex items-center justify-center font-black text-2xl shadow-md mb-3 tracking-wider">
          {sealInitials}
        </div>

        {/* Institution Category / Tagline */}
        <div className="text-xs uppercase tracking-widest font-bold text-[#084d56] mb-1">
          {data.organisation.name} • Virtual Queue Entry Point
        </div>

        {/* Poster Main Title */}
        <h1 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight mb-2">
          Student & Visitor Digital Queue
        </h1>

        <p className="text-sm sm:text-base text-soft max-w-lg mb-6 leading-relaxed">
          Skip the crowded waiting room. Scan the QR code below with your smartphone camera to take your digital ticket and track your spot live on WhatsApp.
        </p>

        {/* Big High-Contrast QR Code */}
        <div className="p-4 bg-white border-4 border-[#084d56] rounded-3xl shadow-md mb-6">
          {qrDataUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={qrDataUrl}
              alt="Queue Ticket QR"
              className="w-64 h-64 sm:w-80 sm:h-80 object-contain"
            />
          ) : (
            <div className="w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center text-soft text-xs">
              Generating high-resolution QR...
            </div>
          )}
        </div>

        {/* Verified Target Link */}
        <div className="font-mono text-xs text-[#084d56] font-bold bg-[#e8f6f3] px-5 py-2 rounded-xl border border-line-strong mb-6 max-w-full truncate">
          {targetUrl}
        </div>

        {/* 3 Step Visual Guide */}
        <div className="grid grid-cols-3 gap-4 w-full border-t border-b border-line py-6 mb-6 text-left">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-[#084d56] text-white font-bold flex items-center justify-center text-sm flex-shrink-0">
              1
            </div>
            <div>
              <h4 className="font-bold text-xs text-ink">Scan Code</h4>
              <p className="text-[11px] text-soft">
                Open phone camera or QR scanner
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-[#084d56] text-white font-bold flex items-center justify-center text-sm flex-shrink-0">
              2
            </div>
            <div>
              <h4 className="font-bold text-xs text-ink">Take Ticket</h4>
              <p className="text-[11px] text-soft">
                Pick your service & enter phone
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-[#084d56] text-white font-bold flex items-center justify-center text-sm flex-shrink-0">
              3
            </div>
            <div>
              <h4 className="font-bold text-xs text-ink">Relax & Enter</h4>
              <p className="text-[11px] text-soft">
                We alert you when counter is ready
              </p>
            </div>
          </div>
        </div>

        {/* Anti-crowding policy notice */}
        <div className="text-[11px] text-soft max-w-md">
          <p>
            <strong className="text-ink">Anti-Crowding Policy:</strong> Please do not crowd the entrance or service counter doors. You will receive an alert on your phone when your ticket is called.
          </p>
          <p className="text-[10px] text-muted mt-2 font-mono">
            Powered by Krenox Virtual Queue Engine • University of Buea B.Tech Computer Engineering
          </p>
        </div>
      </div>

      {/* ── PRINT-SPECIFIC CSS RULES ── */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print,
          header,
          footer,
          nav {
            display: none !important;
          }
          .printable-a4-sheet {
            box-shadow: none !important;
            border: none !important;
            padding: 10mm !important;
            max-width: 100% !important;
            margin: 0 auto !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
        }
      `}</style>
    </div>
  );
}
