import { Suspense } from "react";
import { ToolHeader } from "@/components/tool-header";
import { DpsClient } from "./dps-client";

export const metadata = {
  title: "Can I kill this?",
  description: "Paste your bank and get one boss verdict: setup, first trip, stop point and upgrade check from gear you already own."
};

// Suspense wrapper required by Next.js 16 for any child that calls
// useSearchParams — without one, the production build refuses to
// prerender. Same pattern we use on /bank.
export default function DpsPage() {
  return (
    <main className="relative z-10 mx-auto max-w-6xl px-5 py-7 pb-20">
      <ToolHeader slug="dps" />
      <Suspense fallback={null}>
        <DpsClient />
      </Suspense>
    </main>
  );
}
