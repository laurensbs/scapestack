import { Suspense } from "react";
import { ToolHeader } from "@/components/tool-header";
import { DpsClient } from "./dps-client";
import { BossRoster } from "@/components/boss-roster";

export const metadata = {
  title: "Can I kill this?",
  description: "Add bank and get one boss verdict: best gear, first trip, stop point and upgrade check from your bank."
};

// Suspense wrapper required by Next.js 16 for any child that calls
// useSearchParams — without one, the production build refuses to
// prerender. Same pattern we use on /bank.
export default function DpsPage() {
  return (
    <main className="scape-page">
      <ToolHeader slug="dps" />
      <Suspense fallback={null}>
        <DpsClient />
      </Suspense>
      {/* Outside the boundary on purpose. DpsClient calls useSearchParams,
          which keeps everything inside the Suspense out of the prerendered
          HTML — so a roster rendered in there is invisible to anything that
          does not run JavaScript. */}
      <BossRoster />
    </main>
  );
}
