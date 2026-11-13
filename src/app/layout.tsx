import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Krenox | Queue less, live more",
  description: "A configurable virtual queue management system.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
