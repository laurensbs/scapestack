"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { track } from "@/lib/analytics";

// Client-only wrapper so the homepage (a server component) can fire a
// Plausible event when the "see sample" link is clicked. Tracking
// happens before navigation — Plausible's event API is fire-and-forget,
// it doesn't need to settle before the route change.
export function SampleBankLink() {
  return (
    <Link
      href="/bank?sample=1"
      className="btn-ghost"
      onClick={() => track("homepage:sample")}
    >
      <Sparkles className="size-3.5" />
      See it with a sample bank
    </Link>
  );
}
