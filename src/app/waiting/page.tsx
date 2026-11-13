import { Suspense } from "react";
import WaitingRoute from "@/components/WaitingRoute";

export default function WaitingPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#f7f8f6]" />}><WaitingRoute /></Suspense>;
}
