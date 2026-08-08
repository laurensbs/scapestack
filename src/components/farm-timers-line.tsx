"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * The only thing in this product with a clock in it.
 *
 * Farm and birdhouse timers were plumbed end to end for contract v4 — plugin
 * reader, payload, DB column, redaction, and a finished presenter in
 * plugin-sync-diagnostics.ts that emits exactly "2 ready · next in 1h 20m" —
 * and rendered nowhere. Every other line on this page is true whenever you
 * read it, which is another way of saying no line on this page is a reason to
 * come back at any particular moment. "Your herbs are ready in 40 minutes" is.
 *
 * Formatting happens in the browser, not on the server: a server-rendered
 * "next in 1h 20m" is correct for one minute and a lie for the rest of the
 * session, and this component's whole value is that its number can be trusted.
 * The absolute timestamps come down; the countdown is computed here and
 * re-ticks every 30 seconds.
 *
 * Owner-only by construction — `farming` is stripped by redactSyncedPlayer for
 * anyone who is not the paired browser, so this renders for the account holder
 * or not at all.
 */

export interface FarmPatchTimer {
  patch: string;
  crop: string | null;
  state: string;
  readyAt: string | null;
}

function until(target: number, now: number): string {
  const minutes = Math.round((target - now) / 60_000);
  if (minutes <= 0) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export function FarmTimersLine({
  patches,
  rsn
}: {
  patches: readonly FarmPatchTimer[];
  rsn: string;
}) {
  // Start at 0 and fill in after mount: Date.now() during render would differ
  // between the server pass and the client pass and hydrate mismatched.
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const ready = patches.filter((patch) => patch.state === "ready");
  const lost = patches.filter((patch) => patch.state === "diseased" || patch.state === "dead");
  const growing = patches
    .filter((patch) => patch.state === "growing" && patch.readyAt)
    .map((patch) => ({ patch, at: Date.parse(patch.readyAt as string) }))
    .filter((entry) => Number.isFinite(entry.at))
    .sort((left, right) => left.at - right.at);

  // A patch whose readyAt has passed while the tab sat open is ready, whatever
  // the last scan called it.
  const dueNow = now > 0 ? growing.filter((entry) => entry.at <= now) : [];
  const stillGrowing = now > 0 ? growing.filter((entry) => entry.at > now) : growing;
  const readyCount = ready.length + dueNow.length;
  const next = stillGrowing[0];

  if (readyCount === 0 && !next && lost.length === 0) return null;

  const parts: string[] = [];
  if (readyCount > 0) parts.push(`${readyCount} ${readyCount === 1 ? "patch" : "patches"} ready`);
  if (next) {
    const label = next.patch.crop ? `${next.patch.crop} in ${until(next.at, now)}` : `next in ${until(next.at, now)}`;
    parts.push(now > 0 ? label : "next run pending");
  }
  if (lost.length > 0) parts.push(`${lost.length} diseased or dead`);

  return (
    <aside
      aria-label="Your farm"
      data-farm-timers="true"
      className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-y border-[var(--color-border)] py-3"
    >
      <span className="eyebrow">Your farm</span>
      <span className="tabular-nums text-[length:var(--text-body)] font-normal text-[var(--color-text)]">
        {parts.join(" · ")}.
      </span>
      {readyCount > 0 && (
        <Link
          href={`/u/${encodeURIComponent(rsn)}`}
          className="text-[length:var(--text-micro)] font-normal text-[var(--color-text-muted)] underline underline-offset-2"
        >
          Which patches
        </Link>
      )}
    </aside>
  );
}
