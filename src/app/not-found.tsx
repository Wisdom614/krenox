import Link from "next/link";
import { Logo } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#f8faf9] text-ink selection:bg-brand selection:text-white flex flex-col justify-between">
      <header className="border-b border-line/80 bg-white sticky top-0 z-30">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 sm:px-6 h-16">
          <Logo size="md" variant="dark" />
          <Link
            href="/"
            className="text-xs font-bold text-soft hover:text-ink transition"
          >
            ← Back to Home
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-md px-6 py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-forest/10 text-forest mx-auto flex items-center justify-center mb-6">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <span className="text-xs font-bold uppercase tracking-wider text-forest block mb-2">
          Error 404 · Page Not Found
        </span>

        <h1 className="text-3xl font-extrabold tracking-tight text-ink mb-3">
          This counter is not in service
        </h1>

        <p className="text-xs sm:text-sm text-soft leading-relaxed mb-8">
          The link you visited might have moved, expired, or been typed incorrectly. Let's get you back on track.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="w-full sm:w-auto px-6 py-3 rounded-full bg-forest text-white font-bold text-xs hover:bg-forest-dark transition shadow-xs"
          >
            Explore Active Queues
          </Link>
          <Link
            href="/register-organisation/status"
            className="w-full sm:w-auto px-6 py-3 rounded-full bg-white border border-line text-ink font-bold text-xs hover:bg-surface-sunken transition"
          >
            Track Application
          </Link>
        </div>
      </section>

      <footer className="border-t border-line py-6 text-center text-xs text-soft">
        Krenox Virtual Queue Platform · Enterprise Multi-Tenant Dispatch
      </footer>
    </main>
  );
}

