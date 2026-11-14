import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--nf-display", display: "swap" });
const body = Instrument_Sans({ subsets: ["latin"], variable: "--nf-body", display: "swap" });

export const metadata: Metadata = {
  title: "Krenox | Queue less, live more",
  description: "Take a ticket on your phone, follow your place in line, and arrive when it is nearly your turn.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
